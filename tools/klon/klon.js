// KLON — collage / mashup from images via a grid "slice brush". In Pick mode,
// drag to select a slice of the source; in Paint mode, drag to stamp that slice
// onto the canvas, snapping to a grid. Build block-based compositions from image
// fragments. p5 2D. Drop an image to load. M: mode · G: snap · H: grid · R:
// rotate · C: clear · D: download. Shares the SKAAAN image-manipulation pattern.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';

const params = {
  mode: 'paint', cell: 48, snap: true, brushScale: 1, rotate: 0,
  showGrid: true, showSource: true, background: '#0a0a12',
};

const tool = createTool({ name: 'KLON', version: '0.1' });
let buf = null, srcImg = null, slice = null, fit = null, sel = null, pInst = null;

function makeDefault(p) {
  const g = p.createGraphics(800, 600); g.pixelDensity(1);
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(0, 0, 800, 600);
  grad.addColorStop(0, '#16213e'); grad.addColorStop(0.4, '#0f3460'); grad.addColorStop(0.7, '#533483'); grad.addColorStop(1, '#e94560');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 800, 600);
  for (let i = 0; i < 14; i++) { ctx.fillStyle = `hsla(${Math.random() * 360},75%,62%,0.7)`; ctx.beginPath(); ctx.arc(Math.random() * 800, Math.random() * 600, 30 + Math.random() * 90, 0, Math.PI * 2); ctx.fill(); }
  return g;
}
function computeFit(p) { const s = Math.min(p.width / srcImg.width, p.height / srcImg.height); fit = { ox: (p.width - srcImg.width * s) / 2, oy: (p.height - srcImg.height * s) / 2, s }; }
function captureSlice(rect) {
  const sx = Math.max(0, (Math.min(rect.x0, rect.x1) - fit.ox) / fit.s);
  const sy = Math.max(0, (Math.min(rect.y0, rect.y1) - fit.oy) / fit.s);
  const sw = Math.min(srcImg.width - sx, Math.abs(rect.x1 - rect.x0) / fit.s);
  const sh = Math.min(srcImg.height - sy, Math.abs(rect.y1 - rect.y0) / fit.s);
  if (sw < 4 || sh < 4) return;
  slice = pInst.createGraphics(Math.round(sw), Math.round(sh)); slice.pixelDensity(1);
  slice.copy(srcImg, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, Math.round(sw), Math.round(sh));
}
function defaultSlice() {
  const w = srcImg.width, h = srcImg.height, sw = Math.round(w * 0.25), sh = Math.round(h * 0.25);
  slice = pInst.createGraphics(sw, sh); slice.pixelDensity(1);
  slice.copy(srcImg, Math.round(w * 0.375), Math.round(h * 0.375), sw, sh, 0, 0, sw, sh);
}
function stampAt(x, y) {
  if (!slice) return;
  let cx = x, cy = y;
  if (params.snap) { cx = Math.floor(x / params.cell) * params.cell + params.cell / 2; cy = Math.floor(y / params.cell) * params.cell + params.cell / 2; }
  const sz = params.cell * params.brushScale;
  buf.push(); buf.imageMode(pInst.CENTER); buf.translate(cx, cy); buf.rotate(params.rotate * Math.PI / 180); buf.image(slice, 0, 0, sz, sz); buf.pop();
}
function clearBuf() { if (buf) buf.clear(); }

pInst = tool.startSketch((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight); p.pixelDensity(1);
    buf = p.createGraphics(p.width, p.height); buf.pixelDensity(1);
    srcImg = makeDefault(p); computeFit(p); defaultSlice();
  };
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    const old = buf; buf = p.createGraphics(p.width, p.height); buf.pixelDensity(1);
    if (old) buf.image(old, 0, 0); computeFit(p);
  };
  p.draw = () => {
    const [br, bg, bb] = [parseInt(params.background.slice(1, 3), 16), parseInt(params.background.slice(3, 5), 16), parseInt(params.background.slice(5, 7), 16)];
    p.background(br, bg, bb);
    if (params.showSource) { p.push(); p.tint(255, params.mode === 'pick' ? 150 : 55); p.image(srcImg, fit.ox, fit.oy, srcImg.width * fit.s, srcImg.height * fit.s); p.noTint(); p.pop(); }
    p.image(buf, 0, 0);
    if (params.showGrid) {
      p.push(); p.stroke(255, 28); p.strokeWeight(1);
      for (let x = 0; x <= p.width; x += params.cell) p.line(x, 0, x, p.height);
      for (let y = 0; y <= p.height; y += params.cell) p.line(0, y, p.width, y);
      p.pop();
    }
    if (sel) { p.push(); p.noFill(); p.stroke('#fff'); p.strokeWeight(1.5); p.rect(Math.min(sel.x0, sel.x1), Math.min(sel.y0, sel.y1), Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)); p.pop(); }
  };
});

let down = false;
const host = tool.canvasHost;
const at = (e) => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
host.addEventListener('pointerdown', (e) => {
  down = true; const [x, y] = at(e);
  if (params.mode === 'pick') sel = { x0: x, y0: y, x1: x, y1: y };
  else stampAt(x, y);
});
host.addEventListener('pointermove', (e) => {
  if (!down) return; const [x, y] = at(e);
  if (params.mode === 'pick') { if (sel) { sel.x1 = x; sel.y1 = y; } }
  else stampAt(x, y);
});
window.addEventListener('pointerup', () => { if (down && params.mode === 'pick' && sel) { captureSlice(sel); sel = null; } down = false; });

host.addEventListener('dragover', (e) => e.preventDefault());
host.addEventListener('drop', (e) => {
  e.preventDefault(); const file = e.dataTransfer?.files?.[0];
  if (!file || !/^image\//i.test(file.type)) return;
  const url = URL.createObjectURL(file);
  pInst.loadImage(url, (img) => { srcImg = img; computeFit(pInst); defaultSlice(); URL.revokeObjectURL(url); }, () => URL.revokeObjectURL(url));
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'm' || e.key === 'M') { params.mode = params.mode === 'paint' ? 'pick' : 'paint'; tool.pane.refresh(); }
  else if (e.key === 'g' || e.key === 'G') { params.snap = !params.snap; tool.pane.refresh(); }
  else if (e.key === 'h' || e.key === 'H') { params.showGrid = !params.showGrid; tool.pane.refresh(); }
  else if (e.key === 'r' || e.key === 'R') { params.rotate = (params.rotate + 90) % 360; tool.pane.refresh(); }
  else if (e.key === 'c' || e.key === 'C') clearBuf();
});

// ---- UI ----
const main = tool.pages.main;
const fBrush = main.addFolder({ title: 'Brush' });
fBrush.addBinding(params, 'mode', { options: { Pick: 'pick', Paint: 'paint' } });
fBrush.addBinding(params, 'cell', { min: 8, max: 160, step: 2 });
fBrush.addBinding(params, 'brushScale', { label: 'brush', min: 0.5, max: 4, step: 0.5 });
fBrush.addBinding(params, 'rotate', { min: 0, max: 270, step: 90 });
fBrush.addBinding(params, 'snap', { label: 'snap grid' });

const fView = main.addFolder({ title: 'View' });
fView.addBinding(params, 'showGrid', { label: 'grid' });
fView.addBinding(params, 'showSource', { label: 'source' });
fView.addBinding(params, 'background', { view: 'color' });

const fHelp = main.addFolder({ title: 'Keys', expanded: false });
fHelp.addButton({ title: 'M mode · G snap · H grid · R rotate · C clear' }).on('click', () => {});

tool.pages.options.addButton({ title: 'Clear (C)' }).on('click', clearBuf);
attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'klon' });

const presets = {
  Blocks: { mode: 'paint', cell: 48, snap: true, brushScale: 1, showGrid: true, showSource: true, background: '#0a0a12' },
  Mosaic: { mode: 'paint', cell: 28, snap: true, brushScale: 1, showGrid: false, showSource: false, background: '#000000' },
};
attachPresets(tool.pages.options, { pane: tool.pane, params, presets });
