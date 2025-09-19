/* Touch-only gestures: swipe angle, double-tap, two-finger down, two-finger tap */
const Gestures = (() => {
  const MIN_SWIPE_PX = 30, DOUBLE_TAP_MS = 300, TWO_DOWN_MS = 150;
  const TWO_TAP_MS = 250, TWO_TAP_MAX_MOVE = 30;
  let sx=null, sy=null, lastTap=0, t0=0;
  let twoStart=0, twoStartPos=null;

  const dist2 = (x1,y1,x2,y2)=>{const dx=x2-x1, dy=y2-y1; return dx*dx+dy*dy;};
  const norm = d => { let a=d%360; if(a>=180)a-=360; if(a<-180)a+=360; return a; };

  function onSwipe(cb){
    document.body.addEventListener('touchstart',e=>{
      if(e.touches.length===1){ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; }
    },{passive:true});
    document.body.addEventListener('touchend',e=>{
      if(sx==null||sy==null) return;
      const t=e.changedTouches[0], ex=t.clientX, ey=t.clientY;
      if(dist2(sx,sy,ex,ey)<MIN_SWIPE_PX*MIN_SWIPE_PX){ sx=sy=null; return; }
      const dx=ex-sx, dy=ey-sy;
      cb(norm(Math.atan2(dy,dx)*180/Math.PI));
      sx=sy=null;
    },{passive:true});
  }

  function onDoubleTap(cb){
    // Only consider double-tap when it's a single-finger tap sequence.
    document.body.addEventListener('touchend',e=>{
      // ignore multi-touch events
      try{
        if(e.changedTouches && e.changedTouches.length!==1) { return; }
        if(e.touches && e.touches.length>0) { return; }
      }catch(_){ /* ignore */ }
      const now=Date.now();
      if(now-lastTap<=DOUBLE_TAP_MS){ cb(); lastTap=0; } else lastTap=now;
    },{passive:true});
  }

  // quick two-finger tap (used for Submit)
  function onTwoFingerTap(cb){
    document.body.addEventListener('touchstart',e=>{
      if(e.touches.length===2){
        twoStart = Date.now();
        twoStartPos = Array.from(e.touches).map(t=>({x:t.clientX,y:t.clientY}));
      }
    },{passive:true});
    document.body.addEventListener('touchend',e=>{
      if(!twoStart) return;
      const elapsed = Date.now()-twoStart;
      // consider it a tap if short and didn't move much
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
      twoStart = 0; twoStartPos = null;
    },{passive:true});
  }

  function onTwoFingerDown(cb){
    document.body.addEventListener('touchstart',e=>{
      if(e.touches.length===1){ t0=Date.now(); }
      else if(e.touches.length===2 && Date.now()-t0<=TWO_DOWN_MS){ cb(); t0=0; }
    },{passive:true});
  }

  return { onSwipe, onDoubleTap, onTwoFingerDown, onTwoFingerTap };
})();