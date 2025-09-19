/* =========================================================
   SWIPE ENGINE (CLOCK-FACE NUMBER ENTRY) — v1.1
   - 12→0, 1..9→1..9
   - 11 o’clock = SUBMIT NOW (runs inside gesture for iOS)
   - 10 o’clock ignored
   - Auto-submit after inactivity (config.delay)
   - Double tap clears buffer
   - Two-finger down exits to Settings
   - Routing:
       * clipboard (robust fallback)
       * primary Shortcut with text input
       * optional post-submit Shortcut (use for haptic)
   ========================================================= */

const Swipe = (() => {
  let buffer = "";
  let timer  = null;

  // iOS Safari/PWA rarely supports navigator.vibrate. Keep as best-effort.
  const hapticConfirm = () => {
    if (navigator.vibrate) navigator.vibrate(200);
  };

  // Robust clipboard: async API then execCommand fallback.
  const copyText = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  // Angle (atan2 screen coords) → clock degrees (0 at 12, clockwise)
  const toClockDegrees = (angle) => {
    const degNorm  = (angle + 360) % 360;
    const shifted  = (degNorm + 90) % 360;
    const clockDeg = (360 - shifted) % 360;
    return clockDeg;
  };

  // Clock degrees → hour 1..12 (nearest 30°)
  const clockDegToHour = (clockDeg) => {
    return Math.floor(((clockDeg + 15) % 360) / 30) + 1;
  };

  // 12→0, 1..9→digit, 11→SUBMIT, 10→ignored
  const hourToDigitOrAction = (hour) => {
    if (hour === 12) return 0;
    if (hour >= 1 && hour <= 9) return hour;
    if (hour === 11) return 'SUBMIT';
    return null;
  };

  const submit = async (config, hooks) => {
    if (!buffer) return;

    const result = buffer;
    buffer = "";
    clearTimeout(timer);
    timer = null;

    try { hooks?.onSubmit?.(result); } catch {}

    // Primary routing
    try {
      if (config.clipboard) {
        await copyText(result);
      } else if (config.shortcut) {
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(config.shortcut)}&input=text&text=${encodeURIComponent(result)}`;
        window.location.href = url;
      }
    } catch {}

    // Optional follow-up (use for device haptic via Shortcuts)
    try {
      if (config.postShortcut) {
        const postUrl = `shortcuts://run-shortcut?name=${encodeURIComponent(config.postShortcut)}`;
        setTimeout(() => { window.location.href = postUrl; }, 150);
      }
    } catch {}

    hapticConfirm(); // best-effort fallback
  };

  const armTimer = (config, hooks) => {
    clearTimeout(timer);
    timer = setTimeout(() => submit(config, hooks), Math.max(1, config.delay || 3) * 1000);
  };

  const api = {
    start(config, hooks = {}) {
      buffer = "";
      clearTimeout(timer);
      timer = null;

      // One-finger swipe → digit/action
      Gestures.onSwipe((angle) => {
        const hour       = clockDegToHour(toClockDegrees(angle));
        const digitOrAct = hourToDigitOrAction(hour);
        if (digitOrAct === null) return;

        if (digitOrAct === 'SUBMIT') {
          // Runs inside touchend → counts as a user gesture on iOS
          submit(config, hooks);
          return;
        }

        buffer += String(digitOrAct);
        armTimer(config, hooks);
      });

      // Double tap → clear buffer
      Gestures.onDoubleTap(() => {
        buffer = "";
        clearTimeout(timer);
        timer = null;
        try { hooks?.onClear?.(); } catch {}
      });

      // Two-finger down → exit
      Gestures.onTwoFingerDown(() => {
        buffer = "";
        clearTimeout(timer);
        timer = null;
        window.location.href = "settings.html";
      });
    }
  };

  return api;
})();
