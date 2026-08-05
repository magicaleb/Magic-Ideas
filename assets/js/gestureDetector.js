/*
 * Full-surface gesture detector for mobile performance screens.
 *
 * Swipes and taps are classified separately, so two quick swipes can never be
 * mistaken for a double-tap. A quick two-finger tap, a deliberate two-finger
 * hold, and a two-finger directional swipe are classified independently.
 */
(function attachGestureDetector(root, factory) {
  const GestureDetector = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = GestureDetector;
  }

  if (root) {
    root.GestureDetector = GestureDetector;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGestureDetector() {
  'use strict';

  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  class GestureDetector {
    constructor(options = {}) {
      this.minSwipeDistance = Math.max(12, Number(options.minSwipeDistance) || 32);
      this.maxTapDistance = Math.max(4, Number(options.maxTapDistance) || 14);
      this.maxTapDuration = Math.max(100, Number(options.maxTapDuration) || 320);
      this.doubleTapDelay = Math.max(150, Number(options.doubleTapDelay) || 320);
      this.doubleTapDistance = Math.max(12, Number(options.doubleTapDistance) || 48);
      this.twoFingerTapDuration = Math.max(150, Number(options.twoFingerTapDuration) || 360);
      this.twoFingerMaxMovement = Math.max(8, Number(options.twoFingerMaxMovement) || 30);
      this.twoFingerHoldDuration = Math.max(400, Number(options.twoFingerHoldDuration) || 750);
      this.twoFingerSwipeDistance = Math.max(32, Number(options.twoFingerSwipeDistance) || 52);
      this.twoFingerSwipeDuration = Math.max(500, Number(options.twoFingerSwipeDuration) || 1800);
      this.twoFingerSwipeAxisRatio = Math.max(1, Number(options.twoFingerSwipeAxisRatio) || 1.15);
      this.preventDefault = options.preventDefault !== false;
      this.now = typeof options.now === 'function' ? options.now : () => Date.now();
      this.setTimer = options.setTimer || setTimeout;
      this.clearTimer = options.clearTimer || clearTimeout;

      this.handlers = {
        gesture: new Set(),
        tap: new Set(),
        doubleTap: new Set(),
        twoFingerTap: new Set(),
        twoFingerHold: new Set(),
        twoFingerSwipe: new Set()
      };

      this.element = null;
      this.activePointers = new Map();
      this.multiTouch = null;
      this.lastTap = null;
      this.listeners = [];
      this.previousTouchAction = null;
      this.mouseDown = false;
    }

    onGesture(handler) { return this.addHandler('gesture', handler); }
    onTap(handler) { return this.addHandler('tap', handler); }
    onDoubleTap(handler) { return this.addHandler('doubleTap', handler); }
    onTwoFingerTap(handler) { return this.addHandler('twoFingerTap', handler); }
    onTwoFingerHold(handler) { return this.addHandler('twoFingerHold', handler); }
    onTwoFingerSwipe(handler) { return this.addHandler('twoFingerSwipe', handler); }
    onTwoFingerDown(handler) { return this.onTwoFingerHold(handler); }

    addHandler(type, handler) {
      if (typeof handler !== 'function') return () => {};
      this.handlers[type].add(handler);
      return () => this.handlers[type].delete(handler);
    }

    emit(type, payload) {
      this.handlers[type].forEach((handler) => {
        try { handler(payload); } catch (error) { setTimeout(() => { throw error; }, 0); }
      });
    }

    initialize(element = document) {
      if (this.element) this.destroy();
      this.element = element;

      const styleTarget = element === document ? document.documentElement : element;
      if (styleTarget && styleTarget.style) {
        this.previousTouchAction = styleTarget.style.touchAction;
        styleTarget.style.touchAction = 'none';
      }

      if (typeof window !== 'undefined' && 'PointerEvent' in window) {
        this.bindPointerEvents(element);
      } else {
        this.bindTouchEvents(element);
        this.bindMouseEvents(element);
      }

      return this;
    }

    bind(element, eventName, handler, options) {
      element.addEventListener(eventName, handler, options);
      this.listeners.push({ element, eventName, handler, options });
    }

    bindPointerEvents(element) {
      this.bind(element, 'pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        this.stopNativeGesture(event);
        try { event.target.setPointerCapture?.(event.pointerId); } catch (_) {}
        this.pointerDown(event.pointerId, event.clientX, event.clientY, event.pointerType || 'pointer');
      }, { passive: false });

      this.bind(element, 'pointermove', (event) => {
        if (!this.activePointers.has(event.pointerId)) return;
        this.stopNativeGesture(event);
        this.pointerMove(event.pointerId, event.clientX, event.clientY);
      }, { passive: false });

      const finish = (event, cancelled) => {
        if (!this.activePointers.has(event.pointerId)) return;
        this.stopNativeGesture(event);
        this.pointerUp(event.pointerId, event.clientX, event.clientY, cancelled);
      };

      this.bind(element, 'pointerup', (event) => finish(event, false), { passive: false });
      this.bind(element, 'pointercancel', (event) => finish(event, true), { passive: false });
    }

    bindTouchEvents(element) {
      this.bind(element, 'touchstart', (event) => {
        this.stopNativeGesture(event);
        Array.from(event.changedTouches).forEach((touch) => {
          this.pointerDown(touch.identifier, touch.clientX, touch.clientY, 'touch');
        });
      }, { passive: false });

      this.bind(element, 'touchmove', (event) => {
        this.stopNativeGesture(event);
        Array.from(event.changedTouches).forEach((touch) => {
          this.pointerMove(touch.identifier, touch.clientX, touch.clientY);
        });
      }, { passive: false });

      this.bind(element, 'touchend', (event) => {
        this.stopNativeGesture(event);
        Array.from(event.changedTouches).forEach((touch) => {
          this.pointerUp(touch.identifier, touch.clientX, touch.clientY, false);
        });
      }, { passive: false });

      this.bind(element, 'touchcancel', (event) => {
        this.stopNativeGesture(event);
        Array.from(event.changedTouches).forEach((touch) => {
          this.pointerUp(touch.identifier, touch.clientX, touch.clientY, true);
        });
      }, { passive: false });
    }

    bindMouseEvents(element) {
      this.bind(element, 'mousedown', (event) => {
        if (event.button !== 0) return;
        this.mouseDown = true;
        this.pointerDown('mouse', event.clientX, event.clientY, 'mouse');
      });

      this.bind(element, 'mousemove', (event) => {
        if (!this.mouseDown) return;
        this.pointerMove('mouse', event.clientX, event.clientY);
      });

      const endMouse = (event, cancelled) => {
        if (!this.mouseDown) return;
        this.mouseDown = false;
        this.pointerUp('mouse', event.clientX, event.clientY, cancelled);
      };

      this.bind(element, 'mouseup', (event) => endMouse(event, false));
      this.bind(element, 'mouseleave', (event) => endMouse(event, true));
    }

    stopNativeGesture(event) {
      if (this.preventDefault && event.cancelable) event.preventDefault();
    }

    pointerDown(id, x, y, pointerType = 'touch') {
      if (this.activePointers.has(id)) return;
      const now = this.now();
      const point = { x, y };
      this.activePointers.set(id, {
        id,
        pointerType,
        startedAt: now,
        start: point,
        current: point,
        suppressSingle: false
      });

      if (this.activePointers.size === 2) {
        this.startMultiTouch(now);
      } else if (this.activePointers.size > 2) {
        this.cancelMultiTouch();
        this.activePointers.forEach((pointer) => { pointer.suppressSingle = true; });
      }
    }

    pointerMove(id, x, y) {
      const pointer = this.activePointers.get(id);
      if (!pointer) return;
      pointer.current = { x, y };

      if (this.multiTouch && this.multiTouch.ids.has(id)) {
        const point = this.multiTouch.points.get(id);
        if (point) point.current = { x, y };
        if (distance(pointer.start, pointer.current) > this.twoFingerMaxMovement) {
          this.multiTouch.moved = true;
          this.cancelHoldTimer();
        }
      }
    }

    pointerUp(id, x, y, cancelled = false) {
      const pointer = this.activePointers.get(id);
      if (!pointer) return;

      pointer.current = { x, y };
      const endedAt = this.now();
      const wasMultiTouch = Boolean(this.multiTouch && this.multiTouch.ids.has(id));
      this.activePointers.delete(id);

      if (wasMultiTouch) {
        this.finishMultiPointer(id, pointer, endedAt, cancelled);
        return;
      }

      if (cancelled || pointer.suppressSingle) return;
      this.finishSinglePointer(pointer, endedAt);
    }

    finishSinglePointer(pointer, endedAt) {
      const deltaX = pointer.current.x - pointer.start.x;
      const deltaY = pointer.current.y - pointer.start.y;
      const travelled = Math.hypot(deltaX, deltaY);
      const duration = endedAt - pointer.startedAt;

      if (travelled >= this.minSwipeDistance) {
        this.lastTap = null;
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        const direction = Math.abs(deltaX) > Math.abs(deltaY)
          ? (deltaX > 0 ? 'right' : 'left')
          : (deltaY > 0 ? 'down' : 'up');

        this.emit('gesture', {
          type: 'swipe',
          direction,
          angle,
          distance: travelled,
          duration,
          deltaX,
          deltaY,
          startX: pointer.start.x,
          startY: pointer.start.y,
          endX: pointer.current.x,
          endY: pointer.current.y,
          pointerType: pointer.pointerType
        });
        return;
      }

      if (travelled > this.maxTapDistance || duration > this.maxTapDuration) {
        this.lastTap = null;
        return;
      }

      const tap = {
        type: 'tap',
        x: pointer.current.x,
        y: pointer.current.y,
        duration,
        pointerType: pointer.pointerType,
        time: endedAt
      };
      this.emit('tap', tap);

      if (
        this.lastTap &&
        endedAt - this.lastTap.time <= this.doubleTapDelay &&
        distance(this.lastTap, tap) <= this.doubleTapDistance
      ) {
        this.emit('doubleTap', { type: 'doubleTap', x: tap.x, y: tap.y, time: endedAt });
        this.lastTap = null;
      } else {
        this.lastTap = tap;
      }
    }

    startMultiTouch(startedAt) {
      this.cancelMultiTouch();
      const pointers = Array.from(this.activePointers.values()).slice(0, 2);
      pointers.forEach((pointer) => { pointer.suppressSingle = true; });
      this.lastTap = null;
      const alreadyMoved = pointers.some((pointer) => (
        distance(pointer.start, pointer.current) > this.twoFingerMaxMovement
      ));

      this.multiTouch = {
        ids: new Set(pointers.map((pointer) => pointer.id)),
        points: new Map(pointers.map((pointer) => [
          pointer.id,
          {
            start: { ...pointer.current },
            current: { ...pointer.current }
          }
        ])),
        startedAt,
        ended: new Set(),
        moved: alreadyMoved,
        swipeEligible: !alreadyMoved,
        cancelled: false,
        holdFired: false,
        holdTimer: null
      };

      if (!alreadyMoved) {
        this.multiTouch.holdTimer = this.setTimer(() => {
          if (!this.multiTouch || this.multiTouch.moved || this.multiTouch.cancelled) return;
          const bothActive = Array.from(this.multiTouch.ids).every((id) => this.activePointers.has(id));
          if (!bothActive) return;
          this.multiTouch.holdFired = true;
          this.emit('twoFingerHold', { type: 'twoFingerHold', duration: this.twoFingerHoldDuration });
        }, this.twoFingerHoldDuration);
      }
    }

    finishMultiPointer(id, pointer, endedAt, cancelled) {
      if (!this.multiTouch) return;
      this.multiTouch.ended.add(id);
      const point = this.multiTouch.points.get(id);
      if (point) point.current = { ...pointer.current };
      if (cancelled) this.multiTouch.cancelled = true;
      if (distance(pointer.start, pointer.current) > this.twoFingerMaxMovement) {
        this.multiTouch.moved = true;
      }

      if (this.multiTouch.ended.size < this.multiTouch.ids.size) return;

      const multi = this.multiTouch;
      this.cancelHoldTimer();
      this.multiTouch = null;
      const duration = endedAt - multi.startedAt;

      const swipe = this.classifyTwoFingerSwipe(multi, duration);
      if (swipe) {
        this.emit('twoFingerSwipe', swipe);
        return;
      }

      if (!multi.cancelled && !multi.moved && !multi.holdFired && duration <= this.twoFingerTapDuration) {
        this.emit('twoFingerTap', { type: 'twoFingerTap', duration });
      }
    }

    classifyTwoFingerSwipe(multi, duration) {
      if (
        multi.cancelled ||
        multi.holdFired ||
        !multi.swipeEligible ||
        duration > this.twoFingerSwipeDuration
      ) return null;

      const movements = Array.from(multi.points.values()).map(({ start, current }) => {
        const deltaX = current.x - start.x;
        const deltaY = current.y - start.y;
        const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
        const primary = horizontal ? Math.abs(deltaX) : Math.abs(deltaY);
        const secondary = horizontal ? Math.abs(deltaY) : Math.abs(deltaX);
        const direction = horizontal
          ? (deltaX > 0 ? 'right' : 'left')
          : (deltaY > 0 ? 'down' : 'up');
        return { deltaX, deltaY, primary, secondary, direction, start, current };
      });

      if (movements.length !== 2) return null;
      if (movements.some(({ primary }) => primary < this.twoFingerSwipeDistance)) return null;
      if (movements.some(({ primary, secondary }) => primary < secondary * this.twoFingerSwipeAxisRatio)) return null;
      if (movements[0].direction !== movements[1].direction) return null;

      return {
        type: 'twoFingerSwipe',
        direction: movements[0].direction,
        duration,
        distance: Math.min(movements[0].primary, movements[1].primary),
        movements
      };
    }

    cancelHoldTimer() {
      if (this.multiTouch && this.multiTouch.holdTimer) {
        this.clearTimer(this.multiTouch.holdTimer);
        this.multiTouch.holdTimer = null;
      }
    }

    cancelMultiTouch() {
      this.cancelHoldTimer();
      this.multiTouch = null;
    }

    reset() {
      this.cancelMultiTouch();
      this.activePointers.clear();
      this.lastTap = null;
      this.mouseDown = false;
    }

    destroy() {
      this.listeners.forEach(({ element, eventName, handler, options }) => {
        element.removeEventListener(eventName, handler, options);
      });
      this.listeners = [];
      this.reset();

      const styleTarget = this.element === document ? document.documentElement : this.element;
      if (styleTarget && styleTarget.style && this.previousTouchAction !== null) {
        styleTarget.style.touchAction = this.previousTouchAction;
      }

      this.element = null;
      this.previousTouchAction = null;
    }
  }

  return GestureDetector;
});
