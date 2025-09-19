/* Touch-only gestures: swipe angle, double-tap, two-finger down */
const Gestures = (() => {
  const MIN_SWIPE_PX = 30, DOUBLE_TAP_MS = 300, TWO_DOWN_MS = 150;
  let sx=null, sy=null, lastTap=0, t0=0;

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
    document.body.addEventListener('touchend',()=>{
      const now=Date.now();
      if(now-lastTap<=DOUBLE_TAP_MS){ cb(); lastTap=0; } else lastTap=now;
    },{passive:true});
  }

  function onTwoFingerDown(cb){
    document.body.addEventListener('touchstart',e=>{
      if(e.touches.length===1){ t0=Date.now(); }
      else if(e.touches.length===2 && Date.now()-t0<=TWO_DOWN_MS){ cb(); t0=0; }
    },{passive:true});
  }

  return { onSwipe, onDoubleTap, onTwoFingerDown };
})();