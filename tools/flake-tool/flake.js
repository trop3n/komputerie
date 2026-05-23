// FLAKE — generative symmetrical vector patterns on a grid. A parametric tile
// field where each cell's shape scale/rotation is driven by distance-to-center
// (SDF-style) and a multi-octave noise vector field, with swirl, a parametric
// polar mask, and looped motion. Vector rendering via Paper.js with real SVG
// export plus custom-SVG and raster-image-mask drag-drop. The parametric engine
// is ported from the repo's raster `tools/flake/flake.js`.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { noise2D } from '../../js/antlii/noise.js';

const paper = window.paper;

const params = {
  cellsX: 10, cellsY: 10, seed: 0,
  cellOffsetX: 0, cellOffsetY: 0, cellRotation: 0,
  gridMapX: 6, gridMapY: 6, symmetry: 'standard',
  shapeType: 'flake', shapeScale: 0.75, scalePower: 0, scalingEase: 'none',
  baseRotation: 0, angleMult: 1, renderStyle: 'fill',
  freqLayers: 4, freqBase: 0.07, freqAmplify: 0.5, freqMode: 'cos', branchAmount: 1, freqEasing: 'none',
  swirlMode: 'none', swirlFreq: 1, swirlAmplify: 0, swirlBase: 0,
  maskType: 'none', maskBranches: 6, maskRound: 0, maskInner: 0.1, maskOuter: 0.9,
  maskImageInfluence: 80,
  motionType: 'none', motionSpeed: 0.5, motionAmplify: 20,
  colorMode: 'paletteTransition', paletteCount: 4,
  c0: '#6c5ce7', c1: '#ffffff', c2: '#b2bec3', c3: '#fdcb6e', c4: '#00cec9',
  blendMode: 'multiply', background: '#ffffff',
};

let CW = 800, CH = 600;
let customItem = null;     // dropped SVG used as the shape
let maskImg = null;        // dropped raster image used as a mask
const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
let maskData = null, maskW = 0, maskH = 0;

// ---- Easing ----
const easings = {
  none: () => 1, linear: (t) => t,
  sineIn: (t) => 1 - Math.cos(t * Math.PI / 2), sineOut: (t) => Math.sin(t * Math.PI / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  quadIn: (t) => t * t, quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  cubicIn: (t) => t * t * t, cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  expoIn: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10), expoOut: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  expoInOut: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  circIn: (t) => 1 - Math.sqrt(1 - t * t), circOut: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  circInOut: (t) => t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
};
const EASE_OPTS = { None: 'none', Linear: 'linear', 'Sine In': 'sineIn', 'Sine Out': 'sineOut', 'Sine In-Out': 'sineInOut', 'Quad In': 'quadIn', 'Quad Out': 'quadOut', 'Quad In-Out': 'quadInOut', 'Cubic In': 'cubicIn', 'Cubic Out': 'cubicOut', 'Cubic In-Out': 'cubicInOut', 'Expo In': 'expoIn', 'Expo Out': 'expoOut', 'Expo In-Out': 'expoInOut', 'Circ In': 'circIn', 'Circ Out': 'circOut', 'Circ In-Out': 'circInOut' };
function applyEasing(t, mode) { return (easings[mode] || easings.none)(Math.max(0, Math.min(1, t))); }

// ---- Color ----
function interpolateHex(a, b, t) {
  const r1 = parseInt(a.slice(1, 3), 16), g1 = parseInt(a.slice(3, 5), 16), b1 = parseInt(a.slice(5, 7), 16);
  const r2 = parseInt(b.slice(1, 3), 16), g2 = parseInt(b.slice(3, 5), 16), b2 = parseInt(b.slice(5, 7), 16);
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}
function paletteColors() {
  return [params.c0, params.c1, params.c2, params.c3, params.c4].slice(0, Math.max(1, params.paletteCount));
}
function getFillColor(dist, mode, colors) {
  if (!colors.length) return '#ffffff';
  if (mode === 'solidColor') return colors[0];
  if (mode === 'paletteSequence') return colors[Math.min(Math.floor(dist * colors.length), colors.length - 1)];
  const t = dist * (colors.length - 1);
  const i = Math.min(Math.floor(t), colors.length - 2);
  return interpolateHex(colors[i], colors[Math.min(i + 1, colors.length - 1)], t - i);
}

// ---- Vector shape library (centered at origin) ----
function makeShape(type, size) {
  const P = paper, r = size / 2;
  switch (type) {
    case 'circle': return new P.Path.Circle([0, 0], r);
    case 'oval': return new P.Path.Ellipse({ center: [0, 0], radius: [r, r / 2] });
    case 'square': return new P.Path.Rectangle({ point: [-r, -r], size: [size, size] });
    case 'triangle': { const p = new P.Path([[0, -r], [-r * 0.866, r * 0.5], [r * 0.866, r * 0.5]]); p.closed = true; return p; }
    case 'star': return new P.Path.Star({ center: [0, 0], points: 5, radius1: r, radius2: r * 0.5 });
    case 'cross': { const t = size * 0.3; return new P.Group([new P.Path.Rectangle({ point: [-t / 2, -r], size: [t, size] }), new P.Path.Rectangle({ point: [-r, -t / 2], size: [size, t] })]); }
    case 'heart': { const pts = []; for (let a = 0; a < Math.PI * 2; a += 0.1) { const hx = r * 0.8 * (16 * Math.pow(Math.sin(a), 3)) / 16; const hy = -r * 0.8 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16; pts.push([hx, hy]); } const p = new P.Path(pts); p.closed = true; return p; }
    case 'arrow': { const h = size * 0.48, w = size * 0.30, n = h * 0.30; const p = new P.Path([[h, 0], [0, -w], [-n, -w * 0.45], [-h * 0.7, -w * 0.45], [-h * 0.7, w * 0.45], [-n, w * 0.45], [0, w]]); p.closed = true; return p; }
    case 'flower': { const g = new P.Group(); const pr = size * 0.35, ps = size * 0.2; for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i; g.addChild(new P.Path.Circle([Math.cos(a) * pr, Math.sin(a) * pr], ps)); } g.addChild(new P.Path.Circle([0, 0], size * 0.125)); return g; }
    case 'flake': { const g = new P.Group(); const arm = size * 0.47, bl = arm * 0.35, bp = arm * 0.55; for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i, ax = Math.cos(a), ay = Math.sin(a); g.addChild(new P.Path.Line([0, 0], [ax * arm, ay * arm])); const bx = ax * bp, by = ay * bp, pp = a + Math.PI / 2; g.addChild(new P.Path.Line([bx, by], [bx + Math.cos(pp) * bl, by + Math.sin(pp) * bl])); g.addChild(new P.Path.Line([bx, by], [bx - Math.cos(pp) * bl, by - Math.sin(pp) * bl])); } return g; }
    case 'spark': { const lo = size * 0.5, nw = size * 0.12; const p = new P.Path([[0, -lo], [nw, 0], [0, lo], [-nw, 0]]); p.closed = true; return p; }
    case 'flash': { const h = size * 0.5, w = size * 0.4; const p = new P.Path([[w * 0.4, -h], [-w * 0.1, -h * 0.1], [w * 0.2, -h * 0.1], [-w * 0.4, h], [w * 0.1, h * 0.1], [-w * 0.2, h * 0.1]]); p.closed = true; return p; }
    case 'clips': { const bl = size * 0.5, bw = size * 0.22, rr = bw / 2; return new P.Group([new P.Path.Rectangle({ point: [-bw / 2, -bl / 2], size: [bw, bl], radius: rr }), new P.Path.Rectangle({ point: [-bl / 2, -bw / 2], size: [bl, bw], radius: rr })]); }
    case 'checker': { const h = size / 2; return new P.Group([new P.Path.Rectangle({ point: [-h / 2, -h / 2], size: [h, h] }), new P.Path.Rectangle({ point: [0, 0], size: [h, h] })]); }
    case 'quadCircle': { const off = size * 0.27, ds = size * 0.16; const g = new P.Group(); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.addChild(new P.Path.Circle([sx * off, sy * off], ds)); return g; }
    case 'threeDots': { const r2 = size * 0.35, ds = size * 0.14; const g = new P.Group(); g.addChild(new P.Path.Circle([0, -r2], ds)); g.addChild(new P.Path.Circle([-r2 * 0.866, r2 * 0.5], ds)); g.addChild(new P.Path.Circle([r2 * 0.866, r2 * 0.5], ds)); return g; }
    case 'pinholeIndex': return new P.Path.Circle([0, 0], size * 0.075);
    case 'custom': if (customItem) { const it = customItem.clone(); it.fitBounds(new P.Rectangle(-r, -r, size, size)); return it; } return new P.Path.Circle([0, 0], r);
    default: return new P.Path.Circle([0, 0], r);
  }
}
const LINE_SHAPES = new Set(['flake']);

// ---- Angle field (multi-octave noise + branch + swirl + motion) ----
function computeAngle(col, row, tnx, tny, dist, time) {
  let sx = tnx, sy = tny;
  if (params.symmetry === 'mirrored') { sx = Math.abs(tnx); sy = Math.abs(tny); }
  const radial = Math.atan2(sy, sx);
  let acc = 0, freq = params.freqBase, amp = params.freqAmplify;
  for (let i = 0; i < params.freqLayers; i++) {
    const nx = (sx * params.gridMapX + col * 0.1) * freq + params.seed * 13.7;
    const ny = (sy * params.gridMapY + row * 0.1) * freq + params.seed * 7.31;
    acc += noise2D(nx, ny) * amp; freq *= 2; amp *= 0.5;
  }
  acc = params.freqMode === 'cos' ? Math.cos(acc * Math.PI) : Math.sin(acc * Math.PI);
  acc *= applyEasing(1 - dist, params.freqEasing);
  let branch = 0;
  if (params.branchAmount > 0.01) {
    const lx = (sx + Math.cos(radial + acc) * params.branchAmount * 0.5) * freq * 0.5 + params.seed * 5.1;
    const ly = (sy + Math.sin(radial + acc) * params.branchAmount * 0.5) * freq * 0.5 + params.seed * 9.3;
    branch = noise2D(lx, ly) * params.freqAmplify * params.branchAmount * 0.3;
  }
  let swirl = 0;
  if (params.swirlMode !== 'none') {
    const sd = Math.max(0, dist - params.swirlBase);
    const base = params.swirlMode === 'wave' ? Math.sin(dist * Math.PI * 4) : 1;
    swirl = sd * params.swirlFreq * Math.PI * base * (1 + params.swirlAmplify);
  }
  let timeOff = 0;
  if (params.motionType === 'noiseLoop') {
    const t = params.motionAmplify / 100;
    timeOff = noise2D(col * 0.03 + time * t * 3, row * 0.03) * Math.PI;
  }
  return radial + (acc + branch) * Math.PI + swirl + timeOff;
}

function maskAlphaAt(cx, cy) {
  if (params.maskType === 'none') return 1;
  const nx = (cx / CW) * 2 - 1, ny = (cy / CH) * 2 - 1;
  const r = Math.sqrt(nx * nx + ny * ny), theta = Math.atan2(ny, nx);
  const petal = 0.5 + 0.5 * Math.cos(params.maskBranches * theta);
  const outerR = params.maskOuter * Math.pow(petal, Math.max(0.1, params.maskRound + 1));
  if (r > outerR || r < params.maskInner) return 0;
  const e = 0.05;
  return Math.min(Math.min(1, (outerR - r) / e), Math.min(1, (r - params.maskInner) / e));
}

function maskLuminance(nx, ny) {
  if (!maskData) return 0.5;
  const px = Math.min(maskW - 1, Math.max(0, Math.floor(nx * maskW)));
  const py = Math.min(maskH - 1, Math.max(0, Math.floor(ny * maskH)));
  const i = (py * maskW + px) * 4;
  return (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
}

// ---- Build the vector scene ----
function build(time) {
  const view = paper.view;
  CW = view.size.width; CH = view.size.height;
  paper.project.activeLayer.removeChildren();

  const bg = new paper.Path.Rectangle(view.bounds);
  bg.fillColor = params.background;

  const cellsX = params.cellsX, cellsY = params.cellsY;
  const cellSize = Math.min(CW / cellsX, CH / cellsY);
  const numCols = Math.ceil(CW / cellSize) + 1, numRows = Math.ceil(CH / cellSize) + 1;
  const halfX = cellsX * 0.5, halfY = cellsY * 0.5;
  const colors = paletteColors();
  const scaleMult = params.motionType === 'scalingLoop' ? 0.5 + 0.5 * Math.sin(time * Math.PI * 2) : 1;
  const blend = params.blendMode;
  const influence = params.maskImageInfluence / 100;

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const xOff = (row % 2 === 1) ? cellSize * params.cellOffsetX * 0.5 : 0;
      const yOff = (col % 2 === 1) ? cellSize * params.cellOffsetY * 0.5 : 0;
      const cx = col * cellSize + cellSize * 0.5 + xOff;
      const cy = row * cellSize + cellSize * 0.5 + yOff;

      const tc = ((col % cellsX) + cellsX) % cellsX, tr = ((row % cellsY) + cellsY) % cellsY;
      const tnx = (tc - halfX + 0.5) / halfX, tny = (tr - halfY + 0.5) / halfY;
      const dist = Math.min(Math.sqrt(tnx * tnx + tny * tny) / Math.SQRT2, 1);

      let scaledT = applyEasing(1 - dist, params.scalingEase);
      if (params.scalePower > 0) scaledT = Math.pow(scaledT, params.scalePower + 1);
      let shapeSize = cellSize * params.shapeScale * scaledT * scaleMult;
      if (maskData && influence > 0) {
        const lum = maskLuminance(cx / CW, cy / CH);
        shapeSize *= (1 - influence) + influence * lum * 2;
      }
      if (shapeSize < 0.5) continue;

      const alpha = maskAlphaAt(cx, cy);
      if (alpha < 0.01) continue;

      const fieldAngle = computeAngle(col, row, tnx, tny, dist, time);
      const rotDeg = (params.baseRotation + params.cellRotation) + fieldAngle * params.angleMult * (180 / Math.PI);
      const color = getFillColor(dist, params.colorMode, colors);

      const item = makeShape(params.shapeType, shapeSize);
      item.position = new paper.Point(cx, cy);
      item.rotate(rotDeg);
      if (LINE_SHAPES.has(params.shapeType)) {
        item.strokeColor = color; item.strokeWidth = Math.max(1, shapeSize * 0.06);
      } else {
        if (params.renderStyle === 'fill' || params.renderStyle === 'mixed') item.fillColor = color;
        if (params.renderStyle === 'stroke' || params.renderStyle === 'mixed') { item.strokeColor = color; item.strokeWidth = 1; }
      }
      item.opacity = alpha;
      if (blend !== 'normal') item.blendMode = blend;
    }
  }
}

// ---- UI ----
const tool = createTool({ name: 'FLAKE', version: '0.1' });
const canvas = tool.mountCanvas();
paper.setup(canvas);
function fitView() { paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', () => { fitView(); dirty = true; });
fitView();

const main = tool.pages.main;
const fPattern = main.addFolder({ title: 'Pattern' });
fPattern.addBinding(params, 'cellsX', { label: 'cells X', min: 2, max: 40, step: 1 });
fPattern.addBinding(params, 'cellsY', { label: 'cells Y', min: 2, max: 40, step: 1 });
fPattern.addBinding(params, 'cellOffsetX', { label: 'offset X', min: 0, max: 1, step: 0.05 });
fPattern.addBinding(params, 'cellOffsetY', { label: 'offset Y', min: 0, max: 1, step: 0.05 });
fPattern.addBinding(params, 'cellRotation', { label: 'cell rot', min: 0, max: 360, step: 1 });
fPattern.addBinding(params, 'gridMapX', { label: 'grid map X', min: 0.5, max: 20, step: 0.5 });
fPattern.addBinding(params, 'gridMapY', { label: 'grid map Y', min: 0.5, max: 20, step: 0.5 });
fPattern.addBinding(params, 'symmetry', { options: { Standard: 'standard', Mirrored: 'mirrored' } });
fPattern.addBinding(params, 'seed', { min: 0, max: 100, step: 1 });

const fShape = main.addFolder({ title: 'Shape' });
fShape.addBinding(params, 'shapeType', { label: 'shape', options: { Circle: 'circle', Oval: 'oval', Square: 'square', Triangle: 'triangle', Star: 'star', Cross: 'cross', Heart: 'heart', Arrow: 'arrow', Flower: 'flower', Flake: 'flake', Spark: 'spark', Flash: 'flash', Clips: 'clips', Checker: 'checker', 'Quad Circle': 'quadCircle', 'Three Dots': 'threeDots', Pinhole: 'pinholeIndex', Custom: 'custom' } });
fShape.addBinding(params, 'shapeScale', { label: 'scale', min: 0.05, max: 2, step: 0.05 });
fShape.addBinding(params, 'scalePower', { label: 'scale pow', min: 0, max: 3, step: 0.1 });
fShape.addBinding(params, 'scalingEase', { label: 'scale ease', options: EASE_OPTS });
fShape.addBinding(params, 'baseRotation', { label: 'base rot', min: 0, max: 360, step: 1 });
fShape.addBinding(params, 'angleMult', { label: 'angle mult', min: 0, max: 4, step: 0.1 });
fShape.addBinding(params, 'renderStyle', { label: 'render', options: { Fill: 'fill', Stroke: 'stroke', Mixed: 'mixed' } });

const fNoise = main.addFolder({ title: 'Noise', expanded: false });
fNoise.addBinding(params, 'freqLayers', { label: 'layers', min: 1, max: 8, step: 1 });
fNoise.addBinding(params, 'freqBase', { label: 'base freq', min: 0.01, max: 0.5, step: 0.01 });
fNoise.addBinding(params, 'freqAmplify', { label: 'amplify', min: 0.1, max: 3, step: 0.1 });
fNoise.addBinding(params, 'freqMode', { label: 'mode', options: { Cos: 'cos', Sin: 'sin' } });
fNoise.addBinding(params, 'branchAmount', { label: 'branch', min: 0, max: 12, step: 0.1 });
fNoise.addBinding(params, 'freqEasing', { label: 'easing', options: EASE_OPTS });

const fSwirl = main.addFolder({ title: 'Swirl', expanded: false });
fSwirl.addBinding(params, 'swirlMode', { label: 'mode', options: { Off: 'none', Rotary: 'rotary', Wave: 'wave' } });
fSwirl.addBinding(params, 'swirlFreq', { label: 'freq', min: 0.1, max: 5, step: 0.1 });
fSwirl.addBinding(params, 'swirlAmplify', { label: 'amplify', min: 0, max: 5, step: 0.1 });
fSwirl.addBinding(params, 'swirlBase', { label: 'base', min: 0, max: 1, step: 0.05 });

const fMask = main.addFolder({ title: 'Mask', expanded: false });
fMask.addBinding(params, 'maskType', { label: 'mode', options: { Off: 'none', Parametric: 'parametric' } });
fMask.addBinding(params, 'maskBranches', { label: 'branches', min: 1, max: 12, step: 1 });
fMask.addBinding(params, 'maskRound', { label: 'round', min: 0, max: 5, step: 0.1 });
fMask.addBinding(params, 'maskInner', { label: 'inner', min: 0, max: 0.5, step: 0.01 });
fMask.addBinding(params, 'maskOuter', { label: 'outer', min: 0.3, max: 1.5, step: 0.01 });
fMask.addBinding(params, 'maskImageInfluence', { label: 'img mask', min: 0, max: 100, step: 1 });

const fMotion = main.addFolder({ title: 'Motion', expanded: false });
fMotion.addBinding(params, 'motionType', { label: 'mode', options: { Off: 'none', Noise: 'noiseLoop', Scale: 'scalingLoop' } });
fMotion.addBinding(params, 'motionSpeed', { label: 'speed', min: 0.1, max: 3, step: 0.1 });
fMotion.addBinding(params, 'motionAmplify', { label: 'amplify', min: 0, max: 100, step: 1 });

const fColor = main.addFolder({ title: 'Color' });
fColor.addBinding(params, 'colorMode', { label: 'mode', options: { Solid: 'solidColor', Sequence: 'paletteSequence', Transition: 'paletteTransition' } });
fColor.addBinding(params, 'paletteCount', { label: 'colors', min: 1, max: 5, step: 1 });
fColor.addBinding(params, 'c0', { label: 'color 1', view: 'color' });
fColor.addBinding(params, 'c1', { label: 'color 2', view: 'color' });
fColor.addBinding(params, 'c2', { label: 'color 3', view: 'color' });
fColor.addBinding(params, 'c3', { label: 'color 4', view: 'color' });
fColor.addBinding(params, 'c4', { label: 'color 5', view: 'color' });
fColor.addBinding(params, 'blendMode', { label: 'blend', options: { Normal: 'normal', Multiply: 'multiply', Screen: 'screen', Overlay: 'overlay', Darken: 'darken', Lighten: 'lighten', 'Color Dodge': 'color-dodge', 'Color Burn': 'color-burn', 'Hard Light': 'hard-light', 'Soft Light': 'soft-light', Difference: 'difference', Exclusion: 'exclusion', Add: 'add' } });
fColor.addBinding(params, 'background', { view: 'color' });

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, getSVG: () => paper.project.exportSVG({ asString: true }), name: 'flake' });

// ---- Presets (original content) ----
const presets = {
  'Snow Lattice': { cellsX: 12, cellsY: 12, shapeType: 'flake', shapeScale: 0.8, scalingEase: 'sineOut', freqLayers: 4, freqBase: 0.07, freqAmplify: 0.5, freqMode: 'cos', branchAmount: 2, swirlMode: 'none', maskType: 'none', motionType: 'none', colorMode: 'paletteTransition', paletteCount: 3, c0: '#7ad7f0', c1: '#ffffff', c2: '#b8c6db', blendMode: 'multiply', background: '#0a0e17' },
  'Bloom Grid': { cellsX: 10, cellsY: 10, shapeType: 'flower', shapeScale: 0.9, scalePower: 0.6, scalingEase: 'quadOut', freqLayers: 3, freqBase: 0.05, freqAmplify: 0.8, branchAmount: 1, swirlMode: 'rotary', swirlFreq: 1.4, swirlAmplify: 0.6, maskType: 'parametric', maskBranches: 6, maskOuter: 1.0, motionType: 'noiseLoop', motionSpeed: 0.4, motionAmplify: 30, colorMode: 'paletteTransition', paletteCount: 4, c0: '#ff7675', c1: '#fd79a8', c2: '#fdcb6e', c3: '#ffffff', blendMode: 'multiply', background: '#ffffff' },
  Vortex: { cellsX: 16, cellsY: 16, shapeType: 'spark', shapeScale: 1.0, scalingEase: 'cubicInOut', freqLayers: 5, freqBase: 0.09, freqAmplify: 1.0, freqMode: 'sin', branchAmount: 0.5, swirlMode: 'wave', swirlFreq: 2.2, swirlAmplify: 1.5, maskType: 'none', motionType: 'noiseLoop', motionSpeed: 0.6, motionAmplify: 50, colorMode: 'paletteTransition', paletteCount: 3, c0: '#6c5ce7', c1: '#00cec9', c2: '#0a0e17', blendMode: 'screen', background: '#05060a' },
  'Halftone Bloom': { cellsX: 20, cellsY: 20, shapeType: 'circle', shapeScale: 0.7, scalePower: 1.2, scalingEase: 'sineInOut', freqLayers: 2, freqBase: 0.05, branchAmount: 0, swirlMode: 'none', maskType: 'none', motionType: 'none', colorMode: 'paletteSequence', paletteCount: 2, c0: '#000000', c1: '#ffffff', blendMode: 'normal', background: '#ffffff' },
  Mandala: { cellsX: 16, cellsY: 16, shapeType: 'star', shapeScale: 0.85, scalingEase: 'circOut', freqLayers: 4, freqBase: 0.08, branchAmount: 3, swirlMode: 'rotary', swirlFreq: 1.6, swirlAmplify: 0.8, maskType: 'parametric', maskBranches: 8, maskOuter: 1.0, maskRound: 1.2, motionType: 'none', colorMode: 'paletteTransition', paletteCount: 4, c0: '#6c5ce7', c1: '#a29bfe', c2: '#fd79a8', c3: '#ffeaa7', blendMode: 'multiply', background: '#ffffff' },
  Carbon: { cellsX: 14, cellsY: 14, shapeType: 'cross', shapeScale: 0.6, renderStyle: 'stroke', scalingEase: 'linear', freqLayers: 3, freqMode: 'sin', branchAmount: 1, swirlMode: 'none', colorMode: 'solidColor', paletteCount: 1, c0: '#dfe6e9', blendMode: 'normal', background: '#0b0d12' },
  'Heart Field': { cellsX: 12, cellsY: 12, shapeType: 'heart', shapeScale: 0.8, scalePower: 0.8, scalingEase: 'quadOut', freqLayers: 3, branchAmount: 0.5, swirlMode: 'wave', swirlFreq: 1.2, maskType: 'parametric', maskBranches: 1, maskRound: 0.4, maskOuter: 1.1, motionType: 'scalingLoop', motionSpeed: 0.5, colorMode: 'paletteTransition', paletteCount: 3, c0: '#ff7675', c1: '#fd79a8', c2: '#ffffff', blendMode: 'multiply', background: '#fff5f6' },
  'Static Drift': { cellsX: 24, cellsY: 24, shapeType: 'checker', shapeScale: 0.9, scalingEase: 'none', freqLayers: 5, freqBase: 0.12, freqAmplify: 1.2, freqMode: 'sin', branchAmount: 0.2, motionType: 'noiseLoop', motionSpeed: 0.8, motionAmplify: 60, colorMode: 'paletteSequence', paletteCount: 3, c0: '#0a0e17', c1: '#3c6382', c2: '#82ccdd', blendMode: 'screen', background: '#04060a' },
  'Asterisk Quilt': { cellsX: 18, cellsY: 18, shapeType: 'spark', shapeScale: 1.0, scalingEase: 'sineOut', freqLayers: 4, branchAmount: 1.5, swirlMode: 'rotary', swirlFreq: 0.8, renderStyle: 'mixed', colorMode: 'paletteTransition', paletteCount: 4, c0: '#e17055', c1: '#fdcb6e', c2: '#00b894', c3: '#0984e3', blendMode: 'multiply', background: '#fffaf0' },
  'Three Dots Wave': { cellsX: 16, cellsY: 10, shapeType: 'threeDots', shapeScale: 0.9, scalingEase: 'sineInOut', freqLayers: 3, freqMode: 'cos', branchAmount: 2, swirlMode: 'wave', swirlFreq: 2, motionType: 'noiseLoop', motionSpeed: 0.4, motionAmplify: 25, colorMode: 'paletteTransition', paletteCount: 3, c0: '#6c5ce7', c1: '#74b9ff', c2: '#ffffff', blendMode: 'multiply', background: '#ffffff' },
};
function randomize(p) {
  const shapes = ['circle', 'square', 'triangle', 'star', 'cross', 'flower', 'flake', 'spark', 'clips', 'threeDots'];
  const eases = Object.values(EASE_OPTS);
  p.shapeType = shapes[(Math.random() * shapes.length) | 0];
  p.cellsX = 6 + (Math.random() * 28 | 0); p.cellsY = 6 + (Math.random() * 28 | 0);
  p.shapeScale = 0.4 + Math.random() * 1.2; p.scalePower = Math.random() * 2;
  p.scalingEase = eases[(Math.random() * eases.length) | 0];
  p.gridMapX = 1 + Math.random() * 12; p.gridMapY = 1 + Math.random() * 12;
  p.freqLayers = 1 + (Math.random() * 7 | 0); p.freqBase = 0.02 + Math.random() * 0.3; p.freqAmplify = 0.2 + Math.random() * 2;
  p.freqMode = Math.random() < 0.5 ? 'cos' : 'sin'; p.branchAmount = Math.random() * 6;
  p.swirlMode = ['none', 'rotary', 'wave'][(Math.random() * 3) | 0]; p.swirlFreq = 0.2 + Math.random() * 4; p.swirlAmplify = Math.random() * 3;
  p.angleMult = Math.random() * 3; p.seed = (Math.random() * 100) | 0;
}
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, randomize, onApply: () => { dirty = true; } });

// ---- Drag-drop: SVG -> shape, raster -> mask ----
tool.canvasHost.addEventListener('dragover', (e) => e.preventDefault());
tool.canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
  const reader = new FileReader();
  if (isSvg) {
    reader.onload = () => {
      try {
        const it = paper.project.importSVG(reader.result, { insert: false });
        it.strokeColor = null; it.fillColor = null;
        customItem = it; params.shapeType = 'custom'; dirty = true; tool.pane.refresh();
      } catch (err) { console.error('SVG import failed', err); }
    };
    reader.readAsText(file);
  } else if (/^image\//i.test(file.type)) {
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        maskW = Math.min(img.naturalWidth, 200);
        maskH = Math.round(maskW * img.naturalHeight / img.naturalWidth) || 150;
        maskCanvas.width = maskW; maskCanvas.height = maskH;
        maskCtx.drawImage(img, 0, 0, maskW, maskH);
        maskData = maskCtx.getImageData(0, 0, maskW, maskH).data;
        maskImg = img; dirty = true;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
});

// ---- Animate (rebuild every frame only while in motion; else on change) ----
let dirty = true;
tool.pane.on('change', () => { dirty = true; });
let currentTime = 0;
paper.view.onFrame = (e) => {
  const moving = params.motionType !== 'none';
  if (moving) currentTime += params.motionSpeed * Math.min(e.delta, 0.1);
  if (moving || dirty) { build(currentTime); dirty = false; }
};
