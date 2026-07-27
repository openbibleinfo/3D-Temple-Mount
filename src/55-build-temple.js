/* =====================================================================
 *  55—the sacred precinct
 *
 *  Everything here is built in the precinct's own frame: origin at the
 *  northwest corner of the 500-cubit square, local +X east, +Z south,
 *  rotated 4.223° from the Herodian walls because the old square was
 *  set out parallel to the eastern wall.
 *
 *  Local distances are written cu(<cubits>) throughout so that every
 *  number can be checked against Middot.
 * ===================================================================== */
'use strict';

/* the courts, as one rectangle: the Azarah plus the Court of the Women */
const CT = { x0:cu(AZ.x0), x1:cu(CW.x1), z0:cu(AZ.z0), z1:cu(AZ.z1) };
const STEP_RUN = 12*cu(0.5);          // 3.15 m—the twelve steps of the Chel
/* Half the thickness of the courts' wall. Everything outside the courts is set
   out from the wall's FACE, not from the center line CT gives, or it ends up
   buried three cubits deep in the masonry. */
const CT_FACE  = cu(3);
/* The twelve steps from the Court of the Priests up to the porch, Middot 3:6.
   Taken from where they are actually built: their head is at the front face of
   the foundation, three cubits east of the porch itself, not at the porch. */
const PORCH_STEP_W = cu(176), PORCH_STEP_E = cu(188);
const CHEL_W   = cu(10);              // 5.25 m
/* Middot 2:3 has the Soreg, then the Chel ten cubits broad, then the twelve
   steps. So the fence stands ten cubits clear of the FOOT of the steps, which
   is measured from the wall's face like everything else out here. */
const SOREG_OFF = CT_FACE + STEP_RUN + CHEL_W;   // 9.98 m from the center line

/* The flight inside each Azarah gatehouse: twenty treads of half a cubit,
   starting at the wall's inner face. `AZ_WELL` is how far the hole in the
   Azarah's floor has to reach from the wall's CENTER LINE, which is what the
   floor is set out from—the flight's run plus the half-thickness in front of
   it. Derived and not written down, because the two have already come apart
   once: the run was shortened from fourteen cubits to ten and the well was left
   at fourteen, which left a cubit of open hole beyond the top tread. */
const AZ_FLIGHT_N = 20, AZ_TREAD = cu(0.5);
const AZ_RUN  = AZ_FLIGHT_N * AZ_TREAD;
const AZ_WELL = CT_FACE + AZ_RUN;
const AZ_WELL_HALF = cu(5) + 0.35;    // the flight is ten cubits wide, the hole a little more

const AZ_GATE_X = [cu(105), cu(150), cu(200)];     // three north, three south
const CW_GATE_X = cu((CW.x0+CW.x1)/2);
const AXIS = cu(AXIS_Z);

function inPrecinct(B, fn){
  B.pushT(SQ_NW[0], 0, SQ_NW[1]);
  B.pushRotY(PRECINCT_ROT);
  fn();
  B.pop(); B.pop();
}

/* =====================================================================
 *  the Soreg, the Chel, and the twelve steps
 * ===================================================================== */
function buildSoregAndChel(B){
  inPrecinct(B,()=>{

    /* ---- the Soreg: a lattice ten handbreadths high, with thirteen
       breaches, and the Greek and Latin notices beside them ---------- */
    B.part('soreg',{name:INFO.soreg.n, key:'soreg',
                    at:[0,0,0], atLocal:[CT.x1+SOREG_OFF, 1.4, AXIS]},()=>{
      const h = 10*HB;                                   // 0.875 m
      const o = SOREG_OFF;
      const R = [[CT.x0-o,CT.z0-o],[CT.x1+o,CT.z0-o],[CT.x1+o,CT.z1+o],[CT.x0-o,CT.z1+o]];
      /* thirteen gaps, spaced round the circuit */
      const perim = 2*((R[1][0]-R[0][0]) + (R[2][1]-R[1][1]));
      const gaps = [];
      for(let i=0;i<13;i++) gaps.push(perim*(i+0.5)/13);
      let run = 0;
      for(let s=0;s<4;s++){
        const a=R[s], b=R[(s+1)%4];
        const L=Math.hypot(b[0]-a[0], b[1]-a[1]);
        const ops = gaps.filter(g=>g>run+2 && g<run+L-2).map(g=>({at:g-run, w:3.2, h:h}));
        wallOpen(B,'lattice','base',{from:a,to:b,y0:ESP+0.24,y1:ESP+h,
          thick:0.16, uv:1/1.6, ao:1, openings:ops, top:false});
        /* the stone curb it stands on */
        B.wall('ashlarFine','base',{from:a,to:b,y0:ESP,y1:ESP+0.24,thick:0.6,
          uv:0.5, caps:false, ao:0.9});
        /* posts */
        const nP = Math.round(L/3.2);
        for(let i=0;i<=nP;i++){
          const t=i/nP;
          B.box('ashlarFine','base',{x:lerp(a[0],b[0],t), z:lerp(a[1],b[1],t),
            y:ESP+0.24, sx:0.34, sy:h+0.14, sz:0.34, uv:1.2, ao:1, skip:'B'});
        }
        /* a notice at each breach: "no foreigner is to enter within" */
        for(const g of ops){
          const p=[lerp(a[0],b[0],(g.at+2.4)/L), lerp(a[1],b[1],(g.at+2.4)/L)];
          B.box('ashlarFine','base',{x:p[0],z:p[1],y:ESP+0.24,sx:0.9,sy:1.35,sz:0.28,
            uv:1.1, ao:1, skip:'B'});
        }
        run += L;
      }
    });

    /* ---- the Chel, ten cubits broad, and the twelve steps ---------- */
    B.part('chel',{name:INFO.chel.n, key:'chel',
                   atLocal:[CT.x1+STEP_RUN+2, 1.0, AXIS]},()=>{
      /* the terrace itself */
      B.frame('paving','base',{
        x:(CT.x0+CT.x1)/2, z:(CT.z0+CT.z1)/2,
        sx:(CT.x1-CT.x0)+2*(CT_FACE+STEP_RUN+CHEL_W),
        sz:(CT.z1-CT.z0)+2*(CT_FACE+STEP_RUN+CHEL_W),
        ix:(CT.x1-CT.x0), iz:(CT.z1-CT.z0), y:ESP+0.10, uv:1/6.4, ao:1 });

      /* THE TWELVE STEPS, as concentric rings and not as four flights.
         Four straight flights, each made wide enough to reach the corners,
         run THROUGH each other where they meet: two sets of treads at
         different heights crossing at right angles, which is the little
         stair to nowhere that stood at every corner. Rings mitre.

         And they are set out from the OUTER FACE of the courts' wall, not
         from its center line. Measured from the center, the top six steps
         were buried in the six-cubit thickness of the wall, so the flight
         arrived at the face only half-way up and every gate opened a cubit
         and a half above the last tread anyone could stand on. */
      const rise=cu(0.5), tread=cu(0.5), n=12;
      const iX0=CT.x0-CT_FACE, iX1=CT.x1+CT_FACE;
      const iZ0=CT.z0-CT_FACE, iZ1=CT.z1+CT_FACE;
      for(let k=0;k<n;k++){
        /* counting from the bottom: the lowest tread is the widest and the
           shortest, and each ring above reaches back over the one below so
           that no riser shows a gap */
        const out = (n-k)*tread, sy = rise*(k+1);
        const X0=iX0-out, X1=iX1+out, Z0=iZ0-out, Z1=iZ1+out;
        const sh = lerp(0.80, 1, k/(n-1));
        for(const [bx,bz,bsx,bsz] of [
              [(X0+X1)/2,   (Z0+iZ0)/2,  X1-X0,    iZ0-Z0],
              [(X0+X1)/2,   (iZ1+Z1)/2,  X1-X0,    Z1-iZ1],
              [(X0+iX0)/2,  (iZ0+iZ1)/2, iX0-X0,   iZ1-iZ0],
              [(iX1+X1)/2,  (iZ0+iZ1)/2, X1-iX1,   iZ1-iZ0]])
          B.box('paving','base',{x:bx, z:bz, y:ESP, sx:bsx, sy, sz:bsz,
                                 uv:0.7, ao:sh, aoTop:lerp(0.86,1,k/(n-1)),
                                 skip:'B'});
      }
    });
  });
}

/* =====================================================================
 *  the walls of the courts, and their ten gates
 * ===================================================================== */
function buildCourtWalls(B){
  inPrecinct(B,()=>{
    const gw = cu(10), gh = cu(20);          // Middot 2:3—gateways 20 x 10
    const azTop = ESP + cu(40);
    const cwTop = ESP + cu(30);

    /* A gatehouse over an opening. The block reaches down to the wall head, so
       its cornice cannot float above a gap; the passage gets a lit reveal
       through the wall's thickness; and the two gilded leaves are sized to the
       opening they hang in and thrown back against the jambs. */
    const gatehouse = (gx,gz,along,top,wallTop,ow,yFoot,yHead,yDoor)=>{
      const oh = yHead - yFoot;
      const aX = along==='x';                 // the wall runs along x
      const th = cu(6);                       // the wall's thickness
      const sx = aX ? ow+cu(16) : cu(14);
      const sz = aX ? cu(14)    : ow+cu(16);
      const y0 = Math.min(top - cu(2), wallTop - cu(1.5));
      /* The same 1/9.6 the court walls are built at. A gatehouse block and a
         pair of jambs given a scale of their own put masonry three times finer
         immediately beside the wall they are bonded into, and the join reads as
         a change of material -- which is what made the stonework flanking every
         door look unstable, matching the wall at one gate and not at the next
         depending on how much of each was in view. */
      const WUV = 1/9.6;
      B.box('ashlarFine','base',{x:gx,z:gz,y:y0,sx,sy:(top+cu(9))-y0,sz,
                                 uv:WUV,ao:1,grad:0.1});
      B.box('ashlarFine','roofs',{x:gx,z:gz,y:top+cu(9),sx:sx+1.5,sy:1.2,
                                  sz:sz+1.5,uv:0.3,ao:1,aoBot:0.6});
      const sill = yFoot;
      /* jambs, a coffered soffit and a threshold */
      /* THE JAMBS STAND PROUD OF THE WALL. Given exactly the wall's thickness
         they were flush with it on both faces—two coplanar surfaces the width
         of a jamb, at every one of the eleven gates—and the stonework beside
         every door flickered between the two as you moved. A surround stands
         forward of the wall it frames anyway. */
      /* AND SIT A LITTLE INSIDE THE OPENING. Standing proud takes their side
         faces out of the wall's, but their INNER face was still exactly on the
         opening's edge—and that edge is where `wallOpen` caps the wall run,
         a quad facing the same way over the whole 5.25 by 10.5 m of the reveal.
         Two surfaces in one plane, pointing the same way, at every gate: it is
         the flicker you get immediately left and right of a door. Six
         centimetres in and the jamb is the reveal, with the wall's cap behind
         it. The leaves overlap it by two, which is what a leaf does. */
      const jd = th + 0.6, jIn = 0.06;
      for(const sd of [-1,1])
        B.box('ashlarFine','base',{
          x: aX ? gx + sd*(ow/2 + cu(1.2) - jIn) : gx,
          z: aX ? gz : gz + sd*(ow/2 + cu(1.2) - jIn),
          y: sill, sx: aX ? cu(2.4) : jd, sy: oh, sz: aX ? jd : cu(2.4),
          uv:WUV, ao:1, grad:0.12});
      /* THE SOFFIT REACHES PAST BOTH WALL FACES. Set back inside the reveal at
         th-0.5 it left a quarter-meter strip at each face with nothing over it,
         and what is over the opening is the wall run above, which `B.wall` gives
         no underside—so looking up at a door from outside you saw daylight in
         a band above the wood. It projects 0.2 m now, a lintel rather than a
         panel, and stops 0.1 m short of the jambs' own face so the two are not
         in one plane either. */
      B.box('cedar','base',{x:gx,z:gz,y:yHead-0.5,
        sx: aX ? ow : th+0.4, sy:0.5, sz: aX ? th+0.4 : ow,
        uv:0.5, ao:0.82, aoBot:0.55});
      B.box('paving','base',{x:gx,z:gz,y:yDoor-0.5,
        sx: aX ? ow+0.9 : th+0.9, sy:0.55, sz: aX ? th+0.9 : ow+0.9,
        uv:0.5, ao:0.92});
      /* The leaves: hinged at the jambs, standing back in the reveal, and
         MEETING in the middle. At 0.45 of the opening each they left half a
         meter of daylight down the center of every closed gate, and what
         showed through it was whatever happened to stand behind—the Azarah
         at one gate, a chamber wall at another, a different stone at a third.
         A shut door is shut. */
      const lw = ow*0.5 - 0.04, lt = 0.42, dh = yHead - yDoor;
      for(const sd of [-1,1]){
        const cxx = aX ? gx + sd*(ow/2 - lw/2) : gx + th*0.26;
        const czz = aX ? gz + th*0.26 : gz + sd*(ow/2 - lw/2);
        B.box('gold','base',{x:cxx,z:czz,y:yDoor+0.05,
          sx: aX ? lw : lt, sy: dh*0.97, sz: aX ? lt : lw, uv:0.7, ao:1});
        for(let k=1;k<=4;k++)                 // rails, so a tall leaf reads
          B.box('gold','base',{x:cxx,z:czz,y:yDoor+dh*0.97*k/5-0.18,
            sx: aX ? lw-0.35 : lt+0.16, sy:0.36,
            sz: aX ? lt+0.16 : lw-0.35, uv:1.6, ao:1});
      }
    };

    /* --- the north and south walls --------------------------------- */
    /* Both runs are carried half a wall-thickness past the corners, so that
       the corners come out solid instead of three-quarters filled. */
    const azFrom = CT.x0 - cu(3), cwTo = CT.x1 + cu(3);
    for(const [zLine, sideName] of [[CT.z0,'north'],[CT.z1,'south']]){
      /* the Azarah stretch */
      wallOpen(B,'ashlarFine','base',{
        from:[azFrom, zLine], to:[cu(AZ.x1), zLine], y0:ESP, y1:azTop,
        thick:cu(6), uv:1/9.6, ao:1, grad:0.16,
        /* Twenty cubits from the threshold you cross. The Azarah floor stands
           ten cubits higher than the Chel outside, and across a difference like
           that no single opening reads as twenty cubits from both faces; hung
           at the Azarah level instead the leaves stood five meters up at the
           head of the flight and stopped looking like doors at all. They belong
           on the threshold. The stair is behind them. */
        openings: AZ_GATE_X.map(x=>({at:x-azFrom, w:gw, h:gh, sill:cu(6)}))
      });
      /* the Court of the Women stretch, a little lower */
      wallOpen(B,'ashlarFine','base',{
        from:[cu(AZ.x1), zLine], to:[cwTo, zLine], y0:ESP, y1:cwTop,
        thick:cu(6), uv:1/9.6, ao:1, grad:0.16,
        openings:[{at:CW_GATE_X-cu(AZ.x1), w:gw, h:gh, sill:cu(6)}]
      });
      for(const gx of AZ_GATE_X)
        gatehouse(gx, zLine, 'x', azTop, azTop, gw,
                  ESP+cu(6), ESP+cu(6)+gh, ESP+cu(6));
      gatehouse(CW_GATE_X, zLine, 'x', cwTop, cwTop, gw,
                ESP+cu(6), ESP+cu(6)+gh, ESP+cu(6));

      /* The Azarah floor stands ten cubits above the Chel, so each of its
         six gates needed its own flight inside the gatehouse. The Mishnah
         does not describe them; this is the usual reconstruction. */
      for(const gx of AZ_GATE_X){
        /* The flight begins at the INNER face, so the gateway itself is level
           and the doors have a threshold to stand on; the climb to the Azarah
           happens beyond them, inside the gatehouse. */
        const inward = sideName==='north' ? 'S' : 'N';
        const zStart = sideName==='north' ? zLine+CT_FACE : zLine-CT_FACE;
        /* A NOSING, AND A SHORTER RUN. The top tread finished exactly level with
           the Azarah's floor, so two surfaces at the same height fought all
           along the head of every flight—and because the floor is laid at
           1/6.3 and the treads at 0.6, the two read as different stone as they
           alternated. Three centimetres of nosing settles it.
           And at a 0.7-cubit tread the flight drove 7.35 m into the court, out
           under the guard wall and the slaughtering tables, which then stood on
           the sloping surface of a stair instead of on the pavement. Half a
           cubit brings it back to 5.25 m, inside the gatehouse's own reach. */
        const azRise = (LEV.priests - LEV.women + 0.03)/AZ_FLIGHT_N;
        B.stairs('marbleFloor','base',{x:gx, z:zStart, y:LEV.women, n:AZ_FLIGHT_N,
          rise:azRise, tread:AZ_TREAD, w:cu(10), dir:inward, uv:1/6.3});
        /* CHEEK WALLS EITHER SIDE OF IT. The Azarah's floor has a well at each
           gate for the flight to rise in, and the well was open at its sides—
           so walking up through the doors you looked straight past the treads
           into the fill under the court. The flight is ten cubits wide; the
           cheeks run its whole length, from the level it starts at to the level
           it arrives at. */
        const inSgn = sideName==='north' ? 1 : -1;
        /* AND THEY LINE THE HOLE RATHER THAN SPREADING OUT UNDER THE FLOOR.
           Built four cubits thick, a cheek was mostly buried beneath the
           Azarah's pavement, and topped out at exactly LEV.priests it put its
           head in the plane of that pavement over a strip 1.75 m wide and the
           whole 5.25 m of the flight—on both sides of all six gates. That is
           the flicker to the left and right of every one of these stairs.

           Dropping the head below the floor only trades it for a slot: the
           floor is a single-sided sheet with nothing under it, so an eight
           centimetre gap at the top of a cheek is a view into that void. Only
           the INNER face of a cheek is ever seen, so it becomes the lining of
           the well and nothing more—from just inside the treads, which buries
           their side faces, out to the well's own edge, where the curb takes
           over. Its top and the floor now meet edge to edge instead of
           overlapping, and neither is in the other's plane. */
        const cIn = cu(5) - 0.05, cOut = AZ_WELL_HALF;
        for(const sd of [-1,1])
          B.box('ashlarFine','base',{
            x: gx + sd*(cIn + cOut)/2,
            z: zStart + inSgn*AZ_RUN/2,
            y: LEV.women, sx: cOut - cIn, sy: LEV.priests-LEV.women, sz: AZ_RUN,
            uv:1/9.6, ao:0.95, grad:0.12});
      }
    }

    /* --- the eastern wall, with the outer eastern gate ------------- */
    wallOpen(B,'ashlarFine','base',{
      from:[CT.x1, CT.z0], to:[CT.x1, CT.z1], y0:ESP, y1:cwTop,
      thick:cu(6), uv:1/9.6, ao:1, grad:0.16,
      openings:[{at:AXIS-CT.z0, w:cu(14), h:cu(26), sill:cu(6)}]
    });
    B.part('easternGate',{name:'The eastern gate of the Court of the Women',
                          key:'nicanor', atLocal:[CT.x1+1, cu(30), AXIS]},()=>{
      gatehouse(CT.x1, AXIS, 'z', cwTop+cu(4), cwTop, cu(14),
                ESP+cu(6), ESP+cu(6)+cu(26), ESP+cu(6));
    });

    /* --- the western wall of the Azarah ---------------------------- */
    B.wall('ashlarFine','base',{from:[CT.x0,CT.z0],to:[CT.x0,CT.z1],
      y0:ESP,y1:azTop,thick:cu(6),uv:1/9.6,caps:false,ao:1,grad:0.16});
  });
}

/* =====================================================================
 *  the Court of the Women
 * ===================================================================== */
function buildCourtOfWomen(B){
  inPrecinct(B,()=>{
    const x0=cu(CW.x0), x1=cu(CW.x1), z0=cu(CW.z0), z1=cu(CW.z1);
    B.part('women',{name:INFO.women.n, key:'women',
                    atLocal:[(x0+x1)/2, LEV.women+cu(6), (z0+z1)/2]},()=>{
      /* THE COURT'S FLOOR IS CUT ROUND THE FOUR CORNER COURTS, which pave
         themselves. Laid as one slab with theirs six centimeters over the top
         of it, the two were a decal and its backing: they held on a desktop's
         24-bit depth buffer and tore apart on an iPad's 16-bit one, where at a
         hundred meters a whole meter of depth rounds to the same number. Six
         centimeters is not a step anyone meant to build, either—the chambers
         are level with the court, and the marble simply stops where their
         paving starts. Minus four corners a rectangle is a cross, and a cross
         is three rectangles. */
      const cc = cu(40);
      for(const r of [[x0, z0+cc, x1, z1-cc],       // the middle band, full width
                      [x0+cc, z0, x1-cc, z0+cc],    // between the north pair
                      [x0+cc, z1-cc, x1-cc, z1]])   // between the south pair
        B.poly('marbleFloor','base',
               [[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]],
               LEV.women, 1/6.3, 1);

      /* Four chambers of forty cubits in the corners, and Middot 2:5 states in
         so many words that they were NOT ROOFED—"ve-lo hayu mekorot"—and
         then troubles to prove it from Ezekiel 46:22, where the four corner
         enclosures of the Temple to come are hazerot keturot: "and keturot
         means nothing other than that they were not roofed." Ezekiel calls
         them courts, not chambers, for the same reason. They are open courts
         of forty cubits, which is also what their uses want: boiling, sorting
         timber, and immersion are none of them indoor work. */
      const c=cu(40), corners=[
        [x1-c/2, z1-c/2, 'Chamber of the Nazirites', 'nazirite'],  // southeast
        [x1-c/2, z0+c/2, 'Wood Chamber',             'wood'],      // northeast
        [x0+c/2, z0+c/2, 'Chamber of the Lepers',    'leper'],     // northwest
        [x0+c/2, z1-c/2, 'Chamber of Oil',           'oil'],       // southwest
      ];
      const dw = cu(8), dh = cu(16);          // a doorway, 8 by 16 cubits
      for(const [cx,cz,,use] of corners){
        /* Low enclosing walls only: the Mishnah says they were unroofed. Each
           run is carried half a thickness past the corners—ends were left
           uncapped before, which showed as open notches where two walls met—
           and each chamber is given a doorway off the court, on whichever of
           its two inner faces looks toward the middle of the court. */
        const t = cu(2), h = t/2;
        const inX = (cx < (x0+x1)/2) ? 1 : -1;    // toward the court's center
        const inZ = (cz < (z0+z1)/2) ? 1 : -1;
        const W=cx-c/2, E=cx+c/2, N=cz-c/2, S=cz+c/2;
        /* the two sides facing the court get the door; the outer two are solid */
        const runs = [
          { from:[W-h,N], to:[E+h,N], door: inZ<0 },   // north face
          { from:[W-h,S], to:[E+h,S], door: inZ>0 },   // south face
          { from:[W,N-h], to:[W,S+h], door: inX>0 },   // west face
          { from:[E,N-h], to:[E,S+h], door: inX<0 },   // east face
        ];
        let placed=false;
        for(const r of runs){
          const L = Math.hypot(r.to[0]-r.from[0], r.to[1]-r.from[1]);
          const ops = (r.door && !placed) ? (placed=true,
                        [{at:L/2, w:dw, h:dh}]) : [];
          wallOpen(B,'ashlarFine','base',{from:r.from, to:r.to,
            y0:LEV.women, y1:LEV.women+cu(14), thick:t, uv:0.22, ao:1,
            grad:0.12, openings:ops});
        }
        /* level with the court, in the hole the court's floor leaves for it */
        B.poly('paving','base',[[W,N],[E,N],[E,S],[W,S]],LEV.women,1/5,0.9);

        /* And what Middot 2:5 says each of them was FOR. Because they are open
           courts they are looked straight down into from the gallery and from
           the twelve steps, and a walled square of forty cubits with nothing in
           it reads as something unfinished rather than as a working yard. Only
           what the Mishnah names is here. */
        const fy = LEV.women;
        if(use==='nazirite'){
          /* "there the Nazirites boil their peace offerings, shave their hair,
             and throw it under the pot"—so: a hearth, and a pot over it */
          B.box('ashlarFine','base',{x:cx,z:cz,y:fy,sx:2.8,sy:0.80,sz:2.8,
                                     uv:0.6,ao:0.95,grad:0.2});
          B.cyl('bronze','base',{x:cx,z:cz,y:fy+0.80,r0:0.82,r1:0.94,h:0.92,
                                 seg:16,uvU:1,uvV:1,ao:0.88});
          B.box('ashlarFine','base',{x:cx+4.4,z:cz-1.2,y:fy,sx:2.2,sy:0.55,sz:1.0,
                                     uv:0.7,ao:0.95});     // the barber's bench
        } else if(use==='wood'){
          /* "there the priests with blemishes wormed the wood"—sorting the
             sound logs from the worm-eaten, which could not go on the altar */
          for(let s=0;s<3;s++){
            const sx=cx+(s-1)*4.0;
            for(let r=0;r<3;r++)
              B.box('cedar','base',{x:sx,z:cz-1.0,y:fy+r*0.46,sx:3.6,sy:0.44,
                                    sz:1.9,uv:0.8,ao:1-r*0.06});
          }
          B.pushT(cx+1.2,fy+0.30,cz+4.2); B.pushRotZ(Math.PI/2);
          for(let i=0;i<4;i++)
            B.cyl('cedar','base',{x:0,z:i*0.62,y:-1.4,r0:0.15,r1:0.14,h:2.8,
                                  seg:8,capTop:true,uvU:1,uvV:1,ao:0.9});
          B.pop(); B.pop();
        } else if(use==='leper'){
          /* "there the lepers immerse themselves"—the seven-day rite of
             Leviticus 14 ended in this corner. Sunk into a solid floor a basin
             is invisible, so it sits in a raised coping like those under the
             southern steps. */
          waterBasin(B,{x:cx,z:cz,w:3.6,d:3.6,rim:fy+0.54,depth:2.2,
                        lining:'plaster',curb:0.58,curbH:0.54,
                        freeboard:0.36,uv:0.5});
          B.stairs('ashlarFine','base',{x:cx,z:cz+3.4,y:fy,n:3,rise:0.18,
                                        tread:0.55,w:2.2,dir:'N',uv:0.6});
        } else if(use==='oil'){
          /* Rabbi Eliezer ben Jacob said he had forgotten what this one was
             for; Abba Shaul said they kept wine and oil in it, and it was
             called the Chamber of the House of Oils. Jars, on Abba Shaul. */
          for(let r=0;r<3;r++) for(let q=0;q<6;q++){
            const jx=cx-4.4+q*1.75, jz=cz-2.6+r*2.4;
            B.cyl('roofTile','base',{x:jx,z:jz,y:fy,r0:0.30,r1:0.34,h:0.62,
                                     seg:10,uvU:1,uvV:1,ao:0.92});
            B.cyl('roofTile','base',{x:jx,z:jz,y:fy+0.62,r0:0.34,r1:0.17,h:0.46,
                                     seg:10,capTop:true,uvU:1,uvV:1,ao:1});
          }
        }
      }

      /* the gallery built round the court for the women to look down from
         at the Feast of Tabernacles (Sukkah 5:2, Middot 2:5) */
      const gy = LEV.women+cu(14);
      for(const [f,t] of [[[x0+cu(41),z0+cu(1)],[x1-cu(41),z0+cu(1)]],
                          [[x0+cu(41),z1-cu(1)],[x1-cu(41),z1-cu(1)]]]){
        /* broken at the gate, like the columns: a balustrade run straight
           across left a stone block lying over the doorway */
        wallOpen(B,'ashlarFine','base',{from:f,to:t,y0:gy,y1:gy+0.9,thick:cu(4),
          uv:0.3,ao:1,top:true,
          openings:[{at:CW_GATE_X-f[0], w:cu(10)+1.8, h:0.9}]});
        const L=Math.hypot(t[0]-f[0],t[1]-f[1]), n=Math.round(L/3.4);
        for(let i=0;i<=n;i++){
          const q=i/n;
          const px=lerp(f[0],t[0],q);
          /* The gallery runs the length of the court, and the court's north
             and south gates are in the middle of that length, so a column
             landed square in each doorway. A colonnade steps round an
             opening; it does not stand in it. */
          if(Math.abs(px-CW_GATE_X) < cu(5)+0.9) continue;
          B.column({mat:'marble',x:px,z:lerp(f[1],t[1],q),
            y:LEV.women,d:0.72,h:cu(14),order:'ionic',seg:10,uvU:0.5});
        }
      }

      /* thirteen chests shaped like trumpets—the widow's two mites */
      for(let i=0;i<13;i++){
        const t=(i+0.5)/13;
        const cxx=lerp(x0+cu(44), x1-cu(44), t);
        const czz = z1 - cu(30);
        B.cyl('bronze','base',{x:cxx,z:czz,y:LEV.women,r0:0.30,r1:0.13,h:1.15,
          seg:12,capTop:true,uvU:1,uvV:1,ao:1});
        B.cyl('bronze','base',{x:cxx,z:czz,y:LEV.women+1.15,r0:0.13,r1:0.20,h:0.22,
          seg:12,capTop:true,uvU:1,uvV:1,ao:1});
      }
    });
  });
}

/* =====================================================================
 *  the Nicanor Gate and the fifteen semicircular steps
 * ===================================================================== */
function buildNicanor(B){
  inPrecinct(B,()=>{
    const gx=cu(AZ.x1);
    B.part('nicanor',{name:INFO.nicanor.n, key:'nicanor',
                      atLocal:[gx+2, LEV.israel+cu(24), AXIS]},()=>{
      /* The dividing wall between the two courts, with the gate in it. It is
         run three cubits past the courts at both ends on purpose: the Azarah
         wall is forty cubits high and the Court of the Women's only thirty,
         and wallOpen leaves its segment ends uncapped, so stopping this wall
         flush with the courts left an open notch at the junction—visible
         from the southeast as a hole above the Court of the Women's wall. */
      /* PAST THE FACE, NOT FLUSH WITH IT. Run exactly three cubits—half the
         courts' wall thickness—this wall's end faces landed in the same plane
         as the north and south walls' outer faces, two coplanar surfaces the
         width of a six-cubit wall, and the junction of the Court of the Women
         with the Azarah flickered from outside. Half a meter proud reads as the
         buttress such a step in height wants anyway. */
      wallOpen(B,'ashlarFine','base',{
        from:[gx,CT.z0-cu(3)-0.5], to:[gx,CT.z1+cu(3)+0.5], y0:ESP, y1:ESP+cu(40),
        thick:cu(6), uv:1/9.6, ao:1, grad:0.16,
        openings:[{at:AXIS-(CT.z0-cu(3)-0.5), w:cu(10), h:cu(40), sill:LEV.israel-ESP}]
      });
      /* the gatehouse: Josephus makes this gate fifty cubits high with
         doors of forty, and of Corinthian bronze */
      B.box('ashlarFine','base',{x:gx,z:AXIS,y:ESP+cu(38),sx:cu(14),sy:cu(12),
        sz:cu(26),uv:0.2,ao:1,grad:0.1});
      B.box('ashlarFine','roofs',{x:gx,z:AXIS,y:ESP+cu(50),sx:cu(16),sy:1.3,sz:cu(28),
        uv:0.26,ao:1,aoBot:0.6});
      /* The doors themselves, of Corinthian brass, standing open. Josephus
         makes them forty cubits—at that size a bare leaf reads as a sheet of
         polished metal, so each is panelled with rails and stiles, which is
         also how large ancient doors were actually built up. */
      for(const sd of [-1,1]){
        const dz = AXIS + sd*cu(2.6), dw = cu(4.6), dh = cu(40)*0.92;
        B.box('bronze','base',{x:gx+cu(3.2), z:dz, y:LEV.israel,
          sx:0.5, sy:dh, sz:dw, uv:0.9, ao:1});
        /* five raised rails across each leaf, and a stile up each edge */
        for(let k=1;k<=5;k++)
          B.box('bronze','base',{x:gx+cu(3.2)+0.30, z:dz, y:LEV.israel+dh*k/6-0.22,
            sx:0.14, sy:0.44, sz:dw-0.5, uv:1.6, ao:1});
        for(const e of [-1,1])
          B.box('bronze','base',{x:gx+cu(3.2)+0.30, z:dz+e*(dw/2-0.24),
            y:LEV.israel+0.2, sx:0.14, sy:dh-0.4, sz:0.48, uv:1.6, ao:1});
      }

      /* The fifteen steps, "like the half of a round threshing floor"—and
         with the same three centimetres of nosing the Azarah's own flights
         take. At a flat half-cubit rise the fifteenth finished exactly level
         with the Court of Israel's floor, and the innermost ring reaches a
         cubit inside that floor's western edge, so the two fought in a band
         across the whole width of the gate. */
      B.ringStairs('marbleFloor','base',{x:gx+cu(1), z:AXIS, y:LEV.women,
        n:15, rise:(LEV.israel-LEV.women+0.03)/15, tread:cu(1), rInner:cu(4),
        seg:26, uv:0.55});
    });
  });
}

/* =====================================================================
 *  the Azarah—Court of Israel, Court of the Priests, the altar,
 *  the slaughtering floor, the laver, and the chambers
 * ===================================================================== */
function buildAzarah(B){
  inPrecinct(B,()=>{
    const x0=cu(AZ.x0), x1=cu(AZ.x1), z0=cu(AZ.z0), z1=cu(AZ.z1);

    /* the Court of Israel: a strip eleven cubits broad inside the gate */
    B.part('israel',{name:INFO.israel.n, key:'israel',
                     atLocal:[cu(EW.israelW+5), LEV.israel+2, AXIS]},()=>{
      B.poly('marbleFloor','base',[[cu(EW.israelW),z0],[x1,z0],[x1,z1],[cu(EW.israelW),z1]],
             LEV.israel, 1/6.3, 1);
      /* the duchan: three steps up to the priests' court, where the
         Levites stood to sing */
      B.stairs('marbleFloor','base',{x:cu(EW.israelW)+cu(3), z:(z0+z1)/2,
        y:LEV.israel, n:3, rise:cu(2.5)/3, tread:cu(1), w:z1-z0, dir:'W', uv:0.6});
    });

    /* the Court of the Priests. It reaches east as far as cubit 238, where
       the Court of Israel begins—not merely to the west edge of the
       priests' own eleven-cubit strip. */
    /* THE FLOOR, WITH A WELL AT EACH GATE. Laid as one sheet it ran over the
       six flights that climb from the gateways, so from inside the court the
       stairs were under the pavement and invisible, and from the doorway they
       climbed and disappeared into it. A stair from a lower level needs a hole
       in the floor it arrives through.

       The wells are the gate's width and the flight's run, along the north and
       south edges; the floor is built as the middle of the court plus the
       strips between them. */
    /* THE WELL IS THE FLIGHT'S OWN REACH. At a flat cu(14) it outran the top
       tread by a cubit once the flight was shortened, and that cubit was an
       open hole in the pavement at the head of every one of these stairs. */
    const well = AZ_WELL, wHalf = AZ_WELL_HALF;
    B.poly('marbleFloor','base',
      [[x0,z0+well],[cu(EW.priestE),z0+well],[cu(EW.priestE),z1-well],[x0,z1-well]],
      LEV.priests, 1/6.3, 1);
    for(const [za,zb] of [[z0,z0+well],[z1-well,z1]]){
      let cur = x0;
      for(const gx of AZ_GATE_X.filter(g=>g>x0 && g<cu(EW.priestE)).sort((a,b)=>a-b)){
        if(gx-wHalf > cur)
          B.poly('marbleFloor','base',[[cur,za],[gx-wHalf,za],[gx-wHalf,zb],[cur,zb]],
                 LEV.priests, 1/6.3, 1);
        cur = gx+wHalf;
      }
      if(cur < cu(EW.priestE))
        B.poly('marbleFloor','base',
          [[cur,za],[cu(EW.priestE),za],[cu(EW.priestE),zb],[cur,zb]],
          LEV.priests, 1/6.3, 1);
    }
    /* and a curb round each well, so its edge is not a raw seam in the paving */
    for(const gx of AZ_GATE_X.filter(g=>g>x0 && g<cu(EW.priestE)))
      for(const [za,zb] of [[z0,z0+well],[z1-well,z1]])
        for(const sd of [-1,1])
          B.box('ashlarFine','base',{x:gx+sd*(wHalf+0.2), z:(za+zb)/2, y:LEV.priests-0.45,
            sx:0.4, sy:0.5, sz:zb-za, uv:0.5, ao:1, skip:'B'});

    /* ---- the six chambers, three north and three south ------------ */
    const chambers=[
      [ 'north', cu(78),  'Chamber of Salt' ],
      [ 'north', cu(100), 'Chamber of Parvah' ],
      [ 'north', cu(122), "Rinsers' Chamber" ],
      [ 'south', cu(78),  'Wood Chamber' ],
      [ 'south', cu(100), 'Chamber of the Exile' ],
      [ 'south', cu(122), 'Chamber of Hewn Stone' ],
    ];
    for(const [side,cx,nm] of chambers){
      const w=cu(18), d=cu(14);
      const cz = side==='north' ? z0+d/2+cu(3) : z1-d/2-cu(3);
      B.box('ashlarFine','base',{x:cx,z:cz,y:LEV.priests,sx:w,sy:cu(16),sz:d,
        uv:0.22,ao:1,grad:0.12,skip:'B'});
      B.slabRoof('paving','roofs',{x:cx,z:cz,y:LEV.priests+cu(16),sx:w,sz:d,
        t:0.4,cornice:0.4,parapet:0.7,uv:0.24});
    }
    /* The Chamber of the Hearth, where the priests on duty slept. Middot 1:5
       names the third northern gate the Gate of the Chamber of the Hearth, so
       it belongs directly behind that gate—but BEHIND it. Set out from the
       courts' center line it reached three cubits into the wall and filled the
       upper half of that one gateway with blind masonry, which is why one door
       of the three had stonework over it that the others did not. Its face now
       stands on the wall's inner surface. */
    const hearthZ = z0 + CT_FACE + cu(10);
    B.box('ashlarFine','base',{x:cu(150),z:hearthZ,y:LEV.priests,sx:cu(24),
      sy:cu(18),sz:cu(20),uv:0.22,ao:1,grad:0.12,skip:'B'});
    B.slabRoof('paving','roofs',{x:cu(150),z:hearthZ,y:LEV.priests+cu(18),
      sx:cu(24),sz:cu(20),t:0.45,cornice:0.45,parapet:0.8,uv:0.24});

    /* ---- THE ALTAR—Middot 3:1 ----------------------------------- */
    B.part('altar',{name:INFO.altar.n, key:'altar',
                    atLocal:[cu((ALTAR.x0+ALTAR.x1)/2), LEV.priests+cu(12), AXIS]},()=>{
      const cx=cu((ALTAR.x0+ALTAR.x1)/2), cz=AXIS;
      let y=LEV.priests;
      for(const t of ALTAR.tiers){
        B.box('ashlarFine','base',{x:cx,z:cz,y,sx:cu(t.side),sy:cu(t.rise),
          sz:cu(t.side),uv:0.34,ao:1,grad:0.10,skip:'TB'});
        /* the molded set-back at each stage */
        B.box('ashlarFine','base',{x:cx,z:cz,y:y+cu(t.rise)-0.12,sx:cu(t.side)+0.2,
          sy:0.14,sz:cu(t.side)+0.2,uv:0.5,ao:1});
        y+=cu(t.rise);
      }
      /* the hearth, and a horn at each corner */
      B.poly('ashlarFine','base',[[cx-cu(12),cz-cu(12)],[cx+cu(12),cz-cu(12)],
                                  [cx+cu(12),cz+cu(12)],[cx-cu(12),cz+cu(12)]],
             y, 1/2.4, 0.82);
      for(const sx of [-1,1]) for(const sz of [-1,1])
        B.box('ashlarFine','base',{x:cx+sx*cu(12.5),z:cz+sz*cu(12.5),y:y-cu(1),
          sx:cu(1),sy:cu(2),sz:cu(1),uv:1,ao:1,skip:'B'});
      /* the wood pile, and the fire that never went out */
      B.box('cedar','base',{x:cx,z:cz,y:y+0.05,sx:cu(14),sy:0.9,sz:cu(14),
        uv:0.6,ao:0.9,skip:'B'});
      /* a bed of embers, not a lid: at 13 cubits square this read as a flat
         glowing pad covering the whole hearth */
      B.box('fire','base',{x:cx,z:cz,y:y+0.84,sx:cu(9),sy:0.2,sz:cu(9),
        uv:0.5,ao:1,skip:'B'});
      /* the cones that used to stand here are gone: the flames are billboards
         now (see PUFFS). What stays is the bed of embers they rise from. */

      /* The ramp, thirty-two cubits by sixteen, on the south, because Exodus
         forbids going up to an altar by steps. Its head has to land on the
         ledge at the top of the 28-cubit course—center + 14 cubits, not
         center + 16, which is where the base is. Taking it to 16 left a
         two-cubit gap in mid-air between the ramp and the altar. */
      const rz0=cz+cu(14), rz1=rz0+cu(ALTAR.ramp.len);
      const rTop=LEV.priests+cu(9);
      const rw=cu(ALTAR.ramp.wide), rL=cu(ALTAR.ramp.len);
      /* The sloping surface itself: wound so its normal faces up and south.
         Emitted the other way round it was back-facing and invisible, which is
         why the priests climbing it appeared to be walking on nothing. */
      B.quad('ashlarFine','base',
        [cx-rw/2,rTop,rz0],[cx-rw/2,LEV.priests,rz1],[cx+rw/2,LEV.priests,rz1],[cx+rw/2,rTop,rz0],
        [0,0, 0,rL*0.3, rw*0.3,rL*0.3, rw*0.3,0], 1);
      /* and the two flanks—the winding has to follow the side it is on */
      for(const sg of [-1,1]){
        const A=[cx+sg*rw/2,LEV.priests,rz1], Bv=[cx+sg*rw/2,rTop,rz0],
              C=[cx+sg*rw/2,LEV.priests,rz0];
        const uv=[0,0, rL*0.3,cu(9)*0.3, rL*0.3,0];
        if(sg>0) B.tri('ashlarFine','base', A,C,Bv, uv, 0.9, [1,0,0]);
        else     B.tri('ashlarFine','base', A,Bv,C, uv, 0.9, [-1,0,0]);
      }
      B.box('ashlarFine','base',{x:cx,z:(rz0+rz1)/2,y:LEV.priests-0.4,sx:rw,sy:0.5,
        sz:cu(ALTAR.ramp.len),uv:0.4,ao:0.7});
    });

    /* ---- the slaughtering floor, north of the altar—Middot 5:2 --- */
    B.part('shambles',{name:'The slaughtering floor', key:'altar',
                       atLocal:[cu(211), LEV.priests+2, AXIS-cu(26)]},()=>{
      const cx=cu(211);
      let z = AXIS - cu(16) - cu(SHAMBLES.toRings);
      /* twenty-four rings set in the pavement */
      for(let i=0;i<6;i++) for(let j=0;j<4;j++){
        B.cyl('bronze','base',{x:cx-cu(9)+i*cu(3.6), z:z-j*cu(3.0),
          y:LEV.priests+0.02, r0:0.22, r1:0.22, h:0.10, seg:10,
          capTop:true, uvU:1.5, uvV:1.5, ao:0.8});
      }
      /* MEASURED FROM THE ROWS OF RINGS, NOT FROM THEIR NUMBER. Four rows three
         cubits apart is nine cubits; stepping back cu(24) instead put the tables
         and the flaying rail nineteen cubits north of where the rings end, and
         the rail landed at cubit 106.5—inside the flight that climbs out of
         the middle northern gate, which runs ten cubits into the court and ends
         at 108. Its posts stood on the treads, and the tables' northern edge
         came within a hand's breadth of the top step. The group sits four cubits
         further south now—the rail at 110.5 and the tables at 114.5, which
         still fills the court's northern half. Four and not the two that clear
         the treads: a priest coming up out of that gate has to walk out of it,
         and at two he stepped off the top tread into the rail. */
      z -= cu(3.0)*3 + cu(SHAMBLES.ringsToTables);
      /* eight marble tables for rinsing and laying out the pieces */
      for(let i=0;i<8;i++){
        const tx=cx-cu(13)+i*cu(3.6);
        B.box('marbleFloor','base',{x:tx,z,y:LEV.priests+0.78,sx:cu(2.6),sy:0.16,
          sz:cu(4.4),uv:0.6,ao:1});
        for(const s of [-1,1]) for(const q of [-1,1])
          B.box('marbleFloor','base',{x:tx+s*cu(1),z:z+q*cu(1.8),y:LEV.priests,
            sx:0.14,sy:0.78,sz:0.14,uv:2,ao:0.8});
      }
      z -= cu(SHAMBLES.toPillars);
      /* low pillars with cedar beams and iron hooks, for flaying */
      for(let i=0;i<8;i++){
        const px=cx-cu(13)+i*cu(3.6);
        B.box('ashlarFine','base',{x:px,z,y:LEV.priests,sx:cu(1.2),sy:cu(3),
          sz:cu(1.2),uv:0.6,ao:1,skip:'B'});
      }
      B.box('cedar','base',{x:cx,z,y:LEV.priests+cu(3),sx:cu(28),sy:0.3,sz:0.3,
        uv:0.8,ao:1});
    });

    /* ---- the laver, between the porch and the altar, "a little to
       the south" (Middot 3:6). The twenty-two cubits of that gap are not all
       free: the twelve steps up to the porch take the western twelve of them,
       so the laver goes in the eastern ten, clear of the steps. ---------- */
    const lavX = cu(191.5);
    B.cyl('bronze','base',{x:lavX, z:AXIS+cu(7), y:LEV.priests,
      r0:cu(2.2), r1:cu(2.6), h:cu(3), seg:18, capTop:true, uvU:0.5, uvV:0.5, ao:1});
    B.cyl('bronze','base',{x:lavX, z:AXIS+cu(7), y:LEV.priests+cu(3),
      r0:cu(2.7), r1:cu(2.7), h:0.18, seg:18, capTop:true, uvU:0.5, uvV:0.5, ao:1});
  });
}

/* =====================================================================
 *  THE SANCTUARY
 * ===================================================================== */
function buildSanctuary(B){
  inPrecinct(B,()=>{
    const yF = LEV.house;                    // the floor, +6 cubits on the foundation
    const yT = LEV.priests + cu(HOUSE_H);    // the top, a hundred cubits up
    const bodyZ0 = AXIS - cu(HOUSE_BODY_W/2),  bodyZ1 = AXIS + cu(HOUSE_BODY_W/2);
    const frontZ0 = AXIS - cu(HOUSE_FRONT_W/2), frontZ1 = AXIS + cu(HOUSE_FRONT_W/2);
    const H = HOUSE;
    const hekZ0 = AXIS - cu(10), hekZ1 = AXIS + cu(10);   // the 20-cubit interior

    /* ---- the six-cubit foundation: it follows the plan of the building
       above it, so it is a hundred cubits across under the porch and only
       seventy under the body ---- */
    /* The front block keeps its TOP. The building stands on most of it, but
       three cubits of it are left exposed between the head of the twelve steps
       and the face of the porch, and skipped they were a hole straight down
       into the foundation at the one place everyone arriving looks. */
    B.box('ashlarFine','base',{x:cu(166), z:AXIS,
      y:LEV.priests, sx:cu(20), sy:cu(6), sz:cu(HOUSE_FRONT_W)+cu(2),
      uv:0.2, ao:1, grad:0.12});
    B.box('ashlarFine','base',{x:(cu(H.outerW.w)+cu(H.porch.w))/2, z:AXIS,
      y:LEV.priests, sx:cu(84)+cu(2), sy:cu(6), sz:cu(HOUSE_BODY_W)+cu(2),
      uv:0.2, ao:1, grad:0.12, skip:'T'});

    B.stairs('marbleFloor','base',{x:cu(176)+12*cu(1), z:AXIS,
      y:LEV.priests, n:12, rise:cu(0.5), tread:cu(1), w:cu(60), dir:'W', uv:0.55});

    /* =============== the porch block, gilded =================== */
    B.part('porch',{name:INFO.porch.n, key:'porch',
                    atLocal:[cu(H.porchWall.e), yF+cu(44), AXIS]},()=>{
      /* the east wall, five cubits thick, with the great opening */
      const pe=cu(H.porchWall.e), pw=cu(H.porchWall.w);
      const opZ0=AXIS-cu(10), opZ1=AXIS+cu(10);        // 20 cubits broad
      const opTop=yF+cu(40);                            // 40 cubits high
      for(const [z0,z1] of [[frontZ0,opZ0],[opZ1,frontZ1]])
        B.box('gold','sanct',{x:(pe+pw)/2, z:(z0+z1)/2, y:yF, sx:pe-pw,
          sy:yT-yF, sz:z1-z0, uv:0.5, ao:1, grad:0.12});
      B.box('gold','sanct',{x:(pe+pw)/2, z:AXIS, y:opTop, sx:pe-pw,
        sy:yT-opTop, sz:opZ1-opZ0, uv:0.5, ao:1, grad:0.08});

      /* the porch's own side walls. They must run right back to the body,
         so that the fifteen-cubit shoulders are solid and the porch
         interior is exactly as wide as the house behind it. */
      for(const [z0,z1] of [[frontZ0,bodyZ0],[bodyZ1,frontZ1]])
        B.box('gold','sanct',{x:(cu(H.porch.w)+pw)/2, z:(z0+z1)/2, y:yF,
          sx:pw-cu(H.porch.w), sy:yT-yF, sz:z1-z0, uv:0.5, ao:1, grad:0.12});

      /* the porch floor and its ceiling */
      B.poly('marbleFloor','sanct',[[cu(H.porch.w),bodyZ0],[pw,bodyZ0],
        [pw,bodyZ1],[cu(H.porch.w),bodyZ1]], yF+0.05, 1/4, 0.86);
      B.box('cedar','sanct',{x:(pw+cu(H.porch.w))/2, z:AXIS, y:yF+cu(50),
        sx:pw-cu(H.porch.w), sy:0.6, sz:bodyZ1-bodyZ0, uv:0.4, ao:0.8, aoBot:0.66});

      /* five oak beams set one above another over the doorway
         (Middot 3:7), each longer than the one below */
      for(let i=0;i<5;i++)
        B.box('cedar','sanct',{x:pe+0.10, z:AXIS, y:opTop+cu(1.6)+i*cu(2.2),
          sx:0.55, sy:cu(1.1), sz:cu(22)+i*cu(2), uv:0.45, ao:1});

      /* THE GOLDEN VINE, trained on poles over the doorway, with
         clusters "as tall as a man" */
      const vy=opTop-cu(2.2);
      B.cyl('gold','sanct',{x:pe+0.55, z:AXIS, y:vy, r0:0.13, r1:0.13, h:0.1,
        seg:8, uvU:1, uvV:1, ao:1});
      B.pushT(pe+0.55, vy, AXIS); B.pushRotZ(Math.PI/2);
      B.cyl('gold','sanct',{x:0,z:0,y:-cu(9),r0:0.11,r1:0.11,h:cu(18),seg:8,
        uvU:1,uvV:1,ao:1});
      B.pop(); B.pop();
      const rnd=mulberry32(917);
      for(let i=0;i<11;i++){
        const cz=AXIS-cu(8.4)+i*cu(1.68);
        const cl=1.1+rnd()*0.7;
        /* the cluster: a hanging bunch, tapering */
        for(let k=0;k<5;k++){
          const r=0.30*(1-k/6);
          B.cyl('gold','sanct',{x:pe+0.55,z:cz,y:vy-0.15-k*(cl/5),r0:r,r1:r*0.8,
            h:cl/5,seg:7,uvU:1.6,uvV:1.6,ao:1});
        }
        /* a leaf or two */
        B.box('gold','sanct',{x:pe+0.5,z:cz+cu(0.7),y:vy-0.1,sx:0.1,sy:0.42,sz:0.42,
          uv:2,ao:1});
      }

      /* No curtain across the porch opening, and no doors either: Josephus is
         explicit that "this gate had no doors, for it represented the
         universal visibility of heaven" (War 5.208). The Babylonian veil hung
         further in—see the Hekhal doorway below. */

      /* THE FOUR COLUMNS OF THE FACADE. Josephus says there were pillars on
         either side of the gate but does not say how many; the Bar Kokhba
         tetradrachms and several synagogue reliefs show a tetrastyle front—
         four columns, two to each side of the doorway—and Josephus has the
         golden vine trained round them. They are attached to the wall rather
         than free-standing, which is how they rise beside a doorway forty
         cubits high without needing a portico roof of their own. */
      /* Full height, to the cornice: that is how the coins show them, running
         the whole front rather than stopping at the door head, and it is the
         only way four columns can articulate a wall this tall.
         They stay GILDED—Josephus says the front was "covered all over with
         plates of gold", so a stone-colored order here would contradict him.
         Legibility comes instead from relief and from deep flutes: projecting
         two-thirds of their diameter, they cast their own shadow down the
         facade and the flutes carry vertical shadow lines all the way up. */
      const colD = cu(3.4), colH = (yT - yF) - cu(6);
      /* Clear of the five oak beams. The beams run out to fifteen cubits each
         side of the axis—Middot 3:7 has each one projecting a cubit further
         than the one below—and the inner pair of columns stood at eleven and
         a half, so the beams ran straight through them. Set outside the widest
         beam the four spread across the front the way the Bar Kokhba coins
         show them, rather than crowding the doorway. */
      for(const zc of [AXIS-cu(32), AXIS-cu(18), AXIS+cu(18), AXIS+cu(32)])
        B.column({mat:'gold', layer:'sanct', x:cu(174.6), z:zc, y:yF, d:colD,
                  h:colH, order:'corinthian', seg:20, flutes:24, uvU:0.3});
      /* the entablature and cornice they carry, returned against the wall */
      B.box('gold','sanct',{x:cu(174.4), z:AXIS, y:yF+colH, sx:colD*1.85,
        sy:cu(3.4), sz:cu(70), uv:0.4, ao:1, aoBot:0.7});
      B.box('gold','sanct',{x:cu(174.8), z:AXIS, y:yF+colH+cu(3.4), sx:colD*2.3,
        sy:cu(2.0), sz:cu(72), uv:0.45, ao:1, aoBot:0.8});
    });

    /* =============== the body of the house ===================== */
    B.part('sanctuary',{name:INFO.sanctuary.n, key:'sanctuary',
                        atLocal:[cu(H.hekhal.w+20), yT, AXIS]},()=>{
      const bw=cu(H.hekhalE.e);              // east face of the body, x = 157c

      /* north and south walls, twenty-five cubits thick, containing the
         three stories of cells */
      for(const [z0,z1] of [[bodyZ0, hekZ0],[hekZ1, bodyZ1]])
        B.box('ashlarWhite','sanct',{x:(cu(H.outerW.w)+bw)/2, z:(z0+z1)/2, y:yF,
          sx:bw-cu(H.outerW.w), sy:yT-yF, sz:z1-z0, uv:1/9.6, ao:1, grad:0.14});
      /* the west end: wall, cells, wall—seventeen cubits */
      B.box('ashlarWhite','sanct',{x:(cu(H.outerW.w)+cu(H.debir.w))/2, z:AXIS, y:yF,
        sx:cu(H.debir.w)-cu(H.outerW.w), sy:yT-yF, sz:hekZ1-hekZ0,
        uv:1/9.6, ao:1, grad:0.14});
      /* the east wall of the Hekhal, with its doorway of twenty by ten */
      const de=cu(H.hekhalE.e), dw=cu(H.hekhalE.w);
      for(const [z0,z1] of [[hekZ0, AXIS-cu(5)],[AXIS+cu(5), hekZ1]])
        B.box('ashlarWhite','sanct',{x:(de+dw)/2, z:(z0+z1)/2, y:yF, sx:de-dw,
          sy:yT-yF, sz:z1-z0, uv:1/9.6, ao:1, grad:0.14});
      B.box('ashlarWhite','sanct',{x:(de+dw)/2, z:AXIS, y:yF+cu(20), sx:de-dw,
        sy:yT-yF-cu(20), sz:cu(10), uv:1/9.6, ao:1, grad:0.1});
      /* its four doors, two outer and two inner, plated with gold */
      for(const s of [-1,1]){
        B.box('gold','sanct',{x:de-0.3, z:AXIS+s*cu(2.4), y:yF, sx:0.4,
          sy:cu(19.4), sz:cu(4.6), uv:0.6, ao:1});
        B.box('gold','sanct',{x:dw+0.3, z:AXIS+s*cu(2.4), y:yF, sx:0.4,
          sy:cu(19.4), sz:cu(4.6), uv:0.6, ao:1});
      }
      /* THE BABYLONIAN VEIL, and this is where it belongs. Josephus: the
         inner house "had golden doors... but BEFORE THESE DOORS there was a
         veil of equal largeness with the doors. It was a Babylonian curtain,
         embroidered with blue, and fine linen, and scarlet, and purple"
         (War 5.211–212)—so it hangs in the porch, in front of the Hekhal's
         doors, and is seen from outside through the open porch archway. It is
         sized to the doorway, as Josephus says: 20 x 10 cubits by Middot 4:1,
         which Josephus gives instead as 55 x 16. */
      B.box('veil','sanct',{x:de+0.28, z:AXIS, y:yF, sx:0.13,
        sy:cu(20.6), sz:cu(10.6), uv:0.14, ao:1, grad:0.22});

      /* a string course marking the head of the cells at forty cubits,
         and the cornice at the top */
      for(const yy of [yF+cu(40)])
        for(const [z0,z1] of [[bodyZ0,bodyZ0],[bodyZ1,bodyZ1]])
          B.box('ashlarWhite','sanct',{x:(cu(H.outerW.w)+bw)/2, z:z0, y:yy,
            sx:bw-cu(H.outerW.w)+0.5, sy:0.6, sz:0.5, uv:0.4, ao:1});

      /* the mesibbah—the winding stair that rose from the northeast
         corner to the roof and the upper chamber (Middot 4:5) */
      B.box('ashlarWhite','sanct',{x:cu(146), z:bodyZ0-cu(2.4), y:yF, sx:cu(16),
        sy:cu(62), sz:cu(5), uv:0.24, ao:1, grad:0.14});

      /* ---- the roofs, and the golden spikes against the birds ---- */
      const par=cu(HEIGHT.parapet);
      B.slabRoof('paving','sanct',{x:(cu(H.outerW.w)+bw)/2, z:AXIS, y:yT-par-0.6,
        sx:bw-cu(H.outerW.w), sz:bodyZ1-bodyZ0, t:0.6, cornice:0.7,
        parapet:par, uv:0.24});
      B.slabRoof('paving','sanct',{x:(cu(H.porch.w)+cu(H.porchWall.e))/2, z:AXIS,
        y:yT-par-0.6, sx:cu(H.porchWall.e)-cu(H.porch.w),
        sz:frontZ1-frontZ0, t:0.6, cornice:0.8, parapet:par+cu(1), uv:0.24});
      /* the kelay orev: iron-and-gold spikes a cubit high along the eaves */
      for(let i=0;i<34;i++){
        const z=lerp(frontZ0+0.6, frontZ1-0.6, i/33);
        B.cyl('gold','sanct',{x:cu(H.porchWall.e)+0.55, z, y:yT+cu(1), r0:0.09,
          r1:0.01, h:cu(1), seg:6, uvU:2, uvV:2, ao:1});
      }
      for(let i=0;i<26;i++){
        const x=lerp(cu(H.outerW.w)+0.5, bw, i/25);
        for(const z of [bodyZ0-0.4, bodyZ1+0.4])
          B.cyl('gold','sanct',{x, z, y:yT+cu(1), r0:0.09, r1:0.01, h:cu(1),
            seg:6, uvU:2, uvV:2, ao:1});
      }
    });

    /* =============== what is inside ============================
       LAYERS: the fabric of the building—walls, floors, ceilings,
       paneling, the veils—goes in 'sanct', which the section plane cuts.
       The furniture goes in 'interior', which appears only when the section
       is on and is never cut, so that the menorah is not sliced off with
       the wall it stands against. */
    B.part('hekhal',{name:INFO.hekhal.n, key:'hekhal',
                     atLocal:[cu(131), yF+cu(20), AXIS]},()=>{
      /* the floor of the Holy Place and the Holy of Holies */
      B.poly('cedar','sanct',[[cu(H.debir.w),hekZ0],[cu(H.hekhal.e),hekZ0],
        [cu(H.hekhal.e),hekZ1],[cu(H.debir.w),hekZ1]], yF+0.04, 1/4, 1.0);
      /* the ceiling of the Holy Place, forty cubits up */
      B.box('gold','sanct',{x:(cu(H.debir.w)+cu(H.hekhal.e))/2, z:AXIS,
        y:yF+cu(40), sx:cu(H.hekhal.e)-cu(H.debir.w), sy:0.7, sz:hekZ1-hekZ0,
        uv:0.35, ao:0.8, aoBot:0.6});
      /* the walls: boarded with cedar and then overlaid with gold—
         "he overlaid the house within with pure gold" (1 Kings 6:21) */
      for(const z of [hekZ0+0.14, hekZ1-0.14])
        B.box('gold','sanct',{x:(cu(H.debir.w)+cu(H.hekhalE.w))/2, z, y:yF,
          sx:cu(H.hekhalE.w)-cu(H.debir.w), sy:cu(40), sz:0.28, uv:0.3,
          ao:1, grad:0.18});

      /* the three stories of cells, fifteen north, fifteen south, eight
         west, widening as they rise: five cubits, six, then seven */
      for(let tier=0;tier<3;tier++){
        const yy=yF+cu(1+tier*13);
        for(const side of [-1,1]){
          for(let i=0;i<15;i++){
            const x=lerp(cu(H.debir.w)+cu(2), cu(H.hekhalE.w)-cu(2), i/14);
            B.box('ashlarFine','sanct',{x, z:AXIS+side*cu(13+tier*0.5),
              y:yy, sx:cu(3.4), sy:0.3, sz:cu(5+tier), uv:0.4, ao:0.6});
          }
        }
      }

      /* the menorah on the south, the table on the north, the golden
         altar of incense between them before the veil */
      const fx=cu(122);
      /* --- the seven-branched lampstand --- */
      B.pushT(fx, yF+0.06, AXIS+cu(4.4));
      B.cyl('gold','interior',{x:0,z:0,y:0,r0:0.30,r1:0.20,h:0.22,seg:14,
        capTop:true,uvU:1,uvV:1,ao:1});
      B.cyl('gold','interior',{x:0,z:0,y:0.22,r0:0.07,r1:0.055,h:1.35,seg:10,
        uvU:1.4,uvV:1.4,ao:1});
      for(let b=1;b<=3;b++){
        for(const s of [-1,1]){
          const R=b*0.20, top=0.55+ (3-b)*0.02;
          /* the branch, drawn as a quarter arc of short segments */
          for(let k=0;k<7;k++){
            const a0=k/7*Math.PI/2, a1=(k+1)/7*Math.PI/2;
            const p0=[s*R*Math.sin(a0), top+R*(1-Math.cos(a0))];
            const p1=[s*R*Math.sin(a1), top+R*(1-Math.cos(a1))];
            const L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);
            B.pushT(p0[0],p0[1],0);
            B.pushRotZ(Math.atan2(p1[1]-p0[1], p1[0]-p0[0])-Math.PI/2);
            B.cyl('gold','interior',{x:0,z:0,y:0,r0:0.042,r1:0.042,h:L,seg:6,
              uvU:2,uvV:2,ao:1});
            B.pop(); B.pop();
          }
          B.cyl('gold','interior',{x:s*R,z:0,y:top+R,r0:0.042,r1:0.042,h:1.57-top-R,
            seg:6,uvU:2,uvV:2,ao:1});
          B.cyl('gold','interior',{x:s*R,z:0,y:1.57,r0:0.085,r1:0.05,h:0.11,seg:8,
            capTop:true,uvU:2,uvV:2,ao:1});
          B.box('fire','interior',{x:s*R,z:0,y:1.68,sx:0.07,sy:0.14,sz:0.07,uv:3,ao:1});
        }
      }
      B.cyl('gold','interior',{x:0,z:0,y:1.57,r0:0.085,r1:0.05,h:0.11,seg:8,
        capTop:true,uvU:2,uvV:2,ao:1});
      B.box('fire','interior',{x:0,z:0,y:1.68,sx:0.07,sy:0.14,sz:0.07,uv:3,ao:1});
      B.pop();

      /* --- the table of the bread of the Presence --- */
      B.pushT(fx, yF+0.06, AXIS-cu(4.4));
      B.box('gold','interior',{x:0,z:0,y:0.72,sx:cu(2),sy:0.14,sz:cu(1),uv:0.8,ao:1});
      B.box('gold','interior',{x:0,z:0,y:0.86,sx:cu(2)+0.06,sy:0.07,sz:cu(1)+0.06,
        uv:1.2,ao:1});
      for(const s of [-1,1]) for(const q of [-1,1])
        B.cyl('gold','interior',{x:s*(cu(1)-0.07),z:q*(cu(0.5)-0.07),y:0,r0:0.05,
          r1:0.04,h:0.72,seg:8,uvU:2,uvV:2,ao:1});
      /* twelve loaves, in two piles of six */
      for(const s of [-1,1]) for(let k=0;k<6;k++)
        B.box('plaster','interior',{x:s*cu(0.5),z:0,y:0.93+k*0.055,sx:cu(0.8),
          sy:0.055,sz:cu(0.7),uv:1.5,ao:1});
      B.pop();

      /* --- the golden altar of incense, before the veil --- */
      B.pushT(cu(115), yF+0.06, AXIS);
      B.box('gold','interior',{x:0,z:0,y:0,sx:cu(1),sy:cu(2),sz:cu(1),uv:1,ao:1});
      B.box('gold','interior',{x:0,z:0,y:cu(2),sx:cu(1.2),sy:0.09,sz:cu(1.2),
        uv:1.2,ao:1});
      for(const s of [-1,1]) for(const q of [-1,1])
        B.box('gold','interior',{x:s*cu(0.5),z:q*cu(0.5),y:cu(2)+0.09,sx:0.07,
          sy:0.14,sz:0.07,uv:2,ao:1});
      B.box('fire','interior',{x:0,z:0,y:cu(2)+0.1,sx:cu(0.7),sy:0.10,sz:cu(0.7),
        uv:2,ao:1});
      B.pop();
    });

    /* --- the Holy of Holies, and the two veils one cubit apart --- */
    B.part('debir',{name:INFO.debir.n, key:'debir',
                    atLocal:[cu(100), yF+cu(14), AXIS]},()=>{
      B.box('veil','sanct',{x:cu(H.traksin.e)-0.09, z:AXIS, y:yF, sx:0.12,
        sy:cu(40)-0.7, sz:hekZ1-hekZ0, uv:0.1, ao:1, grad:0.3});
      B.box('veil','sanct',{x:cu(H.traksin.w)+0.09, z:AXIS, y:yF, sx:0.12,
        sy:cu(40)-0.7, sz:hekZ1-hekZ0, uv:0.1, ao:1, grad:0.3});
      /* the floor of the innermost room, and nothing standing on it */
      B.poly('cedar','sanct',[[cu(H.debir.w),hekZ0],[cu(H.debir.e),hekZ0],
        [cu(H.debir.e),hekZ1],[cu(H.debir.w),hekZ1]], yF+0.06, 1/3, 0.92);
      /* es-Sakhra: the rock the floor is laid over */
      B.box('rock','sanct',{x:cu(100),z:AXIS,y:yF-0.5,sx:cu(11),sy:0.5,
        sz:cu(11),uv:0.4,ao:0.6});
    });
  });
}

/* =====================================================================
 *  GROUND HEIGHT—one query used by the crowd placement below, by the guide's
 *  standing viewpoints, and by the near plane, which asks how far the eye is
 *  off the ground beneath it. Keep it that way: when buildPeople carried its
 *  own hardcoded heights they fell out of step with the geometry and the
 *  figures floated meters above the southern staircase.
 * ===================================================================== */
const _pl=[0,0];
function toPrecinct(x,z){
  const dx=x-SQ_NW[0], dz=z-SQ_NW[1];
  _pl[0]=dx*U_EAST[0]+dz*U_EAST[1];
  _pl[1]=dx*V_SOUTH[0]+dz*V_SOUTH[1];
  return _pl;
}
function groundHeightAt(x,z){
  const p=toPrecinct(x,z), px=p[0], pz=p[1];
  const inCourts = px>CT.x0 && px<CT.x1 && pz>CT.z0 && pz<CT.z1;
  if(inCourts){
    if(px < cu(AZ.x1)){                       // the Azarah
      /* THE SANCTUARY FLOOR. Six cubits over the Court of the Priests, up the
         twelve steps at the porch; without it you walked to the door and were
         held on the pavement outside, with the whole house a solid block. The
         porch throws fifteen-cubit shoulders each side of the seventy-cubit
         body, so the footprint is wider at the front—Middot 4:7's lion,
         narrow behind and broad in front. */
      const inPorchX = px > cu(HOUSE.porch.w) && px < PORCH_STEP_W;
      const halfW = cu((inPorchX ? HOUSE_FRONT_W : HOUSE_BODY_W)/2);
      if(px > cu(EW.templeW) && px < PORCH_STEP_W && Math.abs(pz-AXIS) < halfW)
        return LEV.house;
      /* the twelve steps up to it */
      if(Math.abs(pz-AXIS) < cu(30) && px >= PORCH_STEP_W && px < PORCH_STEP_E)
        return lerp(LEV.house, LEV.priests,
                    (px-PORCH_STEP_W)/(PORCH_STEP_E-PORCH_STEP_W));

      /* THE ALTAR AND ITS RAMP. The ramp first: its head lands on the sovev at
         fourteen cubits from the center, which is inside the base's sixteen,
         so the two overlap and the ramp is the one on top. */
      const acx = cu((ALTAR.x0+ALTAR.x1)/2);
      const rz0 = AXIS+cu(14), rz1 = rz0+cu(ALTAR.ramp.len);
      if(Math.abs(px-acx) < cu(ALTAR.ramp.wide/2) && pz > rz0 && pz < rz1)
        return lerp(LEV.priests+cu(9), LEV.priests, (pz-rz0)/(rz1-rz0));
      /* and the altar itself, which steps inward as it rises: you stand on it,
         not in it. Figures placed at the court's level stood buried in solid
         stone up to the chest. */
      const half = Math.max(Math.abs(px-acx), Math.abs(pz-AXIS))/CUBIT;
      if(half < 16) return LEV.priests +
        cu(half < 13 ? 10 : half < 14 ? 9 : half < 15 ? 6 : 1);

      return px > cu(EW.israelW) ? LEV.israel : LEV.priests;
    }
    return LEV.women;                          // the Court of the Women
  }
  /* the twelve steps and the chel ramp up to the courts */
  const band = STEP_RUN;
  const ox = Math.max((CT.x0-CT_FACE)-px, px-(CT.x1+CT_FACE), 0);
  const oz = Math.max((CT.z0-CT_FACE)-pz, pz-(CT.z1+CT_FACE), 0);
  const o = Math.max(ox,oz);
  if(o < band + CHEL_W && px>CT.x0-CT_FACE-band-CHEL_W-1 && px<CT.x1+CT_FACE+band+CHEL_W+1
     && pz>CT.z0-CT_FACE-band-CHEL_W-1 && pz<CT.z1+CT_FACE+band+CHEL_W+1){
    if(o < band) return lerp(LEV.women, ESP, o/band);
    return ESP;
  }
  /* the southern staircase, outside the wall */
  const stairRun = SOUTH_STAIR.n*(SOUTH_STAIR.treadA+SOUTH_STAIR.treadB)/2;
  const plazaY = HULDAH_SILL - SOUTH_STAIR.rise*SOUTH_STAIR.n;
  if(z > PLAT.SW[1] && z < PLAT.SW[1]+stairRun+46 &&
     Math.abs(x-SOUTH_STAIR.cx) < SOUTH_STAIR.wTot/2 + 18){
    const t=clamp((z-(PLAT.SW[1]+2.4))/stairRun,0,1);
    return lerp(HULDAH_SILL, plazaY, t);
  }
  /* the fortress and its stairs stand over the esplanade at its northwest
     corner, so they are tested before the platform claims the ground */
  const ant = antoniaFloorAt(x,z);
  if(ant !== null) return ant;
  if(outsidePlatform(x,z) < -1.5) return ESP;
  /* the decks you can walk out on: the causeway to Olivet and Wilson's, both
     of which used to drop you through the roadway onto the valley floor */
  const deck = causewayDeckAt(x,z);
  const g = groundLevel(x,z);
  return (deck !== null && deck > g) ? deck : g;
}

/* =====================================================================
 *  figures, for scale—about 1.70 m, which is the mean stature from
 *  Second Temple period burials in the Jerusalem area
 * ===================================================================== */
function buildPeople(B){
  const rand = mulberry32(31459);
  const put = (x,z,y,mat,face)=> B.person({x,z,y,mat,face:face===undefined?rand()*6.283:face,
                                           h:1.62+rand()*0.16});
  const crowd = (n, fn) => { for(let i=0;i<n;i++) fn(rand); };
  const lay = ['clothA','clothB','clothC','clothD'];
  const pick = r => lay[(r()*lay.length)|0];

  /* on the southern steps and the plaza below */
  crowd(46, r=>{
    const x  = SOUTH_STAIR.cx - 38 + r()*76;
    const zz = PLAT.SW[1] + 4 + r()*46;
    put(x, zz, groundHeightAt(x,zz), pick(r));
  });
  /* on the esplanade */
  crowd(64, r=>{
    let x,z,tries=0;
    do{ x = 20+r()*280; z = 40+r()*430; tries++; }
    while(outsidePlatform(x,z) > -14 && tries<20);
    put(x,z,groundHeightAt(x,z),pick(r));
  });
  /* under the Royal Stoa—its pavement is 6 cm above the esplanade */
  crowd(26, r=>{
    const x=30+r()*230, z=PLAT.SW[1]-6-r()*30;
    put(x,z,groundHeightAt(x,z)+0.06,pick(r));
  });
  /* in Solomon's Porch */
  crowd(18, r=>{
    const t=r(), d=2+r()*13;
    const p=[lerp(PLAT.NE[0],PLAT.SE[0],t), lerp(PLAT.NE[1],PLAT.SE[1],t)];
    const px=p[0]-d*0.997, pz=p[1]-d*0.074;
    put(px, pz, groundHeightAt(px,pz), pick(r));
  });

  inPrecinct(B,()=>{
    /* in the Court of the Women */
    crowd(30, r=>{
      const x=cu(CW.x0)+cu(6)+r()*(cu(CW.x1-CW.x0)-cu(12));
      const z=cu(CW.z0)+cu(6)+r()*(cu(CW.z1-CW.z0)-cu(12));
      B.person({x,z,y:LEV.women,mat:pick(r),face:Math.PI+ (r()-0.5),h:1.60+rand()*0.16});
    });
    /* Israelite men in the Court of Israel, facing the altar */
    crowd(22, r=>{
      const x=cu(EW.israelW)+r()*cu(10.4);
      const z=cu(AZ.z0)+cu(6)+r()*(cu(135)-cu(12));
      B.person({x,z,y:LEV.israel,mat:pick(r),face:Math.PI,h:1.62+rand()*0.14});
    });
    /* Priests in white ABOUT the altar—not in it. The box they were drawn
       from covered the altar's whole footprint, so a third of them stood inside
       thirty-two cubits of solid stone. */
    const acx = cu((ALTAR.x0+ALTAR.x1)/2);
    crowd(16, r=>{
      let x,z,tries=0;
      do{ x=cu(188)+r()*cu(46); z=AXIS-cu(24)+r()*cu(48); tries++; }
      while(tries<24 && Math.max(Math.abs(x-acx), Math.abs(z-AXIS)) < cu(17.5));
      B.person({x,z,y:LEV.priests,mat:'linen',face:r()*6.283,h:1.63+rand()*0.14});
    });
    /* On the ramp, ON it. Their height was interpolated over a span that was
       not the ramp's—it starts two cubits south of where they were being put
       down and runs thirty-two, not thirty—so they climbed a slope steeper
       than the one under them and stood a foot clear of it at the top. Both
       ends now come from the ramp's own line. */
    const rz0=AXIS+cu(14), rz1=rz0+cu(ALTAR.ramp.len), rTop=LEV.priests+cu(9);
    crowd(5, r=>{
      const q  = 0.10 + 0.82*r();
      const zz = lerp(rz0, rz1, q);
      B.person({x:cu(211)+(r()-0.5)*cu(10), z:zz,
                y:lerp(rTop, LEV.priests, q), mat:'linen', face:Math.PI, h:1.64});
    });
    /* two priests at the door of the Sanctuary */
    B.person({x:cu(178), z:AXIS-cu(3), y:LEV.priests, mat:'linen', face:Math.PI, h:1.66});
    B.person({x:cu(178), z:AXIS+cu(3), y:LEV.priests, mat:'linen', face:Math.PI, h:1.64});
  });
}

/* =====================================================================
 *  The fires, as light sources. Positions match the geometry above: the
 *  altar hearth, the menorah, the golden altar of incense. The two indoor
 *  ones are switched on only when the Sanctuary is sectioned—with no
 *  shadowing they would otherwise glow straight through its walls.
 * ===================================================================== */
const FIRE_LIGHTS = (()=>{
  const at = (xc, zc, y) => { const p = precinctToWorld(xc, zc); return [p[0], y, p[1]]; };
  return [
    { name:'altar',   indoor:false, r:20, col:[1.00,0.42,0.13],
      at: at(211, AXIS_Z,     LEV.priests + cu(11)) },
    { name:'menorah', indoor:true,  r:11, col:[1.00,0.58,0.24],
      at: at(122, AXIS_Z+4.4, LEV.house   + 1.75) },
    { name:'incense', indoor:true,  r:7,  col:[1.00,0.56,0.22],
      at: at(115, AXIS_Z,     LEV.house   + 1.20) },
  ];
})();

/* =====================================================================
 *  FIRE AND SMOKE—billboard emitters.
 *
 *  These are NOT part of the main geometry buffer. Each puff is four
 *  vertices sharing one anchor point; the vertex shader expands them into a
 *  camera-facing quad and animates them from a looping life fraction, so
 *  there is no per-frame CPU work and no buffer to update. Flames are drawn
 *  additively, smoke with ordinary alpha, in that order.
 *
 *  A caution kept in the panel text as well: what the sources attest is a
 *  perpetual fire and a smoke column visible across the city. The shape and
 *  motion of flames is not evidence of anything, so this is deliberately
 *  restrained, and it can be switched off.
 * ===================================================================== */
const PUFFS = (()=>{
  const V=[], flame=[], smoke=[];
  const rnd = mulberry32(90210);
  let n=0;
  const quad = (at, size, rise, kind, list) => {
    const base=n*4, seed=rnd();
    for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]])
      V.push(at[0],at[1],at[2], cx,cy, seed,size,rise,kind);
    list.push(base,base+1,base+2, base,base+2,base+3);
    n++;
  };
  const at = (xc,zc,y) => { const p=precinctToWorld(xc,zc); return [p[0],y,p[1]]; };

  /* ---- the altar hearth: 24 cubits square, and its column of smoke ---- */
  const hearth = LEV.priests + cu(10);
  const spread = cu(11);
  for(let i=0;i<46;i++){
    const ox=(rnd()-0.5)*spread, oz=(rnd()-0.5)*spread;
    const p=at(211 + ox/CUBIT, AXIS_Z + oz/CUBIT, hearth + 0.25);
    quad(p, 0.85+rnd()*1.05, 2.2+rnd()*3.0, 0, flame);
  }
  for(let i=0;i<76;i++){
    const ox=(rnd()-0.5)*spread*0.8, oz=(rnd()-0.5)*spread*0.8;
    const p=at(211 + ox/CUBIT, AXIS_Z + oz/CUBIT, hearth + 2.6);
    quad(p, 2.4+rnd()*3.4, 26+rnd()*26, 1, smoke);
  }

  /* ---- the seven lamps of the menorah ---- */
  for(let b=-3;b<=3;b++){
    const R=Math.abs(b)*0.20*Math.sign(b||1);
    const p=at(122, AXIS_Z+4.4, LEV.house+1.80);
    quad([p[0]+U_EAST[0]*R, p[1], p[2]+U_EAST[1]*R], 0.085, 0.14, 0, flame);
  }
  /* ---- the golden altar of incense, and its thread of smoke ---- */
  const inc = at(115, AXIS_Z, LEV.house + cu(2) + 0.14);
  quad(inc, 0.10, 0.12, 0, flame);
  for(let i=0;i<10;i++) quad(inc, 0.16+rnd()*0.16, 2.4+rnd()*1.6, 1, smoke);

  return { vertices:new Float32Array(V),
           indices:new Uint16Array([...flame, ...smoke]),
           flameCount:flame.length, smokeCount:smoke.length };
})();

/* =====================================================================
 *  overlays: the 500-cubit square, and a cubit grid
 * ===================================================================== */
function buildOverlays(B){
  /* the pre-Herodian square, drawn as a low ribbon on the pavement */
  B.part('square',{name:INFO.square.n, key:'square',
                   at:[(SQ_NW[0]+SQ_SE[0])/2, 2, (SQ_NW[1]+SQ_SE[1])/2]},()=>{
    const R=[SQ_NW,SQ_NE,SQ_SE,SQ_SW];
    for(let i=0;i<4;i++)
      B.wall('marker','overlay',{from:R[i],to:R[(i+1)%4],y0:ESP+0.10,y1:ESP+0.55,
        thick:1.5,uv:0.5,caps:false,ao:1});
    /* corner posts, taller, so the square reads from the air */
    for(const p of R)
      B.box('marker','overlay',{x:p[0],z:p[1],y:ESP+0.1,sx:2.2,sy:6.5,sz:2.2,
        uv:0.4,ao:1,skip:'B'});
  });

  /* a grid of fifty cubits on the esplanade */
  inPrecinct(B,()=>{
    for(let i=0;i<=10;i++){
      const t=cu(i*50);
      B.box('marker','grid',{x:t,z:cu(250),y:ESP+0.09,sx:0.30,sy:0.06,sz:cu(500),
        uv:0.3,ao:1,skip:'B'});
      B.box('marker','grid',{x:cu(250),z:t,y:ESP+0.09,sx:cu(500),sy:0.06,sz:0.30,
        uv:0.3,ao:1,skip:'B'});
    }
  });
}

/* =====================================================================
 *  assemble
 * ===================================================================== */
/* The phases, so that the caller can yield to the browser between them and
   the progress bar actually means something. */
const SCENE_STEPS = [
  ['shaping the hill',         B=>buildTerrain(B)],
  ['cutting the retaining walls', B=>buildRetainingWalls(B)],
  ['paving the esplanade',     B=>{ buildEsplanade(B); buildStreet(B); }],
  ['the city round about',     B=>buildCity(B)],
  ['raising the colonnades',   B=>buildPorticoes(B)],
  ['the Royal Stoa',           B=>buildRoyalStoa(B)],
  ['the Antonia',              B=>buildAntonia(B)],
  ['the gates and staircases', B=>buildGates(B)],
  ['the reservoirs',            B=>buildPools(B)],
  ['the soreg and the chel',   B=>buildSoregAndChel(B)],
  ['the courts',               B=>{ buildCourtWalls(B); buildCourtOfWomen(B);
                                    buildNicanor(B); }],
  ['the altar',                B=>buildAzarah(B)],
  ['the Sanctuary',            B=>buildSanctuary(B)],
  ['the crowds',               B=>{ buildPeople(B); buildOverlays(B); }],
];

function finishScene(B){
  /* resolve precinct-local label anchors into world space */
  for(const p of B.parts){
    if(p.atLocal){
      const w = precinctToWorld(p.atLocal[0]/CUBIT, p.atLocal[2]/CUBIT);
      p.at = [w[0], p.atLocal[1], w[1]];
    }
  }
  return B.compile();
}

/* synchronous build—used by the headless checks */
function buildScene(progress){
  const B = new Builder();
  SCENE_STEPS.forEach(([label,fn],i)=>{
    if(progress) progress((i+1)/(SCENE_STEPS.length+1), label);
    fn(B);
  });
  return finishScene(B);
}
