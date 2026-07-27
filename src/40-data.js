/* =====================================================================
 *  40—the historical record, as constants
 *
 *  Every number below is traceable. `src` fields name the source.
 *  Where the sources disagree—and on the altar, the gate heights and
 *  the width of the Sanctuary they flatly do—the model follows the
 *  stated primary and records the variant in `note`.
 *
 *  SOURCING POLICY
 *    Inner sacred precinct .... Mishnah, Middot (the only systematic
 *                               dimensional source; the basis of the
 *                               Ritmeyer and Temple Institute plans)
 *    Outer platform, colonnades,
 *    Royal Stoa, Antonia ...... Josephus, Jewish War 5.184–247 and
 *                               Antiquities 15.380–425 (eyewitness, but
 *                               rhetorical about size)
 *    Walls, gates, streets,
 *    staircases ............... the Temple Mount excavations
 *                               (Warren 1867–70; B. Mazar 1968–78;
 *                               Ben-Dov; Reich & Billig)
 * ===================================================================== */
'use strict';

/* The royal ("long") cubit of 52.5 cm, six handbreadths of 8.75 cm.
   Ritmeyer's identification of the 500-cubit square on the Mount
   measures out at this value, and it is the cubit that makes the
   Mishnah's numbers fit the surviving bedrock and masonry. */
const CUBIT = 0.525;
const cu = n => n * CUBIT;
const HB  = CUBIT / 6;

/* ------------------------------------------------------------------ *
 *  1. THE PLATFORM
 *  An irregular quadrilateral, not a rectangle: the north wall runs
 *  further east than the south wall, and no two walls are parallel.
 *  Surveyed lengths: W 485 m, E 460 m, N 315 m, S 280 m.
 * ------------------------------------------------------------------ */
const PLAT = {
  NW:[   0.0,   0.0],
  NE:[ 313.9,  26.0],
  SE:[ 280.0, 485.0],
  SW:[   0.0, 485.0],
};
const PLAT_RING = [PLAT.NW, PLAT.NE, PLAT.SE, PLAT.SW];

/* esplanade datum. Real elevation ≈ 740 m above sea level. */
const ESP = 0;

/* unit vectors of the eastern wall—the whole sacred precinct is set
   out parallel to it, which is why Ritmeyer's pre-Herodian blocks at the
   northwest "step" lie parallel to the east wall and not to anything
   Herodian. */
const _ew = [PLAT.SE[0]-PLAT.NE[0], PLAT.SE[1]-PLAT.NE[1]];
const _ewLen = Math.hypot(_ew[0], _ew[1]);                 // 460.25 m
const V_SOUTH = [_ew[0]/_ewLen, _ew[1]/_ewLen];
const U_EAST  = [ V_SOUTH[1], -V_SOUTH[0] ];
/* rotation to apply to get local (u,v) = (x,z): 4.223° */
const PRECINCT_ROT = -Math.asin(-V_SOUTH[0]);

const WALL_LEN = {
  N: Math.hypot(PLAT.NE[0]-PLAT.NW[0], PLAT.NE[1]-PLAT.NW[1]),
  E: _ewLen,
  S: Math.hypot(PLAT.SE[0]-PLAT.SW[0], PLAT.SE[1]-PLAT.SW[1]),
  W: Math.hypot(PLAT.SW[0]-PLAT.NW[0], PLAT.SW[1]-PLAT.NW[1]),
};

/* ------------------------------------------------------------------ *
 *  2. THE PRE-HERODIAN 500-CUBIT SQUARE
 *  Middot 2:1—"The Temple Mount was five hundred cubits by five
 *  hundred cubits." Ritmeyer located it on the ground: its eastern side
 *  is the existing eastern wall, its northern side a line of
 *  pre-Herodian blocks continuing east along a rock scarp, and its
 *  southern side the bend in the eastern wall, 500 royal cubits south.
 *  Herod's platform is this square plus extensions north, west and south.
 * ------------------------------------------------------------------ */
const SQ_SIDE   = cu(500);              // 262.5 m
const SQ_N_OFF  = 130.5;                // meters south along the east wall
const SQ_NE = [ PLAT.NE[0] + V_SOUTH[0]*SQ_N_OFF, PLAT.NE[1] + V_SOUTH[1]*SQ_N_OFF ];
const SQ_NW = [ SQ_NE[0] - U_EAST[0]*SQ_SIDE,     SQ_NE[1] - U_EAST[1]*SQ_SIDE     ];
const SQ_SW = [ SQ_NW[0] + V_SOUTH[0]*SQ_SIDE,    SQ_NW[1] + V_SOUTH[1]*SQ_SIDE    ];
const SQ_SE = [ SQ_NE[0] + V_SOUTH[0]*SQ_SIDE,    SQ_NE[1] + V_SOUTH[1]*SQ_SIDE    ];

/* ------------------------------------------------------------------ *
 *  3. WHERE THE COURTS SIT INSIDE THAT SQUARE
 *  Middot 2:1 gives no coordinates, only a rank order of the open
 *  margins: "the largest space was to the south, the second largest to
 *  the east, the third to the north, and the smallest to the west."
 *  These four margins satisfy that order and place the Holy of Holies
 *  over es-Sakhra, the rock now under the Dome of the Rock—Ritmeyer's
 *  identification, and the mainstream one. See ALT_SITINGS below.
 *  All values are cubits in the precinct's local frame.
 * ------------------------------------------------------------------ */
const MARGIN_W = 62;    // smallest
const MARGIN_N = 95;    // third
const MARGIN_E = 500 - MARGIN_W - 187 - 135;   // 116—second largest
const MARGIN_S = 500 - MARGIN_N - 135;         // 270—largest

/* the Azarah (courtyard), 187 x 135 cubits—Middot 5:1 */
const AZ = { x0:MARGIN_W, x1:MARGIN_W+187, z0:MARGIN_N, z1:MARGIN_N+135 };
/* the Court of the Women, 135 x 135—Middot 2:5 */
const CW = { x0:AZ.x1, x1:AZ.x1+135, z0:AZ.z0, z1:AZ.z1 };
const AXIS_Z = (AZ.z0+AZ.z1)/2;          // 162.5c—the Temple's east-west axis

/* Middot 5:1, reading east to west across the 187 cubits */
const EW = {
  israelE : AZ.x1,          israelW : AZ.x1-11,
  priestE : AZ.x1-11,       priestW : AZ.x1-22,
  altarE  : AZ.x1-22,       altarW  : AZ.x1-54,      // 32 cubits of altar
  gapE    : AZ.x1-54,       gapW    : AZ.x1-76,      // 22 cubits, porch to altar
  templeE : AZ.x1-76,       templeW : AZ.x1-176,     // 100 cubits of Sanctuary
  rearE   : AZ.x1-176,      rearW   : AZ.x0,         // 11 cubits behind the kapporet
};

/* Middot 4:7, reading east to west through the Sanctuary's 100 cubits */
const HOUSE = (()=> {
  let x = EW.templeE;
  const seg = n => { const a=x; x-=n; return {e:a,w:x,n:n}; };
  return {
    porchWall : seg(5),
    porch     : seg(11),
    hekhalE   : seg(6),
    hekhal    : seg(40),
    traksin   : seg(1),
    debir     : seg(20),     // the Holy of Holies
    hekhalW   : seg(6),
    cellW     : seg(6),
    outerW    : seg(5),
  };
})();
const HOH_X = (HOUSE.debir.e + HOUSE.debir.w)/2;      // 100c—over es-Sakhra

/* Middot 4:7 north to south: a 70-cubit body, with the porch throwing
   out 15-cubit "shoulders" each side to make a 100-cubit facade—
   "narrow behind and broad in front, resembling a lion" (4:7).
   Josephus (War 5.207) instead gives a 60-cubit body and 20-cubit
   shoulders for the same 100-cubit front. */
const HOUSE_BODY_W  = 70;
const HOUSE_FRONT_W = 100;

/* Middot 4:6—the hundred cubits of height, course by course */
const HEIGHT = {
  foundation : 6,   hekhalInner : 40,  ornament1 : 1,  gutter1 : 2,
  ceiling1   : 1,   plaster1    : 1,   upper     : 40, ornament2 : 1,
  gutter2    : 2,   ceiling2    : 1,   plaster2  : 1,  parapet   : 3,
  scarecrow  : 1,                       // the golden spikes against birds
};
const HOUSE_H = Object.values(HEIGHT).reduce((a,b)=>a+b,0);   // 100 ✓

/* ------------------------------------------------------------------ *
 *  4. LEVELS. Each rise is textual; they stack to put the Sanctuary
 *  floor 22 cubits above the outer court and its roof 64 m up.
 * ------------------------------------------------------------------ */
const LEV = {};
LEV.esplanade = ESP;                        // Court of the Gentiles
LEV.chel      = ESP;                        // the ten-cubit terrace, Middot 2:3
LEV.women     = ESP + cu(6);                // 12 steps of ½ cubit—Middot 2:3
LEV.israel    = LEV.women + cu(7.5);        // 15 semicircular steps—Middot 2:5
LEV.priests   = LEV.israel + cu(2.5);       // Middot 2:6
LEV.house     = LEV.priests + cu(6);        // 12 steps / the 6-cubit foundation
/* Middot 4:6 counts the six-cubit foundation as the first of the hundred
   cubits, so the hundred is measured from the Court of the Priests and not
   from the Sanctuary floor: 8.4 + 52.5 = 60.9 m above the esplanade. */
LEV.houseTop  = LEV.priests + cu(HOUSE_H);

/* ------------------------------------------------------------------ *
 *  5. THE ALTAR—Middot 3:1. Josephus (War 5.225) says 50 x 50 x 15
 *  cubits, roughly two and a half times the volume; the Mishnah's
 *  stepped profile is followed here because it is internally
 *  consistent with the courtyard's 187 x 135.
 * ------------------------------------------------------------------ */
const ALTAR = {
  x0:EW.altarW, x1:EW.altarE,
  z0:AXIS_Z-16, z1:AXIS_Z+16,
  tiers:[                                  // [side, rise] in cubits
    {side:32, rise:1},                     // the base (yesod)
    {side:30, rise:5},                     // to the surrounding ledge
    {side:28, rise:3},                     // the sovev
    {side:26, rise:1},                     // the horns course
  ],
  hornSide:24,                             // 24 x 24 for the wood pile
  ramp:{ len:32, wide:16 },                // Middot 3:3, on the south
};

/* Middot 5:2, the slaughtering floor north of the altar. `rings` is the count
   the Mishnah gives; the rest are this reconstruction's setbacks in cubits,
   stepping north—the altar's northern face to the rings, the rings' northern
   row to the tables, the tables to the flaying pillars, and the pillars to the
   Azarah's northern wall. `ringsToTables` used to be reached by stepping back
   cu(`rings`), which is a COUNT used as a distance and put the whole group
   fifteen cubits further north than the four rows of rings actually reach. */
const SHAMBLES = { rings:24, toRings:8, ringsToTables:15, toPillars:4, toWall:8 };

/* ------------------------------------------------------------------ *
 *  6. OUTER COLONNADES—Josephus, War 5.190–192
 *  "double cloisters... thirty cubits broad", columns "twenty five
 *  cubits in height, and consisted of one entire stone each of them,
 *  and that stone was white marble", roofed with cedar.
 * ------------------------------------------------------------------ */
const PORTICO = { depth:cu(30), colH:cu(25), colD:1.6, spacing:4.4, roofT:1.9 };

/* ------------------------------------------------------------------ *
 *  7. THE ROYAL STOA—Josephus, Antiquities 15.411–416
 *  A basilica down the whole southern side: "a hundred and sixty two
 *  pillars in four rows", the fourth engaged in the southern wall; two
 *  side aisles of 30 ft and a nave of 45 ft; the nave roughly twice the
 *  aisles' height, lit by a clerestory; a coffered cedar ceiling
 *  "adorned with deep sculptures in wood".
 *  Josephus gives no spacing. Distributing 40 bays over the length of
 *  the 280 m wall yields about 6.6 m centers, which is what this model uses.
 * ------------------------------------------------------------------ */
const STOA = {
  aisleS:9.9, nave:14.8, aisleN:9.9,   // 34.6 m overall, ≈ Josephus' 105 ft
  colH:15.24, colD:1.5,                // 50 ft; "three men might fathom it round"
  perRow:40, rows:4, total:162,
  /* the architrave over the columns already reaches 17.9 m, so the aisle
     ceiling must sit above that and the roof above the ceiling */
  aisleRoof:19.8, cleryTop:28.4, ridge:34.2,
};

/* ------------------------------------------------------------------ *
 *  8. GATES. Positions measured along each wall from the corner named,
 *  after the excavation reports. Marked ≈ where the published figure is
 *  approximate.
 * ------------------------------------------------------------------ */
const GATES = {
  robinson : { wall:'W', from:'SW', at: 12,  span:12.9, note:'stair on an arch' },
  barclay  : { wall:'W', from:'SW', at: 80,  w:5.6, h:8.8, note:'lintelled, into a tunnel' },
  /* THE PRINCIPAL WESTERN ENTRANCE, and the counterpart of the Shushan Gate in
     the east: the road from the Upper City crossed the Tyropoeon on the viaduct
     and arrived LEVEL with the esplanade, so it opened straight into the outer
     court as the Shushan Gate does, and gets a gatehouse to match rather than
     the bare hole in the head wall it had. But not an arch. The one western
     gate whose head survives is Barclay's, and it is a monolithic lintel—6.4 m
     long, 2 m deep, some fifty tons—with the opening under it estimated at
     7.8–9.3 m. So: lintelled, sixteen cubits each way, with a relieving arch
     over the lintel, which is what a span that wide needs and what keeps a
     two-hundred-ton stone from being asked to work in bending. */
  wilson   : { wall:'W', from:'SW', at:150,  span:13.0, w:cu(16), h:cu(16),
               note:'the causeway from the Upper City' },
  warren   : { wall:'W', from:'SW', at:190,  w:5.0, h:7.0, note:'tunnel gate' },
  double   : { wall:'S', from:'SW', at: 84,  w:12.6, h:8.6, note:'the western Huldah passage' },
  triple   : { wall:'S', from:'SW', at:170,  w:15.4, h:8.6, note:'the eastern Huldah passage' },
  /* The eastern gate is arched: `h` is the height to the crown, so it springs
     at h - w/2. James Fleming found the voussoirs of an earlier arched gate
     directly beneath the present Golden Gate in 1969, which is the only
     physical evidence for its form. Forty cubits of clear height, which stood
     here before, is more than the wall carries above the pavement. */
  shushan  : { wall:'E', from:'NE', at:215.2, w:cu(20), h:cu(22), arch:true,
               note:'on the Sanctuary axis' },
  tadi     : { wall:'N', from:'NW', at:200,  w:cu(10), h:cu(20), note:'Middot 1:3, unused' },
};

/* ------------------------------------------------------------------ *
 *  THE TWO GREAT RESERVOIRS at the northern corners.
 *
 *  The Struthion is on firm ground: 52 x 14 m, cut as a moat off the
 *  Antonia's northwest corner, and Josephus names it in the siege of AD 70
 *  ("over against the middle of that pool which was called Struthius",
 *  War 5.467). Herodian, and it still exists under the Sisters of Zion.
 *
 *  The Pool of Israel is not. It is a real and enormous thing—109.7 x
 *  38.4 m, 26 m deep, against the northern wall by the northeast corner,
 *  filled in only in 1934—but its date is genuinely disputed: Herodian on
 *  one view, Hadrianic around AD 130 on Warren's, Umayyad on Gibson's.
 *  Warren's objection is the strong one: Josephus, who lists the city's
 *  water, never mentions it. It is drawn here because it is asked about
 *  more than almost anything else on this side of the Mount, and it is
 *  labeled as disputed in its panel.
 * ------------------------------------------------------------------ */
const POOLS = {
  struthion: { w:14,   d:52,   depth:5.5, freeboard:0.9 },
  israel:    { w:109.7,d:38.4, depth:26,  freeboard:1.8 },
};

/* the monumental staircase before the Double Gate: 30 steps, 65.5 m
   wide, alternating deep and shallow treads, which forced a slow
   ascent (B. Mazar's excavation, 1968–78) */
const SOUTH_STAIR = { w:65.5, n:30, rise:0.22, treadA:0.90, treadB:0.35,
  /* MAZAR'S 65.5 m IS THE STRETCH THAT WAS EXCAVATED, centered on the Double
     Gate. It is not the whole approach: Baruch and Reich call what their three
     vaulted rooms carried "the monumental staircase leading up to the Temple
     Mount" at the TRIPLE Gate.

     But carrying THIS flight east to meet that ran it into the miqweh and the
     rooms beside it, which is not how Ritmeyer resolves it. His great flight
     climbs to a terrace running along most of the southern edge and keeps its
     excavated width; the Triple Gate then has a staircase of its OWN running
     south off its landing, and that is the flight the three vaulted rooms
     carry, 7.2-7.5 m south of the gate, exactly where they were found. So this
     one is left at the width it was dug at, and the eastern gate gets its own
     way down (`buildSouthernApproach`), with the ramp beyond that. `east` carries
     this flight far enough east to MEET the buildings on the plaza rather than
     stopping in open ground short of them. */
  east:6 };
SOUTH_STAIR.wTot = SOUTH_STAIR.w + SOUTH_STAIR.east;
SOUTH_STAIR.cx   = GATES.double.at + SOUTH_STAIR.east/2;

/* ------------------------------------------------------------------ *
 *  9. RETAINING WALLS. Courses of about 1.0–1.2 m; the largest stone
 *  known in the western wall is 13.6 m long. Heights above the
 *  contemporary street: ~32 m at Robinson's Arch, the greatest drop at
 *  the southeast corner where Josephus (Ant. 15.412) says a man could
 *  not bear to look down.
 * ------------------------------------------------------------------ */
/* `head` is the thickness of the masonry standing ABOVE the esplanade—the
   back wall of the colonnades—which is what the crowning pilaster order is
   applied to, and is much thinner than the retaining wall below it. */
const WALLS = { crown:cu(5), thick:4.6, head:2.2, course:1.15, pilasterTop:true };

/* ------------------------------------------------------------------ *
 *  10. THE ANTONIA—Josephus, War 5.238–247. On a rock 50 cubits high
 *  "at the corner of two cloisters of the court of the temple, of that
 *  on the west and that on the north"; the fortress 40 cubits above
 *  that; four corner towers, three of 50 cubits and the southeastern
 *  of 70, "that from thence the whole temple might be viewed". A Roman
 *  cohort was quartered in it.
 *
 *  THE JOIN IS AT ROOF LEVEL, NOT AT THE PAVEMENT. Three things settle it.
 *
 *  (1) The sockets for the roof beams of the northern colonnade are still
 *  there, cut into the Antonia's rockscarp at the northwest corner of the
 *  Mount (Ritmeyer). So the northern colonnade ran along the FRONT of the
 *  scarp, and its roof died into the fortress. That is a physical constraint,
 *  and it forbids the fortress standing out in the corner of the court.
 *
 *  (2) War 2.12: at the feast "a Roman cohort stood OVER the cloisters of the
 *  temple, for they always were armed, and kept guard at the festivals, to
 *  prevent any innovation which the multitude thus gathered together might
 *  make." The guard's festival station was the colonnade roofs—which is the
 *  same event as War 5.243-244, where "on the corner where it joined to the two
 *  cloisters of the temple it had passages down to them both, through which the
 *  guard went several ways among the cloisters with their arms on the Jewish
 *  festivals". The passages lead onto the roofs; the roofs are the highway.
 *
 *  (3) Acts 21:40. Paul stood on the steps and beckoned to a crowd that filled
 *  the court, and was heard. From the roof—or from the great stair up to it—
 *  he is sixteen meters up in the open with nothing between him and them. Put
 *  the flights down inside the colonnades instead and he is behind a screen of
 *  columns in shadow, visible only to whoever is already in the porch. That
 *  is what stood here before, and it did not work.
 *
 *  So: the fortress sits north of the north wall, set out on the wall's OWN
 *  line (Herod's masons would not have built it askew to his own precinct, and
 *  an axis-aligned block would swing ten meters out of true across its length).
 *  Its south front is the scarp, faced with Herodian stones, and it is the back
 *  wall of the northern colonnade. One great stair climbs from the court at the
 *  angle where the two colonnades meet to the level of their eaves, and two
 *  posterns open off that level into the fortress.
 * ------------------------------------------------------------------ */
/* The fortress is laid out in the NORTHERN COLONNADE'S frame—`s` along the
   north wall from the platform's northwest corner, `d` inward (south)—which
   is the same frame `buildPortico` works in, so a station here and a station
   there mean the same thing. */
const N_FRAME = (()=>{
  const a = PLAT.NW, b = PLAT.NE;
  const dx = b[0]-a[0], dz = b[1]-a[1], l = Math.hypot(dx,dz);
  const u = [dx/l, dz/l], n = [-u[1], u[0]];
  return { o:a, u, n, len:l,
           toW:(s,d) => [a[0]+u[0]*s+n[0]*d, a[1]+u[1]*s+n[1]*d],
           toL:(x,z) => { const px=x-a[0], pz=z-a[1];
                          return [px*u[0]+pz*u[1], px*n[0]+pz*n[1]]; } };
})();

const ANTONIA = {
  /* 122 m along the wall is the surveyed rock plateau under the Omariya
     school, which is the one plan dimension there is evidence for; Josephus
     gives none. The depth is what the four corner towers and a legion's
     quarters need, and is bounded on the north by the fosse. */
  s0:-26, s1:96, depth:46,
  /* `face` is the SOUTH face of the scarp: the inner face of the head wall the
     colonnade would otherwise have had, because here the scarp is that wall. */
  face: WALLS.head/2,
  thick: 4.2,
  /* Josephus's fifty cubits is the height of the scarped rock above the ground
     at its foot, not above the esplanade: the platform's northwest corner
     stands on the same bedrock ridge—the scarp still stands 9.75 m in the
     west wall north of Bab al-Ghawanima—so the rock's top is only a little
     above the pavement. `floor` is that, twenty cubits. Above it the south
     front continues in Herodian ashlar, which is what carries the colonnade's
     roof beams at 16.5 m and what the surviving sockets are cut into.
     The four towers are measured from the fortress floor, so a fifty-cubit
     tower stands ten cubits above the forty-cubit curtain rather than fifty
     above it: stacked the other way the southeastern tower reached 90 cubits
     and overtopped the Sanctuary, which Josephus nowhere says and which would
     make nonsense of a tower built so the Temple "might be viewed" from it. */
  rockH:cu(50), floor:cu(20), wallH:cu(40), towerH:cu(50), bigTowerH:cu(70),
  /* War 5.239: the rock was faced with smooth stone so that nobody could keep
     his footing on it, and "before the tower edifice itself there was a wall
     three cubits high, but within that wall all the space of the tower of
     Antonia itself was built upon, to the height of forty cubits"—a narrow
     walk at the rim with a low wall, and the building filling the rest. Four
     cubits of walk, on the three sides that face outward; on the south there
     is none, because the colonnade's roof has to reach the fortress wall. */
  apron:cu(4), rim:cu(3), tower:cu(24),
};
/* the curtain's wall centerlines, and the scarped rock in plan */
ANTONIA.wall = { s0:ANTONIA.s0, s1:ANTONIA.s1,
                 dS:ANTONIA.face - ANTONIA.thick/2 };
ANTONIA.wall.dN = ANTONIA.wall.dS - ANTONIA.depth;
ANTONIA.rock = {
  s0:ANTONIA.wall.s0 - ANTONIA.thick/2 - ANTONIA.apron,
  s1:ANTONIA.wall.s1 + ANTONIA.thick/2 + ANTONIA.apron,
  dS:ANTONIA.face,
  dN:ANTONIA.wall.dN - ANTONIA.thick/2 - ANTONIA.apron,
};

/* ------------------------------------------------------------------ *
 *  THE GREAT STAIR—Acts 21:35, 40
 *
 *  "At the place where the northern and western porticoes met, there was a
 *  staircase leading up to the roof of the porticoes" (Ritmeyer). Sixty-three
 *  steps of half a cubit, a cubit deep: 16.5 m, which is the height of the
 *  colonnades' eaves, where the roof beams socket into the scarp. It climbs
 *  eastward in the open, hard against the scarp and clear of both colonnades,
 *  and ends on a landing at eave level with a postern into the fortress behind
 *  it. That landing is the place from which Paul spoke.
 * ------------------------------------------------------------------ */
const ANT_STAIR = (()=>{
  const rise = cu(0.5), tread = cu(1), n = 63;
  const eave = PORTICO.colH + 3.4;
  return { n, rise, tread, run:n*tread, top:n*rise, eave,
           w:cu(16), rail:0.9,
           /* hard against the scarp, overlapping it half a meter so the two
              are never coplanar */
           d0:ANTONIA.face - 0.5,
           s0:18,                       // clear of the western colonnade's depth
           landing:4.6 };
})();
ANT_STAIR.d1  = ANT_STAIR.d0 + ANT_STAIR.w;
ANT_STAIR.s1  = ANT_STAIR.s0 + ANT_STAIR.run;      // head of the flight
ANT_STAIR.sEnd = ANT_STAIR.s1 + ANT_STAIR.landing;  // east edge of the landing

/* The two posterns' stations, and the gallery they open onto INSIDE the south
   front. They are upper-floor doors—the fortress's own paving is twenty cubits
   up and this level is six meters above that—so without a floor behind them
   the walk camera stepped off the head of the great stair, through the dark, and
   fell to the courtyard. A rampart backing the curtain, carrying a walk at the
   level of the doors, is what a fortress wall of this height has anyway. */
const ANT_POSTERN = [ (ANT_STAIR.s1 + ANT_STAIR.sEnd)/2, 2.0 ];
const ANT_GALLERY = { d1: ANTONIA.wall.dS - ANTONIA.thick/2,      // the inner face
                      d0: ANTONIA.wall.dS - ANTONIA.thick/2 - 5.2,
                      y:  ANT_STAIR.top };

/* where the northern colonnade's own head wall resumes: east of the scarp.
   West of it the scarp IS the back wall, which is why the crowning pilaster
   order stops there and why the roof beams are socketed into rock. */
const ANT_JOIN = { N: ANTONIA.rock.s1, W: WALL_LEN.W - 0.5 };

/* =====================================================================
 *  CONTENT—what each part of the model says when you click it.
 *  `k` is the kind line, `d` the description, `t` an optional table of
 *  dimensions, `s` the citation.
 * ===================================================================== */
const INFO = {

  platform:{
    n:'The Temple Mount platform', k:'Retaining walls and fill · 19 <span class="sc">BC</span> onward',
    d:`Herod expanded the Mount with four retaining walls around the hill and fill laid
       behind them, including vaulted substructures in some areas. The walls enclose
       about <b>140,000 m²</b>, or 35 acres. The platform is an irregular quadrilateral:
       no two walls are parallel, and the northern wall extends about 35 m farther east
       than the southern wall.
       <p>The surviving masonry consists of dry-laid blocks with flat bosses and finely
       tooled recessed margins. Courses average about 1.1 m high. The largest identified
       stone in the western wall is 13.6 m long and has been estimated at approximately
       570 metric tons.</p>`,
    t:[['West wall','485 m'],['East wall','460 m'],['North wall','315 m'],
       ['South wall','280 m'],['Platform level','≈ 740 m a.s.l.']],
    s:'Josephus, War 5.184–189; Ant. 15.391–402. Warren 1867–70; B. Mazar 1968–78.'
  },

  square:{
    n:'The 500-cubit square', k:'The pre-Herodian Temple Mount',
    d:`Middot describes the Temple Mount as a square of <b>500 cubits</b>, or 262.5 m,
       on each side. This description is generally understood to preserve the dimensions
       of a pre-Herodian enclosure incorporated into Herod's larger platform.
       <p>Leen Ritmeyer proposes that the square can be traced from pre-Herodian masonry
       at the northwestern corner of the present raised platform, a rock scarp to its
       east, and the bend in the eastern wall associated with Herod's southern extension.
       In this proposal the northern and southern limits are 500 royal cubits apart.</p>
       <p>In this proposal, the sacred precinct is aligned with the eastern wall and
       rotated 4.2° from the main Herodian platform.</p>`,
    t:[['Side','500 cubits = 262.5 m'],['Cubit used','52.5 cm (royal)'],
       ['Skew from Herodian walls','4.2°']],
    s:'Mishnah Middot 2:1; Ritmeyer, <i>The Quest</i> (2006).'
  },

  royalStoa:{
    n:'The Royal Stoa', k:'Basilica · the southern range',
    d:`Josephus describes a basilica extending along the southern side of the platform,
       with <b>162 columns in four rows</b>, the fourth
       engaged in the southern wall. Two side aisles flanked a nave half again as
       wide and about twice as high, lit by clerestory windows above the inner
       colonnades, with a carved cedar ceiling. Josephus says the woodwork was
       "adorned with deep sculptures, representing many sorts of figures."
       <p>The columns are Corinthian, about 15 m tall, and so thick that Josephus says
       three men with arms outstretched could just span one. The Royal Stoa is often
       proposed as a commercial and judicial area. It is a possible setting for the
       animal sellers and money changers described in the Gospels, although those texts
       identify only the Temple courts.</p>`,
    t:[['Columns','162, in 4 rows'],['Column height','≈ 15.2 m (50 ft)'],
       ['Overall width','≈ 34.6 m'],['Nave ridge','≈ 33 m above the pavement']],
    s:'Josephus, Ant. 15.411–416; War 5.190. Matthew 21:12; Mark 11:15.'
  },

  solomons:{
    n:"Solomon's Porch", k:'The eastern colonnade',
    d:`The colonnade along the eastern wall, thirty cubits deep, in double rows of
       monolithic white marble columns twenty-five cubits high, roofed in cedar.
       Josephus reports that some people associated it with Solomon because of the age
       attributed to its masonry.
       <p>It is a named place in the Gospels. John sets Jesus walking here in winter, at
       the feast of Dedication; Acts has the earliest Jerusalem congregation gathering
       in this same colonnade.</p>`,
    t:[['Depth','30 cubits ≈ 15.75 m'],['Column height','25 cubits ≈ 13.1 m'],
       ['Length','≈ 460 m']],
    s:'Josephus, War 5.184–185; Ant. 20.220–221. John 10:23; Acts 3:11, 5:12.'
  },

  gentiles:{
    n:'The Court of the Gentiles', k:'The great outer esplanade',
    d:`The paved outer court was open to Jews and Gentiles.
       Bordered by porticoes and the Royal Stoa, it was the principal public space of
       the complex and accommodated trade, teaching, and festival crowds. Josephus gives
       the circuit of the porticoes as six stadia, about 1,100 m; the surveyed perimeter
       of the Herodian platform is approximately 1,540 m.
       <p>The paving was of large stone slabs; sections of Herodian pavement survive in
       the fills excavated at the southwestern corner, deposited when the Romans
       leveled the porticoes in <span class="sc">AD</span> 70.</p>`,
    s:'Josephus, War 5.192–193; Mishnah Middot 2:1–2.'
  },

  soreg:{
    n:'The Soreg', k:'The boundary of holiness',
    d:`A latticed stone screen, ten handbreadths high, marking the line no Gentile could
       cross. Josephus makes it three cubits and reports that inscriptions stood along it
       in Greek and Latin forbidding foreigners to enter.
       <p>Two of those inscriptions have been found—one complete, in Greek, now in
       Istanbul: <em>"No foreigner is to enter within the balustrade and enclosure around
       the sanctuary. Whoever is caught will himself bear the blame for the death which
       will follow."</em> The wording matches Josephus's description of the boundary
       inscriptions.</p>
       <p>Acts reports that Paul was attacked after a rumor that he had brought a Greek
       beyond this line. Ephesians refers to a "dividing wall of hostility."</p>`,
    t:[['Height (Middot)','10 handbreadths ≈ 0.9 m'],['Height (Josephus)','3 cubits ≈ 1.6 m'],
       ['Breaches','13, Middot 2:3']],
    s:'Mishnah Middot 2:3; Josephus, War 5.193–194; Acts 21:28–29; Ephesians 2:14.'
  },

  chel:{
    n:'The Chel', k:'Terrace, ten cubits broad',
    d:`The strip between the soreg and the wall of the inner courts, ten cubits broad,
       with twelve steps at its inner edge rising six cubits to the gates.
       <p>Josephus counts the ascent differently: fourteen steps up to the terrace and
       five more to the gates.</p>`,
    t:[['Breadth','10 cubits = 5.25 m'],['Steps','12, each ½ cubit rise and tread']],
    s:'Mishnah Middot 2:3; cf. Josephus, War 5.195–198.'
  },

  women:{
    n:'The Court of the Women', k:'135 × 135 cubits',
    d:`The first of the inner courts, entered from the east, and as far as women could
       go. Men passed through it to the courtyard beyond. A gallery was built round it
       so that women could look down on the ceremonies of the Feast of Tabernacles.
       <p>Four chambers of forty cubits stood in its corners: the Chamber of
       the Nazirites (southeast), where Nazirites boiled their peace-offerings and cut
       their hair, throwing it under the pot; the Wood Chamber (northeast), where
       priests with blemishes sorted the worm-eaten logs out of the altar's timber; the
       Chamber of the Lepers (northwest), where those cleansed of leprosy immersed;
       and the southwestern chamber, whose function Rabbi Eliezer ben Jacob did not
       remember. Abba Shaul says wine and oil
       were kept there, and calls it the Chamber of the House of Oils.</p>
       <p>Middot explicitly describes the four corner enclosures as unroofed and cites
       Ezekiel 46:21–22 in support of that description.</p>
       <p>Thirteen chests shaped like trumpets stood here for offerings—the setting of
       the widow's two mites.</p>`,
    t:[['Court','135 × 135 cubits = 70.9 m square'],['Each corner chamber','40 cubits square'],
       ['Roofs','none—Middot 2:5, expressly'],
       ['Floor level','+6 cubits above the esplanade']],
    s:'Mishnah Middot 2:5, citing Ezekiel 46:21–22; Shekalim 6:5; Sukkah 5:2. '+
      'Mark 12:41–44; Luke 2:36–38.'
  },

  nicanor:{
    n:'The Nicanor Gate', k:'The gate of Corinthian brass',
    d:`The gate between the Court of the Women and the courtyard, reached by
       <b>fifteen semicircular steps</b>—"shaped like the half of a round threshing
       floor"—on which the Levites sang the fifteen Psalms of Ascents.
       <p>Josephus describes the eastern gate of the inner courts as exceptional: nine
       gates were plated with silver and gold, but this one was of Corinthian bronze and
       "far exceeded them in value." Mishnah sources associate this gate with the
       purification rites after childbirth and after recovery from leprosy. The Nicanor Gate is one proposed
       identification for Acts' "gate called Beautiful"; an outer eastern gate is
       another.</p>`,
    t:[['Steps','15, semicircular'],['Rise','7½ cubits ≈ 3.94 m'],
       ['Height (Josephus)','50 cubits, doors of 40']],
    s:'Mishnah Middot 2:5–6; Josephus, War 5.201–204; Acts 3:2; Luke 2:22.'
  },

  israel:{
    n:'The Court of Israel', k:'A strip 135 × 11 cubits',
    d:`A narrow terrace inside the courtyard gate where Israelite men stood to watch the
       service and to lay hands on their offerings. It is separated from the priests'
       area by a low platform of three steps, on which the Levites stood with their
       instruments and from which the priests pronounced the blessing.`,
    t:[['Size','135 × 11 cubits'],['Below the priests by','2½ cubits']],
    s:'Mishnah Middot 2:6; Sotah 7:6.'
  },

  altar:{
    n:'The Altar of Burnt Offering', k:'32 cubits square, 10 high',
    d:`The principal sacrificial altar was a stepped mass of unhewn stone constructed
       without iron tools. Its base was
       thirty-two cubits square, and it stepped inward twice to leave a twenty-four cubit
       hearth, with a horn at each corner. A ramp thirty-two cubits long climbed it from
       the south, because Exodus forbids steps to an altar.
       <p>A perpetual fire burned here; the ash was carried out and the blood ran through
       channels down into the Kidron. North of the altar was the slaughtering floor:
       twenty-four rings set in the pavement to hold the animals, eight marble tables for
       rinsing and laying out the pieces, and low pillars with cedar beams and iron hooks
       for flaying.</p>
       <p>Josephus gives the altar as fifty cubits square and fifteen high. The dimensions
       given by Middot are thirty-two cubits square and ten cubits high.</p>`,
    t:[['Base','32 × 32 cubits = 16.8 m'],['Height','10 cubits = 5.25 m'],
       ['Hearth','24 × 24 cubits'],['Ramp','32 × 16 cubits, from the south'],
       ['Josephus\u2019 figure','50 × 50 × 15 cubits']],
    s:'Mishnah Middot 3:1–4, 5:2; Exodus 20:25–26; Josephus, War 5.225.'
  },

  sanctuary:{
    n:'The Sanctuary', k:'A hundred cubits every way',
    d:`"A hundred cubits by a hundred, with a height of a hundred"—52.5 m in each
       direction. Its floor stood 22 cubits above the outer court, and its eastern facade
       was covered with gold.
       Josephus says that to a traveler approaching, it looked like a mountain covered
       with snow, for where it was not gilded it was of the whitest stone.
       <p>Middot describes its plan as "narrow behind and broad in
       front, resembling a lion." The body is seventy cubits wide, but the porch throws
       out shoulders fifteen cubits each side to make a front a hundred cubits across.
       Around the body, thirty-eight cells in three stories—fifteen north, fifteen
       south, eight west—widened as they rose, five cubits, then six, then seven,
       because the wall they were built against stepped inward.</p>`,
    t:[['Front','100 × 100 cubits'],['Body width','70 cubits (Josephus: 60)'],
       ['Shoulders','15 cubits each (Josephus: 20)'],['Total height','100 cubits = 52.5 m'],
       ['Apex above the esplanade','60.9 m'],['Cells','38, in 3 stories']],
    s:'Mishnah Middot 4:1–7; Josephus, War 5.207–226.'
  },

  porch:{
    n:'The Porch and the Golden Vine', k:'The Ulam',
    d:`The porch opening was forty cubits high and twenty broad, and it <b>stood
       open</b>, without doors or a curtain across it. Josephus explains:
       "this gate had no doors, for it represented the universal visibility of heaven,
       and that it cannot be excluded from any place." Five oak beams were set in the
       wall above it, one over another, each longer than the one below.
       <p>Across the eleven-cubit depth of the porch stood the gold-plated doors of the
       Holy Place. Josephus places the <em>Babylonian veil</em> before those doors rather
       than across the outer porch opening.</p>
       <p>Over the doorway hung a <b>vine of gold</b>, trained on poles, to which
       worshipers added a leaf, a berry or a whole cluster, until the mass of it had to
       be supported. Josephus says its clusters were as tall as a man, and that the vine
       was trained around the <b>pillars</b> beside the gate.</p>
       <p>Josephus mentions pillars on either side of the gate but does not give their
       number. Bar Kokhba tetradrachms struck in the <span class="sc">AD</span> 130s and several synagogue
       reliefs depict a tetrastyle Temple front with four columns. Because these images
       postdate the building's destruction, the number and exact form of the columns
       remain uncertain.</p>`,
    t:[['Opening (Middot)','40 × 20 cubits'],['Opening (Josephus)','70 × 25 cubits'],
       ['Doors','none'],['Porch interior','11 cubits deep'],
       ['Columns','4, full height, from the coins']],
    s:'Mishnah Middot 3:7–8; Josephus, War 5.207–212, 5.210; Ant. 15.395.'
  },

  hekhal:{
    n:'The Holy Place', k:'40 × 20 × 40 cubits',
    d:`A doorway twenty cubits high and ten broad, with four doors plated with gold,
       two outer and two inner. On the porch side hung the
       <b>Babylonian veil</b>: "a veil of equal largeness with the doors... embroidered
       with blue, and fine linen, and scarlet, and purple, and of a contexture that was
       truly wonderful", figured, Josephus says, with a panorama of the heavens. The
       four colors were read as the four elements.
       <p>Behind it lay the Hekhal: forty cubits long, twenty wide, forty high, its
       walls boarded with cedar and overlaid with gold. In it stood the seven-branched
       <b>menorah</b> on the south, the <b>table of the bread of the Presence</b> on the
       north, and the <b>golden altar of incense</b> between them before the inner veil.
       Only priests on duty entered, to trim the lamps and to burn incense morning and
       evening, the duty that fell by lot to Zechariah.</p>
       <p>The menorah and table are both depicted among the spoils carved on the Arch of
       Titus in Rome.</p>`,
    t:[['Interior','40 × 20 cubits'],['Height','40 cubits = 21 m'],
       ['Doorway','20 × 10 cubits, four doors'],['Doorway (Josephus)','55 × 16 cubits'],
       ['Outer veil','matching the doors'],['Walls','cedar, overlaid with gold']],
    s:'Mishnah Middot 4:1, 4:7; Tamid 3:9; 1 Kings 6:21–22; Luke 1:8–11; '+
      'Josephus, War 5.207–217.'
  },

  debir:{
    n:'The Holy of Holies', k:'Twenty cubits, and empty',
    d:`A cube of twenty cubits, divided from the Holy Place by the veil, and entered once
       a year, on the Day of Atonement, by the high priest alone. In the first Temple the
       Ark stood here. In Herod's it was empty: Josephus, a priest, writes that it
       contained "nothing at all. It was inaccessible, and inviolable, and not to be seen
       by any."
       <p>Rabbinic sources place the <em>even shetiyyah</em>, or foundation stone, in this
       room. Under Ritmeyer's proposed location of the Sanctuary, it corresponds to
       es-Sakhra, the rock beneath the Dome of the Rock.
       The tearing of this veil "from the top to the bottom" is what all three synoptic
       Gospels report at the moment of the crucifixion.</p>`,
    t:[['Interior','20 × 20 cubits'],['Entered','once a year, by one man'],
       ['Contents','none']],
    s:'Josephus, War 5.219; Mishnah Middot 4:7; Yoma 5:1; Mark 15:38.'
  },

  antonia:{
    n:'The Antonia', k:'Fortress and Roman garrison',
    d:`Josephus places Herod's fortress, named for Mark Antony, on a scarped rock fifty
       cubits high at the junction of the northern and western porticoes. He gives the
       structure on the rock a height of forty cubits.
       <p>Ritmeyer interprets beam sockets in the rockscarp at the northwestern corner of
       the Mount as remains of the northern portico. On that interpretation, the
       fortress's southern front also served as the rear wall of part of the portico.</p>
       <p>Josephus describes a palace-like interior with courts, baths, barracks, and four
       corner towers: three of fifty cubits, and the southeastern of seventy, "that
       from thence the whole temple might be viewed."</p>
       <p>A Roman cohort was quartered here, and at the festivals it "stood over the
       cloisters of the temple&mdash;for they always were armed, and kept guard at the
       festivals, to prevent any innovation which the multitude thus gathered together
       might make." Josephus also records passages from the fortress to both porticoes.
       Their exact form and level are not preserved. A roof-level connection is
       consistent with his account and with the beam sockets.</p>
       <p>Acts reports that soldiers carried Paul up steps into the barracks and that he
       addressed the crowd from them. The precise location and form of those steps are
       uncertain.</p>`,
    t:[['Rock','50 cubits ≈ 26 m, above the ground at its foot'],
       ['Structure on the rock','40 cubits ≈ 21 m'],
       ['Three towers','50 cubits ≈ 26 m'],
       ['Southeast tower','70 cubits ≈ 37 m']],
    s:'Josephus, War 5.238–247, 2.224; Acts 21:31–40. The roof-beam sockets in the rockscarp: Ritmeyer.'
  },

  robinson:{
    n:"Robinson's Arch", k:'A monumental stair on an arch',
    d:`Excavation identifies this as the springing of a great arch carrying a staircase
       rather than a bridge across the valley. The staircase rose from the paved street
       in the Tyropoeon valley, turned, and
       climbed on a series of diminishing arches to a gate high in the western wall that
       opened into the Royal Stoa.
       <p>The stump of the arch still projects from the wall 12 m north of the southwest
       corner. Beneath it the excavators found the Herodian street, a row of shops built
       into the vaults, and heaped on the paving the stones the Romans threw down in
       <span class="sc">AD</span> 70—including the corner block inscribed "to the place of trumpeting", from
       the parapet where a priest sounded the shofar to mark the Sabbath.</p>`,
    t:[['Span','≈ 13 m'],['North of the corner','12 m'],
       ['Height above the street','≈ 17 m at the springing']],
    s:'B. Mazar 1968–78; Josephus, War 4.582 (the trumpeting place); Ant. 15.410.'
  },

  wilson:{
    n:"Wilson's Arch and the Causeway", k:'The bridge from the Upper City',
    d:`The last arch of a viaduct that carried a road—and an aqueduct—straight across
       the Tyropoeon valley from the Upper City to a gate level with the esplanade. The
       route connected the western hill, where priestly aristocratic residences have
       been identified, with the Temple Mount.
       <p>The arch itself, about 13 m across, still stands, buried under later building
       and now enclosed within the Western Wall tunnels.</p>`,
    t:[['Span','≈ 13 m'],['Carried','a street and an aqueduct']],
    s:'Warren 1867–70; Josephus, War 2.344, 6.325 (the bridge).'
  },

  southSteps:{
    n:'The Southern Steps', k:'The southern public approach',
    d:`The broad southern approach is generally identified as a principal public route
       to the Temple Mount. Thirty steps climbed from the plaza south of the Mount to
       the Double Gate. Mazar excavated a <b>65.5 m stretch</b> centered on that gate and
       found alternating deep and shallow treads. Evidence farther east indicates that
       the monumental approach continued toward the Triple Gate.
       <p>Below the steps, ritual baths were cut in the rock in numbers, where pilgrims
       immersed before going up. Through the Double Gate a domed passage ran north
       beneath the Royal Stoa and rose by stairs to the esplanade.</p>`,
    t:[['Excavated stretch','65.5 m (215 ft)'],['Steps','30, alternating treads'],
       ['Rise per step','0.18–0.25 m'],['Tread','0.30–0.89 m']],
    s:'B. Mazar, excavations 1968–78; Mishnah Middot 1:3 (the Huldah gates).'
  },

  huldah:{
    n:'The Double Gate', k:'One of the Huldah passages',
    d:`A twin-arched gate in the southern wall opening on a vaulted passage that ran
       north under the Royal Stoa and up into the esplanade. Two of its four domed bays
       survive behind later blocking, carved with vine and rosette ornament of the
       Herodian period. They are among the surviving examples of Herodian architectural ornament
       anywhere on the Mount.
       <p>The Mishnah calls the southern gates the gates of Huldah. The eastern opening,
       now called the <b>Triple Gate</b>, may have served priests and Temple stores. The
       excavated monumental staircase is centered on the Double Gate and does not extend
       to the Triple Gate. The Triple Gate's exact approach is not preserved; a ramp is
       one possibility if the entrance accommodated carts or animals.</p>
       <p><b>A great immersion pool stood directly in front of the Triple Gate</b>, in
       the narrow paved plaza before it, and immediately beside it three rock-cut
       vaulted rooms carried the monumental approach to the gate. Baruch and Reich
       excavated both. These remains place purification facilities directly within the
       monumental approach.</p>`,
    t:[['Double Gate','≈ 12.6 m wide'],['Triple Gate','≈ 15.4 m wide'],
       ['Passages','vaulted, rising north under the Royal Stoa']],
    s:'Warren 1867–70; B. Mazar 1968–78. The Triple Gate plaza: Y. Baruch and R. Reich, “Excavations at the Triple Gate of the Temple Mount, Jerusalem”, ‘Atiqot 85 (2016) 37–95.'
  },

  shushan:{
    n:'The Shushan Gate', k:'The eastern gate of the platform',
    d:`Middot places the Shushan Gate in the eastern wall. In Ritmeyer's proposed
       500-cubit layout, its position aligns closely with the axis of the Sanctuary.
       From the top of the Mount of Olives the high priest
       could look straight through it to the door of the Sanctuary, and the red heifer was
       burned on the Mount opposite, in view of it.
       <p>The ancient Shushan Gate is often located near or beneath the present blocked
       Golden Gate, but its exact position is uncertain.</p>`,
    t:[['Location','eastern wall'],
       ['Alignment','on the Sanctuary axis in Ritmeyer’s reconstruction']],
    s:'Mishnah Middot 1:3; Parah 3:6; Middot 2:4; Fleming 1969 (the arch beneath the Golden Gate).'
  },

  street:{
    n:'The Herodian Street', k:'The Tyropoeon valley pavement',
    d:`A paved street 10 m wide ran the length of the western wall along the floor of the
       valley, with a stepped drain beneath it and a row of shops let into the vaults that
       carried Robinson's Arch. It was a major commercial frontage.
       <p>Excavated sections preserve the destruction debris of
       <span class="sc">AD</span> 70.</p>`,
    s:'B. Mazar 1968–78; Reich & Billig.'
  },

  struthion:{
    n:'The Struthion Pool', k:'Reservoir and moat · Herodian',
    d:`A rock-cut reservoir 52 m by 14 m off the northwest corner of the
       Antonia. It collected water for use through the dry season and may also have
       served as a defensive moat on the fortress's northern side.
       <p>Josephus names it. When Titus attacked the Antonia in <span class="sc">AD</span> 70 the Fifth
       Legion raised its siege bank "over against the middle of that pool which
       was called Struthius"—the sparrow pool. It is still there, vaulted over,
       beneath the convent of the Sisters of Zion.</p>`,
    t:[['Size','52 × 14 m'],['Depth','4.5 m north to 6 m south'],
       ['Date','Herodian, with the Antonia']],
    s:'Josephus, War 5.467; excavations beneath the Sisters of Zion.'
  },

  poolIsrael:{
    n:'The Pool of Israel', k:'Reservoir · date disputed',
    d:`A reservoir against the northern wall at its eastern end,
       109.7 m long, 38.4 m broad and 26 m deep, its sides lined with masonry
       and a dam 13.7 m thick closing the eastern end. It was filled in in 1934.
       <p><b>Its date is disputed.</b> Proposed dates include the Herodian period,
       approximately <span class="sc">AD</span> 130 under Hadrian, and the Umayyad period. Warren compared
       its masonry with later Roman work in Syria and noted that Josephus does not
       mention it. Shimon Gibson has argued for an Umayyad date. The first explicit
       written reference is from the tenth century.</p>`,
    t:[['Size','109.7 × 38.4 m'],['Depth','up to 26 m'],
       ['Date','disputed: Herodian, c. <span class="sc">AD</span> 130, or Umayyad'],
       ['Filled in','1934']],
    s:'Warren, Survey of Western Palestine; Gibson; al-Muqaddasi (10th c.). '+
      'Not mentioned by Josephus.'
  },

  causeway:{
    n:'The causeway to the Mount of Olives', k:'Arches above arches',
    d:`A viaduct running east from the Shushan Gate across the Kidron to the
       Mount of Olives.
       <p>Mishnah Parah describes its construction:
       <em>"a causeway was made from the Temple Mount to the Mount of Olives,
       arches above arches, each arch directly above a pier, as a protection
       against a grave in the depths."</em> A solid embankment might have passed
       over an unmarked burial and conveyed corpse-impurity upward through the
       fill. Placing each upper arch over a pier maintained open space beneath the
       roadway.</p>
       <p>It is the road the red heifer took. The priest who burned it, the
       heifer, and everyone assisting went out this way to the Mount of Olives,
       where the ash was prepared that purified anyone defiled by the dead.</p>`,
    t:[['Construction','two tiers, arch over pier'],
       ['Purpose','to carry no impurity from below'],
       ['Used for','the rite of the red heifer']],
    s:'Mishnah Parah 3:6; Middot 1:3; Numbers 19.'
  },

  kidron:{
    n:'The Kidron Valley', k:'The eastern ravine',
    d:`The valley between the Temple Mount and the Mount of Olives creates the steep
       eastern approach. Josephus says of the southeastern angle
       that its height was such that anyone looking down from the roof above it would
       grow dizzy before his sight reached the bottom.
       <p>Blood and ash from the altar were sluiced down into this valley. The road to
       Bethany and Gethsemane crosses it.</p>`,
    s:'Josephus, Ant. 15.412; War 5.185. 2 Samuel 15:23; John 18:1.'
  },
};

/* =====================================================================
 *  THE PASSAGE GUIDE
 *
 *  Where the New Testament's Temple scenes happened, so far as the text
 *  and the architecture between them allow. This replaces the pilgrim's
 *  tour: the tour was a route someone might have walked, which is a
 *  reasonable thing to show and not an evidenced one. These are places
 *  named or narrowed by a source.
 *
 *  `conf` is the whole point of the list and is never omitted:
 *    explicit—the text names the place
 *    probable—the architecture or a stated detail narrows it hard
 *    court—the text names only "the temple" or "the courts"
 *    disputed—serious alternatives exist, and the note says what they are
 *
 *  Josephus and Middot supply the architecture that turns a named place
 *  into a point in this model; where they cannot, the entry says so
 *  rather than inventing a spot.
 * ===================================================================== */
const PASSAGES = [
  { ref:'Luke 1:8–23', t:'Gabriel appears to Zechariah', place:'hekhal',
    conf:'explicit',
    d:'Zechariah is inside the Sanctuary at the incense altar, chosen by lot to burn incense; the people are praying outside and wonder at his delay.' },
  { ref:'Luke 2:22–38', t:'The presentation; Simeon and Anna', place:'women',
    conf:'probable',
    d:'Luke names only the Temple. Middot places rites associated with childbirth near the Nicanor Gate, beside the Court of the Women; the exact location is not stated.' },
  { ref:'Luke 2:41–50', t:'The boy Jesus among the teachers', place:'solomons',
    conf:'court',
    d:'Luke places the teachers in the Temple but does not identify a particular court or portico. A covered portico is a possible setting.' },
  { ref:'Matthew 4:5\u20137; Luke 4:9\u201313', t:'The pinnacle of the Temple',
    place:'royalStoa', conf:'disputed',
    /* FROM THE ROOF OF THE ROYAL STOA, looking west-southwest ALONG the
       southern side. Straight down the angle the valley floor read as flat
       ground with nothing to measure it against; looking up from the Kidron put
       the height in frame but not the vertigo. Along the roof it is both: the
       ridge running away under you, the platform and the plaza far below on one
       hand, and the hill falling away on the other. */
    cam:{ section:false, mode:'orbit', target:{W:[100,0,500]}, dist:177,
          azimuth:87, pitch:0.228, fov:62 },
    d:'The Gospels identify only \u201cthe pinnacle of the temple.\u201d The Greek term can mean a small wing or projecting point. The southeastern corner has been proposed because Josephus describes the depth below the Royal Stoa there; the roof of the Sanctuary is another proposed location.' },
  { ref:'Mark 11:11', t:'He looked round at everything', place:'gentiles',
    /* the one passage here that wants the whole circuit rather than a place in
       it: he looked round at everything, then went out */
    cam:{ section:false, mode:'orbit', target:{W:[170,6,250]}, dist:330,
          azimuth:128, pitch:0.42, fov:58 },
    conf:'court',
    d:'Jesus enters, looks round the whole precinct, and leaves for Bethany because the hour is late. The great outer court is all the text gives.' },
  { ref:'Matthew 21:12–17; Mark 11:15–19; Luke 19:45–48; John 2:13–22',
    t:'Jesus clears the Temple', place:'royalStoa', conf:'court',
    d:'The accounts place sellers and money changers in the Temple courts. The Royal Stoa is one proposed location, but no account identifies a specific court or portico.' },
  { ref:'Matthew 21:14–16', t:'The blind and the lame; the children shout',
    place:'gentiles', conf:'court',
    d:'Matthew places the scene in the Temple. The outer court was the area open to the broadest range of visitors.' },
  { ref:'Matthew 21:23–23:39; Mark 11:27–12:40; Luke 20:1–47',
    t:'The debates with the priests and scribes', place:'solomons', conf:'court',
    d:'The accounts place these public exchanges in the Temple courts without identifying a particular location. A covered portico is a possible setting.' },
  { ref:'Mark 12:41–44; Luke 21:1–4', t:'The widow\u2019s two coins', place:'women',
    /* he sat opposite the treasury and watched: the thirteen chests, not the
       court in general */
    cam:{ section:false, mode:'stand', pos:{W:[201.1,0,242.2]},
          lookAt:{W:[200.2,4.4,253.7]}, fov:58 },
    conf:'probable',
    d:'Jesus sits opposite the treasury and watches the crowd putting money in. Middot 2:5 locates thirteen trumpet-shaped offering chests in the Court of the Women.' },
  { ref:'John 7:14–52', t:'Teaching at the Feast of Tabernacles', place:'gentiles',
    conf:'court',
    d:'He goes up in the middle of the festival and teaches in the courts. The water-drawing and the lamps of that feast were in the Court of the Women, but the teaching is not placed.' },
  { ref:'John 8:2–11', t:'The woman caught in adultery', place:'gentiles',
    conf:'court',
    d:'At dawn, in the temple courts, with all the people gathered round him. The passage is itself textually disputed and is absent from the earliest manuscripts.' },
  { ref:'John 8:12–20', t:'\u201cI am the light of the world\u201d', place:'women',
    conf:'explicit',
    d:'John locates these words in the treasury. The Court of the Women contained the offering chests and the large lamps used during the Feast of Tabernacles.' },
  { ref:'John 10:22–39', t:'At the Feast of Dedication', place:'solomons',
    conf:'explicit',
    d:'John states that it was winter and that Jesus was walking in Solomon\u2019s Porch.' },
  { ref:'Matthew 27:51; Mark 15:38; Luke 23:45', t:'The curtain is torn in two',
    place:'debir', conf:'disputed',
    d:'The accounts do not identify which curtain was torn. Josephus describes a veil before the Hekhal doors, while rabbinic sources describe curtains before the Holy of Holies. Interpretations differ.' },
  { ref:'Luke 24:52–53', t:'The disciples in the Temple, blessing God',
    place:'gentiles', conf:'court',
    d:'They were continually in the Temple. Nothing narrows it further.' },
  { ref:'Acts 2:1–41', t:'Pentecost', place:'southSteps', conf:'disputed',
    d:'An upper room is a traditional possibility. The southern steps have also been proposed because they provided a large public space near ritual baths, but Acts does not locate the event on the Temple Mount.' },
  { ref:'Acts 2:46', t:'Breaking bread daily in the Temple', place:'solomons',
    conf:'court',
    d:'Acts says they met daily in the Temple courts. It names Solomon\u2019s Porch as a gathering place elsewhere, but this verse does not specify a portico.' },
  { ref:'Acts 3:1–10', t:'Peter heals the man unable to walk', place:'nicanor',
    conf:'disputed',
    d:'Acts names the Beautiful Gate but does not identify it further. Proposed locations include the Nicanor Gate and outer entrances such as the Double Gate.' },
  { ref:'Acts 3:11–4:3', t:'Peter speaks after the healing', place:'solomons',
    conf:'explicit',
    d:'The people run together to them \u201cin the porch that is called Solomon\u2019s\u201d, and the priests and the captain of the temple come upon them there.' },
  { ref:'Acts 5:12–16', t:'The apostles\u2019 signs; all together in the porch',
    place:'solomons', conf:'explicit',
    d:'Acts places the group in Solomon\u2019s Porch and describes the sick being brought into the surrounding streets.' },
  { ref:'Acts 5:19–25, 42', t:'Teaching again after the prison door opened',
    place:'gentiles', conf:'court',
    d:'Told to go and stand in the Temple and speak; found at daybreak teaching in the courts.' },
  { ref:'Acts 22:17–21', t:'Paul\u2019s vision while praying', place:'gentiles',
    conf:'court',
    d:'Paul, recounting his own story, says it happened while he prayed in the Temple and fell into a trance. He does not say where in it.' },
  { ref:'Acts 21:26–36', t:'Paul\u2019s purification and arrest', place:'soreg',
    conf:'probable',
    d:'Paul is accused of bringing a Greek into the restricted area. The account says he was seized in the Temple, dragged out, and the gates were shut behind him; the exact points within the precinct are not identified.' },
  { ref:'Acts 21:37–22:22', t:'Paul speaks from the Antonia stairs',
    place:'antonia', conf:'explicit',
    d:'Acts places Paul on steps leading to the barracks at the Antonia. Josephus records passages from the fortress to the northern and western porticoes, but the precise staircase is not preserved.' },
];


/* =====================================================================
 *  VIEWPOINTS
 *  Anchors are given either in world meters—{W:[x,y,z]}—or, better,
 *  in the precinct's own cubits—{L:[eastCubits, southCubits, yMeters]}.
 *  Local anchors are resolved through the same transform the geometry
 *  uses, so a camera aimed at "cubit 173 on the axis" is aimed at the
 *  porch doorway however the layout constants are afterwards adjusted.
 *  `azimuth` is the compass bearing from the subject out to the camera:
 *  90 stands due east of it, 180 due south.
 * ===================================================================== */

/* ---- named viewpoints on the dock ---- */
const VIEWS = {
  aerial:{ section:false, mode:'orbit', target:{W:[150,10,245]}, dist:740, azimuth:130, pitch:0.62, fov:50 },
  south :{ section:false, mode:'orbit', target:{W:[84,-10,506]}, dist:96, azimuth:174,
           pitch:0.38, fov:60 },
  royal :{ section:false, mode:'stand',  pos:{W:[132,0,464]}, lookAt:{W:[272,9,469]}, fov:72 },
  court :{ section:false, mode:'stand',  pos:{L:[424,288,0]},
           lookAt:{L:[196,182,38]}, fov:66 },
  altar :{ section:false, mode:'orbit', target:{L:[211,AXIS_Z,10]}, dist:62, azimuth:58, pitch:0.50, fov:56 },
  holy  :{ section:true, mode:'orbit', target:{L:[115,AXIS_Z,17]}, dist:80, azimuth:174,
           pitch:0.40, fov:54 },
};

/* ------------------------------------------------------------------ *
 *  WHERE THE PASSAGE GUIDE PUTS YOU
 *
 *  Left to itself the guide orbited the clicked part's bounding box at
 *  1.75 times its longest side. For a compact thing—the altar, the Nicanor
 *  Gate—that is about right. For a long thin one it is useless: Solomon's
 *  Porch is 463 m end to end, so six of these passages flew you 800 m into the
 *  air to look at a hairline down the eastern side, and the Court of the
 *  Gentiles is worse. A porch is a place you stand IN.
 *
 *  So each place gets a viewpoint of its own, and a passage may override it
 *  where the text wants somewhere more particular. `mode:'stand'` takes its eye
 *  height from the floor under `pos`, so only x and z matter there.
 * ------------------------------------------------------------------ */
const PLACE_VIEWS = {
  /* INSIDE Solomon's Porch, looking south along it, set a little toward the
     outer row so the court and the Sanctuary show between the columns. */
  solomons: { section:false, mode:'stand', pos:{W:[290.1,0,212.6]},
              lookAt:{W:[286.6,7.5,329.4]}, fov:70 },
  /* standing in the outer court, the Sanctuary across it */
  gentiles: { section:false, mode:'stand', pos:{W:[186.8,0,321.2]},
              lookAt:{W:[104,26,227]}, fov:70 },
  /* down the nave of the Royal Stoa, where the tables stood */
  royalStoa: VIEWS.royal,
  /* in the Court of the Women, the Nicanor Gate ahead */
  women:    { section:false, mode:'stand', pos:{W:[220.5,0,235.5]},
              lookAt:{W:[166.6,13,231.5]}, fov:66 },
  /* close under the Nicanor Gate, from the step below it */
  nicanor:  { section:false, mode:'stand', pos:{W:[204.3,0,234.3]},
              lookAt:{W:[166.6,11,231.5]}, fov:62 },
  /* at the soreg on the east, the screen running away and the courts beyond */
  soreg:    { section:false, mode:'stand', pos:{W:[264.2,0,220.8]},
              lookAt:{W:[246.7,3.0,258.5]}, fov:66 },
  /* on the plaza at the foot of the southern staircase, looking up it */
  southSteps:{ section:false, mode:'stand', pos:{W:[84,0,540]},
               lookAt:{W:[84,13,489]}, fov:66 },
  /* PAUL'S OWN VIEW, from the head of the great stair—sixteen and a half
     meters up on the landing, the whole outer court in front of him and the
     Sanctuary off to the right. What he beckoned to. The crowd's view of the
     same stair is the passage note's business; this is the one worth standing
     in. `mode:'stand'` takes the eye height off the landing itself. */
  antonia:  { section:false, mode:'stand', pos:{W:[52.5,0,12.6]},
              lookAt:{W:[124,15,176]}, fov:70 },
  /* Into the Holy Place, at the altar of incense. The pitch has to clear the
     courts' walls: only the `sanct` layer is cut by the section plane, so a low
     angle from the south is blocked by the Azarah's masonry and its chambers,
     and you end up looking at the inside of a wall. */
  hekhal:   { section:true, mode:'orbit', target:{L:[115,AXIS_Z,16]}, dist:62,
              azimuth:174, pitch:0.38, fov:54 },
  /* on the veil, with the house opened up */
  debir:    { section:true, mode:'orbit', target:{L:[104,AXIS_Z,16]}, dist:56,
              azimuth:174, pitch:0.36, fov:52 },
};

/* ---- the structure index in the side panel ---- */
const PLAN_GROUPS = [
  { h:'The platform', items:[
    ['platform','The retaining walls'],['square','The 500-cubit square'],
    ['gentiles','Court of the Gentiles'],['solomons',"Solomon's Porch"],
    ['royalStoa','The Royal Stoa'],['antonia','The Antonia'] ]},
  { h:'Ways in', items:[
    ['southSteps','The southern steps'],['huldah','The Double Gate'],
    ['robinson',"Robinson's Arch"],['wilson',"Wilson's Arch"],
    ['shushan','The Shushan Gate'],['street','The Herodian street'] ]},
  { h:'The sacred precinct', items:[
    ['soreg','The Soreg'],['chel','The Chel'],['women','Court of the Women'],
    ['nicanor','The Nicanor Gate'],['israel','Court of Israel'],
    ['altar','The Altar'] ]},
  { h:'The Sanctuary', items:[
    ['sanctuary','The Sanctuary'],['porch','The Porch & golden vine'],
    ['hekhal','The Holy Place'],['debir','The Holy of Holies'] ]},
  { h:'Water', items:[
    ['struthion','The Struthion Pool'],['poolIsrael','The Pool of Israel'] ]},
  { h:'Setting', items:[
    ['causeway','The causeway to Olivet'],['kidron','The Kidron Valley'] ]},
];

/* ---- the Sources tab ---- */
const SOURCES_HTML = `
<h2 class="sec">What this is built from</h2>
<p>The reconstruction draws primarily on three bodies of evidence. Each component card
names its sources, and the principal choices and uncertainties are summarized below.</p>
<p class="about-links"><a href="https://www.openbible.info/blog/2026/07/clauding-an-interactive-3d-model-of-herods-temple/" target="_blank">Blog post</a> · <a href="https://github.com/openbibleinfo/3D-Temple-Mount/" target="_blank">GitHub</a></p>

<div class="rule"></div>
<h2 class="sec">1 · Mishnah, tractate Middot</h2>
<p>A room-by-room description of the Temple, redacted about <span class="sc">AD</span> 200 and containing
traditions attributed to figures including Rabbi Eliezer ben Jacob and Abba Shaul. It
provides the principal systematic set of dimensions for the courts, levels, altar, and
Sanctuary.</p>
<p>Its limitations include its date, its partly idealized presentation, and its
description of the Mount as a 500-cubit square within the larger Herodian platform.</p>
<span class="cite">Middot 1:1–5:4. Text: Sefaria; trans. after Danby.</span>

<div class="rule"></div>
<h2 class="sec">2 · Josephus</h2>
<p>Josephus was a first-century eyewitness and priest. <i>Jewish War</i> 5.184–247
describes the complex; <i>Antiquities</i> 15.380–425 describes Herod's rebuilding. He is
the principal literary source for the outer porticoes, the Royal Stoa, and the Antonia.</p>
<p>His descriptions also serve rhetorical purposes, and some of his dimensions for the
Sanctuary and altar are larger than those in Middot. Both sets appear in the relevant
component cards.</p>
<span class="cite">War 5.184–247; Antiquities 15.380–425; 20.219–221.</span>

<div class="rule"></div>
<h2 class="sec">3 · The excavations</h2>
<p>Charles Warren's shafts and tunnels of 1867–70 mapped buried walls and the arches
named after him and Wilson. Benjamin Mazar's ten seasons
south and west of the Mount (1968–78) uncovered the Herodian street, the shops, the
collapse of <span class="sc">AD</span> 70, Robinson's Arch, the southern staircase and the Huldah gates. Later
work by Ben-Dov, and Reich and Billig, continued it.</p>
<p>Leen Ritmeyer, who worked as an architectural draftsman on Mazar's excavation,
published a reconstruction based on surviving masonry. This reconstruction follows his
proposal for the position and 4.2° alignment of a pre-Herodian 500-cubit square.</p>
<span class="cite">B. Mazar, <i>The Mountain of the Lord</i> (1975); Ritmeyer,
<i>The Quest</i> (2006).</span>

<div class="rule"></div>
<h2 class="sec">Reconstruction choices</h2>
<table class="dims">
  <tr><th>Question</th><th>Taken as</th></tr>
  <tr><td>Cubit</td><td>52.5 cm</td></tr>
  <tr><td>Altar</td><td>Middot, 32 c²</td></tr>
  <tr><td>Sanctuary body</td><td>Middot, 70 c</td></tr>
  <tr><td>Porch opening</td><td>Middot, 40 × 20 c</td></tr>
  <tr><td>Outer veil hangs</td><td>at the Hekhal doors</td></tr>
  <tr><td>Ascent to the courts</td><td>Middot, 12 steps</td></tr>
  <tr><td>Soreg height</td><td>Middot, 10 handbreadths</td></tr>
  <tr><td>Royal Stoa bay</td><td>estimated from Josephus's column count, 6.6 m</td></tr>
</table>

<div class="rule"></div>
<h2 class="sec">Uncertainties</h2>
<p><b>Location of the Sanctuary.</b> This reconstruction follows Ritmeyer's proposal that
the Holy of Holies stood over es-Sakhra, the rock beneath the Dome of the Rock. Other
proposals include:</p>
<ul>
  <li><b>Kaufman's northern siting</b>—about 100 m north of the Dome, near the small
      Dome of the Spirits.</li>
  <li><b>Sagiv's southern siting</b>—south of the Dome, toward al-Aqsa, argued from
      subsurface survey.</li>
</ul>
<p><b>Column spacing in the Royal Stoa.</b> Josephus gives 162 columns in four rows but
no interval. The spacing is estimated by distributing them along the reconstructed
length of the hall; shorter reconstructions produce narrower bays.</p>
<p><b>The Pool of Israel.</b> Proposed dates include the Herodian, Hadrianic, and Umayyad
periods. Josephus does not mention it. He does name the Struthion Pool.</p>
<p><b>The four columns on the Sanctuary front.</b> Josephus says pillars flanked the
gate but not how many. Four are supported by post-destruction depictions on Bar Kokhba
coins and synagogue reliefs.</p>
<p><b>The ramp to the Triple Gate</b> and the corner bays where two colonnades meet are
conjectural because their exact forms are not preserved.</p>
<p><b>Decorative details.</b> Capitals, moldings, coffering, paving patterns, and the form
of the golden vine draw on comparable Herodian material at Masada, Herodium, the Cave
of Machpelah, and fragments recovered by the Temple Mount Sifting Project. They are not
preserved <i>in situ</i> on the Mount.</p>
<p><b>The surrounding city.</b> The terrain includes the Kidron, Tyropoeon, western hill,
Ophel, and Mount of Olives. Buildings are omitted because the evidence does not support
a comparably detailed reconstruction. Excavated features outside the walls include the
Herodian street, its shops, and the causeway.</p>

<div class="rule"></div>
<h2 class="sec">Date</h2>
<p>The model is set about <b><span class="sc">AD</span> 30</b>. Building had been under way since 19 <span class="sc">BC</span> and was
not finished until <span class="sc">AD</span> 63—"forty and six years" of it already done when John's Gospel
records the remark. Seven years after completion the Romans burned it, on the ninth of
Ab, <span class="sc">AD</span> 70. The Temple buildings and porticoes were destroyed; substantial
retaining walls and buried structures survived.</p>
<span class="cite">John 2:20; Josephus, Ant. 20.219; War 6.249–266.</span>
`;
