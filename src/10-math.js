/* =====================================================================
 *  10—linear algebra, small and column-major (same layout as GL)
 * ===================================================================== */
'use strict';

const M4 = {
  create(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },

  identity(o){
    o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
    o[8]=0;o[9]=0;o[10]=1;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1; return o;
  },

  copy(o,a){ for(let i=0;i<16;i++) o[i]=a[i]; return o; },

  /* o = a * b   (apply b first, then a) */
  mul(o,a,b){
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3], a10=a[4],a11=a[5],a12=a[6],a13=a[7],
          a20=a[8],a21=a[9],a22=a[10],a23=a[11], a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    for(let i=0;i<4;i++){
      const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
      o[i*4  ]=b0*a00+b1*a10+b2*a20+b3*a30;
      o[i*4+1]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[i*4+2]=b0*a02+b1*a12+b2*a22+b3*a32;
      o[i*4+3]=b0*a03+b1*a13+b2*a23+b3*a33;
    }
    return o;
  },

  translation(o,x,y,z){ M4.identity(o); o[12]=x;o[13]=y;o[14]=z; return o; },

  scaling(o,x,y,z){ M4.identity(o); o[0]=x;o[5]=y;o[10]=z; return o; },

  rotationY(o,r){
    const c=Math.cos(r),s=Math.sin(r); M4.identity(o);
    o[0]=c;o[2]=-s;o[8]=s;o[10]=c; return o;
  },

  rotationX(o,r){
    const c=Math.cos(r),s=Math.sin(r); M4.identity(o);
    o[5]=c;o[6]=s;o[9]=-s;o[10]=c; return o;
  },

  rotationZ(o,r){
    const c=Math.cos(r),s=Math.sin(r); M4.identity(o);
    o[0]=c;o[1]=s;o[4]=-s;o[5]=c; return o;
  },

  perspective(o,fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2), nf=1/(near-far);
    o.fill(0);
    o[0]=f/aspect; o[5]=f; o[10]=(far+near)*nf; o[11]=-1; o[14]=2*far*near*nf;
    return o;
  },

  ortho(o,l,r,b,t,n,f){
    o.fill(0);
    o[0]=2/(r-l); o[5]=2/(t-b); o[10]=-2/(f-n); o[15]=1;
    o[12]=-(r+l)/(r-l); o[13]=-(t+b)/(t-b); o[14]=-(f+n)/(f-n);
    return o;
  },

  lookAt(o,eye,at,up){
    let zx=eye[0]-at[0], zy=eye[1]-at[1], zz=eye[2]-at[2];
    let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
    let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
    l=Math.hypot(xx,xy,xz);
    if(l<1e-6){ xx=1;xy=0;xz=0; } else { xx/=l; xy/=l; xz/=l; }
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;
    o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0;
    o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
    o[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
    o[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
    o[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
    o[15]=1;
    return o;
  },

  invert(o,m){
    const a00=m[0],a01=m[1],a02=m[2],a03=m[3], a10=m[4],a11=m[5],a12=m[6],a13=m[7],
          a20=m[8],a21=m[9],a22=m[10],a23=m[11], a30=m[12],a31=m[13],a32=m[14],a33=m[15];
    const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10,
          b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12,
          b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30,
          b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
    let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
    if(!det) return M4.identity(o);
    det=1/det;
    o[0]=(a11*b11-a12*b10+a13*b09)*det;  o[1]=(a02*b10-a01*b11-a03*b09)*det;
    o[2]=(a31*b05-a32*b04+a33*b03)*det;  o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det;  o[5]=(a00*b11-a02*b08+a03*b07)*det;
    o[6]=(a32*b02-a30*b05-a33*b01)*det;  o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det;  o[9]=(a01*b08-a00*b10-a03*b06)*det;
    o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
    o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
    return o;
  },

  /* transpose of the upper-left 3x3, packed as mat3—for normals */
  normalFromM4(o,m){
    const inv=M4.invert(M4.create(),m);
    o[0]=inv[0]; o[1]=inv[4]; o[2]=inv[8];
    o[3]=inv[1]; o[4]=inv[5]; o[5]=inv[9];
    o[6]=inv[2]; o[7]=inv[6]; o[8]=inv[10];
    return o;
  },

  xformPoint(m,x,y,z,out){
    const w = m[3]*x+m[7]*y+m[11]*z+m[15] || 1;
    out[0]=(m[0]*x+m[4]*y+m[8]*z+m[12])/w;
    out[1]=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
    out[2]=(m[2]*x+m[6]*y+m[10]*z+m[14])/w;
    return out;
  },

  xformDir(m,x,y,z,out){
    out[0]=m[0]*x+m[4]*y+m[8]*z;
    out[1]=m[1]*x+m[5]*y+m[9]*z;
    out[2]=m[2]*x+m[6]*y+m[10]*z;
    return out;
  },
};

const V3 = {
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  norm(a){ const l=V3.len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; },
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t],
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),
};

const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const smoothstep = t => t*t*(3-2*t);
/* ease used for camera flights: slow out, slow in, no overshoot */
const easeInOut = t => t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const DEG = Math.PI/180;

/* deterministic PRNG so every load looks identical */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
