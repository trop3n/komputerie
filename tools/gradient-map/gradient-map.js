import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const app = document.getElementById('app');

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

// Presets
const presets = {
  'custom': null,
  'duotone-blue': ['#0d0221', '#0f4c75'],
  'duotone-orange': ['#1a1a2e', '#e94560'],
  'tritone-sunset': ['#0f0c29', '#302b63', '#ff6e7f'],
  'cyberpunk': ['#0a0a0a', '#ff00ff', '#00ffff', '#ffffff'],
  'infrared': ['#000000', '#8b0000', '#ff4500', '#ffd700', '#ffffff'],
  'sepia': ['#1a0f00', '#704214', '#c49a6c', '#f5e6cc'],
  'cyanotype': ['#001f3f', '#0074D9', '#7FDBFF', '#ffffff'],
  'heatmap': ['#000033', '#0000ff', '#00ff00', '#ffff00', '#ff0000', '#ffffff'],
  'neon-nights': ['#0a0a0a', '#ff006e', '#8338ec', '#3a86ff', '#06d6a0'],
};

let colors = ['#000000', '#ffffff'];
let gradientLUT = null;
let animId = null;

const presetSel = document.getElementById('preset');
const brightnessEl = document.getElementById('brightness');
const contrastEl = document.getElementById('contrast');
const mixEl = document.getElementById('mix');

// Range value display
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) {
    r.addEventListener('input', () => { span.textContent = r.value; render(); });
  }
});

// Color swatches
const swatchContainer = document.getElementById('color-swatches');

function parseColor(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const x = c.getContext('2d');
  x.fillStyle = hex;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function buildLUT() {
  const parsed = colors.map(parseColor);
  if (parsed.length < 2) return;

  gradientLUT = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const segment = t * (parsed.length - 1);
    const idx = Math.min(Math.floor(segment), parsed.length - 2);
    const local = segment - idx;
    const a = parsed[idx], b = parsed[idx + 1];
    gradientLUT[i * 3] = a[0] + (b[0] - a[0]) * local;
    gradientLUT[i * 3 + 1] = a[1] + (b[1] - a[1]) * local;
    gradientLUT[i * 3 + 2] = a[2] + (b[2] - a[2]) * local;
  }
}

function buildSwatches() {
  swatchContainer.replaceChildren();
  colors.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'color-swatch';
    div.style.background = c;
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = c;
    inp.addEventListener('input', () => {
      colors[i] = inp.value;
      div.style.background = inp.value;
      presetSel.value = 'custom';
      buildLUT();
      render();
    });
    inp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (colors.length > 2) { colors.splice(i, 1); buildSwatches(); buildLUT(); render(); }
    });
    div.appendChild(inp);
    swatchContainer.appendChild(div);
  });
  const add = document.createElement('div');
  add.className = 'color-swatch-add';
  add.textContent = '+';
  add.addEventListener('click', () => {
    colors.push(`hsl(${Math.random() * 360}, 60%, 50%)`);
    presetSel.value = 'custom';
    buildSwatches();
    buildLUT();
    render();
  });
  swatchContainer.appendChild(add);
  buildLUT();
}

buildSwatches();

presetSel.addEventListener('change', () => {
  const p = presets[presetSel.value];
  if (p) {
    colors = [...p];
    buildSwatches();
    render();
  }
});

function render() {
  if (!mediaSource.ready || !gradientLUT) return;

  const sw = mediaSource.width;
  const sh = mediaSource.height;
  canvas.width = sw;
  canvas.height = sh;

  ctx.drawImage(mediaSource.drawable, 0, 0, sw, sh);
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const data = imageData.data;

  const bright = +brightnessEl.value;
  const cont = +contrastEl.value;
  const mixAmt = +mixEl.value / 100;
  const f = (259 * (cont + 255)) / (255 * (259 - cont));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    // Luminance
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Brightness + contrast on luminance
    lum += bright * 2.55;
    lum = f * (lum - 128) + 128;
    lum = Math.max(0, Math.min(255, lum)) | 0;

    // Map through gradient LUT
    const mr = gradientLUT[lum * 3];
    const mg = gradientLUT[lum * 3 + 1];
    const mb = gradientLUT[lum * 3 + 2];

    // Mix with original
    data[i] = r + (mr - r) * mixAmt;
    data[i + 1] = g + (mg - g) * mixAmt;
    data[i + 2] = b + (mb - b) * mixAmt;
  }

  ctx.putImageData(imageData, 0, 0);
}

function loop() {
  if (mediaSource.type !== 'image' && mediaSource.ready) {
    render();
  }
  animId = requestAnimationFrame(loop);
}

onChange(() => {
  render();
  if (mediaSource.type !== 'image' && !animId) loop();
});

// Buttons
function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'gradient-map.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  const n = 2 + Math.floor(Math.random() * 4);
  colors = Array.from({ length: n }, () => {
    const h = Math.random() * 360;
    const s = 30 + Math.random() * 70;
    const l = 5 + Math.random() * 85;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }).sort((a, b) => {
    // Sort by perceived lightness
    const lum = c => { const p = parseColor(c); return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; };
    return lum(a) - lum(b);
  });
  presetSel.value = 'custom';
  buildSwatches();
  render();
});
