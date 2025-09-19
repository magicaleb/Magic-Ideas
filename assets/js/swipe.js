/* SWIPE ENGINE (hooks API): start(config, hooks)
  12→0; 1–9→digits; 11 ignored (use two-finger tap to submit); 10 ignored.
  Double-tap clears. Two-finger down exits to settings. Two-finger tap submits.
*/
const Swipe = (() => {
  const DEF = { delay: 3, shortcut: "", clipboard: false, postShortcut: "" };

  const toCW = deg => ((deg + 90) % 360 + 360) % 360;       // up=0, CW+
  const cwToHour = cw => ((Math.round(cw/30) % 12) || 12);   // 1..12
  const hourMap = h => h===12 ? 0 : (h>=1&&h<=9 ? h : (h===11 ? "SUBMIT" : null));

  async function copyText(text){
    try { if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return true; } } catch{}
    try {
      const ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly','');
      ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch { return false; }
  }

  function mergeConfig(arg={}){
    let saved = DEF;
    try { if(window.Storage?.load) saved = Storage.load('swipe', DEF) || DEF; } catch {}
    return {
      delay: Math.max(1, +('delay' in arg ? arg.delay : saved.delay) || DEF.delay),
      shortcut: (('shortcut' in arg ? arg.shortcut : saved.shortcut) || "").trim(),
      clipboard: !!('clipboard' in arg ? arg.clipboard : saved.clipboard),
      postShortcut: (('postShortcut' in arg ? arg.postShortcut : saved.postShortcut) || "").trim(),
    };
  }

  function start(configArg={}, hooks={}){
    const cfg = mergeConfig(configArg);
    let buffer="", timer=null;

    const call = (fn, ...a)=>{ try{ fn && fn(...a); }catch{} };
    const paint = ()=>{
      call(hooks.onDigit, null, buffer || '');
    };
    const arm   = ()=>{ clearTimeout(timer); timer=setTimeout(()=>submit(), cfg.delay*1000); };

    async function submit(){
      if(!buffer) return;
      const value = buffer; buffer=""; clearTimeout(timer); timer=null; paint();
      let route="none";

      if(cfg.clipboard){
        const ok = await copyText(value);
        if(ok) route = "clipboard";
        else call(hooks.onStatus,"Clipboard blocked");
      }
      if(cfg.shortcut){
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
        route = "shortcut";
        try{ window.location.href = url; }catch{}
      }
      if(cfg.postShortcut){
        setTimeout(()=>{ try{ window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.postShortcut)}`; }catch{} }, 150);
      }
      call(hooks.onSubmit, value, route);
    }

    function clearAll(){ buffer=""; clearTimeout(timer); timer=null; call(hooks.onClear); paint(); }

    // swipe digits
    Gestures.onSwipe(angle=>{
      const v = hourMap(cwToHour(toCW(angle)));
      if(v===null) return;
      // 11 (SUBMIT) will be ignored for swipe; submission is via two-finger tap
      if(v==="SUBMIT"){ return; }
      buffer += String(v);
      call(hooks.onDigit, v, buffer);
      arm();
    });

    Gestures.onDoubleTap(()=> clearAll());
    Gestures.onTwoFingerDown(()=>{ clearAll(); window.location.href='settings.html'; });
    // new: two-finger tap for immediate submit
    if(Gestures.onTwoFingerTap) Gestures.onTwoFingerTap(()=> submit());

    paint();
    return { submitNow: ()=>submit(), clear: ()=>clearAll() };
  }

  return { start };
})();