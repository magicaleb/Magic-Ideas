/* ===================================================
   SWIPE ENGINE (Clock-face digit input) — minimal, robust
   - Uses Gestures.* for events only
   - Maps angle → hour → digit; 12→0, 1–9→1..9, 11→submit
   - Double-tap clears; two-finger down exits to settings
   - Optional clipboard on submit (works in Safari tab)
   =================================================== */
const Swipe = (() => {
  let buffer = "";
  let timer  = null;

  // Angle (screen coords) -> hour like a clock. Up = 12, CW increases.
  function angleToHour(deg) {
    // screen 0=right, 90=down, -90=up
    const shifted = ((deg + 90) % 360 + 360) % 360;     // 0..359 with up at 0
    return Math.floor((shifted + 15) / 30) + 1;         // 1..12
  }

  function hourToDigitOrAction(h) {
    if (h === 12) return 0;            // 12 o'clock = 0
    if (h >= 1 && h <= 9) return h;    // 1..9 = digits
    if (h === 11) return "SUBMIT";     // 11 o'clock = submit now
    return null;                       // 10 ignored
  }

  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    try { const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch { return false; }
  }

  function show(val) { document.getElementById('swipe-pad').textContent = val || "-"; }

  async function submit(config) {
    if (!buffer) return;
    const value = buffer;
    buffer = ""; clearTimeout(timer); timer = null;
    show("-");

    // Clipboard path (simple, optional)
    if (config.clipboard) {
      const ok = await copyText(value);
      if (!ok) {
        // no-op if blocked; UI still shows cleared state
      }
    }
  }

  function armTimer(config) {
    clearTimeout(timer);
    timer = setTimeout(() => submit(config), Math.max(1, config.delay||3) * 1000);
  }

  const api = {
    start(config = { delay: 3 }) {
      show(buffer);

      // One-finger swipe → digit / action
      Gestures.onSwipe((angle) => {
        const hour = angleToHour(angle);
        const d = hourToDigitOrAction(hour);
        if (d === null) return;
        if (d === "SUBMIT") { submit(config); return; }
        buffer += String(d);
        show(buffer);
        armTimer(config);
      });

      // Double-tap → clear
      Gestures.onDoubleTap(() => {
        buffer = ""; clearTimeout(timer); timer = null; show("-");
      });

      // Two-finger down → exit
      Gestures.onTwoFingerDown(() => {
        buffer = ""; clearTimeout(timer); timer = null;
        window.location.href = "settings.html";
      });
    }
  };
  return api;
})();
