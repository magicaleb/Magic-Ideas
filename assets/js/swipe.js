/* SWIPE ENGINE — visible UI hooks + reliable routing */
const Swipe = (() => {
  let buffer = "", timer = null;

  const copyText = async (text) => {
    try { if (navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return true; } } catch{}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch { return false; }
  };

  const toClockDegrees = (angle) => { const n=(angle+360)%360, s=(n+90)%360; return (360-s)%360; };
  const clockDegToHour = (deg) => Math.floor(((deg+15)%360)/30)+1;
  const hourToDigitOrAction = (h) => (h===12?0:(h>=1&&h<=9?h:(h===11?'SUBMIT':null)));

  const submit = async (config, hooks) => {
    if (!buffer) return;
    const value = buffer;
    buffer=""; clearTimeout(timer); timer=null;

    let route = 'none';
    try {
      if (config.clipboard) {
        const ok = await copyText(value);
        route = ok ? 'clipboard' : 'none';
        if (!ok) hooks?.onStatus?.('Clipboard blocked');
      } else if (config.shortcut) {
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(config.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
        route = 'shortcut';
        window.location.href = url;
      }
    } catch {}

    try {
      if (config.postShortcut) {
        setTimeout(()=>{ window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(config.postShortcut)}`; }, 150);
      }
    } catch {}

    try { hooks?.onSubmit?.(value, route); } catch {}
  };

  const armTimer = (config, hooks) => { clearTimeout(timer); timer=setTimeout(()=>submit(config, hooks), Math.max(1, config.delay||3)*1000); };

  const api = {
    start(config, hooks={}){
      buffer=""; clearTimeout(timer); timer=null;

      const submitNow = ()=> submit(config, hooks);
      const clearNow  = ()=>{ buffer=""; clearTimeout(timer); timer=null; hooks?.onClear?.(); };

      Gestures.onSwipe((angle)=>{
        const h = clockDegToHour(toClockDegrees(angle));
        const digitOrAct = hourToDigitOrAction(h);
        if (digitOrAct===null) return;
        if (digitOrAct==='SUBMIT'){ submitNow(); return; }
        buffer += String(digitOrAct);
        hooks?.onDigit?.(digitOrAct, buffer);
        armTimer(config, hooks);
      });

      Gestures.onDoubleTap(clearNow);

      Gestures.onTwoFingerDown(()=>{
        buffer=""; clearTimeout(timer); timer=null;
        window.location.href="settings.html";
      });

      return { submitNow, clear: clearNow };
    }
  };
  return api;
})();