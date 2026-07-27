/* =====================================================================
 *  20—procedural texture atlas
 *
 *  Everything is drawn on a 2-D canvas at load time: no external files,
 *  so the model runs offline and inside a strict content-security policy.
 *  Each generator is deterministic (seeded), so every load is identical.
 *
 *  Convention: textures are authored at ~107 px per meter and the world
 *  UVs are meters, so `uvScale` in the geometry builder is 1/(texture
 *  meters). Sizes are noted per generator.
 * ===================================================================== */
'use strict';

const TexLib = (()=>{

  function cv(w,h){
    const c = document.createElement('canvas');
    c.width=w; c.height=h;
    return c;
  }

  /* fine monochrome grain, multiplied over what is already there */
  function grain(ctx,w,h,amount,rand){
    const img = ctx.getImageData(0,0,w,h), d = img.data;
    for(let i=0;i<d.length;i+=4){
      const n = 1 + (rand()-0.5)*amount;
      d[i]   = clamp(d[i]  *n,0,255);
      d[i+1] = clamp(d[i+1]*n,0,255);
      d[i+2] = clamp(d[i+2]*n,0,255);
    }
    ctx.putImageData(img,0,0);
  }

  /* soft irregular blotches—weathering, damp, quarry variation */
  function mottle(ctx,w,h,rand,n,rMin,rMax,col,aMax){
    ctx.save();
    for(let i=0;i<n;i++){
      const x=rand()*w, y=rand()*h, r=rMin+rand()*(rMax-rMin);
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(${col},${(aMax*(0.4+rand()*0.6)).toFixed(3)})`);
      g.addColorStop(1,`rgba(${col},0)`);
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- *
   *  Herodian ashlar.
   *  The signature Herodian block has a smooth flat central boss
   *  framed by a finely tooled, slightly recessed "drafted margin"
   *  about 10–15 cm wide. Joints are dry and nearly invisible.
   *  Courses on the retaining walls run ~1.0–1.2 m high.
   *  Canvas 1024x512  =  9.6 m x 4.8 m  (4 courses of 1.2 m)
   * ---------------------------------------------------------------- */
  function ashlar(opt){
    opt = opt||{};
    const W=1024, H=512;
    const courses = opt.courses||4;
    const perCourse = opt.perCourse||4;          // blocks across
    const margin = opt.margin||13;               // px, ≈12 cm
    const base = opt.base||[214,198,166];
    const rand = mulberry32(opt.seed||1);
    const c = cv(W,H), g = c.getContext('2d');
    const ch = H/courses, bw = W/perCourse;

    g.fillStyle=`rgb(${base[0]*0.82|0},${base[1]*0.82|0},${base[2]*0.82|0})`;
    g.fillRect(0,0,W,H);

    for(let r=0;r<courses;r++){
      const y = r*ch;
      const off = (r%2) ? bw/2 : 0;
      for(let b=-1;b<=perCourse;b++){
        const x = b*bw + off;
        /* Barely any per-block tone HERE—see `slabs` in the shader, which
           hashes it from the block's own position in the world so that the
           pattern never repeats along the wall. */
        const t = 0.975 + rand()*0.05;
        const warm = (rand()-0.5)*3;
        const col = [ clamp(base[0]*t+warm,0,255)|0,
                      clamp(base[1]*t+warm*0.6,0,255)|0,
                      clamp(base[2]*t,0,255)|0 ];

        // drafted margin band (slightly darker, in shadow)
        g.fillStyle=`rgb(${col[0]*0.9|0},${col[1]*0.9|0},${col[2]*0.9|0})`;
        g.fillRect(x+1.2, y+1.2, bw-2.4, ch-2.4);

        // raised central boss
        const bx=x+margin, by=y+margin, bwi=bw-margin*2, bhi=ch-margin*2;
        g.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`;
        g.fillRect(bx,by,bwi,bhi);

        // boss bevel: lit on top/left, shaded on bottom/right
        g.fillStyle='rgba(255,252,240,.30)';
        g.fillRect(bx,by,bwi,2);
        g.fillRect(bx,by,2,bhi);
        g.fillStyle='rgba(40,32,18,.26)';
        g.fillRect(bx,by+bhi-2.4,bwi,2.4);
        g.fillRect(bx+bwi-2.4,by,2.4,bhi);

        // margin tooling: fine parallel chisel strokes
        g.save();
        g.beginPath();
        g.rect(x,y,bw,ch);
        g.rect(bx,by,bwi,bhi);
        g.clip('evenodd');
        g.strokeStyle='rgba(120,104,74,.16)';
        g.lineWidth=1;
        for(let s=0;s<margin*2;s++){
          const sx = x + s*3.1 + rand()*1.4;
          g.beginPath(); g.moveTo(sx,y); g.lineTo(sx-6,y+ch); g.stroke();
        }
        g.restore();

        // dry joint: hairline dark, plus a whisper of highlight below
        g.fillStyle='rgba(52,42,26,.44)';
        g.fillRect(x,y,1.1,ch);
        g.fillRect(x,y,bw,1.1);
      }
    }

    mottle(g,W,H,rand,70,20,120,'168,148,110',0.13);
    mottle(g,W,H,rand,26,30,150,'236,228,206',0.10);
    grain(g,W,H,0.11,rand);
    return c;
  }

  /* smaller-scale masonry for buildings standing on the platform */
  function ashlarFine(){
    return ashlar({courses:8, perCourse:8, margin:7, seed:7,
                   base:[222,208,178]});
  }

  /* The Sanctuary's ungilded stone. Josephus says that where the house was
     not covered with gold "it was exceeding white"—and that to someone
     approaching it looked like a mountain covered with snow (War 5.223). */
  function ashlarWhite(){
    return ashlar({courses:8, perCourse:8, margin:7, seed:19,
                   base:[241,238,230]});
  }

  /* ---------------------------------------------------------------- *
   *  Paving. Large stone slabs, as excavated on the Herodian street
   *  and reconstructed for the esplanade.
   *  1024x1024 = 8 m x 8 m
   * ---------------------------------------------------------------- */
  function paving(opt){
    opt=opt||{};
    const W=1024,H=1024, n=opt.n||4;
    const base=opt.base||[208,194,166];
    const rand=mulberry32(opt.seed||11);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle=`rgb(${base[0]*0.7|0},${base[1]*0.7|0},${base[2]*0.7|0})`;
    g.fillRect(0,0,W,H);
    const s=W/n;
    for(let j=0;j<n;j++){
      for(let i=-1;i<=n;i++){
        const off=(j%2)?s*0.5:0;
        const x=i*s+off, y=j*s;
        /* Almost no tone difference between slabs HERE. A tiled texture that
           carries strong per-slab tone repeats that exact arrangement of light
           and dark stones every few meters, and over a three-hundred-meter
           court the eye reads the arrangement long before it reads the stone.
           The tone comes from `slabs` in the shader instead, hashed from the
           slab's own position in the world, so it never repeats. What stays in
           the texture is what genuinely does repeat: the joint, the bevel and
           the grain. */
        const t=0.975+rand()*0.05;
        g.fillStyle=`rgb(${clamp(base[0]*t,0,255)|0},${clamp(base[1]*t,0,255)|0},${clamp(base[2]*t,0,255)|0})`;
        g.fillRect(x+2,y+2,s-4,s-4);
        g.fillStyle='rgba(255,250,236,.14)';
        g.fillRect(x+2,y+2,s-4,1.6);
        g.fillStyle='rgba(50,42,28,.18)';
        g.fillRect(x+2,y+s-3.6,s-4,1.6);
      }
    }
    mottle(g,W,H,rand,120,14,90,'150,136,108',0.14);
    mottle(g,W,H,rand,40,30,140,'232,224,204',0.09);
    // foot-worn polish in wandering patches
    mottle(g,W,H,rand,18,60,220,'214,204,180',0.11);
    grain(g,W,H,0.10,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  White marble, for the monolithic portico columns Josephus
   *  describes ("one entire stone each of them, and that stone was
   *  white marble", War 5.190). Veining runs with the shaft, so this
   *  is authored for cylinder UVs: u = circumference, v = height.
   *  512x1024
   * ---------------------------------------------------------------- */
  function marble(opt){
    opt=opt||{};
    const W=512,H=1024;
    const rand=mulberry32(opt.seed||23);
    const base=opt.base||[236,232,222];
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle=`rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0,0,W,H);
    mottle(g,W,H,rand,50,60,240,'250,249,246',0.5);
    mottle(g,W,H,rand,30,40,180,'206,202,192',0.22);
    // veins: mostly vertical, gently wandering, occasionally forking
    g.lineCap='round';
    for(let v=0;v<26;v++){
      let x=rand()*W, y=-20;
      const drift=(rand()-0.5)*0.5;
      g.strokeStyle=`rgba(${150+rand()*40|0},${146+rand()*40|0},${140+rand()*40|0},${0.05+rand()*0.13})`;
      g.lineWidth=0.7+rand()*2.6;
      g.beginPath(); g.moveTo(x,y);
      while(y<H+20){
        y += 12+rand()*22;
        x += drift*20 + (rand()-0.5)*11;
        g.lineTo(x,y);
      }
      g.stroke();
    }
    grain(g,W,H,0.045,rand);
    return c;
  }

  /* honed marble floor slabs for the inner courts */
  function marbleFloor(){
    const c = paving({n:5, base:[228,223,210], seed:31});
    const g = c.getContext('2d');
    const rand = mulberry32(41);
    mottle(g,1024,1024,rand,22,60,220,'246,244,238',0.16);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Gold plate. Josephus: the Sanctuary's front "was covered all
   *  over with plates of gold" (War 5.222). Hammered sheet over wood,
   *  so: warm base, faint seam lines between sheets, planishing marks.
   *  512x512 = 2 m x 2 m
   * ---------------------------------------------------------------- */
  function gold(opt){
    opt=opt||{};
    const W=512,H=512;
    const rand=mulberry32(opt.seed||53);
    const c=cv(W,H), g=c.getContext('2d');
    const lg=g.createLinearGradient(0,0,0,H);
    lg.addColorStop(0,'#e6c776');
    lg.addColorStop(.45,'#cfa63f');
    lg.addColorStop(.75,'#e3c169');
    lg.addColorStop(1,'#bd9330');
    g.fillStyle=lg; g.fillRect(0,0,W,H);
    /* Planishing: thousands of hammer facets. These have to be strong enough
       to survive being differentiated into a normal map, because on a flat
       gilded wall they are the ONLY thing that varies the reflection across
       the surface, and a metal with an even reflection over a large plane is
       indistinguishable from paint. Each facet gets a lit edge and a shaded
       one so the Sobel has a gradient to find. */
    for(let i=0;i<2200;i++){
      const x=rand()*W,y=rand()*H,r=3+rand()*8;
      const d=g.createRadialGradient(x-r*0.3,y-r*0.3,0,x,y,r);
      d.addColorStop(0,`rgba(255,244,196,${0.16+rand()*0.14})`);
      d.addColorStop(0.62,'rgba(255,232,168,0.04)');
      d.addColorStop(1,`rgba(96,68,12,${0.10+rand()*0.12})`);
      g.fillStyle=d;
      g.beginPath(); g.arc(x,y,r,0,6.2832); g.fill();
    }
    // sheet seams
    g.strokeStyle='rgba(120,88,20,.20)'; g.lineWidth=1.4;
    for(let i=1;i<4;i++){
      g.beginPath(); g.moveTo(i*W/4,0); g.lineTo(i*W/4,H); g.stroke();
      g.beginPath(); g.moveTo(0,i*H/4); g.lineTo(W,i*H/4); g.stroke();
    }
    mottle(g,W,H,rand,26,30,120,'255,240,190',0.14);
    mottle(g,W,H,rand,18,30,120,'140,102,26',0.10);
    grain(g,W,H,0.05,rand);
    return c;
  }

  /* Corinthian brass—the Nicanor Gate, "far exceeding in value
     those plated with silver and gold" (Josephus, War 5.201) */
  function bronze(){
    const W=512,H=512, rand=mulberry32(67);
    const c=cv(W,H), g=c.getContext('2d');
    const lg=g.createLinearGradient(0,0,0,H);
    lg.addColorStop(0,'#9a7b3c'); lg.addColorStop(.5,'#7d6230');
    lg.addColorStop(1,'#5f4a24');
    g.fillStyle=lg; g.fillRect(0,0,W,H);
    mottle(g,W,H,rand,60,20,90,'62,92,74',0.16);   // verdigris in the hollows
    mottle(g,W,H,rand,40,14,60,'186,158,92',0.20);  // burnished high spots
    for(let i=0;i<900;i++){
      const x=rand()*W,y=rand()*H;
      g.fillStyle=`rgba(210,184,116,${0.02+rand()*0.05})`;
      g.beginPath(); g.arc(x,y,1+rand()*4,0,6.2832); g.fill();
    }
    grain(g,W,H,0.09,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Cedar of Lebanon—roof beams, doors, coffered ceilings.
   *  512x512 = 2 m x 2 m, grain running along u
   * ---------------------------------------------------------------- */
  function cedar(opt){
    opt=opt||{};
    const W=512,H=512, rand=mulberry32(opt.seed||71);
    const c=cv(W,H), g=c.getContext('2d');
    const base=opt.base||[124,78,44];
    g.fillStyle=`rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0,0,W,H);
    for(let i=0;i<180;i++){
      const y=rand()*H;
      const amp=2+rand()*7;
      g.strokeStyle=`rgba(${base[0]*(0.6+rand()*0.7)|0},${base[1]*(0.6+rand()*0.6)|0},${base[2]*(0.6+rand()*0.6)|0},${0.1+rand()*0.3})`;
      g.lineWidth=0.6+rand()*3.4;
      g.beginPath(); g.moveTo(-10,y);
      for(let x=0;x<=W+10;x+=16) g.lineTo(x, y+Math.sin(x*0.02+i)*amp);
      g.stroke();
    }
    // a few knots
    for(let k=0;k<4;k++){
      const x=rand()*W,y=rand()*H,r=5+rand()*11;
      const rg=g.createRadialGradient(x,y,0,x,y,r);
      rg.addColorStop(0,'rgba(58,32,14,.62)'); rg.addColorStop(1,'rgba(58,32,14,0)');
      g.fillStyle=rg; g.beginPath(); g.arc(x,y,r,0,6.2832); g.fill();
    }
    grain(g,W,H,0.09,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Lime plaster / stucco, used on the Royal Stoa's interior and on
   *  ordinary walls. 512x512 = 4 m x 4 m
   * ---------------------------------------------------------------- */
  function plaster(opt){
    opt=opt||{};
    const W=512,H=512, rand=mulberry32(opt.seed||83);
    const base=opt.base||[232,226,210];
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle=`rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0,0,W,H);
    mottle(g,W,H,rand,90,20,140,'206,198,180',0.11);
    mottle(g,W,H,rand,40,30,160,'248,244,234',0.13);
    // trowel sweeps
    g.strokeStyle='rgba(200,192,174,.14)'; g.lineWidth=8;
    for(let i=0;i<40;i++){
      const x=rand()*W,y=rand()*H,a=rand()*6.2832,l=40+rand()*140;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke();
    }
    grain(g,W,H,0.06,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Roofing. Herodian roofs over the porticoes were timber framed
   *  with a rendered/lead-sheathed finish; the Sanctuary roof carried
   *  gilding and the golden spikes. This is the neutral gray-lead
   *  version used on the colonnades. 512x512 = 4 m x 4 m
   * ---------------------------------------------------------------- */
  function roofing(){
    const W=512,H=512, rand=mulberry32(97);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle='#a8a49a'; g.fillRect(0,0,W,H);
    const rows=8, rh=H/rows;
    for(let r=0;r<rows;r++){
      const y=r*rh;
      const t=0.86+rand()*0.28;
      g.fillStyle=`rgb(${172*t|0},${168*t|0},${156*t|0})`;
      g.fillRect(0,y+1,W,rh-2);
      g.fillStyle='rgba(255,255,250,.10)'; g.fillRect(0,y+1,W,2);
      g.fillStyle='rgba(24,22,18,.26)';   g.fillRect(0,y+rh-3,W,2.4);
      // standing seams across the sheet
      for(let s=0;s<6;s++){
        const x=(s+ (r%2?0.5:0))*W/6;
        g.fillStyle='rgba(160,158,150,.30)'; g.fillRect(x,y+1,2,rh-2);
      }
    }
    mottle(g,W,H,rand,60,20,120,'92,96,90',0.16);
    mottle(g,W,H,rand,30,20,110,'170,172,166',0.12);
    grain(g,W,H,0.09,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Terracotta pantiles, for the ridge roof over the Royal Stoa's nave.
   *  Fired clay roofing was standard in Herodian public building, and the
   *  quantity of tile in the Temple Mount debris is part of what tells us
   *  the porticoes were roofed rather than open to the sky.
   *  512x512 = 4 m x 4 m
   * ---------------------------------------------------------------- */
  function roofTiles(){
    const W=512,H=512, rand=mulberry32(151);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle='#8a3d26'; g.fillRect(0,0,W,H);
    /* EIGHT courses, not seven: alternate courses are offset half a tile, and
       the world-space tone hash reproduces that stagger from the row index, so
       an odd count flips the parity at every tile boundary and the offset
       lands on the wrong course. */
    const rows=8, rh=H/rows, n=9, tw=W/n;
    for(let r=0;r<rows;r++){
      const y=r*rh;
      for(let i=-1;i<=n;i++){
        const x=i*tw + (r%2?tw/2:0);
        /* Barely any per-tile tone here—see `slabs` in the shader. A roof
           three hundred meters long built from a 512-pixel tile repeats its
           arrangement of light and dark pantiles every few meters, and on the
           Royal Stoa that was the most visible thing in the model from the
           air. The variation is hashed from each tile's own place in the world
           instead, so it never repeats. */
        const t=0.965+rand()*0.07;
        const b=[176,84,52].map(v=>clamp(v*t,0,255));
        /* each pantile a half-round: dark in the valley, bright on the roll */
        const lg=g.createLinearGradient(x,0,x+tw,0);
        lg.addColorStop(0,   `rgb(${b[0]*0.58|0},${b[1]*0.58|0},${b[2]*0.60|0})`);
        lg.addColorStop(0.40,`rgb(${b[0]|0},${b[1]|0},${b[2]|0})`);
        lg.addColorStop(0.68,`rgb(${Math.min(255,b[0]*1.20)|0},${Math.min(255,b[1]*1.16)|0},${Math.min(255,b[2]*1.12)|0})`);
        lg.addColorStop(1,   `rgb(${b[0]*0.52|0},${b[1]*0.52|0},${b[2]*0.55|0})`);
        g.fillStyle=lg;
        g.fillRect(x, y+1.6, tw-0.5, rh-1.6);
        /* the lap where the course above overlaps this one */
        g.fillStyle='rgba(44,14,7,.38)';
        g.fillRect(x, y, tw, 2.6);
      }
    }
    mottle(g,W,H,rand,80,14,80,'112,48,28',0.20);    // weathering
    mottle(g,W,H,rand,34,18,90,'216,142,98',0.15);   // sun-bleached crowns
    mottle(g,W,H,rand,16,24,110,'96,104,72',0.10);   // lichen in the valleys
    grain(g,W,H,0.10,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Standing water, for the ritual baths and the reservoirs. Deliberately
   *  dark and almost colorless in itself: what makes water read as water
   *  is the sky reflected in it, which the `metal` term in the renderer
   *  supplies, plus the ripple the shader adds. A flat opaque blue does not
   *  look like water—it looks like paint, and a black one looks like a
   *  hole, which is what these basins looked like before.
   *  256x256 = 4 m x 4 m
   * ---------------------------------------------------------------- */
  function water(){
    const W=256,H=256, rand=mulberry32(211);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle='#20393a'; g.fillRect(0,0,W,H);
    mottle(g,W,H,rand,40,30,120,'46,78,74',0.34);     // suspended silt
    mottle(g,W,H,rand,22,20,90,'16,28,32',0.30);      // depth
    mottle(g,W,H,rand,14,40,140,'88,120,108',0.14);   // algae near the sides
    grain(g,W,H,0.05,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  The soft blob used for every flame and smoke puff. What stops fire
   *  reading as geometry is the absence of a hard silhouette, so this is
   *  almost entirely about the alpha channel: a radial falloff broken up by
   *  a few octaves of value noise, so no two puffs have the same outline.
   *  128x128, alpha-carrying
   * ---------------------------------------------------------------- */
  function puffSprite(){
    const W=128,H=128, rand=mulberry32(3141);
    const c=cv(W,H), g=c.getContext('2d');
    /* value-noise lattices, coarse to fine */
    const lat=[];
    for(const n of [4,8,16,32]){
      const a=[];
      for(let j=0;j<=n;j++){ a[j]=[]; for(let i=0;i<=n;i++) a[j][i]=rand(); }
      lat.push([n,a]);
    }
    const smooth=t=>t*t*(3-2*t);
    const sample=(n,a,x,y)=>{
      const fx=x*n, fy=y*n, ix=Math.floor(fx), iy=Math.floor(fy);
      const tx=smooth(fx-ix), ty=smooth(fy-iy);
      const p=(i,j)=>a[Math.min(n,j)][Math.min(n,i)];
      return (p(ix,iy)*(1-tx)+p(ix+1,iy)*tx)*(1-ty)
           + (p(ix,iy+1)*(1-tx)+p(ix+1,iy+1)*tx)*ty;
    };
    const img=g.createImageData(W,H), d=img.data;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const u=(x+0.5)/W, v=(y+0.5)/H;
      const r=Math.hypot(u-0.5, v-0.5)*2;
      let nz=0, amp=0.5, sum=0;
      for(const [n,a] of lat){ nz+=sample(n,a,u,v)*amp; sum+=amp; amp*=0.5; }
      nz/=sum;
      /* radial falloff, roughened by the noise */
      let a = Math.max(0, 1 - r) ;
      a = Math.pow(a, 1.35) * (0.45 + 0.85*nz);
      const o=(y*W+x)*4;
      d[o]=255; d[o+1]=255; d[o+2]=255;
      d[o+3]=Math.max(0, Math.min(255, a*255))|0;
    }
    g.putImageData(img,0,0);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  Bedrock—the Jerusalem meleke limestone the Mount is cut from.
   *  1024x1024 = 16 m x 16 m
   * ---------------------------------------------------------------- */
  function bedrock(){
    const W=1024,H=1024, rand=mulberry32(103);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle='#b9ab8d'; g.fillRect(0,0,W,H);
    mottle(g,W,H,rand,150,30,220,'150,138,112',0.16);
    mottle(g,W,H,rand,90,40,260,'210,200,176',0.14);
    // bedding planes and stress fractures
    for(let i=0;i<50;i++){
      const y=rand()*H;
      g.strokeStyle=`rgba(112,100,78,${0.05+rand()*0.16})`;
      g.lineWidth=0.8+rand()*3;
      g.beginPath(); g.moveTo(-10,y);
      for(let x=0;x<=W+10;x+=40) g.lineTo(x,y+(rand()-0.5)*26);
      g.stroke();
    }
    for(let i=0;i<28;i++){
      const x=rand()*W,y=rand()*H;
      g.strokeStyle=`rgba(96,86,66,${0.06+rand()*0.14})`;
      g.lineWidth=0.7+rand()*2;
      g.beginPath(); g.moveTo(x,y);
      let cx=x,cy=y;
      for(let s=0;s<8;s++){ cx+=(rand()-0.5)*90; cy+=(rand()-0.3)*90; g.lineTo(cx,cy); }
      g.stroke();
    }
    grain(g,W,H,0.13,rand);
    return c;
  }

  /* dry hillside: thin soil, terraces, scrub. 1024x1024 = 32 m x 32 m */
  function ground(){
    const W=1024,H=1024, rand=mulberry32(109);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle='#a89870'; g.fillRect(0,0,W,H);
    mottle(g,W,H,rand,220,20,180,'138,124,88',0.15);
    mottle(g,W,H,rand,120,24,150,'186,172,132',0.14);
    mottle(g,W,H,rand,90,16,90,'106,112,66',0.20);   // olive & scrub
    mottle(g,W,H,rand,40,10,44,'84,94,54',0.26);
    // exposed rock ribs
    for(let i=0;i<40;i++){
      const x=rand()*W,y=rand()*H,a=rand()*6.2832,l=30+rand()*150;
      g.strokeStyle=`rgba(176,166,142,${0.10+rand()*0.18})`;
      g.lineWidth=3+rand()*10;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke();
    }
    grain(g,W,H,0.15,rand);
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  The veil (parochet): "blue, and fine linen, and scarlet, and
   *  purple" (Exod 26:31; Josephus, War 5.212–214, who says the outer
   *  curtain figured "a panorama of the heavens"). Woven, not printed:
   *  interlocking bands with a worked cherubim/palm motif.
   *  512x512 = 4 m x 4 m
   * ---------------------------------------------------------------- */
  function veil(){
    const W=512,H=512, rand=mulberry32(127);
    const c=cv(W,H), g=c.getContext('2d');
    const lg=g.createLinearGradient(0,0,0,H);
    lg.addColorStop(0,'#5a2a4e'); lg.addColorStop(.5,'#7a2436'); lg.addColorStop(1,'#472a63');
    g.fillStyle=lg; g.fillRect(0,0,W,H);
    // warp/weft
    for(let x=0;x<W;x+=3){
      g.fillStyle=`rgba(0,0,0,${0.03+rand()*0.05})`; g.fillRect(x,0,1.4,H);
    }
    for(let y=0;y<H;y+=3){
      g.fillStyle=`rgba(255,235,215,${0.02+rand()*0.04})`; g.fillRect(0,y,W,1.2);
    }
    // woven bands of scarlet / blue / gold thread
    const bands=[[0.10,'#8d2b2b'],[0.30,'#25407a'],[0.50,'#8a6a1e'],[0.70,'#25407a'],[0.90,'#8d2b2b']];
    for(const [p,col] of bands){
      const lg2=g.createLinearGradient(0,p*H-22,0,p*H+22);
      lg2.addColorStop(0,'rgba(0,0,0,0)');
      lg2.addColorStop(.5,col);
      lg2.addColorStop(1,'rgba(0,0,0,0)');
      g.globalAlpha=.34; g.fillStyle=lg2;
      g.fillRect(0,p*H-22,W,44); g.globalAlpha=1;
    }
    // stylised palm / cherub figures worked into the field
    g.strokeStyle='rgba(214,182,104,.34)'; g.lineWidth=2.2;
    for(let i=0;i<8;i++){
      const cx=(i%4)*W/4+W/8, cy=(i<4?0.2:0.68)*H;
      g.beginPath();
      g.moveTo(cx,cy+26); g.lineTo(cx,cy-26);
      for(let a=-3;a<=3;a++){
        g.moveTo(cx,cy-a*7);
        g.quadraticCurveTo(cx+a*3+16,cy-a*7-10,cx+26,cy-a*7-4);
        g.moveTo(cx,cy-a*7);
        g.quadraticCurveTo(cx-a*3-16,cy-a*7-10,cx-26,cy-a*7-4);
      }
      g.stroke();
    }
    grain(g,W,H,0.10,rand);
    return c;
  }

  /* ordinary Jerusalem housing: rubble masonry, lime-washed
     512x512 = 6 m x 6 m */
  function house(){
    const W=512,H=512, rand=mulberry32(131);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle='#c3b394'; g.fillRect(0,0,W,H);
    for(let i=0;i<420;i++){
      const x=rand()*W,y=rand()*H,w=8+rand()*30,h=6+rand()*16;
      const t=0.82+rand()*0.34;
      g.fillStyle=`rgb(${clamp(196*t,0,255)|0},${clamp(182*t,0,255)|0},${clamp(150*t,0,255)|0})`;
      g.fillRect(x,y,w,h);
      g.fillStyle='rgba(90,80,60,.14)'; g.fillRect(x,y+h-1.4,w,1.4);
    }
    mottle(g,W,H,rand,60,20,120,'168,156,128',0.16);
    mottle(g,W,H,rand,30,26,120,'240,234,218',0.14);
    grain(g,W,H,0.11,rand);
    return c;
  }

  /* the soreg—a latticed stone screen ten handbreadths high
     (Middot 2:3). Drawn as an alpha-cut trellis. 256x256 */
  function lattice(){
    const W=256,H=256, rand=mulberry32(137);
    const c=cv(W,H), g=c.getContext('2d');
    g.clearRect(0,0,W,H);
    g.strokeStyle='#d6c8a6'; g.lineWidth=13; g.lineCap='square';
    for(let i=-3;i<=6;i++){
      g.beginPath(); g.moveTo(i*48,0); g.lineTo(i*48+H,H); g.stroke();
      g.beginPath(); g.moveTo(i*48,H); g.lineTo(i*48+H,0); g.stroke();
    }
    g.globalCompositeOperation='source-atop';
    mottle(g,W,H,rand,40,10,50,'150,138,110',0.24);
    g.globalCompositeOperation='source-over';
    return c;
  }

  /* ---------------------------------------------------------------- *
   *  A normal map derived from a texture that has already been drawn.
   *
   *  These textures carry their relief as tone: the drafted margin of a
   *  Herodian block is drawn darker because it is cut back, the joint
   *  between two courses darker still because it is a gap. Read that tone
   *  as a height field and Sobel it, and the margins and joints become
   *  geometry the light can find—which is the whole point, since a
   *  retaining wall of drafted ashlar lit as a flat plane is the one
   *  surface in this model that most wants to be felt.
   *
   *  Half the source resolution: relief here is a low-frequency quantity
   *  and there is no reason to spend four times the memory on it.
   * ---------------------------------------------------------------- */
  function normalMap(src, strength){
    const W=Math.max(4,src.width>>1), H=Math.max(4,src.height>>1);
    const s=cv(W,H), sg=s.getContext('2d');
    sg.drawImage(src,0,0,W,H);
    const img=sg.getImageData(0,0,W,H), d=img.data;
    /* luminance as height, in one pass, so the Sobel below reads a scalar */
    const ht=new Float32Array(W*H);
    for(let i=0,p=0;i<ht.length;i++,p+=4)
      ht[i]=(d[p]*0.299 + d[p+1]*0.587 + d[p+2]*0.114)/255;
    const out=sg.createImageData(W,H), o=out.data;
    const at=(x,y)=>ht[((y+H)%H)*W + ((x+W)%W)];      // wraps, as the texture does
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const gx = (at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1))
               - (at(x-1,y-1)+2*at(x-1,y)+at(x-1,y+1));
      const gy = (at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1))
               - (at(x-1,y-1)+2*at(x,y-1)+at(x+1,y-1));
      /* height rises with luminance, so the gradient is negated to point the
         normal away from the raised part */
      let nx=-gx*strength, ny=-gy*strength, nz=1;
      const l=Math.hypot(nx,ny,nz);
      const p=(y*W+x)*4;
      o[p]  =(nx/l*0.5+0.5)*255;
      o[p+1]=(ny/l*0.5+0.5)*255;
      o[p+2]=(nz/l*0.5+0.5)*255;
      o[p+3]=255;
    }
    sg.putImageData(out,0,0);
    return s;
  }

  /* a single flat-normal texel, bound wherever a material has no relief */
  function flatNormal(){
    const c=cv(2,2), g=c.getContext('2d');
    g.fillStyle='rgb(128,128,255)'; g.fillRect(0,0,2,2);
    return c;
  }

  /* woven / dyed cloth for awnings, pilgrims' garments */
  function cloth(rgb,seed){
    const W=128,H=128, rand=mulberry32(seed||149);
    const c=cv(W,H), g=c.getContext('2d');
    g.fillStyle=`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; g.fillRect(0,0,W,H);
    for(let x=0;x<W;x+=2){ g.fillStyle=`rgba(0,0,0,${0.04+rand()*0.06})`; g.fillRect(x,0,1,H); }
    for(let y=0;y<H;y+=2){ g.fillStyle=`rgba(255,255,255,${0.03+rand()*0.05})`; g.fillRect(0,y,W,1); }
    grain(g,W,H,0.12,rand);
    return c;
  }

  return { ashlar, ashlarFine, ashlarWhite, paving, marble, marbleFloor, gold, bronze,
           cedar, plaster, roofing, roofTiles, water, puffSprite, bedrock, ground, veil, house, lattice, cloth,
           normalMap, flatNormal };
})();
