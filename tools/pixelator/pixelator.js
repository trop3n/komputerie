import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let animId = null;

const pixelSizeEl = document.getElementById('pixel-size');
const styleSel = document.getElementById('style');
const brightnessEl = document.getElementById('brightness');
const contrastEl = document.getElementById('contrast');
const saturationEl = document.getElementById('saturation');
const outlineEl = document.getElementById('outline');

const ASCII_RAMP = ' .:-=+*#%@';

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; render(); });
});
styleSel.addEventListener('change', render);

function render() {
  if (!mediaSource.ready) return;

  const srcW = mediaSource.width;
  const srcH = mediaSource.height;
  const pxSize = +pixelSizeEl.value;
  const style = styleSel.value;
  const bright = +brightnessEl.value * 2.55;
  const cont = +contrastEl.value;
  const sat = 1 + +saturationEl.value / 100;
  const outlineW = +outlineEl.value;
  const f = (259 * (cont + 255)) / (255 * (259 - cont));

  // Sample at pixel grid resolution
  const gridW = Math.ceil(srcW / pxSize);
  const gridH = Math.ceil(srcH / pxSize);
  sampCanvas.width = gridW;
  sampCanvas.height = gridH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, gridW, gridH);
  const sampData = sampCtx.getImageData(0, 0, gridW, gridH).data;

  // Output at original resolution
  const outW = Math.min(srcW, 1024);
  const scale = outW / srcW;
  const outH = Math.round(srcH * scale);
  const cellW = outW / gridW;
  const cellH = outH / gridH;

  canvas.width = outW;
  canvas.height = outH;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outW, outH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const si = (gy * gridW + gx) * 4;
      let r = sampData[si] + bright;
      let g = sampData[si + 1] + bright;
      let b = sampData[si + 2] + bright;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);
      r = Math.max(0, Math.min(255, r)) | 0;
      g = Math.max(0, Math.min(255, g)) | 0;
      b = Math.max(0, Math.min(255, b)) | 0;

      const cx = gx * cellW + cellW * 0.5;
      const cy = gy * cellH + cellH * 0.5;
      const color = `rgb(${r},${g},${b})`;

      if (style === 'square') {
        ctx.fillStyle = color;
        const gap = outlineW;
        ctx.fillRect(gx * cellW + gap, gy * cellH + gap, cellW - gap * 2, cellH - gap * 2);
      } else if (style === 'circle') {
        const radius = Math.min(cellW, cellH) * 0.45;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        if (outlineW > 0) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = outlineW;
          ctx.stroke();
        }
      } else if (style === 'diamond') {
        const hw = cellW * 0.45, hh = cellH * 0.45;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hh);
        ctx.lineTo(cx + hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx - hw, cy);
        ctx.closePath();
        ctx.fill();
        if (outlineW > 0) { ctx.strokeStyle = '#000'; ctx.lineWidth = outlineW; ctx.stroke(); }
      } else if (style === 'cross') {
        const arm = Math.min(cellW, cellH) * 0.4;
        const thick = arm * 0.4;
        ctx.fillStyle = color;
        ctx.fillRect(cx - thick, cy - arm, thick * 2, arm * 2);
        ctx.fillRect(cx - arm, cy - thick, arm * 2, thick * 2);
      } else if (style === 'ascii') {
        const lum = Math.max(0, Math.min(255, gray)) / 255;
        const ci = Math.min(ASCII_RAMP.length - 1, Math.floor(lum * ASCII_RAMP.length));
        const ch = ASCII_RAMP[ci];
        ctx.fillStyle = color;
        ctx.font = `${Math.max(cellH * 0.9, 6)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, cx, cy);
      }
    }
  }
}

function loop() {
  if (mediaSource.type !== 'image' && mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}

onChange(() => { render(); if (mediaSource.type !== 'image' && !animId) loop(); });

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'pixelator.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
