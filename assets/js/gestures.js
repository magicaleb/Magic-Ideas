/* Compatibility facade over GestureDetector. New code should use create(). */
const Gestures = (() => {
  'use strict';

  let defaultInstance = null;
  let defaultTarget = null;

  function create(target = document, options = {}) {
    if (typeof GestureDetector !== 'function') {
      throw new Error('GestureDetector must be loaded before gestures.js');
    }

    const detector = new GestureDetector(options);
    detector.initialize(target);

    return {
      onSwipe(callback) {
        return detector.onGesture((gesture) => callback(gesture.angle, gesture));
      },
      onTap(callback) { return detector.onTap(callback); },
      onDoubleTap(callback) { return detector.onDoubleTap(callback); },
      onTwoFingerTap(callback) { return detector.onTwoFingerTap(callback); },
      onTwoFingerHold(callback) { return detector.onTwoFingerHold(callback); },
      onTwoFingerSwipe(callback) { return detector.onTwoFingerSwipe(callback); },
      // Kept as an alias for old callers. It is intentionally a hold now so
      // the exit gesture cannot collide with a quick two-finger submit.
      onTwoFingerDown(callback) { return detector.onTwoFingerHold(callback); },
      reset() { detector.reset(); },
      destroy() { detector.destroy(); },
      detector
    };
  }

  function init(target = document, options = {}) {
    if (defaultInstance && defaultTarget !== target) {
      defaultInstance.destroy();
      defaultInstance = null;
    }
    if (!defaultInstance) {
      defaultTarget = target;
      defaultInstance = create(target, options);
    }
    return defaultInstance;
  }

  return {
    create,
    init,
    onSwipe(callback, target) { return init(target || document).onSwipe(callback); },
    onTap(callback, target) { return init(target || document).onTap(callback); },
    onDoubleTap(callback, target) { return init(target || document).onDoubleTap(callback); },
    onTwoFingerTap(callback, target) { return init(target || document).onTwoFingerTap(callback); },
    onTwoFingerHold(callback, target) { return init(target || document).onTwoFingerHold(callback); },
    onTwoFingerSwipe(callback, target) { return init(target || document).onTwoFingerSwipe(callback); },
    onTwoFingerDown(callback, target) { return init(target || document).onTwoFingerHold(callback); },
    destroy() {
      if (defaultInstance) defaultInstance.destroy();
      defaultInstance = null;
      defaultTarget = null;
    }
  };
})();
