// SAMPL — generative typography by sampling. A glyph's outline is converted to a
// vector path; points are sampled along its contours and used as anchors for
// geometric shapes (size / rotation / color / motion). Paper.js + opentype.js,
// with custom-font drag-drop and real SVG export.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { loadFont, parseFont, FONT_OPTIONS } from '../../js/antlii/typography.js';
import { makeShape, SHAPE_OPTIONS } from '../../js/antlii/shapes.js';
import { pickColor } from '../../js/antlii/palette.js';
import { noise2D } from '../../js/antlii/noise.js';

const paper = window.paper;

const params = {
  text: 'A', font: 'Anton', fontSize: 520,
  density: 60, shape: 'circle', shapeSize: 14, sizeVar: 0.3,
  alignTangent: false, baseRotation: 0, rotationStep: 0,
  render: 'fill', strokeWeight: 1,
  colorMode: 'transition', paletteCount: 3, c0: '#ff7675', c1: '#fdcb6e', c2: '#6c5ce7',
  opacity: 100, background: '#0a0a12',
  animate: false, animSpeed: 0.5, jitter: 0,
};

let font = null, dirty = true, t0 = 0;
function setFont(n) { loadFont(n).then((f) => { font = f; dirty = true; }).catch((e) => console.error('font load failed', e)); }
function colors() { return [params.c0, params.c1, params.c2].slice(0, Math.max(1, params.paletteCount)); }

function collectPaths(item, out) {
  if (item.className === 'Path') out.push(item);
  else if (item.children) for (const c of item.children) collectPaths(c, out);
  return out;
}

function build() {
  if (!font) return;
  const view = paper.view;
  const layer = paper.project.activeLayer;
  layer.removeChildren();
  const bg = new paper.Path.Rectangle(view.bounds);
  bg.fillColor = params.background;

  const d = font.getPath(params.text || 'A', 0, 0, params.fontSize).toPathData(2);
  let src;
  try { src = paper.project.importSVG('<path d="' + d + '"/>', { insert: false }); } catch (e) { return; }
  if (!src) return;
  src.position = view.center;
  const contours = collectPaths(src, []);

  const spacing = Math.max(2, 42 - params.density * 0.4);
  const pts = [];
  for (const path of contours) {
    if (typeof path.getPointAt !== 'function' || !path.length) continue;
    const n = Math.max(1, Math.floor(path.length / spacing));
    for (let k = 0; k < n; k++) {
      const off = (k / n) * path.length;
      const pt = path.getPointAt(off);
      if (!pt) continue;
      let ang = params.baseRotation + k * params.rotationStep;
      if (params.alignTangent) { const tan = path.getTangentAt(off); if (tan) ang += tan.angle; }
      pts.push({ x: pt.x, y: pt.y, ang });
    }
    if (pts.length > 4000) break;
  }

  const total = pts.length;
  const cols = colors();
  for (let i = 0; i < total; i++) {
    const p = pts[i];
    let jx = 0, jy = 0;
    if (params.animate && params.jitter > 0) { jx = noise2D(i * 0.05, t0) * params.jitter; jy = noise2D(i * 0.05 + 99, t0) * params.jitter; }
    const sv = 1 + noise2D(i * 0.11, 7.7) * params.sizeVar;
    const item = makeShape(params.shape, Math.max(1, params.shapeSize * sv));
    item.position = new paper.Point(p.x + jx, p.y + jy);
    if (p.ang) item.rotate(p.ang);
    const col = pickColor(cols, params.colorMode, i, total);
    if (params.render === 'stroke') { item.fillColor = null; item.strokeColor = col; item.strokeWidth = params.strokeWeight; }
    else { item.fillColor = col; if (params.render === 'both') { item.strokeColor = col; item.strokeWidth = params.strokeWeight; } }
    item.opacity = params.opacity / 100;
  }
}

// ---- UI ----
const tool = createTool({ name: 'SAMPL', version: '0.1' });
const canvas = tool.mountCanvas();
paper.setup(canvas);
function fitView() { paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', () => { fitView(); dirty = true; });
fitView();

const main = tool.pages.main;
const fText = main.addFolder({ title: 'Text' });
fText.addBinding(params, 'text');
fText.addBinding(params, 'font', { options: FONT_OPTIONS }).on('change', () => setFont(params.font));
fText.addBinding(params, 'fontSize', { label: 'size', min: 80, max: 900, step: 1 });
fText.addBinding(params, 'density', { min: 1, max: 100, step: 1 });

const fShape = main.addFolder({ title: 'Shape' });
fShape.addBinding(params, 'shape', { options: SHAPE_OPTIONS });
fShape.addBinding(params, 'shapeSize', { label: 'size', min: 2, max: 60, step: 1 });
fShape.addBinding(params, 'sizeVar', { label: 'size var', min: 0, max: 1, step: 0.05 });
fShape.addBinding(params, 'alignTangent', { label: 'align' });
fShape.addBinding(params, 'baseRotation', { label: 'rotation', min: 0, max: 360, step: 1 });
fShape.addBinding(params, 'rotationStep', { label: 'rot step', min: -30, max: 30, step: 1 });

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
fMotion.addBinding(params, 'jitter', { min: 0, max: 30, step: 1 });

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, getSVG: () => paper.project.exportSVG({ asString: true }), name: 'sampl' });

const presets = {
  Letterform: { text: 'A', shape: 'circle', density: 60, shapeSize: 14, sizeVar: 0.3, colorMode: 'transition', paletteCount: 3, c0: '#ff7675', c1: '#fdcb6e', c2: '#6c5ce7', render: 'fill', background: '#0a0a12' },
  Outline: { text: 'S', shape: 'diamond', density: 85, shapeSize: 9, sizeVar: 0.1, alignTangent: true, rotationStep: 0, colorMode: 'transition', paletteCount: 2, c0: '#00cec9', c1: '#ffffff', render: 'fill', background: '#05060a' },
  Confetti: { text: 'O', shape: 'star', density: 45, shapeSize: 20, sizeVar: 0.6, baseRotation: 0, rotationStep: 12, colorMode: 'sequence', paletteCount: 3, c0: '#fd79a8', c1: '#fdcb6e', c2: '#6c5ce7', render: 'fill', background: '#0c0410', animate: true, jitter: 6 },
};
function randomize(p) {
  const shapes = Object.values(SHAPE_OPTIONS);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  p.text = letters[(Math.random() * 26) | 0];
  p.shape = shapes[(Math.random() * shapes.length) | 0];
  p.density = 25 + (Math.random() * 70 | 0);
  p.shapeSize = 6 + (Math.random() * 30 | 0);
  p.sizeVar = Math.random() * 0.7;
  p.alignTangent = Math.random() < 0.4;
  p.rotationStep = -20 + Math.random() * 40;
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

tool.pane.on('change', () => { dirty = true; });
paper.view.onFrame = (e) => {
  if (params.animate) { t0 += params.animSpeed * Math.min(e.delta, 0.1); dirty = true; }
  if ((dirty || params.animate) && font) { build(); dirty = false; }
};
setFont(params.font);
