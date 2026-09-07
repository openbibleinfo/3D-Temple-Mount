/* Regression: the six court junctions and sixteen chamber corners must have
 * exactly one exposed top surface, not overlapping caps. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['10-math','20-textures','30-geom','40-data','50-build-mount','55-build-temple'];
const code = files.map(f=>fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8')).join('\n');
const result = vm.runInNewContext(code + `
  const jointBuilder = new Builder();
  buildCourtWalls(jointBuilder);
  buildCourtOfWomen(jointBuilder);
  buildNicanor(jointBuilder);
  const jointSamples = [];
  for(const x of [CT.x0+0.31,CT.x1-0.31,cu(AZ.x1)-0.31])
    for(const z of [CT.z0+0.43,CT.z1-0.43])
      jointSamples.push([x,x>cu(AZ.x1)?cu(30):cu(40),z]);
  const chamberSize=cu(40);
  for(const cx of [cu(CW.x0)+chamberSize/2,cu(CW.x1)-chamberSize/2])
    for(const cz of [CT.z0+chamberSize/2,CT.z1-chamberSize/2])
      for(const sx of [-1,1]) for(const sz of [-1,1])
        jointSamples.push([cx+sx*(chamberSize/2-0.21),LEV.women+cu(14),
                           cz+sz*(chamberSize/2-0.33)]);
  ({groups:[...jointBuilder.groups.values()],samples:jointSamples.map(p=>{
    const w=precinctToWorld(p[0]/CUBIT,p[2]/CUBIT); return [w[0],p[1],w[1]];
  })});
`, {console,performance,navigator:{},document:{}});
const cross = (a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
for(const p of result.samples){
  let count=0;
  for(const g of result.groups) for(let i=0;i<g.idx.length;i+=3){
    const tri=g.idx.slice(i,i+3).map(k=>g.pos.slice(k*3,k*3+3));
    if(!tri.every(v=>Math.abs(v[1]-p[1])<1e-4)) continue;
    const sides=tri.map((v,j)=>cross(v,tri[(j+1)%3],p));
    if(sides.every(s=>s>1e-6)||sides.every(s=>s< -1e-6)) count++;
  }
  if(count!==1) throw Error('Wall joint '+p.join(',')+' has '+count+' surfaces; expected 1');
}
console.log('Passed: '+result.samples.length+' wall junctions have exactly one top surface.');
