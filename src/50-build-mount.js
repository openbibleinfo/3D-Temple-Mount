/* =====================================================================
 *  50—the platform: terrain, retaining walls, esplanade, colonnades,
 *       the Royal Stoa, the Antonia, and every way in.
 * ===================================================================== */
'use strict';

const sq2 = a => a*a;
const sstep = t => smoothstep(clamp(t,0,1));

/* ------------------------------------------------------------------ *
 *  Ground level, meters relative to the esplanade (which is 0, and in
 *  reality about 740 m above sea level).
 *  Targets: the Herodian street west of the wall ≈ -30; the Ophel plaza
 *  south of the steps ≈ -14; the Kidron bed east ≈ -80; the Upper City
 *  crest ≈ +30; the summit of the Mount of Olives ≈ +86.
 * ------------------------------------------------------------------ */
function rawGround(x,z){
  let h = -13.5;                                     // shoulder of the hill

  /* Tyropoeon valley—runs north–south just west of the wall */
  const tvx = -22 + (z-100)*0.02;
  h -= 21 * Math.exp(-sq2((x - tvx)/48));

  /* the western hill: the Upper City */
  h += 50 * sstep((-x - 30)/230);

  /* Kidron valley—north–south, about 120 m east of the eastern wall,
     deepening as it runs south past the corner */
  const kvx = 402 - (z-26)*0.03;
  const kid = Math.exp(-sq2((x - kvx)/98));
  h -= 40 * kid;
  h -= 30 * sstep((z-120)/380) * Math.exp(-sq2((x - kvx)/135));

  /* the Mount of Olives beyond it */
  h += 118 * sstep((x - 470)/340);

  /* southward, down to the saddle before the City of David */
  h -= 24 * sstep((z - 495)/250);

  /* northward, up onto Bezetha */
  h += 30 * sstep((-z - 15)/200);

  /* The plaza south of the Mount is a built terrace cut into the slope, and
     the great staircase stands on it. Carve the hillside down to it, or the
     natural ground—about -15 here—rises through the lower steps. The
     carve region is deliberately wider than the paving so the graded edge
     falls outside it. */
  const terrace = HULDAH_SILL - SOUTH_STAIR.rise*SOUTH_STAIR.n - 1.9;
  const mx = 1 - sstep((Math.abs(x - GATES.double.at) - 58)/40);
  const mz = 1 - sstep((Math.abs(z - (PLAT.SW[1]+32)) - 40)/34);
  const m  = mx*mz;
  if(m > 0) h = lerp(h, Math.min(h, terrace), m);

  return h;
}

/* ------------------------------------------------------------------ *
 *  THE RESERVOIRS ARE DUG, NOT STOOD ON.
 *
 *  The hillside ran straight through both of them. A sheet of water 110 m by
 *  38 m with the terrain crossing it a meter or so under the rim is not two
 *  surfaces close together, it is two surfaces INTERSECTING, and the seam of an
 *  intersection between two nearly parallel planes is a band, not a line—it
 *  shimmered across half the Pool of Israel. Depth precision only decides how
 *  wide the band is, which is why it showed on an iPad, whose default depth
 *  buffer is half the depth of a desktop's, and not here.
 *
 *  So the ground inside each basin is cut to below its own floor. The cut is
 *  taken from the RAW hillside and applied afterwards, because each pool's rim
 *  is derived from the ground its coping stands on and a carve that fed back
 *  into that reading would chase its own tail. And it stops short of the
 *  coping—`hi` is sampled on a ring outside the basin, which the cut does not
 *  reach, so the rim is exactly where it was.
 * ------------------------------------------------------------------ */
let _poolCuts = null;
function poolCuts(){
  if(_poolCuts) return _poolCuts;
  /* WORKED OUT ON FIRST USE, not at load. Everything here is constant, but
     `rawGround` reads `HULDAH_SILL` and the stair, which are declared further
     down this file: run eagerly it reached them before they existed. The first
     call comes from the build, by which time the whole file has been read. */
  const cuts=[];
  /* the Struthion, in the Antonia's frame; the Pool of Israel, in the northern
     wall's. Both footprints are fixed by constants, so both can be worked out
     before anything is built. */
  const u = [ (PLAT.NE[0]-PLAT.NW[0])/WALL_LEN.N, (PLAT.NE[1]-PLAT.NW[1])/WALL_LEN.N ];
  const out = [ u[1], -u[0] ];
  const P = POOLS.israel;
  const along = WALL_LEN.N - P.w/2 - 6, off = P.d/2 + 7;
  cuts.push({ x:PLAT.NW[0] + u[0]*along + out[0]*off,
              z:PLAT.NW[1] + u[1]*along + out[1]*off,
              ux:u[0], uz:u[1], hw:P.w/2 + 1.0, hd:P.d/2 + 1.0, drop:4.0 });
  const T = POOLS.struthion;
  const [tx,tz] = N_FRAME.toW(ANTONIA.rock.s0 + 16,
                              ANTONIA.rock.dN - (T.d/2 + 9));
  cuts.push({ x:tx, z:tz, ux:1, uz:0,
              hw:T.w/2 + 1.0, hd:T.d/2 + 1.0, drop:2.6 });
  _poolCuts = cuts.map(c=>{
    /* the deepest the cut may go: a fixed clearance under the highest raw
       ground the coping ring touches, which is what sets the rim */
    let hi=-1e9;
    for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++)
      hi = Math.max(hi, rawGround(c.x + c.ux*i*(c.hw+5.5) + c.uz*j*(c.hd+5.5),
                                  c.z + c.uz*i*(c.hw+5.5) - c.ux*j*(c.hd+5.5)));
    return {...c, to: hi - c.drop};
  });
  return _poolCuts;
}

function groundLevel(x,z){
  let h = rawGround(x,z);
  for(const c of poolCuts()){
    const dx=x-c.x, dz=z-c.z;
    const sx =  dx*c.ux + dz*c.uz;              // along the pool
    const sz = -dx*c.uz + dz*c.ux;              // across it
    /* feathered over the last two meters, so the cut's edge is a slope in the
       hillside and not a step in it */
    const m = (1-sstep((Math.abs(sx)-c.hw)/2.0)) * (1-sstep((Math.abs(sz)-c.hd)/2.0));
    if(m > 0) h = lerp(h, Math.min(h, c.to), m);
  }
  return h;
}

/* How far (x,z) lies outside the platform quadrilateral: negative inside,
   positive outside. PLAT_RING is wound so that "inside" is to the right of
   every edge, so the least signed distance, negated, is what we want. */
function outsidePlatform(x,z){
  let best = 1e9;
  const R = PLAT_RING;
  for(let i=0;i<4;i++){
    const a=R[i], b=R[(i+1)%4];
    const ex=b[0]-a[0], ez=b[1]-a[1];
    const d = (ex*(z-a[1]) - ez*(x-a[0])) / Math.hypot(ex,ez);
    if(d < best) best = d;
  }
  return -best;
}

/* the threshold of the Huldah gates, and so the head of the southern
   staircase: about ten meters below the esplanade, the passage ramping up
   inside the wall to reach the pavement */
const HULDAH_SILL = ESP - 9.2;

/* The Herodian street along the western wall: one value, shared by the street
   itself and by everything that has to come down to meet it. Robinson's stair
   was descending to groundLevel() while the paving sat 3.6 m higher. */
const STREET_Y = ESP - 30.2;

/* ------------------------------------------------------------------ *
 *  push a frame whose local +X runs a→b and local +Z is 90° clockwise
 *  from it. Pass endpoints in ring order (NW→NE, NE→SE, SE→SW, SW→NW)
 *  and local +Z always points into the platform.
 * ------------------------------------------------------------------ */
function frameAlong(B,a,b){
  const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
  B.pushT(a[0],0,a[1]);
  B.pushRotY(Math.atan2(-dz/len, dx/len));
  return len;
}
const popFrame = B => { B.pop(); B.pop(); };

/* precinct-local cubits → world [x,z] */
function precinctToWorld(xc,zc){
  const X=cu(xc), Z=cu(zc);
  return [ SQ_NW[0] + U_EAST[0]*X + V_SOUTH[0]*Z,
           SQ_NW[1] + U_EAST[1]*X + V_SOUTH[1]*Z ];
}

/* ------------------------------------------------------------------ *
 *  a straight wall pierced by openings. Openings are given as
 *  {at, w, h, sill} where `at` is the distance along from `from`.
 * ------------------------------------------------------------------ */
function wallOpen(B,mat,layer,o){
  const [ax,az]=o.from, [bx,bz]=o.to;
  const dx=bx-ax, dz=bz-az, len=Math.hypot(dx,dz);
  const ux=dx/len, uz=dz/len;
  const P = t => [ax+ux*t, az+uz*t];
  const ops = (o.openings||[]).slice().sort((p,q)=>p.at-q.at);
  let cur = 0;
  /* Segments are capped. Two collinear segments meeting flush produce a pair
     of coincident end quads facing opposite ways, so both are back-facing from
     outside and nothing z-fights; what the caps do buy is a proper reveal at
     every gate jamb, and closed ends where wall runs meet. */
  const common = { thick:o.thick, uv:o.uv, ao:o.ao, batter:o.batter,
                   grad:o.grad, top:o.top, aoTop:o.aoTop };
  for(const op of ops){
    const a0 = op.at - op.w/2, a1 = op.at + op.w/2;
    if(a0 > cur)
      B.wall(mat,layer, Object.assign({from:P(cur), to:P(a0), y0:o.y0, y1:o.y1,
                                       uStart:cur}, common));
    const sill = op.sill||0;
    if(sill > 0)
      B.wall(mat,layer, Object.assign({from:P(a0), to:P(a1), y0:o.y0, y1:o.y0+sill,
                                       uStart:a0, top:false}, common));
    if(o.y0+sill+op.h < o.y1)
      B.wall(mat,layer, Object.assign({from:P(a0), to:P(a1), y0:o.y0+sill+op.h, y1:o.y1,
                                       uStart:a0}, common));
    cur = a1;
  }
  if(cur < len)
    B.wall(mat,layer, Object.assign({from:P(cur), to:P(len), y0:o.y0, y1:o.y1,
                                     uStart:cur}, common));
  return len;
}

/* ------------------------------------------------------------------ *
 *  The two roadways carried on arches that you can walk out along. Where the
 *  ground is, is groundHeightAt(), which knew about the terrain and the built
 *  platform but not about a deck fifteen meters over the valley—so going east
 *  out of the Shushan Gate dropped you off the causeway and left you strolling
 *  along the bed of the Kidron.
 *
 *  The deck only wins where it is actually ABOVE the ground, which is what
 *  ends both of them at the point where the hill has risen to meet them.
 * ------------------------------------------------------------------ */
/* The Antonia's floors: the great stair up to the colonnade roofs, the landing
   at its head, the walk round the rim of the rock, and the courtyard inside the
   curtain. Without it the stair was scenery—the ground under it stayed at the
   level of the esplanade, and everything stood on that.

   Everything here is in the northern colonnade's frame, which is the frame the
   fortress is built in, so the world point is put back into it first. */
function antoniaFloorAt(x,z){
  const A = ANTONIA, R = A.rock, W = A.wall, S = ANT_STAIR;
  const [s,d] = N_FRAME.toL(x,z);
  /* the great stair and its landing */
  if(d > S.d0 && d < S.d1){
    if(s >= S.s0 && s <= S.s1)   return ESP + (s-S.s0)/S.run * S.top;
    if(s > S.s1 && s <= S.sEnd)  return ESP + S.top;
  }
  if(s < R.s0 || s > R.s1 || d > R.dS || d < R.dN) return null;
  /* THE RAMPART BEHIND THE SOUTH FRONT, at the level of the two posterns, and
     their thresholds through the curtain—without these the walk stepped off
     the head of the great stair into a six-meter drop to the courtyard. The
     thresholds are only at the doors: given to the whole curtain, walking north
     into it anywhere along 122 m lifted you sixteen meters. */
  const G = ANT_GALLERY;
  if(d > G.d0 && d < G.d1) return ESP + G.y;
  if(d >= G.d1 && d <= W.dS + A.thick/2 &&
     ANT_POSTERN.some(ps => Math.abs(s - ps) < 3.4)) return ESP + G.y;
  /* inside the curtain the courtyard is paved a little over the rock; outside
     it, the walk at the rim of the scarp */
  const inside = s > W.s0+2 && s < W.s1-2 && d < W.dS-2 && d > W.dN+2;
  return A.floor + (inside ? 0.25 : 0);
}

/* ------------------------------------------------------------------ *
 *  THE CAUSEWAY'S LENGTH, worked out once. It runs east on the precinct's axis
 *  until the Mount of Olives has risen to the roadway, and both the arcade and
 *  the deck that carries a floor take their extent from here—given a number
 *  of its own the deck ended 20 m short of the last pier, so the last bays were
 *  scenery with nothing on top of them.
 * ------------------------------------------------------------------ */
const CAUSEWAY = (()=>{
  const deck = ESP - 0.9, roadU = deck - 0.8, w = 9.0;
  const p = precinctToWorld(500, AXIS_Z);
  const dx = Math.cos(PRECINCT_ROT), dz = Math.sin(PRECINCT_ROT);
  let t = 0;
  while(t < 640 && groundLevel(p[0]+t*dx, p[1]+t*dz) <= roadU - 1.0) t += 2;
  return { deck, roadU, w, p, dx, dz, run:t };
})();

function causewayDeckAt(x,z){
  /* east to Olivet, on the precinct's axis */
  const C = CAUSEWAY, p = C.p;
  const t  = (x-p[0])*C.dx + (z-p[1])*C.dz;
  if(t > -WALLS.thick && t < C.run + 6 &&
     Math.abs(-(x-p[0])*C.dz + (z-p[1])*C.dx) < 4.3) return C.deck;
  /* west from Wilson's Arch to the Upper City */
  const wz = PLAT.SW[1] - GATES.wilson.at;
  if(x < WALLS.thick && x > -300 && Math.abs(z-wz) < 6.2) return ESP - 0.45;
  return null;
}

/* ------------------------------------------------------------------ *
 *  The fill between an arch ring and whatever it carries.
 *
 *  An arcade built as bare rings is a row of thin ribs with daylight over
 *  every haunch: the arches read as cut paper however solid the ring itself
 *  is, because nothing above them is closed. Real arcades are a wall with
 *  holes in it, and the spandrel is the wall.
 *
 *  ITS UNDERSIDE FOLLOWS THE RING, and is not a stack of boxes. Built as boxes
 *  each slice had to drop to the LOWER of its two ends, or leave daylight over
 *  the ring; that flat bottom then stood in front of the arc it sat on, and
 *  twelve slices over a semicircle step by as much as 1.8 m at the springing.
 *  What you saw from the valley was a staircase where the arch should be, on
 *  every ring of both causeways. Setting the fill back behind the ring's face
 *  hides the steps head-on and not from anywhere else, because the steps face
 *  ALONG the arcade: obliquely you look straight into them.
 *
 *  So each slice is a panel whose lower edge is the chord of the ring's own
 *  extrados. `B.arch` walks the same angles by the same formula, so the two
 *  meet vertex for vertex—no step, no lap, and nothing to z-fight. The panel
 *  needs no underside: the ring's extrados is already that surface.
 * ------------------------------------------------------------------ */
function archSpandrel(B,mat,layer,o){
  const R=o.span/2, th=o.thick, seg=o.seg||12, aX=(o.axis||'x')==='x';
  const d2=o.depth/2, s=o.uv||0.24, ao=o.ao===undefined?1:o.ao;
  const P=(t,y,off)=> aX ? [o.x+t, y, o.z+off] : [o.x+off, y, o.z+t];
  for(let i=0;i<seg;i++){
    const a0=Math.PI*i/seg, a1=Math.PI*(i+1)/seg;
    const t0=-Math.cos(a0)*(R+th), t1=-Math.cos(a1)*(R+th);
    const h0=o.y+Math.sin(a0)*(R+th), h1=o.y+Math.sin(a1)*(R+th);
    /* the deck may be a rising flight rather than a level roadway */
    const top = o.deckAt ? o.deckAt((aX ? o.x : o.z)+(t0+t1)/2) : o.deckY;
    /* where the ring has already risen through the deck there is nothing to
       fill, and the panel would be upside down */
    const c0=Math.min(h0,top), c1=Math.min(h1,top);
    if(top-c0 < 0.02 && top-c1 < 0.02) continue;
    const u0=(t0+R+th)*s, u1=(t1+R+th)*s;
    for(const [off,sgn] of [[d2,1],[-d2,-1]]){
      const nrm = aX ? [0,0,sgn] : [sgn,0,0];
      const p = [P(t0,c0,off), P(t1,c1,off), P(t1,top,off), P(t0,top,off)];
      const q = [[u0,c0*s],[u1,c1*s],[u1,top*s],[u0,top*s]];
      /* WINDING, derived and not guessed: cross(b-a,c-a) has to point the way
         the face does. The `aX` flip is because t runs along +x on one axis and
         along +z on the other, which reverses the sense of the same ordering. */
      const k = (aX?1:-1)*sgn > 0 ? [0,1,2,3] : [0,3,2,1];
      B.quad(mat,layer, p[k[0]],p[k[1]],p[k[2]],p[k[3]],
        [q[k[0]][0],q[k[0]][1], q[k[1]][0],q[k[1]][1],
         q[k[2]][0],q[k[2]][1], q[k[3]][0],q[k[3]][1]], ao, nrm);
    }
    /* and a top, so the roadway does not sit on an open panel */
    const T=[P(t0,top,-d2), P(t1,top,-d2), P(t1,top,d2), P(t0,top,d2)];
    const tk = aX ? [0,3,2,1] : [0,1,2,3];
    B.quad(mat,layer, T[tk[0]],T[tk[1]],T[tk[2]],T[tk[3]],
      [0,0, o.depth*s,0, o.depth*s,(t1-t0)*s, 0,(t1-t0)*s], ao, [0,1,0]);
    /* NO UNDERSIDE. The panel's lower edge is the extrados chord and the ring
       has already drawn that surface, so one here would be a second quad in the
       same plane—tried, and it did nothing for the shape while shifting eight
       thousand pixels of shading where the two tied. That is a flicker waiting
       to happen, for a face nothing can see. */
  }
}

/* ------------------------------------------------------------------ *
 *  A basin that holds water: lined sides, a floor, and a water surface set
 *  down from the rim. Built as four inward-facing wall slabs rather than as
 *  a box, because a box's faces point outward and you would be looking at
 *  the backs of them. Used for the ritual baths below the southern steps
 *  and for the two great reservoirs.
 * ------------------------------------------------------------------ */
function waterBasin(B,o){
  const { x, z, w, d, rim, depth } = o;
  const lining = o.lining || 'plaster';
  const layer  = o.layer  || 'base';
  const t      = o.wallT  || 0.5;              // thickness of the lining
  const wl     = rim - (o.freeboard===undefined ? 0.45 : o.freeboard);
  const floorY = rim - depth;

  /* the four linings, inner faces on the basin's inside */
  for(const [cx,cz,sx,sz] of [
        [x, z-d/2+t/2, w,      t],
        [x, z+d/2-t/2, w,      t],
        [x-w/2+t/2, z, t, d-2*t],
        [x+w/2-t/2, z, t, d-2*t]])
    B.box(lining,layer,{x:cx, z:cz, y:floorY, sx, sy:depth, sz,
                        uv:o.uv||0.3, ao:0.62, grad:0.30, skip:'B'});

  /* the floor, and the water */
  B.poly(lining,layer,[[x-w/2+t,z-d/2+t],[x+w/2-t,z-d/2+t],
                       [x+w/2-t,z+d/2-t],[x-w/2+t,z+d/2-t]], floorY, o.uv||0.3, 0.34);
  B.poly('water',layer,[[x-w/2+t,z-d/2+t],[x+w/2-t,z-d/2+t],
                        [x+w/2-t,z+d/2-t],[x-w/2+t,z+d/2-t]], wl, 1/4, 1);

  /* a curb round the rim */
  if(o.curb){
    const k=o.curb;
    for(const [cx,cz,sx,sz] of [
          [x, z-d/2-k/2, w+2*k, k],
          [x, z+d/2+k/2, w+2*k, k],
          [x-w/2-k/2, z, k, d],
          [x+w/2+k/2, z, k, d]])
      B.box('ashlarFine',layer,{x:cx, z:cz, y:rim-0.05, sx, sy:o.curbH||0.42, sz,
                                uv:0.7, ao:1});
  }
  return this;
}

/* =====================================================================
 *  TERRAIN AND CITY
 * ===================================================================== */
/* One sheet, on a material that decides between soil and bedrock per fragment
   from the slope it is standing on—scree and outcrop where the Kidron falls
   away, thin cultivated soil where Olivet lies back. Two stacked sheets, one
   tinted for each, could only ever differ where the coarser mesh happened to
   dip through the finer one, which is a mottle rather than a landscape.

   It sits at exactly groundLevel(), the height groundHeightAt() reports, so
   walking the hillside puts you on the surface you can see rather than a third
   of a meter under it. */
function buildTerrain(B){
  B.terrain('terrain','city',{
    x0:-1100, x1:1600, z0:-1000, z1:1600, nx:160, nz:160,
    uv:1/57, fn:(x,z)=> groundLevel(x,z)
  });
}

/* The Herodian street along the western wall, its drain, and the shops let
   into the vaults beneath Robinson's Arch.

   It runs from beyond the foot of Robinson's stepped street, at the south end,
   northward past Barclay's and Warren's gates. Two things it has to do that it
   did not: reach the GROUND, and be the level the gates open off.

   The pavement is a meter-thick slab, and the rock beneath it falls away
   northward and southward; laid on nothing it hung three meters clear of the
   hillside for most of its length. It is carried on fill now, in segments, each
   reaching down to the ground actually under it.

   And its level rises gently as it goes north, so there is one function that
   says where it is. Barclay's and Warren's gates were set out from the natural
   ground instead, which put their sills below the pavement and left the street
   cutting up through both of them. */
const STREET_Z0 = 540;                    // south of the foot of Robinson's stair
const STREET_Z1 = 7;
const STREET_SEG = 18;
function streetLevelAt(z){
  const i = clamp(Math.floor((STREET_Z0-z)/STREET_SEG), 0,
                  Math.floor((STREET_Z0-STREET_Z1)/STREET_SEG));
  return STREET_Y + i*0.16;
}
function buildStreet(B){
  B.part('street',{name:INFO.street.n, key:'street', at:[-14,STREET_Y+4,430]},()=>{
    const n = Math.floor((STREET_Z0-STREET_Z1)/STREET_SEG);
    for(let i=0;i<n;i++){
      const z0 = STREET_Z0 - i*STREET_SEG, z1 = z0 - STREET_SEG;
      const a=[PLAT.SW[0]-2.4, z0], b=[PLAT.SW[0]-2.4, z1];
      const yy = STREET_Y + i*0.16;
      B.wall('paving','city',{from:a,to:b,y0:yy-1.0,y1:yy,thick:10.5,uv:0.11,
                              caps:false,ao:0.9});
      /* the fill under it, down to whatever the rock is doing here */
      const gLo = Math.min(groundLevel(-8,z0), groundLevel(-8,z1),
                           groundLevel(-13,(z0+z1)/2)) - 2.0;
      if(yy-1.0 - gLo > 0.1)
        /* centered on the STREET, not on its western curb: offset by half its
           width the fill stood beside the pavement as a row of piers holding
           nothing up */
        B.box('ashlar','city',{x:PLAT.SW[0]-2.4, z:(z0+z1)/2, y:gLo,
                               sx:10.5, sy:(yy-1.0)-gLo, sz:STREET_SEG+0.2,
                               uv:1/9.6, ao:0.86, grad:0.26, skip:'T'});
    }
    /* the row of shops under the arch's approach */
    for(let i=0;i<7;i++){
      const z = PLAT.SW[1]-16-i*6.2;
      B.box('ashlarFine','city',{x:-8.6,z,y:streetLevelAt(z)-0.6,sx:5.6,sy:5.4,
                                 sz:5.4,uv:0.3,ao:0.8});
      B.box('cedar','city',{x:-11.5,z,y:streetLevelAt(z)-0.6,sx:0.5,sy:3.6,
                            sz:3.0,uv:0.7,ao:0.6});
    }
  });
}

/* ------------------------------------------------------------------ *
 *  The houses of the Upper City and the Ophel are OFF.
 *
 *  Unlike everything else in this model they were not evidence for
 *  anything: a seeded scatter of plausible-looking blocks, placed by slope
 *  and distance rather than by any excavated plan. Shown alongside walls
 *  measured to the centimeter they implied a precision that was not there,
 *  so they are switched off rather than deleted—flip this to true to get
 *  them back, and see the git history for the version that had them.
 *
 *  What remains in the `city` layer is all evidenced: the topography, the
 *  Herodian street and its shops along the western wall, and the causeway
 *  Wilson's Arch carried.
 * ------------------------------------------------------------------ */
const SHOW_CITY_BUILDINGS = false;

function buildCity(B){
  const rand = mulberry32(20250724);
  /* the Upper City on the western hill, and the Ophel to the south */
  let placed = 0;
  for(let i=0;i<900 && placed<230 && SHOW_CITY_BUILDINGS;i++){
    const x = -430 + rand()*760;
    const z = -180 + rand()*860;
    const out = outsidePlatform(x,z);
    if(out < 26) continue;                                  // keep clear of the walls
    const g = groundLevel(x,z);
    if(g < -34) continue;                                   // not in the valley beds
    /* slope test—nobody builds on the cliff */
    const s = Math.abs(groundLevel(x+7,z)-g) + Math.abs(groundLevel(x,z+7)-g);
    if(s > 4.4) continue;
    /* leave the Kidron and Olivet flanks empty */
    if(x > 330 && z > -60) continue;
    /* and keep the whole southern approach clear: the plaza, the great
       staircase and the ritual baths occupy it */
    if(z > PLAT.SW[1]-4 && z < PLAT.SW[1]+78 &&
       Math.abs(x-SOUTH_STAIR.cx) < SOUTH_STAIR.wTot/2 + 30) continue;
    /* likewise the Herodian street and its frontage below the west wall */
    if(x > -40 && x < 6 && z > 60) continue;
    const w = 5 + rand()*9, d = 5 + rand()*9;
    const h = 3.4 + rand()*4.6;
    const rot = (rand()-0.5)*0.5;
    B.pushT(x, g-1.2, z); B.pushRotY(rot);
    B.box('house','city',{x:0,z:0,y:0,sx:w,sy:h+1.2,sz:d,uv:1/6,ao:1,grad:0.18,skip:'B'});
    B.slabRoof('paving','city',{x:0,z:0,y:h+1.2,sx:w,sz:d,t:0.35,cornice:0.35,
                                parapet:0.5,uv:0.2});
    if(rand()<0.3)   // an upper room on some houses
      B.box('house','city',{x:(rand()-0.5)*w*0.3,z:(rand()-0.5)*d*0.3,y:h+1.55,
                            sx:w*0.5,sy:2.5,sz:d*0.5,uv:1/6,ao:1,skip:'B'});
    B.pop(); B.pop();
    placed++;
  }
  /* the causeway that Wilson's Arch carried, running west to the Upper City */
  const wz = PLAT.SW[1] - GATES.wilson.at;
  B.part('wilson',{name:INFO.wilson.n, key:'wilson', at:[-60,4,wz]},()=>{
    /* Wilson's is the easternmost of fifteen arches carrying a street—and an
       aqueduct—from the Upper City. The deck is level with the pavement, so
       the gate at its eastern end opens straight onto the esplanade. */
    const span = GATES.wilson.span, deck = ESP - 0.45;
    /* ONE WIDTH FOR THE WHOLE ARCADE—ring, spandrel, piers, embankment and
       the roadway slab on top. The slab was 13 m over a 14 m arcade, so the
       ring's crown, which rises through the slab's underside and is meant to be
       buried in it, stood half a meter clear of it down either side. */
    const W = 14, roadU = deck - 0.9;         // width, and the deck's underside
    const spring = deck - (span/2 + 1.9);
    let x = -(span/2 + 1.2), bays = 0, west = -1;
    while(bays < 15){
      const pg = groundLevel(x - span/2 - 2.6, wz);
      if(pg > spring - 1.6) break;              // the hill has risen to the deck
      B.arch('ashlar','city',{x, z:wz, y:spring, span, thick:1.6, depth:W,
                              axis:'x', seg:12, uv:0.22});
      archSpandrel(B,'ashlar','city',{x, z:wz, y:spring, span, thick:1.6,
                                      depth:W, axis:'x', seg:12,
                                      deckY:roadU, uv:0.22, ao:0.95});
      /* THE PIER GOES UP TO THE ROADWAY, not to a meter above the springing.
         The spandrel either side reaches only R+th from its own arch's center,
         which is 8.1 m out of the 9.1 m to the pier's center, so a pier stopped
         at the springing left two meters of open sky over it running the whole
         height of the haunch—the rectangular hole you could see the hillside
         through above every pier of this arcade. The eastern causeway's piers
         already run the full height, which is why it had no such hole. */
      B.box('ashlar','city',{x:x - span/2 - 2.6, z:wz, y:pg, sx:5.2,
                             sy:roadU-pg, sz:W, uv:0.22, ao:0.85, grad:0.2});
      west = x - span/2 - 5.2;
      x -= (span + 5.2);
      bays++;
    }
    /* Beyond the last arch the ground is close enough to the deck that the
       causeway ran on a solid embankment. Carry it until the two meet, so the
       roadway does not simply stop in the air. */
    let ax = west;
    for(let k=0;k<90 && groundLevel(ax, wz) < deck - 0.35; k++) ax -= 3;
    if(ax < west){
      const gLo = Math.min(groundLevel(west,wz), groundLevel(ax,wz)) - 2.0;
      B.box('ashlar','city',{x:(west+ax)/2, z:wz, y:gLo, sx:west-ax,
                             sy:deck-gLo, sz:W, uv:0.22, ao:0.9, grad:0.24});
    }
    /* the roadway, its parapets, and the aqueduct channel alongside */
    /* The roadway stops at the face of the retaining wall. Carried two meters
       past it, the deck and its parapets ran on into the masonry and came out
       looking as though the causeway had been driven through the platform. */
    const wallFace = PLAT.SW[0] - WALLS.thick/2;
    const from = Math.min(ax, west) - 4, len = wallFace - from;
    B.box('paving','city',{x:from+len/2, z:wz, y:roadU, sx:len, sy:deck-roadU,
                           sz:W, uv:0.14, ao:1});
    for(const sd of [-1,1])
      B.box('ashlarFine','city',{x:from+len/2, z:wz+sd*(W/2-0.4), y:deck, sx:len,
                                 sy:1.1, sz:0.8, uv:0.4, ao:0.95});
    B.box('ashlarFine','city',{x:from+len/2, z:wz+5.5, y:deck, sx:len, sy:0.8,
                               sz:1.5, uv:0.5, ao:0.9});
    /* two steps up from the deck to the pavement at the gate */
    B.stairs('paving','city',{x:wallFace-1.2, z:wz, y:deck, n:2, rise:0.24,
                              tread:1.1, w:9, dir:'E', uv:0.5});
  });
}

/* Gates that pierce the masonry standing ABOVE the esplanade—the back wall
   of the colonnades—and therefore interrupt the crowning pilaster order.
   Given along each retaining-wall run from the corner that run starts at,
   which is the frame both the wall and the order are set out in. `w` is the
   width to keep clear, not the width of the opening: at the Shushan Gate the
   whole gatehouse block stands proud of the wall face. */
const HEAD_OPENINGS = {
  N: [],
  E: [ { at:GATES.shushan.at,  w:GATES.shushan.w + 9.0 } ],
  S: [],
  W: [ { at:GATES.robinson.at, w:5.6 + 3.4 },
       { at:GATES.wilson.at,   w:GATES.wilson.w + 9.0 } ],
};

/* =====================================================================
 *  RETAINING WALLS
 * ===================================================================== */
function buildRetainingWalls(B){
  const sides = [
    ['N', PLAT.NW, PLAT.NE], ['E', PLAT.NE, PLAT.SE],
    ['S', PLAT.SE, PLAT.SW], ['W', PLAT.SW, PLAT.NW],
  ];
  B.beginPart('platform',{name:INFO.platform.n, key:'platform',
                          at:[PLAT.SE[0]+8, 6, PLAT.SE[1]+8]});
  for(const [name,a0,b0] of sides){
    /* Carry each run half a wall-thickness past both corners so the four
       overlap. Built exactly corner-to-corner with caps:false, the ends were
       open and you could see straight through the corner into the fill. */
    const L0 = Math.hypot(b0[0]-a0[0], b0[1]-a0[1]);
    const ux = (b0[0]-a0[0])/L0, uz = (b0[1]-a0[1])/L0;
    /* Just far enough to reach the adjoining wall's outer face. At half a
       thickness PLUS a margin each run stuck a 2.6 m stub out past the corner,
       and the corner read as an outdent from outside. */
    const ext = WALLS.thick/2;
    const a = [a0[0]-ux*ext, a0[1]-uz*ext];
    const b = [b0[0]+ux*ext, b0[1]+uz*ext];
    const len = L0 + 2*ext;
    const n = Math.ceil(len/11);
    for(let i=0;i<n;i++){
      const t0=i/n, t1=(i+1)/n;
      const p0=[lerp(a[0],b[0],t0), lerp(a[1],b[1],t0)];
      const p1=[lerp(a[0],b[0],t1), lerp(a[1],b[1],t1)];
      /* sample the ground a little outside the face */
      const mx=(p0[0]+p1[0])/2, mz=(p0[1]+p1[1])/2;
      const ox=mx + (mx-150)*0.02, oz=mz + (mz-240)*0.02;
      const g = Math.min(groundLevel(ox,oz), groundLevel(mx,mz));
      /* Herodian walls run far below the contemporary surface—
         Warren found 19 more courses beneath the street */
      const base = g - 15;
      /* THE COURSES DIMINISH AS THE WALL RISES. Herod's masons put the great
         stones at the bottom and worked smaller upward: at the Western Wall
         the courses at the level of the ancient street run to a couple of
         meters and the master course is larger still, while those near the top
         are nearer a meter. Built at one scale the whole wall reads as a
         regular grid, which is the giveaway that nobody laid it.

         Each band is a separate run with its own `uv`, which shrinks the
         courses AND the blocks together—four blocks and four courses to a
         tile, so one number does both, which is also how it works in a quarry.
         The cuts fall at -7.2 and -21.6 because those are whole courses in
         BOTH the bands that meet there (1.2 · 6, 1.8 · 4, and 2.4 · 9), so no
         stone is left sliced through at the join. */
      const BANDS = [[ESP,    1/4.8],     // 1.2 m courses, the top 7.2 m
                     [-7.2,   1/7.2],     // 1.8 m
                     [-21.6,  1/9.6]];    // 2.4 m, and everything below
      const H = ESP - base;
      for(let bi=0; bi<BANDS.length; bi++){
        const yHi = Math.min(BANDS[bi][0], ESP);
        const yLo = Math.max(bi+1 < BANDS.length ? BANDS[bi+1][0] : base, base);
        if(yHi - yLo < 0.05) continue;
        /* the batter is one lean over the whole height, shared out between the
           bands—given to each in full, the face comes out as a flight of
           steps; and the same for the gradient that shades the foot */
        const inset = y => 0.35 * (y - base)/H;
        const shade = y => lerp(0.78, 1, (y - base)/H);
        B.wall('ashlar','base',{
          from:p0, to:p1, y0:yLo, y1:yHi, thick:WALLS.thick,
          uv:BANDS[bi][1], uStart:len*t0, caps:false,
          batter0:inset(yLo), batter:inset(yHi),
          ao:shade(yHi), grad:1 - shade(yLo)/shade(yHi),
          /* THE TOPMOST BAND KEEPS ITS TOP FACE. The retaining wall is 4.6 m
             thick and battered, so its head stands 0.85 m proud of the 2.2 m
             head wall above it—an offset course, which Herodian walls have.
             Suppressed along with the others, that ledge had no surface at all,
             and between the pilasters (which are only 2.1 m wide every 4.4 m)
             you looked straight down into the hollow of the wall. From below it
             read as a slot running the whole way round the complex. */
          top: bi===0,
        });
      }
    }

    /* THE CROWNING PILASTER ORDER—the shallow applied order Ritmeyer
       restores from the surviving upper masonry, and which survives complete
       on Herod's enclosure over the Cave of the Patriarchs at Hebron, the
       closest parallel there is: pilasters about a cubit and a half wide,
       projecting only a hand's breadth or two, with recessed panels between.
       It belongs on the courses that stand ABOVE the esplanade—the back wall
       of the colonnade—so that seen from outside it reads at the same level
       as the columns inside, capital for capital. Below it the wall is the
       plain massive ashlar the excavations show.

       Two things it must get right. The projection is shallow: given the depth
       of the retaining wall to stand on, a pilaster reads as a free rib with a
       shadow down both sides. And it steps round the gates: set out blind, a
       shaft lands in the middle of every opening and stands in the gateway. */
    if(WALLS.pilasterTop){
      const pH   = PORTICO.colH;                  // the interior column height
      const nx   = uz, nz = -ux;                  // outward normal of this run
      const face = WALLS.head/2;                  // the head wall's outer face
      const gaps = HEAD_OPENINGS[name] || [];
      const bays = Math.max(1, Math.round(L0/PORTICO.spacing));
      const bay  = L0/bays;
      for(let k=0;k<bays;k++){
        const sAt = (k+0.5)*bay;
        if(gaps.some(g => Math.abs(sAt-g.at) < g.w/2 + 1.2)) continue;
        /* AND IT STOPS AT THE ANTONIA. The order is applied to the head wall—
           the back of the colonnade—and where the fortress stands there is no
           colonnade and no head wall to apply it to. Run blind across, its
           lower ten meters were buried in the scarped rock and only the shafts'
           tops and their capitals stood out of the ledge, in a row, like a line
           of broken columns growing out of the stone. */
        if(name==='N' && sAt < ANT_JOIN.N + bay*0.5) continue;
        if(name==='W' && sAt > WALL_LEN.W - bay*0.5) continue;
        const cx0 = a0[0]+ux*sAt, cz0 = a0[1]+uz*sAt;
        /* B.wall carries the orientation, so a member is given as a short run
           along the wall, offset outward and thickened across it. */
        /* An applied order is cut from the same coursed masonry as the wall it
           is applied to, so every member is given the wall's own texture scale
—1/9.6, `ashlarFine`, as the head wall behind it. What it must NOT
           be given is u = 0.

           At 1/9.6 a block is 2.4 m and a pilaster shaft is 1.6 m wide. Started
           at u = 0 every shaft showed the same two-thirds of the same block,
           cut off mid-stone at one edge, which is why the order read as a row
           of broken pieces. `uStart` puts the short members inside a single
           block, so a shaft is one clean stone per course; the architrave is
           long enough to want real joints, so it takes its position along the
           run and the coursing carries from bay to bay. */
        const member = (w, dep, proj, y0, y1, mat, uv, uStart) => {
          const off = face + proj - dep/2;
          B.wall(mat,'base',{
            from:[cx0-ux*w/2 + nx*off, cz0-uz*w/2 + nz*off],
            to:  [cx0+ux*w/2 + nx*off, cz0+uz*w/2 + nz*off],
            y0, y1, thick:dep, uv, uStart, ao:1, grad:0.10 });
        };
        const UW = 1/9.6, INSET = 0.42;      // clear of the drafted margin
        member(2.1, 1.45, 0.68, ESP,        ESP+0.9,     'ashlarFine', UW, INSET);
        member(1.6, 1.20, 0.48, ESP+0.9,    ESP+pH-1.0,  'ashlarFine', UW, INSET);
        member(2.1, 1.45, 0.68, ESP+pH-1.0, ESP+pH,      'ashlarFine', UW, INSET);
        /* a continuous architrave over the capitals, which is what makes the
           order read as an order rather than as a row of separate ribs */
        member(bay, 1.40, 0.58, ESP+pH,     ESP+pH+0.85, 'ashlarFine', UW,
               sAt - bay/2);
      }
    }
  }

  /* ---- QUOINS AT THE THREE EXPOSED CORNERS -----------------------------
     The retaining wall runs overlap at the corners, but the CROWN above the
     esplanade does not: each colonnade's head wall is built from end to end
     along its own line and stops there, so the outside corner was a square
     notch with daylight through the joint—which is the gap you see at the
     northeast corner from below, at the level of the pilasters. Below the
     esplanade the runs overshot instead, and the corner read as an outdent.
     A quoin covers the joint at both levels and stands a little proud of both
     faces, which is what the surviving Herodian corners do anyway.

     Each is set out on the bearing of the wall running INTO the corner, so it
     sits square with the masonry at a junction that is not a right angle.
     The northwest needs none: the Antonia's rock is the corner there. */
  for(const [into, corner, top] of [
        [PLAT.NW, PLAT.NE, ESP + PORTICO.colH + 5.0],       // to the porch ridge
        [PLAT.NE, PLAT.SE, ESP + STOA.aisleRoof + 0.15],    // to the Stoa's roof
        [PLAT.SE, PLAT.SW, ESP + STOA.aisleRoof + 0.15]]){
    const dx = corner[0]-into[0], dz = corner[1]-into[1];
    const l = Math.hypot(dx,dz) || 1;
    const g = groundLevel(corner[0], corner[1]) - 15;
    const sq = WALLS.thick + 0.6;
    B.pushT(corner[0], 0, corner[1]);
    B.pushRotY(Math.atan2(-dz/l, dx/l));
    B.box('ashlar','base',{x:0, z:0, y:g, sx:sq, sy:top-g, sz:sq,
                           uv:1/9.6, ao:1, grad:0.34, skip:'TB'});
    B.box('ashlarFine','roofs',{x:0, z:0, y:top, sx:sq+0.9, sy:0.9, sz:sq+0.9,
                                uv:0.3, ao:1, aoBot:0.6});
    B.pop(); B.pop();
  }
  B.endPart();

  /* The valley itself carries no geometry of its own—the terrain sheet
     is it—but it needs a pickable volume, so register one that is never
     drawn. */
  B.part('kidron',{name:INFO.kidron.n, key:'kidron',
                   at:[PLAT.SE[0]+70, -26, PLAT.SE[1]-140]},()=>{
    B.box('rock','nodraw',{x:PLAT.NE[0]+120, z:260, y:-95, sx:200, sy:95, sz:520, uv:1});
  });
}

/* the esplanade pavement, and the low parapet the colonnades stood on */
function buildEsplanade(B){
  B.part('gentiles',{name:INFO.gentiles.n, key:'gentiles', at:[190,1,300]},()=>{
    B.poly('paving','base', PLAT_RING, ESP, 1/8.2, 1);
  });
}

/* =====================================================================
 *  COLONNADES—Josephus, War 5.190–192
 *  Double rows of monolithic marble columns 25 cubits high, in a
 *  portico 30 cubits deep, roofed with cedar.
 * ===================================================================== */
function buildPortico(B,a,b,o){
  const len = frameAlong(B,a,b);
  const D = PORTICO.depth, H = PORTICO.colH;
  /* clear of the architrave (H+2.35) and the cedar ceiling above it.
     A LOW PITCH, BECAUSE THE ROOF IS WALKED ON. War 2.12: at the feast "a Roman
     cohort stood over the cloisters of the temple, for they always were armed,
     and kept guard at the festivals"—and the Antonia's posterns open onto
     these roofs at eave level. At the old 3.2 m rise over a half-depth of 7.9 m
     the roof was a 22° slope and a door at the eaves opened underneath it. */
  const eave = H + 3.4, ridge = H + 5.0;
  const from = o.from||0, to = o.to===undefined?len:o.to;
  const run = to - from;
  if(run < 12){ popFrame(B); return; }

  /* The outer wall, standing on the retaining wall—pierced where a gate
     comes up from outside. `o.gates` are {at, w, h} in along-wall meters.

     `headFrom` starts the head wall short of the colonnade's own run: along the
     Antonia the back wall of the northern colonnade is the fortress's scarp,
     which is what the surviving roof-beam sockets are cut into, so the platform
     builds no head wall of its own there. */
  const gates = o.gates || [];
  /* `headFrom` runs the head wall on its OWN extent—it may begin before the
     colonnade as well as after it. Along the Antonia the scarp is the back wall
     and the platform builds none of its own; at the southwest corner the
     opposite, the crown carries on across the Royal Stoa's end (and Robinson's
     gate is in it) while the western colonnade stops short of the Stoa. */
  const hFrom = o.headFrom===undefined ? from : o.headFrom;
  if(hFrom < to - 1){
  wallOpen(B,'ashlarFine','base',{from:[hFrom,0.0], to:[to,0.0], y0:ESP, y1:eave,
    thick:WALLS.head, uv:1/9.6, ao:1, grad:0.16,
    /* `full` cuts the wall through to the head: the Shushan Gate is a
       projecting gatehouse that fills its own slot, vault and all. */
    openings: gates.map(g=>({at:g.at-hFrom, w:g.w,
                             h:g.full ? eave-ESP : g.h}))});
  }
  for(const g of gates){
    /* A `full` gate cuts the wall clean through to the head and dresses its own
       opening—the Shushan gatehouse does—so none of the reveal furniture
       below belongs to it. It also has no `h` of its own here, and every
       dimension taken from one would be a NaN. */
    if(g.full) continue;
    /* jambs, lintel and a cornice, so it reads as a gate and not a hole */
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:g.at+sd*(g.w/2+0.85), z:0.2, y:ESP,
        sx:1.7, sy:g.h+1.1, sz:3.0, uv:0.26, ao:1, grad:0.1});
    /* Set a hand's breadth into the wall above rather than exactly at its
       foot: laid flush, the lintel's bottom face and the wall's soffit were
       coplanar and the gate head flickered between the two as the camera
       moved. */
    B.box('ashlarFine','base',{x:g.at, z:0.2, y:ESP+g.h-0.08,
      sx:g.w+3.4, sy:1.58, sz:3.0, uv:0.26, ao:1});
    B.box('ashlarFine','roofs',{x:g.at, z:0.2, y:ESP+g.h+1.5,
      sx:g.w+5.0, sy:0.9, sz:3.8, uv:0.3, ao:1, aoBot:0.6});
    /* A lit reveal rather than a black box: side walls, a coffered soffit and
       a threshold, with the darkness pushed back behind them. */
    B.box('paving','base',{x:g.at, z:1.6, y:ESP-0.5, sx:g.w, sy:0.55, sz:3.6,
      uv:0.5, ao:0.9});
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:g.at+sd*(g.w/2+0.55), z:1.6, y:ESP,
        sx:1.1, sy:g.h, sz:3.6, uv:0.3, ao:1, grad:0.14});
    B.box('cedar','base',{x:g.at, z:1.6, y:ESP+g.h-0.45, sx:g.w, sy:0.45,
      sz:3.6, uv:0.5, ao:0.82, aoBot:0.55});
    /* A dark panel behind the reveal, so a gate that runs into a tunnel does
       not show the colonnade through it. Wilson's does not run into a tunnel:
       the causeway arrives level with the pavement and you should see straight
       through the opening onto the esplanade, and out of it from inside, the
       way the Shushan Gate reads. */
    if(!g.through)
      B.box('shadow','base',{x:g.at, z:3.6, y:ESP, sx:g.w, sy:g.h, sz:1.2,
        uv:0.4, ao:0.34});
  }
  /* raise it to the ridge as a gable-backed wall */
  if(hFrom < to - 1)
    B.wall('ashlarFine','roofs',{from:[hFrom,0.0],to:[to,0.0],y0:eave,y1:ridge,
      thick:WALLS.head, uv:1/9.6, uStart:hFrom, caps:false, ao:1});

  /* two rows of columns—stepping round any gate that is a way THROUGH at the
     level of the pavement. A `full` gate is a gatehouse with a road running out
     of it, and a column landed in the middle of the Wilson's Arch gateway and
     stood in the road; the same rule the Court of the Women's gallery needs. */
  const rows = [D*0.34, D*0.90];
  const nCol = Math.floor(run / PORTICO.spacing);
  const gap  = run / nCol;
  /* `noCols` are stretches where something else stands in the colonnade and a
     column would be half buried in it—the landing at the head of the Antonia's
     great stair had one sliced down the middle. */
  const bare = o.noCols || [];
  const inGateway = at => gates.some(g => g.full &&
                                     Math.abs(at - g.at) < g.w/2 + PORTICO.colD);
  const inBare = at => bare.some(([a,b]) => at > a && at < b);
  for(const rz of rows){
    for(let i=0;i<=nCol;i++){
      const at = from+i*gap;
      if(inGateway(at) || inBare(at)) continue;
      B.column({mat:'marble', x:at, z:rz, y:ESP, d:PORTICO.colD, h:H,
                order:'corinthian', seg:12, lod:0, uvU:0.34});
    }
  }
  /* architraves over each row */
  for(const rz of rows){
    B.box('ashlarFine','base',{x:(from+to)/2, z:rz, y:ESP+H, sx:run, sy:1.5,
                               sz:PORTICO.colD*1.85, uv:0.22, ao:1, aoBot:0.6});
    B.box('ashlarFine','base',{x:(from+to)/2, z:rz, y:ESP+H+1.5, sx:run, sy:0.85,
                               sz:PORTICO.colD*2.1, uv:0.3, ao:1, aoBot:0.7});
  }
  /* cedar-coffered ceiling over the two aisles */
  B.box('cedar','roofs',{x:(from+to)/2, z:D*0.62, y:ESP+eave-1.0, sx:run, sy:0.35,
                         sz:D*0.95, uv:0.5, ao:0.9, aoBot:0.66});
  /* And the roof over it, which GOES OUT OVER THE HEAD OF A CROSS-WALL where it
     is asked to. The roof stops on the wall's centerline, so the outer half of
     a 2.2 m wall is left showing between this roof and whatever stands past it.
     At the southwest that is a 0.6 m strip of bare wall head, 18 m long, lying
     between this roof and the Royal Stoa's aisle roof—from above a bright
     rectangle at the one corner, with nothing like it at the other. `roofOver`
     is per end because at the platform's corners a portico runs into a corner
     bay, which already has its own roof over the junction. */
  const over = o.roofOver || [0,0];
  B.pushT((from+to)/2 + (over[1]-over[0])/2, 0, 0);
  B.gableRoof('roof','roofs',{x:0, z:D*0.5, y:ESP+eave, sx:run+over[0]+over[1],
                              sz:D*1.06,
                              ridgeH:ridge-eave, ridge:'x', overhang:0.7,
                              overhangEnd:0, uv:0.22, gableMat:'ashlarFine'});
  B.pop();
  /* Cross-walls closing the ends of the run, so you cannot look along the
     colonnade from outside the platform at a corner. `{y0, at, w, h}` instead
     of `true` is the Antonia end: the bottom of it is closed by the scarped
     rock, so the wall starts at the rock's top, and the descent coming out of
     the rock needs a doorway through it—built blind, the flight climbed to
     the head of the passage and stopped under nine meters of masonry. */
  const cap = o.capEnds || [false,false];
  for(const [end,on,ov] of [[from,cap[0],over[0]],[to,cap[1],over[1]]]){
    if(!on) continue;
    const c = (typeof on === 'object') ? on : {};
    /* HOW HIGH IT GOES DEPENDS ON WHETHER THE ROOF IS OVER IT. Carried to the
       ridge it is a flat head 2.2 m thick, while the roof it closes only reaches
       the ridge along one line and slopes away from it both ways—so the wall
       stands proud of its own roof for the colonnade's whole 18 m depth, which
       from above is a bare stone rectangle lying across the tiles. It goes
       unnoticed at the corners because a corner bay stands over it, and at the
       southeast because the Stoa's south wall is 1.7 m taller and in front of
       it; at the southwest there was nothing to hide it. Where the roof has
       been carried out over this end the roof closes the section above, so the
       wall stops below the eaves' own soffit and disappears under it. */
    wallOpen(B,'ashlarFine','base',{from:[end,-1.2], to:[end,D+1.4],
      y0:(c.y0 !== undefined ? c.y0 : ESP), y1:ov>0 ? ESP+eave : ridge,
      thick:2.2, uv:1/9.6, ao:1, grad:0.14,
      openings: c.w ? [{at:c.at+1.2, w:c.w, h:c.h}] : []});
  }

  /* cornice at the open edge */
  B.box('ashlarFine','roofs',{x:(from+to)/2, z:D*1.03, y:ESP+eave-0.5, sx:run, sy:0.7,
                              sz:1.1, uv:0.3, ao:1, aoBot:0.6});
  popFrame(B);
}

/* ------------------------------------------------------------------ *
 *  Where two colonnades meet at a corner of the platform, neither run
 *  reaches round it and the corner stood open. A peristyle normally closes
 *  such a junction with a solid corner bay, which is what these are. The
 *  northwest corner needs none: the Antonia occupies it.
 * ------------------------------------------------------------------ */
function buildCornerBay(B, corner, aTo, bTo, id, name){
  const D = PORTICO.depth, eave = PORTICO.colH + 3.4;
  /* unit vectors from the corner along each of the two adjoining walls */
  const u = (p)=>{ const dx=p[0]-corner[0], dz=p[1]-corner[1];
                   const l=Math.hypot(dx,dz); return [dx/l, dz/l]; };
  const a = u(aTo), b = u(bTo);
  const inward = [ (a[0]+b[0]), (a[1]+b[1]) ];
  const il = Math.hypot(inward[0],inward[1]) || 1;
  const cx = corner[0] + inward[0]/il * D*0.78;
  const cz = corner[1] + inward[1]/il * D*0.78;
  B.part(id,{name, key:'gentiles', at:[cx, eave, cz]},()=>{
    B.pushT(cx, 0, cz);
    B.pushRotY(Math.atan2(-a[1], a[0]));
    B.box('ashlarFine','base',{x:0,z:0,y:ESP,sx:D*1.5,sy:eave,sz:D*1.5,
                               uv:1/9.6,ao:1,grad:0.16,skip:'B'});
    B.slabRoof('roof','roofs',{x:0,z:0,y:ESP+eave,sx:D*1.5,sz:D*1.5,
                               t:1.0,cornice:0.9,uv:0.24});
    B.pop(); B.pop();
  });
}

function buildPorticoes(B){
  /* Only the northeast corner needs one. At the two southern corners the
     Royal Stoa runs the length of the wall and its own end walls close the
     junction—and a bay at the southwest sat squarely on top of the gate at
     the head of Robinson's stair. */
  buildCornerBay(B, PLAT.NE, PLAT.NW, PLAT.SE, 'cornerNE',
                 'The northeast corner bay');
  /* north—runs west along the FRONT of the Antonia's scarp, whose surviving
     roof-beam sockets are the evidence that it did. So it begins where the
     great stair up to its roof ends, and for its first 40 m the fortress's own
     south front is its back wall: no head wall of the platform's own until the
     scarp runs out (`headFrom`), and no cross-wall at that end either, because
     the scarp closes it. */
  B.part('northPortico',{name:'The northern colonnade', key:'gentiles',
                         at:[220,16,20]},()=>{
    buildPortico(B, PLAT.NW, PLAT.NE, {from:ANT_STAIR.sEnd, to:WALL_LEN.N,
      headFrom:ANT_JOIN.N, capEnds:[false,true],
      /* the landing at the head of the great stair stands in the first bay */
      noCols:[[0, ANT_STAIR.sEnd + 1.2]]});
  });
  /* east—Solomon's Porch, the full 460 m */
  B.part('solomons',{name:INFO.solomons.n, key:'solomons',
                     at:[...(()=>{const p=[PLAT.NE[0]-14,PLAT.NE[1]+230];return [p[0],16,p[1]];})()]},()=>{
    buildPortico(B, PLAT.NE, PLAT.SE, {from:0, to:WALL_LEN.E,
      capEnds:[true,true],
      gates:[{at:GATES.shushan.at, w:GATES.shushan.w, full:true}]});
  });
  /* west—interrupted by the Antonia at the north end */
  B.part('westPortico',{name:'The western colonnade', key:'gentiles',
                        at:[12,16,300]},()=>{
    /* Run right up to the corner in the north, where Josephus says the western
       and northern colonnades met and the fortress joined them both: its north
       end needs no cross-wall, because the Antonia's rock closes it below and
       the fortress's south front—which its roof runs into—closes it above.

       IN THE SOUTH IT STOPS AT THE ROYAL STOA. The Stoa is 37.6 m deep and runs
       the whole length of the south wall, so its west end fills this corner; the
       colonnade used to carry on 32 m INTO it, interleaving two sets of columns
       and standing one of them in the road at the head of Robinson's stair. The
       CROWN carries on across the corner all the same (`headFrom`), because it
       is the platform's edge and Robinson's gate is in it. */
    /* IT ENDS AGAINST THE STOA, at 40. Its cross-wall is 2.2 m thick and centered
       on this station, so it runs to z 446.1 and laps the Stoa's aisle roof at
       445.6 and its end wall at 445.8. At 41 it stopped 0.5 m short of both, and
       that 0.5 m—the full 18 m of the colonnade's depth, from the pavement to
       the roofs—was a slot; it used to be covered by a block thrown across the
       joint, which from above was a rectangle sitting north of the Stoa with no
       counterpart at the other corner. Two walls that meet need no third thing
       over the join. At 39, which is what was tried before the block, the
       cross-wall reached past the Stoa's northern row of columns. */
    /* AND THE CROWN HAS TO REACH THE QUOIN. At `headFrom` 6 it stopped six
       meters short of the corner while the quoin, half of 5.2 m square, only
       reaches 2.6 m along—so between them stood 3.4 m of no crown at all,
       open the full sixteen meters from the pavement to the head of the wall,
       immediately south of Robinson's gate. The pilaster order is applied to
       the retaining wall below and does not stop there, so one whole pilaster
       stood over the hole with nothing behind it. 1.0 puts the end of the
       crown 1.6 m inside the quoin, which is what a quoin is for. */
    buildPortico(B, PLAT.SW, PLAT.NW, {from:40, to:ANT_JOIN.W, headFrom:1.0,
      /* the two ways in from the west: the stair on Robinson's Arch, which
         opened into the Royal Stoa at the corner, and the causeway on
         Wilson's, which arrived level with the pavement */
      /* the roof out over the cross-wall's head at the Stoa end, where the
         Stoa's own aisle roof takes over 0.5 m further on */
      capEnds:[true,false], roofOver:[1.2,0],
      /* Robinson's is a way THROUGH, so no dark panel behind it. The stair on
         the arch climbs to a gate at the level of the esplanade: from the head
         of the stair you look into the porch, and from the porch you look out
         over the stair and down the valley. Panelled dark it was a black hole
         in the wall that flashed in and out of view as you moved past it, and
         it claimed the gate ran into a tunnel, which is Barclay's and Warren's,
         not this one. */
      gates:[ {at:GATES.robinson.at, w:5.6,  h:8.4, through:true},
              /* `full` cuts the head wall through to its head and leaves the
                 gatehouse to dress its own opening, as at the Shushan Gate */
              {at:GATES.wilson.at, w:GATES.wilson.w, full:true} ]});
  });
}

/* =====================================================================
 *  THE ROYAL STOA—Josephus, Antiquities 15.411–416
 * ===================================================================== */
function buildRoyalStoa(B){
  B.part('royalStoa',{name:INFO.royalStoa.n, key:'royalStoa',
                      at:[150, STOA.ridge, PLAT.SE[1]-18]},()=>{
    const len = frameAlong(B, PLAT.SE, PLAT.SW);      // local +X: SE corner -> SW
    const D = STOA.aisleS + STOA.nave + STOA.aisleN;  // 34.6 m
    const inset = 3.0;                                // set in from the wall face

    /* ONE pair of end faces, and every element clamped to them. What was here
       before was a dozen slightly different extents—run+2, run+3, run+4,
       to+1, to+6—several of which reached past the end walls, so wall stubs
       and roof slabs cantilevered off both ends of the building into thin air. */
    /* THE SAME INSET AT BOTH ENDS, which is what keeps this building's end walls
       against the colonnade head walls that meet them. At 2.2 an end wall's outer
       face lands 0.1 m behind the head wall outside it—a hand's breadth, so the
       two read as one mass of masonry and the aisle roof laps from one onto the
       other. The west end used to be set in at 4.0, and the 1.9 m that left
       between it and the crown was a slot open to the sky for 38 m, with
       Robinson's gate a hole through both walls and nothing over the space
       between them. */
    const xE = 2.2, xW = len - 2.2;                   // the two end faces
    const xM = (xE + xW)/2, xL = xW - xE;             // center and length
    const colFrom = xE + 11, colTo = xW - 9;          // the colonnade within them
    const run = colTo - colFrom, gap = run/(STOA.perRow-1);

    const rowZ = [ inset, inset+STOA.aisleS, inset+STOA.aisleS+STOA.nave,
                   inset+D ];
    const zc = (rowZ[1]+rowZ[2])/2;                   // the nave's center line
    const R  = STOA.nave/2 + 0.6;                     // the exedra

    /* the southern wall, raised inside the Stoa, with engaged pilasters */
    B.wall('ashlarFine','base',{from:[xE-2,0], to:[xW+2,0], y0:ESP,
      y1:ESP+STOA.aisleRoof, thick:2.6, uv:1/9.6, ao:1, grad:0.14});

    /* 162 columns in four rows; the fourth engaged in the wall (Ant. 15.413) */
    for(let r=0;r<4;r++)
      for(let i=0;i<STOA.perRow;i++){
        const x = colFrom + i*gap;
        if(r===0)
          B.column({mat:'marble', x, z:rowZ[0]+0.4, y:ESP, d:STOA.colD*0.72,
                    h:STOA.colH, order:'corinthian', seg:12, lod:0, uvU:0.34});
        else
          B.column({mat:'marble', x, z:rowZ[r], y:ESP, d:STOA.colD,
                    h:STOA.colH, order:'corinthian', seg:16, flutes:20, uvU:0.3});
      }

    /* architraves along the three free rows */
    for(let r=1;r<4;r++){
      B.box('ashlarFine','base',{x:xM, z:rowZ[r], y:ESP+STOA.colH,
        sx:xL, sy:1.75, sz:STOA.colD*1.9, uv:0.2, ao:1, aoBot:0.55});
      B.box('ashlarFine','base',{x:xM, z:rowZ[r], y:ESP+STOA.colH+1.75,
        sx:xL, sy:0.9, sz:STOA.colD*2.2, uv:0.28, ao:1, aoBot:0.7});
    }

    /* The two side aisles: coffered cedar ceilings and shallow roofs. The
       southern aisle's roof runs back to the wall's centerline—stopping it at
       the first row of columns left a strip of open sky between the wall head
       and the roof. */
    for(const [z0,z1] of [[0, rowZ[1]], [rowZ[2], rowZ[3]+1.4]]){
      const zm=(z0+z1)/2, dz=z1-z0;
      B.box('cedar','roofs',{x:xM, z:zm, y:ESP+STOA.aisleRoof-1.7,
        sx:xL-1.0, sy:0.4, sz:dz-0.6, uv:0.45, ao:0.9, aoBot:0.66});
      /* CARRIED PAST BOTH END WALLS. The roofs ran xE to xW, which is the
         centerline of each end wall, so the outer half of both was left with no
         roof over it—at the western end that is over Robinson's gate. */
      /* THICKER THAN THE DROP TO THE WALL HEAD, so the roof buries itself in
         the southern wall instead of finishing flush with it: level, the wall's
         top face and the roof's top face were the same plane over a strip 1.7 m
         wide and 274 m long, and the gray flickered against the ashlar down the
         whole outer edge of the Stoa. */
      B.box('roof','roofs',{x:xM, z:zm, y:ESP+STOA.aisleRoof-0.9,
        sx:xL+3.0, sy:1.05, sz:dz+0.8, uv:0.22, ao:1, aoBot:0.6});
    }

    /* the clerestory over the nave, pierced by a window in every bay */
    for(const z of [rowZ[1], rowZ[2]]){
      const ops=[];
      /* AND ONE BEYOND THE END COLUMN AT EACH END. The colonnade is set in 11 m
         from the east face and 9 m from the west, but the clerestory runs the
         whole 275 m between them, so windowing only the bays BETWEEN columns
         left a blank panel a bay and a half wide standing over each end of the
         building—the two places the wall is seen end-on and foreshortened,
         where the blank read as the windows simply stopping. The rhythm has
         room for one more step past the last column at either end: the tighter
         west end still leaves 4.3 m of solid wall before the corner. */
      for(let i=-1;i<STOA.perRow;i++)
        ops.push({at:(colFrom+gap*(i+0.5))-xE, w:gap*0.42, h:4.2, sill:1.8});
      /* FOOTED BELOW THE ROOF IT STANDS ON. Started exactly at `aisleRoof` the
         clerestory's underside was the same plane as the exedra's ceiling, and
         the gray flickered in a band along the whole foot of it at the east
         end. A wall sitting on a roof has to be bedded into it. */
      wallOpen(B,'ashlarFine','roofs',{
        from:[xE,z], to:[xW,z], y0:ESP+STOA.aisleRoof-0.3, y1:ESP+STOA.cleryTop,
        thick:1.5, uv:1/9.6, ao:1, openings:ops});
    }
    B.box('cedar','roofs',{x:xM, z:zc, y:ESP+STOA.cleryTop-0.6,
      sx:xL-1.0, sy:0.5, sz:STOA.nave, uv:0.4, ao:0.9, aoBot:0.62});
    B.gableRoof('roofTile','roofs',{x:xM, z:zc, y:ESP+STOA.cleryTop,
      sx:xL, sz:STOA.nave+2.4, ridgeH:STOA.ridge-STOA.cleryTop, ridge:'x',
      overhang:1.1, overhangEnd:0, uv:0.3, gableMat:'ashlarFine'});

    /* THE END WALLS, full depth, both faces flush with xE and xW. BOTH SOLID:
       the eastern one used to be built in two bands with the exedra's chord left
       open between them, which put a sixteen-meter hole through the Stoa's east
       face—you looked in from over the Kidron and saw the inside of the nave.
       It went unnoticed because Solomon's Porch's gable-backed head wall stood
       just in front of it and covered the top of it; lowering the colonnade
       roofs to a pitch that can be walked uncovered it. The exedra is a niche
       in the INNER face of this wall (below), not a slot through it. */
    for(const xEnd of [xE,xW]){
      /* THE WESTERN END IS PIERCED FOR ROBINSON'S GATE. The stair on the arch
         climbs to a gate at the level of the esplanade twelve meters north of
         the southwest corner, and the gate there "opened into the Royal Stoa"—
         but this end wall stood across it, so the way in ran into blind masonry.
         The Stoa's frame maps local z straight onto distance north of the south
         wall, so the gate's station along this wall is the same twelve meters,
         less where the wall itself begins.

         A SHADE LARGER THAN THE OPENING IN THE CROWN, because the two walls now
         stand a hand's breadth apart and the reveal the colonnade builds for the
         gate runs through both of them. At the same 5.6 by 8.4 this wall's jambs
         and soffit landed in the same planes as that reveal's; 0.2 m of daylight
         round it leaves the reveal to be the thing you see, which it already is.
         There is no lintel or threshold of this wall's own for the same reason—
         the colonnade dresses this doorway, and a second lintel at the same
         height as the colonnade's flickered against it across the whole head. */
      const ops = xEnd===xW
        ? [{ at:GATES.robinson.at - (inset-1.6), w:5.8, h:8.6 }]
        : [];
      wallOpen(B,'ashlarFine','base',{from:[xEnd,inset-1.6], to:[xEnd,inset+D+1.6],
        y0:ESP, y1:ESP+STOA.aisleRoof, thick:2.0, uv:1/9.6, ao:0.95, grad:0.12,
        openings:ops});
      /* and up the gable, behind the clerestory—WINDOWED LIKE THE SIDES. The
         nave is lit from its two long walls for 275 m and then went blind at
         both ends, which is the one part of the clerestory you see square on:
         from over the Kidron in the east and from the crown in the west it was
         a solid panel of ashlar closing a run of forty-one windows. Two more,
         on the same sill and of the same height and width, set a single bay
         apart about the nave's center line—so the piers between and beside
         them come out at the 3.8 m of the piers along the sides, and the
         rhythm turns the corner instead of stopping at it. */
      const nave2 = STOA.nave/2 + 1.0;                // half this wall's run
      wallOpen(B,'ashlarFine','roofs',{
        from:[xEnd, rowZ[1]-1.0], to:[xEnd, rowZ[2]+1.0],
        y0:ESP+STOA.aisleRoof-0.3, y1:ESP+STOA.cleryTop, thick:2.0, uv:1/9.6,
        ao:0.95, openings:[-1,1].map(s=>
          ({at:nave2 + s*gap/2, w:gap*0.42, h:4.2, sill:1.8}))});
    }

    /* The eastern exedra, where the Sanhedrin is often placed. Josephus does
       not describe it; it is restored from comparable Roman basilicas. It is
       RECESSED west into the hall—an apse thrown outward from an end wall
       this close to the corner would hang off the edge of the platform.

       ITS MOUTH FACES THE NAVE. The curve ran the other way, bulging west with
       its chord at the end face, which made the recess open eastward out of the
       building instead of westward into it. Deepest point against the end wall,
       chord a full radius into the hall, and two short returns closing the
       space left behind the curve so it does not open into the aisles. */
    const apse = a => [ xE + R - R*Math.cos(a), zc + R*Math.sin(a) ];
    for(let i=0;i<12;i++){
      const a0=-Math.PI/2 + i*Math.PI/12, a1=-Math.PI/2+(i+1)*Math.PI/12;
      B.wall('ashlarFine','base',{from:apse(a0), to:apse(a1), y0:ESP,
        y1:ESP+STOA.aisleRoof, thick:1.8, uv:1/9.6, caps:false, ao:0.95});
    }
    for(const sd of [-1,1])
      B.wall('ashlarFine','base',{from:[xE+R, zc+sd*R], to:[xE+0.5, zc+sd*R],
        y0:ESP, y1:ESP+STOA.aisleRoof, thick:1.8, uv:1/9.6, ao:0.95});
    /* Its ceiling sits a shade BELOW the aisle roofs rather than flush with
       them: level, the two overlapped across a two-meter strip with the same
       top and bottom faces and the gray flickered along the whole east end. */
    /* AND IT MUST NOT REACH THE END WALL'S OUTER FACE. At R+2 wide its eastern
       edge landed in exactly the plane of that face—gray roof against stone
       wall, over a strip the width of the nave—and the foot of the clerestory
       above showed gray from some angles and stone from others. Half a meter
       narrower puts that edge inside the wall's thickness, where it belongs. */
    B.box('roof','roofs',{x:xE+R/2+0.5, z:zc, y:ESP+STOA.aisleRoof-1.05,
      sx:R+1.0, sy:1.05, sz:2*R+2, uv:0.22, ao:1, aoBot:0.6});
    /* two columns marking its mouth—160 in the rows, plus these, is 162 */
    for(const z of [zc-R*0.72, zc+R*0.72])
      B.column({mat:'marble', x:xE+R+1.6, z, y:ESP, d:STOA.colD, h:STOA.colH,
                order:'corinthian', seg:16, flutes:20, uvU:0.3});

    /* THE JOINT WITH THE WESTERN COLONNADE carries nothing of its own. It used to
       take a block thrown across it and capped in roofing, which read from above
       as a rectangle standing north of this building with no counterpart at the
       southeast corner, where Solomon's Porch simply runs into it. Both of the
       gaps it was covering are closed at their source now—the colonnade ends at
       40 and laps this building's north edge, and the end faces are symmetric, so
       the west end wall stands a hand's breadth behind the crown the whole way to
       the quoin. Two walls that meet need no third thing over the join. */

    /* the pavement of the Stoa, a shade finer than the open court */
    B.poly('marbleFloor','base',[[xE,inset],[xW,inset],
                                 [xW,inset+D],[xE,inset+D]], ESP+0.06, 1/7, 1);
    popFrame(B);
  });
}

/* =====================================================================
 *  THE ANTONIA—Josephus, War 5.238–247
 *
 *  Built entirely in the NORTHERN COLONNADE'S frame: local x is the station
 *  along the north wall from the platform's northwest corner, local z the
 *  depth inward. The fortress is set out on the wall's own line, so its south
 *  front runs parallel to the colonnade it backs. Built to the world axes
 *  instead it swung ten meters out of true across its 122 m, which is most of
 *  the depth of a portico.
 * ===================================================================== */
function buildAntonia(B){
  const A=ANTONIA, R=A.rock, W=A.wall, S=ANT_STAIR;
  const mid = N_FRAME.toW((W.s0+W.s1)/2, (W.dN+W.dS)/2);
  B.part('antonia',{name:INFO.antonia.n, key:'antonia',
                    at:[mid[0], A.floor+A.bigTowerH, mid[1]]},()=>{
    frameAlong(B, PLAT.NW, PLAT.NE);
    const y0 = A.floor, top = y0 + A.wallH;

    /* THE SCARPED ROCK. Faced with smooth stone "both for ornament, and that
       anyone who would either try to get up or to go down it might not be able
       to hold his feet upon it" (War 5.239). Closed at the top: the walk round
       the rim is in view from outside, and left open it was a hole straight
       into the hollow of the box. */
    B.box('rock','base',{x:(R.s0+R.s1)/2, z:(R.dS+R.dN)/2, y:-26,
                         sx:R.s1-R.s0, sy:y0+26, sz:R.dS-R.dN,
                         uv:1/16, ao:1, grad:0.3});
    /* AND FACED WHERE IT FRONTS THE COURT. "This rock was covered from its
       foundation with smooth pieces of stone, both for ornament, and that anyone
       who would either try to get up or to go down it might not be able to hold
       his feet upon it" (War 5.239)—and Ritmeyer's section of the surviving
       scarp is labeled rock with HERODIAN STONES above it. Left bare it was the
       one stretch of the court's edge with no masonry on it: a hundred and thirty
       meters of smooth rock face where every other side has drafted ashlar. Only
       the south face needs it; the other three stand over open ground outside
       the platform, where the scarp is the scarp. */
    B.wall('ashlar','base',{from:[R.s0, R.dS-0.6], to:[R.s1, R.dS-0.6],
      y0:ESP, y1:y0, thick:1.8, uv:1/7.2, caps:false, ao:1, grad:0.28});

    /* THE SOUTH FRONT—the scarp continued in Herodian ashlar, and the back
       wall of the northern colonnade. It has to reach the colonnade's eaves,
       because that is where the roof beams are socketed into it; it carries on
       to the head of the forty-cubit curtain above them.

       TWO POSTERNS at eave level, which is where the fortress meets the Temple:
       one behind the head of the great stair, opening onto the northern
       colonnade's roof, and one at the angle, opening onto the western
       colonnade's. These are the "passages down to them both"—down onto the
       two cloisters, from which the guard "went several ways among" them, and
       over which War 2.12 has the festival cohort standing. They are upper-floor
       doors: the fortress's own paving is twenty cubits up and its roof-level
       story twelve meters above that, which is how Josephus's palace of a
       fortress is stacked inside a forty-cubit curtain. */
    const pw = 4.4, ph = 6.0, sill = S.top - y0;
    const posternS = ANT_POSTERN;
    const G = ANT_GALLERY;
    wallOpen(B,'ashlar','base',{from:[W.s0-A.thick/2, W.dS], to:[W.s1+A.thick/2, W.dS],
      y0:y0, y1:top, thick:A.thick, uv:1/9.6, ao:1, grad:0.2,
      openings: posternS.map(s=>({at:s-(W.s0-A.thick/2), w:pw, h:ph, sill}))});
    for(const s of posternS){
      /* a lintel, a threshold, and the dark of the fortress behind */
      B.box('ashlar','base',{x:s, z:W.dS, y:y0+sill+ph-0.08, sx:pw+2.6, sy:1.5,
                             sz:A.thick+1.2, uv:1/9.6, ao:1});
      B.box('paving','base',{x:s, z:W.dS, y:y0+sill-0.35, sx:pw+0.8, sy:0.4,
                             sz:A.thick+1.4, uv:0.5, ao:0.92});
      /* NO DARK PANEL BEHIND THESE. Hung against the reveal it was something you
         walked into off the head of the stair with a six-meter drop behind it;
         set back beyond the gallery it was a black wall floating over the
         courtyard. There is a real floor behind them now—the rampart walk—
         and what you see through the door is that, and the fortress beyond. */
    }
    /* THE RAMPART BEHIND THE SOUTH FRONT, carrying the walk the two posterns
       open onto. Solid from the fortress's own paving up, which is what backs a
       curtain forty cubits high, and parapeted along its inner edge. */
    B.box('ashlar','base',{x:(W.s0+W.s1)/2, z:(G.d0+G.d1)/2, y:y0,
      sx:W.s1-W.s0, sy:G.y-y0, sz:G.d1-G.d0, uv:1/9.6, ao:1, grad:0.16, skip:'B'});
    B.box('paving','base',{x:(W.s0+W.s1)/2, z:(G.d0+G.d1)/2, y:G.y-0.35,
      sx:W.s1-W.s0-0.6, sy:0.4, sz:G.d1-G.d0-0.4, uv:0.5, ao:0.9});
    B.wall('ashlarFine','base',{from:[W.s0,G.d0], to:[W.s1,G.d0],
      y0:G.y, y1:G.y+A.rim, thick:0.8, uv:0.45, ao:0.96, grad:0.1});
    /* THE SOCKETS FOR THE COLONNADE'S ROOF BEAMS, cut into the scarp—the one
       piece of this junction still standing at the northwest corner of the
       Mount. Beam ends on the colonnade's own bay spacing, over its run only. */
    for(let s=Math.ceil(ANT_STAIR.sEnd/PORTICO.spacing)*PORTICO.spacing;
            s < W.s1; s += PORTICO.spacing)
      B.box('cedar','base',{x:s, z:A.face+0.35, y:S.eave-1.15, sx:0.44, sy:0.5,
                            sz:1.5, uv:0.6, ao:0.7, skip:'B'});

    /* the other three curtains, forty cubits above the rock */
    for(const [f,t] of [[[W.s0,W.dN],[W.s1,W.dN]],            // north
                        [[W.s1,W.dN],[W.s1,W.dS]],            // east
                        [[W.s0,W.dS],[W.s0,W.dN]]])           // west
      B.wall('ashlar','base',{from:f, to:t, y0:y0, y1:top, thick:A.thick,
                              uv:1/9.6, caps:false, ao:1, grad:0.2});

    /* THE THREE-CUBIT WALL AT THE RIM (War 5.239), on the three sides that
       have a walk outside the curtain. The south has none: the colonnade's
       roof arrives there. */
    {
      const r0 = R.s0+0.6, r1 = R.s1-0.6, dn = R.dN+0.6, ds = W.dS-A.thick/2;
      for(const [f,t] of [[[r0,dn],[r1,dn]], [[r1,dn],[r1,ds]], [[r0,ds],[r0,dn]]])
        B.wall('ashlarFine','base',{from:f, to:t, y0:y0, y1:y0+A.rim, thick:0.9,
                                    uv:0.45, ao:0.98, grad:0.1});
    }

    /* the courts, baths and barracks inside—"the largeness and form
       of a palace"—shown as ranges round two courts */
    B.poly('paving','base',[[W.s0+4,W.dN+4],[W.s1-4,W.dN+4],[W.s1-4,W.dS-4],[W.s0+4,W.dS-4]],
           y0+0.25, 1/8, 0.95);
    for(const [bs,bd,bw,bdp,bh] of [
      [W.s0+24,W.dN+14,36,17,13],[W.s1-26,W.dN+13,30,15,11],
      [W.s0+22,W.dS-15,34,16,12],[W.s1-28,W.dS-16,26,15,14]])
      B.box('ashlarFine','base',{x:bs,z:bd,y:y0+0.25,sx:bw,sy:bh,sz:bdp,
                                 uv:0.2,ao:1,grad:0.15,skip:'B'});

    /* FOUR TOWERS, three of fifty cubits and the southeastern of seventy.
       Inset from the corners of the wall centerlines by enough that no tower
       oversails the edge of the rock—at 15 m square on the corners they hung
       a meter out over the scarp—and only a third of a meter proud of the
       curtain, so nothing is left coplanar with it. */
    const tw = A.tower, ins = tw/2 - A.thick/2 - 0.35;
    const towers=[[W.s0+ins,W.dN+ins,A.towerH],[W.s1-ins,W.dN+ins,A.towerH],
                  [W.s0+ins,W.dS-ins,A.towerH],[W.s1-ins,W.dS-ins,A.bigTowerH]];
    const mh = tw/2 - 1.2, mstep = 2*mh/3;
    for(const [ts,td,th] of towers){
      B.box('ashlar','base',{x:ts,z:td,y:y0,sx:tw,sy:th,sz:tw,
                             uv:1/9.6,ao:1,grad:0.22,skip:'B'});
      B.box('ashlarFine','roofs',{x:ts,z:td,y:y0+th,sx:tw+1.6,sy:1.3,sz:tw+1.6,
                                  uv:0.24,ao:1,aoBot:0.6});
      for(let i=0;i<4;i++) for(let j=0;j<4;j++){
        if(i>0&&i<3&&j>0&&j<3) continue;
        B.box('ashlarFine','roofs',{x:ts-mh+i*mstep,z:td-mh+j*mstep,y:y0+th+1.3,
                                    sx:2.2,sy:1.9,sz:2.2,uv:0.4,ao:1,skip:'B'});
      }
    }

    /* THE GREAT STAIR UP TO THE COLONNADE ROOFS, and the landing at its head.
       It climbs eastward in the open, hard against the scarp, from the angle
       where the two colonnades meet to the level of their eaves. `stairs` grows
       in the `dir` it is given from the point it is given, so an ascending
       flight is placed at its BOTTOM step. */
    const dMid = (S.d0 + S.d1)/2;
    B.stairs('ashlarFine','base',{x:S.s0, z:dMid, y:ESP, n:S.n, rise:S.rise,
      tread:S.tread, w:S.w, dir:'E', uv:0.4});
    /* the landing—solid to the pavement, the head of the stair */
    B.box('ashlarFine','base',{x:(S.s1+S.sEnd)/2, z:dMid, y:ESP,
      sx:S.landing, sy:S.top, sz:S.w, uv:0.4, ao:1, grad:0.12, skip:'B'});
    /* a parapet down each side and along the front of the landing, so the way
       up reads as a way and not a ramp, and so the head of it is a place to
       stand rather than a shelf */
    for(const sd of [-1,1])
      for(let i=0;i<S.n;i++)
        B.box('ashlarFine','base',{
          x:S.s0 + (i+0.5)*S.tread, z:dMid + sd*(S.w/2 + S.rail/2),
          y:ESP + (i+1)*S.rise - 0.55,
          sx:S.tread+0.1, sy:1.5, sz:S.rail, uv:0.45, ao:0.95, skip:'B'});
    /* ONE RAIL, on the open side. The landing's north edge is the curtain with
       the postern in it and its east edge is the colonnade's roof, which is
       where the guard is going; railing those two fenced a man into a pen and
       shut the roof off from the stair that exists to reach it. */
    B.box('ashlarFine','base',{x:(S.s1+S.sEnd)/2, z:dMid+S.w/2+S.rail/2,
      y:S.top-0.55, sx:S.landing, sy:1.5, sz:S.rail,
      uv:0.45, ao:0.95, skip:'B'});
    popFrame(B);
  });
}

/* =====================================================================
 *  THE TWO GREAT RESERVOIRS at the northern corners
 * ===================================================================== */
function buildPools(B){
  /* --- the Struthion: a moat off the Antonia's northwest corner --- */
  const S = POOLS.struthion;
  /* Keyed off the north edge of the scarped rock, in the fortress's own frame:
     keyed off the curtain in world axes it followed the fortress about and
     ended up sitting in the Court of the Gentiles. */
  const [sx, sz] = N_FRAME.toW(ANTONIA.rock.s0 + 16,
                               ANTONIA.rock.dN - (S.d/2 + 9));
  /* The rim has to clear the HIGHEST ground the coping touches. Taken from the
     center alone it sat below the slope at the northern end, and the terrain
     sheet cut straight across the basin and swallowed it. */
  let sHi=-1e9, sLo=1e9;
  for(let i=-1;i<=1;i++) for(let j=-3;j<=3;j++){
    const gl = groundLevel(sx + i*(S.w/2+6), sz + j*(S.d/6));
    sHi=Math.max(sHi,gl); sLo=Math.min(sLo,gl);
  }
  const srim = sHi + 0.7;
  B.part('struthion',{name:INFO.struthion.n, key:'struthion',
                      at:[sx, srim+3, sz]},()=>{
    /* cut into the rock: a coping walk round the rim, no raised mass */
    B.frame('rock','city',{x:sx, z:sz, sx:S.w+15, sz:S.d+15,
                           ix:S.w, iz:S.d, y:srim, uv:1/12, ao:0.95});
    /* and a rock skirt under that walk, so it meets the ground on the sides
       where the slope falls away instead of floating over it */
    const W2=S.w/2+6.7, D2=S.d/2+6.7;
    for(const [ex,ez,bw,bd] of [[0,-D2,2*W2,1.6],[0,D2,2*W2,1.6],
                                [-W2,0,1.6,2*D2],[W2,0,1.6,2*D2]]){
      const gl = Math.min(groundLevel(sx+ex,sz+ez), sLo) - 1.0;
      if(gl >= srim-0.25) continue;
      B.box('rock','city',{x:sx+ex, z:sz+ez, y:gl, sx:bw, sy:srim-gl, sz:bd,
                           uv:1/14, ao:1, grad:0.3, skip:'T'});
    }
    waterBasin(B,{x:sx, z:sz, w:S.w, d:S.d, rim:srim, depth:S.depth,
                  lining:'ashlarFine', layer:'city', freeboard:S.freeboard,
                  uv:0.24, curb:0.9, curbH:0.5});
  });

  /* --- the Pool of Israel, against the northern wall.  Set out parallel
     to that wall, which is how it lies on the ground. --- */
  const P = POOLS.israel;
  const u = [ (PLAT.NE[0]-PLAT.NW[0])/WALL_LEN.N, (PLAT.NE[1]-PLAT.NW[1])/WALL_LEN.N ];
  const outward = [ u[1], -u[0] ];                    // away from the platform
  const along = WALL_LEN.N - P.w/2 - 6;               // east end near the corner
  const off   = P.d/2 + 7;                            // clear of the wall, room for the dam
  const px = PLAT.NW[0] + u[0]*along + outward[0]*off;
  const pz = PLAT.NW[1] + u[1]*along + outward[1]*off;
  /* The rim has to clear the HIGHEST ground its coping touches—the rule the
     Struthion already needed, and this pool had the same fault. Taken from the
     center alone the walk hung in the air along the north and west, where the
     valley falls away, and the reservoir read as a tank standing on the
     hillside rather than a basin dug into it and dammed. */
  const HW = P.w/2 + 6.5, HD = P.d/2 + 6.5;
  const atLocal = (sx,sz) => [px + u[0]*sx + outward[0]*sz,
                              pz + u[1]*sx + outward[1]*sz];
  let hi = -1e9, lo = 1e9;
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++){
    const q = atLocal(i*HW, j*HD);
    hi = Math.max(hi, groundLevel(q[0],q[1]));
    lo = Math.min(lo, groundLevel(q[0],q[1]));
  }
  const prim = Math.min(hi + 0.5, ESP - 5);
  B.part('poolIsrael',{name:INFO.poolIsrael.n, key:'poolIsrael',
                       at:[px, prim+4, pz]},()=>{
    B.pushT(px, 0, pz);
    B.pushRotY(Math.atan2(-u[1], u[0]));              // align to the wall
    B.frame('paving','city',{x:0, z:0, sx:P.w+13, sz:P.d+13,
                             ix:P.w, iz:P.d, y:prim, uv:1/8, ao:0.95});
    waterBasin(B,{x:0, z:0, w:P.w, d:P.d, rim:prim, depth:P.depth,
                  lining:'ashlar', layer:'city', freeboard:P.freeboard,
                  uv:1/9.6, curb:1.4, curbH:0.6, wallT:1.2});
    /* the great dam that closes the eastern end, 13.7 m thick */
    B.box('ashlar','city',{x:P.w/2+7.0, z:0, y:prim-P.depth, sx:13.7,
                           sy:P.depth+1.1, sz:P.d+13, uv:1/9.6, ao:1, grad:0.2});
    B.pop(); B.pop();
    /* and the masonry that carries the coping walk down to the ground on every
       side where the valley is below the rim. Built in world coordinates, in
       segments, each reaching the ground actually beneath it—the pool is set
       out at the wall's angle, so a box would sit four degrees out. */
    if(hi - lo > 0.3 || prim - lo > 0.3){
      const seg = 14;
      for(let i=0;i<seg;i++){
        const t0=i/seg, t1=(i+1)/seg;
        for(const [a,b] of [
              [atLocal(lerp(-HW,HW,t0),-HD), atLocal(lerp(-HW,HW,t1),-HD)],
              [atLocal(lerp(-HW,HW,t0), HD), atLocal(lerp(-HW,HW,t1), HD)],
              [atLocal(-HW,lerp(-HD,HD,t0)), atLocal(-HW,lerp(-HD,HD,t1))],
              [atLocal( HW,lerp(-HD,HD,t0)), atLocal( HW,lerp(-HD,HD,t1))]]){
          const g = Math.min(groundLevel(a[0],a[1]), groundLevel(b[0],b[1])) - 1.6;
          if(prim - g < 0.2) continue;
          B.wall('ashlar','city',{from:a, to:b, y0:g, y1:prim, thick:3.0,
                                  uv:1/9.6, caps:false, ao:0.9, grad:0.26,
                                  top:false});
        }
      }
    }
  });
}

/* =====================================================================
 *  WAYS IN
 *
 *  One builder per approach. They share nothing but the Builder, and each
 *  opens exactly the parts named in its comment, so a gate can be read,
 *  moved or silenced without reading the rest.
 * ===================================================================== */
function buildGates(B){
  buildSouthernApproach(B);
  buildHuldahGates(B);
  buildRobinsonsArch(B);
  buildWilsonGate(B);
  buildWesternGates(B);
  buildShushanGate(B);
  buildOlivetCauseway(B);
  buildTadiGate(B);
}

/* ---- the whole southern approach: the great staircase, the plaza and
       its scarp, the ramp east to the Triple Gate, the street at the foot
       of the wall, the two buildings before the gates, and the miqva'ot
       cut under all of it ---------------------------------------------- */
function buildSouthernApproach(B){
  B.part('southSteps',{name:INFO.southSteps.n, key:'southSteps',
                       at:[GATES.double.at, -6, PLAT.SW[1]+22]},()=>{
    const S=SOUTH_STAIR;
    const cx = S.cx;                        // the flight, carried east
    const gz = PLAT.SW[1] + 2.4;            // the outer face of the wall
    /* Thirty steps at the excavated riser of 0.22 m need 6.6 m of rise, so
       the plaza is set at that depth below the threshold rather than at
       whatever height the terrain function happens to give. The treads
       alternate deep and shallow, as Mazar found them. */
    const nUp = S.n, rise = S.rise, PLAT_GAP = 4.0;
    const treads = [];
    for(let i=0;i<nUp;i++) treads.push((i%2===0) ? S.treadA : S.treadB);
    const stairDepth = treads.reduce((a,b)=>a+b, 0);      // 18.75 m
    const plazaY = HULDAH_SILL - rise*nUp;

    /* The flight climbs NORTHWARD toward the wall, so the lowest step is the
       one furthest out on the plaza. Step 0 is a solid block spanning the
       whole footprint; each step above it reaches back to the wall and stops
       one tread short of the one below. Emitting them the other way round—
       each slab reaching back to the wall as the height rose—left the
       topmost slab covering the entire staircase, which is why this read as a
       platform rather than as steps. */
    let cum = 0;
    for(let i=0;i<nUp;i++){
      const depth = stairDepth - cum;        // wall out to this step's nosing
      const top   = plazaY + rise*(i+1);
      const k     = lerp(0.80,1,i/nUp);
      /* STOPPING SHORT OF THE WALL. Run right up to it the flight left no room
         for the platform in front of the Double Gate, so the gate had no landing
         of its own: the last tread was the threshold. Four meters out. */
      B.box('paving','base',{x:cx, z:gz + PLAT_GAP + depth/2, y:plazaY, sx:S.wTot,
                             sy:top-plazaY, sz:depth, uv:0.32,
                             ao:k*0.90, aoTop:k, skip:'B'});
      cum += treads[i];
    }
    /* the plaza the stair rises from, and the scarp holding it up */
    const pz = gz + stairDepth + 21;
    B.box('paving','base',{x:cx, z:pz, y:plazaY-1.5, sx:S.wTot+38, sy:1.5, sz:44,
                           uv:0.16, ao:0.95});
    /* The scarp under the plaza, in segments each reaching the ground beneath
       it. One box from a single depth stood clear of the hillside at the
       corners, and the plaza read as a slab hanging in the air. */
    for(let i=0;i<8;i++){
      const zz = pz - 22 + 44*(i+0.5)/8;
      const gLo = Math.min(groundLevel(cx-(S.wTot+38)/2, zz), groundLevel(cx, zz),
                           groundLevel(cx+(S.wTot+38)/2, zz)) - 2.5;
      B.box('rock','base',{x:cx, z:zz, y:gLo, sx:S.wTot+38, sy:(plazaY-1.5)-gLo,
                           sz:44/8+0.2, uv:1/16, ao:0.9, grad:0.3, skip:'T'});
    }
    /* A RAMP BEYOND THE STAIRCASE. The flight now runs east to the front of the
       miqweh and the rooms beside it; east of those the ground has fallen far
       enough that the approach is a ramp off the street, which is the way a gate
       taking carts and animals would be reached
       from the street that ran east along the foot of the wall toward the
       Ophel—by a ramp rather than steps, this being the gate that took the
       traffic of the Temple's stores. */
    const tg = GATES.triple.at;
    /* The street the ramp comes down onto. It ran east along the foot of the
       southern wall from the plaza to the southeast angle, where the road up
       from the City of David and the Ophel arrived; Mazar and Ben-Dov found it
       paved, and found it turning the corner northward. It has to be built to
       the corner, because a ramp that stops in the air over open hillside—
       which is what was here—asks the reader to believe the Temple's store
       gate opened onto nothing.

       The ground falls away hard going east: about 15 m below the plaza at the
       ramp's foot and 28 m by the corner. So the street is carried on fill
       retained against the wall, and the retaining face is built in segments,
       each reaching down to the ground actually beneath it. One box from a
       single sampled height would hang in the air at the eastern end, which is
       the same mistake in a different place. */
    const xW = cx + S.w/2, xE = PLAT.SE[0] + 5;
    const zC = gz + 16, zD = 34;
    B.box('paving','base',{x:(xW+xE)/2, z:zC, y:plazaY-1.5,
                           sx:xE-xW, sy:1.5, sz:zD, uv:0.16, ao:0.95});
    const nSeg = 22;
    for(let i=0;i<nSeg;i++){
      const xa = lerp(xW,xE,i/nSeg), xb = lerp(xW,xE,(i+1)/nSeg);
      const gLo = Math.min(groundLevel(xa, zC), groundLevel(xb, zC),
                           groundLevel((xa+xb)/2, zC+zD/2)) - 2.0;
      B.box('ashlar','base',{x:(xa+xb)/2, z:zC, y:gLo, sx:xb-xa+0.15,
                             sy:(plazaY-1.5)-gLo, sz:zD,
                             uv:1/9.6, ao:0.9, grad:0.30, skip:'T'});
    }
    /* a parapet along its outer edge, where the drop is worth one */
    B.box('ashlarFine','base',{x:(xW+xE)/2 + 12, z:zC+zD/2-0.55,
                               y:plazaY, sx:xE-xW-24, sy:1.05, sz:1.1,
                               uv:0.4, ao:0.95, skip:'B'});
    (()=>{
      /* A ramp 13 m wide climbing westward to the gate, with a landing in
         front of the threshold so the gate opens onto something, parapets that
         follow the slope, and nothing across the foot of it. */
      const top = HULDAH_SILL, foot = plazaY;
      const zA = gz + 1.0, zB = zA + 13.0;        // the width of the way up
      const land = 9.0, rL = 30.0;                // landing depth, then the ramp
      const xLandE = tg + 9.0;                    // east edge of the landing

      /* the landing at the threshold */
      B.box('paving','base',{x:tg, z:(zA+zB)/2, y:top-0.7, sx:18.0, sy:0.7,
                             sz:zB-zA, uv:0.4, ao:0.95});
      B.box('ashlar','base',{x:tg, z:(zA+zB)/2, y:top-12.0, sx:18.0, sy:11.3,
                             sz:zB-zA, uv:1/9.6, ao:0.9, grad:0.24, skip:'T'});

      /* the ramp, in short steps so its surface and its substructure agree */
      const n = 30;
      for(let k=0;k<n;k++){
        const t0=k/n, t1=(k+1)/n;
        const x0=xLandE + rL*t0, x1=xLandE + rL*t1;
        const y = lerp(top, foot, (t0+t1)/2);
        B.box('paving','base',{x:(x0+x1)/2, z:(zA+zB)/2, y:y-0.6,
                               sx:x1-x0+0.3, sy:0.7, sz:zB-zA, uv:0.4,
                               ao:lerp(1,0.86,t0), skip:'B'});
        B.box('ashlar','base',{x:(x0+x1)/2, z:(zA+zB)/2, y:foot-1.4,
                               sx:x1-x0+0.3, sy:y-foot+1.4, sz:zB-zA,
                               uv:1/9.6, ao:0.88, grad:0.2, skip:'T'});
        for(const zz of [zA-0.55, zB+0.55])       // parapets, following the slope
          B.box('ashlarFine','base',{x:(x0+x1)/2, z:zz, y:y-0.5, sx:x1-x0+0.3,
                                     sy:1.5, sz:1.1, uv:0.4, ao:0.95, skip:'B'});
      }
      /* No flight south off the landing. The platform along the southern side
         runs at the level of the gates and connects the Double Gate's landing to
         this one, so the Triple Gate is reached ALONG it—which is where the
         stairs into it come from, and why a separate flight down to the plaza
         was solving a problem that does not exist. The ramp east remains. */

      /* Parapets round the landing—on its WEST side and its outer edge,
         leaving the gate open to the north and the ramp open to the east. Run
         round all four the north one stood square across the threshold, and the
         gate opened onto a low wall. */
      B.box('ashlarFine','base',{x:tg, z:zB+0.55, y:top-0.1, sx:18.0, sy:1.5,
                                 sz:1.1, uv:0.4, ao:0.95, skip:'B'});
      /* NO PARAPET ON THE LANDING'S WEST SIDE. The platform at gate level arrives
         from that side, and a wall across it was exactly the interruption it
         must not have. Its outer edge is railed, and the gate is open north. */
    })();

    /* ---- IN FRONT OF THE GATES ----------------------------------------
       After Fig. 50 of Baruch and Reich ('Atiqot 85, 2016)—the Israel
       Antiquities Authority's reconstruction of this corner—and Ritmeyer's
       drawing of the same.

       ONE CONTINUOUS SURFACE AT GATE LEVEL. The platform runs the whole way
       along the wall, in front of the Double Gate as well as the Triple, and the
       two buildings on the plaza are carried up so that their ROOFS come out at
       the same height as it—which is what Fig. 50 shows, and which is why
       there is no parapet along the platform's outer edge: there is no drop
       there to rail. The eastern gate is reached along the platform, so the
       flight running south off it has gone; it was descending to the plaza and
       arriving at the side of a building.

       Both buildings are roofed, and their entrances are simply black. The
       western houses Miqwe 6049 of Baruch and Reich's Area A; the three rock-cut
       vaulted rooms of Area B are the substructure beneath them, 7.2-7.5 m south
       of the gate. */
    {
      const stY = plazaY, tTop = HULDAH_SILL;
      const bH  = tTop - stY;                   // roofs level with the platform
      const tz0 = gz + 0.4, tz1 = gz + 5.4;
      const tx0 = SOUTH_STAIR.cx - SOUTH_STAIR.wTot/2;
      const tx1 = tg + 9.0;
      B.box('paving','base',{x:(tx0+tx1)/2, z:(tz0+tz1)/2, y:tTop-0.7,
        sx:tx1-tx0, sy:0.7, sz:tz1-tz0, uv:0.34, ao:0.97});
      B.box('ashlar','base',{x:(tx0+tx1)/2, z:(tz0+tz1)/2, y:stY-1.0,
        sx:tx1-tx0, sy:(tTop-0.7)-(stY-1.0), sz:tz1-tz0,
        uv:1/9.6, ao:0.9, grad:0.24, skip:'T'});

      /* THE TWO BUILDINGS, roofed level with the platform and abutting it */
      /* jambs and a lintel round an opening; the dark itself is set behind it */
      const black = (bx,zf2,dw,dh)=>{
        for(const sd of [-1,1])
          B.box('ashlarFine','base',{x:bx+sd*(dw/2+0.55), z:zf2-0.25, y:stY,
            sx:1.1, sy:dh, sz:1.1, uv:0.4, ao:0.95});
        B.box('ashlar','base',{x:bx, z:zf2-0.25, y:stY+dh-0.06, sx:dw+2.4,
          sy:0.9, sz:1.3, uv:1/9.6, ao:1});
      };
      /* FOUR WALLS AND A ROOF, not a solid block. Built solid, the doorway's dark
         panel sat INSIDE the stone and what showed was stone: the entrances have
         to be holes in a wall, not a color laid over one. */
      for(const [bx,bw,bd] of [[131, 16.0, 12.0], [151, 13.0, 12.0]]){
        const bz = tz1 + bd/2 - 0.4;            // abutting the platform
        const wt = 1.2, x0 = bx-bw/2, x1 = bx+bw/2;
        const z0 = bz-bd/2, z1 = bz+bd/2;
        for(const [f,t] of [[[x0,z0],[x1,z0]],[[x1,z0],[x1,z1]],[[x0,z1],[x0,z0]]])
          B.wall('ashlarFine','base',{from:f, to:t, y0:stY, y1:stY+bH,
            thick:wt, uv:0.34, ao:1, grad:0.12});
        /* the southern face, pierced */
        wallOpen(B,'ashlarFine','base',{from:[x1,z1], to:[x0,z1], y0:stY,
          y1:stY+bH, thick:wt, uv:0.34, ao:1, grad:0.12,
          openings:[{at:bw/2, w:2.8, h:3.6}]});
        /* the dark of the inside, standing just behind the opening */
        B.box('shadow','base',{x:bx, z:z1-wt/2-0.9, y:stY, sx:2.8, sy:3.6,
          sz:1.6, uv:0.4, ao:0.07});
        B.box('paving','base',{x:bx, z:bz, y:stY-0.3, sx:bw-2*wt, sy:0.4,
          sz:bd-2*wt, uv:0.5, ao:0.9});
        B.box('paving','roofs',{x:bx, z:bz, y:stY+bH-0.35, sx:bw+0.7, sy:0.45,
          sz:bd+0.7, uv:0.34, ao:0.97, aoBot:0.62});
        black(bx, z1, 2.8, 3.6);
      }

      /* MIQWE 6049, inside the western of the two—sunk in its floor, so it is
         housed rather than standing in the open, and the roof over it is the
         platform you walk on. */
      {
        const bx=131, bd=12.0, bz=tz1+bd/2-0.4;
        const pw=8.0, pd=5.0, prim2=stY+0.4;
        waterBasin(B,{x:bx-2.0, z:bz+1.0, w:pw, d:pd, rim:prim2, depth:3.0,
          lining:'plaster', curb:0.7, curbH:0.5, freeboard:0.4, uv:0.5});
        const nS=7, sr=2.6/nS, st=(pd*0.45)/nS;
        for(let k=0;k<nS;k++)
          B.box('plaster','base',{x:bx-2.0, z:bz+1.0-pd/2+0.45+st*(k+0.5),
            y:prim2-0.4-sr*(k+1), sx:pw-1.2, sy:sr+0.06, sz:st+0.06,
            uv:0.6, ao:lerp(0.94,0.7,k/(nS-1)), skip:'B'});
      }
    }

    /* Ritual baths, cut down into the rock rather than standing on it: a
       curb round a dark shaft, with steps down into the water. Dozens were
       found in this area, for pilgrims to immerse before going up. */
    const mk = mulberry32(4004);
    for(let i=0;i<9;i++){
      const bx = cx - 40 + i*10.2 + (mk()-0.5)*4;
      const bz = pz - 6 + (i%3)*11 + (mk()-0.5)*5;
      /* The plaza is a solid slab, so a basin sunk into it is simply covered
         by the paving—there is no hole to see down. These therefore sit in a
         raised coping, water a hand's breadth above the pavement, which many
         excavated mikva'ot in fact had. The steps down are inside and below
         the water, so they are not built. */
      waterBasin(B,{x:bx, z:bz, w:3.4, d:3.4, rim:plazaY+0.52, depth:2.2,
                    lining:'plaster', curb:0.55, curbH:0.52,
                    freeboard:0.36, uv:0.5});
    }
  });
}

/* ---- the two Huldah gates in the southern wall ------------------ */
function buildHuldahGates(B){
  B.part('huldah',{name:INFO.huldah.n, key:'huldah',
                   at:[GATES.double.at, -3, PLAT.SW[1]+3]},()=>{
    for(const [g,nBays] of [[GATES.double,2],[GATES.triple,3]]){
      const cx=g.at, zf=PLAT.SW[1]+2.35;
      const sill = HULDAH_SILL;
      const bw = g.w/nBays;                 // the clear width of one bay
      const spring = sill + g.h*0.55;       // where the arches start to turn
      const crown  = spring + bw*0.82/2;    // the top of the arch ring
      const head   = crown + 1.5;           // the molding over it
      for(let i=0;i<nBays;i++){
        const x = cx - g.w/2 + bw*(i+0.5);
        /* A PASSAGE, NOT A PLATE WITH HOLES IN IT. The ring was 1.5 m deep in a
           wall 4.6 m thick, with the dark hung 1.4 m behind it, so from any
           angle off the axis you saw how thin it was and the gate read as
           paper. The reveal now runs back through the whole thickness of the
           wall—jambs, a vault over them and the dark beyond—which is what
           the surviving domed bays of the Double Gate actually are. */
        const dep = 3.6, ow2 = bw*0.82;
        /* THE PASSAGE IS DARK, all the way in. Set the dark 4.7 m back behind a
           lit reveal and the gate read as a wall with recesses in it; a Huldah
           gate opens on a vaulted passage running north under the Royal Stoa,
           and what you see from the plaza is black. The jambs and the ring still
           frame it, so the depth is there—it is just not lit. */
        /* THE DARK GOES UP TO THE CROWN. It used to stop at the springing and a
           `shadow` RING cap the rest, which worked only while that ring was
           wound inside out and could be seen from in front. Wound right it is a
           vault, and a vault 3.6 m deep and 4 m across subtends almost nothing
           head-on: you looked straight over the springing at the lit masonry
           behind it.

           THE HEAD IS A DISC, NOT A BOX, and everything here stays on the one
           plane the rest of the reveal is on. There is no room to stagger it:
           the wall's face is at 487.0 and the reveal stands only to 487.15, so a
           box set back far enough to clear the ring's own face landed within
           three centimeters of the wall and the black flickered across it as
           the camera moved. Nothing is gained by the setback anyway—a box
           inside the opening cannot foul the ring, whose face is an annulus
           outside the intrados; only the box's CORNERS reach out that far. So
           the head is filled with a shape that has none: `arch` with a span of
           nothing is a filled half-disc, radius three centimeters inside the
           soffit, sharing its plane with the jambs and the ring and overlapping
           neither. */
        B.box('shadow','base',{x, z:zf-dep/2-0.2, y:sill, sx:ow2,
                               sy:spring-sill, sz:dep, uv:0.5, ao:0.10});
        B.arch('shadow','base',{x, z:zf-dep/2-0.2, y:spring, span:0,
                                thick:ow2/2-0.03, depth:dep, axis:'x', seg:10,
                                uv:0.5});
        /* the reveal: side walls and a barrel over them, right through */
        for(const sd of [-1,1])
          B.box('ashlarFine','base',{x:x+sd*(ow2/2+0.5), z:zf-dep/2-0.2, y:sill,
            sx:1.0, sy:spring-sill, sz:dep, uv:0.4, ao:0.9, grad:0.12});
        B.arch('ashlarFine','base',{x, z:zf-dep/2-0.2, y:spring, span:ow2,
                                    thick:0.95, depth:dep, axis:'x', seg:10,
                                    uv:0.4});
        /* AND THE SPANDRELS. Bare rings here read as cut paper—daylight over
           every haunch between the ring and the molding it carries—which is
           the same fault the arcades had. Filled to the top of the RING, not to
           the intrados crown: stopped there the fill was a ring's thickness
           short, and the back of the ring stood clear of it right through the
           reveal, which the molding covers only at the face. Sliced round the
           ring, so nothing intrudes into the passage. */
        archSpandrel(B,'ashlarFine','base',{x, z:zf-dep/2-0.2, y:spring,
          span:ow2, thick:0.95, depth:dep, axis:'x', seg:10, deckY:crown+0.95,
          uv:0.4, ao:0.98});
        /* the pier between bays */
        if(i<nBays-1)
          B.box('ashlarFine','base',{x:x+bw/2, z:zf-dep/2-0.2, y:sill,
                                     sx:bw*0.18, sy:spring-sill, sz:dep,
                                     uv:0.4, ao:0.9});
      }
      /* a molded frame round the whole opening */
      B.box('ashlarFine','base',{x:cx, z:zf-0.1, y:crown,
                                 sx:g.w+3.4, sy:head-crown, sz:1.1, uv:0.35, ao:1});
      for(const s of [-1,1])
        B.box('ashlarFine','base',{x:cx+s*(g.w/2+1.4), z:zf-0.1, y:sill, sx:1.6,
                                   sy:crown-sill, sz:1.1, uv:0.35, ao:1});
      /* the threshold, and the vaulted passage running north beneath the
         Royal Stoa to a stair that came up into the open esplanade */
      B.box('paving','base',{x:cx, z:zf-1.6, y:sill-0.5, sx:g.w, sy:0.5, sz:3.4,
                             uv:0.4, ao:0.8});
      B.box('shadow','base',{x:cx, z:zf-9, y:sill, sx:g.w*0.8, sy:spring-sill, sz:14,
                             uv:0.4, ao:0.10});
    }
  });
}

/* ---- Robinson's Arch ------------------------------------------- */
function buildRobinsonsArch(B){
  B.part('robinson',{name:INFO.robinson.n, key:'robinson',
                     at:[-14, -5, PLAT.SW[1]-GATES.robinson.at]},()=>{
    const z0 = PLAT.SW[1] - GATES.robinson.at;      // 12 m north of the corner
    const span = GATES.robinson.span, depth = 15.2; // 50 ft wide, as excavated
    const streetY = streetLevelAt(PLAT.SW[1]-GATES.robinson.at);
    const springY = -13.2;
    const pierX   = -(span + 3.4);                  // the pier, west of the street

    /* THE GREAT ARCH. It springs from the wall and crosses WEST over the
       Herodian street, landing on the pier—which is why the street runs on
       beneath it rather than stopping. */
    const archX = -(span/2+1.7), rTh = 1.9;
    B.arch('ashlar','base',{x:archX, z:z0, y:springY, span,
                            thick:rTh, depth, axis:'x', seg:16, uv:0.2});

    /* THE LANDING RIDES ON THE ARCH'S BACK, and its height is derived from the
       extrados rather than chosen. It used to sit a meter below the INTRADOS
       crown, which is two and a half meters below the extrados where the ring
       leaves the pier: the flight that starts there therefore began inside the
       arch that carries it, and the arch's back came up through the treads over
       most of the span. Nothing showed while the ring was wound inside out—
       an extrados you cannot see cannot be seen breaking through anything—so
       the two faults hid each other.

       Every station of the flight has to clear the extrados beneath it, and the
       one that binds is not the crown but a little east of the springing, where
       the ring is still climbing steeply and the stair has barely left the
       landing. So walk the flight and take the highest start it demands. */
    const gy = ESP - 0.4, n1 = 16;         // the pavement at the head of the flight
    const xFoot = pierX + 3.8, xHead = -1.2;
    const extradosAt = xx => springY +
      Math.sqrt(Math.max(0, (span/2+rTh)**2 - (xx-archX)**2));
    let landTop = springY;
    for(let k=0;k<24;k++){                 // t = 1 is the pavement, and fixed
      const t = k/24;
      landTop = Math.max(landTop,
                         (extradosAt(lerp(xFoot,xHead,t)) + 0.87 - t*gy)/(1-t));
    }
    const yFlight = t => lerp(landTop, gy, t);

    /* THE PIER. Down to the ground, not to an assumed depth below the street—
       the rock falls away here—and UP to the landing it carries. Stopped at
       the springing it left the platform where the two flights meet hanging
       three and a half meters over nothing.

       A third of a meter deeper than the arch, so that the two do not present
       coplanar faces down the sides of the arch: they did, and the whole west
       haunch flickered between the two as the camera moved. */
    const pierBase = Math.min(streetY-2.5, groundLevel(pierX,z0)-1.5);
    B.box('ashlar','base',{x:pierX, z:z0, y:pierBase, sx:6.8,
                           sy:(landTop-0.7)-pierBase, sz:depth+0.34,
                           uv:1/9.6, ao:1, grad:0.2});

    /* THE LANDING on top of the pier. The two flights meet here at a right
       angle—the one climbing east over the great arch to the gate, and the
       one descending south to the street—and without a platform between them
       they simply abutted in mid-air. */
    B.box('paving','base',{x:pierX, z:z0, y:landTop-0.7, sx:7.6, sy:0.7,
                           sz:depth-1.0, uv:0.4, ao:1});
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:pierX-3.4, z:z0+sd*(depth/2-1.4), y:landTop,
                                 sx:0.8, sy:1.5, sz:depth/2-2.0, uv:0.4,
                                 ao:0.95, skip:'B'});

    /* The last flight, rising eastward over the arch from the pier to the gate.
       The crown of the arch is still some six meters below the pavement, which
       is why the arch carried a stair and not a landing. */
    /* the haunches of the great arch, filled up to the underside of the flight
       that climbs over it—a bare ring with a stair floating above it is the
       cut-paper look the other arcades had */
    archSpandrel(B,'ashlar','base',{x:archX, z:z0, y:springY, span, thick:rTh,
      depth, axis:'x', seg:16, uv:0.2, ao:0.95,
      deckAt: xx => yFlight(clamp((xx-xFoot)/(xHead-xFoot), 0, 1)) - 0.62});
    for(let i=0;i<n1;i++){
      const t=(i+0.5)/n1;
      const x = lerp(xFoot, xHead, t), y = yFlight(t);
      B.box('paving','base',{x, z:z0, y:y-0.62, sx:(span+4)/n1+0.6, sy:0.68,
                             sz:depth-2.6, uv:0.4, ao:lerp(0.86,1,t), skip:'B'});
    }
    for(let i=0;i<n1;i++){                            // parapets, stepped
      const t=(i+0.5)/n1;
      const x = lerp(xFoot, xHead, t), y = yFlight(t);
      for(const sd of [-1,1])
        B.box('ashlarFine','base',{x, z:z0+sd*(depth/2-1.1), y:y-0.5,
          sx:(span+5)/n1+0.6, sy:1.5, sz:1.0, uv:0.4, ao:0.95, skip:'B'});
    }

    /* THE STEPPED STREET: seven more bays carrying it southward from the pier
       down to street level, some fifty meters of it.

       Each arch's springing is derived FROM the line of the steps, minus the
       rise of the ring and a little clearance. Interpolating the two
       independently—which is what was here—gave them different gradients,
       so the flight started above the arches and ended up passing through
       them. Where the flight has come down too close to the paving for an arch
       to fit beneath it, the bay is solid, which is what a viaduct does as it
       meets the ground. */
    /* The flight has to come down onto the pavement at the z it actually
       ARRIVES at, which is fifty meters south of where it starts and where the
       street stands at its own level. Taken from the street beside the arch it
       ended half a story over the ground at its foot. */
    const bays = 7, bayW = 7.0, run = bays*bayW;
    const zTop = z0 + depth/2 - 0.5, footZ = zTop + run;
    const stepTop = landTop, stepBot = streetLevelAt(footZ) + 0.55;
    const yStepAt = t => lerp(stepTop, stepBot, t);
    /* the underside of the treads at any point along the run: what every ring,
       spandrel and solid bay beneath the flight is built up to */
    const stepUnder = zz => yStepAt(clamp((zz-zTop)/run, 0, 1)) - 0.62;
    const aSpan = bayW - 2.6, aTh = 1.3, aDep = 6.8;   // as deep as its own piers
    const drop  = aSpan/2 + aTh + 1.0;   // rise + thickness + the treads' soffit
    for(let i=0;i<bays;i++){
      const bz = zTop + bayW*(i+0.5);
      const t  = bayW*(i+0.5)/run;
      const sy = yStepAt(t) - drop;
      if(sy > streetY + 1.4){
        B.arch('ashlar','base',{x:pierX, z:bz, y:sy, span:aSpan, thick:aTh,
                                depth:aDep, axis:'z', seg:11, uv:0.24});
        /* AND ITS SPANDREL, and piers that reach the treads. Seven bare rings
           with a stair floating over them showed daylight through every haunch
           from the west, which is the same fault the causeways had and the same
           cure: a wall with holes in it, the fill following the ring. */
        archSpandrel(B,'ashlar','base',{x:pierX, z:bz, y:sy, span:aSpan,
                                thick:aTh, depth:aDep, axis:'z', seg:11,
                                uv:0.24, ao:0.95, deckAt:stepUnder});
        for(const sd of [-1,1])                  // the pier each side of it
          B.box('ashlar','base',{x:pierX, z:bz+sd*bayW/2, y:streetY-2.5, sx:aDep,
                                 sy:stepUnder(bz+sd*bayW/2)-streetY+2.5,
                                 sz:bayW-aSpan, uv:1/9.6, ao:1, grad:0.2});
      } else {
        B.box('ashlar','base',{x:pierX, z:bz, y:streetY-2.5, sx:aDep,
                               sy:stepUnder(bz)-streetY+2.5, sz:bayW+0.4,
                               uv:1/9.6, ao:1, grad:0.2});
      }
    }
    /* and the steps over them, carried all the way down to the paving */
    const n2 = 44;
    for(let i=0;i<n2;i++){
      const t=(i+0.5)/n2;
      const bz = lerp(zTop, footZ, t);
      const y  = yStepAt(t);
      B.box('paving','base',{x:pierX, z:bz, y:y-0.62, sx:6.4, sy:0.68,
                             sz:run/n2+0.6, uv:0.45, ao:lerp(1,0.84,t), skip:'B'});
    }
    /* Parapets, stepped down with the flight. Run as two long level boxes they
       read as a pair of poles hanging in the air over the stair. */
    for(let i=0;i<n2;i++){
      const t=(i+0.5)/n2;
      const bz = lerp(zTop, footZ, t);
      const y  = yStepAt(t);
      for(const sd of [-1,1])
        B.box('ashlarFine','base',{x:pierX+sd*3.5, z:bz, y:y-0.5, sx:0.7,
          sy:1.5, sz:run/n2+0.6, uv:0.5, ao:0.95, skip:'B'});
    }

    /* the parapet block inscribed "to the place of trumpeting" */
    B.box('ashlarFine','base',{x:PLAT.SW[0]-2.9, z:PLAT.SW[1]-1.5, y:ESP+0.1,
                               sx:1.5, sy:1.15, sz:2.6, uv:0.6, ao:1});
  });
}

/* ---- the gate at the head of Wilson's causeway ------------------
     A gatehouse straddling the wall, the western counterpart of the Shushan
     Gate: the road from the Upper City arrives level with the esplanade and
     goes straight through it into the outer court. Lintelled, not vaulted,
     because the one western gate whose head survives—Barclay's fifty-ton
     monolith—is lintelled; and with a relieving arch worked into the wall
     above the lintel, without which sixteen cubits of clear span is asking a
     single stone to carry the whole wall in bending. */
function buildWilsonGate(B){
  const g = GATES.wilson;
  const z = PLAT.SW[1] - g.at;
  B.part('wilsonGate',{name:'The gate at Wilson’s Arch', key:'wilson',
                       at:[6, ESP+g.h*0.6, z]},()=>{
    const oF = -WALLS.thick/2 - 2.2, iF = WALLS.head/2 + 1.4;
    const dep = iF - oF, xm = (oF + iF)/2;
    const head = ESP + PORTICO.colH + 3.4;      // the head of the wall alongside
    const jamb = 3.4, lint = 2.3;               // piers, and the lintel's depth
    const sill = ESP - 0.45;
    /* the threshold the road runs over */
    B.box('paving','base',{x:xm, z, y:sill, sx:dep, sy:0.5, sz:g.w+1.2,
                           uv:0.5, ao:0.92});
    /* the two piers flanking the passage, carried to the head of the wall */
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:xm, z:z+sd*(g.w/2+jamb/2), y:ESP, sx:dep,
        sy:head-ESP, sz:jamb, uv:0.28, ao:1, grad:0.12});
    /* THE LINTEL. One stone across the opening and into both piers, of the
       proportions of Barclay's—twice as deep as it is thick. */
    B.box('ashlar','base',{x:xm, z, y:ESP+g.h, sx:dep, sy:lint,
                           sz:g.w+2*jamb*0.55, uv:1/9.6, ao:1});
    /* the relieving arch over it, and the masonry it carries up to the head */
    const R = g.w/2 + 0.5, spring = ESP + g.h + lint;
    B.arch('ashlarFine','base',{x:xm, z, y:spring, span:2*R, thick:1.15,
                                depth:dep, axis:'z', seg:18, uv:0.3});
    /* spandrels, sliced round the ring so no daylight shows under the crown */
    const NS = 14;
    for(let i=0;i<NS;i++){
      const t0=(Math.PI/2)*(i/NS), t1=(Math.PI/2)*((i+1)/NS);
      const h0 = R*Math.cos(t0);
      const y0 = spring + R*Math.sin(t0), y1 = spring + R*Math.sin(t1);
      if(R-h0 < 0.04) continue;
      for(const sd of [-1,1])
        B.box('ashlarFine','base',{x:xm, z:z+sd*(h0+R)/2, y:y0, sx:dep,
          sy:y1-y0, sz:R-h0, uv:0.3, ao:1, skip:'TB'});
    }
    B.box('ashlarFine','base',{x:xm, z, y:spring+R, sx:dep, sy:head-(spring+R),
      sz:g.w+2*jamb, uv:0.28, ao:1, grad:0.1, skip:'B'});
    /* the tympanum under the relieving arch, set back behind its ring */
    B.box('ashlarFine','base',{x:xm, z, y:spring, sx:dep-1.0, sy:R-0.3,
      sz:2*R-0.6, uv:0.3, ao:0.96, skip:'TB'});
    /* a cornice at the head, and a moulded architrave over the lintel outside */
    B.box('ashlarFine','roofs',{x:xm-0.5, z, y:head, sx:dep+1.0, sy:1.2,
      sz:g.w+2*jamb+1.6, uv:0.3, ao:1, aoBot:0.6});
    B.box('ashlarFine','base',{x:oF+0.5, z, y:ESP+g.h-0.1, sx:1.3, sy:lint+0.5,
      sz:g.w+2*jamb*0.75, uv:0.3, ao:1});
    /* responds down each side of the opening on the outer face */
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:oF+0.5, z:z+sd*(g.w/2+0.85), y:ESP, sx:1.3,
        sy:g.h-0.1, sz:1.7, uv:0.3, ao:1});
    /* the two leaves, thrown back flat against the inner reveal */
    const lw = g.w*0.46;
    for(const sd of [-1,1])
      B.box('bronze','base',{x:iF-0.6-lw/2, z:z+sd*(g.w/2-0.35), y:ESP+0.05,
        sx:lw, sy:g.h-0.7, sz:0.4, uv:0.7, ao:1});
  });
}

/* ---- Barclay's and Warren's gates in the western wall ---------- */
function buildWesternGates(B){
  for(const key of ['barclay','warren']){
    const g=GATES[key];
    const z = PLAT.SW[1] - g.at;
    B.part(key,{name:key==='barclay'?"Barclay's Gate":"Warren's Gate", key:'street',
                at:[-4,-18,z]},()=>{
      const gy = streetLevelAt(z);      // the pavement they open off
      B.box('shadow','base',{x:PLAT.SW[0]-2.5, z, y:gy+1.0, sx:1.6, sy:g.h, sz:g.w,
                             uv:0.4, ao:0.13});
      /* the monolithic lintel—Barclay's is 7.5 m long and still in place */
      B.box('ashlar','base',{x:PLAT.SW[0]-2.6, z, y:gy+1.0+g.h, sx:1.9, sy:1.65,
                             sz:g.w+3.0, uv:1/9.6, ao:1});
      for(const s of [-1,1])
        B.box('ashlar','base',{x:PLAT.SW[0]-2.6, z:z+s*(g.w/2+0.8), y:gy+1.0,
                               sx:1.9, sy:g.h, sz:1.6, uv:1/9.6, ao:1});
    });
  }
}

/* ---- the Shushan Gate in the eastern wall, on the axis ---------
     A projecting gatehouse: an arched passage barrel-vaulted through it, its
     spandrels filled, and the masonry above the vault carried up to the head of
     the wall so the arch has something to carry.

     What was here before was an arch with a block balanced on its crown and a
     cornice floating above that—the symptom of a gate given forty cubits of
     clear height, which is more than the wall stands above the pavement, so
     nothing above it could reach the wall to sit on. The opening is arched
     instead: twenty cubits wide, springing at ten and crowning at twenty-two.
     Fleming's 1969 sighting of voussoirs directly beneath the Golden Gate is
     the only physical evidence for the form, and it is an arch. */
function buildShushanGate(B){
  B.part('shushan',{name:INFO.shushan.n, key:'shushan',
                    at:[...(()=>{const p=precinctToWorld(500,AXIS_Z);
                                 return [p[0]+10,cu(14),p[1]];})()]},()=>{
    const g=GATES.shushan;
    const p = precinctToWorld(500, AXIS_Z);
    B.pushT(p[0],0,p[1]); B.pushRotY(PRECINCT_ROT);
    /* Local +X is outward, east. */
    const oF = WALLS.thick/2 + 0.4, iF = -WALLS.thick/2 - 0.6;
    const dep = oF - iF, xm = (oF + iF)/2;
    const R = g.w/2, spring = ESP + g.h - R;     // it springs at h - w/2
    const head = ESP + PORTICO.colH + 3.4;       // the head of the wall alongside
    const jamb = 3.6;                            // the flanking piers
    B.box('paving','base',{x:xm, z:0, y:ESP-0.5, sx:dep, sy:0.55, sz:g.w+1.2,
                           uv:0.5, ao:0.92});                      // threshold
    /* the two piers flanking the passage, full height */
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:xm, z:sd*(g.w/2+jamb/2), y:ESP, sx:dep,
        sy:head-ESP, sz:jamb, uv:0.28, ao:1, grad:0.12});
    /* the barrel vault over the passage */
    B.arch('ashlarFine','base',{x:xm, z:0, y:spring, span:g.w, thick:1.1,
                                depth:dep, axis:'z', seg:20, uv:0.3});
    /* The spandrels, filled from the vault out to the piers in slices taken
       round the ring rather than up in equal heights: sliced by height the
       step left under the crown is wider than the ring is thick, and daylight
       shows through it. Each slice starts at its own foot, where the intrados
       is widest, so no fill ever intrudes into the passage. */
    const NS = 16;
    for(let i=0;i<NS;i++){
      const t0=(Math.PI/2)*(i/NS), t1=(Math.PI/2)*((i+1)/NS);
      const h0 = R*Math.cos(t0);
      const y0 = spring + R*Math.sin(t0), y1 = spring + R*Math.sin(t1);
      if(R-h0 < 0.04) continue;
      for(const sd of [-1,1])
        B.box('ashlarFine','base',{x:xm, z:sd*(h0+R)/2, y:y0, sx:dep,
          sy:y1-y0, sz:R-h0, uv:0.3, ao:1, skip:'TB'});
    }
    B.box('ashlarFine','base',{x:xm, z:0, y:spring+R, sx:dep, sy:head-(spring+R),
      sz:g.w+2*jamb, uv:0.28, ao:1, grad:0.1, skip:'B'});
    /* the archivolt on the outer face, on responds carried down to the sill */
    B.arch('ashlarFine','base',{x:oF+0.55, z:0, y:spring, span:g.w, thick:1.5,
                                depth:1.5, axis:'z', seg:20, uv:0.3});
    for(const sd of [-1,1])
      B.box('ashlarFine','base',{x:oF+0.55, z:sd*(g.w/2+0.9), y:ESP, sx:1.5,
        sy:spring-ESP, sz:1.8, uv:0.3, ao:1});
    /* a cornice at the head, and no free-standing block anywhere */
    B.box('ashlarFine','roofs',{x:xm+0.5, z:0, y:head, sx:dep+1.0, sy:1.2,
      sz:g.w+2*jamb+1.6, uv:0.3, ao:1, aoBot:0.6});
    /* the two leaves, thrown back flat against the jambs */
    const lw = g.w*0.46;
    for(const sd of [-1,1])
      B.box('gold','base',{x:iF+0.6+lw/2, z:sd*(R-0.3), y:ESP+0.05, sx:lw,
        sy:spring-0.5, sz:0.42, uv:0.7, ao:1});
    B.pop(); B.pop();
  });
}

/* ---- THE CAUSEWAY TO THE MOUNT OF OLIVES ----------------------
     Mishnah Parah 3:6: "A causeway was made from the Temple Mount to the
     Mount of Olives, arches above arches, each arch directly above a pier,
     as a protection against a grave in the depths"—so that the priest who
     burned the red heifer could go out through this gate without passing over
     a burial. The doubled arcade is the point of it, not decoration. */
function buildOlivetCauseway(B){
  B.part('causeway',{name:'The causeway to the Mount of Olives', key:'causeway',
                     at:[...(()=>{const p=precinctToWorld(500,AXIS_Z);
                                  return [p[0]+120, 6, p[1]];})()]},()=>{
    const p = precinctToWorld(500, AXIS_Z);
    B.pushT(p[0],0,p[1]); B.pushRotY(PRECINCT_ROT);
    const deck = CAUSEWAY.deck, w = CAUSEWAY.w;
    const span = 11.0, pierW = 4.4, bay = span + pierW;
    const upSpring = deck - (span/2 + 1.6);       // the upper tier
    const loSpring = upSpring - (span/2 + 5.2);   // the lower tier
    /* IT RUNS TO THE GROUND. Parah 3:6 has it going from the Mount to the Mount
       of Olives, and the priest with the heifer walked out along it—so it has
       to arrive somewhere. It used to stop after twelve bays, or as soon as the
       hill rose within two meters of the upper springing, whichever came first,
       and end in mid-air over the Kidron's eastern slope. Now it carries on
       until the hill has risen to the roadway itself, and where there is no
       longer room for a ring beneath the road the bay is built SOLID—which is
       what a viaduct does as it meets the ground, and what Robinson's does at
       the other end of the Mount.

       Each pier takes its own footing from the ground under ITSELF. Taken from
       the ground under the arch beside it, every pier on a slope was founded at
       the wrong level. */
    const roadU = CAUSEWAY.roadU;                 // the underside of the roadway
    const gAt = xx => groundLevel(p[0] + xx*CAUSEWAY.dx, p[1] + xx*CAUSEWAY.dz);
    let x = WALLS.thick/2 + 2.0 + span/2, bays = 0, far = x;
    while(bays < 40){
      const g = gAt(x);
      if(g > roadU - 1.0) break;                  // the hill has met the road
      if(g < upSpring - 2.0){
        /* upper arch, and the lower arch directly beneath the same pier line */
        B.arch('ashlar','city',{x, z:0, y:upSpring, span, thick:1.4, depth:w,
                                axis:'x', seg:12, uv:0.24});
        archSpandrel(B,'ashlar','city',{x, z:0, y:upSpring, span, thick:1.4,
                                        depth:w, axis:'x', seg:12,
                                        deckY:roadU, uv:0.24, ao:0.95});
        if(g < loSpring - 2.0){
          B.arch('ashlar','city',{x, z:0, y:loSpring, span, thick:1.4, depth:w,
                                  axis:'x', seg:12, uv:0.24});
          archSpandrel(B,'ashlar','city',{x, z:0, y:loSpring, span, thick:1.4,
                                          depth:w, axis:'x', seg:12,
                                          deckY:upSpring, uv:0.24, ao:0.92});
        }
      } else {
        B.box('ashlar','city',{x, z:0, y:g-1.6, sx:span+1.2, sy:roadU-(g-1.6),
                               sz:w, uv:0.24, ao:0.9, grad:0.2});
      }
      const px = x + bay/2, gp = gAt(px);
      B.box('ashlar','city',{x:px, z:0, y:gp-1.6, sx:pierW, sy:roadU-(gp-1.6),
                             sz:w, uv:0.24, ao:0.88, grad:0.22});
      far = x + bay/2 + pierW/2;
      x += bay; bays++;
    }
    /* the roadway, and a low parapet each side */
    B.box('paving','city',{x:far/2, z:0, y:deck-0.8, sx:far+4, sy:0.8, sz:w,
                           uv:0.16, ao:1});
    for(const sd of [-1,1])
      B.box('ashlarFine','city',{x:far/2, z:sd*(w/2-0.4), y:deck, sx:far+4,
                                 sy:0.95, sz:0.8, uv:0.4, ao:0.95});
    B.pop(); B.pop();
  });
}

/* ---- the Tadi Gate on the north, which Middot says went unused -- */
function buildTadiGate(B){
  B.part('tadi',{name:'The Tadi Gate', key:'platform',
                 at:[GATES.tadi.at, cu(22), 16]},()=>{
    const g=GATES.tadi;
    const t=g.at/WALL_LEN.N;
    const x=lerp(PLAT.NW[0],PLAT.NE[0],t), z=lerp(PLAT.NW[1],PLAT.NE[1],t);
    B.box('shadow','base',{x,z:z+1.4,y:ESP,sx:g.w,sy:g.h,sz:3.0,uv:0.4,ao:0.15});
    B.box('ashlarFine','base',{x,z:z+1.4,y:ESP+g.h,sx:g.w+5,sy:2.0,sz:3.4,uv:0.3,ao:1});
    /* Middot 1:5 says its lintel was two stones leaning on each other */
    B.pushT(x,ESP+g.h+2.0,z+1.4);
    for(const s of [-1,1]){ B.pushRotZ(s*0.5);
      B.box('ashlarFine','base',{x:s*1.6,z:0,y:0,sx:4.2,sy:1.0,sz:3.2,uv:0.4,ao:1});
      B.pop(); }
    B.pop();
  });
}
