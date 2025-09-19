/* =========================================================
   GESTURE CAPTURE (TOUCH-ONLY)
   - One-finger swipes → angle callback
   - Double-tap → clear
   - Two-finger down → exit
   - Includes angleToClockHour() for 12-sector mapping
   ========================================================= */

const Gestures = (() => {
  // ----- Tuning -----
  const MIN_SWIPE_PX = 30;
  const DOUBLE_TAP_MS = 300;
  const TWO_DOWN_MS   = 150;

  // ----- State -----
  let startX = null, startY = null;
  let lastTapTime = 0;
  let firstTwoDownTime = 0;

  const dist2 = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    return dx*dx + dy*dy;
  };

  // Normalize to [-180, 180)
  const normDeg = d => {
    let a = d % 360;
    if (a >= 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  };

  // Screen angle (0=right, 90=down, -90=up) -> clock hour (12 at up, CW)
  function angleToClockHour(screenDeg){
    // shift so 0° = up, increase clockwise
    const shifted = ( (screenDeg + 90) % 360 + 360 ) % 360; // [0,360)
    return Math.floor( (shifted + 15) / 30 ) + 1;           // 1..12
  }

  const api = {
    onSwipe(cb){
      document.body.addEventListener('touchstart', e => {
        if (e.touches.length === 1){
          const t = e.touches[0];
          startX = t.clientX; startY = t.clientY;
        }
      }, { passive: true });

      document.body.addEventListener('touchend', e => {
        if (startX == null || startY == null) return;
        const t = e.changedTouches[0];
        const endX = t.clientX, endY = t.clientY;

        if (dist2(startX,startY,endX,endY) < MIN_SWIPE_PX*MIN_SWIPE_PX){
          startX = startY = null; return;
        }

        const dx = endX - startX, dy = endY - startY;
        const deg = normDeg(Math.atan2(dy, dx) * 180 / Math.PI);
        cb(deg);
        startX = startY = null;
      }, { passive: true });
    },

    onDoubleTap(cb){
      document.body.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTapTime <= DOUBLE_TAP_MS){ cb(); lastTapTime = 0; }
        else lastTapTime = now;
      }, { passive: true });
    },

    onTwoFingerDown(cb){
      document.body.addEventListener('touchstart', e => {
        if (e.touches.length === 1){
          firstTwoDownTime = Date.now();
        } else if (e.touches.length === 2){
          if (Date.now() - firstTwoDownTime <= TWO_DOWN_MS){ cb(); firstTwoDownTime = 0; }
        }
      }, { passive: true });
    },

    angleToClockHour, // ← expose for swipe.js
  };

  return api;
})();
