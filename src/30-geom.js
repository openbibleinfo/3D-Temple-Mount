/* =====================================================================
 *  30—geometry builder
 *
 *  Accumulates triangles into (material, layer) groups. Each group later
 *  becomes one draw range in a single merged buffer, so the whole model
 *  renders in ~20 draw calls.
 *
 *  Vertex layout: position(3) normal(3) uv(2) ao(1) = 9 floats.
 *  `ao` is a hand-placed occlusion/tint term—cheap contact darkening
 *  that costs nothing at runtime and does a lot of the visual work.
 *
 *  World axes:  +X east,  +Y up,  +Z south.  Units are meters.
 * ===================================================================== */
'use strict';

class Builder {
  constructor(){
    this.groups = new Map();          // "mat|layer" -> group
    this.stack  = [M4.create()];
    this.parts  = [];
    this.openPart = null;
  }

  /* ---------------- transform stack ---------------- */
  get M(){ return this.stack[this.stack.length-1]; }
  pushM(m){ this.stack.push(M4.mul(M4.create(), this.M, m)); return this; }
  pushT(x,y,z){ return this.pushM(M4.translation(M4.create(),x,y,z)); }
  pushRotY(a){ return this.pushM(M4.rotationY(M4.create(),a)); }
  pushRotX(a){ return this.pushM(M4.rotationX(M4.create(),a)); }
  pushRotZ(a){ return this.pushM(M4.rotationZ(M4.create(),a)); }
  pop(){ this.stack.pop(); return this; }

  /* ---------------- parts, for picking and labels ---------------- */
  beginPart(id, meta){
    this.openPart = Object.assign({
      id, min:[ 1e9, 1e9, 1e9], max:[-1e9,-1e9,-1e9], nv:0
    }, meta);
    return this;
  }
  endPart(){
    const p = this.openPart;
    this.openPart = null;
    if(!p || p.nv===0) return this;
    p.center = [ (p.min[0]+p.max[0])/2, (p.min[1]+p.max[1])/2, (p.min[2]+p.max[2])/2 ];
    p.size   = [ p.max[0]-p.min[0], p.max[1]-p.min[1], p.max[2]-p.min[2] ];
    /* Specificity for picking. Volume is the wrong measure: the esplanade
       and the soreg are effectively flat, so their volume is ~0 and they
       would win every click. The sum of the dimensions ranks a small solid
       thing above a large thin one, which is what we want. */
    p.extent = p.size[0] + p.size[1] + p.size[2];
    if(!p.at) p.at = [p.center[0], p.max[1], p.center[2]];
    this.parts.push(p);
    return this;
  }
  /* wrap a build function in a part */
  part(id, meta, fn){
    this.beginPart(id, meta); fn(); this.endPart(); return this;
  }

  /* ---------------- group access ---------------- */
  g(mat, layer){
    const k = mat+'|'+(layer||'base');
    let grp = this.groups.get(k);
    if(!grp){
      grp = { mat, layer:layer||'base', pos:[], nrm:[], uv:[], ao:[], idx:[], nv:0 };
      this.groups.set(k, grp);
    }
    return grp;
  }

  /* ---------------- primitive emit ---------------- */
  _v(g, x,y,z, nx,ny,nz, u,v, ao){
    const M = this.M;
    const w = M[3]*x+M[7]*y+M[11]*z+M[15] || 1;
    const wx = (M[0]*x+M[4]*y+M[8]*z+M[12])/w;
    const wy = (M[1]*x+M[5]*y+M[9]*z+M[13])/w;
    const wz = (M[2]*x+M[6]*y+M[10]*z+M[14])/w;
    g.pos.push(wx,wy,wz);
    /* rotation-only transforms here, so the 3x3 suffices for normals */
    let tnx = M[0]*nx+M[4]*ny+M[8]*nz;
    let tny = M[1]*nx+M[5]*ny+M[9]*nz;
    let tnz = M[2]*nx+M[6]*ny+M[10]*nz;
    const l = Math.hypot(tnx,tny,tnz)||1;
    g.nrm.push(tnx/l,tny/l,tnz/l);
    g.uv.push(u,v);
    g.ao.push(ao===undefined?1:ao);
    const p = this.openPart;
    if(p){
      if(wx<p.min[0])p.min[0]=wx; if(wx>p.max[0])p.max[0]=wx;
      if(wy<p.min[1])p.min[1]=wy; if(wy>p.max[1])p.max[1]=wy;
      if(wz<p.min[2])p.min[2]=wz; if(wz>p.max[2])p.max[2]=wz;
      p.nv++;
    }
    return g.nv++;
  }

  /* quad, wound counter-clockwise seen from the front */
  quad(mat,layer, a,b,c,d, uvs, ao, nrm){
    const g = this.g(mat,layer);
    let n = nrm;
    if(!n){
      const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
      n = V3.norm(V3.cross(e1,e2));
    }
    const A = Array.isArray(ao)?ao:[ao,ao,ao,ao];
    const i0=this._v(g,a[0],a[1],a[2],n[0],n[1],n[2],uvs[0],uvs[1],A[0]);
    const i1=this._v(g,b[0],b[1],b[2],n[0],n[1],n[2],uvs[2],uvs[3],A[1]);
    const i2=this._v(g,c[0],c[1],c[2],n[0],n[1],n[2],uvs[4],uvs[5],A[2]);
    const i3=this._v(g,d[0],d[1],d[2],n[0],n[1],n[2],uvs[6],uvs[7],A[3]);
    g.idx.push(i0,i1,i2, i0,i2,i3);
    return this;
  }

  tri(mat,layer, a,b,c, uvs, ao, nrm){
    const g=this.g(mat,layer);
    let n=nrm;
    if(!n){
      const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      n=V3.norm(V3.cross(e1,e2));
    }
    const A=Array.isArray(ao)?ao:[ao,ao,ao];
    const i0=this._v(g,a[0],a[1],a[2],n[0],n[1],n[2],uvs[0],uvs[1],A[0]);
    const i1=this._v(g,b[0],b[1],b[2],n[0],n[1],n[2],uvs[2],uvs[3],A[1]);
    const i2=this._v(g,c[0],c[1],c[2],n[0],n[1],n[2],uvs[4],uvs[5],A[2]);
    g.idx.push(i0,i1,i2);
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  box—x,z are the center, y is the BOTTOM (architectural habit).
   *  UVs come from local coordinates so that texture runs continuously
   *  across abutting boxes, and follows any rotation on the stack.
   *  opt.skip: string of face letters to omit, from "NSEWTB".
   * ------------------------------------------------------------------ */
  box(mat,layer,o){
    const s = o.uv===undefined?0.25:o.uv;      // texture repeats per meter
    const hx=o.sx/2, hz=o.sz/2;
    const x0=o.x-hx, x1=o.x+hx, y0=o.y, y1=o.y+o.sy, z0=o.z-hz, z1=o.z+hz;
    const skip = o.skip||'';
    const ao = o.ao===undefined?1:o.ao;
    const aoT = o.aoTop===undefined?ao:o.aoTop;
    const aoB = o.aoBot===undefined?ao*0.55:o.aoBot;
    /* a touch of vertical gradient makes big blank walls read better */
    const gLo = o.grad===undefined?1:(1-o.grad), gHi = 1;
    const U = (a)=>a*s, V=(a)=>a*s;
    const uo = o.uo||0, vo = o.vo||0;

    if(!skip.includes('E'))
      this.quad(mat,layer,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],
        [U(z1)+uo,V(y0)+vo, U(z0)+uo,V(y0)+vo, U(z0)+uo,V(y1)+vo, U(z1)+uo,V(y1)+vo],
        [ao*gLo,ao*gLo,ao*gHi,ao*gHi],[1,0,0]);
    if(!skip.includes('W'))
      this.quad(mat,layer,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],
        [U(z0)+uo,V(y0)+vo, U(z1)+uo,V(y0)+vo, U(z1)+uo,V(y1)+vo, U(z0)+uo,V(y1)+vo],
        [ao*gLo,ao*gLo,ao*gHi,ao*gHi],[-1,0,0]);
    if(!skip.includes('S'))
      this.quad(mat,layer,[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1],
        [U(x1)+uo,V(y0)+vo, U(x1)+uo,V(y1)+vo, U(x0)+uo,V(y1)+vo, U(x0)+uo,V(y0)+vo],
        [ao*gLo,ao*gHi,ao*gHi,ao*gLo],[0,0,1]);
    if(!skip.includes('N'))
      this.quad(mat,layer,[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],
        [U(x0)+uo,V(y0)+vo, U(x0)+uo,V(y1)+vo, U(x1)+uo,V(y1)+vo, U(x1)+uo,V(y0)+vo],
        [ao*gLo,ao*gHi,ao*gHi,ao*gLo],[0,0,-1]);
    if(!skip.includes('T'))
      this.quad(mat,layer,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],
        [U(x0)+uo,V(z1)+vo, U(x1)+uo,V(z1)+vo, U(x1)+uo,V(z0)+vo, U(x0)+uo,V(z0)+vo],
        aoT,[0,1,0]);
    if(!skip.includes('B'))
      this.quad(mat,layer,[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],
        [U(x0)+uo,V(z0)+vo, U(x1)+uo,V(z0)+vo, U(x1)+uo,V(z1)+vo, U(x0)+uo,V(z1)+vo],
        aoB,[0,-1,0]);
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  wall—a prism along a horizontal segment. Used for the retaining
   *  walls (which are not axis-aligned) and every court wall.
   *  `batter` insets the top face on both sides, as Herodian retaining
   *  walls were built with a slight inward lean.
   * ------------------------------------------------------------------ */
  wall(mat,layer,o){
    const [ax,az]=o.from, [bx,bz]=o.to;
    const dx=bx-ax, dz=bz-az, len=Math.hypot(dx,dz);
    if(len<1e-6) return this;
    const ux=dx/len, uz=dz/len;             // along
    const px=-uz,   pz=ux;                  // left normal (perp)
    /* `batter` insets the top face, `batter0` the bottom. A wall built in
       several stacked bands needs both, or each band starts back at the full
       thickness and the lean comes out as a flight of steps down the face. */
    const t=o.thick/2, bt=(o.batter||0), bt0=(o.batter0||0);
    const y0=o.y0, y1=o.y1;
    const s=o.uv===undefined?0.25:o.uv;
    const u0=(o.uStart||0)*s, u1=u0+len*s;
    const v0=y0*s, v1=y1*s;
    const ao=o.ao===undefined?1:o.ao;
    const gLo=o.grad===undefined?1:(1-o.grad);

    const P=(a,side,y,inset)=>{
      const along = a? len:0;
      const off = (t-inset)*side;
      return [ax+ux*along+px*off, y, az+uz*along+pz*off];
    };
    // two long faces
    if(!o.skip || !o.skip.includes('L'))
      this.quad(mat,layer, P(0,1,y0,bt0),P(1,1,y0,bt0),P(1,1,y1,bt),P(0,1,y1,bt),
        [u0,v0,u1,v0,u1,v1,u0,v1],[ao*gLo,ao*gLo,ao,ao]);
    if(!o.skip || !o.skip.includes('R'))
      this.quad(mat,layer, P(1,-1,y0,bt0),P(0,-1,y0,bt0),P(0,-1,y1,bt),P(1,-1,y1,bt),
        [u1,v0,u0,v0,u0,v1,u1,v1],[ao*gLo,ao*gLo,ao,ao]);
    // ends
    if(o.caps!==false){
      this.quad(mat,layer, P(1,1,y0,bt0),P(1,-1,y0,bt0),P(1,-1,y1,bt),P(1,1,y1,bt),
        [0,v0,o.thick*s,v0,o.thick*s,v1,0,v1],[ao*gLo,ao*gLo,ao,ao]);
      this.quad(mat,layer, P(0,-1,y0,bt0),P(0,1,y0,bt0),P(0,1,y1,bt),P(0,-1,y1,bt),
        [0,v0,o.thick*s,v0,o.thick*s,v1,0,v1],[ao*gLo,ao*gLo,ao,ao]);
    }
    // top
    if(o.top!==false)
      this.quad(mat,layer, P(0,1,y1,bt),P(1,1,y1,bt),P(1,-1,y1,bt),P(0,-1,y1,bt),
        [u0,0,u1,0,u1,o.thick*s,u0,o.thick*s], o.aoTop===undefined?ao:o.aoTop, [0,1,0]);
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  cylinder / cone. Optional fluting by modulating the radius.
   *  uvU = meters of texture around the circumference,
   *  uvV = meters of texture up the shaft.
   * ------------------------------------------------------------------ */
  cyl(mat,layer,o){
    const g=this.g(mat,layer);
    const seg=o.seg||20, r0=o.r0, r1=o.r1===undefined?o.r0:o.r1, h=o.h;
    const fl=o.flutes||0, fd=o.fluteDepth||0.045;
    const uS=o.uvU===undefined?0.5:o.uvU, vS=o.uvV===undefined?0.25:o.uvV;
    const ao=o.ao===undefined?1:o.ao, aoLo=o.aoBot===undefined?ao*0.7:o.aoBot;
    const rings = o.rings||1;
    const yAt = k => o.y + h*k;
    const rAt = k => lerp(r0,r1,k);
    const base=g.nv;
    for(let ry=0; ry<=rings; ry++){
      const k=ry/rings, y=yAt(k), rr=rAt(k);
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2;
        const fm = fl? (1 - fd*Math.abs(Math.sin(a*fl/2))) : 1;
        const r = rr*fm;
        const cx=Math.cos(a), cz=Math.sin(a);
        // normal accounts for taper
        const dr=(rAt(1)-rAt(0));
        const n=V3.norm([cx*h, -dr, cz*h]);
        this._v(g, o.x+cx*r, y, o.z+cz*r, n[0],n[1],n[2],
                 a/(Math.PI*2)*(Math.PI*2*rr)*uS, y*vS,
                 lerp(aoLo,ao,k));
      }
    }
    const stride=seg+1;
    /* Winding: vertices run counter-clockwise in x/z as the angle increases,
       which—in this right-handed frame with +Z south—puts the geometric
       normal of (a,b,d) INWARD, so every cylinder was culled from outside and
       what you actually saw was the inside of its far wall. Reversed. */
    for(let ry=0;ry<rings;ry++){
      for(let i=0;i<seg;i++){
        const a=base+ry*stride+i, b=a+1, c=a+stride, d=c+1;
        g.idx.push(a,d,b, a,c,d);
      }
    }
    if(o.capTop){
      const y=yAt(1), rr=rAt(1), ci=this._v(g,o.x,y,o.z,0,1,0,0,0,ao);
      const ring=[];
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2;
        ring.push(this._v(g,o.x+Math.cos(a)*rr,y,o.z+Math.sin(a)*rr,0,1,0,
                          Math.cos(a)*rr*uS,Math.sin(a)*rr*uS,ao));
      }
      for(let i=0;i<seg;i++) g.idx.push(ci,ring[i+1],ring[i]);   // faces +Y
    }
    if(o.capBot){
      const y=yAt(0), rr=rAt(0), ci=this._v(g,o.x,y,o.z,0,-1,0,0,0,aoLo);
      const ring=[];
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2;
        ring.push(this._v(g,o.x+Math.cos(a)*rr,y,o.z+Math.sin(a)*rr,0,-1,0,
                          Math.cos(a)*rr*uS,Math.sin(a)*rr*uS,aoLo));
      }
      for(let i=0;i<seg;i++) g.idx.push(ci,ring[i],ring[i+1]);   // faces -Y
    }
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  A complete classical column: plinth, base, shaft with entasis,
   *  capital. `order` picks the capital treatment.
   * ------------------------------------------------------------------ */
  column(o){
    const mat=o.mat||'marble', layer=o.layer||'base';
    const d=o.d, r=d/2, H=o.h;
    const order=o.order||'corinthian';
    // proportions after the Herodian columns recovered on the Mount
    const plinthH = H*0.018, baseH = H*0.042;
    const capH    = order==='corinthian' ? H*0.115 : H*0.055;
    const shaftH  = H - plinthH - baseH - capH;
    const y=o.y||0;

    if(o.plinth!==false)
      this.box(mat,layer,{x:o.x,z:o.z,y:y,sx:d*1.36,sy:plinthH,sz:d*1.36,
                          uv:0.5,ao:0.72,skip:'B'});
    let yy=y+plinthH;
    // Attic base: two swelling tori (one, at distance)
    if(o.lod===0){
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy,r0:r*1.20,r1:r*1.02,h:baseH,seg:o.seg||18,
                          uvU:0.5,uvV:0.4,ao:0.85});
    } else {
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy,r0:r*1.20,r1:r*1.10,h:baseH*0.5,seg:o.seg||18,uvU:0.5,uvV:0.4,ao:0.82});
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy+baseH*0.5,r0:r*1.10,r1:r*1.02,h:baseH*0.5,seg:o.seg||18,uvU:0.5,uvV:0.4,ao:0.88});
    }
    yy+=baseH;
    // shaft, with entasis—swells slightly at a third of its height
    const seg=o.seg||18;
    this.cyl(mat,layer,{x:o.x,z:o.z,y:yy,r0:r,r1:r*0.845,h:shaftH,seg:seg,
                        rings:o.lod===0?1:3,
                        flutes:o.flutes||0, uvU:o.uvU||0.42, uvV:0.16, ao:1, aoBot:0.9});
    yy+=shaftH;
    const rTop=r*0.845;
    if(order==='corinthian'){
      /* Detail level. There are ~650 columns in the model and a full
         Corinthian capital is ~300 triangles, so the porticoes—which are
         only ever seen at a distance—get one tier of leaves and no
         volutes. Pass lod:1 for anything you can walk up to. */
      const lod = o.lod===undefined ? 1 : o.lod;
      /* THE BELL HAS TO REACH THE ABACUS. It stopped at 0.62 of the capital's
         height and the abacus does not begin until 0.80, so every column in the
         model had a band of daylight a fifth of its capital deep running right
         round under the abacus—bridged only by four volutes, and a good hand's
         breadth wide on a portico column. The bell now carries up to the
         abacus's underside in two cones, flaring as a bell does rather than as
         one straight cone, so the volutes still stand clear of it. */
      // acanthus bell
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy,r0:rTop*1.02,r1:rTop*1.24,h:capH*0.62,
                          seg:seg,rings:lod?2:1,uvU:0.5,uvV:0.5,ao:0.94});
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy+capH*0.62,r0:rTop*1.24,r1:rTop*1.30,
                          h:capH*0.20,seg:seg,uvU:0.5,uvV:0.5,ao:0.97});
      // leaves, suggested by small tapered blocks
      const tiers = lod ? 2 : 1;
      for(let tier=0;tier<tiers;tier++){
        const n=8, yb=yy+capH*0.05+tier*capH*0.26;
        for(let i=0;i<n;i++){
          const a=i/n*Math.PI*2 + (tier?Math.PI/n:0);
          const rr=rTop*(1.06+tier*0.14);
          this.pushT(o.x+Math.cos(a)*rr, yb, o.z+Math.sin(a)*rr);
          this.pushRotY(-a);
          this.box(mat,layer,{x:0,z:0,y:0,sx:rTop*0.24,sy:capH*0.30,sz:rTop*0.5,
                              uv:0.9,ao:0.8,skip:'B'});
          this.pop(); this.pop();
        }
      }
      /* Volutes on the DIAGONALS, where the abacus reaches 1.36·√2 = 1.92 rTop,
         so they have to stand further out than the bell to read at all. At 1.24
         they were inside it. */
      if(lod) for(let i=0;i<4;i++){
        const a=Math.PI/4 + i*Math.PI/2, rr=rTop*1.46;
        this.cyl(mat,layer,{x:o.x+Math.cos(a)*rr, z:o.z+Math.sin(a)*rr, y:yy+capH*0.58,
                            r0:rTop*0.17,r1:rTop*0.10,h:capH*0.28,seg:8,uvU:1,uvV:1,ao:0.9});
      }
      // abacus
      this.box(mat,layer,{x:o.x,z:o.z,y:yy+capH*0.80,sx:rTop*2.72,sy:capH*0.20,sz:rTop*2.72,
                          uv:0.5,ao:1,aoBot:0.72});
    } else if(order==='ionic'){
      /* and up to the abacus at 0.62, not short of it at 0.50 */
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy,r0:rTop*1.02,r1:rTop*1.16,h:capH*0.64,seg:seg,uvU:0.5,uvV:0.5,ao:0.94});
      for(const sgn of [-1,1])
        this.cyl(mat,layer,{x:o.x+sgn*rTop*0.95,z:o.z,y:yy+capH*0.28,r0:rTop*0.42,r1:rTop*0.42,
                            h:rTop*0.5,seg:10,uvU:1,uvV:1,ao:0.9});
      this.box(mat,layer,{x:o.x,z:o.z,y:yy+capH*0.62,sx:rTop*2.5,sy:capH*0.38,sz:rTop*2.5,uv:0.5,ao:1,aoBot:0.72});
    } else {
      this.cyl(mat,layer,{x:o.x,z:o.z,y:yy,r0:rTop*1.04,r1:rTop*1.18,h:capH*0.55,seg:seg,uvU:0.5,uvV:0.5,ao:0.94});
      this.box(mat,layer,{x:o.x,z:o.z,y:yy+capH*0.55,sx:rTop*2.5,sy:capH*0.45,sz:rTop*2.5,uv:0.5,ao:1,aoBot:0.72});
    }
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  stairs. `dir` is the direction of ascent: 'N','S','E','W'.
   *  (x,z) is the center of the bottom step's leading edge.
   * ------------------------------------------------------------------ */
  stairs(mat,layer,o){
    const n=o.n, rise=o.rise, tread=o.tread, w=o.w;
    const dir=o.dir||'W';
    const ax = (dir==='E')?1:(dir==='W')?-1:0;
    const az = (dir==='S')?1:(dir==='N')?-1:0;
    for(let i=0;i<n;i++){
      // each step is a slab reaching back to the top, so no gaps show
      const depth = tread*(n-i);
      const cx = o.x + ax*(tread*i + depth/2);
      const cz = o.z + az*(tread*i + depth/2);
      const sx = ax? depth : w, sz = az? depth : w;
      this.box(mat,layer,{
        x:cx, z:cz, y:o.y, sx, sy:rise*(i+1), sz,
        uv:o.uv===undefined?0.5:o.uv, ao:lerp(0.74,1,i/Math.max(1,n-1)),
        aoTop:lerp(0.8,1,i/Math.max(1,n-1)), skip:'B'
      });
    }
    return this;
  }

  /* semicircular flight—the fifteen steps up to the Nicanor Gate,
     "shaped like the half of a round threshing floor" (Middot 2:5).
     Opens toward +u (east) by default; rotate with the stack. */
  ringStairs(mat,layer,o){
    const g=this.g(mat,layer);
    const n=o.n, rise=o.rise, tread=o.tread;
    const seg=o.seg||24, rIn=o.rInner;
    const s=o.uv===undefined?0.5:o.uv;
    for(let i=0;i<n;i++){
      const rOuter = rIn + tread*(n-i);
      const rInner = rIn;
      const y = o.y + rise*(i+1);
      const aoT = lerp(0.8,1,i/Math.max(1,n-1));
      /* Tread (annulus, half circle). UVs are planar in world x/z, not
         tread-by-arc: a tread is only one cubit deep, so mapping u across it
         showed 6% of the texture and the treads came out flat and untextured
         while the risers, mapped along the arc, did not. Planar UVs also run
         the paving continuously across the whole flight, which is how a
         stone-flagged stair actually looks. */
      for(let j=0;j<seg;j++){
        const a0=-Math.PI/2 + j/seg*Math.PI, a1=-Math.PI/2 + (j+1)/seg*Math.PI;
        const p=(a,r)=>[o.x+Math.cos(a)*r, y, o.z+Math.sin(a)*r];
        const t=(a,r)=>[(o.x+Math.cos(a)*r)*s, (o.z+Math.sin(a)*r)*s];
        const A=t(a0,rInner), B=t(a0,rOuter), C=t(a1,rOuter), D=t(a1,rInner);
        /* reversed: emitted radial-then-tangential the winding faces DOWN */
        this.quad(mat,layer, p(a0,rInner),p(a1,rInner),p(a1,rOuter),p(a0,rOuter),
          [A[0],A[1], D[0],D[1], C[0],C[1], B[0],B[1]], aoT,[0,1,0]);
      }
      // riser (outer cylindrical face)
      for(let j=0;j<seg;j++){
        const a0=-Math.PI/2 + j/seg*Math.PI, a1=-Math.PI/2 + (j+1)/seg*Math.PI;
        const yb=y-rise;
        const q=(a,yy)=>[o.x+Math.cos(a)*rOuter, yy, o.z+Math.sin(a)*rOuter];
        const nA=[Math.cos(a0),0,Math.sin(a0)];
        this.quad(mat,layer, q(a1,yb),q(a0,yb),q(a0,y),q(a1,y),
          [0,yb*s, (a1-a0)*rOuter*s,yb*s, (a1-a0)*rOuter*s,y*s, 0,y*s],
          lerp(0.68,0.94,i/Math.max(1,n-1)), nA);
      }
      // flat ends of the flight
      /* The two flat ends of the flight. Both lie in the plane of constant
         local X that contains the diameter, so both face -X—away from the
         half-disc, into the wall the flight is built against. */
      for(const a of [-Math.PI/2, Math.PI/2]){
        const yb=y-rise;
        const p=(r,yy)=>[o.x+Math.cos(a)*r, yy, o.z+Math.sin(a)*r];
        this.quad(mat,layer, p(rInner,yb),p(rInner,y),p(rOuter,y),p(rOuter,yb),
          [0,0, 0,rise*s, (rOuter-rInner)*s,rise*s, (rOuter-rInner)*s,0], 0.8, [-1,0,0]);
      }
    }
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  gable roof over a rectangular hall. `ridge` runs E-W ('x') or
   *  N-S ('z'). Includes eaves overhang and the two tympana.
   * ------------------------------------------------------------------ */
  gableRoof(mat,layer,o){
    const w=o.sx, d=o.sz, oh=o.overhang||0.6, rh=o.ridgeH;
    /* Separate overhangs: the eaves project, the gable ends should not. A
       single value pushed the ends out past the building's own end walls. */
    const ohE = o.overhangEnd===undefined ? oh : o.overhangEnd;
    const xr = (o.ridge||'x')==='x' ? ohE : oh;
    const zr = (o.ridge||'x')==='x' ? oh  : ohE;
    const x0=o.x-w/2-xr, x1=o.x+w/2+xr, z0=o.z-d/2-zr, z1=o.z+d/2+zr;
    const y0=o.y, y1=o.y+rh;
    const s=o.uv===undefined?0.25:o.uv;
    const gm = o.gableMat||mat;
    /* Thickness. Without an underside the roof was a pair of single-sided
       planes: stand below the eaves and you looked straight through it, so
       nothing appeared to connect the roof to the building. */
    const t = o.soffit===undefined?0.5:o.soffit;
    const under = (A,B,C,D,uvs,ao)=>{
      const dn = p => [p[0], p[1]-t, p[2]];
      this.quad(mat,layer, dn(A),dn(D),dn(C),dn(B),
        [uvs[0],uvs[1], uvs[6],uvs[7], uvs[4],uvs[5], uvs[2],uvs[3]], ao*0.62);
    };
    const fascia = (A,B,uvw,ao)=>{
      const dn = p => [p[0], p[1]-t, p[2]];
      this.quad(mat,layer, dn(A),A,B,dn(B), [0,0, 0,t*s, uvw,t*s, uvw,0], ao*0.8);
    };
    if((o.ridge||'x')==='x'){
      const zm=o.z;
      const slope=Math.hypot(rh, d/2+oh);
      const uvS=[0,0,(x1-x0)*s,0,(x1-x0)*s,slope*s,0,slope*s];
      const S1=[x0,y0,z1], S2=[x1,y0,z1], S3=[x1,y1,zm], S4=[x0,y1,zm];
      const N1=[x1,y0,z0], N2=[x0,y0,z0], N3=[x0,y1,zm], N4=[x1,y1,zm];
      this.quad(mat,layer,S1,S2,S3,S4,uvS,1);
      this.quad(mat,layer,N1,N2,N3,N4,uvS,0.9);
      under(S1,S2,S3,S4,uvS,1); under(N1,N2,N3,N4,uvS,0.9);
      fascia(S2,S1,(x1-x0)*s,1); fascia(N2,N1,(x1-x0)*s,0.9);
      // tympana
      this.tri(gm,layer,[x0,y0,z0],[x0,y0,z1],[x0,y1,zm],
        [0,0,(z1-z0)*s,0,(z1-z0)*s/2,rh*s],0.92,[-1,0,0]);
      this.tri(gm,layer,[x1,y0,z1],[x1,y0,z0],[x1,y1,zm],
        [0,0,(z1-z0)*s,0,(z1-z0)*s/2,rh*s],0.92,[1,0,0]);
    } else {
      const xm=o.x;
      const slope=Math.hypot(rh, w/2+oh);
      const uvS=[0,0,(z1-z0)*s,0,(z1-z0)*s,slope*s,0,slope*s];
      const E1=[x1,y0,z0], E2=[x1,y0,z1], E3=[xm,y1,z1], E4=[xm,y1,z0];
      const W1=[x0,y0,z1], W2=[x0,y0,z0], W3=[xm,y1,z0], W4=[xm,y1,z1];
      this.quad(mat,layer,E1,E2,E3,E4,uvS,1);
      this.quad(mat,layer,W1,W2,W3,W4,uvS,0.9);
      under(E1,E2,E3,E4,uvS,1); under(W1,W2,W3,W4,uvS,0.9);
      fascia(E2,E1,(z1-z0)*s,1); fascia(W2,W1,(z1-z0)*s,0.9);
      this.tri(gm,layer,[x0,y0,z0],[x1,y0,z0],[xm,y1,z0],
        [0,0,(x1-x0)*s,0,(x1-x0)*s/2,rh*s],0.92,[0,0,-1]);
      this.tri(gm,layer,[x1,y0,z1],[x0,y0,z1],[xm,y1,z1],
        [0,0,(x1-x0)*s,0,(x1-x0)*s/2,rh*s],0.92,[0,0,1]);
    }
    return this;
  }

  /* flat roof / slab with a molded cornice all round */
  slabRoof(mat,layer,o){
    const c=o.cornice===undefined?0.5:o.cornice;
    this.box(mat,layer,{x:o.x,z:o.z,y:o.y,sx:o.sx+c*2,sy:o.t||0.5,sz:o.sz+c*2,
                        uv:o.uv||0.25,ao:1,aoBot:0.5});
    if(o.parapet)
      for(const [dx,dz,sx,sz] of [
        [0,-(o.sz/2+c-0.2),o.sx+c*2,0.4],[0,(o.sz/2+c-0.2),o.sx+c*2,0.4],
        [-(o.sx/2+c-0.2),0,0.4,o.sz+c*2],[(o.sx/2+c-0.2),0,0.4,o.sz+c*2]])
        this.box(mat,layer,{x:o.x+dx,z:o.z+dz,y:o.y+(o.t||0.5),sx,sy:o.parapet,sz,
                            uv:o.uv||0.25,ao:0.95,skip:'B'});
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  arch—a semicircular voussoir ring, for Robinson's and Wilson's
   *  arches and for the gate vaults. Springs from y at both ends of a
   *  span running along `axis` ('x' or 'z').
   *
   *  THE RING IS WOUND FOR ITS AXIS, and was not. Every one of the four surfaces
   *  is laid out by walking the angles in increasing order, and `t` runs along
   *  +x for `axis:'x'` but along +z for `axis:'z'`—which reverses the sense of
   *  the identical ordering, exactly as it does in `archSpandrel`. One winding
   *  was written and never flipped, so every arch on the x axis—both
   *  causeways, Robinson's great arch, the Huldah vaults—was built INSIDE OUT:
   *  it drew its far face where its near face should be, showed the extrados
   *  when you looked up into the barrel and the intrados when you looked at it
   *  from outside, and, because the two curved surfaces take their shading
   *  normal from the same winding, lit the soffit like a surface facing the sky
   *  and its back like one facing the ground.
   *
   *  Head-on that is nearly invisible—an annulus is an annulus from either
   *  side and a barrel still reads as a barrel—which is why it survived so
   *  long and why the shots taken square on to a bay looked mended. Off the axis
   *  it is the whole fault: a curved sheet with a bright top and a black
   *  underside hanging over an opening, which is what "a paper arch" describes.
   *  Two arcades' worth of spandrels were built chasing it. Arches on the z
   *  axis—Robinson's stepped street—were right all along, which is the
   *  comparison that finally located it.
   * ------------------------------------------------------------------ */
  arch(mat,layer,o){
    const span=o.span, R=span/2, th=o.thick||1.4, depth=o.depth||6;
    const seg=o.seg||16, axis=o.axis||'x';
    const s=o.uv===undefined?0.25:o.uv;
    const cx=o.x, cz=o.z, y=o.y, aX=axis==='x';
    /* the same four corners either way round, reversed on the x axis */
    const face=(A,B,C,D,uv,ao,nrm)=> aX
      ? this.quad(mat,layer,D,C,B,A,
          [uv[6],uv[7],uv[4],uv[5],uv[2],uv[3],uv[0],uv[1]],ao,nrm)
      : this.quad(mat,layer,A,B,C,D,uv,ao,nrm);
    for(let i=0;i<seg;i++){
      const a0=Math.PI*i/seg, a1=Math.PI*(i+1)/seg;
      const P=(a,r,off)=>{
        const h=Math.sin(a)*r, t=-Math.cos(a)*r;
        return aX ? [cx+t, y+h, cz+off] : [cx+off, y+h, cz+t];
      };
      const d2=depth/2, uv=[0,0,depth*s,0,depth*s,R*(a1-a0)*s,0,R*(a1-a0)*s];
      /* intrados—faces the axis, so it is seen only from inside the barrel */
      face(P(a0,R,-d2),P(a0,R,d2),P(a1,R,d2),P(a1,R,-d2),uv,0.55);
      /* extrados—faces away from the axis, and carries whatever sits on it */
      face(P(a1,R+th,-d2),P(a1,R+th,d2),P(a0,R+th,d2),P(a0,R+th,-d2),uv,1);
      // the two faces of the ring
      const fuv=[0,0,th*s,0,th*s,R*(a1-a0)*s,0,R*(a1-a0)*s];
      for(const [off,sgn] of [[d2,1],[-d2,-1]]){
        const nrm = aX?[0,0,sgn]:[sgn,0,0];
        const a=P(a0,R,off), b=P(a0,R+th,off), c=P(a1,R+th,off), dd=P(a1,R,off);
        if(sgn>0) face(a,b,c,dd,fuv,0.95,nrm);
        else      face(dd,c,b,a,fuv,0.95,nrm);
      }
    }
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  convex polygon, flat, at height y. Fan-triangulated.
   *  Used for the esplanade and the court pavements.
   * ------------------------------------------------------------------ */
  poly(mat,layer,pts,y,uvScale,ao,up){
    const g=this.g(mat,layer);
    const s=uvScale===undefined?0.125:uvScale;
    const n = up===false?[0,-1,0]:[0,1,0];
    const idx=[];
    for(const p of pts) idx.push(this._v(g,p[0],y,p[1],n[0],n[1],n[2],p[0]*s,p[1]*s,ao===undefined?1:ao));
    /* Winding, not the supplied normal, decides back-face culling. For a
       ring given in +X then +Z order, cross(e1,e2) points DOWN, so an
       up-facing surface has to be emitted in reverse. */
    for(let i=1;i<pts.length-1;i++){
      if(up===false) g.idx.push(idx[0],idx[i],idx[i+1]);
      else           g.idx.push(idx[0],idx[i+1],idx[i]);
    }
    return this;
  }

  /* a horizontal ring/frame: the area between an outer and inner
     rectangle, e.g. pavement around a building */
  frame(mat,layer,o){
    const {x,z,sx,sz,ix,iz,y}=o, s=o.uv||0.125, ao=o.ao===undefined?1:o.ao;
    const X0=x-sx/2,X1=x+sx/2,Z0=z-sz/2,Z1=z+sz/2;
    const x0=x-ix/2,x1=x+ix/2,z0=z-iz/2,z1=z+iz/2;
    const q=(a,b,c,d)=>this.poly(mat,layer,[a,b,c,d],y,s,ao);
    q([X0,Z0],[X1,Z0],[X1,z0],[X0,z0]);
    q([X0,z1],[X1,z1],[X1,Z1],[X0,Z1]);
    q([X0,z0],[x0,z0],[x0,z1],[X0,z1]);
    q([x1,z0],[X1,z0],[X1,z1],[x1,z1]);
    return this;
  }

  /* heightfield terrain patch */
  terrain(mat,layer,o){
    const g=this.g(mat,layer);
    const {x0,z0,x1,z1,nx,nz,fn}=o;
    const s=o.uv||0.03125;
    const H=[];
    for(let j=0;j<=nz;j++){
      H[j]=[];
      for(let i=0;i<=nx;i++){
        const X=lerp(x0,x1,i/nx), Z=lerp(z0,z1,j/nz);
        H[j][i]=fn(X,Z);
      }
    }
    const base=g.nv;
    for(let j=0;j<=nz;j++){
      for(let i=0;i<=nx;i++){
        const X=lerp(x0,x1,i/nx), Z=lerp(z0,z1,j/nz), Y=H[j][i];
        const hx=(H[j][Math.min(nx,i+1)]-H[j][Math.max(0,i-1)]);
        const hz=(H[Math.min(nz,j+1)][i]-H[Math.max(0,j-1)][i]);
        const dx=(x1-x0)/nx*2, dz=(z1-z0)/nz*2;
        const n=V3.norm([-hx/dx,1,-hz/dz]);
        this._v(g,X,Y,Z,n[0],n[1],n[2],X*s,Z*s,1);
      }
    }
    const st=nx+1;
    for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
      const a=base+j*st+i,b=a+1,c=a+st,d=c+1;
      g.idx.push(a,c,b, b,c,d);
    }
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  A human figure, ~1.70 m, low-poly but readable—the single most
   *  useful cue for the scale of the place.
   * ------------------------------------------------------------------ */
  person(o){
    const h=o.h||1.70, layer='people';
    const mat=o.mat||'clothA';
    const x=o.x,z=o.z,y=o.y||0, fa=o.face||0;
    this.pushT(x,y,z); this.pushRotY(fa);
    const sh=h*0.27;                               // shoulder width
    // robe: a tapered body
    this.box(mat,layer,{x:0,z:0,y:h*0.06,sx:sh*0.92,sy:h*0.56,sz:sh*0.52,uv:2,ao:0.9,skip:'B'});
    this.box(mat,layer,{x:0,z:0,y:h*0.60,sx:sh,sy:h*0.20,sz:sh*0.56,uv:2,ao:1,skip:'B'});
    // head and headcloth
    this.box('skin',layer,{x:0,z:0,y:h*0.815,sx:h*0.115,sy:h*0.13,sz:h*0.115,uv:4,ao:1});
    this.box(mat,layer,{x:0,z:0,y:h*0.90,sx:h*0.145,sy:h*0.075,sz:h*0.145,uv:3,ao:1});
    // arms
    for(const sgn of [-1,1])
      this.box(mat,layer,{x:sgn*sh*0.56,z:0,y:h*0.42,sx:h*0.07,sy:h*0.36,sz:h*0.08,uv:3,ao:0.85,skip:'B'});
    // legs below the hem
    for(const sgn of [-1,1])
      this.box('skin',layer,{x:sgn*sh*0.2,z:0,y:0,sx:h*0.065,sy:h*0.075,sz:h*0.1,uv:4,ao:0.6});
    this.pop(); this.pop();
    return this;
  }

  /* ------------------------------------------------------------------ *
   *  finalise: concatenate every group into one interleaved buffer
   * ------------------------------------------------------------------ */
  compile(){
    const groups=[...this.groups.values()].filter(g=>g.idx.length);
    let nv=0, ni=0;
    for(const g of groups){ nv+=g.nv; ni+=g.idx.length; }
    const V=new Float32Array(nv*9);
    const I=(nv>65535?new Uint32Array(ni):new Uint16Array(ni));
    let vo=0, io=0, vbase=0;
    const draws=[];
    for(const g of groups){
      for(let i=0;i<g.nv;i++){
        V[vo++]=g.pos[i*3]; V[vo++]=g.pos[i*3+1]; V[vo++]=g.pos[i*3+2];
        V[vo++]=g.nrm[i*3]; V[vo++]=g.nrm[i*3+1]; V[vo++]=g.nrm[i*3+2];
        V[vo++]=g.uv[i*2];  V[vo++]=g.uv[i*2+1];
        V[vo++]=g.ao[i];
      }
      const start=io;
      for(let i=0;i<g.idx.length;i++) I[io++]=g.idx[i]+vbase;
      draws.push({mat:g.mat, layer:g.layer, start, count:g.idx.length,
                  vstart:vbase, vcount:g.nv});
      vbase+=g.nv;
    }
    bakeAO(V, I, draws);
    return { vertices:V, indices:I, draws, parts:this.parts,
             stats:{ verts:nv, tris:ni/3, groups:groups.length } };
  }
}

/* =====================================================================
 *  Baked ambient occlusion.
 *
 *  The scene has one directional light and a hemispheric ambient term, and
 *  the ambient term knows nothing about what is standing next to what. So
 *  the inside of a colonnade, the foot of a wall, the gap between two of
 *  six hundred and fifty columns and the coffers of a ceiling are all lit
 *  as though the whole sky could see them. That is the single biggest
 *  reason a render reads as a render: in a photograph, everything that is
 *  near something else is darker for it.
 *
 *  Nothing here happens at run time. The geometry never moves, so the
 *  occlusion is solved once, folded into the `ao` vertex attribute that
 *  the shader already multiplies by, and shipped in the vertex buffer. The
 *  frame cost is zero; the cost is a second or so of build.
 *
 *  Method: voxelize the solid geometry into a bitfield, then fire a short
 *  cosine-weighted hemisphere of rays from every vertex and march them
 *  through it. Coarse—the grid is a meter and a half—but occlusion is
 *  a low-frequency quantity and it is being stored per vertex anyway.
 * ===================================================================== */

/* layers that are neither occluders nor receivers */
const AO_SKIP = new Set(['overlay','grid','nodraw']);
/* Cut-outs are mostly holes. Voxelized as solid, the soreg becomes a wall. */
const AO_NOT_SOLID = new Set(['lattice']);

function bakeAO(V, I, draws){
  const CELL = 1.5, R_MAX = 7.0, STEPS = 5, T_MIN = 1.3, C_MIN = 0.28;
  const nv = V.length/9;

  /* ---- which vertices belong to which draw, and what each draw is ---- */
  const solid = draws.filter(d => !AO_SKIP.has(d.layer) &&
                                  !AO_NOT_SOLID.has(d.mat) &&
                                  d.layer!=='people');

  /* ---- bounds: the built work only. The terrain sheet is two and a half
     kilometers across and would cost a hundred times the grid for occlusion
     that a hillside does not cast anyway. ---- */
  let x0=1e30,y0=1e30,z0=1e30, x1=-1e30,y1=-1e30,z1=-1e30;
  for(const d of solid){
    if(d.mat==='terrain') continue;
    for(let i=d.vstart;i<d.vstart+d.vcount;i++){
      const p=i*9, x=V[p], y=V[p+1], z=V[p+2];
      if(x<x0)x0=x; if(x>x1)x1=x;
      if(y<y0)y0=y; if(y>y1)y1=y;
      if(z<z0)z0=z; if(z>z1)z1=z;
    }
  }
  if(x0>x1) return;                                  // nothing to do
  const PAD=R_MAX+CELL;
  x0-=PAD; y0-=PAD; z0-=PAD; x1+=PAD; y1+=PAD; z1+=PAD;
  const gx=Math.ceil((x1-x0)/CELL), gy=Math.ceil((y1-y0)/CELL),
        gz=Math.ceil((z1-z0)/CELL);
  const grid=new Uint8Array(gx*gy*gz);
  const at=(i,j,k)=>(k*gy+j)*gx+i;

  /* ---- voxelize: sample each triangle over its own area, so a 300 m court
     and a 30 cm molding both land at about one sample per half cell ---- */
  const mark=(x,y,z)=>{
    const i=(x-x0)/CELL|0, j=(y-y0)/CELL|0, k=(z-z0)/CELL|0;
    if(i>=0&&i<gx&&j>=0&&j<gy&&k>=0&&k<gz) grid[at(i,j,k)]=1;
  };
  const inv=1/(CELL*0.5);
  for(const d of solid){
    for(let t=d.start; t<d.start+d.count; t+=3){
      const a=I[t]*9, b=I[t+1]*9, c=I[t+2]*9;
      const ax=V[a],ay=V[a+1],az=V[a+2];
      const e1x=V[b]-ax, e1y=V[b+1]-ay, e1z=V[b+2]-az;
      const e2x=V[c]-ax, e2y=V[c+1]-ay, e2z=V[c+2]-az;
      const l1=Math.hypot(e1x,e1y,e1z), l2=Math.hypot(e2x,e2y,e2z);
      const n1=Math.min(64, 1+(l1*inv|0)), n2=Math.min(64, 1+(l2*inv|0));
      for(let s=0;s<=n1;s++){
        const u=s/n1;
        for(let r=0;r<=n2;r++){
          const v=(r/n2)*(1-u);
          mark(ax+e1x*u+e2x*v, ay+e1y*u+e2y*v, az+e1z*u+e2z*v);
        }
      }
    }
  }

  /* ---- a fixed set of directions, cosine-ish over the hemisphere ---- */
  const DIRS=[];
  for(let i=0;i<24;i++){
    /* Fibonacci sphere: even coverage without clumping at the poles */
    const y=1-(i+0.5)/24*2, r=Math.sqrt(Math.max(0,1-y*y));
    const th=i*2.399963229728653;
    DIRS.push([Math.cos(th)*r, y, Math.sin(th)*r]);
  }

  /* ---- receivers ---- */
  const receive=new Uint8Array(nv);
  for(const d of draws){
    /* The furniture of the Holy Place is only ever seen through the section
       cut, and stands in a sealed room: occluded from every direction, it
       would bake to a uniform dark and the menorah would go out. It keeps the
       hand-placed term and the flame lights instead. */
    if(AO_SKIP.has(d.layer) || d.layer==='interior') continue;
    for(let i=d.vstart;i<d.vstart+d.vcount;i++) receive[i]=1;
  }

  /* ---- how much occlusion a vertex is entitled to express ----
     The term is stored PER VERTEX and interpolated across the triangle, so a
     vertex can only carry occlusion that varies over about the size of the
     triangles it belongs to. The esplanade is a single box: its top face has
     four vertices, all of them tucked against the colonnades, and the shading
     at those corners was being smeared over three hundred meters of court—
     which turned the whole pavement gray. So a vertex whose triangles are much
     larger than the sampling radius has its result faded out. Nothing is lost:
     a surface that coarse is flat and open, and its true occlusion is 1. This
     is why the fine work—pilasters, cornices, treads, column drums, coffers
—takes the darkening and the big slabs do not. */
  const span=new Float32Array(nv);
  for(const d of draws){
    if(AO_SKIP.has(d.layer)) continue;
    for(let t=d.start;t<d.start+d.count;t+=3){
      const a=I[t], b=I[t+1], c=I[t+2];
      const A=a*9, Bq=b*9, C=c*9;
      const e0=Math.hypot(V[Bq]-V[A], V[Bq+1]-V[A+1], V[Bq+2]-V[A+2]);
      const e1=Math.hypot(V[C]-V[Bq], V[C+1]-V[Bq+1], V[C+2]-V[Bq+2]);
      const e2=Math.hypot(V[A]-V[C], V[A+1]-V[C+1], V[A+2]-V[C+2]);
      const m=Math.max(e0,e1,e2);
      if(m>span[a]) span[a]=m;
      if(m>span[b]) span[b]=m;
      if(m>span[c]) span[c]=m;
    }
  }

  for(let vi=0; vi<nv; vi++){
    if(!receive[vi]) continue;
    const p=vi*9;
    const px=V[p], py=V[p+1], pz=V[p+2];
    if(px<x0||px>x1||py<y0||py>y1||pz<z0||pz>z1) continue;
    const nx=V[p+3], ny=V[p+4], nz=V[p+5];
    /* Start clear of the surface the vertex sits on, or every ray hits it.
       A surface marks the whole cell it falls in, so its own voxels reach up
       to a cell OUT from it, and a ray leaving at a shallow angle re-enters
       them however far along it travels. That is why an open, unobstructed
       wall came back a quarter dark. Two things keep it off: the origin is
       lifted more than a cell, and rays shallower than C_MIN are dropped
       rather than traced—they carry little weight in a cosine-weighted
       hemisphere anyway, and they are the only ones that can self-hit. */
    const ox=px+nx*CELL*1.15, oy=py+ny*CELL*1.15, oz=pz+nz*CELL*1.15;
    let hit=0, tot=0;
    for(let di=0; di<DIRS.length; di++){
      const D=DIRS[di];
      const c=D[0]*nx+D[1]*ny+D[2]*nz;
      if(c<=C_MIN) continue;                   // grazing, or below the surface
      tot+=c;
      for(let s=1;s<=STEPS;s++){
        const t=T_MIN + ((s-1)/(STEPS-1))*(R_MAX-T_MIN);
        const i=(ox+D[0]*t-x0)/CELL|0, j=(oy+D[1]*t-y0)/CELL|0,
              k=(oz+D[2]*t-z0)/CELL|0;
        if(i<0||i>=gx||j<0||j>=gy||k<0||k>=gz) break;
        if(grid[at(i,j,k)]){
          /* nearer occluders count for more, which is what makes this read
             as contact darkening rather than a flat dimming of the room */
          hit += c*(1.0-(s-1)/STEPS*0.55);
          break;
        }
      }
    }
    if(tot<=0) continue;
    const open=1-hit/tot;
    /* Never to black: there is no bounce light in this renderer, so a fully
       enclosed surface that baked to zero would be a hole in the image. */
    const ao=0.52+0.48*Math.pow(open,0.85);
    const k=clamp(R_MAX*1.5/Math.max(span[vi],1e-3), 0, 1);
    V[p+8]*=1+(ao-1)*k;
  }
}
