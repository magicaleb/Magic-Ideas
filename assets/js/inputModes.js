/* Input modes built on the shared ClockInput math. */
class ClockFaceMode {
  constructor() {
    this.name = 'clockface';
    this.displayName = 'Direct Clock Face (12 positions)';
    this.completionHandler = null;
  }

  processGesture(gesture) {
    const position = ClockInput.vectorToClockPosition(gesture.deltaX, gesture.deltaY);
    const result = {
      complete: position !== null,
      position,
      digit: ClockInput.clockPositionToDigit(position),
      stage: 'first'
    };

    if (result.complete && this.completionHandler) {
      this.completionHandler(position, result);
    }
    return result;
  }

  getState() {
    return { stage: 'first', message: 'Swipe toward a clock position — 12 is straight up' };
  }

  reset() {}
  destroy() {}
  onCompletion(callback) { this.completionHandler = callback; }
}

class TwoSwipeMode {
  constructor() {
    this.name = 'twoswipe';
    this.displayName = 'Two-Swipe Clock (digits 0–9)';
    this.completionHandler = null;
    this.stateChangeHandler = null;
    this.lastEvent = null;
    this.input = new ClockInput.TwoSwipeInput({
      timeoutMs: 3000,
      onTimeout: () => {
        this.lastEvent = { stage: 'first', reason: 'timeout' };
        if (this.stateChangeHandler) this.stateChangeHandler(this.getState());
      }
    });
  }

  processGesture(gesture) {
    const result = this.input.process(gesture);
    this.lastEvent = result;
    if (this.stateChangeHandler) this.stateChangeHandler(this.getState());

    if (result.complete && this.completionHandler) {
      this.completionHandler(result.position, result);
    }
    return result;
  }

  getState() {
    const state = this.input.getState();
    if (state.stage === 'first') {
      return {
        ...state,
        message: 'First swipe: choose 0, 3, 6, or 9 (↑ → ↓ ←)'
      };
    }

    return {
      ...state,
      message: `Anchor ${state.anchorDigit}: repeat it or swipe toward a neighboring digit`
    };
  }

  reset() {
    this.input.reset();
    this.lastEvent = null;
  }

  destroy() { this.input.destroy(); }
  onCompletion(callback) { this.completionHandler = callback; }
  onStateChange(callback) { this.stateChangeHandler = callback; }
}

class InputModeManager {
  constructor() {
    this.modes = {
      clockface: new ClockFaceMode(),
      twoswipe: new TwoSwipeMode()
    };
    this.currentMode = null;
    this.completionHandler = null;
    this.stateChangeHandler = null;
    this.gestureDetector = new GestureDetector();
    this.gestureDetector.onGesture((gesture) => {
      if (this.currentMode) this.currentMode.processGesture(gesture);
    });
    this.setMode('twoswipe', false);
  }

  initialize(element = document) {
    this.gestureDetector.initialize(element);
    return this;
  }

  destroy() {
    this.gestureDetector.destroy();
    Object.values(this.modes).forEach((mode) => mode.destroy());
  }

  setMode(modeName, saveToStorage = true) {
    if (!this.modes[modeName]) return false;
    if (this.currentMode) this.currentMode.reset();
    this.currentMode = this.modes[modeName];
    if (this.completionHandler) this.currentMode.onCompletion(this.completionHandler);
    if (this.stateChangeHandler) {
      this.currentMode.onStateChange?.(this.stateChangeHandler);
      this.stateChangeHandler(this.currentMode.getState());
    }

    if (saveToStorage) {
      try { localStorage.setItem('inputMode', modeName); } catch (_) {}
    }
    return true;
  }

  getCurrentMode() { return this.currentMode; }

  getAvailableModes() {
    return Object.keys(this.modes).map((name) => ({ name, displayName: this.modes[name].displayName }));
  }

  getState() { return this.currentMode ? this.currentMode.getState() : null; }

  onCompletion(callback) {
    this.completionHandler = callback;
    Object.values(this.modes).forEach((mode) => mode.onCompletion(callback));
  }

  onStateChange(callback) {
    this.stateChangeHandler = callback;
    Object.values(this.modes).forEach((mode) => mode.onStateChange?.(callback));
  }

  loadSavedMode() {
    let savedMode = null;
    try { savedMode = localStorage.getItem('inputMode'); } catch (_) {}
    this.setMode(this.modes[savedMode] ? savedMode : 'twoswipe', false);
  }
}

if (typeof module === 'object' && module.exports) {
  module.exports = { ClockFaceMode, TwoSwipeMode, InputModeManager };
}
