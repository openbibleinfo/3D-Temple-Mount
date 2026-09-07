/* Export the existing procedural scene without browser lighting or AO.
 * node util/export-still.js [output-directory]
 * node util/export-still.js [output-directory] --textures-dom
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const out = path.resolve(process.argv[2] || 'captures/still');
fs.mkdirSync(out, {recursive:true});
if (process.argv.includes('--textures-dom')) {
  const dom = fs.readFileSync(path.join(out, 'textures-dom.html'), 'utf8');
  const match = dom.match(/<pre id="result">([^<]+)<\/pre>/);
  if (!match) throw new Error('Browser did not export textures; inspect textures-dom.html');
  const textures = JSON.parse(match[1]);
  for (const [name, data] of Object.entries(textures)) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid texture name');
    fs.writeFileSync(path.join(out, name+'.png'), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('Exported', Object.keys(textures).length, 'textures');
} else {
  const read = name => fs.readFileSync(path.join(__dirname, '../src', name+'.js'), 'utf8');
  const names = ['10-math','20-textures','30-geom','40-data','50-build-mount','55-build-temple','60-gl'];
  const ctx = vm.createContext({console, performance, navigator:{}, document:{}});
  const scene = vm.runInContext(names.map(read).join('\n') + `
    (()=>{
      const B = new Builder();
      for (const [,build] of SCENE_STEPS) build(B);
      const groups = [...B.groups.values()].filter(g=>g.idx.length &&
        !['nodraw','overlay','grid','interior','people'].includes(g.layer) &&
        g.mat !== 'marker');
      // Shadow geometry also backs underground entrances. Dropping it exposes
      // retaining masonry and makes the gates look sealed instead of dark.
      const point = (x,z,y) => {const w=precinctToWorld(x,z); return [w[0],y,w[1]];};
      const particles = [];
      for (let i=0; i<PUFFS.vertices.length; i+=36)
        particles.push(Array.from(PUFFS.vertices.slice(i,i+9)));
      return {groups, materials:MATERIALS, parts:B.parts, particles,
        camera:{eye:point(520,385,195),target:point(255,210,23),fov:60},
        cameras:{
          close:{eye:point(520,385,195),target:point(255,210,23),fov:60},
          overview:{eye:[381.52,236.8,43.2],target:[145,10,270],fov:60}
        },
        hour:9, sun:sunVector(9.0)};
    })()
  `, ctx);
  for (const g of scene.groups) {
    for (const key of ['pos','nrm','uv'])
      if (!g[key].every(Number.isFinite)) throw new Error('Non-finite '+g.mat+' '+key);
    if (!g.idx.every(i=>Number.isInteger(i)&&i>=0&&i<g.pos.length/3)) throw new Error('Invalid indices');
    delete g.ao;
  }
  fs.writeFileSync(path.join(out,'scene.json'), JSON.stringify(scene));
  // Blender's existing 60-degree framing is horizontal; WebGL uses vertical FOV.
  const views = Object.fromEntries(Object.entries(scene.cameras).map(([name,c]) => {
    const fov = 2*Math.atan(Math.tan(c.fov*Math.PI/360)/(4/3))*180/Math.PI;
    return [name, {width:1024,height:768,query:new URLSearchParams({
      cam:[...c.eye,...c.target].join(','),fov:String(fov),hour:String(scene.hour),
      ui:'none',people:'0',city:'1',roofs:'1',section:'0',fire:'1',t:'2'
    }).toString()}];
  }));
  fs.writeFileSync(path.join(out,'views.json'), JSON.stringify(views,null,2)+'\n');
  const browser = ['10-math','20-textures','60-gl'].map(read).join('\n');
  fs.writeFileSync(path.join(out,'textures.html'), '<!doctype html><pre id="result"></pre><script>\n'+browser+`
    const exported = {};
    for (const [name,mat] of Object.entries(MATERIALS)) {
      const canvas = mat.tex();
      exported[name] = canvas.toDataURL('image/png');
      if(mat.bump) exported[name+'_normal'] = TexLib.normalMap(canvas,mat.bump).toDataURL('image/png');
    }
    document.getElementById('result').textContent=JSON.stringify(exported);
  </script>`);
  console.log('Exported', scene.groups.length, 'groups;',scene.groups.reduce((n,g)=>n+g.idx.length/3,0),'triangles');
}
