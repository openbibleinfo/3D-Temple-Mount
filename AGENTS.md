# AGENTS.md—technical notes for working on this model

`README.md` says what this is and what it is built from. This file is what you need in order to **change** it without breaking it.

---

## 1. The build

Nine files in `src/` are **concatenated by `build.sh` into a single `<script>`** and a single `<style>`. There are no modules, no bundler, no imports.

Order is fixed by the `JS=` list in `build.sh`: `10-math` → `20-textures` → `30-geom` → `40-data` → `50-build-mount` → `55-build-temple` → `60-gl` → `70-app`.

Consequences:

- **One shared global scope.** Every top-level `const`/`function` is visible to every later file, and names must not collide. `40-data.js` cannot use anything from `50-*`; `50-*` may use everything from `40-*`.
- **Never edit `index.html`.** It is generated. Edit `src/`, then run `./build.sh`.
- No `import`/`export`, no top-level `await`.
- Keep the sources plain ASCII-safe text. A NUL byte makes the built file "binary" to `grep`, which then silently reports zero matches.

`build.sh` runs `node --check` on every JS file, so a syntax error fails the build rather than shipping.

## 2. Two coordinate frames

**World.** Meters. `+X` east, `+Y` up, `+Z` south. `y = 0` is the esplanade, which is really about 740 m above sea level. The platform is the irregular quadrilateral `PLAT.NW/NE/SE/SW`; `PLAT_RING` is wound so that "inside" is to the right of every edge, which `outsidePlatform()` relies on.

**Precinct-local.** The sacred enclosure is set out on the pre-Herodian 500-cubit square, which is parallel to the *eastern* wall and therefore skewed **4.223°** (`PRECINCT_ROT`) from everything Herodian. Origin `SQ_NW`, local `+X` east, `+Z` south, distances written `cu(<cubits>)` so every number can be checked against Middot.

```js
inPrecinct(B, () => { /* build in local meters, cu() from cubits */ });
precinctToWorld(xCubits, zCubits) -> [worldX, worldZ]
```

Anything inside the soreg must be built inside `inPrecinct` and expressed in cubits. Hardcoded world meters there will be 4° out.

## 2a. The address bar

`viewQuery()` in `70-app.js` stringifies the whole view—camera, fov, hour, the rail's open page, the passage or structure it is on, and every switch—and `stepURL()` writes it with `replaceState`. **It is debounced, not per-frame:** the string is built at most every 150 ms and written only once it has stopped changing for 400, so a drag or a flight writes exactly once, when it lands. The string is its own change detector, so nothing else has to remember to mark the URL dirty. Nothing is written until the boot flight settles, so arriving and touching nothing leaves the bar clean.

Inflating is an **order**, not a list, and `boot()` follows it: interface and tab, then the place (`passage` / `go` / `view`), then the switches over the top of it—because `goToKey` turns layers on for where it is going and a shared link has to be able to say otherwise—then the camera last. `?view=`, `?plain=1`, `?ui=none` and `?t=` are still accepted; they are never emitted.

Gestures are **one** handler with a map of live pointers, and the count decides: one is a drag, two are pinch-plus-pan. Two handler pairs on the same canvas is what made a pinch throw the view most of a right angle—the second finger's `pointerdown` overwrote the drag's anchor, and the first finger's next move read as a drag of the whole distance between them.

## 3. Layers and the section plane

Every primitive carries a layer. `App.layerOn()` decides visibility; `Renderer.render()` decides clipping.

| layer | shown when | cut by the section plane |
|---|---|---|
| `base` | always | no |
| `roofs` | roofs toggle | no |
| `people` | figures toggle | no |
| `city` | terrain toggle | no |
| `sanct` | always | **yes** |
| `interior` | only when sectioned | no |
| `overlay` | 500-cubit square toggle | no |
| `grid` | cubit grid toggle | no |
| `nodraw` | never drawn |—|

The `sanct` / `interior` split is deliberate:

- **`sanct` is the fabric of the Sanctuary**—shell, floors, ceilings, paneling, veils, the facade columns. Enclosed by the shell, so invisible from outside anyway; the section plane cuts it, which is what opens the building up.
- **`interior` is the furniture**—menorah, table of the Presence, incense altar, their flames. Never cut, or the menorah (which stood on the *south*) would be sliced away with the wall it stands against. Hidden unless sectioned.

`nodraw` gives a part a pickable volume with no geometry—the Kidron Valley is a label and a panel over a terrain sheet.

The clip plane is vertical, through the Temple's axis, normal `V_SOUTH`; fragments south of it are discarded. Set up in `setSection()`.

## 4. Invariants

These are the rules the model depends on. Breaking one produces a specific, recognizable defect.

**Winding decides back-face culling—not the normal you pass.** `quad`/`tri` take an explicit shading normal, which keeps the lighting correct and therefore *hides* the mistake: the surface still shades plausibly, it is just the wrong side being drawn. In this right-handed frame with **+Z south**, intuition from +Z-north work is inverted, so derive it rather than guess:

```
cross(b - a, c - a) · (direction the face should point)  >  0
```

`poly()` reverses its ring for this reason (a `+X`-then-`+Z` ring yields a *downward* normal); `cyl()` reverses its side quads and both caps; `ringStairs()` emits treads tangential-then-radial.

**A primitive that takes an `axis` needs the winding flipped for one of them.** `arch()` and `archSpandrel()` both walk their angles in increasing order, and their sweep parameter runs along `+x` for `axis:'x'` but along `+z` for `axis:'z'`—which reverses the sense of the identical vertex ordering. `archSpandrel` derives it; `arch` did not, so for four years every arch on the x axis—both causeways, Robinson's great arch, the Huldah vaults—was built **inside out**. It drew its far face where the near face should be, showed the extrados when you looked up into the barrel and the intrados when you looked at it from outside, and lit the soffit like a surface facing the sky. **This is what a "paper arch" is**, and it hides almost perfectly head-on: an annulus is an annulus from either side and a barrel still reads as a barrel, so a shot taken square on to a bay looks mended. Judge an arch from an oblique camera or you are not judging it at all. Two arcades' worth of spandrels were built chasing the symptom.

**The near plane is a multiplier on every surface in the scene.** Depth resolution at distance `z` goes as `z²/(near · 2^bits)`. A desktop gives 24 bits, an iPad gives **16**—a factor of 256—so a pair of faces 200 m out resolves to 25 mm on one and 2.2 m on the other, and every stacked surface in the model is inside 2.2 m of its neighbor. That is the whole of "it flickers on the iPad". The app scales `near` by the orbit radius and by `R.depthBits`; **and by how far the eye is off the ground beneath it, which is the part that is not about precision at all**—a fortieth of the orbit radius is 3.5 m for a viewpoint standing on the pavement with its pivot a hundred meters down a colonnade, and that cuts the floor away at your feet. The eye's own headroom is the nearest surface it can have; `near` takes a fifth of it or a fortieth of the radius, whichever is smaller, so up in the air the old rule is what applies. **Judge z-fighting reports against `near`, not against the geometry, before going looking for coincident faces.** Real coincidences still have to be fixed—see the Huldah reveal, and the Court of the Women, whose corner courts used to lay their paving 6 cm over the court's own floor instead of the court's floor being cut round them.

**And where 16 bits is what the browser gives, the scene is drawn somewhere else.** A one-pixel context is made at startup and asked for `DEPTH_BITS`; what it answers decides how the real one is built. Deep buffer—nothing changes, no allocation, no blit. Shallow—the default framebuffer's own multisampling is turned **off** and the scene goes into a renderbuffer pair of our own, which *can* be asked for `DEPTH_COMPONENT24` and which multisamples itself, so the antialiasing moves rather than being lost and its memory is paid once instead of twice. Resolved to the page with `blitFramebuffer` at the end of `render`. `R.depthBits` then reports what the scene is **actually drawn into**, so the near plane relaxes to the desktop rule by itself. If the driver refuses the combination the whole thing is dropped and `depthBits` tells the truth again—a black screen is worse than a flicker.

**Two surfaces that INTERSECT cannot be fixed by precision.** The hillside ran straight through the Pool of Israel a meter under the rim; where two nearly parallel planes cross, the seam is a band, not a line. `groundLevel` now carves each reservoir's footprint out of `rawGround`. The carve is lazy, because it reads constants declared further down the file, and it stops short of the coping because the rim is derived from the ground the coping stands on.

**Textures upload as `SRGB8_ALPHA8`.** The canvases are authored in sRGB and the lighting math is linear. Sampling them as linear lifts every midtone and flattens the image.

**The shadow lookup needs `*0.5+0.5`.** Light-space clip space is `[-1,1]`; the depth texture is `[0,1]`.

**Shadow bias is stated in meters** and divided by `uDepthRange`, and the light frustum is fitted to the shadow radius. A bias in normalized depth over a fixed frustum becomes meters of world offset and detaches every contact shadow.

**Tone mapping is extended Reinhard, white point 2.4.** ACES crushes the shadows about two stops too hard here, and the interiors are lit only by the ambient's ground-bounce term, so they have no headroom to lose.

**Give a building one pair of end faces and clamp everything to them.** Several slightly different extents—`run+2`, `run+3`, `to+1`—will not all fall inside the end walls, and the surplus cantilevers into the air. The Royal Stoa computes `xE`/`xW` once; every element spans exactly between them.

**`gableRoof` has separate `overhang` (eaves) and `overhangEnd` (gable ends).** One value for both pushes the ends past the end walls. It also emits a soffit and eaves fascia—without an underside a roof is two single-sided planes and you see through it from below.

**Anything riding on an arcade derives its supports from its own line.** Robinson's arch springings are computed from the step line minus the ring's rise; interpolating the two separately gives them different gradients and the steps pass through the arches. Where a ring would fall below the paving the bay is built solid.

**And it has to clear the EXTRADOS, not the intrados.** The rise a deck must allow for is `span/2 + thick`, plus whatever its own soffit hangs below its walking line. Robinson's landing sat a meter under the intrados crown, which is two and a half meters under the extrados where the ring leaves the pier, so the flight began inside the arch that carries it; `landTop` is now solved for by walking the flight and taking the highest start any station demands. The causeway rings still rise through their roadway slabs, which is why those slabs are the **full width of the arcade**—one `W`, used by ring, spandrel, piers, embankment and deck. A slab narrower than its arcade leaves a strip of ring standing outside it.

**Everything outside the courts is set out from the wall's FACE, not from `CT`.** `CT` is the center line, and the courts' wall is six cubits thick, so a flight measured from `CT` buries its top half in the masonry: the twelve steps of the Chel arrived at the face only half-way up, and every one of the eleven gates opened a cubit and a half above the last tread anyone could stand on. `CT_FACE` is the half-thickness; the steps, the Chel terrace, the Soreg and `groundHeightAt`'s model of all three are measured from it. **If you add anything outside the courts and it looks a step too low, this is why.**

**A stepped terrace round a rectangle is built as rings, not as four flights.** Four flights each made wide enough to reach the corners run *through* each other where they meet—two sets of treads at different heights crossing at right angles, which showed as a little staircase to nowhere at all four corners of the Chel. Concentric rings mitre. Each ring reaches back over the one below, as `stairs` does, or the risers show gaps.

**Anything built against the courts' wall stands behind its inner face.** The Chamber of the Hearth, set out from the center line, reached three cubits into the wall and filled the upper half of the middle northern gateway with blind masonry—which is why one door of the three had stonework over it that the others did not, and the doors behind it were only half visible. Middot 1:5 names that gate the Gate of the Chamber of the Hearth, so the chamber does belong there; it belongs *behind* it.

**A colonnade steps round an opening; it does not stand in it.** The Court of the Women's gallery runs the length of the court and its gates are in the middle of that length, so a column landed square in each doorway. Any regularly spaced run—columns, posts, pilasters, trumpet chests—needs the same test against whatever it passes.

**A gate that is a way THROUGH gets a gatehouse, and the porch steps round it.** The road from the Upper City crossed on Wilson's Arch and arrived level with the esplanade, so it is the western counterpart of the Shushan Gate and now has a gatehouse rather than a hole in the head wall—but **lintelled, not vaulted**. The one western gate whose head survives is Barclay's, a fifty-ton monolith, so the west side is lintelled; the arch over it is a relieving arch, because sixteen cubits of clear span is more than one stone should carry in bending. `full` on a gate cuts the head wall through to its head and leaves the gatehouse to dress its own opening, and `buildPortico` now drops any column that lands in a `full` gateway—one stood square in the middle of the Wilson's Arch road.

**The passage guide needs a viewpoint per place, not a bounding box.** `goToKey` orbits the clicked part at 1.75× its longest side, which is right for the altar and useless for anything long: Solomon's Porch is 463 m end to end, so six passages flew you 800 m up to look at a hairline down the eastern side. Each place has an entry in `PLACE_VIEWS`, and a passage may carry its own `cam` where the text wants somewhere more particular—the widow at the trumpet chests, Mark 11:11 wide because looking round at everything is the point. Two traps: a porch is a place you stand IN, so `mode:'stand'` and let the floor set the eye height; and a sectioned view of the Sanctuary needs enough PITCH to clear the courts' walls, because only the `sanct` layer is cut, so a low angle from the south puts you inside the Azarah's masonry looking at the back of it.

**A passage gets a camera, not a cage.** `gotoPassage` used to `select()` the place as well, which drew a wireframe box round it—round a 463 m porch, while you were standing inside it. The camera is the answer to where a passage happened. The plan index still boxes what you pick there, which is what a pick is for.

**Conveying a height means looking UP it.** The temptation's pinnacle went through three cameras before it read. Down from the parapet, the near field is the Stoa's own roof and the valley floor 45 m below reads as flat ground with nothing to measure it against. From out over the Kidron looking up, the whole thing is in one frame: wall out of the valley, clerestory on top of it, the Sanctuary's gold beyond.

**A rail belongs on the open side only.** The landing at the head of the great stair was railed on three, which fenced a man into a pen and shut the colonnade roof off from the stair that exists to reach it. Its north edge is the curtain and its east edge is the roof.

**A gatehouse and its jambs take the texture scale of the wall they are bonded into.** Given a scale of their own they put masonry three times finer immediately beside the wall, and the join reads as a change of material rather than of plane. It was worst around the inner gates, where the effect appeared to come and go from gate to gate depending on how much of each was in view.

**A short member needs `uStart`, or it shows the same fragment of the same stone.** At 1/9.6 a block is 2.4 m and a pilaster shaft is 1.6 m wide; started at u = 0, every shaft in the order showed the identical two-thirds of one block, cut off mid-stone at the same edge, and the whole applied order read as a row of broken pieces. Short members are inset into a single block; long ones—the architrave—take their position along the run so the coursing carries from bay to bay.

**A flight of stairs needs a landing wherever it turns or arrives.** Robinson's two flights meet at right angles on the pier; the Triple Gate's ramp arrives on a platform at the threshold. Without them the flights abut in mid-air and the gate opens onto nothing.

**Wall runs are carried half a thickness past corners**, and `wallOpen` caps its segment ends. Built exactly corner-to-corner with open ends, you see through the corner into the fill. This applies to the retaining walls, the court walls, the Court of the Women's chambers, and the porticoes (`capEnds`).

**The retaining walls' pilaster order sits above the esplanade**, at the height of the interior colonnade, so that from outside the two read at one level. Below it the wall is the plain massive ashlar the excavations show. Two things it needs to get right, and both were wrong before: the projection is a shallow applied order (Hebron's is a hand's breadth or two), because anything deeper reads as a free rib with a shadow down each side; and it steps round the gates, from `HEAD_OPENINGS`, or a shaft lands in the middle of an opening and stands in the gateway. `WALLS.head` is the thickness it is applied to—the back wall of the colonnade, not the retaining wall.

**A gate whose head is taller than the wall above the pavement cannot have anything sitting on it.** The Shushan Gate was given forty cubits of clear height in a wall that stands sixteen meters over the esplanade, so its arch, its lintel band and its cornice all floated. It is an arched gatehouse now: `h` is the height to the crown, it springs at `h - w/2`, and the whole thing is built inside a `full` opening—one that `wallOpen` cuts clean through to the head, which the gatehouse then fills, vault and all. A `full` gate has no `h` in `buildPortico`, so every piece of reveal furniture there must be skipped for it or the dimensions taken from `g.h` are NaN.

**An arcade is a wall with holes in it, and the spandrel is the wall.** Bare rings are a row of thin ribs with daylight over every haunch: however solid the ring, the arches read as cut paper because nothing above them is closed. Wilson's and the causeway's arcades both had this. `archSpandrel()` fills from the ring's outer edge up to whatever the arcade carries.

**A gate that leads straight through is not given the dark backdrop.** Head-wall gates get a `shadow` panel behind the reveal so a gate into a tunnel does not show the colonnade through it. Wilson's causeway arrives level with the pavement, so `through:true` skips it and you see out of the opening from either side, as at the Shushan Gate.

**Anything carried on fill is built in segments, each reaching the ground under it.** One box from a single sampled height hangs in the air wherever the ground falls away from where it was sampled. This applies to the Herodian street, the southern plaza's scarp, the street east of the Triple Gate and the Pool of Israel's coping—every one of them had the fault, and it is the single most repeated mistake in this model.

**One function says where the street is.** `streetLevelAt(z)`—the pavement rises northward, and Barclay's and Warren's gates were set out from the natural ground instead, which put their sills below the pavement and left the street cutting up vertically through both of them. Anything opening off the street takes its level from that function.

**A pool's rim clears the HIGHEST ground its coping touches**—stated already for the Struthion, and the Pool of Israel had exactly the same fault: its rim came from the center, so the coping walk hung in the air along the north and west where the valley falls away, and the reservoir read as a tank standing on the hillside rather than a basin dug into it and dammed.

**A door hangs on its threshold.** The Azarah stands ten cubits over the Chel outside it, so its gateways cannot read as twenty cubits from both faces—they are twenty from the threshold you cross, and ten above the floor inside. Hanging the leaves at the Azarah level instead makes the arithmetic agree from within and costs more than it buys: the doors then stand five meters up at the head of the flight and stop looking like doors at all. They stay on the threshold; the flight is behind them, starting at the inner face so the gateway itself is level under the leaves.

**The ground function knows nothing it is not told.** `groundHeightAt()` models the terrain, the platform, the courts and the southern steps; a deck carried on arches fifteen meters over a valley is none of those, so walking east out of the Shushan Gate dropped you through the causeway and left you strolling along the bed of the Kidron. `causewayDeckAt()` covers both roadways, and wins only where it is actually above the ground—which is what ends each of them where the hill has risen to meet it.

**Water needs trains that do not agree.** Two crossed sine trains, one in x and one in z, multiply into a grid of peaks and troughs and still water comes out looking like tartan. Four trains on deliberately incommensurable bearings, each with its own wavelength and speed, and the normal perturbed along each train's OWN direction so the waves read as traveling.

**`groundHeightAt()` is the model of the ground, and it is not the geometry.** Anything built that a visitor can stand on has to be told to it separately, and four things were not: the Sanctuary floor (six cubits over the Court of the Priests, so the house was a solid block you were held outside of), the twelve steps at the porch, the altar—which put you *inside* thirty-two cubits of stone rather than on it—and its ramp. The crowd placement reads the same function, which is why priests stood buried in the altar to the chest; where a figure must avoid a solid, the placement has to reject and retry, because the floor function will happily report the top of it.

**The pilaster order stops at the Antonia.** It is applied to the head wall—the back of the colonnade—and where the fortress stands there is no colonnade and no head wall. Run blind across the northwest corner, its lower ten meters were buried in the scarped rock and the shaft tops and capitals stood out of the ledge in a row, like broken columns growing out of the stone.

**The Antonia joins the Temple at ROOF level, not at the pavement.** Three things say so. The sockets cut for the northern colonnade's roof beams are still in the Antonia's rockscarp at the northwest corner of the Mount, so that colonnade ran along the FRONT of the scarp and its roof died into the fortress—which forbids the fortress standing out in the corner of the court. War 2.12 has the festival cohort "over the cloisters of the temple", so the roofs were the guard's station, and War 5.243-244's "passages down to them both" lead onto them. And Acts 21:40 needs Paul sixteen meters up in the open, not behind a screen of columns in shadow. Two flights down the middle aisles of the colonnades satisfied the preposition in Josephus and nothing else: from out in the court the stair was a dark diagonal behind the outer row, visible only to whoever was already inside the portico. What replaces them is one great stair climbing in the open at the angle where the two colonnades meet, and two posterns at eave level.

**The fortress is set out on the north wall's line, not on the world axes.** `ANTONIA` is expressed in the northern colonnade's own frame—`s` along the wall, `d` inward—and `buildAntonia` works inside `frameAlong(B, PLAT.NW, PLAT.NE)`. The north wall runs 4.7° off the x axis, which over the fortress's 122 m is ten meters of drift: an axis-aligned block either buried ten meters of the colonnade's depth at one end or left a ten-meter gap at the other. `N_FRAME` carries `toW`/`toL` for the places that still need world coordinates—the part's pick point, the Struthion, the walk floor.

**A colonnade roof that is stood on cannot be a 22° gable.** The porticoes rose 3.2 m from eave to ridge over a half-depth of 7.9 m, so a door at the eaves opened underneath the roof rather than onto it. 1.6 m now—a low pitch you can walk, which is also what War 2.12 and the Antonia's posterns need.

**`headFrom` exists because the scarp is a back wall.** Along the Antonia the platform builds no head wall of its own: the fortress's south front is the northern colonnade's rear, which is what the beam sockets are cut into. The crowning pilaster order stops in the same place, for the same reason.

**The great stair carries a floor; the roof beyond it does not.** `groundHeightAt` knows nothing about how high the eye already is, so claiming the colonnade roof there would strand you on top of it instead of letting you walk inside the colonnade. The landing at the stair's head—4.6 by 8.4 m at 16.5 m, the place Paul spoke from—is walk floor; stepping east onto the roof proper is not.

**A door at a level the walk floor does not know is a hole in the ground.** The Antonia's two posterns are upper-floor doors, six meters above the fortress's own paving, and there was nothing behind them: you climbed the great stair, stepped through the dark and fell to the courtyard. `ANT_GALLERY` is the rampart backing the south curtain, carrying a walk at the level of the doors—which a curtain forty cubits high wants anyway—and `antoniaFloorAt` returns it, plus the thresholds through the curtain **at the two doors only**. Given to the whole 122 m of curtain, walking north into it anywhere lifted you sixteen meters.

**A walk floor over a stair has to be bounded at BOTH ends.** `antoniaFloorAt` tested each flight by its distance from the head alone, so the flight went on rising past its own top step and cut a trench along the aisle line clean across the rock terrace—through the postern the stair comes out of.

**Nothing coplanar, ever.** Robinson's pier was exactly as deep as the arch it carries, so the two presented the same faces down both sides of the west haunch and the whole thing flickered between them; it is a third of a meter deeper now. The lintel over a head-wall gate sat exactly at the foot of the wall above it, with the same result. When two solids meet, make one of them overshoot.

**A roof that lands on a wall head must bury itself in it.** The Royal Stoa's aisle roofs were exactly as thick as the drop from the wall head, so the wall's top face and the roof's top face were the same plane over a strip 1.7 m wide and 274 m long, and the gray flickered against the ashlar down the whole outer edge. The same fault put the exedra's ceiling level with the aisle roofs, fighting them across two meters at the east end. Roofs are thicker than the drop now, and the exedra's ceiling sits a shade below.

**A viaduct arrives somewhere.** The causeway to the Mount of Olives stopped after twelve bays or as soon as the hill rose within two meters of the upper springing, and ended in mid-air over the Kidron's eastern slope. It runs until the hill has risen to the roadway now (about 260 m), and where there is no room left for a ring beneath the road the bay is built solid. `CAUSEWAY` works the length out once so the arcade and the walk deck agree—given its own number, the deck ended 20 m short of the last pier and the last bays were scenery you fell through. And each pier takes its footing from the ground under ITSELF; taken from the ground under the arch beside it, every pier on a slope was founded wrong.

**Every arch ring needs its spandrel.** The Huldah gates were still bare rings with daylight over each haunch between the ring and the molding above—the same paper-arch fault the arcades had, in the one place a pilgrim actually stood. `archSpandrel` up to the crown.

**Some of the immersion pools are inside the gate's architecture.** Baruch and Reich found a large miqweh in the narrow plaza directly before the Triple Gate, with three rock-cut vaulted rooms beside it carrying the approach to the gate—so the baths are not all down the hill in a quarter of their own. Both are built now, on the plaza in front of the ramp's substructure.

**A roof's EDGE can be the coplanar face, not its top.** The exedra's ceiling was R+2 wide, which put its eastern edge exactly in the plane of the Stoa's end wall's outer face—gray roof against stone wall down a strip the width of the nave—so the foot of the clerestory read gray from some angles and stone from others. Look for vertical coincidences as well as horizontal ones.

**An arch ring is not a gate.** The Huldah rings were 1.5 m deep in a wall 4.6 m thick with the dark hung just behind them, so off the axis you saw how thin they were and the gates read as a plate with holes punched in it. The reveal runs back through the whole thickness now—jambs, a barrel over them, the dark beyond—which is what the Double Gate's surviving domed bays actually are.

**Modifier keys come off the EVENT, never off their own keyup.** Ctrl with an arrow can hand focus to the browser or the window manager, and then the keyup for Control never arrives—`'control'` stayed in `S.keys` for good, and left and right strafed for ever after with no way to turn. `syncMods` reads `e.ctrlKey`/ `e.shiftKey` on every keyboard event, so every event corrects the state.

**The loading screen is bright, because the model is.** A dark boot matched the panels and then handed you a sunlit hillside, which read as the lights coming on.

**Crown = springing + half the span.** The vaulted rooms sprang at 3.6 m with a 6.4 m span, so their crowns rose 0.9 m above the paving of the landing over them and came through the surface you walk on. Check the crown against whatever the vault is under, not the springing.

**Mazar's 65.5 m is the stretch that was EXCAVATED, not the whole approach.** Baruch and Reich call what their vaulted rooms carried "the monumental staircase" at the TRIPLE Gate, and Ritmeyer draws the flight running most of the length of the southern wall, broken only where the miqweh and the building beside it stand in it. `SOUTH_STAIR.east` carries it on; `wTot` and `cx` are what the build, the pilaster skip and the walk floor all measure from.

**Reader-facing text says what the model IS, not how it got there.** No "an earlier version…", no accounts of what was removed and why. Those belong in the code comments and in this file, where a maintainer needs them. The panels and the About tab are for someone who wants to know about the Temple.

**A paving BOX's `y` is its underside, not the level you stand on.** The plaza before the Triple Gate is placed at `plazaY-1.5` and is 1.5 m thick, so its surface is `plazaY`. Taken from the box's `y`, the vaulted rooms and the great miqweh were sunk a meter and a half into the paving and the pool disappeared under it.

**Corners need a quoin, at both levels.** The retaining wall runs overlap at the corners but the CROWN does not—each colonnade's head wall stops at its own end, so the outside corner was a square notch with daylight through the joint. Below, the runs overshot by half a thickness plus a margin and the corner read as an outdent. A quoin set out on the bearing of the wall running into the corner covers the joint at both levels and stands a little proud of both faces, which is what the surviving Herodian corners do.

**Two coplanar faces need not be two materials.** The gate jambs were built at exactly the courts' wall thickness and the Nicanor dividing wall exactly three cubits past it—both flush, both the same `ashlarFine`, and both flickered, because the two surfaces carry different `uv` phase and shading even when the material matches. Jambs stand proud, the dividing wall runs half a meter past.

**A camera-nudge diff finds SHADOW crawl, not z-fighting.** The shadow frustum is re-fitted to the camera's focus every frame, so its texel grid slides and every shadow edge crawls—which reads as "sometimes gray, sometimes stone" on a wall head and looks exactly like z-fighting. `render()` quantizes the radius to powers of two and snaps the center to whole texels in a light space built about a FIXED reference point, so light space itself does not move. To isolate real z-fighting, stub `shadowAt` to `return 1.0` and diff two frames a few centimetres apart; with shadows live the test tells you nothing.

**An accidental screen is not a wall.** The Stoa's east end wall was built in two bands with the exedra's chord left open between them, so there was a sixteen-meter hole through the building's east face—invisible only because Solomon's Porch's gable-backed head wall stood in front of it. Lowering the colonnade roofs to a walkable pitch uncovered it. **If a change to one building reveals a hole in another, the hole was already there**; find what was hiding it before assuming you made it.

**A recessed apse opens INTO the hall.** The exedra's curve ran the wrong way, bulging west with its chord against the end face, which made the recess open eastward out of the building. Deepest point against the end wall, chord a radius into the nave, and short returns closing what is left behind the curve.

**A dark panel behind a gate says the gate runs into a tunnel.** Barclay's and Warren's do; Robinson's does not—its stair climbs to a gate at the level of the esplanade, so it is a way through and you should see the porch from the stair and the valley from the porch. Panelled dark it was a black hole that flashed in and out of view as you moved past it.

**Two buildings cannot both have the same corner.** The western colonnade ran from six meters north of the southwest corner, and the Royal Stoa is 37.6 m deep along the whole south wall—so the colonnade's southern 32 m stood INSIDE the Stoa, two sets of columns interleaved, and one of them planted in the road at the head of Robinson's stair. The colonnade starts at 41 now. But the **crown** still runs across the corner (`headFrom`), because it is the platform's edge and Robinson's gate is in it, and the Stoa's west end wall is pierced to let that gate through: it stood four meters inside the crown and the way in ran into blind masonry.

**A column half buried in something is a column in the wrong place.** `noCols` ranges drop them. The landing at the head of the Antonia's great stair had one sliced down its middle by the landing's east face.

**Where the scarp fronts the court it is faced, not bare.** War 5.239 has the rock "covered from its foundation with smooth pieces of stone", and Ritmeyer's section of what survives is rock with Herodian stones above it. Left as the raw `rock` material, the Antonia's south front was the one stretch of the court's edge with no masonry on it—130 m of smooth rock where every other side has drafted ashlar. Only the south face: the other three stand over open ground outside the platform, where the scarp is the scarp.

**Zooming past the near limit must not stall.** `dolly` pins the arm at `DIST_MIN` and pushes the PIVOT forward by whatever is left of the geometric step—0.6 m for a wheel notch that was worth eighty meters a moment earlier, so the model appeared to stop dead and crossing a colonnade took forty notches. The residual is still proportional to the input, so it only wants a gain (`PUSH_GAIN`).

**A closed door is shut.** The inner gates' leaves were 0.45 of the opening each, leaving half a meter of daylight down the center of every one, and what showed through was whatever happened to stand behind—the court at one gate, a chamber wall at another, a different stone at a third.

**A hollow box that is seen from above needs its top.** The Antonia's rock stands proud of the curtain on three sides—War 5.239 puts a wall "three cubits high" at the rim of the rock with the building filling the rest—so that walk is in view; `skip:'T'` made it a hole straight into the box. On the SOUTH there is no walk at all: the colonnade's roof has to reach the fortress wall. The corner towers are inset far enough that none oversails the rock; at 15 m square on the corners they hung a meter out over the scarp, and are 24 cubits now.

**Spandrel fill is sliced round the ring, not up in equal heights.** Sliced by height, the step left under the crown is wider than the ring is thick, and daylight shows through it. Each slice starts at its own foot, where the intrados is widest, so no fill ever intrudes into the passage.

**Josephus's heights are measured from where he says, not from the top of the last thing.** The Antonia's rock is fifty cubits above the ground at its foot, not above the esplanade; the fortress floor is twenty cubits over the pavement; and the four towers are measured from that floor, so a fifty-cubit tower stands ten cubits over the forty-cubit curtain. Stacked tower-on-curtain the southeastern tower reached ninety cubits and thirty meters over the Sanctuary, which makes nonsense of a tower built so the Temple "might be viewed" from it.

**A way up has to arrive somewhere, and so does the street it arrives on.** The Triple Gate's ramp came down over open hillside: the paved apron stopped nine meters short of its foot. The street now runs east along the wall to the southeast angle, where the road from the City of David arrived. Because the ground falls about 28 m over that run, its retaining face is built **in segments each reaching down to the ground actually beneath it**—one box from a single sampled height hangs in the air at the far end, which is the same mistake moved along the wall.

**A pool's rim has to clear the HIGHEST ground its coping touches.** Taken from the center, the Struthion sat below the slope at one end and the terrain sheet cut across the basin and swallowed it. The rim is the maximum over the footprint, with a rock skirt beneath the coping walk on the sides where the ground falls away.

**The retaining wall's courses diminish as it rises**, because Herod's masons put the great stones at the bottom: about 2.4 m at the foot, 1.8 m in the middle, 1.2 m for the top 7 m. Each band is a separate `B.wall` run with its own `uv`, which shrinks the courses and the blocks together—four of each to a tile, so one number does both. Two things it needs: the cuts fall at -7.2 and -21.6 because those are whole courses in **both** bands meeting there, or a stone is left sliced through at the join; and `wall()` takes **`batter0` as well as `batter`**, or every band starts back at full thickness and the lean comes out as a flight of steps down the face. The same applies to the shading gradient, which has to be shared out across the bands rather than restarted.

**A gatehouse block reaches down to the wall head.** Sized from its own `top` alone it floats above the wall wherever that wall is lower, and its doors must be sized from the opening they hang in, not from a default.

**Where two colonnades meet, the corner needs closing.** `buildCornerBay` closes the northeast. At the two southern corners the Royal Stoa's own end walls do it. At the northwest neither colonnade needs a cross-wall: the Antonia's rock closes both below, and the fortress's south front—which their roofs run into—closes them above. Everywhere else a colonnade gets one at each end (`capEnds`), or you can look along it from outside.

**A basin sunk into a solid slab is invisible.** The plaza is one box, so the ritual baths sit in a raised coping with the water a hand's breadth above the pavement. The two reservoirs are in open terrain and are sunk properly.

**Anything abutting the altar meets the face at the height it arrives at.** The altar steps inward as it rises (32 → 30 → 28 → 26 cubits), so the ramp's head lands on the ledge at the top of the 28-cubit course, center + 14 cubits.

**Self-luminous materials are excluded from the shadow pass**—`MATERIALS[m].emis` is the test. Flames give light through `FIRE_LIGHTS` instead.

**Cut-outs cast the shadow of their silhouette, through a second depth program.** `MATERIALS[m].alpha` routes a draw to `progDepthA`, which samples the texture and discards; the soreg's lattice would otherwise throw the shadow of a solid wall. It is a separate program, not a branch, so the quarter-million opaque triangles never pay for a texture fetch they do not need.

**A vertex's occlusion term is hand-placed AND baked, and they multiply.** `bakeAO()` at the end of `30-geom.js` voxelizes the solid geometry at 1.5 m and casts a short hemisphere from every vertex. Three things it has to get right: the ray origin must be lifted more than one cell off the surface and rays shallower than `C_MIN` dropped, or a surface self-occludes against its own voxels and an open wall comes back a quarter dark; cut-outs must be excluded from the occluders (`AO_NOT_SOLID`) or the soreg voxelizes into a solid wall; and the floor of 0.52 exists because this renderer has no bounce light, so anything that baked to zero would be a hole in the image. The `interior` layer does not receive it—the furniture of the Holy Place stands in a sealed room, would bake to a uniform dark, and the menorah would go out.

**A vertex can only carry occlusion that varies over the size of its own triangles**, because the term is interpolated across them. The esplanade is a single box: its top face has four vertices, all of them against the colonnades, and their darkening was being smeared over three hundred meters of court, which turned the whole pavement gray. `bakeAO` therefore measures each vertex's longest adjacent edge and fades the result out above about 1.5 × the sampling radius. Nothing is lost—a surface that coarse is flat and open and its true occlusion is 1—and it is why the pilasters, cornices, treads, drums and coffers take the darkening while the big slabs do not. **If you add a large low-poly surface and it comes out muddy, this is the reason; tessellate it or leave it alone, do not weaken the bake.**

**Judge the bake by rendering it, not by the mean.** Per-material AO averages are dragged down by hidden interior faces that were always invisible. The comparison that means anything is the same view built twice; replacing `bakeAO(V, I, draws);` with `;` in the built HTML gives the second one.

**One ground query, `groundHeightAt(x,z)`,** in `55-build-temple.js`, used by both the crowd placement and the standing viewpoints. It lives in the builder for that reason.

**One street level, `STREET_Y`,** shared by the Herodian street and everything that comes down to meet it.

**Texture a surface at the scale it actually is.** A tread is one cubit deep, so mapping `u` across it shows 6% of the texture; `ringStairs` uses planar UVs from world x/z instead.

## 5. Subsystems

**Metals and water.** `metal` is how much of the sky a surface mirrors, with a Fresnel rise toward grazing angles—that, not the specular exponent, is what makes gilding read as plating. `reflTint` decides whether the reflection takes the surface's own color: **1 for a metal** (gold reflects gold), **0 for a dielectric** (water reflects the sky). Water's body color is nearly black, so tinting its reflection by albedo cancels it and the basin looks like a hole. Water also sets `wave:1`, perturbing the normal with two crossed sine trains.

**`blotch`** adds three octaves of very low frequency tonal variation keyed to world position, on paving, stone, ground and roofs. An 8 m tile over a 300 m court reads as wallpaper without it.

**Per-material shader features are gated by a uniform that is zero elsewhere**, so the branch is uniform flow across a draw and no other material pays for it. Three of them work this way:

- **`bump`**—a normal map differentiated from the material's own albedo canvas (`TexLib.normalMap`, Sobel of the luminance, half resolution), on unit 3. Uploaded as `RGBA`, **never `SRGB8_ALPHA8`**: it is data, and the sRGB decode would bend every normal in it. The tangent frame comes from screen-space derivatives rather than a vertex attribute, because this model projects UVs planar from world coordinates in some places and local ones in others and no single tangent convention would cover both.
- **`blend2`**—a second albedo, named as another material so its texture is borrowed rather than uploaded twice, mixed in by slope. The hillside uses `rock`'s image for its own outcrop.
- **`alpha`**—alpha testing, and the separate depth program above.

- **`slabs`**—`[stones across, courses down]` one texture tile. See below.
- **`grime`**—how much dirt this material collects, keyed to the baked occlusion. See below.

**Dirt is the baked occlusion, read a second time.** Nothing else in this renderer knows what is next to what. Dirt collects where the sky cannot reach a surface and rain cannot wash it—wall feet, inside corners, under cornices, between columns—which is the same quantity, already in the buffer, so `grime` costs one mix and no new data. Keep it on the old and workaday. The Sanctuary and its courts get none: the building was about fifty years old in AD 30 and Josephus says a stranger approaching had to look away from the light off it, so grime there is a claim about the past and not a rendering trick.

**Gold has to be lit as a conductor or it reads as yellow paint.** Four things, and all four were wrong at once:

- Its **specular takes the metal's color, not the light's**. A white highlight on gold is the signature of plastic. Same `reflTint` as the environment.
- Its **diffuse is almost nothing** (`1.0 - uMetal*0.82`). The color comes back out of the mirror, tinted, not out of scattering.
- Its **reflection has a lower half**. Everything below the horizon in the reflection is ground—darker and warmer. Returning the horizon color in every downward direction gives an even wash, which is exactly what paint looks like.
- It must **not sit at the value of the stone beside it**, which is what a flat weighting produced. Face-on a metal returns little and at grazing angles nearly everything, so the Fresnel weighting is steep: deep amber in shade, unbearable in the mirror direction.

**And a gilded wall is a few hundred sheets, not one mirror.** What says metal is that each plate catches the light differently. The hammer facets in the texture cannot do it from any distance—by the time the facade fills the frame they have mipped to a flat average—so the tilt is taken **per sheet**, from the same `slabs` cell index the tone comes from, and fades out with it. Without this the facade is one flat field however good the material model is.

**A tiled texture's course count must be EVEN if its courses stagger.** The world-space tone hash reproduces the half-tile offset from the row index, so an odd count flips the parity at every tile boundary and the offset lands on the wrong course. The pantiles were drawn in seven rows and are drawn in eight now.

**Per-stone tone belongs in the world, not in the texture.** Quarried stone is never uniform and the obvious place for that variation is the texture, where it becomes the most visible thing in the model: the identical arrangement of light and dark stones repeats every 8 m over a 300 m court and every 9.6 m along a 280 m wall, and the eye reads the arrangement long before it reads the stone. The tone is hashed from the stone's own place in the world instead. Three things this depends on: the UVs on these surfaces are world coordinates times a scale, so flooring them by `slabs` gives a globally unique index; the half-stone stagger of alternate courses has to be reproduced from the same rule the texture was drawn by (`mod(row,2.0)`), or the tone lands across two stones; and the tile's course count must be even, or the stagger's parity breaks at the tile boundary. It is faded out as a stone shrinks toward a pixel—being analytic it has no mip chain to average it, and it would otherwise boil at the far end of the court. **If you change a texture's block layout, change its `slabs` to match.**

**Flames and smoke.** `PUFFS` in `55-build-temple.js`, `progPuff` in `60-gl.js`. Kept out of the main buffer: four vertices share one anchor, `aCorner` expands them into a camera-facing quad from the view matrix's rows, and everything animates from `fract(uTime/period + seed)`—no CPU work per frame, no buffer updates, and the scene stays `STATIC_DRAW`. Its own VBO and 9-float layout (anchor 3, corner 2, seed/size/rise/kind 4). Drawn after the opaque pass with `depthMask(false)`: **flames additively** (`SRC_ALPHA, ONE`, so no sorting is needed), **then smoke** with ordinary alpha. Smoke alpha stays low—the puffs are unsorted, so looking along the column stacks dozens of them.

## 6. Viewpoints

`VIEWS{}` are the named viewpoints on the dock; `PLACE_VIEWS{}` gives one to each structure. Anchors are `{W:[x,y,z]}` in world meters or—preferably—`{L:[eastCubits, southCubits, yMeters]}` in precinct cubits, resolved through the same transform the geometry uses. `azimuth` is the compass bearing **from the subject out to the camera** (90 = due east of it). All three are in `40-data.js`.

`PASSAGES` in `40-data.js` is the passage guide, and it does NOT carry cameras. Each entry names a `place`—a key from the structure index—and `gotoPassage()` goes through `goToKey()`, so a passage is framed exactly as the Plan frames the thing it names and cannot drift away from it. `conf` is the point of the list and is never omitted: `explicit`, `probable`, `court`, `disputed`. The old pilgrim's tour is gone; it was a route someone might have walked, which is a reasonable thing to show and not an evidenced one.

`resolveView()` only carries `section` when the spec states the key.

The Azarah is 98 × 71 m inside a 21 m wall whose gatehouses reach 25.9 m, so any camera far enough back to frame the altar or the Sanctuary is outside it and has to look over it. To see a point at height `y0` over an obstacle `H` high standing `d` meters from the subject, from horizontal distance `D`, the camera must be more than `(H - y0) * D / d - (targetY - y0)` above the target.

Two sightlines to know: from due **east** every line to the altar passes through the Nicanor gatehouse, so the altar view comes in over the **northeast**; and standing at the inner edge of Solomon's Porch puts you in 19 m of its shadow.

## 7. Verification

`node util/verify.js`—about thirty checks, non-zero exit on failure. **Run it after any change to `40-data.js`.** It re-derives the wall lengths, that the square's corners lie on the eastern wall, Middot 2:1's ordering of the margins, Middot 4:6/4:7/5:1 closing, the level stack, the Shushan Gate falling on the Sanctuary's axis, plus buffer sanity (no non-finite floats, no out-of-range indices) and per-layer triangle counts.

It runs the sources in a `vm` context with `document.createElement` stubbed to throw, so the geometry builder can never touch the DOM. One-off profiling scripts can follow the same pattern; see how `util/verify.js` exposes internals via `globalThis.__X`.

## 8. Captures and diagnosis

`./util/capture.sh <name> "<query>"` → `captures/<name>.jpg`, via headless Edge with `--use-angle=swiftshader`; `util/png-to-jpeg.py` converts and the PNG is discarded. Slow, about 40 s each, so batch them with `run_in_background`. Software rendering is detected in `_pickShadowSize()`, which drops the shadow map to 1024. `captures/` is gitignored.

Edge is a Windows program, so the paths it is given are **derived with `wslpath -w`**, never hardcoded—a hardcoded drive letter breaks the moment the checkout moves. The Edge call ends in `|| true`, so a path it cannot write goes into `/dev/null` unseen; `capture.sh` therefore fails loudly when no PNG appears, and does not delete the old JPEG until it has a new one.

For anything localized, **`?cam=ex,ey,ez,tx,ty,tz`** puts the eye and target exactly, with no curated framing, and cropping in on the result settles questions that guesswork does not. `?t=<seconds>` pins the animation clock so a moving thing can be captured reproducibly. `?go=<key>` flies to any Plan entry, but its framing is generic and knows nothing about sightlines.

Sampling actual pixel values beats eyeballing a downscaled image.

`node util/probe.js x0 x1 y0 y1 z0 z1` answers the other half of the question: **what stands in this box, and which line built it.** It runs the builder in the same `vm` `util/verify.js` uses, wraps every `Builder` emitter to record the world bounding box of the vertices that call produced, and takes the callsite off a stack trace—the sources are concatenated into one script, so the vm's line number is mapped back to `file:line`. Only the outermost emitter in a nest is recorded, so a `box` is not buried under its own quads.

Use it on a **hole**. A gap in the model is geometry that is absent, which no screenshot can name and no amount of turning the camera will identify; asking what occupies the volume and getting three lines of terrain back says exactly how wide the hole is and which two things failed to meet. It found both arms of the slot over Robinson's gate—a 1.9 m alley between the Royal Stoa's west end wall and the colonnade's crown, and 3.4 m of missing crown between `headFrom` and the southwest quoin—in one call each, after screenshots had only established that something was wrong somewhere near the corner. Run it again afterwards on the same box: the fix is proved when the void has something in it.

## 9. Cost

About 302,000 triangles, 427,000 vertices, 47 draw groups, 14.7 MB of vertex buffer. The build takes roughly 2 s in node, of which the AO bake is about half; the browser yields between `SCENE_STEPS` phases so the progress bar means something. `node util/verify.js` prints all of these, so take them from it rather than from here.

**Prefer build-time cost to frame cost.** Everything here is static, so an answer that can be computed once and stored in the vertex buffer or a texture should be. The baked occlusion is the model of this: it does more for the image than anything else on this list and costs nothing to draw. Where a per-frame cost is unavoidable—the second texture fetch for the hillside blend, the normal map on the stone, the per-stone tone hash—it is gated behind a uniform so only the material that asked for it pays. The soft shadow is the happy case: the early-out answers most of the frame in five taps where the old fixed kernel always took nine.

Columns dominate—there are about 650 of them:

- `column({lod:0})` gives one tier of leaves, no volutes, one base torus, one shaft ring. **Use it for anything only seen at a distance**—the porticoes and the Stoa's engaged half-columns do.
- `lod:1` (the default) is the full Corinthian capital, roughly 300 triangles. Reserve it for what you can walk up to.

## 10. Adding a structure

1. Build it in `50-build-mount.js` or `55-build-temple.js`, wrapped in `B.part(id, {name, key, at | atLocal}, () => { … })`. `atLocal` is in precinct meters and is resolved to world by `finishScene()`. Ids and keys must be unique—a duplicate silently replaces another panel.
2. Add an `INFO[key]` entry in `40-data.js`: `n` name, `k` kind line, `d` HTML description, `t` dimension table, `s` citation. **Cite the source, and where Middot and Josephus disagree give both figures.**
3. List it in `PLAN_GROUPS` so it appears in the Plan tab.
4. Add its id to `PIN_IDS` in `70-app.js` only if it deserves a floating label; the labels declutter by dropping collisions, so more is not better.
5. `./build.sh && node util/verify.js`, then capture it.

## 11. Interface constraints

- **American English throughout**—panels, comments and docs alike: color, meter, center, curb, mold, story, gray, metric ton. `curb` is also a `waterBasin()` option name, so it stays consistent both ways.
- **One typeface, no serif, no all-caps.** Everything is the single sans stack; there is no monospace and no serif in the stylesheet. The display role is that same stack at weight 600 with slightly negative tracking (`--display`); hierarchy comes from weight, size and color, never `text-transform`. Numeric columns line up with `font-variant-numeric: tabular-nums`, not with a mono font.
- **The interface starts hidden and `H` brings it up** (`body.uiHidden`), leaving only the model and a faint `#uiShow` control; `?ui=1` starts with it up, `?ui=none` takes away the way back. Labels are suppressed with it, since `#pins` is chrome. Every capture in `util/capture-all.sh` passes `ui=none` except the one named `ui`, which must pass `ui=1`—the default is no longer enough to show the interface.
- **Picking is off while the interface is hidden.** `pick()` returns early on `!S.ui`, and `setUI(false)` clears the selection. The panel a click answers into is chrome and goes with the interface, so all a click could otherwise do is put a wireframe box round something and leave it there with no way to read it or dismiss it.
- **The arrows are movement keys, not list keys.** They are read from `S.keys` by `stepOrbit` (swing round the target, raise and lower the eye, and with `Ctrl` held, dolly in and out exponentially as the wheel does, or slide the pivot sideways). They step the passage guide only where it is on screen to be stepped—the interface up—which is what `arrowsNavigate()` decides. The velocity eases over about a tenth of a second, and the stepper bails out during a flight; an arrow pressed while navigating cancels the flight, as a drag does.
- **The dock holds Reset and Hide, not viewpoints.** The six named viewpoints it used to carry duplicated the passage guide and the Plan index. `VIEWS` is still there and still reachable through `?view=`, `bReset` and the Plan.
- **The grade is applied to the sky as well as the geometry.** It is the one frankly photographic step in the shader—a warm/cool split and a slight vignette—and run on one and not the other, the horizon becomes a seam.
- **No backticks in GLSL comments.** The shaders are JavaScript template literals; a backtick in a comment closes the string and the build fails somewhere entirely unrelated.
- **Touch is the common case, and a phone has no hover and no keyboard.** The interface starts hidden and `H` brings it back—and there is no `H` on a phone, so `#uiShow` is the only way in and cannot be a faint chip at a third opacity. A `@media (pointer:coarse)` block makes it opaque and full size, drops the keyboard hints that mean nothing there, and gives every tappable thing 44 px, which is the smallest target a finger hits reliably. The toggles, tabs, dock, close buttons, slider thumb and label pins were all laid out for a mouse and none of them reached it.
- **Below 700 px the rail is not a panel, it is a sheet with three heights.** Docked at `44vh` with the info card taking another `38vh` above it, the two of them left a strip of model between them and the phone was mostly interface. The rail now sits on the bottom edge at one of three detents—`peek`, which is exactly the measured head and is where it rests; `d-half`; and `d-full` at `92vh`—dragged by `.grab` and snapped to the nearest on release, or stepped by tapping the handle. A tab raises a sheet that is down and the tab already open puts it back, which is why there is no longer a button to summon the panel: at peek the tabs are always on screen. The info card takes the same three heights and `body.sheetInfo` hides the rail while it is up, so there is one panel and never a split; it arrives at half because the card is answering a question about something you are looking at. `--peek` is measured at runtime and written back to the element—the resting height IS the head, and CSS cannot transition to `auto`. The dock gives up the bottom edge for this and goes to the top corner opposite the title, where it is icon-only already.
- **THERE IS ONE CAMERA AND IT ORBITS. Walking was cut.** It was feet on W A S D, gravity, and an eye locked to `floorAt`—good for debugging and a trap on a touch screen, where the feet are keys a phone has not got, all a finger could do standing on the pavement was turn on the spot, and the double tap it takes to try for more is the browser's own page zoom: it magnifies the whole canvas and no gesture inside it undoes that. Gone with it: `S.mode` and every branch on it, `stepWalk`, the dock's mode segment, the crosshair, `W` and `O`, and the `walk=1` parameter—never published, so nothing accommodates it; `?cam=` is the eye and the aim, which was all it ever added to.
- **What replaced it is `dolly` on the pinch.** Two fingers used to shrink the arm and nothing else, so at the 5 m limit they stopped doing anything: on a phone you could pinch your way down to the middle of the platform and not one pixel nearer the Antonia. The pinch now goes through `dolly` like the wheel, which pushes the PIVOT forward once the arm is as short as it goes.
- **`mode:'stand'` is a viewpoint, not a mode.** It means an eye ON THE PAVEMENT at a visitor's height (`STAND_EYE`, 1.62 m over `floorAt`), given as a place to stand and a thing to look at; `resolveView` returns the ordinary orbit camera with the pivot put down the line of sight. Half the guide's viewpoints are of this kind. Arriving at one never changes what the controls do.
- **`Ctrl` changes what the sideways arrows do:** with it they slide the pivot sideways instead of swinging round the target, and `Ctrl` with up and down dollies instead of pitching.
- Dual light/dark theme at token level, `:focus-visible` outlines, and `prefers-reduced-motion` honored for both CSS transitions and camera flights.
- The Royal Stoa's ridge roof is terracotta (`roofTile`) against the gray `roof` of the aisles and colonnades.
- The invented city buildings are off (`SHOW_CITY_BUILDINGS`).

## 12. Sourcing decisions already settled

**The Babylonian veil hangs before the Hekhal's golden doors, not across the porch opening.** Josephus, *War* 5.208 and 5.211–212: the outer gate "had no doors, for it represented the universal visibility of heaven"; the inner house "had golden doors… but **before these doors** there was a veil of equal largeness with the doors." The porch archway is open—no doors, no curtain—and the veil is eleven cubits further in. The two veils a cubit apart before the Holy of Holies are separate and separately attested (Yoma 5:1, Middot 4:7's *traksin*); keep both.

**The hundred cubits of height are measured from the Court of the Priests**, not the Sanctuary floor—Middot 4:6 counts the six-cubit foundation as the first of them. The apex is 60.9 m above the esplanade.

**The four columns on the facade are gilded and full height.** Josephus says the front was "covered all over with plates of gold," so a stone-colored order there would contradict him; legibility comes from relief and deep flutes instead.

**The altar follows Middot** (32 cubits square, 10 high), not Josephus's 50 × 50 × 15. Both figures appear in the panel.

**Wall corners need one top surface.** Extending both perpendicular runs over
the same corner closes the masonry but duplicates its top. Cycles showed six
black patches at the courts' four outer corners and two dividing-wall joins.
The north/south runs own the outer corners; east/west walls butt against their
inner faces. The taller Nicanor wall owns the dividing joins. Chamber walls
follow the same rule. `node util/verify-wall-joints.js` checks 22 junctions for
exactly one surface. Fill beneath a paved roadway must similarly end inside
the slab, not at its walking surface (Wilson's causeway).

**Adjacent gate bays each own half their shared pier.** The Huldah jambs,
arch rings, and spandrels stop at their bay boundaries. Wider surrounds plus
a separate center pier duplicated their front surfaces, making a black line
between dark entrances. `node util/verify-gate-joints.js` checks 24 points on
the Double and Triple Gates for exactly one stone face.

## 13. Deliberately not done

- **No collision.** The camera passes through walls. Often useful for inspection, but it is an absence, not a feature.
- **Labels have no depth test.** Mitigated by dropping any label further than about 2.1× the orbit distance; a distant one can still float over near geometry.
- **The city's buildings are not shown**, and the topography is analytic rather than surveyed.
- **The rival sitings of the Sanctuary** (Kaufman's northern, Sagiv's southern) are described in the Sources tab but not modeled; doing so needs their published coordinates.
- **The Pool of Israel is drawn but contested**—Herodian, Hadrianic c. AD 130, or Umayyad, and Josephus never mentions it. It is the least secure thing here and its panel says so.
