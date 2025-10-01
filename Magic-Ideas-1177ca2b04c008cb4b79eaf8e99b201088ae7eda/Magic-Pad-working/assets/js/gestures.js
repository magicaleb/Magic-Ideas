/* GESTURE CAPTURE (TOUCH-ONLY) */
const Gestures = (() => {
  const MIN_SWIPE_PX = 30, DOUBLE_TAP_MS = 300, TWO_DOWN_MS = 150;
  let startX=null,startY=null,lastTap=0,twoStart=0;

  const dist2=(x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1;return dx*dx+dy*dy;};

  function onSwipe(cb){
    document.body.addEventListener('touchstart',e=>{
      if(e.touches.length===1){ const t=e.touches[0]; startX=t.clientX; startY=t.clientY; }
    },{passive:true});
    document.body.addEventListener('touchend',e=>{
      if(startX==null||startY==null) return;
      const t=e.changedTouches[0], endX=t.clientX, endY=t.clientY;
      if(dist2(startX,startY,endX,endY)<MIN_SWIPE_PX*MIN_SWIPE_PX){ startX=startY=null; return; }
      const dx=endX-startX, dy=endY-startY;
      const deg = Math.atan2(dy,dx)*180/Math.PI; // screen angle
      cb(deg);
      startX=startY=null;
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
      if(e.touches.length===1){ twoStart=Date.now(); }
      else if(e.touches.length===2){ if(Date.now()-twoStart<=TWO_DOWN_MS) cb(); }
    },{passive:true});
  }

  function onTwoFingerTap(cb){
    let twoDown=false,startTime=0;
    document.body.addEventListener('touchstart',e=>{
      if(e.touches.length===2){ twoDown=true; startTime=Date.now(); }
    },{passive:true});
    document.body.addEventListener('touchend',e=>{
      if(twoDown && e.touches.length===0){
        const dur=Date.now()-startTime;
        if(dur<250) cb();
        twoDown=false;
      }
    },{passive:true});
  }

  return { onSwipe, onDoubleTap, onTwoFingerDown, onTwoFingerTap };
})();
