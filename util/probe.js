/* One-off: what geometry stands in a given world box, and which source line
   built it. Same vm pattern as verify.js.
     node util/probe.js x0 x1 y0 y1 z0 z1                                  */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['10-math.js','20-textures.js','30-geom.js','40-data.js',
               '50-build-mount.js','55-build-temple.js'];
const srcs = files.map(f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'));
const code = srcs.join('\n');

/* vm line -> file:line */
const starts = [];
{ let n = 1;
  for(let i=0;i<files.length;i++){ starts.push(n); n += srcs[i].split('\n').length; } }
function where(vmLine){
  let i = 0; while(i+1 < starts.length && starts[i+1] <= vmLine) i++;
  return `${files[i]}:${vmLine - starts[i] + 1}`;
}

const ctx = { console, document:{ createElement(){ throw new Error('no canvas needed'); } },
              performance:{now:()=>0}, navigator:{} };
vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.__buildScene=buildScene;globalThis.__B=Builder;', ctx);

const B = ctx.__B;
const recs = [];
let depth = 0, cur = null;
/* every public emitter; the low-level ones are wrapped too but only the
   outermost call in a nest is recorded, so `box` is not shadowed by its quads */
for(const name of Object.getOwnPropertyNames(B.prototype)){
  if(['constructor','g','_v','pushM','pushT','pushRotY','pushRotX','pushRotZ','pop',
      'beginPart','endPart','part','M'].includes(name)) continue;
  const fn = B.prototype[name];
  if(typeof fn !== 'function') continue;
  B.prototype[name] = function(...a){
    if(depth === 0){
      const st = (new Error()).stack.split('\n');
      let site = '?';
      for(const l of st.slice(2)){
        const m = /evalmachine[^:]*:(\d+):/.exec(l);
        if(m){ site = where(+m[1]); break; }
      }
      cur = { name, site, part:this.openPart && this.openPart.id,
              min:[1e9,1e9,1e9], max:[-1e9,-1e9,-1e9], n:0 };
      recs.push(cur);
    }
    depth++;
    try { return fn.apply(this, a); } finally { if(--depth === 0) cur = null; }
  };
}
const _v = B.prototype._v;
B.prototype._v = function(g,x,y,z,...rest){
  const i = _v.call(this,g,x,y,z,...rest);
  if(cur){
    const p = g.pos, k = p.length-3;
    for(let a=0;a<3;a++){
      if(p[k+a] < cur.min[a]) cur.min[a] = p[k+a];
      if(p[k+a] > cur.max[a]) cur.max[a] = p[k+a];
    }
    cur.n++;
  }
  return i;
};

ctx.__buildScene(null);

const A = process.argv.slice(2).map(Number);
const [x0,x1,y0,y1,z0,z1] = A.length===6 ? A : [-8,20,0,30,468,492];
const hit = recs.filter(r => r.n &&
  r.max[0] >= x0 && r.min[0] <= x1 &&
  r.max[1] >= y0 && r.min[1] <= y1 &&
  r.max[2] >= z0 && r.min[2] <= z1);

const F = n => n.toFixed(1).padStart(7);
console.log(`box  x ${x0}..${x1}   y ${y0}..${y1}   z ${z0}..${z1}`);
console.log(`${recs.length} emitter calls, ${hit.length} in the box\n`);
console.log('  site                        part            call        '+
            '     x range            y range            z range');
for(const r of hit.sort((a,b)=>a.min[2]-b.min[2] || a.min[0]-b.min[0]))
  console.log(`  ${r.site.padEnd(26)} ${String(r.part).padEnd(15)} ${r.name.padEnd(12)}`+
              `${F(r.min[0])}..${F(r.max[0])}  ${F(r.min[1])}..${F(r.max[1])}  `+
              `${F(r.min[2])}..${F(r.max[2])}`);
