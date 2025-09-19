/* =========================================================
   SWIPE ENGINE (CLOCK-FACE NUMBER ENTRY)
   Responsibilities:
   - Convert swipe direction to clock-hour (12 sectors).
   - Map hours to digits: 1–9 → 1..9, 12 → 0, 10/11 → ignored (MVP).
   - Build a hidden multi-digit buffer.
   - Auto-submit after inactivity timeout (config.delay).
   - Double tap clears buffer (submits nothing).
   - Two-finger down exits to Settings.
   - Provide optional hooks: onSubmit(value), onClear().
   Notes:
   - All interaction is invisible. No text is rendered.
   - Haptic confirmation after submission (vibrate fallback).
   ========================================================= */

const Swipe = (() => {
  // ----- INTERNAL STATE -----
  let buffer = "";     // accumulated digits as a string
  let timer  = null;   // inactivity timer

  // Attempt haptic: 200ms vibrate. iOS/Watch haptics may vary.
  const hapticConfirm = () => {
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  // Convert generic screen angle to "clock degrees":
  // - Incoming angle: atan2(dy, dx) in degrees, where
  //     0   = right, +90 = down, -90 = up, +180/-180 = left
  // - We want: 0 at 12 o'clock (up), increasing CLOCKWISE.
  //   Transform steps:
  //     degNorm = (angle + 360) % 360
  //     shifted = (degNorm + 90) % 360  // move 0° to up
  //     clockDeg = (360 - shifted) % 360 // flip to clockwise
  const toClockDegrees = (angle) => {
    const degNorm  = (angle + 360) % 360;
    const shifted  = (degNorm + 90) % 360;
    const clockDeg = (360 - shifted) % 360;
    return clockDeg; // 0 at 12 o'clock, grows clockwise
  };

  // Map clock degrees (0..360) to hour 1..12
  // - Divide circle into 12 x 30° sectors.
  // - Add 15° half-sector for nearest-hour rounding.
  const clockDegToHour = (clockDeg) => {
    const hour = Math.floor(((clockDeg + 15) % 360) / 30) + 1; // 1..12
    return hour;
  };

  // Map hour to digit. 12 → 0. 1..9 → 1..9. 10/11 → ignore in MVP.
  const hourToDigit = (hour) => {
    if (hour === 12) return 0;
    if (hour >= 1 && hour <= 9) return hour;
    return null; // 10 or 11 → unused for now
  };

  // Submit buffer:
  // - Do nothing if empty.
  // - Provide haptic.
  // - Route per config (clipboard or Shortcut).
  // - Clear buffer.
  const submit = async (config, hooks) => {
    if (!buffer) return;

    const result = buffer;
    buffer = "";                 // clear internal state first to avoid repeats
    clearTimeout(timer);         // cancel any pending timer
    timer = null;

    hapticConfirm();             // tactile confirmation

    // Hook for instrumentation or alternative routing
    if (hooks && typeof hooks.onSubmit === 'function') {
      try { hooks.onSubmit(result); } catch {}
    }

    // Primary routing: clipboard OR Shortcut
    try {
      if (config.clipboard) {
        // Clipboard mode: silent and fast
        await navigator.clipboard.writeText(result);
      } else if (config.shortcut) {
        // Direct Shortcut launch with text input = result
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(config.shortcut)}&input=text&text=${encodeURIComponent(result)}`;
        // Use location.href for reliability in A2HS contexts
        window.location.href = url;
      }
    } catch {
      // Swallow errors to keep surface silent
    }
  };

  // Reset/extend inactivity timer after each digit
  const armTimer = (config, hooks) => {
    clearTimeout(timer);
    timer = setTimeout(() => submit(config, hooks), Math.max(1, config.delay || 3) * 1000);
  };

  // Public API
  const api = {
    // Start the engine with a config object:
    // { delay:number, shortcut:string, clipboard:boolean }
    // And optional hooks: { onSubmit(value), onClear() }
    start(config, hooks = {}) {
      buffer = "";
      clearTimeout(timer);
      timer = null;

      // 1) One-finger swipe → digit
      Gestures.onSwipe((angle) => {
        const clockDeg = toClockDegrees(angle);    // normalize to clock frame
        const hour     = clockDegToHour(clockDeg); // 1..12
        const digit    = hourToDigit(hour);        // null, 0..9

        if (digit === null) {
          // 10 or 11 o’clock → ignored by design in MVP
          return;
        }

        // Append digit and re-arm auto-submit
        buffer += String(digit);
        armTimer(config, hooks);
      });

      // 2) Double tap → clear buffer (send nothing)
      Gestures.onDoubleTap(() => {
        buffer = "";
        clearTimeout(timer);
        timer = null;
        if (hooks && typeof hooks.onClear === 'function') {
          try { hooks.onClear(); } catch {}
        }
      });

      // 3) Two-finger down → exit to Settings immediately
      Gestures.onTwoFingerDown(() => {
        buffer = "";
        clearTimeout(timer);
        timer = null;
        // Navigate back to the trick's Settings screen
        window.location.href = "settings.html";
      });
    }
  };

  return api;
})();
