/* =========================================================
   GESTURE CAPTURE (TOUCH-ONLY)
   - Directional one-finger swipes → angle callback
   - Double-tap → clear buffer
   - Two-finger swipe down → exit to settings
   ---------------------------------------------------------
   Notes:
   * Pure touch events (no pointer events) to keep lean.
   * All listeners attach to <body>.
   * Angles are based on swipe vector, independent of start.
   * Swipes must pass a magnitude threshold to count.
   * Double-tap and two-finger start windows are configurable.
   ========================================================= */

const Gestures = (() => {
  // ----- CONFIGURABLE THRESHOLDS -----
  const MIN_SWIPE_PX = 30;     // ignore swipes shorter than this
  const DOUBLE_TAP_MS = 300;   // max gap for double-tap detection
  const TWO_DOWN_MS   = 150;   // two touches must begin within this window

  // ----- INTERNAL STATE -----
  let startX = null, startY = null; // one-finger swipe start coords
  let lastTapTime = 0;              // last touchend for double-tap
  let firstTwoDownTime = 0;         // for two-finger detection

  // Utility: squared distance (faster than sqrt)
  const dist2 = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    return dx*dx + dy*dy;
  };

  // Normalize angle into [-180, 180)
  const normalizeAngle = deg => {
    let a = deg % 360;
    if (a >= 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  };

  // ----- PUBLIC API -----
  const api = {
    /**
     * onSwipe(callback(angleInDegrees))
     * Angle definition:
     *  - Movement vector: touchstart → touchend.
     *  - Screen coords: 0° = right, 90° = down, -90° = up.
     *  - Normalized to [-180, 180).
     */
    onSwipe(cb) {
      document.body.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          startX = t.clientX;
          startY = t.clientY;
        }
      }, { passive: true });

      document.body.addEventListener('touchend', (e) => {
        if (startX === null || startY === null) return;

        const t = e.changedTouches[0];
        const endX = t.clientX;
        const endY = t.clientY;

        // ignore micro movements
        if (dist2(startX, startY, endX, endY) < (MIN_SWIPE_PX * MIN_SWIPE_PX)) {
          startX = startY = null;
          return;
        }

        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        cb(normalizeAngle(angle));
        startX = startY = null; // reset
      }, { passive: true });
    },

    /**
     * onDoubleTap(callback)
     * Fires when two taps occur within DOUBLE_TAP_MS.
     */
    onDoubleTap(cb) {
      document.body.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTapTime <= DOUBLE_TAP_MS) {
          cb();
          lastTapTime = 0; // reset so triple-tap won't fire twice
        } else {
          lastTapTime = now;
        }
      }, { passive: true });
    },

    /**
     * onTwoFingerDown(callback)
     * Fires when a second finger touches within TWO_DOWN_MS of the first.
     */
    onTwoFingerDown(cb) {
      document.body.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          firstTwoDownTime = Date.now();
        } else if (e.touches.length === 2) {
          const now = Date.now();
          if (now - firstTwoDownTime <= TWO_DOWN_MS) {
            cb();
            firstTwoDownTime = 0; // reset
          }
        }
      }, { passive: true });
    }
  };

  return api;
})();