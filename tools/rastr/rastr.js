// RASTR — text rasterized into a geometric grid. The text is drawn into a small
// offscreen buffer at grid resolution; every covered cell renders a vector shape
// (optionally sized by coverage). Paper.js + opentype.js, custom-font drag-drop,
// real SVG export.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { loadFont, parseFont, FONT_OPTIONS } from '../../js/antlii/typography.js';
import { makeShape, SHAPE_OPTIONS } from '../../js/antlii/shapes.js';
import { pickColor } from '../../js/antlii/palette.js';

const paper = window.paper;

const params = {
  text: 'RASTR', font: 'Archivo Black', gridX: 48, gridY: 48,
  shape: 'circle', shapeScale: 0.9, coverageSize: true, threshold: 0.4,
  baseRotation: 0, render: 'fill', strokeWeight: 1,
  colorMode: 'transition', paletteCount: 3, c0: '#00cec9', c1: '#6c5ce7', c2: '#ffffff',
  opacity: 100, background: '#0a0a12',
  animate: false, animSpeed: 0.5,
};

let font = null, dirty = true, spin = 0;
const off = document.createElement('canvas');
const offctx = off.getContext('2d', { willReadFrequently: true });
function colors() { return [params.c0, params.c1, params.c2].slice(0, Math.max(1, params.paletteCount)); }

function rasterize() {
  if (!font) return null;
  const gx = params.gridX, gy = params.gridY;
  off.width = gx; off.height = gy;
  offctx.clearRect(0, 0, gx, gy);
  const ot = font.getPath(params.text || 'RASTR', 0, 0, 100);
  const bb = ot.getBoundingBox();
  const tw = bb.x2 - bb.x1, th = bb.y2 - bb.y1;
  if (tw <= 0 || th <= 0) return null;
  const margin = 0.85;
  const scale = Math.min((gx * margin) / tw, (gy * margin) / th);
  offctx.setTransform(scale, 0, 0, scale, gx / 2 - (bb.x1 + tw / 2) * scale, gy / 2 - (bb.y1 + th / 2) * scale);
  offctx.fillStyle = '#fff';
  offctx.fill(new Path2D(ot.toPathData(2)));
  offctx.setTransform(1, 0, 0, 1, 0, 0);
  return { data: offctx.getImageData(0, 0, gx, gy).data, gx, gy };
}

function build() {
  if (!font) return;
  const ras = rasterize();
  if (!ras) return;
  const view = paper.view;
  const layer = paper.project.activeLayer;
  layer.removeChildren();
  const bg = new paper.Path.Rectangle(view.bounds);
  bg.fillColor = params.background;

  const { data, gx, gy } = ras;
  const W = view.size.width, H = view.size.height;
  const cell = Math.min(W / gx, H / gy);
  const ox = (W - cell * gx) / 2, oy = (H - cell * gy) / 2;

  const covered = [];
  for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) {
    const a = data[(y * gx + x) * 4 + 3] / 255;
    if (a > params.threshold) covered.push({ x, y, a });
  }
  const total = covered.length;
  const cols = colors();
  for (let i = 0; i < total; i++) {
    const { x, y, a } = covered[i];
    const sz = cell * params.shapeScale * (params.coverageSize ? 0.4 + a * 0.6 : 1);
    if (sz < 0.5) continue;
    const item = makeShape(params.shape, sz);
    item.position = new paper.Point(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell);
    if (params.baseRotation || spin) item.rotate(params.baseRotation + spin);
    const col = pickColor(cols, params.colorMode, i, total);
    if (params.render === 'stroke') { item.fillColor = null; item.strokeColor = col; item.strokeWidth = params.strokeWeight; }
    else { item.fillColor = col; if (params.render === 'both') { item.strokeColor = col; item.strokeWidth = params.strokeWeight; } }
    item.opacity = params.opacity / 100;
  }
}

// ---- UI ----
const tool = createTool({ name: 'RASTR', version: '0.1' });
const canvas = tool.mountCanvas();
paper.setup(canvas);
function fitView() { paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', () => { fitView(); dirty = true; });
fitView();

const main = tool.pages.main;
const fText = main.addFolder({ title: 'Text' });
fText.addBinding(params, 'text');
fText.addBinding(params, 'font', { options: FONT_OPTIONS }).on('change', () => setFont(params.font));

const fRaster = main.addFolder({ title: 'Raster' });
fRaster.addBinding(params, 'gridX', { label: 'cols', min: 8, max: 120, step: 1 });
fRaster.addBinding(params, 'gridY', { label: 'rows', min: 8, max: 120, step: 1 });
fRaster.addBinding(params, 'threshold', { min: 0.05, max: 0.95, step: 0.05 });

const fShape = main.addFolder({ title: 'Shape' });
fShape.addBinding(params, 'shape', { options: SHAPE_OPTIONS });
fShape.addBinding(params, 'shapeScale', { label: 'scale', min: 0.2, max: 1.5, step: 0.05 });
fShape.addBinding(params, 'coverageSize', { label: 'size by fill' });
fShape.addBinding(params, 'baseRotation', { label: 'rotation', min: 0, max: 360, step: 1 });

const fStyle = main.addFolder({ title: 'Style' });
fStyle.addBinding(params, 'render', { options: { Fill: 'fill', Stroke: 'stroke', Both: 'both' } });
fStyle.addBinding(params, 'strokeWeight', { label: 'weight', min: 0.25, max: 6, step: 0.25 });
fStyle.addBinding(params, 'colorMode', { label: 'color', options: { Solid: 'solid', Sequence: 'sequence', Transition: 'transition' } });
fStyle.addBinding(params, 'paletteCount', { label: 'colors', min: 1, max: 3, step: 1 });
fStyle.addBinding(params, 'c0', { label: 'color 1', view: 'color' });
fStyle.addBinding(params, 'c1', { label: 'color 2', view: 'color' });
fStyle.addBinding(params, 'c2', { label: 'color 3', view: 'color' });
fStyle.addBinding(params, 'opacity', { min: 10, max: 100, step: 5 });
fStyle.addBinding(params, 'background', { view: 'color' });

const fMotion = main.addFolder({ title: 'Motion', expanded: false });
fMotion.addBinding(params, 'animate');
fMotion.addBinding(params, 'animSpeed', { label: 'speed', min: 0, max: 3, step: 0.05 });

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, getSVG: () => paper.project.exportSVG({ asString: true }), name: 'rastr' });

const presets = {
  Dots: { text: 'RASTR', shape: 'circle', gridX: 56, gridY: 28, shapeScale: 0.9, coverageSize: true, threshold: 0.4, colorMode: 'transition', paletteCount: 3, c0: '#00cec9', c1: '#6c5ce7', c2: '#ffffff', background: '#0a0a12' },
  Blocks: { text: 'TYPE', shape: 'square', gridX: 40, gridY: 40, shapeScale: 1.0, coverageSize: false, threshold: 0.5, colorMode: 'sequence', paletteCount: 2, c0: '#fdcb6e', c1: '#e17055', background: '#101014' },
  Halftone: { text: 'HALF', shape: 'circle', gridX: 90, gridY: 45, shapeScale: 1.1, coverageSize: true, threshold: 0.25, colorMode: 'solid', paletteCount: 1, c0: '#ffffff', background: '#000000' },
};
function randomize(p) {
  const shapes = Object.values(SHAPE_OPTIONS);
  p.shape = shapes[(Math.random() * shapes.length) | 0];
  p.gridX = 16 + (Math.random() * 90 | 0);
  p.gridY = 16 + (Math.random() * 70 | 0);
  p.shapeScale = 0.5 + Math.random();
  p.coverageSize = Math.random() < 0.6;
  p.threshold = 0.2 + Math.random() * 0.5;
  p.baseRotation = Math.random() < 0.5 ? 0 : (Math.random() * 360 | 0);
}
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, randomize, onApply: () => { dirty = true; } });

tool.canvasHost.addEventListener('dragover', (e) => e.preventDefault());
tool.canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || (!/\.(ttf|otf)$/i.test(file.name) && !/font/i.test(file.type))) return;
  const reader = new FileReader();
  reader.onload = () => { try { font = parseFont(reader.result); dirty = true; } catch (err) { console.error('font parse failed', err); } };
  reader.readAsArrayBuffer(file);
});

function setFont(n) { loadFont(n).then((f) => { font = f; dirty = true; }).catch((e) => console.error('font load failed', e)); }

tool.pane.on('change', () => { dirty = true; });
paper.view.onFrame = (e) => {
  if (params.animate) { spin += params.animSpeed * Math.min(e.delta, 0.1) * 60; dirty = true; }
  if ((dirty || params.animate) && font) { build(); dirty = false; }
};
setFont(params.font);
