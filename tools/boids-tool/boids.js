// BOIDS — flocking simulation (separation / alignment / cohesion) on the antlii
// stack. Shapes (triangle / ellipse / rectangle / mixed) oriented to velocity
// with scale randomization and speed/angle skew, colored by velocity or index,
// with motion trails. p5 2D. The flocking model follows the repo's legacy Boids.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { interpolateHex } from '../../js/antlii/palette.js';

const params = {
  count: 160, sepR: 28, sepW: 1.5, alignR: 50, alignW: 1, cohR: 50, cohW: 1,
  maxSpeed: 4, maxForce: 0.15,
  shape: 'mixed', size: 9, scaleRand: 0.3, skewMode: 'speed', skewLevel: 0.5,
  colorMode: 'velocity', c0: '#00cec9', c1: '#6c5ce7', c2: '#fd79a8', uniform: '#9ad0ff',
  trail: 28, background: '#05060d', seed: 1,
};

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function grad(t) { t = Math.max(0, Math.min(1, t)); const cs = [params.c0, params.c1, params.c2]; const pos = t * 2, k = Math.min(Math.floor(pos), 1); return interpolateHex(cs[k], cs[k + 1], pos - k); }

const tool = createTool({ name: 'BOIDS', version: '0.1' });
let boids = [], W = 0, H = 0, pInst = null;

function restart() {
  const rnd = mulberry32(params.seed >>> 0);
  boids = [];
  for (let i = 0; i < params.count; i++) {
    const a = rnd() * Math.PI * 2, sp = 1 + rnd() * params.maxSpeed;
    boids.push({ x: rnd() * (W || 800), y: rnd() * (H || 600), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: (rnd() * 3) | 0, sc: 1 + (rnd() * 2 - 1) * params.scaleRand });
  }
}

function step() {
  const n = boids.length;
  const sr2 = params.sepR * params.sepR, ar2 = params.alignR * params.alignR, cr2 = params.cohR * params.cohR;
  for (let i = 0; i < n; i++) {
    const b = boids[i];
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, sn = 0, an = 0, cn = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const o = boids[j], dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.01) continue;
      if (d2 < sr2) { const inv = 1 / d2; sx += dx * inv; sy += dy * inv; sn++; }
      if (d2 < ar2) { ax += o.vx; ay += o.vy; an++; }
      if (d2 < cr2) { cx += o.x; cy += o.y; cn++; }
    }
    let fx = 0, fy = 0;
    const steer = (vx, vy, w) => { const m = Math.hypot(vx, vy); if (m < 1e-5) return; let dx = vx / m * params.maxSpeed - b.vx, dy = vy / m * params.maxSpeed - b.vy; const fm = Math.hypot(dx, dy); if (fm > params.maxForce) { dx = dx / fm * params.maxForce; dy = dy / fm * params.maxForce; } fx += dx * w; fy += dy * w; };
    if (sn) steer(sx, sy, params.sepW);
    if (an) steer(ax, ay, params.alignW);
    if (cn) steer(cx / cn - b.x, cy / cn - b.y, params.cohW);
    b.vx += fx; b.vy += fy;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > params.maxSpeed) { b.vx = b.vx / sp * params.maxSpeed; b.vy = b.vy / sp * params.maxSpeed; }
    b.x += b.vx; b.y += b.vy;
    if (b.x < 0) b.x += W; else if (b.x >= W) b.x -= W;
    if (b.y < 0) b.y += H; else if (b.y >= H) b.y -= H;
  }
}

function shapeColor(b, i) {
  if (params.colorMode === 'uniform') return params.uniform;
  if (params.colorMode === 'index') return grad(i / Math.max(1, params.count - 1));
  return grad(Math.hypot(b.vx, b.vy) / params.maxSpeed);
}

pInst = tool.startSketch((p) => {
  p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight); p.pixelDensity(1); W = p.width; H = p.height; restart(); const [r, g, b] = hexRgb(params.background); p.background(r, g, b); };
  p.windowResized = () => { p.resizeCanvas(p.windowWidth, p.windowHeight); W = p.width; H = p.height; };
  p.draw = () => {
    const [r, g, b] = hexRgb(params.background);
    p.noStroke(); p.fill(r, g, b, params.trail); p.rect(0, 0, W, H);
    step();
    p.noStroke();
    for (let i = 0; i < boids.length; i++) {
      const bd = boids[i], ang = Math.atan2(bd.vy, bd.vx), sp = Math.hypot(bd.vx, bd.vy);
      const sz = params.size * bd.sc;
      p.push(); p.translate(bd.x, bd.y); p.rotate(ang);
      if (params.skewMode === 'speed') p.shearX((sp / params.maxSpeed) * params.skewLevel);
      else if (params.skewMode === 'angle') p.shearX(Math.sin(ang) * params.skewLevel);
      p.fill(shapeColor(bd, i));
      let kind = params.shape;
      if (kind === 'mixed') kind = ['triangle', 'ellipse', 'rect'][bd.kind];
      if (kind === 'triangle') p.triangle(sz, 0, -sz * 0.7, sz * 0.6, -sz * 0.7, -sz * 0.6);
      else if (kind === 'ellipse') p.ellipse(0, 0, sz * 1.8, sz);
      else p.rect(-sz * 0.8, -sz * 0.5, sz * 1.6, sz);
      p.pop();
    }
  };
});

// ---- UI ----
const main = tool.pages.main;
const fShape = main.addFolder({ title: 'Shape' });
fShape.addBinding(params, 'shape', { options: { Mixed: 'mixed', Triangle: 'triangle', Ellipse: 'ellipse', Rectangle: 'rect' } });
fShape.addBinding(params, 'size', { min: 2, max: 30, step: 1 });
fShape.addBinding(params, 'scaleRand', { label: 'scale rand', min: 0, max: 1, step: 0.05 });
fShape.addBinding(params, 'skewMode', { label: 'skew', options: { None: 'none', Speed: 'speed', Angle: 'angle' } });
fShape.addBinding(params, 'skewLevel', { label: 'skew amt', min: 0, max: 1.5, step: 0.05 });

const fFlock = main.addFolder({ title: 'Flocking' });
fFlock.addBinding(params, 'count', { min: 10, max: 400, step: 10 }).on('change', restart);
fFlock.addBinding(params, 'sepR', { label: 'sep radius', min: 5, max: 100, step: 1 });
fFlock.addBinding(params, 'sepW', { label: 'sep weight', min: 0, max: 5, step: 0.1 });
fFlock.addBinding(params, 'alignR', { label: 'align radius', min: 5, max: 150, step: 1 });
fFlock.addBinding(params, 'alignW', { label: 'align weight', min: 0, max: 5, step: 0.1 });
fFlock.addBinding(params, 'cohR', { label: 'coh radius', min: 5, max: 150, step: 1 });
fFlock.addBinding(params, 'cohW', { label: 'coh weight', min: 0, max: 5, step: 0.1 });
fFlock.addBinding(params, 'maxSpeed', { label: 'max speed', min: 0.5, max: 12, step: 0.5 });
fFlock.addBinding(params, 'maxForce', { label: 'max force', min: 0.01, max: 0.8, step: 0.01 });

const fColor = main.addFolder({ title: 'Color' });
fColor.addBinding(params, 'colorMode', { label: 'mode', options: { Velocity: 'velocity', Index: 'index', Uniform: 'uniform' } });
fColor.addBinding(params, 'c0', { label: 'color 1', view: 'color' });
fColor.addBinding(params, 'c1', { label: 'color 2', view: 'color' });
fColor.addBinding(params, 'c2', { label: 'color 3', view: 'color' });
fColor.addBinding(params, 'uniform', { view: 'color' });
fColor.addBinding(params, 'trail', { min: 1, max: 255, step: 1 });
fColor.addBinding(params, 'background', { view: 'color' });

const fSim = main.addFolder({ title: 'Simulation' });
fSim.addBinding(params, 'seed', { min: 0, max: 999, step: 1 }).on('change', restart);
fSim.addButton({ title: 'Restart' }).on('click', restart);

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'boids' });

const presets = {
  Murmuration: { count: 300, sepR: 22, sepW: 1.6, alignR: 60, alignW: 1.4, cohR: 70, cohW: 1.1, maxSpeed: 5, shape: 'triangle', size: 6, colorMode: 'velocity', trail: 18, background: '#04060d' },
  Schooling: { count: 180, sepR: 30, sepW: 1.2, alignR: 45, alignW: 1.6, cohR: 55, cohW: 1.3, maxSpeed: 4, shape: 'ellipse', size: 10, skewMode: 'speed', skewLevel: 0.7, colorMode: 'index', trail: 36, background: '#020608' },
  Confetti: { count: 220, sepR: 26, sepW: 1.8, alignR: 40, alignW: 0.8, cohR: 40, cohW: 0.9, maxSpeed: 6, shape: 'mixed', size: 8, scaleRand: 0.6, colorMode: 'velocity', trail: 60, background: '#0a0410' },
  Starlings: { count: 360, sepR: 20, sepW: 1.8, alignR: 65, alignW: 1.6, cohR: 75, cohW: 1.2, maxSpeed: 6, maxForce: 0.2, shape: 'triangle', size: 5, colorMode: 'velocity', trail: 14, background: '#03050c' },
  Jellies: { count: 120, sepR: 34, sepW: 1.0, alignR: 40, alignW: 1.2, cohR: 50, cohW: 1.0, maxSpeed: 2.5, shape: 'ellipse', size: 14, skewMode: 'speed', skewLevel: 0.8, colorMode: 'uniform', uniform: '#7ad7f0', trail: 40, background: '#02060a' },
  Shoal: { count: 200, sepR: 28, sepW: 1.4, alignR: 50, alignW: 1.5, cohR: 55, cohW: 1.2, maxSpeed: 4, shape: 'rect', size: 9, skewMode: 'angle', skewLevel: 0.6, colorMode: 'index', c0: '#00cec9', c1: '#0984e3', c2: '#6c5ce7', trail: 30, background: '#020409' },
  Sparks: { count: 150, sepR: 24, sepW: 1.6, alignR: 35, alignW: 0.9, cohR: 35, cohW: 0.8, maxSpeed: 8, maxForce: 0.3, shape: 'mixed', size: 6, scaleRand: 0.4, colorMode: 'velocity', c0: '#ffeaa7', c1: '#fab1a0', c2: '#e17055', trail: 22, background: '#0a0602' },
  'Loner Pods': { count: 90, sepR: 40, sepW: 2.2, alignR: 30, alignW: 0.6, cohR: 30, cohW: 0.5, maxSpeed: 3.5, shape: 'triangle', size: 10, colorMode: 'index', c0: '#a29bfe', c1: '#fd79a8', c2: '#ffeaa7', trail: 50, background: '#05030c' },
  'Vortex Flock': { count: 260, sepR: 22, sepW: 1.2, alignR: 70, alignW: 2.0, cohR: 80, cohW: 1.4, maxSpeed: 5, shape: 'ellipse', size: 8, skewMode: 'speed', skewLevel: 1.0, colorMode: 'velocity', c0: '#55efc4', c1: '#74b9ff', c2: '#a29bfe', trail: 26, background: '#02060a' },
};
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, onApply: restart });
