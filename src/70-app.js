/* =====================================================================
 *  70—camera, input, picking, and the interface
 * ===================================================================== */
'use strict';

const App = (()=>{

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---- which parts get a floating label ---- */
const PIN_IDS = ['royalStoa','solomons','antonia','sanctuary','altar','women',
                 'nicanor','soreg','southSteps','robinson','shushan','huldah',
                 'northPortico','westPortico','porch','kidron'];

/* ================================================================== *
 *  state
 * ================================================================== */
/* THERE IS ONE CAMERA, AND IT ORBITS. There was a walking mode too—feet on
   W A S D, gravity, an eye locked to the ground—and it went, because on a
   touch screen it was a trap: the feet are keys a phone has not got, all a
   finger could do standing on the pavement was turn on the spot, and the
   double tap it takes to try for anything more is the browser's own page zoom,
   which magnifies the whole canvas with no gesture inside it that undoes it.
   On a desktop it was a debugging convenience, and the orbit does that job now
   that the pivot pushes forward at the near limit rather than stopping dead.

   What survives is the eye HEIGHT, because half the guide's viewpoints stand
   on the pavement rather than looking down at it: standing eye level for the
   1.70 m mean stature the figures are built to. */
const STAND_EYE = 1.62;

const S = {
  target:[150,10,240], dist:700, yaw:-2.42, pitch:0.62,
  fov:55,
  hour:10.0,
  time:0, timePin:null,      /* seconds; timePin freezes it for screenshots */
  layers:{ base:true, roofs:true, people:true, city:true, sanct:true,
           interior:false, overlay:false, grid:false },
  section:false,
  labels:true,
  fire:true,
  ui:true,
  selected:null,
  flight:null,
  passageIdx:-1,
  tab:'passages',
  keys:new Set(),
  view:M4.create(),
  clip:new Float32Array(4),
};

let R = null, scene = null, parts = [], partById = new Map();

/* ================================================================== *
 *  camera maths
 * ================================================================== */
function forwardOf(yaw,pitch){
  const cp=Math.cos(pitch);
  return [ Math.sin(yaw)*cp, -Math.sin(pitch), Math.cos(yaw)*cp ];
}
function camEye(){
  const f=forwardOf(S.yaw,S.pitch);
  return [ S.target[0]-f[0]*S.dist, S.target[1]-f[1]*S.dist, S.target[2]-f[2]*S.dist ];
}
function camForward(){ return forwardOf(S.yaw,S.pitch); }
function buildView(){
  const eye=camEye(), f=camForward();
  M4.lookAt(S.view, eye, [eye[0]+f[0],eye[1]+f[1],eye[2]+f[2]], [0,1,0]);
  return eye;
}
/* Orbiting in and out. Shrinking the arm alone stops dead at the near limit,
   half-way into whatever you were heading for, with the wheel doing nothing—
   so once the arm is as short as it goes the PIVOT moves forward instead, and
   scrolling on carries you through and past. Going the other way the arm just
   grows, which is what pulling back means. */
const DIST_MIN = 5.0;
/* Once the pivot is doing the moving, the residual it is moved by is what is
   LEFT of a geometric step off a five-meter arm—0.6 m for a notch of the
   wheel. Coming in from a wide view that notch was worth eighty meters, so the
   moment the arm bottomed out the whole thing appeared to stop dead, and
   crossing a colonnade took forty notches. The residual is still proportional
   to how hard you scrolled, so it only wants a gain: four puts the pace at what
   a geometric step off a twenty-meter arm would have given, which is about the
   speed you want for moving through the building rather than at it. */
const PUSH_GAIN = 4.0;
function dolly(k){
  const want = S.dist*k;
  if(want < DIST_MIN){
    const f = forwardOf(S.yaw, S.pitch);
    const step = (DIST_MIN - want) * PUSH_GAIN;
    S.target = [S.target[0]+f[0]*step, S.target[1]+f[1]*step, S.target[2]+f[2]*step];
    S.dist = DIST_MIN;
  } else {
    S.dist = Math.min(want, 2400);
  }
}

/* yaw/pitch that look from `eye` at `at` */
function aimAt(eye,at){
  const d=V3.norm(V3.sub(at,eye));
  return { yaw:Math.atan2(d[0],d[2]), pitch:Math.asin(clamp(-d[1],-1,1)) };
}

/* ---- resolve a spec's anchor: {L:[xCubits,zCubits,y]} or {W:[x,y,z]} ---- */
function anchor(a){
  if(!a) return [150,10,240];
  if(a.W) return a.W.slice();
  const w = precinctToWorld(a.L[0], a.L[1]);
  return [ w[0], a.L[2]===undefined?0:a.L[2], w[1] ];
}

/* ---- turn a viewpoint spec into a camera state ---- *
 *  Two kinds of viewpoint. `mode:'stand'` is an eye ON THE PAVEMENT at a
 *  visitor's height, given as a place to stand and a thing to look at; anything
 *  else is a target, an arm and a compass bearing, looked at from outside.
 *  Both come out as the same orbit camera—standing views put the pivot down
 *  the line of sight, at whatever they were looking at, so the first drag turns
 *  the head rather than swinging the model round something behind you.        */
function resolveView(v){
  const out={ fov:v.fov||55 };
  /* only carry `section` when the spec actually states it, so a viewpoint
     that says nothing about it leaves the current setting alone */
  if('section' in v) out.section = !!v.section;
  if(v.mode==='stand'){
    const p=anchor(v.pos);
    const eye=[p[0], floorAt(p[0],p[2]) + STAND_EYE, p[2]];
    const look=anchor(v.lookAt);
    const a=aimAt(eye,look);
    out.yaw=a.yaw; out.pitch=a.pitch;
    out.dist=clamp(V3.dist(eye,look), 14, 220);
    const f=forwardOf(a.yaw,a.pitch);
    out.target=[eye[0]+f[0]*out.dist, eye[1]+f[1]*out.dist, eye[2]+f[2]*out.dist];
  } else {
    const t=anchor(v.target);
    out.target=t; out.dist=v.dist||200;
    out.pitch=v.pitch===undefined?0.3:v.pitch;
    /* azimuth: compass bearing from the target out to the camera */
    const az=(v.azimuth===undefined?135:v.azimuth)*DEG;
    out.yaw = Math.atan2(-Math.sin(az), Math.cos(az));
  }
  return out;
}

/* ================================================================== *
 *  where the floor is—defined in 55-build-temple.js, because the crowd
 *  placement needs the same answer a standing viewpoint gets. One function, or
 *  the figures end up standing above the ground.
 * ================================================================== */
const floorAt = groundHeightAt;

/* ================================================================== *
 *  flights
 * ================================================================== */
function flyTo(v, ms){
  const g=resolveView(v);
  const eyeNow=camEye(), fNow=camForward();
  const lookNow=[eyeNow[0]+fNow[0]*40, eyeNow[1]+fNow[1]*40, eyeNow[2]+fNow[2]*40];
  /* work in eye + look-point space: the arm and the pivot are not what the
     move looks like, and a short arm swinging to a long one is not a flight */
  const f=forwardOf(g.yaw,g.pitch);
  const eyeTo=[g.target[0]-f[0]*g.dist, g.target[1]-f[1]*g.dist, g.target[2]-f[2]*g.dist];
  const lookTo=g.target.slice();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = reduce ? 1
            : (ms===undefined ? clamp(680 + V3.dist(eyeNow,eyeTo)*1.5, 700, 2500) : ms);
  S.flight = { t:0, dur, eye0:eyeNow, eye1:eyeTo, look0:lookNow, look1:lookTo,
               fov0:S.fov, fov1:g.fov, goal:g,
               /* arc up a little on long moves so we don't clip through walls */
               lift: clamp(V3.dist(eyeNow,eyeTo)*0.10, 0, 70) };
  if(g.section!==undefined) setSection(g.section);
}
function stepFlight(dt){
  const F=S.flight; if(!F) return;
  F.t += dt;
  const k = clamp(F.t/F.dur,0,1), e = easeInOut(k);
  const eye=V3.lerp(F.eye0,F.eye1,e);
  eye[1] += Math.sin(k*Math.PI)*F.lift;
  const look=V3.lerp(F.look0,F.look1,e);
  S.fov = lerp(F.fov0,F.fov1,e);
  const a=aimAt(eye,look);
  S.yaw=a.yaw; S.pitch=a.pitch;
  S.dist=V3.dist(eye,look);
  S.target=look;
  if(k>=1){
    S.target=F.goal.target.slice();
    S.dist=F.goal.dist; S.yaw=F.goal.yaw; S.pitch=F.goal.pitch;
    S.fov=F.goal.fov;
    S.flight=null;
  }
}

/* ================================================================== *
 *  input
 * ================================================================== */
const ARROWS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
/* The arrows drive the camera, except while the passage guide is on screen to
   be stepped—with the interface up they belong to it. */
const arrowsNavigate = () => !S.ui;

/* ------------------------------------------------------------------ *
 *  ONE GESTURE HANDLER, NOT TWO.
 *
 *  The drag and the pinch used to be two independent pairs of listeners on the
 *  same canvas, each keeping its own idea of what the hand was doing, and the
 *  second finger landing was enough to break both. `pointerdown` fires once per
 *  finger, so the second one OVERWROTE the drag's anchor with its own position
 *—and the next move of the FIRST finger was then read as a drag of the
 *  whole distance between the two. Two hundred pixels of separation is 0.84
 *  radians of yaw, so a pinch began by throwing the view most of a right angle
 *  sideways, every time. The pinch handler did clear the drag, but only on the
 *  first MOVE, which is one frame too late.
 *
 *  So: one map of live pointers, and the count decides. One is a drag, two are
 *  a gesture, and the transition between them re-anchors rather than carrying
 *  a stale one over.
 * ------------------------------------------------------------------ */
function initInput(){
  const cv=$('#gl');
  const pts=new Map();          // every pointer currently down on the canvas
  let drag=null;                // one finger, or the mouse
  let gest=null;                // two fingers: their spread and their midpoint

  /* the spread and midpoint of the first two pointers down */
  const twoUp = ()=>{
    const [a,b]=[...pts.values()];
    return { d:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])),
             x:(a[0]+b[0])/2, y:(a[1]+b[1])/2 };
  };
  const anchor = e=>({ x:e.clientX, y:e.clientY, btn:e.button, moved:0,
                       id:e.pointerId, t0:performance.now(),
                       sx:e.clientX, sy:e.clientY });

  /* Slide the pivot across the screen—the right button, shift-drag, and a
     two-finger drag all mean this. */
  const slide = (dx,dy)=>{
    const f=forwardOf(S.yaw,S.pitch);
    const right=V3.norm(V3.cross([0,1,0],f));
    const up=V3.norm(V3.cross(f,right));
    const k=S.dist*0.0016;
    S.target=V3.add(S.target, V3.add(V3.scale(right,-dx*k), V3.scale(up,dy*k)));
  };

  const pointerDown = e=>{
    /* Capture is an optimisation, not the state. It throws NotFoundError for a
       pointer the browser does not think is down, and thrown from the first
       line it took the whole gesture with it: the pointer never reached `pts`,
       so a second finger was invisible and the pinch went back to being a drag
       of the distance between the two. */
    try{ cv.setPointerCapture?.(e.pointerId); }catch(err){}
    pts.set(e.pointerId,[e.clientX,e.clientY]);
    S.flight=null;
    if(pts.size===1){ drag=anchor(e); gest=null; }
    else { drag=null; if(pts.size===2) gest=twoUp(); }   // no stale anchor
  };
  const pointerMove = e=>{
    if(!pts.has(e.pointerId)) return;
    pts.set(e.pointerId,[e.clientX,e.clientY]);

    if(pts.size>=2){
      if(!gest){ gest=twoUp(); return; }
      const g=twoUp();
      /* apart and together is the zoom; the midpoint carries the pan, so the
         two work in the same gesture the way they do everywhere else.

         THROUGH `dolly`, WHICH IS WHERE THE WHEEL GOES TOO. Shrinking the arm
         on its own is not zooming in, it is winding a five-meter arm shorter
         and shorter, and at the limit the fingers stopped doing anything at
         all: on a phone you could pinch your way down to the middle of the
         platform and not one pixel further toward the Antonia, because the arm
         was already as short as it goes and nothing was moving the pivot. */
      dolly(gest.d/g.d);
      slide(g.x-gest.x, g.y-gest.y);
      gest=g;
      return;
    }
    if(!drag || e.pointerId!==drag.id) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    drag.x=e.clientX; drag.y=e.clientY;
    drag.moved += Math.abs(dx)+Math.abs(dy);
    if(drag.btn===2 || e.shiftKey){ slide(dx,dy); return; }
    S.yaw   -= dx*0.0042;
    S.pitch  = clamp(S.pitch - dy*0.0038, -1.4, 1.48);
  };
  /* A tap is the pointer that came down alone, moved almost nowhere, and left
     before anything else touched the glass. Lifting one finger of a pinch
     re-anchors the other rather than ending the gesture, so the hand can carry
     on turning the model without letting go and starting again. */
  const pointerLift = e=>{
    const was=pts.size;
    pts.delete(e.pointerId);
    if(pts.size<2) gest=null;
    if(was===1 && drag && e.pointerId===drag.id &&
       drag.moved<7 && performance.now()-drag.t0 < 450 && drag.btn!==2)
      pick(drag.sx, drag.sy);
    if(pts.size===1){
      const [id,p]=[...pts.entries()][0];
      drag={ x:p[0], y:p[1], btn:0, moved:99, id, t0:0, sx:p[0], sy:p[1] };
    } else if(pts.size===0) drag=null;
  };
  cv.addEventListener('pointerdown', pointerDown);
  cv.addEventListener('pointermove', pointerMove);
  cv.addEventListener('pointerup',   pointerLift);
  cv.addEventListener('pointercancel', pointerLift);
  cv.addEventListener('contextmenu', e=>e.preventDefault());

  /* A NEW WINDOW IS A NEW QUESTION about how many pixels the frame is worth:
     a phone turned to landscape, or a desktop window pulled small, may well
     afford the resolution the governor took away, so it measures again from
     the top rather than living with what the old window settled on.

     ON WIDTH, THOUGH, NOT ON THE EVENT. A phone fires `resize` every time the
     address bar slides in or out, which changes the height by a tenth and the
     width by nothing; taken at face value, a couple of swipes would reset the
     governor repeatedly and it would spend its life walking back down. */
  addEventListener('resize', ()=>{ if(cv.clientWidth !== R.cssW) R.resetScale(); });

  cv.addEventListener('wheel', e=>{
    e.preventDefault();
    S.flight=null;
    dolly(Math.exp(clamp(e.deltaY,-220,220)*0.0013));
  }, {passive:false});

  /* MODIFIERS COME OFF THE EVENT, not off their own keyup. Ctrl with an arrow
     can hand focus to the browser or the window manager, and then the keyup for
     Control never arrives—so 'control' stayed in the set for good and left and
     right strafed for ever after, with no way to turn. Every keyboard event
     carries the true modifier state, so every keyboard event corrects it. */
  const syncMods = e => {
    for(const [k,on] of [['control',e.ctrlKey||e.metaKey],['shift',e.shiftKey]])
      if(on) S.keys.add(k); else S.keys.delete(k);
  };
  addEventListener('keydown', e=>{
    if(e.target.tagName==='INPUT') return;
    const k=e.key.toLowerCase();
    S.keys.add(k);
    syncMods(e);
    if(k==='r'){ $('#tRoofs').click(); }
    else if(k==='x'){ $('#tSection').click(); }
    else if(k==='p'){ $('#tPeople').click(); }
    else if(k==='c'){ $('#tCity').click(); }
    else if(k==='l'){ $('#tLabels').click(); }
    else if(k==='q'){ $('#tSquare').click(); }
    else if(k==='g'){ $('#tGrid').click(); }
    else if(k==='f'){ $('#tFire').click(); }
    else if(k==='h'){ App.setUI(!S.ui); }
    else if(k==='v'){ copyView(); }
    else if(k==='escape'){ closeInfo(); }
    /* The arrows are movement keys, held down and read by stepOrbit. They only
       step the passage guide where it is on screen to be stepped: with the
       interface up. With it hidden—the default—there is nothing to page
       through, so they navigate instead. */
    else if(ARROWS.has(e.key)){
      e.preventDefault();
      if(arrowsNavigate()) S.flight=null;
      else if(e.key==='ArrowRight') gotoPassage(S.passageIdx+1);
      else if(e.key==='ArrowLeft')  gotoPassage(S.passageIdx-1);
    }
  });
  addEventListener('keyup', e=>{ S.keys.delete(e.key.toLowerCase()); syncMods(e); });
  addEventListener('blur', ()=>S.keys.clear());
}

/* The arrows do what dragging does—swing the camera round the subject and
   raise or lower it—and with Ctrl held, what the wheel does: in and out.
   Eased over about a tenth of a second, or every press is a jolt. Dollying is
   exponential, like the wheel, so a step covers the same fraction of the
   distance whether you are across the valley or in the porch. */
const orbVel = [0,0,0,0];
function stepOrbit(dt){
  if(S.flight || !arrowsNavigate()){
    orbVel[0]=orbVel[1]=orbVel[2]=orbVel[3]=0; return;
  }
  const K=S.keys, h=dt/1000;
  const ctrl = K.has('control');
  let ax=0, ay=0, az=0, sx=0;
  if(K.has('arrowleft'))  { if(ctrl) sx-=1; else ax-=1; }
  if(K.has('arrowright')) { if(ctrl) sx+=1; else ax+=1; }
  if(K.has('arrowup'))    { if(ctrl) az-=1; else ay+=1; }
  if(K.has('arrowdown'))  { if(ctrl) az+=1; else ay-=1; }
  const spd = K.has('shift') ? 2.3 : 0.85;
  const kv = clamp(h/0.10, 0, 1);
  orbVel[0] = lerp(orbVel[0], ax*spd, kv);
  orbVel[1] = lerp(orbVel[1], ay*spd*0.8, kv);
  orbVel[2] = lerp(orbVel[2], az*spd*1.1, kv);
  orbVel[3] = lerp(orbVel[3], sx*spd, kv);
  S.yaw  += orbVel[0]*h;
  S.pitch = clamp(S.pitch + orbVel[1]*h, -1.4, 1.48);
  if(orbVel[2]) dolly(Math.exp(orbVel[2]*h));
  /* STRAFE, with Ctrl and left or right: the pivot slides along the camera's
     own right, level, so the view tracks sideways instead of swinging round.
     Scaled by the arm like the dolly is, or it crawls across the valley and
     tears past inside the porch. `right` is cross(forward, up) with up +Y,
     which in this frame (+X east, +Z south) is (-f.z, 0, f.x). */
  if(orbVel[3]){
    const f = forwardOf(S.yaw, S.pitch);
    const rl = Math.hypot(f[2], f[0]) || 1;
    const step = orbVel[3]*h*S.dist*0.62;
    S.target = [ S.target[0] + (-f[2]/rl)*step, S.target[1],
                 S.target[2] + ( f[0]/rl)*step ];
  }
}

/* ================================================================== *
 *  picking
 * ================================================================== */
function rayFromScreen(sx,sy){
  const cv=$('#gl'), rc=cv.getBoundingClientRect();
  const nx=((sx-rc.left)/rc.width)*2-1;
  const ny=1-((sy-rc.top)/rc.height)*2;
  const inv=M4.invert(M4.create(), R.vp);
  const a=M4.xformPoint(inv,nx,ny,-1,[0,0,0]);
  const b=M4.xformPoint(inv,nx,ny, 1,[0,0,0]);
  return { o:a, d:V3.norm(V3.sub(b,a)) };
}
function rayAabb(o,d,min,max){
  let t0=-1e9, t1=1e9;
  for(let i=0;i<3;i++){
    if(Math.abs(d[i])<1e-8){ if(o[i]<min[i]||o[i]>max[i]) return null; continue; }
    let ta=(min[i]-o[i])/d[i], tb=(max[i]-o[i])/d[i];
    if(ta>tb){ const s=ta; ta=tb; tb=s; }
    t0=Math.max(t0,ta); t1=Math.min(t1,tb);
    if(t0>t1) return null;
  }
  return t1<0 ? null : Math.max(t0,0);
}
function pick(sx,sy){
  /* With the interface hidden there is nowhere for the answer to go: the
     panel is chrome and is hidden with it, so all a click could do is put a
     wireframe box round something and leave it there. Nothing, then. */
  if(!S.ui) return;
  const {o,d}=rayFromScreen(sx,sy);
  const hits=[];
  for(const p of parts){
    if(!partVisible(p)) continue;
    const t=rayAabb(o,d,p.min,p.max);
    if(t!==null) hits.push({p,t});
  }
  if(!hits.length){ closeInfo(); select(null); return; }
  hits.sort((a,b)=>a.t-b.t);
  const near=hits[0].t;
  /* prefer the most specific thing the ray actually goes through, among
     those it reaches at roughly the same depth */
  const cand=hits.filter(h=>h.t < near+70);
  cand.sort((a,b)=>a.p.extent-b.p.extent);
  select(cand[0].p);
}
function partVisible(p){
  if(p.id==='square') return S.layers.overlay;
  /* the two innermost rooms are only there to be found when cut open */
  if(p.id==='debir' || p.id==='hekhal') return S.section;
  if(p.id==='street' || p.id==='wilson') return S.layers.city;
  return true;
}

function select(p, box){
  S.selected = p;
  /* Picking something is leaving the passage you were on, and the address bar
     says one or the other. `gotoPassage` sets its index back afterwards. */
  if(p){ S.passageIdx = -1; syncPassageList(); }
  /* the wireframe helps when you have just clicked something; on a passage
     it only gets in the way of the view it is meant to be showing */
  R.setSelection((p && box!==false) ? [p.min,p.max] : null);
  if(p) showInfo(p.key||p.id, p.name);
  syncPlanList();
}

/* ================================================================== *
 *  info card
 * ================================================================== */
/* `note` is the passage guide's reading of the place, which is what the list
   used to carry under every entry. It goes at the head of the card, above the
   place's own description, because it is why you are looking. */
function showInfo(key, fallbackName, note){
  const d = INFO[key];
  const box=$('#info');
  const nh = note ? `<div class="pnote">${note}</div>` : '';
  if(!d){
    if(!fallbackName){ closeInfo(); return; }
    $('#infoTitle').textContent=fallbackName;
    $('#infoKind').textContent='';
    $('#infoBody').innerHTML=nh+'<p>Part of the reconstruction. Nothing further is recorded of it in the sources used here.</p>';
    $('#infoBody').scrollTop=0;
    openInfo(box);
    return;
  }
  $('#infoTitle').textContent=d.n;
  $('#infoKind').textContent=d.k||'';
  let h=nh+d.d;
  if(d.t){
    h+='<table class="dims"><tr><th>Dimension</th><th></th></tr>';
    for(const [a,b] of d.t) h+=`<tr><td>${a}</td><td>${b}</td></tr>`;
    h+='</table>';
  }
  if(d.s) h+=`<span class="cite">${d.s}</span>`;
  $('#infoBody').innerHTML=h;
  $('#infoBody').scrollTop=0;
  openInfo(box);
}
/* On a phone the card is the sheet, and it stands in the rail's place while
   it is up: one panel on the screen, never two. It arrives at half, which
   shows the head and the opening of the description with the model still
   above it—the card is answering a question about something you are looking
   at, so the something has to stay in view. */
function openInfo(box){
  box.classList.add('on');
  if(PHONE.matches){
    document.body.classList.add('sheetInfo');
    setDetent(box,'half');
    sheetMeasure(box);
  }
}
function closeInfo(){
  $('#info').classList.remove('on');
  document.body.classList.remove('sheetInfo');
}

/* ================================================================== *
 *  layers & the section plane
 * ================================================================== */
function setSection(on){
  S.section=on;
  S.layers.interior=on;
  $('#tSection').checked=on;
  const N=[V_SOUTH[0],0,V_SOUTH[1]];
  const P=precinctToWorld(100, AXIS_Z);
  S.clip[0]=N[0]; S.clip[1]=0; S.clip[2]=N[2];
  S.clip[3]=-(N[0]*P[0]+N[2]*P[1]);
}
function layerOn(l){
  if(l==='nodraw')   return false;      // pickable volumes with no geometry
  if(l==='interior') return S.section;
  if(l==='overlay')  return S.layers.overlay;
  if(l==='grid')     return S.layers.grid;
  if(l==='roofs')    return S.layers.roofs;
  if(l==='people')   return S.layers.people;
  if(l==='city')     return S.layers.city;
  return true;
}

/* ================================================================== *
 *  the passage guide
 * ================================================================== */
const CONF = {
  explicit:['c-explicit','the text names this place'],
  probable:['c-probable','narrowed by the architecture'],
  court   :['c-court',   'the text names only the temple'],
  disputed:['c-disputed','serious alternatives exist'],
};
/* THE LIST IS AN INDEX, NOT THE READING. Forty passages each carrying a
   paragraph made a column you scrolled rather than scanned, and the one thing
   you go to it for—which scene, and where in the Gospels—was buried in the
   middle of it. Reference and title only; the note and the confidence it is
   pitched at go onto the info card, beside the place they are about, where
   there is room for them and where you are already looking. */
function buildPassageList(){
  const box=$('#passageList');
  box.innerHTML='';
  PASSAGES.forEach((t,i)=>{
    const [cls,tip]=CONF[t.conf]||CONF.court;
    const b=document.createElement('button');
    b.className='passage';
    b.innerHTML=`<span class="ref"><i class="${cls}" title="${tip}"></i>${t.ref}</span>`+
                `<span class="t">${t.t}</span>`;
    b.onclick=()=>gotoPassage(i);
    box.appendChild(b);
  });
}
function syncPassageList(){
  $$('#passageList .passage').forEach((b,k)=>b.classList.toggle('active',k===S.passageIdx));
}
/* One place per passage, taken from the structure index rather than from a
   camera of its own: the framing is then the same one the Plan gives, and a
   passage cannot drift away from the thing it names. */
function gotoPassage(i){
  if(i<0) i=PASSAGES.length-1;
  if(i>=PASSAGES.length) i=0;
  const p=PASSAGES[i];
  /* A viewpoint of its own if the passage or its place has one, and only then
     the bounding-box orbit `goToKey` falls back on—which for a 463 m porch
     put you 800 m up looking at a hairline. The panel and the selection still
     come from the place either way. */
  const v = p.cam || PLACE_VIEWS[p.place];
  if(v){
    ensureLayersFor(p.place);
    /* NO SELECTION BOX. The camera is the answer to where a passage happened;
       a wireframe cage round a 463 m porch, drawn while you are standing inside
       it, only tells you the part's bounding box. The plan index still boxes
       what you pick there—that is what a pick is for. */
    select(null);
    flyTo(v);
  } else goToKey(p.place);
  /* The card LAST. `goToKey` opens the place's own entry on its way past, and
     the passage is a reading of that place, so it goes on top of it—and
     `select` has just cleared the passage the list was on, which is right when
     you pick a part and wrong when the pick came from here. */
  const [cls,tip]=CONF[p.conf]||CONF.court;
  showInfo(p.place, p.t,
    `<span class="pcf"><i class="${cls}"></i>${tip}</span>`+
    `<b>${p.ref}</b>&mdash;${p.d}`);
  S.passageIdx=i;
  syncPassageList();
  const el=$$('#passageList .passage')[i];
  if(el) el.scrollIntoView({block:'nearest',behavior:'smooth'});
}

/* ================================================================== *
 *  the structure index
 * ================================================================== */
function buildPlanList(){
  const box=$('#planList'); box.innerHTML='';
  for(const g of PLAN_GROUPS){
    const z=document.createElement('div'); z.className='zone';
    z.innerHTML=`<div class="zh">${g.h}</div>`;
    for(const [key,label] of g.items){
      const b=document.createElement('button');
      b.className='item'; b.dataset.key=key;
      b.innerHTML=`<span class="n" aria-hidden="true"></span><span>${label}</span>`;
      b.onclick=()=>goToKey(key);
      z.appendChild(b);
    }
    box.appendChild(z);
  }
}
function syncPlanList(){
  const k=S.selected?(S.selected.key||S.selected.id):null;
  $$('#planList .item').forEach(b=>b.classList.toggle('active', b.dataset.key===k));
}
/* Some places are invisible unless their layer is on, and both the plan index
   and the passage guide can send you to one. Shared, or a passage placed at a
   tunnel gate flies you to an empty hillside. */
function ensureLayersFor(key){
  if(key==='square' && !S.layers.overlay) $('#tSquare').click();
  if((key==='street'||key==='wilson'||key==='barclay'||key==='warren') &&
     !S.layers.city) $('#tCity').click();
}
function goToKey(key){
  showInfo(key);
  ensureLayersFor(key);
  const p=parts.find(q=>q.key===key) || parts.find(q=>q.id===key);
  if(p){
    select(p);
    if(key==='hekhal'||key==='debir') setSection(true);
    const r=Math.max(p.size[0],p.size[1],p.size[2]);
    const az = (key==='sanctuary'||key==='porch'||key==='hekhal'||key==='debir'||
                key==='altar'||key==='nicanor'||key==='women') ? 100 : 135;
    flyTo({ mode:'orbit', target:{W:p.center}, dist:clamp(r*1.75,26,900),
            pitch:key==='hekhal'||key==='debir'?0.05:0.26, azimuth:az,
            fov:55, section:(key==='hekhal'||key==='debir') });
  }
}

/* ================================================================== *
 *  labels
 * ================================================================== */
let pinEls=new Map();
function buildPins(){
  const host=$('#pins'); host.innerHTML=''; pinEls.clear();
  for(const id of PIN_IDS){
    const p=parts.find(q=>q.id===id);
    if(!p) continue;
    const el=document.createElement('button');
    el.className='pin'; el.textContent=p.name;
    el.onclick=()=>{ select(p); showInfo(p.key||p.id,p.name); };
    host.appendChild(el);
    pinEls.set(id,{el,p,w:0});
  }
}
function updatePins(){
  const host=$('#pins');
  if(!S.labels || !S.ui){ host.style.display='none'; return; }
  host.style.display='';
  /* the canvas box, as the renderer already measured it at the top of the
     frame. getBoundingClientRect here was a second forced layout for a number
     that had just been read. */
  const rcw=R.cssW, rch=R.cssH;
  const eye=camEye();
  /* project everything first, then place nearest-first and drop any label
     that would collide with one already placed—otherwise the middle of
     the model turns into a pile of overlapping text */
  const cand=[];
  for(const e of pinEls.values()){
    const {el,p}=e, a=p.at;
    const w = R.vp[3]*a[0]+R.vp[7]*a[1]+R.vp[11]*a[2]+R.vp[15];
    if(w<=0.1){ el.style.display='none'; continue; }
    const cl=M4.xformPoint(R.vp,a[0],a[1],a[2],[0,0,0]);
    const x=(cl[0]*0.5+0.5)*rcw, y=(1-(cl[1]*0.5+0.5))*rch;
    const d=V3.dist(eye,a);
    /* No depth buffer read, so a distant label can float over near
       geometry. Dropping anything well behind the focus removes most of it. */
    const far = S.dist*2.1 + 60;
    if(x<-90||y<-40||x>rcw+90||y>rch+40||d>Math.min(1500,far)){
      el.style.display='none'; continue;
    }
    cand.push({e,el,p,x,y,d});
  }
  cand.sort((a,b)=>a.d-b.d);
  const taken=[];
  for(const c of cand){
    /* A LABEL'S WIDTH IS A PROPERTY OF ITS TEXT, and its text never changes.
       Read fresh every frame, this was an offsetWidth interleaved with the
       style writes below it—so the browser re-laid-out the whole overlay
       once per label per frame, forty times over, for a number that was the
       same forty times. Measured the first time the label is on screen, where
       offsetWidth means something, and kept. */
    if(!c.e.w) c.e.w = Math.max(46, c.el.offsetWidth || c.p.name.length*6.4+18);
    const wid = c.e.w;
    const box=[c.x-wid/2-3, c.y-30, c.x+wid/2+3, c.y-2];
    let clash=false;
    for(const t of taken)
      if(box[0]<t[2] && box[2]>t[0] && box[1]<t[3] && box[3]>t[1]){ clash=true; break; }
    if(clash && c.p.id!==(S.selected&&S.selected.id)){ c.el.style.display='none'; continue; }
    taken.push(box);
    c.el.style.display='';
    c.el.style.left=c.x+'px';
    c.el.style.top=(c.y-8)+'px';
    c.el.classList.toggle('dim', c.d>560);
  }
}

/* ================================================================== *
 *  HUD
 * ================================================================== */
function updateHud(){
  $('#needle').style.transform=`rotate(${S.yaw*180/Math.PI+180}deg)`;
  /* scale bar */
  const h=R.cssH||1;                        // measured once, in Renderer.resize
  const mPerPx = 2*S.dist*Math.tan(S.fov*DEG/2)/h;
  const targetPx=104;
  let m = mPerPx*targetPx;
  const pow=Math.pow(10,Math.floor(Math.log10(m)));
  const mant=m/pow;
  m = (mant<1.6?1:mant<3.5?2:mant<7.5?5:10)*pow;
  const px=m/mPerPx;
  $('#scaleTrack').style.width=px.toFixed(0)+'px';
  $('#scaleLabel').textContent = m>=1000 ? (m/1000)+' km'
                               : m>=1 ? m+' m'
                               : (m*100).toFixed(0)+' cm';
}

/* ================================================================== *
 *  the bottom sheet (phones)
 * ================================================================== */
/* Below 700px the rail and the info card are the same object: a sheet on
   the bottom edge with three heights—the head alone, half the screen, and
   nearly all of it. The heights are in the stylesheet; this names one,
   drags between them, and snaps to whichever is nearest on release.

   `--peek` is the measured head written back to the element, because the
   resting height is exactly the head and CSS cannot transition to `auto`. */
const PHONE = matchMedia('(max-width:700px)');
const DETENTS = ['peek','half','full'];

function sheetHead(el){
  const grab = el.querySelector('.grab');
  const bar  = el.querySelector('.tabs') || el.querySelector('.ih');
  return grab.offsetHeight + (bar ? bar.offsetHeight : 0);
}
function sheetMeasure(el){
  if(PHONE.matches) el.style.setProperty('--peek', sheetHead(el)+'px');
}
function setDetent(el, name){
  el.dataset.detent = name;
  el.classList.remove('d-half','d-full');
  if(name !== 'peek') el.classList.add('d-'+name);
}
/* a press on the handle that never became a drag steps up, and wraps */
function stepSheet(el){
  const i = DETENTS.indexOf(el.dataset.detent || 'peek');
  setDetent(el, DETENTS[(i+1) % DETENTS.length]);
}

function initSheet(el){
  const grab = el.querySelector('.grab');
  let id=null, y0=0, h0=0, cur=0, moved=false;

  grab.addEventListener('pointerdown', e=>{
    if(!PHONE.matches) return;
    id=e.pointerId; grab.setPointerCapture(id);
    y0=e.clientY; h0=cur=el.getBoundingClientRect().height; moved=false;
    el.classList.add('dragging');
    e.preventDefault();
  });
  grab.addEventListener('pointermove', e=>{
    if(e.pointerId!==id) return;
    const dy = y0 - e.clientY;                 /* up is taller */
    if(Math.abs(dy) > 4) moved=true;
    cur = clamp(h0+dy, sheetHead(el), innerHeight*0.92);
    el.style.height = cur+'px';
  });
  const end = e=>{
    if(e.pointerId!==id) return;
    grab.releasePointerCapture(id); id=null;
    el.classList.remove('dragging');
    el.style.height='';
    if(!moved){ stepSheet(el); return; }
    const px = {peek:sheetHead(el), half:innerHeight*.5, full:innerHeight*.92};
    let best='peek';
    for(const k of DETENTS)
      if(Math.abs(px[k]-cur) < Math.abs(px[best]-cur)) best=k;
    setDetent(el, best);
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);

  setDetent(el, 'peek');
  sheetMeasure(el);
}

function initSheets(){
  const rail=$('#rail'), info=$('#info');
  initSheet(rail); initSheet(info);
  const remeasure=()=>{
    sheetMeasure(rail);
    if(info.classList.contains('on')) sheetMeasure(info);
  };
  addEventListener('resize', remeasure);
  PHONE.addEventListener('change', remeasure);
}

/* ================================================================== *
 *  interface wiring
 * ================================================================== */
/* Which page of the rail is open is part of where you are: Passages and Plan
   are two ways of asking the model a question and a shared link has to arrive
   on the one that was asked. */
function setTab(name){
  const b=$$('#rail .tabs button').find(o=>o.dataset.tab===name);
  if(!b) return;
  S.tab=name;
  $$('#rail .tabs button').forEach(o=>o.setAttribute('aria-selected', o===b));
  $$('.tabpage').forEach(p=>p.classList.toggle('on', p.id==='tab-'+name));
}
/* Set a checkbox to a value rather than toggling it. The deep links used to
   `.click()`, which says "the other one" and is only the same thing as "off"
   for as long as everything defaults to on. */
function setTog(id, on){
  const el=$('#'+id);
  if(!el || el.checked===on) return;
  el.checked=on;
  el.dispatchEvent(new Event('change'));
}

function initUI(){
  $('#srcBody').innerHTML = SOURCES_HTML;
  buildPassageList(); buildPlanList();

  /* On a phone the tab strip is also the sheet's grip: reaching for a tab
     while the sheet is down is a request to see that tab, so it comes up.
     Tapping the tab already open is the way back down. */
  $$('#rail .tabs button').forEach(b=>{
    b.onclick=()=>{
      const same = S.tab===b.dataset.tab;
      setTab(b.dataset.tab);
      if(!PHONE.matches) return;
      const r=$('#rail'), at=r.dataset.detent||'peek';
      if(same)             setDetent(r, at==='peek' ? 'half' : 'peek');
      else if(at==='peek') setDetent(r, 'half');
    };
  });

  $('#infoClose').onclick=closeInfo;

  const tog=(id,fn)=>{ const el=$('#'+id); el.onchange=()=>fn(el.checked); };
  tog('tRoofs',   v=>S.layers.roofs=v);
  tog('tPeople',  v=>S.layers.people=v);
  tog('tCity',    v=>S.layers.city=v);
  tog('tLabels',  v=>S.labels=v);
  tog('tFire',    v=>S.fire=v);
  tog('tSquare',  v=>S.layers.overlay=v);
  tog('tGrid',    v=>S.layers.grid=v);
  tog('tSection', v=>setSection(v));

  $('#sSun').oninput=e=>{
    S.hour=parseFloat(e.target.value);
    const hh=Math.floor(S.hour), mm=Math.round((S.hour-hh)*60);
    $('#sunOut').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };

  $('#bReset').onclick=()=>{
    setSection(false); closeInfo(); select(null);
    flyTo(VIEWS.aerial);
  };
  const setUI = on => {
    document.body.classList.toggle('uiHidden', !on);
    S.ui = on;
    /* and take the wireframe with it—the panel it belongs to is gone */
    if(!on) select(null);
  };
  $('#bHide').onclick=()=>setUI(false);
  $('#uiShow').onclick=()=>setUI(true);
  App.setUI = setUI;
}

/* ================================================================== *
 *  boot
 * ================================================================== */
async function boot(){
  const bar=$('#bootBar'), stepEl=$('#bootStep');
  const say=(pct,label)=>{
    bar.style.width=Math.round(pct*100)+'%';
    if(label) stepEl.textContent=label;
  };
  /* yield to the browser, but never hang if rAF is being throttled */
  const tick=()=>new Promise(r=>{
    let done=false;
    const go=()=>{ if(!done){ done=true; r(); } };
    requestAnimationFrame(()=>setTimeout(go,0));
    setTimeout(go, 90);
  });

  try{
    say(0.02,'starting the renderer');
    await tick();
    R = new Renderer($('#gl'));

    /* build phase by phase, yielding to the browser between each, so the
       progress bar moves and the tab stays responsive */
    const B = new Builder();
    for(let i=0;i<SCENE_STEPS.length;i++){
      const [label,fn] = SCENE_STEPS[i];
      say(0.06 + 0.66*(i/SCENE_STEPS.length), label);
      await tick();
      fn(B);
    }
    say(0.74,'compiling the geometry');
    await tick();
    scene = finishScene(B);

    say(0.80,'cutting the stone textures');
    await tick();
    R.setScene(scene);

    parts = scene.parts;
    partById = new Map(parts.map(p=>[p.id,p]));
    say(0.94,'lighting the courts');
    await tick();

    initUI(); initInput(); buildPins(); initSheets();
    setSection(false);

    /* ---- inflating a link ------------------------------------------
       Whatever `viewQuery` writes has to come back the way it went, and it is
       an ORDER, not a list: `goToKey` turns on the layers its place needs and
       may cut the model open, and a link that says otherwise has to be able to
       overrule it. So the place goes first, the switches over the top of it,
       and the camera has the last word—which is what lets a passage carry
       both the scene it names and the exact view you were sharing of it.
       Older links still work: ?view=aerial, ?plain=1, ?ui=none, ?t=. */
    const q=new URLSearchParams(location.search);

    /* 1. the interface */
    /* It starts hidden, so what you meet is the model. ui=1 brings it up on
       load; ui=none takes away the faint control that brings it back, which is
       what a screenshot wants. H still works either way. */
    const uiq = q.get('ui');
    App.setUI(uiq==='1');
    if(uiq==='none') document.body.classList.add('noShow');
    if(q.has('tab')) setTab(q.get('tab'));
    if(q.has('t')) S.timePin = parseFloat(q.get('t'))||0;

    /* 2. where you were: a passage, a structure, or a named view */
    if(q.has('passage')){
      gotoPassage(clamp(parseInt(q.get('passage'),10)||0, 0, PASSAGES.length-1));
    } else if(q.has('go')){
      goToKey(q.get('go'));
    } else if(!q.has('cam')){
      flyTo(VIEWS[q.get('view')] || VIEWS.aerial, 1);
    }
    if(S.flight) S.flight.dur=1;            // arrive, rather than fly there

    /* 3. the switches, over the top of whatever step 2 decided */
    if(q.has('hour')){
      S.hour=clamp(parseFloat(q.get('hour'))||9, 5.2, 18.8);
      $('#sSun').value=S.hour; $('#sSun').dispatchEvent(new Event('input'));
    }
    if(q.get('plain')==='1'){ setTog('tCity',false); setTog('tPeople',false); }
    for(const [k,id] of [['roofs','tRoofs'],['people','tPeople'],['city','tCity'],
                         ['labels','tLabels'],['fire','tFire']])
      if(q.get(k)==='0') setTog(id,false);
    if(q.get('square')==='1') setTog('tSquare',true);
    if(q.get('grid')==='1')   setTog('tGrid',true);
    if(q.has('section')) setSection(q.get('section')==='1');

    /* 4. and the camera last */
    if(q.has('fov')) S.fov=clamp(parseFloat(q.get('fov'))||55, 20, 100);
    if(q.has('cam')) applyCam(q.get('cam'));

    say(1,`${(scene.stats.tris/1000).toFixed(0)}k triangles`+
          (R.rendererName?` · ${R.rendererName.slice(0,52)}`:''));
    await tick();
    $('#boot').classList.add('gone');
    setTimeout(()=>{ const b=$('#boot'); if(b) b.remove(); }, 900);

    if(!q.toString())
      toast('Drag to look, arrows to move, wheel to zoom. Click any part of the '+
            'model to read its description. <b>H</b> for the interface.', 7200);
    loop();
  }catch(err){
    console.error(err);
    stepEl.textContent = String(err.message||err).slice(0,180);
    bar.style.background='#a05050';
  }
}

let toastTimer=null;
function toast(html, ms){
  const t=$('#toast'); t.innerHTML=html; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('on'), ms||3000);
}

/* ---- the frame loop ---- */
let last=performance.now();
function loop(){
  const now=performance.now();
  const dt=Math.min(64, now-last); last=now;

  S.time = S.timePin!==null ? S.timePin : S.time + dt/1000;
  stepFlight(dt);
  stepOrbit(dt);

  const eye=buildView();
  const sv=sunVector(S.hour);

  const focus = S.target;
  /* THE SHADOW MAP'S FOOTPRINT. Taken from the orbit distance alone this was a
     poor guess at how much ground is in frame: look down on the courts from a
     little above and behind, and the distance to the target is 27 m while the
     ground on screen runs to three hundred. The floor of 42 gave a box 128 m
     across—barely the Azarah—so most of the courts' own shadows were simply
     absent, and the patch that had them tracked the camera. 90 puts the box at
     256 m, which covers the sacred precinct with the edges still crisp.
     And the ceiling comes DOWN, because the normal offset is 1.6 shadow texels
     in world meters: at the old 520 that is over a meter and a half, which lifts
     every shadow clean off the thing casting it. 256 is the most this one map
     will carry and still read, and it covers the platform.

     BOTH NUMBERS ARE READ THROUGH THE QUANTISER, which rounds UP to a power of
     two—so they have to BE powers of two or they buy the tier above. 260 asks
     for 512 and gets the washed-out case back; 256 asks for 256.

     AND THE FACTOR IS 1, NOT 0.7. Seven tenths is roughly what fills the frame
     at the focus's own depth, but the ground does not stop there: tilt down from
     160 m up and it runs on past the focus to the edge of the picture. At 0.7 a
     170 m orbit asked for 119 and bought the 128 tier, which cut the western
     colonnade's roof shadow off half way along its length—and since the box
     rides the focus, the place it cut moved with the camera. What is left of the
     boundary now falls on the fade, out at the 512 m edge. */
  const focusRadius = clamp(S.dist, 90, 256);

  /* THE NEAR PLANE, scaled to what the camera is doing and to how many bits
     the depth buffer turned out to have. Orbiting, the working distance is the
     orbit radius and a fortieth of it clips nothing you could see anyway.
     Standing in the model you can put your face against a wall, so it has to
     stay small—and on a sixteen-bit buffer everything is pushed out by the
     same factor again, which is what makes an iPad hold together.

     WHICH OF THE TWO IT IS, IS NOT THE MODE. The guide's ground-level
     viewpoints are orbits now, with the eye on the pavement and the pivot a
     hundred meters down a colonnade: a fortieth of THAT is three and a half
     meters, and it cut away the floor at your feet—the bottom of the picture
     became a band of whatever lay under the paving. What decides it is how far
     the eye is off the ground beneath it, because that is the nearest surface
     an eye standing anywhere has. A fifth of the drop keeps the pavement, and
     up in the air it is the orbit radius that wins, exactly as before. */
  const dk = R.depthBits<=16 ? 3.0 : 1.0;
  const stand = eye[1] - floorAt(eye[0], eye[2]);
  const near = clamp(Math.min(S.dist/40, stand/5)*dk, 0.30*dk, 20);

  R.render({
    view:S.view, camPos:eye, fov:S.fov, near,
    sunDir:sv.dir, sunAlt:sv.alt,
    focus, focusRadius,
    clip:S.clip, clipOn:S.section,
    lights: FIRE_LIGHTS.filter(l=>!l.indoor || S.section),
    time: S.time,
    fire: S.fire,
    fogDensity: 0.00016,
    layerOn,
  });

  updatePins(); updateHud(); stepURL(now);
  requestAnimationFrame(loop);
}

/* ================================================================== *
 *  THE ADDRESS BAR IS THE VIEW
 *
 *  `?cam=` used to be an input only, so the only way to say where you were
 *  looking was to press V and paste what it printed. The address bar now
 *  carries the whole view—camera, mode, hour, switches, which page of the
 *  rail is open and which passage or structure it is on—and a link is
 *  therefore just a link: copy it out of the bar and it comes back up as you
 *  left it.
 *
 *  NOT SIXTY TIMES A SECOND. `replaceState` is cheap but not free, browsers
 *  rate-limit it, and an address bar rewriting itself under a drag is its own
 *  kind of noise. The state is stringified at most every 150 ms, and written
 *  only once it has stopped changing for 400—so a drag, a wheel spin or a
 *  two-second flight writes exactly once, when it lands. The string itself is
 *  the change detector: anything that alters the view alters it, and nothing
 *  else has to remember to say so.
 * ================================================================== */
const URL_CHECK = 150, URL_SETTLE = 400;

function viewQuery(){
  const n = v => (Math.round(v*10)/10).toFixed(1);
  const e = camEye(), t = S.target;
  const p = ['cam='+[e[0],e[1],e[2],t[0],t[1],t[2]].map(n).join(',')];
  if(Math.abs(S.fov-55) > 0.05)  p.push('fov='+n(S.fov));
  if(Math.abs(S.hour-10) > 0.005)p.push('hour='+(Math.round(S.hour*100)/100));
  /* where you are in the guide, or what you have picked—never both, because
     picking something clears the passage */
  if(S.passageIdx>=0)            p.push('passage='+S.passageIdx);
  else if(S.selected)            p.push('go='+(S.selected.key||S.selected.id));
  if(S.tab!=='passages')         p.push('tab='+S.tab);
  if(S.section)                  p.push('section=1');
  if(!S.layers.roofs)            p.push('roofs=0');
  if(!S.layers.people)           p.push('people=0');
  if(!S.layers.city)             p.push('city=0');
  if(!S.labels)                  p.push('labels=0');
  if(!S.fire)                    p.push('fire=0');
  if(S.layers.overlay)           p.push('square=1');
  if(S.layers.grid)              p.push('grid=1');
  if(S.ui)                       p.push('ui=1');
  return p.join('&');
}

let urlSig=null, urlStill=0, urlPut=null, urlNext=0;
function stepURL(now){
  if(now < urlNext) return;
  urlNext = now + URL_CHECK;
  const q = viewQuery();
  /* The first quiet frame after boot sets the baseline: arriving on the page
     and touching nothing should not put a query string in the bar. */
  if(urlPut===null){
    if(S.flight) return;
    urlPut = urlSig = q; urlStill = now; return;
  }
  if(q !== urlSig){ urlSig = q; urlStill = now; return; }   // still moving
  if(q === urlPut || now - urlStill < URL_SETTLE) return;
  urlPut = q;
  try{ history.replaceState(null, '', q ? '?'+q : location.pathname); }
  catch(err){ urlNext = Infinity; }   // sandboxed, or a scheme that will not
}

/* V still works, and now it copies the address rather than a fragment of one:
   the bar may be a second behind a fast drag, so write it first. */
function copyView(){
  const q = viewQuery();
  urlPut = urlSig = q;
  try{ history.replaceState(null, '', q ? '?'+q : location.pathname); }catch(err){}
  const url = location.href;
  /* a file:// page is not a secure context, so often the clipboard will not */
  try{ navigator.clipboard && navigator.clipboard.writeText(url); }catch(err){}
  console.log('view:', url);
  toast('<b>' + url + '</b><br>Copied to the clipboard when browser permissions allow. '
      + 'The link is also available here and in the console.', 20000);
  return url;
}

/* `?cam=ex,ey,ez,tx,ty,tz`—the eye and what it is pointed at, exactly. */
function applyCam(str){
  const v = String(str).split(',').map(Number);
  if(v.length!==6 || !v.every(Number.isFinite)) return;
  const eye=[v[0],v[1],v[2]], look=[v[3],v[4],v[5]];
  const a=aimAt(eye,look);
  S.flight=null;
  S.target=look;
  S.dist=Math.max(2, V3.dist(eye,look));
  S.yaw=a.yaw; S.pitch=a.pitch;
}

return { boot, S, flyTo, goToKey, copyView, setUI:null };
})();

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded', App.boot);
else App.boot();
