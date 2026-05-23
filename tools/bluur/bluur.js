// BLUUR — soft, evolving compositions where shapes merge through blur. A field
// of seeded soft shapes (gaussian falloff = blur level) is accumulated in a GLSL
// fragment shader and mapped through a procedural (cosine) or custom palette,
// with GLSL noise texture and an animated color shift. p5 WebGL; PNG export.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';

const MAX = 40;

const params = {
  count: 18, size: 0.28, sizeVar: 0.4, spread: 1, blur: 0.35, seed: 7,
  paletteMode: 'procedural', palettePreset: 'rainbow', c0: '#ff7675', c1: '#6c5ce7', c2: '#00cec9',
  blendRange: 0.9, colorSpeed: 0.15, noiseAmount: 0.12, noiseFreq: 3,
  animate: true, drift: 0.04, background: '#06070d',
};

// Inigo Quilez cosine-palette coefficient sets (a, b, c, d), public-domain math.
const PRESETS = {
  rainbow: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 1], d: [0, 0.33, 0.67] },
  warm: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 0.5], d: [0.8, 0.9, 0.3] },
  cool: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 1], d: [0.0, 0.1, 0.2] },
  candy: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2, 1, 0], d: [0.5, 0.2, 0.25] },
};

const VERT = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 pos = vec4(aPosition, 1.0);
  pos.xy = pos.xy * 2.0 - 1.0;
  gl_Position = pos;
}`;

const FRAG = `
precision highp float;
varying vec2 vTexCoord;
uniform float uTime, uAspect, uBlur, uBlendRange, uColorSpeed, uNoiseAmount, uNoiseFreq;
uniform int uCount, uPaletteMode;
uniform vec4 uShapes[${MAX}];
uniform vec3 uPalA, uPalB, uPalC, uPalD, uC0, uC1, uC2, uBg;

vec3 _p(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = _p(_p(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 a0 = x - floor(x + 0.5);
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 palette(float t) {
  if (uPaletteMode == 1) {
    float s = fract(t) * 2.0;
    return s < 1.0 ? mix(uC0, uC1, s) : mix(uC1, uC2, s - 1.0);
  }
  return uPalA + uPalB * cos(6.28318 * (uPalC * t + uPalD));
}

void main() {
  vec2 uv = vTexCoord;
  float field = 0.0, ph = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 s = uShapes[i];
    vec2 d = vec2((uv.x - s.x) * uAspect, uv.y - s.y);
    float r = length(d) / max(0.02, s.z);
    float w = exp(-r * r / max(0.01, uBlur));
    field += w;
    ph += w * s.w;
  }
  float t = field > 0.001 ? ph / field : 0.0;
  t = fract(t + uTime * uColorSpeed);
  t += snoise(uv * uNoiseFreq + uTime * 0.1) * uNoiseAmount;
  float intensity = smoothstep(0.0, uBlendRange, field);
  vec3 col = mix(uBg, palette(t), clamp(intensity, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hexVec(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }

function buildShapes(time) {
  const rnd = mulberry32(params.seed >>> 0);
  const n = Math.min(MAX, params.count);
  const flat = new Array(MAX * 4).fill(0);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * 0.5 * params.spread;
    let x = 0.5 + Math.cos(ang) * rad, y = 0.5 + Math.sin(ang) * rad;
    if (params.animate && params.drift > 0) { x += Math.sin(time * 0.6 + i * 1.3) * params.drift; y += Math.cos(time * 0.5 + i * 2.1) * params.drift; }
    const size = Math.max(0.02, params.size * (1 + (rnd() * 2 - 1) * params.sizeVar));
    flat[i * 4] = x; flat[i * 4 + 1] = y; flat[i * 4 + 2] = size; flat[i * 4 + 3] = rnd();
  }
  return { flat, n };
}

const tool = createTool({ name: 'BLUUR', version: '0.1' });
let prog = null, t = 0;

function setUniforms(p) {
  const s = prog;
  const { flat, n } = buildShapes(t);
  s.setUniform('uShapes', flat);
  s.setUniform('uCount', n);
  s.setUniform('uAspect', p.width / p.height);
  s.setUniform('uTime', t);
  s.setUniform('uBlur', params.blur);
  s.setUniform('uBlendRange', params.blendRange);
  s.setUniform('uColorSpeed', params.colorSpeed);
  s.setUniform('uNoiseAmount', params.noiseAmount);
  s.setUniform('uNoiseFreq', params.noiseFreq);
  s.setUniform('uPaletteMode', params.paletteMode === 'custom' ? 1 : 0);
  const pr = PRESETS[params.palettePreset] || PRESETS.rainbow;
  s.setUniform('uPalA', pr.a); s.setUniform('uPalB', pr.b); s.setUniform('uPalC', pr.c); s.setUniform('uPalD', pr.d);
  s.setUniform('uC0', hexVec(params.c0)); s.setUniform('uC1', hexVec(params.c1)); s.setUniform('uC2', hexVec(params.c2));
  s.setUniform('uBg', hexVec(params.background));
}

const p5i = tool.startSketch((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.setAttributes('preserveDrawingBuffer', true);
    p.noStroke();
    p.pixelDensity(1);
    prog = p.createShader(VERT, FRAG);
  };
  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
  p.draw = () => {
    if (!prog) return;
    if (params.animate) t += p.deltaTime / 1000;
    p.shader(prog);
    setUniforms(p);
    p.rect(0, 0, p.width, p.height);
  };
});

// ---- UI ----
const main = tool.pages.main;
const fForm = main.addFolder({ title: 'Form' });
fForm.addBinding(params, 'count', { min: 1, max: MAX, step: 1 });
fForm.addBinding(params, 'size', { min: 0.05, max: 0.8, step: 0.01 });
fForm.addBinding(params, 'sizeVar', { label: 'size var', min: 0, max: 1, step: 0.05 });
fForm.addBinding(params, 'spread', { min: 0.1, max: 1.5, step: 0.05 });
fForm.addBinding(params, 'blur', { min: 0.02, max: 1.5, step: 0.02 });
fForm.addBinding(params, 'blendRange', { label: 'blend', min: 0.1, max: 3, step: 0.05 });
fForm.addBinding(params, 'seed', { min: 0, max: 1000, step: 1 });

const fPal = main.addFolder({ title: 'Palette' });
fPal.addBinding(params, 'paletteMode', { label: 'mode', options: { Procedural: 'procedural', Custom: 'custom' } });
fPal.addBinding(params, 'palettePreset', { label: 'preset', options: { Rainbow: 'rainbow', Warm: 'warm', Cool: 'cool', Candy: 'candy' } });
fPal.addBinding(params, 'c0', { label: 'color 1', view: 'color' });
fPal.addBinding(params, 'c1', { label: 'color 2', view: 'color' });
fPal.addBinding(params, 'c2', { label: 'color 3', view: 'color' });
fPal.addBinding(params, 'colorSpeed', { label: 'color spd', min: 0, max: 1, step: 0.01 });

const fTex = main.addFolder({ title: 'Texture' });
fTex.addBinding(params, 'noiseAmount', { label: 'noise', min: 0, max: 0.5, step: 0.01 });
fTex.addBinding(params, 'noiseFreq', { label: 'noise frq', min: 0.5, max: 12, step: 0.5 });
fTex.addBinding(params, 'background', { view: 'color' });

const fMotion = main.addFolder({ title: 'Motion' });
fMotion.addBinding(params, 'animate');
fMotion.addBinding(params, 'drift', { min: 0, max: 0.15, step: 0.005 });

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'bluur' });

const presets = {
  Lava: { count: 14, size: 0.34, blur: 0.5, blendRange: 0.8, paletteMode: 'procedural', palettePreset: 'warm', colorSpeed: 0.1, background: '#0a0402' },
  Aurora: { count: 22, size: 0.26, blur: 0.4, blendRange: 1.0, paletteMode: 'procedural', palettePreset: 'cool', colorSpeed: 0.18, drift: 0.05, background: '#02060a' },
  Bubblegum: { count: 28, size: 0.22, sizeVar: 0.6, blur: 0.28, blendRange: 1.2, paletteMode: 'procedural', palettePreset: 'candy', colorSpeed: 0.22, background: '#0c0410' },
  Nebula: { count: 12, size: 0.5, sizeVar: 0.3, spread: 1.0, blur: 0.7, blendRange: 0.7, paletteMode: 'procedural', palettePreset: 'cool', colorSpeed: 0.12, noiseAmount: 0.18, drift: 0.04, background: '#02040a' },
  Mercury: { count: 18, size: 0.3, blur: 0.35, blendRange: 1.0, paletteMode: 'custom', c0: '#b2bec3', c1: '#636e72', c2: '#dfe6e9', colorSpeed: 0.08, background: '#0b0d12' },
  Citrus: { count: 30, size: 0.2, sizeVar: 0.5, spread: 1.1, blur: 0.22, blendRange: 1.3, paletteMode: 'procedural', palettePreset: 'warm', colorSpeed: 0.2, drift: 0.06, background: '#0a0602' },
  Plasma: { count: 24, size: 0.34, sizeVar: 0.6, spread: 1.2, blur: 0.4, blendRange: 1.5, paletteMode: 'procedural', palettePreset: 'rainbow', colorSpeed: 0.3, noiseAmount: 0.25, noiseFreq: 5, drift: 0.08, background: '#04040a' },
  'Slow Tide': { count: 7, size: 0.6, blur: 0.9, blendRange: 0.6, paletteMode: 'procedural', palettePreset: 'cool', colorSpeed: 0.06, drift: 0.02, background: '#02060a' },
  'Candy Foam': { count: 36, size: 0.16, sizeVar: 0.7, spread: 1.0, blur: 0.2, blendRange: 1.4, paletteMode: 'procedural', palettePreset: 'candy', colorSpeed: 0.25, background: '#0c0410' },
};
function randomize(p) {
  p.count = 6 + (Math.random() * (MAX - 6) | 0);
  p.size = 0.12 + Math.random() * 0.4;
  p.sizeVar = Math.random();
  p.spread = 0.4 + Math.random();
  p.blur = 0.1 + Math.random() * 0.9;
  p.blendRange = 0.4 + Math.random() * 1.8;
  p.seed = (Math.random() * 1000) | 0;
  p.palettePreset = ['rainbow', 'warm', 'cool', 'candy'][(Math.random() * 4) | 0];
  p.colorSpeed = Math.random() * 0.4;
}
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, randomize });
