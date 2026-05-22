// SPLITX — vector shapes duplicated and transformed by noise + trigonometry,
// then mirrored across a split canvas (none / horizontal / vertical / quad) for
// kaleidoscopic compositions. Built on Paper.js with real SVG export and custom
// SVG drag-drop. First vector-pipeline tool on the antlii stack.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { seedNoise, noise3D } from '../../js/antlii/noise.js';

const params = {
  shape: 'triangle',
  count: 70,
  shapeSize: 24,
  spread: 0.95,
  seed: 1,
  baseRotation: 0,
  rotationStep: 13,
  swirl: 0.5,
  noiseAmount: 0.5,
  noiseScale: 0.15,
  scaleGrowth: 0.9,
  scaleWobble: 0.25,
  speed: 0.45,
  split: 'quad',
  render: 'stroke',
  strokeWeight: 1.25,
  hueStart: 205,
  hueRange: 130,
  saturation: 70,
  lightness: 62,
  opacity: 90,
  background: '#06070d',
};

let customItem = null;

const tool = createTool({ name: 'SPLITX', version: '0.1' });
const canvas = tool.mountCanvas();
const paper = window.paper;
paper.setup(canvas);

function fitView() {
  paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', fitView);
fitView();

const DEG = Math.PI / 180, R2D = 180 / Math.PI, GOLDEN = 2.399963229728653;

function makeBaseShape(center, size) {
  switch (params.shape) {
    case 'square': return new paper.Path.RegularPolygon(center, 4, size);
    case 'pentagon': return new paper.Path.RegularPolygon(center, 5, size);
    case 'hexagon': return new paper.Path.RegularPolygon(center, 6, size);
    case 'star': return new paper.Path.Star(center, 5, size, size * 0.45);
    case 'custom':
      if (customItem) {
        const it = customItem.clone();
        it.fitBounds(new paper.Rectangle(center.x - size, center.y - size, size * 2, size * 2));
        return it;
      }
      return new paper.Path.RegularPolygon(center, 3, size);
    default: return new paper.Path.RegularPolygon(center, 3, size);
  }
}

function styleShape(shape, i) {
  const f = params.count > 1 ? i / (params.count - 1) : 0;
  const hue = (((params.hueStart + f * params.hueRange) % 360) + 360) % 360;
  const col = new paper.Color({ hue, saturation: params.saturation / 100, lightness: params.lightness / 100 });
  shape.opacity = params.opacity / 100;
  if (params.render === 'fill') {
    shape.fillColor = col;
  } else if (params.render === 'both') {
    shape.fillColor = col;
    shape.strokeColor = col;
    shape.strokeWidth = params.strokeWeight;
  } else {
    shape.strokeColor = col;
    shape.strokeWidth = params.strokeWeight;
  }
}

function build(time) {
  seedNoise(params.seed);
  const view = paper.view;
  const layer = paper.project.activeLayer;
  layer.removeChildren();

  const bg = new paper.Path.Rectangle(view.bounds);
  bg.fillColor = params.background;

  const cx = view.center.x, cy = view.center.y;
  const R = Math.min(view.size.width, view.size.height) * 0.5 * params.spread;
  const base = new paper.Group();

  for (let i = 0; i < params.count; i++) {
    const f = i / Math.max(1, params.count - 1);
    const nz = noise3D(i * params.noiseScale, 0, time * params.speed);
    const ang = i * GOLDEN + params.baseRotation * DEG + Math.sin(time * params.speed + i * 0.15) * params.swirl;
    const rad = Math.sqrt(f) * R * (1 + nz * params.noiseAmount * 0.5);
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    const sc = Math.max(2, params.shapeSize * (0.3 + f * params.scaleGrowth) *
      (1 + Math.sin(time * params.speed * 1.3 + i * 0.5) * params.scaleWobble * 0.5));
    const shape = makeBaseShape(new paper.Point(px, py), sc);
    shape.rotate(ang * R2D + i * params.rotationStep);
    styleShape(shape, i);
    base.addChild(shape);
  }

  const c = view.center;
  if (params.split === 'horizontal') {
    base.clone().scale(-1, 1, c);
  } else if (params.split === 'vertical') {
    base.clone().scale(1, -1, c);
  } else if (params.split === 'quad') {
    base.clone().scale(-1, 1, c);
    base.clone().scale(1, -1, c);
    base.clone().scale(-1, -1, c);
  }
}

// ---- Presets (original content) ----
const presets = {
  Mandala: { shape: 'triangle', count: 84, shapeSize: 22, spread: 0.95, rotationStep: 13, swirl: 0.4, noiseAmount: 0.3, noiseScale: 0.12, scaleGrowth: 0.9, scaleWobble: 0.2, split: 'quad', speed: 0.4, render: 'stroke', strokeWeight: 1, hueStart: 200, hueRange: 140, saturation: 70, lightness: 62, opacity: 90, background: '#06070d' },
  Bloom: { shape: 'star', count: 60, shapeSize: 30, spread: 0.82, rotationStep: 8, swirl: 0.8, noiseAmount: 0.6, noiseScale: 0.2, scaleGrowth: 1.1, scaleWobble: 0.35, split: 'quad', speed: 0.6, render: 'both', strokeWeight: 0.5, hueStart: 320, hueRange: 80, saturation: 75, lightness: 60, opacity: 80, background: '#0c0410' },
  Shards: { shape: 'square', count: 48, shapeSize: 26, spread: 1.05, rotationStep: 24, swirl: 0.2, noiseAmount: 0.9, noiseScale: 0.25, scaleGrowth: 0.7, scaleWobble: 0.15, split: 'horizontal', speed: 0.5, render: 'stroke', strokeWeight: 1.5, hueStart: 160, hueRange: 60, saturation: 65, lightness: 58, opacity: 95, background: '#040a0a' },
};

function randomize(p) {
  const shapes = ['triangle', 'square', 'pentagon', 'hexagon', 'star'];
  const splits = ['none', 'horizontal', 'vertical', 'quad'];
  p.shape = shapes[(Math.random() * shapes.length) | 0];
  p.split = splits[(Math.random() * splits.length) | 0];
  p.count = 24 + (Math.random() * 76 | 0);
  p.shapeSize = 12 + (Math.random() * 40 | 0);
  p.spread = 0.6 + Math.random() * 0.5;
  p.seed = (Math.random() * 1000) | 0;
  p.rotationStep = -30 + Math.random() * 60;
  p.swirl = Math.random() * 1.5;
  p.noiseAmount = Math.random() * 1.2;
  p.scaleGrowth = 0.3 + Math.random() * 1.3;
  p.scaleWobble = Math.random() * 0.5;
  p.hueStart = Math.random() * 360 | 0;
  p.hueRange = 40 + (Math.random() * 220 | 0);
}

// ---- UI ----
const main = tool.pages.main;
const fShape = main.addFolder({ title: 'Shape' });
fShape.addBinding(params, 'shape', { options: { Triangle: 'triangle', Square: 'square', Pentagon: 'pentagon', Hexagon: 'hexagon', Star: 'star', Custom: 'custom' } });
fShape.addBinding(params, 'count', { min: 1, max: 100, step: 1 });
fShape.addBinding(params, 'shapeSize', { label: 'size', min: 2, max: 80, step: 1 });
fShape.addBinding(params, 'spread', { min: 0.2, max: 1.2, step: 0.05 });
fShape.addBinding(params, 'seed', { min: 0, max: 1000, step: 1 });

const fXform = main.addFolder({ title: 'Transform' });
fXform.addBinding(params, 'baseRotation', { label: 'base rot', min: 0, max: 360, step: 1 });
fXform.addBinding(params, 'rotationStep', { label: 'rot step', min: -45, max: 45, step: 1 });
fXform.addBinding(params, 'swirl', { min: 0, max: 3, step: 0.1 });
fXform.addBinding(params, 'noiseAmount', { label: 'noise amt', min: 0, max: 2, step: 0.05 });
fXform.addBinding(params, 'noiseScale', { label: 'noise scl', min: 0.02, max: 0.6, step: 0.01 });
fXform.addBinding(params, 'scaleGrowth', { label: 'grow', min: 0, max: 2, step: 0.05 });
fXform.addBinding(params, 'scaleWobble', { label: 'wobble', min: 0, max: 1, step: 0.05 });
fXform.addBinding(params, 'speed', { min: 0, max: 3, step: 0.1 });

const fSplit = main.addFolder({ title: 'Split' });
fSplit.addBinding(params, 'split', { options: { None: 'none', Horizontal: 'horizontal', Vertical: 'vertical', Quad: 'quad' } });

const fStyle = main.addFolder({ title: 'Style' });
fStyle.addBinding(params, 'render', { options: { Stroke: 'stroke', Fill: 'fill', Both: 'both' } });
fStyle.addBinding(params, 'strokeWeight', { label: 'weight', min: 0.25, max: 6, step: 0.25 });
fStyle.addBinding(params, 'hueStart', { min: 0, max: 360, step: 5 });
fStyle.addBinding(params, 'hueRange', { min: 0, max: 360, step: 5 });
fStyle.addBinding(params, 'saturation', { min: 0, max: 100, step: 5 });
fStyle.addBinding(params, 'lightness', { min: 0, max: 100, step: 5 });
fStyle.addBinding(params, 'opacity', { min: 10, max: 100, step: 5 });
fStyle.addBinding(params, 'background', { view: 'color' });

attachExport(tool.pages.export, {
  getCanvas: tool.getCanvas,
  getSVG: () => paper.project.exportSVG({ asString: true }),
  name: 'splitx',
});
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, randomize });

// ---- Custom SVG drag-drop ----
tool.canvasHost.addEventListener('dragover', (e) => e.preventDefault());
tool.canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name))) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = paper.project.importSVG(reader.result, { insert: false });
      imported.strokeColor = null;
      imported.fillColor = null;
      customItem = imported;
      params.shape = 'custom';
      tool.pane.refresh();
    } catch (err) {
      console.error('SVG import failed', err);
    }
  };
  reader.readAsText(file);
});

// ---- Animate ----
paper.view.onFrame = (e) => build(e.time);
