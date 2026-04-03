import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const CW = 800, CH = 600;
canvas.width = CW;
canvas.height = CH;

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let animId = null;
let currentTime = 0;
let sampData = null;
let sampW = 0, sampH = 0;

// --- Simplex noise 2D ---

const PERM = new Uint8Array(512);
const GRAD3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

(function seedNoise() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function dot2(g, x, y) { return g[0] * x + g[1] * y; }

function noise2D(xin, yin) {
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

// --- Easing functions ---

const easings = {
  none:       () => 1,
  linear:     (t) => t,
  sineIn:     (t) => 1 - Math.cos(t * Math.PI / 2),
  sineOut:    (t) => Math.sin(t * Math.PI / 2),
  quadIn:     (t) => t * t,
  quadOut:    (t) => 1 - (1 - t) * (1 - t),
  quadInOut:  (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  cubicIn:    (t) => t * t * t,
  cubicOut:   (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  expoIn:     (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  expoOut:    (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  expoInOut:  (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  circIn:     (t) => 1 - Math.sqrt(1 - t * t),
  circOut:    (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  circInOut:  (t) => t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
};

function applyEasing(t, mode) {
  const fn = easings[mode] || easings.none;
  return fn(Math.max(0, Math.min(1, t)));
}

// --- Source sampling ---

function updateSourceSample() {
  if (!mediaSource.ready) { sampData = null; return; }
  sampW = Math.min(mediaSource.width, 200);
  sampH = Math.round(sampW * mediaSource.height / mediaSource.width) || 150;
  sampCanvas.width = sampW;
  sampCanvas.height = sampH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, sampW, sampH);
  sampData = sampCtx.getImageData(0, 0, sampW, sampH).data;
}

function getSourceLuminance(normX, normY) {
  if (!sampData) return 0.5;
  const px = Math.min(sampW - 1, Math.max(0, Math.floor(normX * sampW)));
  const py = Math.min(sampH - 1, Math.max(0, Math.floor(normY * sampH)));
  const i = (py * sampW + px) * 4;
  return (sampData[i] * 0.299 + sampData[i + 1] * 0.587 + sampData[i + 2] * 0.114) / 255;
}

// --- Color ---

function interpolateHex(a, b, t) {
  const r1 = parseInt(a.slice(1, 3), 16), g1 = parseInt(a.slice(3, 5), 16), b1 = parseInt(a.slice(5, 7), 16);
  const r2 = parseInt(b.slice(1, 3), 16), g2 = parseInt(b.slice(3, 5), 16), b2 = parseInt(b.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
  const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
  const bh = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
  return `#${r}${g}${bh}`;
}

function getPaletteColors() {
  const inputs = document.querySelectorAll('#palette-swatches input[type="color"]');
  return Array.from(inputs, el => el.value);
}

function getFillColor(dist, colorMode, colors) {
  if (!colors || colors.length === 0) return '#ffffff';
  if (colorMode === 'solidColor') return colors[0];
  if (colorMode === 'paletteSequence') {
    return colors[Math.min(Math.floor(dist * colors.length), colors.length - 1)];
  }
  // paletteTransition
  const t = dist * (colors.length - 1);
  const i = Math.min(Math.floor(t), colors.length - 2);
  const frac = t - i;
  return interpolateHex(colors[i], colors[Math.min(i + 1, colors.length - 1)], frac);
}

// --- Shape drawing (Canvas 2D) ---

const LINE_SHAPES = new Set(['flake']);

function drawShape(type, x, y, size, rotRad) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotRad);

  switch (type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      break;
    case 'oval':
      ctx.beginPath();
      ctx.ellipse(0, 0, size / 2, size / 4, 0, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.beginPath();
      ctx.rect(-size / 2, -size / 2, size, size);
      break;
    case 'triangle': {
      const r = size / 2;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(-r * 0.866, r * 0.5);
      ctx.lineTo(r * 0.866, r * 0.5);
      ctx.closePath();
      break;
    }
    case 'star': {
      const outerR = size / 2, innerR = outerR * 0.5, pts = 5;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (Math.PI / pts) * i - Math.PI / 2;
        const rd = i % 2 === 0 ? outerR : innerR;
        if (i === 0) ctx.moveTo(Math.cos(a) * rd, Math.sin(a) * rd);
        else ctx.lineTo(Math.cos(a) * rd, Math.sin(a) * rd);
      }
      ctx.closePath();
      break;
    }
    case 'cross': {
      const t = size * 0.3;
      ctx.beginPath();
      ctx.rect(-t / 2, -size / 2, t, size);
      ctx.rect(-size / 2, -t / 2, size, t);
      break;
    }
    case 'heart': {
      const r = size / 2;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const hx = r * 0.8 * (16 * Math.pow(Math.sin(a), 3)) / 16;
        const hy = -r * 0.8 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16;
        if (a === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const h = size * 0.48, w = size * 0.30, notch = h * 0.30;
      ctx.beginPath();
      ctx.moveTo(h, 0);
      ctx.lineTo(0, -w);
      ctx.lineTo(-notch, -w * 0.45);
      ctx.lineTo(-h * 0.7, -w * 0.45);
      ctx.lineTo(-h * 0.7, w * 0.45);
      ctx.lineTo(-notch, w * 0.45);
      ctx.lineTo(0, w);
      ctx.closePath();
      break;
    }
    case 'flower': {
      const petalR = size * 0.35, petalSize = size * 0.2;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * petalR, Math.sin(a) * petalR, petalSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.125, 0, Math.PI * 2);
      break;
    }
    case 'flake': {
      const arm = size * 0.47, branchLen = arm * 0.35, branchPos = arm * 0.55;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const ax = Math.cos(a), ay = Math.sin(a);
        ctx.moveTo(0, 0);
        ctx.lineTo(ax * arm, ay * arm);
        const bx = ax * branchPos, by = ay * branchPos;
        const perp = a + Math.PI / 2;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(perp) * branchLen, by + Math.sin(perp) * branchLen);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(perp) * branchLen, by - Math.sin(perp) * branchLen);
      }
      break;
    }
    case 'spark': {
      const long = size * 0.5, narrow = size * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, -long);
      ctx.lineTo(narrow, 0);
      ctx.lineTo(0, long);
      ctx.lineTo(-narrow, 0);
      ctx.closePath();
      break;
    }
    case 'flash': {
      const h = size * 0.5, w = size * 0.4;
      ctx.beginPath();
      ctx.moveTo(w * 0.4, -h);
      ctx.lineTo(-w * 0.1, -h * 0.1);
      ctx.lineTo(w * 0.2, -h * 0.1);
      ctx.lineTo(-w * 0.4, h);
      ctx.lineTo(w * 0.1, h * 0.1);
      ctx.lineTo(-w * 0.2, h * 0.1);
      ctx.closePath();
      break;
    }
    case 'clips': {
      const barLen = size * 0.5, barW = size * 0.22, r = barW / 2;
      ctx.beginPath();
      roundRect(ctx, -barW / 2, -barLen / 2, barW, barLen, r);
      roundRect(ctx, -barLen / 2, -barW / 2, barLen, barW, r);
      break;
    }
    case 'checker': {
      const h = size / 2, q = h / 2;
      ctx.beginPath();
      ctx.rect(-h / 2, -h / 2, h, h);
      ctx.rect(0, 0, h, h);
      break;
    }
    case 'quadCircle': {
      const off = size * 0.27, ds = size * 0.16;
      ctx.beginPath();
      ctx.arc(-off, -off, ds, 0, Math.PI * 2);
      ctx.moveTo(off + ds, -off);
      ctx.arc(off, -off, ds, 0, Math.PI * 2);
      ctx.moveTo(-off + ds, off);
      ctx.arc(-off, off, ds, 0, Math.PI * 2);
      ctx.moveTo(off + ds, off);
      ctx.arc(off, off, ds, 0, Math.PI * 2);
      break;
    }
    case 'threeDots': {
      const r = size * 0.35, ds = size * 0.14;
      ctx.beginPath();
      ctx.arc(0, -r, ds, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.866 + ds, r * 0.5);
      ctx.arc(-r * 0.866, r * 0.5, ds, 0, Math.PI * 2);
      ctx.moveTo(r * 0.866 + ds, r * 0.5);
      ctx.arc(r * 0.866, r * 0.5, ds, 0, Math.PI * 2);
      break;
    }
    case 'pinholeIndex': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.075, 0, Math.PI * 2);
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  }

  // flower handles its own fill/stroke per petal above
  if (type !== 'flower') {
    if (LINE_SHAPES.has(type)) {
      ctx.stroke();
    } else {
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

// --- Element refs ---

const els = {
  sourceInfluence: document.getElementById('source-influence'),
  cellsX: document.getElementById('cells-x'),
  cellsY: document.getElementById('cells-y'),
  seed: document.getElementById('seed'),
  cellOffsetX: document.getElementById('cell-offset-x'),
  cellOffsetY: document.getElementById('cell-offset-y'),
  cellRotation: document.getElementById('cell-rotation'),
  shapeType: document.getElementById('shape-type'),
  shapeScale: document.getElementById('shape-scale'),
  scalePower: document.getElementById('scale-power'),
  scalingEase: document.getElementById('scaling-ease'),
  baseRotation: document.getElementById('base-rotation'),
  angleMult: document.getElementById('angle-mult'),
  gridMapX: document.getElementById('grid-map-x'),
  gridMapY: document.getElementById('grid-map-y'),
  freqLayers: document.getElementById('freq-layers'),
  freqBase: document.getElementById('freq-base'),
  freqAmplify: document.getElementById('freq-amplify'),
  freqEasing: document.getElementById('freq-easing'),
  branchAmount: document.getElementById('branch-amount'),
  swirlFreq: document.getElementById('swirl-freq'),
  swirlAmplify: document.getElementById('swirl-amplify'),
  swirlBase: document.getElementById('swirl-base'),
  maskBranches: document.getElementById('mask-branches'),
  maskRound: document.getElementById('mask-round'),
  maskInner: document.getElementById('mask-inner'),
  maskOuter: document.getElementById('mask-outer'),
  motionSpeed: document.getElementById('motion-speed'),
  motionAmplify: document.getElementById('motion-amplify'),
  blendMode: document.getElementById('blend-mode'),
  background: document.getElementById('background'),
};

function getRadio(id) { return document.querySelector(`#${id} input:checked`)?.value; }

// --- UI wiring ---

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

// Palette swatch management
document.getElementById('btn-add-color').addEventListener('click', () => {
  const row = document.getElementById('palette-swatches');
  const btn = document.getElementById('btn-add-color');
  const input = document.createElement('input');
  input.type = 'color';
  input.value = '#ffffff';
  input.addEventListener('contextmenu', removeSwatchHandler);
  row.insertBefore(input, btn);
});

document.querySelectorAll('#palette-swatches input[type="color"]').forEach(el => {
  el.addEventListener('contextmenu', removeSwatchHandler);
});

function removeSwatchHandler(e) {
  e.preventDefault();
  const row = document.getElementById('palette-swatches');
  if (row.querySelectorAll('input[type="color"]').length > 1) {
    e.target.remove();
  }
}

// --- Angle field computation ---

function computeAngle(col, row, tnx, tny, dist, time, params) {
  const { symmetry, freqMode, freqLayers, freqBase, freqAmplify, branchAmount,
          freqEasing, gridMapX, gridMapY, seed,
          swirlMode, swirlFreq, swirlAmplify, swirlBase,
          motionType, motionAmplify } = params;

  let sx = tnx, sy = tny;
  if (symmetry === 'mirrored') { sx = Math.abs(tnx); sy = Math.abs(tny); }

  const radial = Math.atan2(tny, tnx);

  // Multi-octave noise
  let noiseAcc = 0;
  let freq = freqBase;
  let amp = freqAmplify;
  for (let i = 0; i < freqLayers; i++) {
    const nx = (sx * gridMapX + col * 0.1) * freq + seed * 13.7;
    const ny = (sy * gridMapY + row * 0.1) * freq + seed * 7.31;
    noiseAcc += noise2D(nx, ny) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }

  noiseAcc = freqMode === 'cos'
    ? Math.cos(noiseAcc * Math.PI)
    : Math.sin(noiseAcc * Math.PI);

  const distWeight = applyEasing(1 - dist, freqEasing);
  noiseAcc *= distWeight;

  // Branch
  let branchContrib = 0;
  if (branchAmount > 0.01) {
    const lookNx = (sx + Math.cos(radial + noiseAcc) * branchAmount * 0.5) * freq * 0.5 + seed * 5.1;
    const lookNy = (sy + Math.sin(radial + noiseAcc) * branchAmount * 0.5) * freq * 0.5 + seed * 9.3;
    branchContrib = noise2D(lookNx, lookNy) * freqAmplify * branchAmount * 0.3;
  }

  // Swirl
  let swirlOff = 0;
  if (swirlMode !== 'none') {
    const sd = Math.max(0, dist - swirlBase);
    const base = swirlMode === 'wave' ? Math.sin(dist * Math.PI * 4) : 1;
    swirlOff = sd * swirlFreq * Math.PI * base * (1 + swirlAmplify);
  }

  // Motion noise
  let timeOff = 0;
  if (motionType === 'noiseLoop') {
    const t = motionAmplify / 100;
    timeOff = noise2D(col * 0.03 + time * t * 3, row * 0.03) * Math.PI;
  }

  return radial + (noiseAcc + branchContrib) * Math.PI + swirlOff + timeOff;
}

// --- Mask ---

function getMaskAlpha(cx, cy, maskType, maskBranches, maskRound, maskInner, maskOuter) {
  if (maskType === 'none') return 1;

  const nx = (cx / CW) * 2 - 1;
  const ny = (cy / CH) * 2 - 1;
  const r = Math.sqrt(nx * nx + ny * ny);
  const theta = Math.atan2(ny, nx);

  const petal = 0.5 + 0.5 * Math.cos(maskBranches * theta);
  const round = Math.pow(petal, Math.max(0.1, maskRound + 1));
  const outerR = maskOuter * round;
  const innerR = maskInner;

  if (r > outerR || r < innerR) return 0;

  const edge = 0.05;
  const outerAlpha = Math.min(1, (outerR - r) / edge);
  const innerAlpha = Math.min(1, (r - innerR) / edge);
  return Math.min(outerAlpha, innerAlpha);
}

// --- Render ---

let sourceUpdateCounter = 0;

function render() {
  // Update source for video/camera
  if (mediaSource.ready && mediaSource.type !== 'image') {
    sourceUpdateCounter++;
    if (sourceUpdateCounter % 5 === 0) updateSourceSample();
  }

  const motionType = getRadio('motion-radios') || 'none';
  const motionSpeed = +els.motionSpeed.value;

  if (motionType !== 'none') {
    currentTime += motionSpeed * 0.016;
  }

  const time = currentTime;

  // Read all params
  const cellsX = +els.cellsX.value;
  const cellsY = +els.cellsY.value;
  const seed = +els.seed.value;
  const cellOffsetX = +els.cellOffsetX.value;
  const cellOffsetY = +els.cellOffsetY.value;
  const cellRotation = +els.cellRotation.value;
  const shapeType = els.shapeType.value;
  const shapeScale = +els.shapeScale.value;
  const scalePower = +els.scalePower.value;
  const scalingEase = els.scalingEase.value;
  const baseRotation = +els.baseRotation.value;
  const angleMult = +els.angleMult.value;
  const gridMapX = +els.gridMapX.value;
  const gridMapY = +els.gridMapY.value;
  const symmetry = getRadio('symmetry-radios') || 'standard';
  const freqLayers = +els.freqLayers.value;
  const freqBase = +els.freqBase.value;
  const freqAmplify = +els.freqAmplify.value;
  const freqMode = getRadio('freq-mode-radios') || 'cos';
  const freqEasing = els.freqEasing.value;
  const branchAmount = +els.branchAmount.value;
  const swirlMode = getRadio('swirl-mode-radios') || 'none';
  const swirlFreq = +els.swirlFreq.value;
  const swirlAmplify = +els.swirlAmplify.value;
  const swirlBase = +els.swirlBase.value;
  const maskType = getRadio('mask-radios') || 'none';
  const maskBranches = +els.maskBranches.value;
  const maskRound = +els.maskRound.value;
  const maskInner = +els.maskInner.value;
  const maskOuter = +els.maskOuter.value;
  const motionAmplify = +els.motionAmplify.value;
  const renderStyle = getRadio('render-radios') || 'fill';
  const colorMode = getRadio('color-mode-radios') || 'paletteTransition';
  const blendMode = els.blendMode.value;
  const bg = els.background.value;
  const sourceInfluence = +els.sourceInfluence.value / 100;
  const colors = getPaletteColors();

  // Background
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Cell sizing
  const cellSizeX = CW / cellsX;
  const cellSizeY = CH / cellsY;
  const cellSize = Math.min(cellSizeX, cellSizeY);
  const numCols = Math.ceil(CW / cellSize) + 1;
  const numRows = Math.ceil(CH / cellSize) + 1;

  // Motion scale multiplier
  let scaleMult = 1;
  if (motionType === 'scalingLoop') {
    scaleMult = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
  }

  const halfX = cellsX * 0.5;
  const halfY = cellsY * 0.5;

  const angleParams = {
    symmetry, freqMode, freqLayers, freqBase, freqAmplify, branchAmount,
    freqEasing, gridMapX, gridMapY, seed,
    swirlMode, swirlFreq, swirlAmplify, swirlBase,
    motionType, motionAmplify,
  };

  ctx.globalCompositeOperation = blendMode;

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      // Cell center with brick-offset
      const xOff = (row % 2 === 1) ? cellSize * cellOffsetX * 0.5 : 0;
      const yOff = (col % 2 === 1) ? cellSize * cellOffsetY * 0.5 : 0;
      const cx = col * cellSize + cellSize * 0.5 + xOff;
      const cy = row * cellSize + cellSize * 0.5 + yOff;

      // Tile-local indices
      const tc = ((col % cellsX) + cellsX) % cellsX;
      const tr = ((row % cellsY) + cellsY) % cellsY;

      // Normalised position within tile
      const tnx = (tc - halfX + 0.5) / halfX;
      const tny = (tr - halfY + 0.5) / halfY;
      const dist = Math.min(Math.sqrt(tnx * tnx + tny * tny) / Math.SQRT2, 1.0);

      // Shape size with easing
      let scaledT = applyEasing(1 - dist, scalingEase);
      if (scalePower > 0) scaledT = Math.pow(scaledT, scalePower + 1);
      let shapeSize = cellSize * shapeScale * scaledT * scaleMult;

      // Source influence: modulate shape size by luminance
      if (sourceInfluence > 0 && sampData) {
        const lum = getSourceLuminance(cx / CW, cy / CH);
        shapeSize *= (1 - sourceInfluence) + sourceInfluence * lum * 2;
      }

      if (shapeSize < 0.5) continue;

      // Mask
      const maskAlpha = getMaskAlpha(cx, cy, maskType, maskBranches, maskRound, maskInner, maskOuter);
      if (maskAlpha < 0.01) continue;

      // Rotation
      const fieldAngle = computeAngle(col, row, tnx, tny, dist, time, angleParams);
      const rotRad = (baseRotation + cellRotation) * Math.PI / 180
        + fieldAngle * angleMult;

      // Color
      const color = getFillColor(dist, colorMode, colors);

      // Draw
      ctx.globalAlpha = maskAlpha;
      const isLine = LINE_SHAPES.has(shapeType);

      if (isLine) {
        ctx.fillStyle = 'transparent';
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, shapeSize * 0.06);
      } else {
        if (renderStyle === 'fill' || renderStyle === 'mixed') {
          ctx.fillStyle = color;
        } else {
          ctx.fillStyle = 'transparent';
        }
        if (renderStyle === 'stroke' || renderStyle === 'mixed') {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'transparent';
        }
      }

      ctx.beginPath();
      drawShape(shapeType, cx, cy, shapeSize, rotRad);
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// --- Loop ---

function loop() {
  render();
  animId = requestAnimationFrame(loop);
}

onChange(() => {
  updateSourceSample();
});

ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, CW, CH);
loop();

// --- Fullscreen & Save ---

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'flake.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
