// <<<<<<< magic-pad-ui-v1-2
// /* ===================================================
//    SWIPE ENGINE (hooks API)
//    - start(config, hooks)
//    - 12→0, 1–9→digits, 11→Submit, 10 ignored
//    - Double-tap: clear • Two-finger down: back to settings
//    - Uses Gestures.* events (touch-only)
//    =================================================== */
// const Swipe = (() => {
//   // ---- defaults + config loading ----
//   const DEF = { delay: 3, shortcut: "", clipboard: false, postShortcut: "" };

//   function mergeConfig(arg = {}) {
//     // Prefer Storage helper if present, else DEF
//     let saved = DEF;
//     try {
//       if (window.Storage && typeof Storage.load === "function") {
//         saved = Storage.load("swipe", DEF) || DEF;
//       }
//     } catch {}
//     const cfg = {
//       delay: Math.max(1, +("delay" in arg ? arg.delay : saved.delay) || DEF.delay),
//       shortcut: (("shortcut" in arg ? arg.shortcut : saved.shortcut) || "").trim(),
//       clipboard: !!("clipboard" in arg ? arg.clipboard : saved.clipboard),
//       postShortcut: (("postShortcut" in arg ? arg.postShortcut : saved.postShortcut) || "").trim()
//     };
//     return cfg;
//   }

//   // ---- angle → hour → digit/action ----
//   // Screen angles: 0=right, 90=down, -90=up. We want CW with 0 at UP.
//   const toClockCW = deg => ((deg + 90) % 360 + 360) % 360;          // 0..359, up=0
//   const cwToHour  = cw  => ((Math.round(cw / 30) % 12) || 12);      // nearest hour 1..12
//   function hourToDigitOrAction(h){
//     if (h === 12) return 0;                // 12→0
//     if (h >= 1 && h <= 9) return h;        // 1..9→digits
//     if (h === 11) return "SUBMIT";         // 11→submit now
//     return null;                           // 10 ignored
//   }

//   // ---- helpers ----
//   async function copyText(text){
//     try {
//       if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
//     } catch {}
//     try {
//       const ta = document.createElement("textarea");
//       ta.value = text; ta.setAttribute("readonly","");
//       ta.style.position="fixed"; ta.style.opacity="0"; ta.style.left="-9999px";
//       document.body.appendChild(ta); ta.select();
//       const ok = document.execCommand("copy");
//       document.body.removeChild(ta);
//       return ok;
//     } catch { return false; }
//   }

//   // ---- engine ----
//   function start(configArg = {}, hooks = {}){
//     const cfg = mergeConfig(configArg);
//     let buffer = "";
//     let timer  = null;

//     const call = (fn, ...a) => { try { fn && fn(...a); } catch{} };
//     const arm  = () => { clearTimeout(timer); timer = setTimeout(() => submit(), cfg.delay * 1000); };
//     const show = () => call(hooks.onDigit, null, buffer || "");     // UI drives from buffer only

//     async function submit(){
//       if (!buffer) return;
//       const value = buffer;
//       buffer = "";
//       clearTimeout(timer); timer = null;
//       show();

//       // Decide primary route string for UI
//       let route = "none";

//       // Clipboard (optional)
//       if (cfg.clipboard) {
//         const ok = await copyText(value);
//         route = ok ? "clipboard" : route;
//         if (!ok) call(hooks.onStatus, "Clipboard blocked");
//       }

//       // Shortcut (optional)
//       if (cfg.shortcut) {
//         const url = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
//         route = "shortcut";     // prefer showing this if both happen
//         try { window.location.href = url; } catch {}
//       }

//       // Post-submit Shortcut (optional)
//       if (cfg.postShortcut) {
//         setTimeout(() => {
//           try { window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.postShortcut)}`; } catch {}
//         }, 150);
//       }

//       call(hooks.onSubmit, value, route);
//     }

//     function clearAll(){
//       buffer = "";
//       clearTimeout(timer); timer = null;
//       call(hooks.onClear);
//       show();
//     }

//     // ---- wire gestures ----
//     Gestures.onSwipe((angleScreen) => {
//       const hour = cwToHour(toClockCW(angleScreen));
//       const v = hourToDigitOrAction(hour);
//       if (v === null) return;           // ignore 10
//       if (v === "SUBMIT") { submit(); return; }

//       buffer += String(v);
//       call(hooks.onDigit, v, buffer);
//       arm();
//     });

//     Gestures.onDoubleTap(() => { clearAll(); });
//     Gestures.onTwoFingerDown(() => {
//       clearAll();
//       window.location.href = "settings.html";
//     });

//     // initial paint for UIs that show "—" vs buffer
//     show();

//     // expose minimal controls for UI buttons
//     return {
//       submitNow: () => submit(),
//       clear: () => clearAll()
//     };
// =======
// /* SWIPE ENGINE (hooks API): start(config, hooks)
//   12→0; 1–9→digits; 11 ignored (use two-finger tap to submit); 10 ignored.
//   Double-tap clears. Two-finger down exits to settings. Two-finger tap submits.
// */
// const Swipe = (() => {
//   const DEF = { delay: 3, shortcut: "", clipboard: false, postShortcut: "" };

//   const toCW = deg => ((deg + 90) % 360 + 360) % 360;       // up=0, CW+
//   const cwToHour = cw => ((Math.round(cw/30) % 12) || 12);   // 1..12
//   const hourMap = h => h===12 ? 0 : (h>=1&&h<=9 ? h : (h===11 ? "SUBMIT" : null));

//   async function copyText(text){
//     try { if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return true; } } catch{}
//     try {
//       const ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly','');
//       ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';
//       document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); document.body.removeChild(ta); return ok;
//     } catch { return false; }
//   }

//   function mergeConfig(arg={}){
//     let saved = DEF;
//     try { if(window.Storage?.load) saved = Storage.load('swipe', DEF) || DEF; } catch {}
//     return {
//       delay: Math.max(1, +('delay' in arg ? arg.delay : saved.delay) || DEF.delay),
//       shortcut: (('shortcut' in arg ? arg.shortcut : saved.shortcut) || "").trim(),
//       clipboard: !!('clipboard' in arg ? arg.clipboard : saved.clipboard),
//       postShortcut: (('postShortcut' in arg ? arg.postShortcut : saved.postShortcut) || "").trim(),
//     };
//   }

//   function start(configArg={}, hooks={}){
//     const cfg = mergeConfig(configArg);
//     let buffer="", timer=null;

//     const call = (fn, ...a)=>{ try{ fn && fn(...a); }catch{} };
//     const paint = ()=>{
//       call(hooks.onDigit, null, buffer || '');
//     };
//     const arm   = ()=>{ clearTimeout(timer); timer=setTimeout(()=>submit(), cfg.delay*1000); };

//     async function submit(){
//       if(!buffer) return;
//       const value = buffer; buffer=""; clearTimeout(timer); timer=null; paint();
//       let route="none";

//       if(cfg.clipboard){
//         const ok = await copyText(value);
//         if(ok) route = "clipboard";
//         else call(hooks.onStatus,"Clipboard blocked");
//       }
//       if(cfg.shortcut){
//         const url = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
//         route = "shortcut";
//         try{ window.location.href = url; }catch{}
//       }
//       if(cfg.postShortcut){
//         setTimeout(()=>{ try{ window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.postShortcut)}`; }catch{} }, 150);
//       }
//       call(hooks.onSubmit, value, route);
//     }

//     function clearAll(){ buffer=""; clearTimeout(timer); timer=null; call(hooks.onClear); paint(); }

//     // swipe digits
//     Gestures.onSwipe(angle=>{
//       const v = hourMap(cwToHour(toCW(angle)));
//       if(v===null) return;
//       // 11 (SUBMIT) will be ignored for swipe; submission is via two-finger tap
//       if(v==="SUBMIT"){ return; }
//       buffer += String(v);
//       call(hooks.onDigit, v, buffer);
//       arm();
//     });

//     Gestures.onDoubleTap(()=> clearAll());
//     Gestures.onTwoFingerDown(()=>{ clearAll(); window.location.href='settings.html'; });
//     // new: two-finger tap for immediate submit
//     if(Gestures.onTwoFingerTap) Gestures.onTwoFingerTap(()=> submit());

//     paint();
//     return { submitNow: ()=>submit(), clear: ()=>clearAll() };
// >>>>>>> main
  }

  return { start };
})();