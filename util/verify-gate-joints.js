/* The Double/Triple Gate surrounds must meet without overlapping fronts. */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const code=['10-math','20-textures','30-geom','40-data','50-build-mount','55-build-temple']
  .map(f=>fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8')).join('\n');
const {groups,samples}=vm.runInNewContext(code+`
  const gb=new Builder(); buildHuldahGates(gb);
  const gs=[];
  for(const [g,n] of [[GATES.double,2],[GATES.triple,3]]){
    const bw=g.w/n, spring=HULDAH_SILL+g.h*0.55;
    for(let i=1;i<n;i++) for(const off of [-0.13,0.13])
      for(const y of [HULDAH_SILL+1.23,spring-0.21,spring+0.37,spring+1.11])
        gs.push([g.at-g.w/2+bw*i+off,y,PLAT.SW[1]+2.35-0.2]);
  }
  ({groups:[...gb.groups.values()].filter(g=>g.mat==='ashlarFine'),samples:gs});
`,{console,performance,navigator:{},document:{}});
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
for(const p of samples){
  let count=0;
  for(const g of groups) for(let i=0;i<g.idx.length;i+=3){
    const tri=g.idx.slice(i,i+3).map(k=>g.pos.slice(k*3,k*3+3));
    if(!tri.every(v=>Math.abs(v[2]-p[2])<1e-4)) continue;
    const sides=tri.map((v,j)=>cross(v,tri[(j+1)%3],p));
    if(sides.every(s=>s>1e-6)||sides.every(s=>s< -1e-6)) count++;
  }
  if(count!==1) throw Error('Gate joint '+p.join(',')+' has '+count+' faces; expected 1');
}
console.log('Passed: '+samples.length+' gate-joint samples have exactly one stone face.');
