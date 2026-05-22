// Seedable 2D/3D simplex noise, shared across antlii tools.
// Call seedNoise(seed) for deterministic output (used by tools with a Seed param).
const PERM = new Uint8Array(512);
const GRAD3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedNoise(seed = 0) {
  const rnd = mulberry32(seed >>> 0);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
seedNoise((Math.random() * 65536) | 0);

function dot2(g, x, y) { return g[0] * x + g[1] * y; }
function dot3(g, x, y, z) { return g[0] * x + g[1] * y + g[2] * z; }

export function noise2D(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * dot2(GRAD3[PERM[ii + PERM[jj]] % 12], x0, y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * dot2(GRAD3[PERM[ii + i1 + PERM[jj + j1]] % 12], x1, y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * dot2(GRAD3[PERM[ii + 1 + PERM[jj + 1]] % 12], x2, y2); }
  return 70 * (n0 + n1 + n2);
}

export function noise3D(xin, yin, zin) {
  const F3 = 1 / 3, G3 = 1 / 6;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
    else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
    else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
  } else {
    if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
    else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
    else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
  }
  const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
  const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
  const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
  const ii=i&255,jj=j&255,kk=k&255;
  let n0=0,n1=0,n2=0,n3=0;
  let t0=0.6-x0*x0-y0*y0-z0*z0;
  if(t0>0){t0*=t0;n0=t0*t0*dot3(GRAD3[PERM[ii+PERM[jj+PERM[kk]]]%12],x0,y0,z0);}
  let t1=0.6-x1*x1-y1*y1-z1*z1;
  if(t1>0){t1*=t1;n1=t1*t1*dot3(GRAD3[PERM[ii+i1+PERM[jj+j1+PERM[kk+k1]]]%12],x1,y1,z1);}
  let t2=0.6-x2*x2-y2*y2-z2*z2;
  if(t2>0){t2*=t2;n2=t2*t2*dot3(GRAD3[PERM[ii+i2+PERM[jj+j2+PERM[kk+k2]]]%12],x2,y2,z2);}
  let t3=0.6-x3*x3-y3*y3-z3*z3;
  if(t3>0){t3*=t3;n3=t3*t3*dot3(GRAD3[PERM[ii+1+PERM[jj+1+PERM[kk+1]]]%12],x3,y3,z3);}
  return 32*(n0+n1+n2+n3);
}
