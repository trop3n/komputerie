import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let colors = ['#ffffff'];
let cachedPalette = null;
let animId = null;
let glitchActive = false;
let colorizeActive = false;

const textSourceSel = document.getElementById('text-source');
const customTextEl = document.getElementById('custom-text');
const customTextGroup = document.getElementById('custom-text-group');
const fontSizeEl = document.getElementById('font-size');
const saturationEl = document.getElementById('saturation');
const brightnessEl = document.getElementById('brightness');
const contrastEl = document.getElementById('contrast');

// Range displays
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; render(); });
});

// Text source visibility
textSourceSel.addEventListener('change', () => {
  customTextGroup.style.display = textSourceSel.value === 'custom' ? '' : 'none';
  render();
});
customTextEl.addEventListener('input', render);

// Color swatches
const swatchContainer = document.getElementById('color-swatches');
function parseColor(str) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.fillStyle = str; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}
function invalidatePalette() { cachedPalette = null; }
function getPalette() { if (!cachedPalette) cachedPalette = colors.map(parseColor); return cachedPalette; }

function buildSwatches() {
  swatchContainer.replaceChildren();
  colors.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'color-swatch'; div.style.background = c;
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = c;
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

// Text generators
const loremWords = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
function generateText(mode) {
  switch (mode) {
    case 'custom': return customTextEl.value || 'Hello World';
    case 'lorem': {
      let s = '';
      for (let i = 0; i < 500; i++) s += loremWords[Math.floor(Math.random() * loremWords.length)] + ' ';
      return s;
    }
    case 'binary': {
      let s = '';
      for (let i = 0; i < 2000; i++) s += Math.random() > 0.5 ? '1' : '0';
      return s;
    }
    case 'hex': {
      let s = '';
      for (let i = 0; i < 1000; i++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
    case 'alphabet': {
      let s = '';
      for (let i = 0; i < 500; i++) s += String.fromCharCode(65 + Math.floor(Math.random() * 26));
      return s;
    }
    default: return 'Hello World';
  }
}

let cachedText = '';
let lastTextMode = '';

function getText() {
  const mode = textSourceSel.value;
  if (mode === 'custom') return customTextEl.value || 'Hello World';
  if (mode !== lastTextMode) { cachedText = generateText(mode); lastTextMode = mode; }
  return cachedText;
}

function render() {
  if (!mediaSource.ready) return;

  const srcW = mediaSource.width;
  const srcH = mediaSource.height;

  // Sample source
  const procW = Math.min(srcW, 640);
  const procH = Math.round(procW * (srcH / srcW));
  sampCanvas.width = procW;
  sampCanvas.height = procH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, procW, procH);
  const sampData = sampCtx.getImageData(0, 0, procW, procH).data;

  canvas.width = procW;
  canvas.height = procH;

  const fontSize = +fontSizeEl.value;
  const bright = +brightnessEl.value * 2.55;
  const cont = +contrastEl.value;
  const sat = 1 + +saturationEl.value / 100;
  const f = (259 * (cont + 255)) / (255 * (259 - cont));
  const palette = getPalette();

  // Fill background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, procW, procH);

  // Render text fill
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';

  const text = getText();
  const charW = ctx.measureText('M').width;
  const lineH = fontSize * 1.1;
  const cols = Math.ceil(procW / charW) + 1;
  const rows = Math.ceil(procH / lineH) + 1;

  let charIdx = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = text[charIdx % text.length];
      charIdx++;

      const px = Math.min(procW - 1, Math.floor(col * charW + charW * 0.5));
      const py = Math.min(procH - 1, Math.floor(row * lineH + lineH * 0.5));
      const si = (py * procW + px) * 4;

      let r = sampData[si] + bright;
      let g = sampData[si + 1] + bright;
      let b = sampData[si + 2] + bright;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);

      if (colorizeActive && palette.length > 0) {
        const lum = Math.max(0, Math.min(255, gray)) / 255;
        const pi = Math.min(palette.length - 1, Math.floor(lum * palette.length));
        const pc = palette[pi];
        r = pc[0]; g = pc[1]; b = pc[2];
      }

      r = Math.max(0, Math.min(255, r)) | 0;
      g = Math.max(0, Math.min(255, g)) | 0;
      b = Math.max(0, Math.min(255, b)) | 0;

      const x = col * charW;
      const y = row * lineH;

      // Glitch: randomly offset some characters
      let ox = 0, oy = 0;
      if (glitchActive && Math.random() < 0.02) {
        ox = (Math.random() - 0.5) * fontSize * 2;
        oy = (Math.random() - 0.5) * fontSize * 0.5;
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(ch, x + ox, y + oy);
    }
  }

  // Glitch scanlines
  if (glitchActive) {
    for (let i = 0; i < 5; i++) {
      const y = Math.floor(Math.random() * procH);
      const h = 1 + Math.floor(Math.random() * 3);
      const shift = Math.floor((Math.random() - 0.5) * 40);
      const strip = ctx.getImageData(0, y, procW, h);
      ctx.putImageData(strip, shift, y);
    }
  }
}

function loop() {
  if (mediaSource.type !== 'image' && mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}

onChange(() => { render(); if (mediaSource.type !== 'image' && !animId) loop(); });

// Effect toggles
document.getElementById('btn-glitch').addEventListener('click', function() {
  glitchActive = !glitchActive;
  this.style.background = glitchActive ? 'var(--border)' : '';
  render();
});

document.getElementById('btn-colorize').addEventListener('click', function() {
  colorizeActive = !colorizeActive;
  this.style.background = colorizeActive ? 'var(--border)' : '';
  render();
});

// Fullscreen
function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'text.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
