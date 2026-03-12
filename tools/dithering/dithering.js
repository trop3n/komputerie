import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const app = document.getElementById('app');

// Offscreen canvas for downscaled processing
const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

// Source
const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

// State
let colors = ['#000000', '#ffffff'];
let cachedPalette = null;  // cached parsed RGB arrays
let animId = null;
let processing = false;

// Controls
const algSel = document.getElementById('algorithm');
const ditherSize = document.getElementById('dither-size');
const levels = document.getElementById('levels');
const blur = document.getElementById('blur');
const brightness = document.getElementById('brightness');
const contrast = document.getElementById('contrast');
const saturation = document.getElementById('saturation');

// Range value display
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) {
    r.addEventListener('input', () => { span.textContent = r.value; render(); });
  }
});

// Color swatches
const swatchContainer = document.getElementById('color-swatches');

function invalidatePalette() { cachedPalette = null; }

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
      invalidatePalette();
      render();
    });
    inp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (colors.length > 2) { colors.splice(i, 1); invalidatePalette(); buildSwatches(); render(); }
    });
    div.appendChild(inp);
    swatchContainer.appendChild(div);
  });
  const add = document.createElement('div');
  add.className = 'color-swatch-add';
  add.textContent = '+';
  add.addEventListener('click', () => {
    colors.push(`hsl(${Math.random() * 360}, 60%, 50%)`);
    invalidatePalette();
    buildSwatches();
    render();
  });
  swatchContainer.appendChild(add);
}
buildSwatches();

// --- Optimized color parsing (no canvas per call) ---
function parseColor(str) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const x = c.getContext('2d');
  x.fillStyle = str;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function getPalette() {
  if (!cachedPalette) cachedPalette = colors.map(parseColor);
  return cachedPalette;
}

// --- Bayer matrix as flat Float32Array (cached) ---
let bayerCache = null;
let bayerCacheSize = 0;

function getFlatBayer(size) {
  const matSize = Math.max(2, 1 << Math.ceil(Math.log2(size)));
  if (bayerCache && bayerCacheSize === matSize) return { flat: bayerCache, n: matSize };

  // Build Bayer recursively then flatten
  function build(s) {
    if (s === 1) return [[0]];
    const half = build(s / 2);
    const hn = half.length;
    const m = Array.from({ length: s }, () => new Array(s));
    for (let y = 0; y < hn; y++) {
      for (let x = 0; x < hn; x++) {
        const v = half[y][x];
        m[y][x] = 4 * v;
        m[y][x + hn] = 4 * v + 2;
        m[y + hn][x] = 4 * v + 3;
        m[y + hn][x + hn] = 4 * v + 1;
      }
    }
    return m;
  }

  const mat = build(matSize);
  const norm = matSize * matSize;
  const flat = new Float32Array(matSize * matSize);
  for (let y = 0; y < matSize; y++) {
    for (let x = 0; x < matSize; x++) {
      flat[y * matSize + x] = (mat[y][x] + 0.5) / norm - 0.5;
    }
  }
  bayerCache = flat;
  bayerCacheSize = matSize;
  return { flat, n: matSize };
}

// --- Inline nearest color for speed ---
function nearestColorIdx(r, g, b, pal) {
  let minD = Infinity, bi = 0;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i];
    const dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < minD) { minD = d; bi = i; }
  }
  return bi;
}

// Max processing resolution for video — keeps it fast
const MAX_PROCESS_WIDTH = 480;

function render() {
  if (!mediaSource.ready) return;
  if (processing) return;  // skip frame if still processing previous
  processing = true;

  const srcW = mediaSource.width;
  const srcH = mediaSource.height;

  // Downscale for video/camera to keep processing fast
  let procW = srcW, procH = srcH;
  if (mediaSource.type !== 'image' && srcW > MAX_PROCESS_WIDTH) {
    const scale = MAX_PROCESS_WIDTH / srcW;
    procW = Math.round(srcW * scale);
    procH = Math.round(srcH * scale);
  }

  // Process on offscreen canvas at reduced resolution
  offCanvas.width = procW;
  offCanvas.height = procH;
  offCtx.filter = +blur.value > 0 ? `blur(${+blur.value * (procW / srcW)}px)` : 'none';
  offCtx.drawImage(mediaSource.drawable, 0, 0, procW, procH);
  offCtx.filter = 'none';

  const imageData = offCtx.getImageData(0, 0, procW, procH);
  const data = imageData.data;
  const len = data.length;
  const alg = algSel.value;
  const nLevels = +levels.value;
  const dSize = +ditherSize.value;
  const bright = +brightness.value * 2.55;
  const cont = +contrast.value;
  const sat = 1 + +saturation.value / 100;
  const f = (259 * (cont + 255)) / (255 * (259 - cont));
  const palette = getPalette();

  if (alg === 'ordered') {
    const { flat: bayer, n } = getFlatBayer(dSize);
    const threshScale = 256 / nLevels;

    for (let i = 0; i < len; i += 4) {
      const px = (i >> 2) % procW;
      const py = (i >> 2) / procW | 0;

      // Inline adjust
      let r = data[i] + bright, g = data[i + 1] + bright, b = data[i + 2] + bright;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);

      const th = bayer[(py % n) * n + (px % n)] * threshScale;
      r += th; g += th; b += th;

      const ci = nearestColorIdx(r, g, b, palette);
      const pc = palette[ci];
      data[i] = pc[0]; data[i + 1] = pc[1]; data[i + 2] = pc[2];
    }
  } else if (alg === 'floyd-steinberg' || alg === 'atkinson') {
    const errLen = procW * procH * 3;
    const errors = new Float32Array(errLen);
    const isAtkinson = alg === 'atkinson';

    for (let i = 0; i < len; i += 4) {
      const idx = i >> 2;
      const ei = idx * 3;

      let r = data[i] + bright, g = data[i + 1] + bright, b = data[i + 2] + bright;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray) + errors[ei];
      g = gray + sat * (g - gray) + errors[ei + 1];
      b = gray + sat * (b - gray) + errors[ei + 2];

      const ci = nearestColorIdx(r, g, b, palette);
      const pc = palette[ci];
      data[i] = pc[0]; data[i + 1] = pc[1]; data[i + 2] = pc[2];

      const er = r - pc[0], eg = g - pc[1], eb = b - pc[2];
      const x = idx % procW, y = idx / procW | 0;

      if (isAtkinson) {
        // Atkinson: 1/8 to 6 neighbors
        const spread = [[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]];
        for (let s = 0; s < 6; s++) {
          const nx = x + spread[s][0], ny = y + spread[s][1];
          if (nx >= 0 && nx < procW && ny < procH) {
            const ni = (ny * procW + nx) * 3;
            errors[ni] += er * 0.125; errors[ni + 1] += eg * 0.125; errors[ni + 2] += eb * 0.125;
          }
        }
      } else {
        // Floyd-Steinberg
        if (x + 1 < procW) { const ni = ei + 3; errors[ni] += er * 0.4375; errors[ni+1] += eg * 0.4375; errors[ni+2] += eb * 0.4375; }
        const ny = y + 1;
        if (ny < procH) {
          const base = ny * procW * 3;
          if (x > 0) { const ni = base + (x-1)*3; errors[ni] += er * 0.1875; errors[ni+1] += eg * 0.1875; errors[ni+2] += eb * 0.1875; }
          { const ni = base + x*3; errors[ni] += er * 0.3125; errors[ni+1] += eg * 0.3125; errors[ni+2] += eb * 0.3125; }
          if (x+1 < procW) { const ni = base + (x+1)*3; errors[ni] += er * 0.0625; errors[ni+1] += eg * 0.0625; errors[ni+2] += eb * 0.0625; }
        }
      }
    }
  } else if (alg === 'threshold') {
    const step = 255 / (nLevels - 1);
    for (let i = 0; i < len; i += 4) {
      let r = data[i] + bright, g = data[i + 1] + bright, b = data[i + 2] + bright;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);
      r = Math.round(Math.round(r / step) * step);
      g = Math.round(Math.round(g / step) * step);
      b = Math.round(Math.round(b / step) * step);
      const ci = nearestColorIdx(r, g, b, palette);
      const pc = palette[ci];
      data[i] = pc[0]; data[i + 1] = pc[1]; data[i + 2] = pc[2];
    }
  } else if (alg === 'random') {
    const noiseScale = (256 / nLevels) * dSize;
    for (let i = 0; i < len; i += 4) {
      let r = data[i] + bright, g = data[i + 1] + bright, b = data[i + 2] + bright;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);
      const noise = (Math.random() - 0.5) * noiseScale;
      r += noise; g += noise; b += noise;
      const ci = nearestColorIdx(r, g, b, palette);
      const pc = palette[ci];
      data[i] = pc[0]; data[i + 1] = pc[1]; data[i + 2] = pc[2];
    }
  }

  offCtx.putImageData(imageData, 0, 0);

  // Upscale to display canvas (nearest-neighbor for crisp dithered look)
  canvas.width = srcW;
  canvas.height = srcH;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offCanvas, 0, 0, srcW, srcH);

  processing = false;
}

// Animation loop for video/camera sources
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

// Re-render on control changes
[algSel, ditherSize, levels].forEach(el => el.addEventListener('change', () => {
  if (el === ditherSize) bayerCache = null;
  render();
}));

// Buttons
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  app.classList.toggle('fullscreen');
});

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'dithering.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  const n = 2 + Math.floor(Math.random() * 4);
  colors = Array.from({ length: n }, () => {
    const h = Math.random() * 360;
    const s = 30 + Math.random() * 60;
    const l = 10 + Math.random() * 70;
    return `hsl(${h}, ${s}%, ${l}%)`;
  });
  invalidatePalette();
  buildSwatches();
  ditherSize.value = 1 + Math.floor(Math.random() * 8);
  levels.value = 2 + Math.floor(Math.random() * 6);
  bayerCache = null;
  document.querySelector(`.range-value[data-for="dither-size"]`).textContent = ditherSize.value;
  document.querySelector(`.range-value[data-for="levels"]`).textContent = levels.value;
  algSel.selectedIndex = Math.floor(Math.random() * algSel.options.length);
  render();
});
