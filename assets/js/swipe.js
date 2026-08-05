/* Shared Swipe Input engine used by both performance surfaces. */
const Swipe = (() => {
  'use strict';

  const CONFIG_VERSION = 3;
  const CLIPBOARD_DEFAULT_VERSION = 2;
  const DEFAULTS = Object.freeze({
    version: CONFIG_VERSION,
    delay: 3,
    shortcut: '',
    postShortcut: '',
    clipboard: true,
    fakeHomescreen: false,
    practiceMode: false,
    hasHomescreenImage: false,
    homescreenImage: '',
    inputMode: 'twoswipe',
    useTwoSwipe: true
  });

  function normalizeConfig(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const oldVersion = Number(source.version) || 0;
    const inputMode = source.inputMode === 'clockface' || source.inputMode === 'twoswipe'
      ? source.inputMode
      : (source.useTwoSwipe === false ? 'clockface' : 'twoswipe');

    return {
      version: CONFIG_VERSION,
      delay: Math.min(60, Math.max(1, Number(source.delay) || DEFAULTS.delay)),
      shortcut: String(source.shortcut || '').trim(),
      postShortcut: String(source.postShortcut || '').trim(),
      // Clipboard is promoted to an on-by-default core behavior in v2. A user
      // can still explicitly turn it off after the one-time migration.
      clipboard: oldVersion >= CLIPBOARD_DEFAULT_VERSION ? source.clipboard !== false : true,
      fakeHomescreen: Boolean(source.fakeHomescreen),
      practiceMode: Boolean(source.practiceMode),
      hasHomescreenImage: Boolean(source.hasHomescreenImage || source.homescreenImage),
      homescreenImage: typeof source.homescreenImage === 'string' ? source.homescreenImage : '',
      inputMode,
      useTwoSwipe: inputMode === 'twoswipe'
    };
  }

  function mergeConfig(argument = {}) {
    let saved = {};
    try {
      if (typeof Storage !== 'undefined' && Storage.load) {
        saved = Storage.load('swipe', {}) || {};
      }
    } catch (_) {}
    return normalizeConfig({ ...saved, ...argument });
  }

  function legacyCopy(text) {
    if (typeof document === 'undefined' || !document.body) return false;
    let input = null;
    try {
      input = document.createElement('textarea');
      input.value = text;
      input.readOnly = true;
      input.setAttribute('aria-hidden', 'true');
      input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px;';
      document.body.appendChild(input);
      input.focus({ preventScroll: true });
      input.select();
      input.setSelectionRange(0, input.value.length);
      return Boolean(document.execCommand && document.execCommand('copy'));
    } catch (_) {
      return false;
    } finally {
      if (input && input.parentNode) input.parentNode.removeChild(input);
    }
  }

  function copyText(text) {
    let modernCopy = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        // Calling writeText while still inside touchend preserves the browser's
        // transient user activation, even though the promise settles later.
        modernCopy = navigator.clipboard.writeText(text);
      }
    } catch (_) {}

    // Also attempt the synchronous fallback before the gesture event returns.
    const legacySucceeded = legacyCopy(text);

    if (modernCopy && typeof modernCopy.then === 'function') {
      return modernCopy.then(() => true).catch(() => legacySucceeded);
    }
    return Promise.resolve(legacySucceeded);
  }

  function start(configArgument = {}, hooks = {}) {
    if (typeof ClockInput === 'undefined') {
      throw new Error('clockInput.js must be loaded before swipe.js');
    }
    if (typeof Gestures === 'undefined') {
      throw new Error('gestureDetector.js and gestures.js must be loaded before swipe.js');
    }

    const config = mergeConfig(configArgument);
    const surface = hooks.element || document.getElementById('performRoot') || document.body;
    const gestureInput = Gestures.create(surface, {
      minSwipeDistance: 32,
      maxTapDistance: 14,
      twoFingerHoldDuration: 750,
      twoFingerSwipeDistance: 52,
      preventDefault: true
    });

    let buffer = '';
    let submitTimer = null;
    let destroyed = false;
    let clipboardRequest = 0;
    let clipboardValue = '';
    let clipboardWarningShown = false;

    const call = (handler, ...args) => {
      try { if (typeof handler === 'function') handler(...args); } catch (_) {}
    };

    const twoSwipeInput = new ClockInput.TwoSwipeInput({
      timeoutMs: 3000,
      onTimeout() {
        call(hooks.onSequence, { stage: 'first', reason: 'timeout' }, buffer);
        paint();
        if (buffer) submit('sequenceTimeout');
        else call(hooks.onStatus, 'Two-swipe input reset');
      }
    });

    function paint() {
      call(hooks.onDigit, null, buffer);
    }

    function clearSubmitTimer() {
      if (submitTimer !== null) {
        clearTimeout(submitTimer);
        submitTimer = null;
      }
    }

    function armSubmitTimer() {
      clearSubmitTimer();
      submitTimer = setTimeout(() => submit('timer'), config.delay * 1000);
    }

    function keepClipboardCurrent(value) {
      if (!config.clipboard || !value) return Promise.resolve(false);
      const request = ++clipboardRequest;

      return copyText(value).then((succeeded) => {
        if (destroyed || request !== clipboardRequest) return succeeded;
        if (succeeded) {
          clipboardValue = value;
          clipboardWarningShown = false;
        } else if (!clipboardWarningShown) {
          clipboardWarningShown = true;
          call(hooks.onStatus, 'Clipboard blocked — allow clipboard access and use HTTPS');
        }
        call(hooks.onClipboard, value, succeeded);
        return succeeded;
      });
    }

    function appendDigit(digit) {
      buffer += String(digit);
      call(hooks.onDigit, digit, buffer);
      keepClipboardCurrent(buffer);
      armSubmitTimer();
    }

    function processSwipe(angle, gesture) {
      if (destroyed) return;

      if (config.inputMode === 'twoswipe') {
        const result = twoSwipeInput.process(gesture || angle);
        call(hooks.onSequence, result, buffer);

        if (!result.complete) {
          // Once the performer starts another digit, pause auto-submit until
          // that pair completes or its three-second sequence timeout expires.
          clearSubmitTimer();
          if (result.restarted) call(hooks.onStatus, 'New first swipe registered');
          return;
        }

        appendDigit(result.digit);
        return;
      }

      const position = gesture
        ? ClockInput.vectorToClockPosition(gesture.deltaX, gesture.deltaY)
        : ClockInput.screenAngleToClockPosition(angle);
      const digit = ClockInput.clockPositionToDigit(position);
      if (digit !== null) appendDigit(digit);
    }

    function submit(reason = 'manual') {
      if (destroyed || !buffer) return false;

      const value = buffer;
      buffer = '';
      clearSubmitTimer();
      twoSwipeInput.reset();
      paint();

      if (config.clipboard && clipboardValue !== value) {
        keepClipboardCurrent(value);
      }

      let route = config.clipboard ? 'clipboard' : 'none';
      if (config.shortcut) {
        route = 'shortcut';
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(config.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
        try { window.location.assign(url); } catch (_) {}
      }
      if (config.postShortcut) {
        setTimeout(() => {
          try {
            window.location.assign(`shortcuts://run-shortcut?name=${encodeURIComponent(config.postShortcut)}`);
          } catch (_) {}
        }, 150);
      }

      call(hooks.onSubmit, value, route, reason);
      return true;
    }

    function clear(reason = 'manual') {
      if (destroyed) return;
      buffer = '';
      clearSubmitTimer();
      twoSwipeInput.reset();
      call(hooks.onClear, reason);
      paint();
    }

    function exitPerformance(reason) {
      if (destroyed) return;
      clear(reason);
      if (typeof hooks.onExit === 'function') {
        call(hooks.onExit, reason);
      } else {
        try { window.location.assign('settings.html'); } catch (_) {}
      }
    }

    gestureInput.onSwipe(processSwipe);
    gestureInput.onDoubleTap(() => clear('doubleTap'));
    gestureInput.onTwoFingerTap(() => submit('twoFingerTap'));
    gestureInput.onTwoFingerSwipe((gesture) => {
      if (gesture.direction === 'down') exitPerformance('twoFingerSwipeDown');
    });
    gestureInput.onTwoFingerHold(() => exitPerformance('twoFingerHold'));

    paint();

    return {
      config,
      submitNow: () => submit('api'),
      clear: () => clear('api'),
      getBuffer: () => buffer,
      getSequenceState: () => twoSwipeInput.getState(),
      destroy() {
        if (destroyed) return;
        clearSubmitTimer();
        twoSwipeInput.destroy();
        gestureInput.destroy();
        destroyed = true;
      }
    };
  }

  return Object.freeze({ CONFIG_VERSION, DEFAULTS, normalizeConfig, copyText, start });
})();

if (typeof module === 'object' && module.exports) {
  module.exports = Swipe;
}
