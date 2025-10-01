# ==========================================================
# MAGIC PAD — ONE-SHOT PROJECT INITIALIZER (Codespaces)
# Creates folders and writes all files with full commented code
# ==========================================================

set -e

mkdir -p tricks/swipe assets/css assets/js

# ---------- assets/css/base.css ----------
cat > assets/css/base.css <<'EOF'
/* =========================================================
   BASE MOBILE-ONLY STYLES
   - Lock the app to a black, chrome-free surface.
   - Disable scrolling, pull-to-refresh, and selection.
   - Keep typography simple and readable.
   ========================================================= */

html, body {
  margin: 0;                 /* remove default browser margins */
  padding: 0;                /* remove default browser padding */
  height: 100%;              /* allow full-viewport layouts */
  background: #000;          /* pure black for stealth Perform screen */
  color: #fff;               /* high contrast text for Settings pages */
  font-family: -apple-system, system-ui, sans-serif; /* iOS-friendly font stack */

  /* Prevent accidental interactions that reveal UI */
  -webkit-user-select: none; /* no text selection on iOS Safari */
  user-select: none;
  touch-action: none;        /* disable default touch handling (scroll/zoom) */
  overscroll-behavior: none; /* prevent pull-to-refresh bounce */
}

/* Simple, thumb-friendly controls on Settings pages */
button, input {
  font-size: 1.2em;          /* larger tap targets */
  padding: 12px;
  margin: 10px 0;
  width: 100%;               /* full-width controls for easy tapping */
  box-sizing: border-box;
}

/* Spacing for headings on Settings pages */
h1, h2 {
  margin: 16px 0 8px 0;
}

/* Content container for Settings screens */
.container {
  padding: 16px;
  max-width: 560px;          /* keeps lines readable on larger phones */
  margin: 0 auto;
}
EOF

# ---------- index.html ----------
cat > index.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
  <!-- Viewport: mobile-first, respect iOS sensor housing (viewport-fit) -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Magic Pad</title>
  <link rel="stylesheet" href="assets/css/base.css">
</head>
<body>
  <!-- SETTINGS-LIKE HOMEPAGE
       - Minimal list of tricks.
       - Expand later with more tricks.
  -->
  <div class="container">
    <h1>Magic Pad</h1>

    <!-- Single trick entry point for now -->
    <a href="tricks/swipe/settings.html">
      <button>Swipe Input</button>
    </a>
  </div>
</body>
</html>
EOF

# ---------- tricks/swipe/settings.html ----------
cat > tricks/swipe/settings.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
  <!-- Mobile viewport; this page is visible and can show text -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Swipe Input — Settings</title>
  <link rel="stylesheet" href="../../assets/css/base.css">
</head>
<body>
  <!-- SETTINGS UI
       - Configure auto-submit delay
       - Choose routing (clipboard vs Shortcut)
       - Provide Shortcut name (for direct handoff)
  -->
  <div class="container">
    <h2>Swipe Input — Settings</h2>

    <!-- Auto-submit delay control:
         After the last digit swipe, wait this many seconds, then submit. -->
    <label for="delay">Auto-submit delay (seconds)</label>
    <input id="delay" type="number" min="1" max="15" step="1" inputmode="numeric">

    <!-- Optional direct Shortcut name:
         If present and clipboard mode is OFF, submission calls this Shortcut
         with the number as text input. -->
    <label for="shortcut">Shortcut name (optional)</label>
    <input id="shortcut" type="text" placeholder="e.g., CityList">

    <!-- Clipboard toggle:
         If ON, submission copies the result to clipboard instead of running a Shortcut. -->
    <label>
      <input id="clipboard" type="checkbox">
      Copy result to clipboard
    </label>

    <!-- Begin performance mode (black screen, no chrome) -->
    <a href="perform.html"><button>Perform</button></a>
  </div>

  <!-- Local storage helper -->
  <script src="../../assets/js/storage.js"></script>
  <script>
    // ----- LOAD EXISTING SETTINGS OR FALL BACK TO DEFAULTS -----
    const defaults = { delay: 3, shortcut: '', clipboard: false };
    const config   = Storage.load('swipe', defaults);

    // ----- WIRE UP DOM ELEMENTS -----
    const delayEl     = document.getElementById('delay');
    const shortcutEl  = document.getElementById('shortcut');
    const clipboardEl = document.getElementById('clipboard');

    // ----- HYDRATE UI FROM STORAGE -----
    delayEl.value         = config.delay;
    shortcutEl.value      = config.shortcut;
    clipboardEl.checked   = config.clipboard;

    // ----- SAVE ON CHANGE (SMALL + RELIABLE) -----
    const save = () => {
      Storage.save('swipe', {
        delay: Math.max(1, +delayEl.value || defaults.delay), // guard bad input
        shortcut: (shortcutEl.value || '').trim(),
        clipboard: !!clipboardEl.checked
      });
    };
    delayEl.addEventListener('change', save);
    shortcutEl.addEventListener('change', save);
    clipboardEl.addEventListener('change', save);
  </script>
</body>
</html>
EOF

# ---------- tricks/swipe/perform.html ----------
cat > tricks/swipe/perform.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
  <!-- Perform screen: black, chrome-free, gesture-only -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Swipe Input — Perform</title>
  <link rel="stylesheet" href="../../assets/css/base.css">
  <style>
    /* Ensure total black surface and absorb all touches */
    body { background:#000; height:100vh; width:100vw; }
  </style>
</head>
<body>
  <!-- NO VISIBLE UI ON PURPOSE.
       - Entire screen is the "pad".
       - Gestures.js listens to touch events on <body>.
  -->

  <!-- Utilities and engines -->
  <script src="../../assets/js/storage.js"></script>
  <script src="../../assets/js/gestures.js"></script>
  <script src="../../assets/js/swipe.js"></script>

  <script>
    // Load per-trick config. Provide hard defaults in case storage is empty.
    const config = Storage.load('swipe', { delay: 3, shortcut: '', clipboard: false });

    // Start the Swipe engine with the config:
    // - Direction-only digit mapping (clock face)
    // - Multi-digit buffer with inactivity auto-submit
    // - Double-tap to clear buffer
    // - Two-finger swipe down to exit to Settings
    Swipe.start(config, {
      // Optional hooks you may extend later:
      onSubmit: (value) => { /* reserved for logging or handoff variants */ },
      onClear:  () => { /* reserved for custom feedback */ }
    });
  </script>
</body>
</html>
EOF

# ---------- assets/js/storage.js ----------
cat > assets/js/storage.js <<'EOF'
/* =========================================================
   STORAGE HELPER
   - Tiny wrapper around localStorage with JSON parsing.
   - Namespaces keys with "mpad." to avoid collisions.
   ========================================================= */

const Storage = {
  // Load JSON under "mpad.<key>". If not present or invalid, return defaults.
  load: (key, defaults) => {
    try {
      const raw = localStorage.getItem('mpad.' + key);
      return raw ? JSON.parse(raw) : defaults;
    } catch (e) {
      return defaults;
    }
  },

  // Save JSON under "mpad.<key>".
  save: (key, obj) => {
    try {
      localStorage.setItem('mpad.' + key, JSON.stringify(obj));
    } catch (e) {
      // Storage can fail if quota exceeded or in private mode.
      // Intentionally silent to avoid on-screen tells.
    }
  }
};
EOF

# ---------- assets/js/gestures.js ----------
cat > assets/js/gestures.js <<'EOF'
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
EOF

# ---------- assets/js/swipe.js ----------
cat > assets/js/swipe.js <<'EOF'
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
EOF

echo "✅ All files written."
echo "Next: Source Control → commit and push. Then enable Pages (Settings → Pages → main/root)."