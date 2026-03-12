import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

// Offscreen for sampling source
const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let colors = ['#ffffff', '#000000'];
let cachedPalette = null;
let animId = null;

const shapeSel = document.getElementById('shape');
const brightnessEl = document.getElementById('brightness');
const contrastEl = document.getElementById('contrast');
const diversityEl = document.getElementById('diversity');
const simplificationEl = document.getElementById('simplification');

// Range displays
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; render(); });
});

// Color swatches
const swatchContainer = document.getElementById('color-swatches');

function parseColor(str) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.fillStyle = str; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function getPalette() {
  if (!cachedPalette) cachedPalette = colors.map(parseColor);
  return cachedPalette;
}

function invalidatePalette() { cachedPalette = null; }

function buildSwatches() {
  swatchContainer.replaceChildren();
  colors.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'color-swatch'; div.style.background = c;
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = c;
    inp.addEventListener('input', () => { colors[i] = inp.value; div.style.background = inp.value; invalidatePalette(); render(); });
    inp.addEventListener('contextmenu', e => { e.preventDefault(); if (colors.length > 1) { colors.splice(i, 1); invalidatePalette(); buildSwatches(); render(); } });
    div.appendChild(inp); swatchContainer.appendChild(div);
  });
  const add = document.createElement('div');
  add.className = 'color-swatch-add'; add.textContent = '+';
  add.addEventListener('click', () => { colors.push(`hsl(${Math.random()*360},60%,50%)`); invalidatePalette(); buildSwatches(); render(); });
  swatchContainer.appendChild(add);
}
buildSwatches();

function getGridSize() {
  const checked = document.querySelector('input[name="grid"]:checked');
  return checked ? +checked.value : 16;
}

document.querySelectorAll('input[name="grid"]').forEach(r => r.addEventListener('change', render));
shapeSel.addEventListener('change', render);

// Shape drawing functions — draw shape centered at (0,0) with given radius
function drawShape(ctx, shape, r, rotation) {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.rotate(rotation);
      ctx.rect(-r, -r, r * 2, r * 2);
      break;
    case 'triangle':
      ctx.rotate(rotation);
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.866, r * 0.5);
      ctx.lineTo(-r * 0.866, r * 0.5);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.rotate(rotation);
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      break;
    case 'line':
      ctx.rotate(rotation);
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      break;
    case 'cross':
      ctx.rotate(rotation);
      const w = r * 0.3;
      ctx.moveTo(-w, -r); ctx.lineTo(w, -r); ctx.lineTo(w, -w);
      ctx.lineTo(r, -w); ctx.lineTo(r, w); ctx.lineTo(w, w);
      ctx.lineTo(w, r); ctx.lineTo(-w, r); ctx.lineTo(-w, w);
      ctx.lineTo(-r, w); ctx.lineTo(-r, -w); ctx.lineTo(-w, -w);
      ctx.closePath();
      break;
    case 'ring':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(r * 0.5, 0);
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2, true);
      break;
    case 'hexagon':
      ctx.rotate(rotation);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        ctx[method](Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      break;
  }
}

function render() {
  if (!mediaSource.ready) return;

  const gridSize = getGridSize();
  const srcW = mediaSource.width;
  const srcH = mediaSource.height;

  // Sample source at grid resolution
  sampCanvas.width = gridSize;
  const gridH = Math.round(gridSize * (srcH / srcW));
  sampCanvas.height = gridH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, gridSize, gridH);
  const sampData = sampCtx.getImageData(0, 0, gridSize, gridH).data;

  // Output at nice resolution
  const outW = Math.min(srcW, 1024);
  const outH = Math.round(outW * (srcH / srcW));
  canvas.width = outW;
  canvas.height = outH;

  const cellW = outW / gridSize;
  const cellH = outH / gridH;
  const bright = +brightnessEl.value * 2.55;
  const cont = +contrastEl.value;
  const f = (259 * (cont + 255)) / (255 * (259 - cont));
  const diversity = +diversityEl.value / 100;
  const simplify = +simplificationEl.value / 100;
  const shape = shapeSel.value;
  const palette = getPalette();
  const usePalette = palette.length > 0;

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outW, outH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const si = (gy * gridSize + gx) * 4;
      let r = sampData[si] + bright;
      let g = sampData[si + 1] + bright;
      let b = sampData[si + 2] + bright;
      r = f * (r - 128) + 128;
      g = f * (g - 128) + 128;
      b = f * (b - 128) + 128;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Shape size based on luminance
      const baseRadius = Math.min(cellW, cellH) * 0.5;
      const sizeT = simplify > 0 ? Math.round(lum * (1 / simplify)) * simplify : lum;
      const radius = baseRadius * Math.max(0.05, sizeT);

      // Rotation from diversity
      const rotation = diversity * (lum - 0.5) * Math.PI;

      // Color
      let fillR, fillG, fillB;
      if (usePalette) {
        const pi = Math.min(palette.length - 1, Math.floor(lum * palette.length));
        const pc = palette[pi];
        fillR = pc[0]; fillG = pc[1]; fillB = pc[2];
      } else {
        fillR = r; fillG = g; fillB = b;
      }

      const cx = gx * cellW + cellW * 0.5;
      const cy = gy * cellH + cellH * 0.5;

      ctx.save();
      ctx.translate(cx, cy);

      if (shape === 'line') {
        ctx.lineWidth = Math.max(1, radius * 0.3);
        ctx.strokeStyle = `rgb(${fillR|0},${fillG|0},${fillB|0})`;
        drawShape(ctx, shape, radius, rotation);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgb(${fillR|0},${fillG|0},${fillB|0})`;
        drawShape(ctx, shape, radius, rotation);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

function loop() {
  if (mediaSource.type !== 'image' && mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}

onChange(() => { render(); if (mediaSource.type !== 'image' && !animId) loop(); });

// Fullscreen
function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'shapes.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
