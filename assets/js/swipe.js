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
      // ULTRA-SIMPLE CLIPBOARD - No fancy stuff, just what works
  function simpleCopy(text) {
    console.log('=== SIMPLE COPY ATTEMPT ===');
    console.log('Text to copy:', text);
    
    // Method 1: Most basic approach
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'absolute';
      textArea.style.left = '-1000px';
      textArea.style.top = '-1000px';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      console.log('execCommand result:', successful);
      if (successful) {
        console.log('✅ SUCCESS: Text copied with execCommand');
        return true;
      }
    } catch (err) {
      console.log('❌ execCommand failed:', err);
    }
    
    // Method 2: Try with input instead
    try {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = text;
      input.style.position = 'absolute';
      input.style.left = '-1000px';
      input.style.top = '-1000px';
      
      document.body.appendChild(input);
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      
      const successful = document.execCommand('copy');
      document.body.removeChild(input);
      
      console.log('input execCommand result:', successful);
      if (successful) {
        console.log('✅ SUCCESS: Text copied with input');
        return true;
      }
    } catch (err) {
      console.log('❌ input method failed:', err);
    }
    
    console.log('❌ ALL METHODS FAILED');
    return false;
  }

  // syncCopy: simpler version that tries to work during gesture events
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

  // Synchronous copy for immediate user gestures - simplified
  function syncCopy(text){
    console.log('[Clipboard] syncCopy attempting:', text);
    try{
      const input = document.createElement('input');
      input.value = text;
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      input.style.opacity = '0';
      input.style.fontSize = '16px'; // Prevents iOS zoom
      input.readOnly = true;
      
      document.body.appendChild(input);
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      
      const success = document.execCommand('copy');
      document.body.removeChild(input);
      
      console.log('[Clipboard] syncCopy result:', success);
      return success;
    }catch(e){ 
      console.log('[Clipboard] syncCopy failed:', e.message);
      return false; 
    }
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
      try{ console.debug('[Swipe] paint buffer', buffer); }catch(_){ }
      call(hooks.onDigit, null, buffer || '');
    };
  const arm   = ()=>{ clearTimeout(timer); timer=setTimeout(()=>submit(), cfg.delay*1000); debugArm(); };

  function debugArm(){ try{ console.debug('[Swipe] arm timer (ms)', cfg.delay*1000, 'timerId', timer); }catch(_){} }

    async function submit(){
      try{ console.debug('[Swipe] submit triggered, buffer=', buffer); }catch(_){ }
      if(!buffer) return;
      
      const value = buffer; // Save the value BEFORE clearing
      console.log('[Clipboard] Saving value to copy:', value);
      
      // Clear display and timer first
      clearTimeout(timer); timer=null; 
      buffer=""; // Clear buffer AFTER saving value
      paint(); // Update display to show empty
      try{ console.debug('[Swipe] buffer cleared by submit'); }catch(_){ }
      
      let route="none";

      // If clipboard is requested, try to copy the SAVED value
      if(cfg.clipboard){
        console.log('=== CLIPBOARD COPY ATTEMPT ===');
        console.log('Saved value to copy:', value);
        console.log('Value type:', typeof value);
        console.log('Value length:', value.length);
        
        // Use our ultra-simple copy function
        const success = simpleCopy(value);
        
        if(success) {
          route = "clipboard";
          call(hooks.onStatus,"Copied");
          console.log('🎉 CLIPBOARD SUCCESS!');
        } else {
          route = 'clipboard-failed'; 
          call(hooks.onStatus,"Clipboard failed");
          console.log('💥 CLIPBOARD FAILED!');
          
          // Try one more time with a different approach
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(value);
              route = "clipboard";
              call(hooks.onStatus,"Copied (async)");
              console.log('🎉 ASYNC CLIPBOARD SUCCESS!');
            }
          } catch(err) {
            console.log('💥 ASYNC CLIPBOARD ALSO FAILED:', err);
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

  function clearAll(){ try{ console.debug('[Swipe] clearAll called'); }catch(_){} buffer=""; clearTimeout(timer); timer=null; call(hooks.onClear); paint(); }

  // swipe digits
  // The perform page uses id="root" for the main container — prefer that.
  const root = document.getElementById('root') || document.getElementById('performRoot') || document.body;
    Gestures.onSwipe(angle=>{
      const v = hourMap(cwToHour(toCW(angle)));
      if(v===null) return;
      if(v==="SUBMIT"){ return; }
      buffer += String(v);
      call(hooks.onDigit, v, buffer);
      arm();
    }, root);

  // Use long-press to clear to avoid misclassifying quick taps during fast swipes
  if (Gestures.onLongPress) Gestures.onLongPress(()=> clearAll(), root);
    Gestures.onTwoFingerDown(()=>{ clearAll(); window.location.href='settings.html'; }, root);
    if(Gestures.onTwoFingerTap) Gestures.onTwoFingerTap(()=> submit(), root);

    paint();
    return { submitNow: ()=>submit(), clear: ()=>clearAll() };
  }

  return { start };
})();