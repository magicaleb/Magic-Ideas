/* ===================================================
   SWIPE ENGINE (Clock-face digit input)
   =================================================== */

const Swipe = (() => {
  let buffer = "";   // digits user has swiped
  let timer = null;  // inactivity timer

  function toDigit(hour) {
    // Convert 12-clock positions to digits 1–9
    if (hour >= 1 && hour <= 9) return hour;
    return null; // 10, 11, 12 ignored
  }

  function submit(config, hooks) {
    const field = document.getElementById("swipe-pad");
    if (field) {
      field.innerText = buffer || "-";
    }
    if (hooks?.onSubmit) hooks.onSubmit(buffer);
    buffer = "";
  }

  function armTimer(config, hooks) {
    clearTimeout(timer);
    timer = setTimeout(() => submit(config, hooks), config.delay * 1000);
  }

  const api = {
    start(config = { delay: 3 }, hooks = {}) {
      Gestures.onSwipe(angle => {
        const hour = Gestures.angleToClockHour(angle);
        const digit = toDigit(hour);
        if (!digit) return;

        buffer += String(digit);
        const field = document.getElementById("swipe-pad");
        if (field) field.innerText = buffer;

        armTimer(config, hooks);
      });

      // Clear buffer with double tap
      Gestures.onDoubleTap(() => {
        buffer = "";
        const field = document.getElementById("swipe-pad");
        if (field) field.innerText = "-";
        clearTimeout(timer);
        timer = null;
      });

      // Exit with two-finger down
      Gestures.onTwoFingerDown(() => {
        window.location.href = "settings.html";
      });
    }
  };

  return api;
})();