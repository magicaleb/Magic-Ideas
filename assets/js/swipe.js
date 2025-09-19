/* SWIPE ENGINE — clock mapping + settings-aware submit */
const Swipe = (() => {
  let buffer = "", timer = null;

  // Load settings saved by settings.html
  function loadConfig() {
    try {
      const c = JSON.parse(localStorage.getItem("swipe") || "{}");
      return {
        delay: Math.max(1, +c.delay || 3),
        shortcut: (c.shortcut || "").trim(),
        clipboard: !!c.clipboard,
        postShortcut: (c.postShortcut || "").trim()
      };
    } catch { return { delay:3, shortcut:"", clipboard:false, postShortcut:"" }; }
  }

  // Screen angle (0=right, 90=down, -90=up) -> CW degrees with 0 at UP
  function toClockCW(degScreen) {
    return ((degScreen + 90) % 360 + 360) % 360; // 0 at up, increases clockwise
  }
  // Map CW degrees to nearest hour (1..12), with 0/360 -> 12
  function cwToHour(cw) {
    const h = Math.round(cw / 30) % 12;  // nearest sector
    return h === 0 ? 12 : h;
  }
  function hourToDigitOrAction(h) {
    if (h === 12) return 0;          // 12 o’clock = 0
    if (h >= 1 && h <= 9) return h;  // 1..9 = digits
    if (h === 11) return "SUBMIT";   // 11 o’clock = submit now
    return null;                     // 10 ignored
  }

  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    try { const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0"; ta.style.left="-9999px";
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
    } catch { return false; }
  }

  function show(val) { const el=document.getElementById("swipe-pad"); if (el) el.textContent = val || "-"; }

  async function submit(config) {
    if (!buffer) return;
    const value = buffer;
    buffer = ""; clearTimeout(timer); timer=null; show("-");

    // Route 1: clipboard
    if (config.clipboard) { await copyText(value); }

    // Route 2: Shortcut with text input
    if (config.shortcut) {
      const url = `shortcuts://run-shortcut?name=${encodeURIComponent(config.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
      try { window.location.href = url; } catch {}
    }

    // Optional post-submit Shortcut (e.g., haptic confirm Shortcut)
    if (config.postShortcut) {
      setTimeout(() => {
        try { window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(config.postShortcut)}`; } catch {}
      }, 150);
    }
  }

  function armTimer(config) { clearTimeout(timer); timer = setTimeout(() => submit(config), config.delay * 1000); }

  const api = {
    start() {
      const config = loadConfig();
      show(buffer);

      Gestures.onSwipe((angleScreen) => {
        const hour = cwToHour(toClockCW(angleScreen));
        const d = hourToDigitOrAction(hour);
        if (d === null) return;
        if (d === "SUBMIT") { submit(config); return; }
        buffer += String(d);
        show(buffer);
        armTimer(config);
      });

      Gestures.onDoubleTap(() => { buffer=""; clearTimeout(timer); timer=null; show("-"); });
      Gestures.onTwoFingerDown(() => { buffer=""; clearTimeout(timer); timer=null; window.location.href="settings.html"; });
    }
  };
  return api;
})();