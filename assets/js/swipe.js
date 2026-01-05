/* SWIPE ENGINE (hooks API): start(config, hooks)
  Supports two input modes:
  1. Clock Face (old): Direct swipe to 12 positions (12→0, 1-9→digits, 10,11 ignored)
  2. Two-Swipe (new, default): Two-step swipe for precise input
  
  Double-tap clears. Two-finger down exits to settings. Two-finger tap submits.
*/
const Swipe = (() => {
  const DEF = { delay: 3, shortcut: "", clipboard: false, postShortcut: "", useTwoSwipe: true };

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
      useTwoSwipe: ('useTwoSwipe' in arg ? !!arg.useTwoSwipe : ('useTwoSwipe' in saved ? !!saved.useTwoSwipe : DEF.useTwoSwipe)),
    };
  }

  // Two-swipe mode state
  class TwoSwipeState {
    constructor() {
      this.reset();
    }

    reset() {
      this.stage = 'first';
      this.basePosition = null;
      this.firstSwipeDirection = null;
      this.clearTimeout();
    }

    setTimeout(callback, delay) {
      this.clearTimeout();
      this.timeout = setTimeout(callback, delay);
    }

    clearTimeout() {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }

    // Convert angle to cardinal direction
    angleToDirection(angle) {
      // Normalize angle to 0-360
      const normalized = ((angle % 360) + 360) % 360;
      
      // Map to cardinal directions (45° tolerance on each side)
      if (normalized >= 315 || normalized < 45) return 'right';
      if (normalized >= 45 && normalized < 135) return 'down';
      if (normalized >= 135 && normalized < 225) return 'left';
      if (normalized >= 225 && normalized < 315) return 'up';
      return null;
    }

    // Determine if second swipe is clockwise relative to first
    isClockwise(secondDir, firstDir) {
      const clockwiseOrder = ['up', 'right', 'down', 'left'];
      const firstIdx = clockwiseOrder.indexOf(firstDir);
      const secondIdx = clockwiseOrder.indexOf(secondDir);
      
      if (firstIdx === -1 || secondIdx === -1) return false;
      
      const diff = (secondIdx - firstIdx + 4) % 4;
      return diff === 1;
    }

    processSwipe(angle, onComplete) {
      const direction = this.angleToDirection(angle);
      if (!direction) return null;

      if (this.stage === 'first') {
        return this.processFirstSwipe(direction, onComplete);
      } else {
        return this.processSecondSwipe(direction, onComplete);
      }
    }

    processFirstSwipe(direction, onComplete) {
      const directionMap = {
        'up': 12,
        'right': 3,
        'down': 6,
        'left': 9
      };

      this.basePosition = directionMap[direction];
      this.firstSwipeDirection = direction;
      this.stage = 'second';

      // Set timeout to reset if second swipe not completed
      this.setTimeout(() => this.reset(), 3000);

      return null; // Not complete yet
    }

    processSecondSwipe(direction, onComplete) {
      this.clearTimeout();

      let finalPosition = this.basePosition;

      if (direction === this.firstSwipeDirection) {
        // Same direction = exact base position
        finalPosition = this.basePosition;
      } else if (this.isClockwise(direction, this.firstSwipeDirection)) {
        // Clockwise = +1
        finalPosition = this.basePosition + 1;
        if (finalPosition > 12) finalPosition = 1;
      } else {
        // Counter-clockwise = -1
        finalPosition = this.basePosition - 1;
        if (finalPosition < 1) finalPosition = 12;
      }

      // Map to digit/position
      // In two-swipe mode: 12->0, 1-11 are valid positions
      // For positions 10 and 11, we'll output them as "10" and "11" strings
      let digit;
      if (finalPosition === 12) {
        digit = 0;
      } else if (finalPosition >= 1 && finalPosition <= 9) {
        digit = finalPosition;
      } else if (finalPosition === 10 || finalPosition === 11) {
        digit = finalPosition; // Return 10 or 11 directly
      } else {
        digit = null;
      }

      this.reset();

      return digit;
    }
  }

  function start(configArg={}, hooks={}){
    const cfg = mergeConfig(configArg);
    let buffer="", timer=null;
    const twoSwipeState = new TwoSwipeState();

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

    function clearAll(){ 
      buffer=""; 
      clearTimeout(timer); 
      timer=null; 
      twoSwipeState.reset(); 
      call(hooks.onClear); 
      paint(); 
    }

    // swipe digits - supports both modes
    Gestures.onSwipe(angle=>{
      let digit = null;

      if (cfg.useTwoSwipe) {
        // Two-swipe mode
        digit = twoSwipeState.processSwipe(angle);
        if (digit === null) {
          // Still waiting for second swipe
          call(hooks.onStatus, "Swipe again to refine...");
          return;
        }
      } else {
        // Clock face mode (original)
        const v = hourMap(cwToHour(toCW(angle)));
        if(v===null || v==="SUBMIT") return;
        digit = v;
      }

      if (digit !== null) {
        buffer += String(digit);
        call(hooks.onDigit, digit, buffer);
        arm();
      }
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