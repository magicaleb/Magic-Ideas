/* =========================================================
   GESTURE CAPTURE (TOUCH-ONLY)
   - Directional one-finger swipes → angle callback
   - Double-tap → clear buffer
   - Two-finger swipe down → exit to settings
   Design notes:
   * No pointer events used here to keep code lean.
   * All listeners are attached to <body>.
   * Angle is computed independent of start position.
   * Swipe magnitude threshold avoids micro-movements.
   ========================================================= */

const Gestures = (() => {
  // ----- CONFIGURABLE THRESHOLDS -----
  const MIN_SWIPE_PX = 30;     // ignore moves shorter than this (tune if needed)
  const DOUBLE_TAP_MS = 300;   // max gap for double tap detection
  const TWO_DOWN_MS   = 150;   // two touches must start within this window

  // ----- INTERNAL STATE -----
  let startX = null, startY = null; // one-finger swipe start
  let lastTapTime = 0;              // for double-tap
  let firstTwoDownTime = 0;         // for two-finger detection

  // Utility: squared distance (avoid sqrt for speed)
  const dist2 = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    return dx*dx + dy*dy;
  };

  // Public API
  const api = {
    // onSwipe: callback(angleInDegrees)
    // Angle definition:
    //   - Based on movement vector from touchstart to touchend.
    //   - We'll deliver *screen* angle (atan2(dy, dx)) in degrees, [-180, 180).
    //     Swipe engine will do clock-face mapping.
    onSwipe(cb) {
      document.body.addEventListener('touchstart', (e) => {
        // One-finger swipe start only
        if (e.touches.length === 1) {
          const t = e.touches[0];
          startX = t.clientX;
          startY = t.clientY;
        }
      }, { passive: true });

      document.body.addEventListener('touchend', (e) => {
        // If we never recorded a start, ignore
        if (startX === null || startY === null) return;

        const t = e.changedTouches[0];
        const endX = t.clientX;
        const endY = t.clientY;

        // Ignore tiny moves
        if (dist2(startX, startY, endX, endY) < (MIN_SWIPE_PX * MIN_SWIPE_PX)) {
          startX = startY = null;
          return;
        }

        // Compute angle in degrees using screen coords
        // atan2(dy, dx): 0deg = right, 90deg = down (screen coords), -90deg = up
        const dy = endY - startY;
        const dx = endX - startX;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        cb(angle);
        startX = startY = null;
      }, { passive: true });
    },

    // onDoubleTap: callback()
    onDoubleTap(cb) {
      document.body.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTapTime <= DOUBLE_TAP_MS) cb();
        lastTapTime = now;
      }, { passive: true });
    },

    // onTwoFingerDown: callback()
    // Trigger when two touches start within TWO_DOWN_MS.
    // The Swipe engine decides what to do (usually exit).
    onTwoFingerDown(cb) {
      document.body.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          // first finger down, record time
          firstTwoDownTime = Date.now();
        } else if (e.touches.length === 2) {
          // second finger joined: check timing window
          const now = Date.now();
          if (now - firstTwoDownTime <= TWO_DOWN_MS) cb();
        }
      }, { passive: true });
    }
  };

  return api;
})();
