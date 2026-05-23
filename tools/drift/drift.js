// DRIFT — realtime evolving visuals from a bitmap. Drag to select an area of the
// source image; that area is captured as a "Form" which is then repeatedly
// stamped across the canvas, drifting, rotating and scaling over time with trail
// accumulation. p5 2D. Drop an image to load your own. Part of the image-
// manipulation family (shares the SKAAAN interaction pattern).
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { noise2D } from '../../js/antlii/noise.js';

const params = {
  count: 12, spread: 0.32, scale: 1, scaleVar: 0.3, rotation: 0,
  driftSpeed: 0.4, rotSpeed: 0.3, trail: 0.85, blend: 'add', background: '#06070d',
};

function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

const tool = createTool({ name: 'DRIFT', version: '0.1' });
let buf = null, srcImg = null, form = null, t = 0, sel = null, fit = null, pInst = null;

function makeDefault(p) {
  const g = p.createGraphics(800, 600); g.pixelDensity(1);
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(0, 0, 800, 600);
  grad.addColorStop(0, '#e94560'); grad.addColorStop(0.4, '#533483'); grad.addColorStop(0.7, '#0f3460'); grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 800, 600);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = `hsla(${Math.random() * 360},75%,62%,0.7)`; ctx.beginPath(); ctx.arc(Math.random() * 800, Math.random() * 600, 30 + Math.random() * 90, 0, Math.PI * 2); ctx.fill(); }
  return g;
}
function computeFit(p) { const s = Math.min(p.width / srcImg.width, p.height / srcImg.height); fit = { ox: (p.width - srcImg.width * s) / 2, oy: (p.height - srcImg.height * s) / 2, s }; }
function captureForm(rect) {
  const sx = Math.max(0, (Math.min(rect.x0, rect.x1) - fit.ox) / fit.s);
  const sy = Math.max(0, (Math.min(rect.y0, rect.y1) - fit.oy) / fit.s);
  const sw = Math.min(srcImg.width - sx, Math.abs(rect.x1 - rect.x0) / fit.s);
  const sh = Math.min(srcImg.height - sy, Math.abs(rect.y1 - rect.y0) / fit.s);
  if (sw < 4 || sh < 4) return;
  form = pInst.createGraphics(Math.round(sw), Math.round(sh)); form.pixelDensity(1);
  form.copy(srcImg, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, Math.round(sw), Math.round(sh));
}
function defaultForm() {
  const w = srcImg.width, h = srcImg.height, fw = Math.round(w * 0.3), fh = Math.round(h * 0.3);
  form = pInst.createGraphics(fw, fh); form.pixelDensity(1);
  form.copy(srcImg, Math.round(w * 0.35), Math.round(h * 0.35), fw, fh, 0, 0, fw, fh);
}
function clearBuf() { if (buf) { const [r, g, b] = hexRgb(params.background); buf.background(r, g, b); } }

pInst = tool.startSketch((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight); p.pixelDensity(1);
    buf = p.createGraphics(p.width, p.height); buf.pixelDensity(1);
    srcImg = makeDefault(p); computeFit(p); defaultForm(); clearBuf();
  };
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    buf = p.createGraphics(p.width, p.height); buf.pixelDensity(1); computeFit(p); clearBuf();
  };
  p.draw = () => {
    t += p.deltaTime / 1000;
    const [br, bg, bb] = hexRgb(params.background);
    buf.noStroke(); buf.fill(br, bg, bb, Math.max(4, (1 - params.trail) * 255)); buf.rect(0, 0, buf.width, buf.height);
    if (form) {
      buf.push(); buf.imageMode(p.CENTER); buf.blendMode(params.blend === 'add' ? p.ADD : p.BLEND);
      const cx = buf.width / 2, cy = buf.height / 2, R = Math.min(buf.width, buf.height) * params.spread;
      for (let i = 0; i < params.count; i++) {
        const ang = i / params.count * Math.PI * 2 + t * params.driftSpeed;
        const rad = R * (0.25 + 0.75 * (noise2D(i * 0.5, t * 0.3) * 0.5 + 0.5));
        const sc = params.scale * (1 + noise2D(i * 0.7, t * 0.4) * params.scaleVar);
        buf.push();
        buf.translate(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
        buf.rotate((params.rotation + t * params.rotSpeed * 60 + i * 30) * Math.PI / 180);
        buf.scale(Math.max(0.05, sc)); buf.image(form, 0, 0); buf.pop();
      }
      buf.blendMode(p.BLEND); buf.pop();
    }
    p.image(buf, 0, 0);
    if (sel) {
      p.push(); p.tint(255, 120); p.image(srcImg, fit.ox, fit.oy, srcImg.width * fit.s, srcImg.height * fit.s); p.noTint();
      p.noFill(); p.stroke('#fff'); p.strokeWeight(1.5);
      p.rect(Math.min(sel.x0, sel.x1), Math.min(sel.y0, sel.y1), Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)); p.pop();
    }
  };
});

// pointer selection
let down = false;
const host = tool.canvasHost;
const at = (e) => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
host.addEventListener('pointerdown', (e) => { down = true; const [x, y] = at(e); sel = { x0: x, y0: y, x1: x, y1: y }; });
host.addEventListener('pointermove', (e) => { if (!down || !sel) return; const [x, y] = at(e); sel.x1 = x; sel.y1 = y; });
window.addEventListener('pointerup', () => { if (down && sel) { captureForm(sel); sel = null; } down = false; });

// drag-drop image
host.addEventListener('dragover', (e) => e.preventDefault());
host.addEventListener('drop', (e) => {
  e.preventDefault(); const file = e.dataTransfer?.files?.[0];
  if (!file || !/^image\//i.test(file.type)) return;
  const url = URL.createObjectURL(file);
  pInst.loadImage(url, (img) => { srcImg = img; computeFit(pInst); defaultForm(); clearBuf(); URL.revokeObjectURL(url); }, () => URL.revokeObjectURL(url));
});

// ---- UI ----
const main = tool.pages.main;
const fForm = main.addFolder({ title: 'Form' });
fForm.addBinding(params, 'count', { min: 1, max: 60, step: 1 });
fForm.addBinding(params, 'spread', { min: 0.05, max: 0.6, step: 0.01 });
fForm.addBinding(params, 'scale', { min: 0.1, max: 3, step: 0.05 });
fForm.addBinding(params, 'scaleVar', { label: 'scale var', min: 0, max: 1, step: 0.05 });
fForm.addBinding(params, 'rotation', { min: 0, max: 360, step: 1 });

const fAnim = main.addFolder({ title: 'Animation' });
fAnim.addBinding(params, 'driftSpeed', { label: 'drift', min: 0, max: 2, step: 0.05 });
fAnim.addBinding(params, 'rotSpeed', { label: 'spin', min: 0, max: 2, step: 0.05 });
fAnim.addBinding(params, 'trail', { min: 0, max: 0.99, step: 0.01 });
fAnim.addBinding(params, 'blend', { options: { Add: 'add', Normal: 'normal' } });
fAnim.addBinding(params, 'background', { view: 'color' });

tool.pages.options.addButton({ title: 'Clear' }).on('click', clearBuf);
attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'drift' });

const presets = {
  Bloom: { count: 16, spread: 0.34, scale: 1, scaleVar: 0.4, driftSpeed: 0.5, rotSpeed: 0.4, trail: 0.9, blend: 'add', background: '#04060a' },
  Echoes: { count: 8, spread: 0.2, scale: 1.2, scaleVar: 0.2, driftSpeed: 0.25, rotSpeed: 0.15, trail: 0.95, blend: 'normal', background: '#0a0a12' },
  Swarm: { count: 30, spread: 0.4, scale: 0.7, scaleVar: 0.4, driftSpeed: 0.7, rotSpeed: 0.5, trail: 0.92, blend: 'add', background: '#03040a' },
  Comet: { count: 6, spread: 0.25, scale: 1.3, scaleVar: 0.2, driftSpeed: 0.4, rotSpeed: 0.2, trail: 0.96, blend: 'add', background: '#02030a' },
  Mandala: { count: 18, spread: 0.3, scale: 0.9, scaleVar: 0.1, rotation: 0, driftSpeed: 0.3, rotSpeed: 0.8, trail: 0.9, blend: 'add', background: '#06040c' },
  Stamp: { count: 10, spread: 0.35, scale: 1.0, scaleVar: 0.3, driftSpeed: 0.5, rotSpeed: 0.3, trail: 0.85, blend: 'normal', background: '#0a0a12' },
  Vapor: { count: 40, spread: 0.45, scale: 0.5, scaleVar: 0.5, driftSpeed: 0.9, rotSpeed: 0.6, trail: 0.95, blend: 'add', background: '#04060a' },
};
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, onApply: clearBuf });
