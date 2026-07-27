/* Headless check of the geometry: run the builder in node, then test the
   numbers that matter against the sources. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['10-math.js','20-textures.js','30-geom.js','40-data.js',
               '50-build-mount.js','55-build-temple.js'];
let code = files.map(f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8')).join('\n');

/* the builder never touches the DOM, but the texture module mentions it */
const ctx = { console, document:{ createElement(){ throw new Error('no canvas needed'); } },
              performance:{now:()=>0}, navigator:{} };
vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.__buildScene=buildScene;'+
  'globalThis.__X={CUBIT,cu,PLAT,PLAT_RING,WALL_LEN,SQ_NW,SQ_NE,SQ_SE,SQ_SW,SQ_SIDE,'+
  'LEV,AZ,CW,AXIS_Z,HOUSE,HOH_X,HOUSE_H,MARGIN_W,MARGIN_N,MARGIN_E,MARGIN_S,EW,'+
  'PRECINCT_ROT,precinctToWorld,groundLevel,outsidePlatform,STOA,PORTICO,GATES,'+
  'ALTAR,CT,STEP_RUN,CHEL_W};', ctx);

const X = ctx.__X;
const F = n => (Math.round(n*100)/100).toFixed(2);
let fails = 0;
function chk(label, got, want, tol){
  const ok = Math.abs(got-want) <= (tol===undefined?0.05:tol);
  if(!ok) fails++;
  console.log(`${ok?'  ok ':'FAIL'}  ${label.padEnd(46)} ${F(got).padStart(10)}` +
              (ok?'':`   expected ${F(want)}`));
}
function note(label, v){ console.log(`       ${label.padEnd(46)} ${v}`); }

console.log('\n— THE PLATFORM————————————————————————————————————————');
chk('west wall (m)',   X.WALL_LEN.W, 485, 0.6);
chk('east wall (m)',   X.WALL_LEN.E, 460, 0.6);
chk('north wall (m)',  X.WALL_LEN.N, 315, 0.6);
chk('south wall (m)',  X.WALL_LEN.S, 280, 0.6);
const area = (()=>{ const R=X.PLAT_RING; let a=0;
  for(let i=0;i<4;i++){ const p=R[i],q=R[(i+1)%4]; a += p[0]*q[1]-q[0]*p[1]; }
  return Math.abs(a)/2; })();
note('enclosed area (m²)', Math.round(area).toLocaleString()+'  ≈ '+
     (area/4046.86).toFixed(1)+' acres');

console.log('\n— THE 500-CUBIT SQUARE————————————————————————————————');
chk('cubit (m)', X.CUBIT, 0.525, 0.0001);
chk('side (m)',  X.SQ_SIDE, 262.5, 0.01);
const sqSide = Math.hypot(X.SQ_NE[0]-X.SQ_NW[0], X.SQ_NE[1]-X.SQ_NW[1]);
chk('measured N side (m)', sqSide, 262.5, 0.01);
note('skew from the Herodian walls', F(X.PRECINCT_ROT*180/Math.PI)+'°');
/* the square's east side must lie on the platform's east wall */
function distToEastWall(p){
  const a=X.PLAT.NE, b=X.PLAT.SE;
  const ex=b[0]-a[0], ez=b[1]-a[1], L=Math.hypot(ex,ez);
  return Math.abs((ex*(p[1]-a[1]) - ez*(p[0]-a[0]))/L);
}
chk('square NE corner lies on the east wall', distToEastWall(X.SQ_NE), 0, 0.02);
chk('square SE corner lies on the east wall', distToEastWall(X.SQ_SE), 0, 0.02);
note('square west side, m from the west wall', F(X.SQ_NW[0]));

console.log('\n— MIDDOT 2:1, THE ORDER OF THE MARGINS————————————————');
note('south / east / north / west (cubits)',
     `${X.MARGIN_S} / ${X.MARGIN_E} / ${X.MARGIN_N} / ${X.MARGIN_W}`);
const ordered = X.MARGIN_S > X.MARGIN_E && X.MARGIN_E > X.MARGIN_N &&
                X.MARGIN_N > X.MARGIN_W;
console.log(`${ordered?'  ok ':'FAIL'}  largest south, then east, then north, `+
            `smallest west`);
if(!ordered) fails++;
chk('margins + courts = 500 across',
    X.MARGIN_W + 187 + 135 + X.MARGIN_E, 500, 0.01);
chk('margins + courts = 500 down', X.MARGIN_N + 135 + X.MARGIN_S, 500, 0.01);

console.log('\n— MIDDOT 4:7, THROUGH THE SANCTUARY———————————————————');
const H=X.HOUSE;
const parts = ['porchWall','porch','hekhalE','hekhal','traksin','debir',
               'hekhalW','cellW','outerW'];
note('east→west (cubits)', parts.map(k=>H[k].n).join(' + ') + ' = ' +
     parts.reduce((a,k)=>a+H[k].n,0));
chk('the hundred cubits east to west', parts.reduce((a,k)=>a+H[k].n,0), 100, 0.01);
chk('Holy of Holies center (cubits east)', X.HOH_X, 100, 0.01);
chk('Holy of Holies is 20 cubits', H.debir.n, 20, 0.01);
chk('Middot 4:6 heights sum to 100', X.HOUSE_H, 100, 0.01);

console.log('\n— MIDDOT 5:1, THE 187 CUBITS——————————————————————————');
chk('Israel 11 + priests 11 + altar 32 + gap 22 + house 100 + rear 11',
    11+11+32+22+100+11, 187, 0.01);
chk('courtyard east wall (cubits)', X.AZ.x1, X.MARGIN_W+187, 0.01);
chk('altar occupies cubits 195–227', X.ALTAR.x1 - X.ALTAR.x0, 32, 0.01);

console.log('\n— LEVELS (meters above the esplanade)—————————————————');
chk('Court of the Women  (6 cubits)',   X.LEV.women,   3.15,  0.01);
chk('Court of Israel     (13½ cubits)', X.LEV.israel,  7.0875,0.01);
chk('Court of the Priests(16 cubits)',  X.LEV.priests, 8.40,  0.01);
chk('Sanctuary floor     (22 cubits)',  X.LEV.house,   11.55, 0.01);
chk('Sanctuary apex      (116 cubits)', X.LEV.houseTop,60.90, 0.01);
note('apex above sea level (m)', F(740 + X.LEV.houseTop));

console.log('\n— THE SHUSHAN GATE FALLS ON THE AXIS——————————————————');
const axisEast = X.precinctToWorld(500, X.AXIS_Z);
chk('axis meets the east wall', distToEastWall(axisEast), 0, 0.05);
const gatePos = (()=>{ const g=X.GATES.shushan, t=g.at/X.WALL_LEN.E;
  return [ X.PLAT.NE[0]+(X.PLAT.SE[0]-X.PLAT.NE[0])*t,
           X.PLAT.NE[1]+(X.PLAT.SE[1]-X.PLAT.NE[1])*t ]; })();
chk('gate is on the Sanctuary axis (m off)',
    Math.hypot(gatePos[0]-axisEast[0], gatePos[1]-axisEast[1]), 0, 1.2);
note('Holy of Holies, world (x,z)',
     F(X.precinctToWorld(100,X.AXIS_Z)[0])+', '+F(X.precinctToWorld(100,X.AXIS_Z)[1]));
note('  → m from the west wall', F(X.precinctToWorld(100,X.AXIS_Z)[0]));
note('  → m from the north wall', F(X.precinctToWorld(100,X.AXIS_Z)[1]));

console.log('\n— THE ROYAL STOA——————————————————————————————————————');
note('columns', `${X.STOA.rows} rows × ${X.STOA.perRow} = ${X.STOA.rows*X.STOA.perRow}`+
                `, +2 at the apse = ${X.STOA.total}`);
note('bay (m)', F((X.WALL_LEN.S-12)/(X.STOA.perRow-1)));
chk('overall width (m)', X.STOA.aisleS+X.STOA.nave+X.STOA.aisleN, 34.6, 0.1);

console.log('\n— TERRAIN SAMPLES (m relative to the esplanade)————————');
const g=X.groundLevel;
note('street west of the wall',      F(g(-9, 300)));
note('plaza below the south steps',  F(g(84, 520)));
note('southeast angle',             F(g(300, 500)));
note('Kidron bed',                   F(g(400, 340)));
note('Upper City crest',             F(g(-300, 330)));
note('Mount of Olives',              F(g(830, 300)));
note('north of the wall',            F(g(160, -30)));

console.log('\n— BUILD———————————————————————————————————————————————');
const t0=Date.now();
const sc = ctx.__buildScene(null);
const ms=Date.now()-t0;
note('build time (ms)', ms);
note('vertices', sc.stats.verts.toLocaleString());
note('triangles', Math.round(sc.stats.tris).toLocaleString());
note('draw groups', sc.stats.groups);
note('parts registered', sc.parts.length);
note('vertex buffer (MB)', (sc.vertices.byteLength/1048576).toFixed(1));
note('index type', sc.indices.constructor.name);

/* non-finite values would show up as invisible or exploded geometry */
let bad=0, minY=1e9, maxY=-1e9;
for(let i=0;i<sc.vertices.length;i++){
  const v=sc.vertices[i];
  if(!Number.isFinite(v)) bad++;
}
for(let i=0;i<sc.vertices.length;i+=9){
  if(sc.vertices[i+1]<minY) minY=sc.vertices[i+1];
  if(sc.vertices[i+1]>maxY) maxY=sc.vertices[i+1];
}
chk('non-finite floats in the buffer', bad, 0, 0);
note('y range (m)', F(minY)+' … '+F(maxY));
let maxIdx=0; for(let i=0;i<sc.indices.length;i++) if(sc.indices[i]>maxIdx) maxIdx=sc.indices[i];
chk('max index < vertex count', maxIdx < sc.stats.verts ? 0:1, 0, 0);

const layers={};
for(const d of sc.draws) layers[d.layer]=(layers[d.layer]||0)+d.count/3;
console.log('       triangles by layer');
for(const k of Object.keys(layers).sort((a,b)=>layers[b]-layers[a]))
  console.log(`         ${k.padEnd(12)} ${Math.round(layers[k]).toLocaleString()}`);

console.log('\n— PARTS———————————————————————————————————————————————');
for(const p of sc.parts.slice().sort((a,b)=>a.id.localeCompare(b.id)))
  console.log(`       ${p.id.padEnd(16)} ${F(p.size[0]).padStart(8)} ×`+
              `${F(p.size[1]).padStart(8)} ×${F(p.size[2]).padStart(8)}   `+
              `top y ${F(p.max[1]).padStart(7)}`);

console.log(`\n${fails? 'FAILURES: '+fails : 'all checks passed'}\n`);
process.exit(fails?1:0);
