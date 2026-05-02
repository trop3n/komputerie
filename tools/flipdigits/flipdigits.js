import { createSourceSelector } from '../../js/media-source.js';
import { parseColor } from '../../js/color.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let animId = null;
let currentState = null;  // Float32Array of current dot flip progress (0=off, 1=on)
let targetState = null;   // Uint8Array of target (0 or 1)

const colsEl = document.getElementById('cols');
const rowsEl = document.getElementById('rows');
const flipSpeedEl = document.getElementById('flip-speed');
const dotStyleSel = document.getElementById('dot-style');
const activeColorEl = document.getElementById('active-color');
const thresholdEl = document.getElementById('threshold');

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

colsEl.addEventListener('input', initState);
rowsEl.addEventListener('input', initState);

function initState() {
  const cols = +colsEl.value;
  const rows = +rowsEl.value;
  const len = cols * rows;
  currentState = new Float32Array(len);
  targetState = new Uint8Array(len);
}
initState();

function sampleSource() {
  if (!mediaSource.ready) return;
  const cols = +colsEl.value;
  const rows = +rowsEl.value;
  const thresh = +thresholdEl.value;

  sampCanvas.width = cols;
  sampCanvas.height = rows;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, cols, rows);
  const data = sampCtx.getImageData(0, 0, cols, rows).data;

  for (let i = 0; i < cols * rows; i++) {
    const si = i * 4;
    const lum = data[si] * 0.299 + data[si + 1] * 0.587 + data[si + 2] * 0.114;
    targetState[i] = lum > thresh ? 1 : 0;
  }
}

function parseHexColor(hex) {
  const [r, g, b] = parseColor(hex);
  return { r, g, b };
}

function update() {
  const speed = +flipSpeedEl.value * 0.05;
  const len = currentState.length;
  for (let i = 0; i < len; i++) {
    const target = targetState[i];
    const diff = target - currentState[i];
    if (Math.abs(diff) < 0.01) {
      currentState[i] = target;
    } else {
      currentState[i] += diff * speed;
    }
  }
}

function draw() {
  const cols = +colsEl.value;
  const rows = +rowsEl.value;
  const style = dotStyleSel.value;
  const activeColor = parseHexColor(activeColorEl.value);

  // Size canvas to fill area
  const maxW = 1024;
  const cellSize = Math.min(maxW / cols, 600 / rows);
  const W = Math.round(cols * cellSize);
  const H = Math.round(rows * cellSize);
  canvas.width = W;
  canvas.height = H;

  // Dark housing background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  const dotPad = cellSize * 0.12;
  const dotR = (cellSize - dotPad * 2) * 0.5;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const t = currentState[idx]; // 0 to 1
      const cx = col * cellSize + cellSize * 0.5;
      const cy = row * cellSize + cellSize * 0.5;

      // Interpolate between off color and active color
      const offR = 30, offG = 30, offB = 30;
      const r = (offR + (activeColor.r - offR) * t) | 0;
      const g = (offG + (activeColor.g - offG) * t) | 0;
      const b = (offB + (activeColor.b - offB) * t) | 0;

      if (style === 'flip') {
        // Flip dot: draw as slightly 3D circle with flip animation
        const scaleY = Math.abs(Math.cos(t * Math.PI * 0.5));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, Math.max(0.1, scaleY * 0.3 + 0.7));
        ctx.beginPath();
        ctx.arc(0, 0, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
        // Slight highlight
        if (t > 0.5) {
          ctx.beginPath();
          ctx.arc(-dotR * 0.2, -dotR * 0.2, dotR * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${t * 0.15})`;
          ctx.fill();
        }
        ctx.restore();
      } else if (style === 'round') {
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      } else if (style === 'square') {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2);
      } else if (style === 'led') {
        // LED style with glow
        ctx.beginPath();
        ctx.arc(cx, cy, dotR * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
        if (t > 0.3) {
          ctx.beginPath();
          ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${activeColor.r},${activeColor.g},${activeColor.b},${t * 0.2})`;
          ctx.fill();
        }
      }
    }
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let col = 0; col <= cols; col++) {
    ctx.beginPath();
    ctx.moveTo(col * cellSize, 0);
    ctx.lineTo(col * cellSize, H);
    ctx.stroke();
  }
  for (let row = 0; row <= rows; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * cellSize);
    ctx.lineTo(W, row * cellSize);
    ctx.stroke();
  }
}

function loop() {
  sampleSource();
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

onChange(() => { if (!animId) loop(); });

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'flipdigits.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
