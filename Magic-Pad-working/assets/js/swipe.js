/* SWIPE ENGINE — clock mapping + settings-aware submit */
const Swipe = (() => {
  let buffer = "", timer = null;

  function loadConfig() {
    const d = { delay:3, shortcut:'', clipboard:false, postShortcut:'' };
    const c = Storage.load('swipe', d) || d;
    return {
      delay: Math.max(1, +c.delay || 3),
      shortcut: (c.shortcut||'').trim(),
      clipboard: !!c.clipboard,
      postShortcut: (c.postShortcut||'').trim()
    };
  }

  function toClockCW(screenDeg){ return ((screenDeg + 90) % 360 + 360) % 360; }
  function cwToHour(cw){ const h=Math.round(cw/30)%12; return h===0?12:h; }
  function hourToDigitOrAction(h){ if(h===12)return 0; if(h>=1&&h<=9)return h; if(h===11)return 'SUBMIT'; return null; }

  async function copyText(text){
    try{ if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return true; } }catch{}
    try{
      const ta=document.createElement('textarea'); ta.value=text;
      ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); document.body.removeChild(ta); return ok;
    }catch{ return false; }
  }

  function start(config, hooks={}){
    const cfg = Object.assign(loadConfig(), config||{});
    const h = Object.assign({ onDigit(){}, onClear(){}, onSubmit(){}, onStatus(){}, onBlackoutPaint(){} }, hooks);

    function showBuffer(){ h.onDigit(null, buffer); }

    async function submitNow(){
      if(!buffer) return;
      const value = buffer; buffer=""; clearTimeout(timer); timer=null; h.onClear();
      let routed='none';
      if(cfg.clipboard){ await copyText(value); routed='clipboard'; }
      if(cfg.shortcut){
        routed='shortcut';
        try{
          const url=`shortcuts://run-shortcut?name=${encodeURIComponent(cfg.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
          window.location.href=url;
        }catch{}
      }
      if(cfg.postShortcut){
        setTimeout(()=>{
          try{ window.location.href=`shortcuts://run-shortcut?name=${encodeURIComponent(cfg.postShortcut)}`; }catch{}
        },150);
      }
      h.onSubmit(value, routed);
    }

    function arm(){ clearTimeout(timer); timer=setTimeout(()=>submitNow(), cfg.delay*1000); }

    Gestures.onSwipe(angleScreen=>{
      const hour = cwToHour(toClockCW(angleScreen));
      const d = hourToDigitOrAction(hour);
      if(d===null) return;
      if(d==='SUBMIT'){ submitNow(); return; }
      buffer += String(d);
      showBuffer();
      arm();
    });

    Gestures.onDoubleTap(()=>{ buffer=''; clearTimeout(timer); timer=null; h.onClear(); });
    Gestures.onTwoFingerDown(()=>{ buffer=''; clearTimeout(timer); timer=null; window.location.href='settings.html'; });
    Gestures.onTwoFingerTap(()=>{ submitNow(); });

    showBuffer();

    return {
      clear(){ buffer=''; clearTimeout(timer); timer=null; h.onClear(); },
      submitNow(){ submitNow(); }
    };
  }

  return { start };
})();
