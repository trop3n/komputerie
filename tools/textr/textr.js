// TEXTR — vector typographic art. Text is converted to glyph outlines (via the
// shared typography module) and duplicated/distributed across the canvas as
// letters, words, or blocks with transform + color controls. Paper.js rendering
// with real SVG export and custom-font drag-drop.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { loadFont, parseFont, textUnits, FONT_OPTIONS } from '../../js/antlii/typography.js';
import { noise2D } from '../../js/antlii/noise.js';

const paper = window.paper;

const params = {
  text: 'ANTLII',
  font: 'Space Mono',
  fontSize: 120,
  unit: 'letters',
  layout: 'ring',
  count: 24,
  spread: 1,
  scale: 0.7,
  scaleVar: 0.2,
  baseRotation: 0,
  rotationStep: 0,
  faceOut: true,
  render: 'fill',
  strokeWeight: 1,
  colorMode: 'transition',
  paletteCount: 3,
  c0: '#ffffff', c1: '#6c5ce7', c2: '#00cec9',
  opacity: 100,
  background: '#0a0a12',
  animate: false,
  animSpeed: 0.5,
};

let font = null;
let dirty = true;
let spin = 0;

function setFont(name) {
  loadFont(name).then((f) => { font = f; dirty = true; }).catch((e) => console.error('font load failed', e));
}

// ---- Color ----
function interpolateHex(a, b, t) {
  const r1 = parseInt(a.slice(1, 3), 16), g1 = parseInt(a.slice(3, 5), 16), b1 = parseInt(a.slice(5, 7), 16);
  const r2 = parseInt(b.slice(1, 3), 16), g2 = parseInt(b.slice(3, 5), 16), b2 = parseInt(b.slice(5, 7), 16);
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}
function colorList() { return [params.c0, params.c1, params.c2].slice(0, Math.max(1, params.paletteCount)); }
function colorAt(i, n) {
  const cs = colorList();
  if (params.colorMode === 'solid' || cs.length === 1) return cs[0];
  const t = n > 1 ? i / (n - 1) : 0;
  if (params.colorMode === 'sequence') return cs[Math.min(Math.floor(t * cs.length), cs.length - 1)];
  const tt = t * (cs.length - 1);
  const k = Math.min(Math.floor(tt), cs.length - 2);
  return interpolateHex(cs[k], cs[Math.min(k + 1, cs.length - 1)], tt - k);
}

function layout(i, n, view) {
  const cx = view.center.x, cy = view.center.y;
  const minDim = Math.min(view.size.width, view.size.height);
  switch (params.layout) {
    case 'row': {
      const span = minDim * 0.85 * params.spread;
      return { x: cx + (n > 1 ? (i / (n - 1) - 0.5) * span : 0), y: cy, angle: 0 };
    }
    case 'ring': {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const R = minDim * 0.35 * params.spread;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, angle: params.faceOut ? a * 180 / Math.PI + 90 : 0 };
    }
    case 'spiral': {
      const a = i * 2.399963229728653;
      const R = Math.sqrt(i / Math.max(1, n)) * minDim * 0.45 * params.spread;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, angle: params.faceOut ? a * 180 / Math.PI : 0 };
    }
    default: {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const gw = minDim * 0.85 * params.spread, gh = gw * (rows / Math.max(1, cols));
      const col = i % cols, row = (i / cols) | 0;
      const x = cx - gw / 2 + (cols > 1 ? col / (cols - 1) : 0.5) * gw;
      const y = cy - gh / 2 + (rows > 1 ? row / (rows - 1) : 0.5) * gh;
      return { x, y, angle: 0 };
    }
  }
}

function build() {
  if (!font) return;
  const view = paper.view;
  const layer = paper.project.activeLayer;
  layer.removeChildren();
  const bg = new paper.Path.Rectangle(view.bounds);
  bg.fillColor = params.background;

  let units;
  try { units = textUnits(font, params.text, params.fontSize, params.unit); } catch (e) { return; }
  if (!units.length) return;

  const bases = units.map((d) => {
    try { return paper.project.importSVG('<path d="' + d + '"/>', { insert: false }); } catch (e) { return null; }
  });

  const n = params.count;
  for (let i = 0; i < n; i++) {
    const base = bases[i % bases.length];
    if (!base) continue;
    const item = base.clone({ insert: false });
    const slot = layout(i, n, view);
    item.position = new paper.Point(slot.x, slot.y);
    const sv = 1 + noise2D(i * 0.37, 3.1) * params.scaleVar;
    item.scale(Math.max(0.05, params.scale * sv));
    item.rotate(params.baseRotation + spin + i * params.rotationStep + slot.angle);
    const col = colorAt(i, n);
    if (params.render === 'stroke') {
      item.fillColor = null; item.strokeColor = col; item.strokeWidth = params.strokeWeight;
    } else {
      item.fillColor = col;
      if (params.render === 'both') { item.strokeColor = col; item.strokeWidth = params.strokeWeight; }
    }
    item.opacity = params.opacity / 100;
    layer.addChild(item);
  }
}

// ---- UI ----
const tool = createTool({ name: 'TEXTR', version: '0.1' });
const canvas = tool.mountCanvas();
paper.setup(canvas);
function fitView() { paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', () => { fitView(); dirty = true; });
fitView();

const main = tool.pages.main;
const fText = main.addFolder({ title: 'Text' });
fText.addBinding(params, 'text');
fText.addBinding(params, 'font', { options: FONT_OPTIONS }).on('change', () => setFont(params.font));
fText.addBinding(params, 'fontSize', { label: 'size', min: 20, max: 400, step: 1 });
fText.addBinding(params, 'unit', { options: { Letters: 'letters', Words: 'words', Block: 'block' } });

const fLayout = main.addFolder({ title: 'Layout' });
fLayout.addBinding(params, 'layout', { options: { Grid: 'grid', Row: 'row', Ring: 'ring', Spiral: 'spiral' } });
fLayout.addBinding(params, 'count', { min: 1, max: 200, step: 1 });
fLayout.addBinding(params, 'spread', { min: 0.2, max: 2, step: 0.05 });
fLayout.addBinding(params, 'scale', { min: 0.1, max: 3, step: 0.05 });
fLayout.addBinding(params, 'scaleVar', { label: 'scale var', min: 0, max: 1, step: 0.05 });
fLayout.addBinding(params, 'baseRotation', { label: 'rotation', min: 0, max: 360, step: 1 });
fLayout.addBinding(params, 'rotationStep', { label: 'rot step', min: -45, max: 45, step: 1 });
fLayout.addBinding(params, 'faceOut', { label: 'face out' });

const fStyle = main.addFolder({ title: 'Style' });
fStyle.addBinding(params, 'render', { options: { Fill: 'fill', Stroke: 'stroke', Both: 'both' } });
fStyle.addBinding(params, 'strokeWeight', { label: 'weight', min: 0.25, max: 8, step: 0.25 });
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

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, getSVG: () => paper.project.exportSVG({ asString: true }), name: 'textr' });

const presets = {
  'Ring Type': { layout: 'ring', unit: 'letters', count: 24, spread: 1, scale: 0.7, faceOut: true, rotationStep: 0, colorMode: 'transition', paletteCount: 3, c0: '#ffffff', c1: '#6c5ce7', c2: '#00cec9', render: 'fill', background: '#0a0a12' },
  'Spiral Drift': { layout: 'spiral', unit: 'letters', count: 90, spread: 1.1, scale: 0.45, scaleVar: 0.4, faceOut: true, colorMode: 'transition', paletteCount: 3, c0: '#fdcb6e', c1: '#e17055', c2: '#6c5ce7', render: 'fill', background: '#08060c' },
  'Grid Stack': { layout: 'grid', unit: 'block', count: 36, spread: 1, scale: 0.5, scaleVar: 0, baseRotation: 0, rotationStep: 0, colorMode: 'sequence', paletteCount: 2, c0: '#ffffff', c1: '#b2bec3', render: 'fill', background: '#101014' },
};
function randomize(p) {
  const layouts = ['grid', 'row', 'ring', 'spiral'];
  const units = ['letters', 'words', 'block'];
  p.layout = layouts[(Math.random() * layouts.length) | 0];
  p.unit = units[(Math.random() * units.length) | 0];
  p.count = 6 + (Math.random() * 120 | 0);
  p.spread = 0.5 + Math.random() * 1.3;
  p.scale = 0.3 + Math.random() * 1.2;
  p.scaleVar = Math.random() * 0.6;
  p.baseRotation = Math.random() * 360 | 0;
  p.rotationStep = -20 + Math.random() * 40;
  p.faceOut = Math.random() < 0.6;
}
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, randomize, onApply: () => { dirty = true; } });

// ---- Custom font drag-drop ----
tool.canvasHost.addEventListener('dragover', (e) => e.preventDefault());
tool.canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || (!/\.(ttf|otf)$/i.test(file.name) && !/font/i.test(file.type))) return;
  const reader = new FileReader();
  reader.onload = () => { try { font = parseFont(reader.result); dirty = true; } catch (err) { console.error('font parse failed', err); } };
  reader.readAsArrayBuffer(file);
});

// ---- Animate ----
tool.pane.on('change', () => { dirty = true; });
paper.view.onFrame = (e) => {
  if (params.animate) { spin += params.animSpeed * Math.min(e.delta, 0.1) * 60; dirty = true; }
  if ((dirty || params.animate) && font) { build(); dirty = false; }
};

setFont(params.font);
