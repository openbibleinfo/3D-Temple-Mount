/* =====================================================================
 *  60—renderer. WebGL2, hand-rolled: one merged vertex buffer, a
 *  directional shadow map that follows the camera's focus, a sky
 *  gradient with a real sun position for Jerusalem, and an optional
 *  clip plane for sectioning the Sanctuary.
 * ===================================================================== */
'use strict';

/* ---- material table -------------------------------------------------
 *  spec  specular strength      shin  specular exponent
 *  tint  multiplied over the texture
 *  alpha 1 = alpha-tested (the soreg lattice)
 *  emis  self-luminous fraction (altar fire, lamp flames, markers)
 *  metal how much of the sky this surface mirrors
 *  reflTint 1 = the reflection takes the surface's own color (a metal:
 *        gold reflects gold); 0 = it keeps the sky's color (a dielectric:
 *        water reflects the sky). Defaults to 1.
 *        This, not the specular exponent, is what makes gold read as plating:
 *        a highlight alone only fires when the view lines up with the mirror
 *        direction, whereas a reflection changes with every angle.
 * ------------------------------------------------------------------- */
const MATERIALS = {
  ashlar     :{ tex:()=>TexLib.ashlar({seed:3}),        spec:0.05, shin:12, tint:[1,1,1] , blotch:0.45 , bump:0.9, slabs:[4,4] , grime:1.0},
  ashlarFine :{ tex:()=>TexLib.ashlarFine(),            spec:0.06, shin:14, tint:[1,1,1] , blotch:0.35 , bump:0.75, slabs:[8,8] , grime:0.45},
  ashlarWhite:{ tex:()=>TexLib.ashlarWhite(),           spec:0.09, shin:20, tint:[1,1,1] , bump:0.5, slabs:[8,8] },
  paving     :{ tex:()=>TexLib.paving({seed:11}),       spec:0.07, shin:16, tint:[1,1,1] , blotch:1.0 , bump:0.55, slabs:[4,4] , grime:0.75},
  marble     :{ tex:()=>TexLib.marble({}),              spec:0.20, shin:44, tint:[1,1,1], metal:0.05 },
  marbleFloor:{ tex:()=>TexLib.marbleFloor(),           spec:0.16, shin:38, tint:[1,1,1], metal:0.04 , blotch:0.72, slabs:[5,5] },
  gold       :{ tex:()=>TexLib.gold({}),                spec:2.60, shin:36, tint:[1,1,1], metal:0.88, bump:0.55, slabs:[2,2] },
  /* Corinthian bronze, lit as a conductor like the gold: tinted highlight,
     almost no diffuse, a reflection with a dark ground in its lower half, and
     a per-plate tilt so the Nicanor leaves are a sheet of worked metal rather
     than one even brown field. Darker than gold face-on, as bronze is. */
  bronze     :{ tex:()=>TexLib.bronze(),                spec:1.45, shin:40, tint:[1,1,1], metal:0.80, bump:0.45, slabs:[2,2] },
  cedar      :{ tex:()=>TexLib.cedar({}),               spec:0.12, shin:22, tint:[1,1,1] , bump:0.4, grime:0.5},
  plaster    :{ tex:()=>TexLib.plaster({}),             spec:0.04, shin:10, tint:[1,1,1] },
  roof       :{ tex:()=>TexLib.roofing(),               spec:0.13, shin:26, tint:[1,1,1] , blotch:0.5 , bump:0.45, grime:0.7},
  roofTile   :{ tex:()=>TexLib.roofTiles(),             spec:0.11, shin:22, tint:[1,1,1] , blotch:0.9 , bump:0.6, grime:0.6, slabs:[9,8] },
  water      :{ tex:()=>TexLib.water(),                 spec:0.52, shin:300,tint:[1,1,1],
                metal:0.58, wave:1, reflTint:0 },
  rock       :{ tex:()=>TexLib.bedrock(),               spec:0.03, shin:8,  tint:[1,1,1] , blotch:0.85 , bump:0.85, grime:0.6},
  ground     :{ tex:()=>TexLib.ground(),                spec:0.02, shin:6,  tint:[1,1,1] , blotch:1.0 },
  /* the hillside: soil, with `rock`'s texture showing through wherever the
     ground is too steep to hold it. Only a material carrying `blend2` pays for
     the second lookup—the uniform is 0 everywhere else, so the branch is
     uniform flow and no wall or column ever takes the cost. */
  terrain    :{ tex:()=>TexLib.ground(),                spec:0.02, shin:6,  tint:[1,1,1] , blotch:1.0,
                blend2:'rock', blendUv:2.6 },
  house      :{ tex:()=>TexLib.house(),                 spec:0.04, shin:10, tint:[1,1,1] , blotch:0.6 },
  veil       :{ tex:()=>TexLib.veil(),                  spec:0.10, shin:16, tint:[1,1,1] },
  lattice    :{ tex:()=>TexLib.lattice(),               spec:0.08, shin:18, tint:[1,1,1], alpha:1 },
  linen      :{ tex:()=>TexLib.cloth([238,234,224],11), spec:0.06, shin:12, tint:[1,1,1] },
  clothA     :{ tex:()=>TexLib.cloth([186,166,132],21), spec:0.05, shin:10, tint:[1,1,1] },
  clothB     :{ tex:()=>TexLib.cloth([142,120,96], 22), spec:0.05, shin:10, tint:[1,1,1] },
  clothC     :{ tex:()=>TexLib.cloth([124,106,124],23), spec:0.05, shin:10, tint:[1,1,1] },
  clothD     :{ tex:()=>TexLib.cloth([166,138,110],24), spec:0.05, shin:10, tint:[1,1,1] },
  skin       :{ tex:()=>TexLib.cloth([170,132,102],25), spec:0.08, shin:14, tint:[1,1,1] },
  shadow     :{ tex:()=>solid(28,24,20),                spec:0.0,  shin:4,  tint:[1,1,1] },
  fire       :{ tex:()=>solid(252,150,54),              spec:0.0,  shin:4,  tint:[1,1,1], emis:0.55 },
  marker     :{ tex:()=>solid(226,182,96),              spec:0.2,  shin:20, tint:[1,1,1], emis:0.45 },
};

function solid(r,g,b){
  const c=document.createElement('canvas'); c.width=c.height=8;
  const x=c.getContext('2d'); x.fillStyle=`rgb(${r},${g},${b})`; x.fillRect(0,0,8,8);
  return c;
}

/* ------------------------------------------------------------------ *
 *  sun position for Jerusalem, 31.778° N, mid-April (Passover)
 * ------------------------------------------------------------------ */
const JLAT = 31.778*DEG;
const JDEC = 10.0*DEG;                        // solar declination ≈ 14 April
function sunVector(hour){
  const H = (hour-12)*15*DEG;
  const alt = Math.asin( Math.sin(JLAT)*Math.sin(JDEC) +
                         Math.cos(JLAT)*Math.cos(JDEC)*Math.cos(H) );
  const azS = Math.atan2( Math.sin(H),
                          Math.cos(H)*Math.sin(JLAT) - Math.tan(JDEC)*Math.cos(JLAT) );
  const azN = azS + Math.PI;                 // measured from north, clockwise
  return { alt,
    dir:[ Math.cos(alt)*Math.sin(azN), Math.sin(alt), -Math.cos(alt)*Math.cos(azN) ] };
}

/* Light and sky color as a function of sun altitude. Tuned so that
   limestone in full sun lands near 0.88 in sRGB and the same stone in
   shadow near 0.34—the contrast a dry, high-altitude noon actually has,
   and what makes the modeling read. */
function skyPalette(alt){
  const d = clamp(Math.sin(Math.max(alt,0))*1.35, 0, 1);          // day factor
  const low = clamp(1 - Math.max(alt,0)/(20*DEG), 0, 1);          // low-sun factor
  const warm = Math.pow(low,1.5);
  const sun = [
    1.00                     * lerp(1.00,1.04,warm),
    lerp(0.58, 0.965, d)     * lerp(1.00,0.76,warm),
    lerp(0.30, 0.905, d)     * lerp(1.00,0.50,warm),
  ];
  const inten  = lerp(0.09, 1.03, d);
  const zenith = [ lerp(0.09,0.13,d), lerp(0.13,0.25,d), lerp(0.24,0.50,d) ];
  const horiz  = [ lerp(0.30,0.505,d)*lerp(1,1.14,warm),
                   lerp(0.23,0.555,d)*lerp(1,0.86,warm),
                   lerp(0.20,0.635,d)*lerp(1,0.66,warm) ];
  /* the ground bounce carries the interiors—colonnades and the Holy
     Place have no other light source in this model */
  const bounce = [ lerp(0.13,0.40,d), lerp(0.11,0.35,d), lerp(0.09,0.27,d) ];
  return { sun:sun.map(v=>v*inten), zenith, horiz, bounce, day:d,
           amb: lerp(0.16,0.26,d), exposure: lerp(2.15,1.72,d) };
}

const VS_MAIN = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUv;
layout(location=3) in float aAo;
uniform mat4 uProj, uView, uLightVP;
uniform float uNrmOffset;           // ~1.6 shadow texels, in world meters
out vec3 vPos; out vec3 vNrm; out vec2 vUv; out float vAo; out vec4 vLp;
void main(){
  vPos=aPos; vNrm=aNrm; vUv=aUv; vAo=aAo;
  vLp = uLightVP * vec4(aPos + aNrm*uNrmOffset, 1.0);
  gl_Position = uProj * uView * vec4(aPos,1.0);
}`;

const FS_MAIN = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vPos; in vec3 vNrm; in vec2 vUv; in float vAo; in vec4 vLp;
uniform sampler2D  uTex;
uniform sampler2D  uTex2;           // second albedo, for the hillside blend
uniform float uBlend, uBlendUv;     // 0 for every material that has no second
uniform sampler2D  uNrmTex;         // relief, derived from the albedo
uniform float uBump;                // 0 for every material without relief
uniform vec2  uSlabs;               // stones across / courses down one tile, 0 = none
uniform float uGrime;               // how much dirt this material collects, 0 = none
uniform vec2  uViewport;            // pixels, for the vignette
uniform float uDay;                 // 0 at night, 1 at noon; the grade uses it
uniform sampler2DShadow uShadow;
uniform vec3  uSunDir, uSunCol, uZenith, uHoriz, uBounce, uCamPos;
uniform float uAmb, uSpec, uShin, uEmis, uAlphaTest, uShadowTexel, uExposure, uMetal;
uniform float uWave, uTime, uReflTint, uBlotch;
uniform float uDepthRange;          // world units spanned by the light's depth
uniform vec3  uTint;
uniform vec4  uClip;
uniform float uClipOn, uFogDensity;
/* Flames as a few small unshadowed point lights. Fire lighting what is round
   it is most of what makes the altar and the lampstand read at dusk, and it
   costs one short loop. */
const int MAXL = 4;
uniform vec3  uLightPos[MAXL];
uniform vec3  uLightCol[MAXL];
uniform float uLightR[MAXL];
uniform int   uLightN;
out vec4 outColor;

/* Extended Reinhard with a white point of 2.4. The ACES fit was tried
   first and crushed the shadows about two stops too hard: colonnade
   ceilings and the interior of the Sanctuary went to black. This rolls
   the highlights off the gold without losing the shadow detail. */
const float TM_WHITE = 2.4;
vec3 tonemap(vec3 x){
  return x*(1.0 + x/(TM_WHITE*TM_WHITE))/(1.0 + x);
}

/* Value noise, for breaking up the texture repeat on big paved surfaces. An
   8 m tile laid over a 300 m court reads as wallpaper however good the tile
   is; three octaves of very low frequency variation in tone is what stops it,
   because real paving weathers in patches far larger than one slab. */
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h21(i),            h21(i+vec2(1,0)), u.x),
             mix(h21(i+vec2(0,1)),  h21(i+vec2(1,1)), u.x), u.y);
}

/* A twelve-tap disc, rotated per pixel so that what is left of the error
   is noise rather than a visible ring. */
const vec2 DISC[12] = vec2[12](
  vec2( 0.000, 1.000), vec2( 0.866, 0.500), vec2( 0.866,-0.500),
  vec2( 0.000,-1.000), vec2(-0.866,-0.500), vec2(-0.866, 0.500),
  vec2( 0.000, 0.520), vec2( 0.450, 0.260), vec2( 0.450,-0.260),
  vec2( 0.000,-0.520), vec2(-0.450,-0.260), vec2(-0.450, 0.260));

/* Softening with distance from the occluder.
 *
 * A fixed kernel gives every shadow in the model the same edge, which is the
 * giveaway: a step's shadow on its own riser and the Sanctuary's shadow thrown
 * eighty meters across the court are not the same thing. A real blocker search
 * needs the depth texture read as depth, and this one is bound for comparison,
 * so the width is inferred instead—from how much a WIDE, cheap probe
 * disagrees with itself. Deep in light or deep in shadow it does not disagree
 * at all, and those pixels, which are most of the frame, cost five taps rather
 * than the nine they used to. Only the penumbra pays for the other twelve. */
/* The grade—the only part of the shader that is frankly a photograph of a
   physical quantity rather than the quantity. Two things a camera does and a
   render does not: a warm/cool split, highlights carried toward the color of
   the light and shadows toward the color of the sky that is the only thing
   lighting them, which is what stops a scene lit by one sun and one ambient
   from reading as a single tinted gray; and a slight vignette, because a lens
   has one and the eye reads its absence as flatness.

   It goes on the SKY as well as the geometry. Graded on one and not the other,
   the horizon becomes a seam. */
vec3 grade(vec3 c, vec2 uv){
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(lum), c, 1.12);
  /* Shadows go cool because the sky is the only thing lighting them -- but
     that is an argument about the sky, and at sunset the sky is not blue. Held
     to the day factor, or the cool push lands on an orange dusk and the two
     cancel into mud. Highlights take the color of the light at any hour. */
  c *= mix(mix(vec3(1.0), vec3(0.955,0.980,1.045), uDay),
           vec3(1.045,1.005,0.945), smoothstep(0.0, 0.80, lum));
  vec2 q = uv - 0.5;
  return c * (1.0 - dot(q,q)*0.21);
}

float shadowAt(vec4 lp, float ndl){
  /* clip space is [-1,1]; the depth texture is [0,1] */
  vec3 p = lp.xyz/lp.w * 0.5 + 0.5;
  if(p.z>1.0) return 1.0;
  /* THE MAP HAS AN EDGE AND IT MUST NOT BE A LINE. Outside the depth map there
     is no shadow information, and returning "lit" the moment you cross the
     boundary drew that boundary: a hard-edged square of shadowed ground with
     unshadowed ground around it, sliding across the court as the camera moved,
     because the box is fitted to the camera's focus. Nothing in the world has
     an edge there, so the term is faded out over the outermost few per cent of
     the map instead. Shadows still stop—one map cannot cover the whole mount
     and stay sharp—but they stop the way distance takes them, not on a line. */
  float edge = smoothstep(0.5, 0.44, max(abs(p.x-0.5), abs(p.y-0.5)));
  if(edge <= 0.0) return 1.0;
  /* Bias stated in METERS and converted, so it does not scale with the
     light frustum: at ~0.1 m the contact point stays attached. */
  float bias = mix(0.10, 0.028, ndl) / uDepthRange;
  float z = p.z - bias;

  float wide = 4.0*uShadowTexel;
  float c = texture(uShadow, vec3(p.xy, z));
  float w = texture(uShadow, vec3(p.xy+vec2( wide, wide), z))
          + texture(uShadow, vec3(p.xy+vec2(-wide, wide), z))
          + texture(uShadow, vec3(p.xy+vec2( wide,-wide), z))
          + texture(uShadow, vec3(p.xy+vec2(-wide,-wide), z));
  float agree = c*4.0 + w;                    // 0 = all shadow, 8 = all light
  if(agree < 0.02) return 1.0 - edge;
  if(agree > 7.98) return 1.0;

  /* Mixed. How mixed says how far off the edge is: a contact shadow disagrees
     over one texel and stays tight; an edge four texels away disagrees over the
     whole probe and spreads. */
  float spread = 1.0 - abs(agree/4.0 - 1.0);
  float r = uShadowTexel * mix(1.15, 4.6, spread);

  float a = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)*6.2832;
  vec2 rot = vec2(cos(a), sin(a));
  float s = c;
  for(int i=0;i<12;i++){
    vec2 d = vec2(DISC[i].x*rot.x - DISC[i].y*rot.y,
                  DISC[i].x*rot.y + DISC[i].y*rot.x) * r;
    s += texture(uShadow, vec3(p.xy + d, z));
  }
  return mix(1.0, s/13.0, edge);
}

void main(){
  if(uClipOn > 0.5 && dot(vec4(vPos,1.0), uClip) > 0.0) discard;

  vec4 tx = texture(uTex, vUv);
  if(uAlphaTest > 0.5 && tx.a < 0.5) discard;
  vec3 albedo = tx.rgb * uTint;

  /* ---- the hillside ----
     Soil lies on ground that is gentle enough to hold it; where the Kidron and
     the Tyropoeon fall away, bedrock is what shows. Rather than tint one sheet
     or stack two, the choice is made per fragment from the slope of the surface
     itself, with the threshold pushed about by noise so the line between them
     wanders the way a real scree edge does. */
  if(uBlend > 0.0){
    float slope = 1.0 - clamp(vNrm.y, 0.0, 1.0);
    float n = vnoise(vPos.xz*0.0135)*0.62 + vnoise(vPos.xz*0.051)*0.38;
    float m = smoothstep(0.02, 0.18, slope + (n-0.5)*0.13);
    albedo = mix(albedo, texture(uTex2, vUv*uBlendUv).rgb * uTint, m);
    /* Terraces of olive and vine on the gentler slopes, and bare burnt ground
       between them, in patches far larger than the texture tile. Without this
       the hillside is one flat color over half a kilometer and the eye reads
       the whole landscape as a backdrop the buildings were pasted onto. */
    float veg = smoothstep(0.34, 0.86, vnoise(vPos.xz*0.0047)) * (1.0-m);
    float dry = smoothstep(0.52, 0.95, vnoise(vPos.xz*0.0031 + vec2(37.0,11.0)));
    albedo *= mix(vec3(1.0), vec3(0.74,0.82,0.52), veg*0.90);
    albedo *= mix(vec3(1.0), vec3(1.10,1.05,0.93), dry*0.55*(1.0-veg));
  }

  /* ---- one tone per stone, and no two of them the same ----
     Quarried stone is never uniform, and the obvious place to put that
     variation is in the texture—where it becomes the single most visible
     thing in the model, because the identical arrangement of light and dark
     stones then repeats every 8 m over a 300 m court and every 9.6 m along a
     280 m wall. The eye reads the arrangement long before it reads the stone.

     So the tone is hashed from the stone's own place in the WORLD instead. The
     UVs here are world coordinates times a scale, so flooring them by the
     number of stones in a tile gives an index that is unique across the whole
     model; the half-stone stagger of alternate courses is reproduced from the
     same rule the texture was drawn by, so the tone lands on the drawn stone
     and not across two of them. The textures keep what genuinely does repeat:
     the joint, the drafted margin, the bevel, the grain.

     Faded out as a stone shrinks toward a pixel—this is analytic, so unlike
     the texture it has no mip chain to average it, and left alone it would
     boil at the far end of the court. */
  vec2  cellId = vec2(0.0);
  float cellK  = 0.0;
  if(uSlabs.x > 0.0){
    vec2 t = vUv * uSlabs;
    float row = floor(t.y);
    float col = floor(t.x - (mod(row,2.0) < 1.0 ? 0.0 : 0.5));
    cellId = vec2(col,row);
    cellK  = clamp(1.0 - max(fwidth(t.x), fwidth(t.y)), 0.0, 1.0);
    albedo *= mix(1.0, mix(0.85, 1.12, h21(cellId*0.317)), cellK);
  }

  if(uBlotch > 0.0){
    float m = vnoise(vPos.xz*0.0062)*0.50
            + vnoise(vPos.xz*0.0210)*0.32
            + vnoise(vPos.xz*0.0850)*0.18;
    albedo *= mix(1.0, mix(0.80, 1.15, m), uBlotch);
  }

  /* ---- dirt, where things meet ----
     Nothing in this renderer knows what is next to what—except the baked
     occlusion, which is exactly that, already in the buffer and already being
     read. Dirt collects where the sky cannot get at a surface and rain cannot
     wash it: the foot of a wall, the inside of a corner, under a cornice,
     between two of six hundred columns. So the same number that darkens those
     places also dulls and warms them, which costs one mix and no new data, and
     is right wherever the geometry is right.

     Held down to the old and workaday—the retaining walls, the street, the
     roofs. The Sanctuary and its courts are clean: the building was about
     fifty years old in AD 30 and Josephus says a stranger coming toward it had
     to look away from the light off it. Grime there would be a claim about the
     past, not a rendering trick. */
  if(uGrime > 0.0){
    float dirt = (1.0 - smoothstep(0.34, 0.95, vAo)) * uGrime;
    albedo *= mix(vec3(1.0), vec3(0.80,0.755,0.665), dirt);
  }

  vec3 N = normalize(vNrm);

  /* ---- relief ----
     The tangent frame is built from screen-space derivatives rather than
     carried as a vertex attribute. It costs a few instructions on the
     materials that ask for it and nothing at all on those that do not, and
     it works whatever the UV mapping—which matters here, because this
     model projects UVs planar from world coordinates and from local ones,
     and no single tangent convention would have covered both. */
  if(uBump > 0.0){
    vec3 dp1=dFdx(vPos), dp2=dFdy(vPos);
    vec2 du1=dFdx(vUv),  du2=dFdy(vUv);
    vec3 p2=cross(dp2,N), p1=cross(N,dp1);
    vec3 T=p2*du1.x + p1*du2.x;
    vec3 B=p2*du1.y + p1*du2.y;
    float im=inversesqrt(max(dot(T,T),dot(B,B)));
    vec3 nt=texture(uNrmTex,vUv).xyz*2.0-1.0;
    nt.xy *= uBump;
    N = normalize(mat3(T*im,B*im,N) * normalize(nt));
  }

  /* ---- one plate at a time ----
     A wall of beaten gold is not one mirror; it is a few hundred sheets, each
     hammered on and lying at a slightly different angle, and it is the fact
     that each catches the light differently that says metal. The hammer facets
     in the texture cannot do this from any distance -- by the time the facade
     fills the frame they have mipped away to a flat average -- so the tilt is
     taken per SHEET, from the same cell index the tone came from, and fades
     out with it as a sheet shrinks toward a pixel. */
  if(uMetal > 0.4 && cellK > 0.0){
    vec3 j = vec3(h21(cellId*0.29), h21(cellId*0.71+11.0), h21(cellId*1.37+23.0)) - 0.5;
    N = normalize(N + (j - N*dot(j,N)) * 0.17 * cellK);
  }

  if(uWave > 0.0){
    /* Four trains running on their own bearings, none of them square to the
       basin. Two crossed trains -- one in x, one in z -- multiply into a grid
       of peaks and troughs, and still water came out looking like tartan. Real
       ripple has no axis: the directions here are deliberately incommensurable
       and each carries its own wavelength and speed, so nothing lines up twice.
       The normal is perturbed along each train's OWN direction, which is what
       makes a wave look as though it is traveling rather than flashing. */
    vec2 d1=vec2( 0.862, 0.507), d2=vec2(-0.416, 0.909);
    vec2 d3=vec2( 0.629,-0.777), d4=vec2( 0.978, 0.208);
    float w1=sin(dot(vPos.xz,d1)*1.31 + uTime*0.91);
    float w2=sin(dot(vPos.xz,d2)*2.17 - uTime*1.27);
    float w3=sin(dot(vPos.xz,d3)*3.79 + uTime*1.83);
    float w4=sin(dot(vPos.xz,d4)*6.53 - uTime*2.41);
    vec2 slope = d1*(w1*0.050) + d2*(w2*0.034) + d3*(w3*0.020) + d4*(w4*0.011);
    N = normalize(N + vec3(slope.x, 0.0, slope.y) * uWave);
  }
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vPos);
  float ndl = max(dot(N,L), 0.0);

  float sh = ndl > 0.0 ? shadowAt(vLp, ndl) : 0.0;
  vec3 direct = uSunCol * ndl * sh;

  /* hemispheric ambient: sky above, warm ground bounce below */
  float up = N.y*0.5 + 0.5;
  vec3 sky = mix(uHoriz, uZenith, smoothstep(0.35,1.0,up));
  vec3 ambient = mix(uBounce, sky, up*0.72) * uAmb;

  /* specular */
  vec3 H = normalize(L+V);
  float spe = pow(max(dot(N,H),0.0), uShin) * uSpec * sh * step(0.001, ndl);

  vec3 lamp = vec3(0.0);
  for(int i=0;i<MAXL;i++){
    if(i >= uLightN) break;
    vec3  Dv = uLightPos[i] - vPos;
    float dd = length(Dv);
    float t  = clamp(1.0 - dd/uLightR[i], 0.0, 1.0);
    lamp += uLightCol[i] * max(dot(N, Dv/max(dd,1e-4)), 0.0) * t * t;
  }

  /* Metals are mostly mirror, little diffuse, so the direct term is damped
     in proportion to metalness and the reflection makes up the difference. */
  /* A metal has almost no diffuse term—its color comes back out of the
     mirror reflection, tinted, not out of scattering. Leaving three quarters of
     a diffuse yellow under the gold was most of why it read as paint. */
  /* The highlight takes the METAL'S color, not the light's. A white highlight
     on gold is the signature of plastic: a dielectric's specular is the color
     of what lit it, a conductor's is the color of the conductor. This is the
     same reflTint the environment reflection uses -- 1 for a metal, 0 for
     water, which really does throw back a white sun. */
  vec3 tintR = mix(vec3(1.0), albedo, uReflTint);
  vec3 col = albedo * (direct * (1.0 - uMetal*0.82) + ambient + lamp) * vAo
           + uSunCol * spe * mix(vec3(1.0), tintR*2.2, uMetal);

  if(uMetal > 0.0){
    vec3  Rv  = reflect(-V, N);
    /* A metal reflects a whole world, not the top half of one. Everything
       below the horizon in the reflection is GROUND—darker, and warmer—and
       gold carrying bright sky in its upper part and dark ground in its lower
       is the single strongest signal that it is plating and not yellow paint.
       Reflecting the horizon color in every downward direction, as this did,
       gives an even wash over the whole surface, which is precisely what paint
       looks like. */
    vec3  env = Rv.y > 0.0 ? mix(uHoriz, uZenith, pow(Rv.y, 0.62))
                           : mix(uHoriz, uBounce*0.62, pow(-Rv.y, 0.42));
    env += uSunCol * pow(max(dot(Rv, L), 0.0), 300.0) * 9.0 * sh;   // the glint
    /* Fresnel: reflectance climbs steeply toward grazing angles. On a big flat
       gilded wall this is what stops it reading as yellow paint—the oblique
       parts flare while the part facing you stays deeper. */
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    /* Face-on a metal returns rather little; at a grazing angle it returns
       almost everything. Weighted flat, gold came out at exactly the value of
       the limestone next to it, which is the one thing gilding never does --
       in shade it is a deep amber, darker than white stone, and in the mirror
       direction it is unbearable. Josephus says a stranger approaching had to
       look away from it. */
    col += tintR * env * uMetal * (0.40 + 1.30*fres);
  }

  col += albedo * uEmis * 1.6;

  /* aerial perspective */
  float dist = length(uCamPos - vPos);
  float f = 1.0 - exp(-dist * uFogDensity);
  float hz = clamp((vPos.y + 90.0)/300.0, 0.0, 1.0);
  vec3 fogCol = mix(uHoriz, uZenith, hz*0.5);
  col = mix(col, fogCol, clamp(f, 0.0, 0.62));

  col = tonemap(col * uExposure);
  col = grade(col, gl_FragCoord.xy/uViewport);
  outColor = vec4(pow(clamp(col,0.0,1.0), vec3(1.0/2.2)), 1.0);
}`;

const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLightVP;
void main(){ gl_Position = uLightVP * vec4(aPos,1.0); }`;
const FS_DEPTH = `#version 300 es
precision highp float;
void main(){}`;

/* The same, but sampling the texture so a cut-out casts the shadow of its
   silhouette. A tree drawn by the plain depth program throws the shadow of its
   two rectangular cards, which is worse than no shadow at all. It is a separate
   program rather than a branch in the one above so that the 250,000 opaque
   triangles never pay for a texture fetch they do not need. */
const VS_DEPTH_A = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec2 aUv;
uniform mat4 uLightVP;
out vec2 vUv;
void main(){ vUv=aUv; gl_Position = uLightVP * vec4(aPos,1.0); }`;
const FS_DEPTH_A = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
void main(){ if(texture(uTex,vUv).a < 0.5) discard; }`;

const VS_SKY = `#version 300 es
layout(location=0) in vec2 aP;
uniform mat4 uInvVP; uniform vec3 uCamPos;
out vec3 vRay;
void main(){
  vec4 far = uInvVP * vec4(aP, 1.0, 1.0);
  vRay = far.xyz/far.w - uCamPos;
  gl_Position = vec4(aP, 1.0, 1.0);
}`;
const FS_SKY = `#version 300 es
precision highp float;
in vec3 vRay;
uniform vec3 uZenith, uHoriz, uSunDir, uSunCol;
uniform float uExposure;
uniform vec2 uViewport;
uniform float uDay;
out vec4 outColor;
const float TM_WHITE = 2.4;
vec3 tonemap(vec3 x){ return x*(1.0 + x/(TM_WHITE*TM_WHITE))/(1.0 + x); }
vec3 grade(vec3 c, vec2 uv){
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(lum), c, 1.12);
  /* Shadows go cool because the sky is the only thing lighting them -- but
     that is an argument about the sky, and at sunset the sky is not blue. Held
     to the day factor, or the cool push lands on an orange dusk and the two
     cancel into mud. Highlights take the color of the light at any hour. */
  c *= mix(mix(vec3(1.0), vec3(0.955,0.980,1.045), uDay),
           vec3(1.045,1.005,0.945), smoothstep(0.0, 0.80, lum));
  vec2 q = uv - 0.5;
  return c * (1.0 - dot(q,q)*0.21);
}
void main(){
  vec3 d = normalize(vRay);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHoriz, uZenith, pow(h, 0.62));
  /* haze thickening toward the horizon, as over a dry limestone city */
  col = mix(col, uHoriz*1.06, pow(1.0-h, 7.0)*0.7);
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * pow(sd, 320.0) * 12.0;            // the disc
  col += uSunCol * pow(sd, 9.0)  * 0.16;             // the glow round it
  col += uSunCol * pow(sd, 2.0)  * 0.045;
  col = tonemap(col * uExposure);
  col = grade(col, gl_FragCoord.xy/uViewport);
  outColor = vec4(pow(clamp(col,0.0,1.0), vec3(1.0/2.2)), 1.0);
}`;

/* ------------------------------------------------------------------ *
 *  Billboard flames and smoke. Four vertices share one anchor; the corner
 *  offset expands them into a quad facing the camera, and everything moves
 *  from a looping life fraction, so nothing has to be updated per frame.
 * ------------------------------------------------------------------ */
const VS_PUFF = `#version 300 es
layout(location=0) in vec3 aAnchor;
layout(location=1) in vec2 aCorner;
layout(location=2) in vec4 aParam;          // seed, size, rise, kind(0 fire,1 smoke)
uniform mat4 uProj, uView;
uniform vec3 uCamRight, uCamUp;
uniform float uTime;
out vec2  vC;
out float vLife, vKind, vSeed;
void main(){
  float seed=aParam.x, size=aParam.y, rise=aParam.z, kind=aParam.w;
  float period = mix(1.35, 8.5, kind);      // flames flicker, smoke drifts
  float life   = fract(uTime/period + seed);
  vC=aCorner; vLife=life; vKind=kind; vSeed=seed;

  vec3 p = aAnchor;
  p.y += life * rise;
  /* lateral wander, much wider for smoke */
  float dr = mix(0.30, 2.6, kind) * life;
  p.x += sin(seed*31.4 + uTime*0.55) * dr;
  p.z += cos(seed*17.7 + uTime*0.47) * dr;

  /* flames narrow as they rise, smoke expands */
  float grow = mix(1.0 - 0.5*life, 0.45 + 2.6*life, kind);
  p += (uCamRight*aCorner.x + uCamUp*aCorner.y) * (size*grow);
  gl_Position = uProj * uView * vec4(p,1.0);
}`;

const FS_PUFF = `#version 300 es
precision highp float;
in vec2 vC; in float vLife, vKind, vSeed;
uniform sampler2D uSprite;
uniform float uExposure;
out vec4 outColor;
void main(){
  float a = texture(uSprite, vC*0.5+0.5).a;
  if(a < 0.004) discard;
  /* in fast, out slow */
  float fade = smoothstep(0.0,0.10,vLife)
             * (1.0 - smoothstep(mix(0.40,0.58,vKind), 1.0, vLife));
  if(vKind < 0.5){
    float r = clamp(length(vC), 0.0, 1.0);
    vec3 c = mix(vec3(1.00,0.95,0.70), vec3(1.00,0.48,0.12), pow(r,0.75));
    c = mix(c, vec3(0.66,0.11,0.02), clamp(vLife*1.35,0.0,1.0));
    outColor = vec4(c * a * fade * 1.35, 1.0);      // additive: alpha ignored
  } else {
    /* Pale and warm where it leaves the fire, cooling as it climbs. Kept thin
       on purpose: the puffs are not depth-sorted, so looking along the column
       stacks dozens of them and any generous alpha turns into a dark blot. */
    vec3 c = mix(vec3(0.74,0.69,0.62), vec3(0.40,0.38,0.37), pow(vLife,0.8));
    outColor = vec4(c, a * fade * 0.15);
  }
}`;

const VS_LINE = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uProj, uView;
void main(){ gl_Position = uProj*uView*vec4(aPos,1.0); }`;
const FS_LINE = `#version 300 es
precision highp float;
uniform vec3 uCol; uniform float uA;
out vec4 outColor;
void main(){ outColor = vec4(uCol, uA); }`;

/* ================================================================== */
/* ------------------------------------------------------------------ *
 *  HOW MANY DEPTH BITS THIS BROWSER WILL GIVE, asked before anything is built.
 *  You cannot request a depth format for the default framebuffer—the browser
 *  picks one—and iOS picks SIXTEEN where a desktop picks twenty-four. That is
 *  a factor of 256 in how far apart two surfaces have to be to stay apart, and
 *  it is the whole of why this model flickered on an iPad and nowhere else.
 *
 *  So a one-pixel context is made, asked, and thrown away. What it answers
 *  decides how the real one is built: on a deep buffer, nothing changes. On a
 *  shallow one the default framebuffer's own multisampling is turned OFF and
 *  the scene is drawn into a buffer of our own instead, which CAN be asked for
 *  24-bit depth and which does its own multisampling—so the antialiasing is
 *  not lost, it moves, and the memory it costs is paid once rather than twice.
 * ------------------------------------------------------------------ */
/* The resolution ladder. Coarse on purpose—see `_govern`. The floor is a
   half, which on a phone reporting devicePixelRatio 3 still leaves the buffer
   at 1 device pixel per CSS pixel; below that text-sized detail in the
   colonnades starts to crawl. */
const SCALES = [1.0, 0.85, 0.72, 0.6, 0.5];

function probeDepthBits(){
  try{
    const c = document.createElement('canvas'); c.width=c.height=1;
    const g = c.getContext('webgl2',{antialias:true, alpha:false, depth:true});
    if(!g) return 24;
    const b = g.getParameter(g.DEPTH_BITS) || 16;
    g.getExtension('WEBGL_lose_context')?.loseContext();
    return b;
  }catch(err){ return 24; }        // if it cannot be asked, assume the good case
}

class Renderer {
  constructor(canvas){
    this.canvas = canvas;
    const shallow = probeDepthBits() < 24;
    const gl = canvas.getContext('webgl2', {
      antialias: !shallow, alpha:false, depth:true,
      powerPreference:'high-performance', preserveDrawingBuffer:false
    });
    if(!gl) throw new Error('WebGL 2 is not available in this browser.');
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_float');
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    /* WHAT THIS IS RUNNING ON, asked once and up front. It used to be asked
       inside `_pickShadowSize` and thrown away; the resolution governor wants
       the same answer, so it is kept. A software rasteriser and a phone GPU
       both say so plainly in the renderer string. */
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.rendererName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||'') : '';
    this.software = /swiftshader|software|llvmpipe|basic render/i.test(this.rendererName);
    this.mobile   = /adreno|mali|apple gpu|powervr|videocore/i.test(this.rendererName);

    this.progMain  = this._prog(VS_MAIN, FS_MAIN);
    this.progDepth = this._prog(VS_DEPTH, FS_DEPTH);
    this.progDepthA= this._prog(VS_DEPTH_A, FS_DEPTH_A);
    this.progSky   = this._prog(VS_SKY, FS_SKY);
    this.progLine  = this._prog(VS_LINE, FS_LINE);
    this.progPuff  = this._prog(VS_PUFF, FS_PUFF);

    this.uM = this._uniforms(this.progMain,
      ['uProj','uView','uLightVP','uTex','uShadow','uSunDir','uSunCol','uZenith',
       'uHoriz','uBounce','uCamPos','uAmb','uSpec','uShin','uEmis','uAlphaTest',
       'uTint','uClip','uClipOn','uFogDensity','uShadowTexel','uExposure','uMetal','uWave','uTime','uReflTint','uBlotch','uDepthRange','uNrmOffset',
       'uTex2','uBlend','uBlendUv','uNrmTex','uBump','uSlabs','uGrime','uViewport','uDay',
       'uLightPos','uLightCol','uLightR','uLightN']);
    this.uD = this._uniforms(this.progDepth, ['uLightVP']);
    this.uDA= this._uniforms(this.progDepthA,['uLightVP','uTex']);
    this.uS = this._uniforms(this.progSky,
      ['uInvVP','uCamPos','uZenith','uHoriz','uSunDir','uSunCol','uExposure','uViewport','uDay']);
    this.uL = this._uniforms(this.progLine, ['uProj','uView','uCol','uA']);
    this.uP = this._uniforms(this.progPuff,
      ['uProj','uView','uCamRight','uCamUp','uTime','uSprite','uExposure']);

    /* sky quad */
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindVertexArray(null);

    /* line buffer for the selection box */
    this.lineVao = gl.createVertexArray();
    this.lineBuf = gl.createBuffer();
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(72), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindVertexArray(null);
    this.lineCount = 0;

    this._initShadow(this._pickShadowSize());

    this.proj = M4.create(); this.view = M4.create();
    this.lightVP = M4.create(); this.invVP = M4.create();
    this.vp = M4.create();

    /* The resolution governor's state. EVERY MACHINE STARTS AT FULL, including
       the ones we can see are phones: `WEBGL_debug_renderer_info` is not
       reliably given out any more, a phone fast enough to hold 60 at full
       resolution should have it, and measuring takes about three seconds to
       find the answer for itself. What the renderer string is still trusted
       for is the shadow map's size, which cannot be changed after the fact. */
    this.renderScale = SCALES[0];
    this.frameMs = 0;
    this._scaleAt = 0;
    this._lastFrame = 0;
    this._frames = 0;
    this.cssW = 1; this.cssH = 1;

    /* what the depth map was last drawn for; see the shadow pass */
    this._shadowVP = new Float32Array(16);
    this._shadowMask = -1;

    /* the point lights, uploaded every frame and so not reallocated every
       frame */
    this._lp = new Float32Array(12);
    this._lc = new Float32Array(12);
    this._lr = new Float32Array(4);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    /* THE OFFSCREEN BUFFER, on shallow-depth machines only. Its depth
       attachment is DEPTH_COMPONENT24 because a renderbuffer, unlike the
       default framebuffer, is a thing you can ask.

       ONLY WHERE IT IS NEEDED. It costs a color and a depth renderbuffer at
       drawing-buffer size and one resolve every frame, on precisely the device
       that has the least memory and bandwidth to spare—so a desktop, which
       already had 24 bits, never allocates it and never blits. And `depthBits`
       is left reporting what the scene is ACTUALLY drawn into, so the near
       plane relaxes to the desktop rule the moment this works. */
    this.depthBits = gl.getParameter(gl.DEPTH_BITS) || 16;
    this.msaa = null;
    if(shallow && this.depthBits < 24){
      this.msaa = { fbo:gl.createFramebuffer(), col:null, dep:null, w:0, h:0,
                    samples: Math.min(4, gl.getParameter(gl.MAX_SAMPLES)||0) };
      this.depthBits = 24;
    }
  }

  /* (re)allocate the offscreen buffer for a drawing buffer of w × h */
  _sizeOffscreen(w,h){
    const gl=this.gl, m=this.msaa;
    if(!m || (m.w===w && m.h===h)) return;
    m.w=w; m.h=h;
    if(m.col) gl.deleteRenderbuffer(m.col);
    if(m.dep) gl.deleteRenderbuffer(m.dep);
    m.col=gl.createRenderbuffer(); m.dep=gl.createRenderbuffer();
    const store=(rb,fmt)=>{
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      if(m.samples>1) gl.renderbufferStorageMultisample(gl.RENDERBUFFER,m.samples,fmt,w,h);
      else            gl.renderbufferStorage(gl.RENDERBUFFER,fmt,w,h);
    };
    store(m.col, gl.RGBA8);
    store(m.dep, gl.DEPTH_COMPONENT24);
    gl.bindFramebuffer(gl.FRAMEBUFFER, m.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,m.col);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER,m.dep);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.bindRenderbuffer(gl.RENDERBUFFER,null);
    /* A BLACK SCREEN IS WORSE THAN A FLICKER. If the driver will not give us
       this combination, drop back to the default framebuffer and tell the
       camera the truth about it, so the near plane takes the strain again. */
    if(!ok){
      gl.deleteRenderbuffer(m.col); gl.deleteRenderbuffer(m.dep);
      gl.deleteFramebuffer(m.fbo);
      this.msaa=null;
      this.depthBits = gl.getParameter(gl.DEPTH_BITS) || 16;
    }
  }

  /* resolve the offscreen buffer onto the page */
  _present(){
    const gl=this.gl, m=this.msaa;
    if(!m) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, m.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0,0,m.w,m.h, 0,0,m.w,m.h,
                       gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _pickShadowSize(){
    const gl = this.gl;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    /* A software rasteriser cannot afford a large shadow map; neither can a
       phone. Both report themselves clearly enough to act on. */
    if(this.software) return 1024;
    if(this.mobile && max<16384) return 2048;
    if(max >= 8192) return 4096;
    if(max >= 4096) return 3072;
    return 2048;
  }

  _prog(vs,fs){
    const gl=this.gl;
    const c=(t,s)=>{ const o=gl.createShader(t); gl.shaderSource(o,s);
      gl.compileShader(o);
      if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))
        throw new Error('shader: '+gl.getShaderInfoLog(o));
      return o; };
    const p=gl.createProgram();
    gl.attachShader(p,c(gl.VERTEX_SHADER,vs));
    gl.attachShader(p,c(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))
      throw new Error('link: '+gl.getProgramInfoLog(p));
    return p;
  }
  _uniforms(p,names){
    const o={}; for(const n of names) o[n]=this.gl.getUniformLocation(p,n); return o;
  }

  _initShadow(size){
    const gl=this.gl;
    this.shadowSize = size;
    this.shadowFbo = gl.createFramebuffer();
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,
                  gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,
                            this.shadowTex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }

  /* ---- upload the compiled scene ---- */
  setScene(scene){
    const gl=this.gl;
    this.scene = scene;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,scene.vertices,gl.STATIC_DRAW);
    const S=9*4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,S,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,S,12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,S,24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,1,gl.FLOAT,false,S,32);
    const ib=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,scene.indices,gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.idxType = scene.indices instanceof Uint32Array
                 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    this.idxBytes = scene.indices instanceof Uint32Array ? 4 : 2;

    /* textures */
    this.tex = {};
    this.nrmTex = {};
    for(const name of Object.keys(MATERIALS)){
      const cvs = MATERIALS[name].tex();
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      /* SRGB8_ALPHA8, not RGBA: the canvases are authored in sRGB, and the
         lighting maths downstream is linear. Sampling them as if they were
         already linear lifts every midtone and flattens the whole image. */
      gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,cvs);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      if(this.aniso){
        const m=gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,
                         Math.min(8,m));
      }
      this.tex[name]=t;

      /* and its relief, if it has any. RGBA8, NOT sRGB: this one is data, and
         putting it through the sRGB decode would bend every normal it stores. */
      if(MATERIALS[name].bump){
        const nm=TexLib.normalMap(cvs, 1.5);
        const nt=gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D,nt);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,nm);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
        this.nrmTex[name]=nt;
      }
    }
    /* ---- the billboard buffer: separate from the scene, its own layout ---- */
    this.puff = null;
    if(typeof PUFFS !== 'undefined' && PUFFS.indices.length){
      const vao=gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb2=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,vb2);
      gl.bufferData(gl.ARRAY_BUFFER,PUFFS.vertices,gl.STATIC_DRAW);
      const PS=9*4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,PS,0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false,PS,12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,PS,20);
      const ib2=gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib2);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,PUFFS.indices,gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      const sp=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,sp);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,TexLib.puffSprite());
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.puff = { vao, tex:sp, flame:PUFFS.flameCount, smoke:PUFFS.smokeCount };
    }

    /* group the draws so we bind each texture once */
    this.byMat = new Map();
    for(const d of scene.draws){
      if(!this.byMat.has(d.mat)) this.byMat.set(d.mat, []);
      this.byMat.get(d.mat).push(d);
    }
    /* every layer name that exists, in a fixed order, so "which layers are on"
       can be reduced to one integer and compared */
    this.layers = [...new Set(scene.draws.map(d=>d.layer))];
    this._shadowMask = -1;
  }

  /* ------------------------------------------------------------------ *
   *  HOW MANY PIXELS THE FRAME IS WORTH.
   *
   *  Almost everything expensive in this renderer is per-pixel—thirteen
   *  shadow taps in a penumbra, three octaves of noise on the hillside, a
   *  tangent frame from derivatives—so the drawing buffer's area is the one
   *  number that scales the whole cost. A phone at devicePixelRatio 3 was
   *  being asked for four times the pixels of the same page at 1, for a
   *  sharpness difference nobody can see at arm's length on a 400-pixel-wide
   *  screen, and it is why a mid-range Android sat at 25 fps.
   *
   *  So the scale is measured rather than assumed. The frame period is
   *  averaged slowly—one long frame is a hitch, not a trend—and when the
   *  average will not fit in the budget the scale takes one step down the
   *  ladder. Steps are coarse and rate-limited because each one reallocates
   *  the offscreen buffer on the machines that have one.
   *
   *  IT CLIMBS BACK ONLY WHERE IT CAN SEE THAT IT SHOULD. Vsync clamps the
   *  measurement: on a 60 Hz display a frame with vast headroom and a frame
   *  with none both read 16.7 ms, so on that display this is a one-way
   *  ratchet and the up threshold—deliberately below the 60 Hz period—
   *  never fires. On a 90 or 120 Hz phone the headroom is visible and it
   *  does climb. Either way it never oscillates, which is worse to look at
   *  than a slightly soft picture. A window resize starts it over.
   * ------------------------------------------------------------------ */
  _govern(now){
    const ms = this.frameMs;
    if(!ms || now - this._scaleAt < 900) return;
    const i = SCALES.indexOf(this.renderScale);
    if(ms > 22.0 && i < SCALES.length-1){
      this.renderScale = SCALES[i+1]; this._scaleAt = now;
    }else if(ms < 12.0 && i > 0 && now - this._scaleAt > 2500){
      this.renderScale = SCALES[i-1]; this._scaleAt = now;
    }
  }
  /* the picture is worth the pixels again: a new window is a new question */
  resetScale(){ this.renderScale = SCALES[0];
                this.frameMs = 0; this._frames = 0;
                this._scaleAt = performance.now(); }

  resize(){
    const gl=this.gl, c=this.canvas;
    /* READ THE LAYOUT ONCE. clientWidth/clientHeight force the browser to
       flush pending style and layout work, and this used to be called twice
       per frame—so the numbers are kept for the label overlay and the scale
       bar, which were each asking for their own. */
    const cw = Math.max(1, c.clientWidth), ch = Math.max(1, c.clientHeight);
    this.cssW = cw; this.cssH = ch;
    const dpr = Math.min(window.devicePixelRatio||1, 2) * this.renderScale;
    const w = Math.max(1, Math.round(cw*dpr));
    const h = Math.max(1, Math.round(ch*dpr));
    if(c.width!==w || c.height!==h){ c.width=w; c.height=h; }
    /* the ASPECT is the element's, not the buffer's: at a fractional scale the
       two round differently, and a projection built from the buffer's would
       stretch the picture by that rounding */
    this.aspect = cw/ch;
    this._sizeOffscreen(w,h);
    gl.viewport(0,0,w,h);
  }

  setSelection(aabb){
    if(!aabb){ this.lineCount=0; return; }
    const [a,b]=aabb;
    const V=[[a[0],a[1],a[2]],[b[0],a[1],a[2]],[b[0],a[1],b[2]],[a[0],a[1],b[2]],
             [a[0],b[1],a[2]],[b[0],b[1],a[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]];
    const E=[0,1,1,2,2,3,3,0, 4,5,5,6,6,7,7,4, 0,4,1,5,2,6,3,7];
    const arr=new Float32Array(E.length*3);
    E.forEach((vi,i)=>{ arr[i*3]=V[vi][0]; arr[i*3+1]=V[vi][1]; arr[i*3+2]=V[vi][2]; });
    const gl=this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
    this.lineCount=E.length;
  }

  /* ---- the frame ---- */
  render(st){
    const gl=this.gl;
    /* the frame period, for the resolution governor. Measured start-to-start,
       so it is the whole frame—this renderer, the labels, the browser's own
       compositing—and not just the part of it that is drawing. */
    const nowMs = performance.now();
    const dt = this._lastFrame ? nowMs - this._lastFrame : 0;
    this._lastFrame = nowMs;
    /* THE FIRST SECOND IS NOT EVIDENCE. Shader compilation, the texture
       upload and the browser's own first paint all land in the opening
       frames; averaged in, they read as a machine that cannot cope and the
       governor would walk the resolution down to the floor before the scene
       had been still for a moment. Long frames later on are dropped for the
       same reason—a hitch is not a trend. */
    if(dt > 0 && dt < 500 && ++this._frames > 20)
      this.frameMs = this.frameMs ? this.frameMs*0.9 + dt*0.1 : dt;
    this._govern(nowMs);
    this.resize();
    const pal = skyPalette(st.sunAlt);
    const sun = st.sunDir;

    /* --- fit the shadow frustum around what the camera is looking at,
       so shadows sharpen as you move in ---

       AND HOLD ITS TEXEL GRID STILL. Re-centered and re-scaled on the camera
       every frame, the depth map's grid slid continuously as you moved, so
       every shadow edge crawled a texel at a time and read as a flicker over
       the stone—"sometimes gray, sometimes stone" along a wall head, which
       looks exactly like z-fighting and is not. Two things fix it. The radius
       is QUANTISED to powers of two, so the texel size changes in steps rather
       than continuously. And the light view is built about a FIXED reference
       point instead of the focus, so light space itself does not move; the
       focus is then SNAPPED to whole texels inside it. Shadows still sharpen as
       you close in, but only at the tiers, and between tiers they are welded to
       the world. */
    const Rw = clamp(st.focusRadius, 42, 520);
    const R  = Math.min(520, Math.pow(2, Math.ceil(Math.log2(Rw))));
    const c = st.focus;
    const LD = 620;                                   // light standoff
    const ref = [150, 0, 240];                        // fixed: the platform
    const eye=[ref[0]+sun[0]*LD, ref[1]+sun[1]*LD, ref[2]+sun[2]*LD];
    const lView=M4.lookAt(M4.create(), eye, ref, [0,1,0]);
    const cl = M4.xformPoint(lView, c[0], c[1], c[2], [0,0,0]);
    const texel = 2*R/this.shadowSize;
    const cx = Math.round(cl[0]/texel)*texel;
    const cy = Math.round(cl[1]/texel)*texel;
    /* Fit the depth range to what is actually in the frustum. A fixed
       1..1400 range made every normalized bias enormous in world terms. The
       center's own light-space depth carries it now, because light space no
       longer follows the focus. */
    const cz = -cl[2];
    const lNear = Math.max(1, cz - R - 260), lFar = cz + R + 380;
    const lProj=M4.ortho(M4.create(), cx-R,cx+R, cy-R,cy+R, lNear, lFar);
    M4.mul(this.lightVP, lProj, lView);
    this.shadowDepthRange = lFar - lNear;
    this.shadowNrmOffset  = (2*R/this.shadowSize) * 1.6;

    /* --- shadow pass, WHEN THE MAP WOULD COME OUT DIFFERENT ---
     *
     *  The depth map is a function of exactly three things: where the sun is,
     *  which layers are on, and the light box. And the light box was built,
     *  above, to hold still—a fixed reference point, a radius quantised to
     *  powers of two, a center snapped to whole texels—for reasons that had
     *  nothing to do with speed. The consequence is that while you orbit a
     *  fixed target, or zoom within one radius tier, or simply sit and watch
     *  the flames, every input is bit-for-bit what it was last frame, and
     *  three hundred thousand triangles were being transformed and rasterised
     *  to produce the map that is already in the texture.
     *
     *  A framebuffer attachment keeps its contents until something writes to
     *  it, so the map is simply left alone. The moment the sun moves, a layer
     *  is switched, or the camera pans onto new ground, the comparison fails
     *  and the pass runs—this changes how often the map is drawn, never
     *  what is in it. */
    let mask=0, bit=1;
    for(const L of this.layers){ if(st.layerOn(L)) mask+=bit; bit*=2; }
    let fresh = (mask === this._shadowMask);
    if(fresh)
      for(let i=0;i<16;i++)
        if(this._shadowVP[i] !== this.lightVP[i]){ fresh=false; break; }

    if(!fresh){
      this._shadowMask = mask;
      this._shadowVP.set(this.lightVP);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0,0,this.shadowSize,this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.progDepth);
      gl.uniformMatrix4fv(this.uD.uLightVP,false,this.lightVP);
      gl.bindVertexArray(this.vao);
      gl.colorMask(false,false,false,false);
      const cutouts=[];
      for(const d of this.scene.draws){
        if(!st.layerOn(d.layer) || d.layer==='overlay' || d.layer==='grid') continue;
        const M = MATERIALS[d.mat];
        if(M && M.emis) continue;                 // a flame casts no shadow
        if(M && M.alpha){ cutouts.push(d); continue; }
        gl.drawElements(gl.TRIANGLES, d.count, this.idxType, d.start*this.idxBytes);
      }
      /* the cut-outs—the soreg's lattice—in their own program */
      if(cutouts.length){
        gl.useProgram(this.progDepthA);
        gl.uniformMatrix4fv(this.uDA.uLightVP,false,this.lightVP);
        gl.uniform1i(this.uDA.uTex,0);
        gl.activeTexture(gl.TEXTURE0);
        for(const d of cutouts){
          gl.bindTexture(gl.TEXTURE_2D,this.tex[d.mat]);
          gl.drawElements(gl.TRIANGLES, d.count, this.idxType, d.start*this.idxBytes);
        }
      }
      gl.colorMask(true,true,true,true);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }

    /* --- main pass --- *
     *  THE NEAR PLANE IS NOT A CONSTANT, and 0.28 was the whole of the iPad's
     *  flickering. Depth resolution at a distance z goes as z²/(near · 2^bits),
     *  so the near plane is a multiplier on every surface in the scene: at 0.28
     *  and the 24 bits a desktop gives, two faces 200 m out resolve to 25 mm
     *  and everything holds. The same page on an iPad gets SIXTEEN bits, where
     *  the same pair resolves to 2.2 m—and every stacked surface in the model
     *  is inside 2.2 m of its neighbor. That is why it was the four corner
     *  courts, the reservoir and the Antonia's paving, and why it was only ever
     *  reported from the iPad.
     *
     *  A near plane a fortieth of the working distance costs nothing—at a
     *  200 m orbit it clips within 5 m of an eye that is 200 m from what it is
     *  looking at—and buys back a factor of eighteen. `near` comes from the
     *  app, which knows whether you are orbiting something or standing in it. */
    /* the viewport back off the shadow map—`resize` used to be called a
       second time here to do it, at the cost of a second forced layout every
       frame, and it cannot be called here at all now that the shadow pass may
       be skipped: re-reading the layout after the light matrices were built
       would let the two disagree */
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    /* onto our own 24-bit buffer where there is one, straight at the page
       where there is not—`resize` sized or dropped it at the top of the
       frame */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa ? this.msaa.fbo : null);
    M4.perspective(this.proj, st.fov*DEG, this.aspect, st.near||0.28, 4200);
    M4.copy(this.view, st.view);
    M4.mul(this.vp, this.proj, this.view);
    M4.invert(this.invVP, this.vp);

    /* the sky covers every pixel, so the color clear is only owed to the
       offscreen buffer, whose contents start undefined rather than last frame's */
    gl.clear(gl.DEPTH_BUFFER_BIT | (this.msaa ? gl.COLOR_BUFFER_BIT : 0));

    /* sky */
    gl.useProgram(this.progSky);
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(this.uS.uInvVP,false,this.invVP);
    gl.uniform3fv(this.uS.uCamPos, st.camPos);
    gl.uniform3fv(this.uS.uZenith, pal.zenith);
    gl.uniform3fv(this.uS.uHoriz,  pal.horiz);
    gl.uniform3fv(this.uS.uSunDir, sun);
    gl.uniform3fv(this.uS.uSunCol, pal.sun);
    gl.uniform1f(this.uS.uExposure, pal.exposure);
    gl.uniform2f(this.uS.uViewport, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uS.uDay, pal.day);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);

    /* geometry */
    gl.useProgram(this.progMain);
    const u=this.uM;
    gl.uniformMatrix4fv(u.uProj,false,this.proj);
    gl.uniformMatrix4fv(u.uView,false,this.view);
    gl.uniformMatrix4fv(u.uLightVP,false,this.lightVP);
    gl.uniform3fv(u.uSunDir,sun);
    gl.uniform3fv(u.uSunCol,pal.sun);
    gl.uniform3fv(u.uZenith,pal.zenith);
    gl.uniform3fv(u.uHoriz,pal.horiz);
    gl.uniform3fv(u.uBounce,pal.bounce);
    gl.uniform3fv(u.uCamPos,st.camPos);
    gl.uniform1f(u.uAmb,pal.amb);
    gl.uniform1f(u.uExposure,pal.exposure);
    gl.uniform2f(u.uViewport, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uDay, pal.day);
    gl.uniform1f(u.uTime, st.time||0);
    /* point lights, relatively stronger as the sun goes down */
    const L = (st.lights||[]).slice(0,4);
    const gain = lerp(2.4, 0.85, clamp(Math.sin(Math.max(st.sunAlt,0))*1.35,0,1));
    const lp=this._lp, lc=this._lc, lr=this._lr;
    L.forEach((l,i)=>{
      lp.set(l.at, i*3);
      lc.set([l.col[0]*gain, l.col[1]*gain, l.col[2]*gain], i*3);
      lr[i]=l.r;
    });
    gl.uniform3fv(u.uLightPos, lp);
    gl.uniform3fv(u.uLightCol, lc);
    gl.uniform1fv(u.uLightR, lr);
    gl.uniform1i(u.uLightN, L.length);
    gl.uniform1f(u.uFogDensity, st.fogDensity);
    gl.uniform1f(u.uShadowTexel, 1/this.shadowSize);
    gl.uniform1f(u.uDepthRange, this.shadowDepthRange);
    gl.uniform1f(u.uNrmOffset, this.shadowNrmOffset);
    gl.uniform4fv(u.uClip, st.clip);
    gl.uniform1f(u.uClipOn, st.clipOn?1:0);
    gl.uniform1i(u.uTex,0);
    gl.uniform1i(u.uShadow,1);
    gl.uniform1i(u.uTex2,2);
    gl.uniform1i(u.uNrmTex,3);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,this.shadowTex);
    gl.bindVertexArray(this.vao);

    for(const [mat,draws] of this.byMat){
      const M = MATERIALS[mat] || MATERIALS.plaster;
      let any=false;
      for(const d of draws) if(st.layerOn(d.layer)){ any=true; break; }
      if(!any) continue;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.tex[mat]);
      gl.uniform1f(u.uSpec,M.spec);
      gl.uniform1f(u.uShin,M.shin);
      gl.uniform1f(u.uEmis,M.emis||0);
      gl.uniform1f(u.uMetal,M.metal||0);
      gl.uniform1f(u.uWave,M.wave||0);
      gl.uniform1f(u.uReflTint, M.reflTint===undefined?1:M.reflTint);
      gl.uniform1f(u.uBlotch, M.blotch||0);
      gl.uniform1f(u.uAlphaTest,M.alpha||0);
      /* a second albedo, borrowed from another material's texture rather than
         uploaded again—the hillside's bedrock is the same image `rock` uses */
      gl.uniform1f(u.uBlend, M.blend2?1:0);
      if(M.blend2){
        gl.uniform1f(u.uBlendUv, M.blendUv||1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.tex[M.blend2]);
      }
      gl.uniform2fv(u.uSlabs, M.slabs||[0,0]);
      gl.uniform1f(u.uGrime, M.grime||0);
      const nm = this.nrmTex[mat];
      gl.uniform1f(u.uBump, nm ? M.bump : 0);
      if(nm){
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, nm);
      }
      gl.uniform3fv(u.uTint,M.tint);
      for(const d of draws){
        if(!st.layerOn(d.layer)) continue;
        /* the section plane cuts the Sanctuary's fabric—shell, floors,
           ceilings, paneling and veils—but never its furniture */
        gl.uniform1f(u.uClipOn, (st.clipOn && d.layer==='sanct')?1:0);
        gl.drawElements(gl.TRIANGLES,d.count,this.idxType,d.start*this.idxBytes);
      }
    }

    /* ---- flames and smoke ---- */
    if(this.puff && st.fire !== false){
      const P=this.uP;
      gl.useProgram(this.progPuff);
      gl.uniformMatrix4fv(P.uProj,false,this.proj);
      gl.uniformMatrix4fv(P.uView,false,this.view);
      /* camera basis straight out of the view matrix's rows */
      gl.uniform3f(P.uCamRight, this.view[0], this.view[4], this.view[8]);
      gl.uniform3f(P.uCamUp,    this.view[1], this.view[5], this.view[9]);
      gl.uniform1f(P.uTime, st.time||0);
      gl.uniform1f(P.uExposure, pal.exposure);
      gl.uniform1i(P.uSprite, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.puff.tex);
      gl.bindVertexArray(this.puff.vao);
      gl.enable(gl.BLEND);
      gl.depthMask(false);                       // tested against the scene, never written
      /* flames additively—no sorting needed—then smoke over them */
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawElements(gl.TRIANGLES, this.puff.flame, gl.UNSIGNED_SHORT, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, this.puff.smoke, gl.UNSIGNED_SHORT,
                      this.puff.flame*2);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    /* selection box */
    if(this.lineCount){
      gl.useProgram(this.progLine);
      gl.uniformMatrix4fv(this.uL.uProj,false,this.proj);
      gl.uniformMatrix4fv(this.uL.uView,false,this.view);
      gl.uniform3f(this.uL.uCol, 0.98,0.86,0.55);
      gl.uniform1f(this.uL.uA, 0.5);
      gl.bindVertexArray(this.lineVao);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.LINES,0,this.lineCount);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
    }
    gl.bindVertexArray(null);
    this._present();
  }
}
