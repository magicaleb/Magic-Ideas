/* Touch-only gestures: swipe angle, tap, double-tap, two-finger down, two-finger tap */
const Gestures = (() => {
  // increased thresholds to better separate quick swipes from taps
  const MIN_SWIPE_PX = 50, DOUBLE_TAP_MS = 300, TWO_DOWN_MS = 150;
  const TAP_MAX_MS = 250, TAP_MAX_MOVE = 12; // single-tap constraints
  const TWO_TAP_MS = 250, TWO_TAP_MAX_MOVE = 30;
  let sx=null, sy=null, lastTap=0, t0=0;
  let twoStart=0, twoStartPos=null;

  const dist2 = (x1,y1,x2,y2)=>{const dx=x2-x1, dy=y2-y1; return dx*dx+dy*dy;};
  const norm = d => { let a=d%360; if(a>=180)a-=360; if(a<-180)a+=360; return a; };

  function onTap(cb, el=document.body){
    // Prefer PointerEvents
    if(window.PointerEvent){
      let downX=null, downY=null, downAt=0, pointerId=null;
      el.addEventListener('pointerdown', e => {
        if(!e.isPrimary || e.pointerType==='mouse') return;
        pointerId = e.pointerId;
        downX = e.clientX; downY = e.clientY; downAt = Date.now();
      }, { passive:true });
      el.addEventListener('pointerup', e => {
        if(pointerId===null || e.pointerId!==pointerId) return;
        const dt = Date.now()-downAt;
        const dx = e.clientX - downX, dy = e.clientY - downY;
        const moved2 = dx*dx + dy*dy;
        if(dt <= TAP_MAX_MS && moved2 <= TAP_MAX_MOVE*TAP_MAX_MOVE){
          try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
          cb();
        }
        pointerId = null; downX = downY = null; downAt = 0;
      }, { passive:false });
      return;
    }

    // Touch fallback
    let tx=null, ty=null, tAt=0, active=false;
    el.addEventListener('touchstart', e => {
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(e.touches.length!==1) { active=false; return; }
      const t=e.touches[0]; tx=t.clientX; ty=t.clientY; tAt=Date.now(); active=true;
    }, { passive:false });
    el.addEventListener('touchend', e => {
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(!active || (e.changedTouches && e.changedTouches.length!==1)) { active=false; return; }
      const t=e.changedTouches[0];
      const dt = Date.now()-tAt; const dx=t.clientX-tx, dy=t.clientY-ty;
      const moved2 = dx*dx + dy*dy;
      if(dt <= TAP_MAX_MS && moved2 <= TAP_MAX_MOVE*TAP_MAX_MOVE){ cb(); }
      active=false;
    }, { passive:false });
  }

  function onSwipe(cb, el=document.body){
    // Prefer PointerEvents if available (unified and easier to prevent defaults)
    if(window.PointerEvent){
      let px=null, py=null, pDownAt=0;
      el.addEventListener('pointerdown', e => {
        try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
        if(e.isPrimary){ px = e.clientX; py = e.clientY; pDownAt = Date.now(); }
      }, {passive:false});
      el.addEventListener('pointerup', e => {
        try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
        if(px==null||py==null) return;
        const ex = e.clientX, ey = e.clientY;
        // require both sufficient movement and a minimal hold to classify as swipe
        if(dist2(px,py,ex,ey) < MIN_SWIPE_PX*MIN_SWIPE_PX || (Date.now()-pDownAt) < 30){ px=py=null; return; }
        const ang = norm(Math.atan2(ey-py, ex-px)*180/Math.PI);
        try{ console.debug('[Gestures] pointer swipe angle', ang); }catch(_){ }
        cb(ang);
        px=py=null;
      }, {passive:false});
      return;
    }

    el.addEventListener('touchstart',e=>{
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      try{ console.debug('[Gestures] touchstart', { touches: e.touches.length }); }catch(_){ }
      if(e.touches.length===1){ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; t0 = Date.now(); }
    },{passive:false});
    el.addEventListener('touchend',e=>{
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      try{ console.debug('[Gestures] touchend', { changed: e.changedTouches.length }); }catch(_){ }
      if(sx==null||sy==null) return;
      const t=e.changedTouches[0], ex=t.clientX, ey=t.clientY;
      // require sufficient movement and a small minimum time to avoid misclassifying quick taps/swipes
      if(dist2(sx,sy,ex,ey) < MIN_SWIPE_PX*MIN_SWIPE_PX || (Date.now()-t0) < 30){ sx=sy=null; return; }
      const dx=ex-sx, dy=ey-sy;
      const ang = norm(Math.atan2(dy,dx)*180/Math.PI);
      try{ console.debug('[Gestures] swipe angle', ang); }catch(_){ }
      cb(ang);
      sx=sy=null;
    },{passive:false});
  }

  function onDoubleTap(cb, el=document.body){
    el.addEventListener('touchend',e=>{
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      try{
        if(e.changedTouches && e.changedTouches.length!==1) { return; }
        if(e.touches && e.touches.length>0) { return; }
      }catch(_){ /* ignore */ }
      const now=Date.now();
      if(now-lastTap<=DOUBLE_TAP_MS){ cb(); lastTap=0; } else lastTap=now;
    },{passive:false});
  }

  // long-press (press & hold) to trigger an action (used for Clear)
  function onLongPress(cb, el=document.body, ms=600){
    let lpStart = 0, lpX = 0, lpY = 0, lpTimer = null;
    function clearLP(){ lpStart = 0; lpX = lpY = 0; if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } }

    // PointerEvent path (preferred when available)
    if(window.PointerEvent){
      let pointerId = null;
      el.addEventListener('pointerdown', e => {
        if(e.isPrimary && e.pointerType !== 'mouse'){
          pointerId = e.pointerId;
          lpStart = Date.now(); lpX = e.clientX; lpY = e.clientY;
          lpTimer = setTimeout(()=>{ cb(); clearLP(); pointerId = null; }, ms);
        }
      }, { passive:false });
      el.addEventListener('pointermove', e => {
        if(!pointerId || e.pointerId !== pointerId) return;
        if(dist2(lpX, lpY, e.clientX, e.clientY) > (MIN_SWIPE_PX/2)*(MIN_SWIPE_PX/2)) { clearLP(); pointerId = null; }
      }, { passive:false });
      el.addEventListener('pointerup', e => { if(pointerId && e.pointerId === pointerId) clearLP(); pointerId = null; }, { passive:false });
      el.addEventListener('pointercancel', e => { if(pointerId && e.pointerId === pointerId) clearLP(); pointerId = null; }, { passive:false });
      return;
    }

    // Touch fallback
    el.addEventListener('touchstart', e => {
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(e.touches.length !== 1) return;
      const t = e.touches[0]; lpStart = Date.now(); lpX = t.clientX; lpY = t.clientY;
      lpTimer = setTimeout(()=>{
        // only fire if still within movement threshold
        cb(); clearLP();
      }, ms);
    }, { passive:false });
    el.addEventListener('touchmove', e => {
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(!lpStart) return;
      const t = e.touches[0]; if(dist2(lpX, lpY, t.clientX, t.clientY) > (MIN_SWIPE_PX/2)*(MIN_SWIPE_PX/2)) { clearLP(); }
    }, { passive:false });
    el.addEventListener('touchend', e => { clearLP(); }, { passive:false });
  }

  // quick two-finger tap (used for Submit)
  function onTwoFingerTap(cb, el=document.body){
    el.addEventListener('touchstart',e=>{
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(e.touches.length===2){
        twoStart = Date.now();
        twoStartPos = Array.from(e.touches).map(t=>({x:t.clientX,y:t.clientY}));
      }
    },{passive:false});
    el.addEventListener('touchend',e=>{
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(!twoStart) return;
      const elapsed = Date.now()-twoStart;
      if(elapsed<=TWO_TAP_MS){
        let moved=false;
        for(let i=0;i<e.changedTouches.length;i++){
          const t=e.changedTouches[i];
          const ref = twoStartPos[i] || twoStartPos[0];
          if(!ref) continue;
          const dx = t.clientX - ref.x, dy = t.clientY - ref.y;
          if(dx*dx+dy*dy > TWO_TAP_MAX_MOVE*TWO_TAP_MAX_MOVE){ moved=true; break; }
        }
        if(!moved) cb();
      }
      twoStart=0; twoStartPos=null;
    },{passive:false});
  }

  function onTwoFingerDown(cb){
    document.body.addEventListener('touchstart',e=>{
      try{ if(e.cancelable) e.preventDefault(); }catch(_){ }
      if(e.touches.length===1){ t0=Date.now(); }
      else if(e.touches.length===2 && Date.now()-t0<=TWO_DOWN_MS){ cb(); t0=0; }
    },{passive:false});
  }

  return { onSwipe, onTap, onDoubleTap, onLongPress, onTwoFingerDown, onTwoFingerTap };
})();