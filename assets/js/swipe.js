/* SWIPE ENGINE (hooks API): start(config, hooks)
  12→0; 1–9→digits; 11 ignored (use two-finger tap to submit); 10 ignored.
  Double-tap clears. Two-finger down exits to settings. Two-finger tap submits.
*/
const Swipe = (() => {
  const DEF = { delay: 3, shortcut: "", clipboard: false, postShortcut: "", entryMode: "adjust" };

  // Convert gestures angle (0=right, 90=up, -90=down, 180/-180=left)
  // to clockwise clock degrees where 0=12 (up), 90=3 (right), 180=6 (down), 270=9 (left)
  const toCW = deg => {
    // Map Gestures angle to compass-clockwise degrees: up(-90)→0, right(0)→90, down(90)→180, left(±180)→270
    let cw = (deg + 90) % 360;
    if (cw < 0) cw += 360;
    return cw;
  };
  // Snap to nearest 30° sector and map 0=>12, 30=>1, ..., 330=>11
  const cwToHour = cw => {
    const h = Math.floor((cw + 15) / 30) % 12;
    return h === 0 ? 12 : h;
  };
  const hourMap = h => h===12 ? 0 : (h>=1&&h<=9 ? h : (h===11 ? "SUBMIT" : null));

  async function copyText(text){
    // Try navigator.clipboard first (preferred, async)
    try {
      if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e){
      try{ console.debug('[Swipe] navigator.clipboard.writeText failed', e); }catch(_){ }
    }

    // Fallback: textarea + execCommand with iOS-specific handling
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      if (typeof ta.setSelectionRange === 'function') ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e){
      try{ console.debug('[Swipe] execCommand copy failed', e); }catch(_){ }
      return false;
    }
  }

  // Synchronous copy for immediate user gestures - last known-good implementation
  function syncCopy(text){
    try{
      const input = document.createElement('input');
      input.value = text;
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      input.style.opacity = '0';
      input.style.fontSize = '16px'; // Prevent iOS zoom
      input.readOnly = true;
      document.body.appendChild(input);
      input.focus();
      input.select();
      if (typeof input.setSelectionRange === 'function') input.setSelectionRange(0, input.value.length);
      const success = document.execCommand && document.execCommand('copy');
      document.body.removeChild(input);
      return !!success;
    }catch(e){ return false; }
  }

  function mergeConfig(arg={}){
    let saved = DEF;
    try { if(window.Storage?.load) saved = Storage.load('swipe', DEF) || DEF; } catch {}
    return {
      delay: Math.max(1, +('delay' in arg ? arg.delay : saved.delay) || DEF.delay),
      shortcut: (('shortcut' in arg ? arg.shortcut : saved.shortcut) || "").trim(),
      clipboard: !!('clipboard' in arg ? arg.clipboard : saved.clipboard),
      postShortcut: (('postShortcut' in arg ? arg.postShortcut : saved.postShortcut) || "").trim(),
      entryMode: (('entryMode' in arg ? arg.entryMode : saved.entryMode) || 'adjust')
    };
  }

  function start(configArg={}, hooks={}){
    const cfg = mergeConfig(configArg);
    let buffer="", timer=null, pendingBase=null;

    const call = (fn, ...a)=>{ try{ fn && fn(...a); }catch{} };
    const paint = ()=>{
      try{ console.debug('[Swipe] paint buffer', buffer); }catch(_){ }
      call(hooks.onDigit, null, buffer || '');
    };
  const arm   = ()=>{ clearTimeout(timer); timer=setTimeout(()=>submit(), cfg.delay*1000); debugArm(); };

  function debugArm(){ try{ console.debug('[Swipe] arm timer (ms)', cfg.delay*1000, 'timerId', timer); }catch(_){} }
    // ----- Adjust-mode helpers (two-swipe digit input) -----
    const order = ['U','R','D','L'];
    const cardinalFromAngle = (ang)=>{
      // Gestures: 0=right, 90=up, -90=down
      if (ang > -135 && ang <= -45) return 'U';
      if (ang > 45 && ang <= 135) return 'D';
      if (ang > -45 && ang <= 45) return 'R';
      return 'L';
    };
    const adjustDelta = (base, adj)=>{
      const bi = order.indexOf(base), ai = order.indexOf(adj);
      if (ai === bi) return 0; // same direction = no adjust
      const diff = (ai - bi + 4) % 4; // 1=CW, 3=CCW, 2=opposite
      if (diff === 1) return +1;
      if (diff === 3) return -1;
      return +1; // opposite => pick +1 by convention
    };
    const baseDigitFromCardinal = c => ({ U:0, R:3, D:6, L:9 })[c];

    async function submit(){
      try{ console.debug('[Swipe] submit triggered, buffer=', buffer); }catch(_){ }
      if(!buffer) return;
      
      const value = buffer; // Save the value BEFORE clearing
      console.log('[Clipboard] Saving value to copy:', value);
      
      // Clear display and timer first
  clearTimeout(timer); timer=null; 
  buffer=""; pendingBase=null; // Clear buffer AFTER saving value
      paint(); // Update display to show empty
      try{ console.debug('[Swipe] buffer cleared by submit'); }catch(_){ }
      
      let route="none";

      // If clipboard is requested, try to copy the SAVED value (last known-good flow)
      if (cfg.clipboard) {
        try { console.debug('[Clipboard] Attempting copy for value:', value); } catch(_) {}
        // Try synchronous copy first (best chance on mobile during a user gesture)
        let ok = syncCopy(value);
        if (ok) {
          route = 'clipboard';
          call(hooks.onStatus, 'Copied');
          try { console.debug('[Clipboard] syncCopy SUCCESS'); } catch(_) {}
        } else {
          // Fallback to async strategies
          try {
            ok = await copyText(value);
            if (ok) {
              route = 'clipboard';
              call(hooks.onStatus, 'Copied');
              try { console.debug('[Clipboard] async copyText SUCCESS'); } catch(_) {}
            } else {
              route = 'clipboard-failed';
              call(hooks.onStatus, 'Clipboard blocked');
              try { console.debug('[Clipboard] Both sync and async copy failed'); } catch(_) {}
            }
          } catch (err) {
            route = 'clipboard-failed';
            call(hooks.onStatus, 'Clipboard error');
            try { console.debug('[Clipboard] async copyText ERROR:', err?.message || err); } catch(_) {}
          }
        }
      }

      // If a shortcut is configured, wait briefly after a successful clipboard write so the clipboard has time to populate
      if(cfg.shortcut){
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
        try{
          const launch = ()=>{ try{ window.location.href = url; }catch{} };
          if(route.indexOf && route.indexOf('clipboard') !== -1){
            // wait 250ms to allow clipboard writes to complete in constrained PWAs
            setTimeout(launch, 250);
          } else {
            launch();
          }
          route = route === 'clipboard' ? 'clipboard+shortcut' : 'shortcut';
        }catch{}
      }

      if(cfg.postShortcut){
        setTimeout(()=>{ try{ window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.postShortcut)}`; }catch{} }, 250);
      }

      call(hooks.onSubmit, value, route);
    }

  function clearAll(){ try{ console.debug('[Swipe] clearAll called'); }catch(_){} buffer=""; pendingBase=null; clearTimeout(timer); timer=null; call(hooks.onClear); paint(); }

  // swipe digits
  // The perform page uses id="root" for the main container — prefer that.
  const root = document.getElementById('root') || document.getElementById('performRoot') || document.body;
    Gestures.onSwipe(angle=>{
      const mode = (cfg.entryMode || 'adjust');
      if (mode === 'direct') {
        const v = hourMap(cwToHour(toCW(angle)));
        if(v===null) return;
        if(v==="SUBMIT"){ return; }
        buffer += String(v);
        call(hooks.onDigit, v, buffer);
        arm();
        return;
      }

      // Adjust mode: base + adjust swipes produce one digit
      const card = cardinalFromAngle(angle);
      if (!pendingBase) { pendingBase = card; call(hooks.onDigit, null, buffer); return; }
      const d = adjustDelta(pendingBase, card);
      let digit = baseDigitFromCardinal(pendingBase);
      digit = (digit + d + 10) % 10;
      pendingBase = null;
      buffer += String(digit);
      call(hooks.onDigit, digit, buffer);
      arm();
    }, root);

  // Use long-press to clear to avoid misclassifying quick taps during fast swipes
  if (Gestures.onLongPress) Gestures.onLongPress(()=> clearAll(), root);
  // Single-tap submits immediately (runs inside a user gesture on mobile)
  if (Gestures.onTap) Gestures.onTap(()=> submit(), root);
    Gestures.onTwoFingerDown(()=>{ 
      clearAll(); 
      try{
        const inTrick = (location.pathname || '').indexOf('/tricks/swipe/') !== -1;
        const url = inTrick ? 'settings.html' : 'tricks/swipe/settings.html';
        window.location.href = url;
      }catch{ window.location.href='tricks/swipe/settings.html'; }
    }, root);
    if(Gestures.onTwoFingerTap) Gestures.onTwoFingerTap(()=> submit(), root);

    paint();
    return { submitNow: ()=>submit(), clear: ()=>clearAll() };
  }

  return { start };
})();
