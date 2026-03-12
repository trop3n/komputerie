import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let particles = [];
let sampData = null;
let sampW = 0, sampH = 0;
let paused = false;
let animId = null;

const flowModeSel = document.getElementById('flow-mode');
const particleCountSel = document.getElementById('particle-count');
const speedEl = document.getElementById('speed');
const particleSizeEl = document.getElementById('particle-size');
const trailEl = document.getElementById('trail');
const turbulenceEl = document.getElementById('turbulence');
const colorModeSel = document.getElementById('color-mode');

// Range displays
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

function sampleSource() {
  if (!mediaSource.ready) return;
  const srcW = mediaSource.width;
  const srcH = mediaSource.height;
  sampW = Math.min(srcW, 480);
  sampH = Math.round(sampW * (srcH / srcW));
  sampCanvas.width = sampW;
  sampCanvas.height = sampH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, sampW, sampH);
  sampData = sampCtx.getImageData(0, 0, sampW, sampH).data;

  canvas.width = sampW;
  canvas.height = sampH;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, sampW, sampH);
}

function getLuminance(x, y) {
  if (!sampData) return 0;
  const px = Math.max(0, Math.min(sampW - 1, x | 0));
  const py = Math.max(0, Math.min(sampH - 1, y | 0));
  const i = (py * sampW + px) * 4;
  return (sampData[i] * 0.299 + sampData[i + 1] * 0.587 + sampData[i + 2] * 0.114) / 255;
}

function getSourceColor(x, y) {
  if (!sampData) return [255, 255, 255];
  const px = Math.max(0, Math.min(sampW - 1, x | 0));
  const py = Math.max(0, Math.min(sampH - 1, y | 0));
  const i = (py * sampW + px) * 4;
  return [sampData[i], sampData[i + 1], sampData[i + 2]];
}

function getGradient(x, y) {
  const dx = getLuminance(x + 1, y) - getLuminance(x - 1, y);
  const dy = getLuminance(x, y + 1) - getLuminance(x, y - 1);
  return { dx, dy };
}

function initParticles() {
  const count = +particleCountSel.value;
  particles = new Array(count);
  for (let i = 0; i < count; i++) {
    particles[i] = {
      x: Math.random() * sampW,
      y: Math.random() * sampH,
      vx: 0,
      vy: 0,
      life: Math.random() * 100,
    };
  }
}

function resetParticle(p) {
  p.x = Math.random() * sampW;
  p.y = Math.random() * sampH;
  p.vx = 0;
  p.vy = 0;
  p.life = 0;
}

function step() {
  const speed = +speedEl.value;
  const turb = +turbulenceEl.value / 100;
  const mode = flowModeSel.value;
  const time = performance.now() * 0.001;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const lum = getLuminance(p.x, p.y);
    let fx = 0, fy = 0;

    switch (mode) {
      case 'luminance': {
        const grad = getGradient(p.x, p.y);
        fx = grad.dx * 5;
        fy = grad.dy * 5;
        break;
      }
      case 'edge': {
        const grad = getGradient(p.x, p.y);
        // Flow perpendicular to gradient (along edges)
        fx = -grad.dy * 8;
        fy = grad.dx * 8;
        break;
      }
      case 'wind': {
        fx = (1 - lum) * 3 + 0.5;
        fy = Math.sin(p.x * 0.05 + time) * lum * 2;
        break;
      }
      case 'gravity': {
        fx = 0;
        fy = (1 - lum) * 3;
        fx += Math.sin(p.y * 0.03 + time * 0.5) * lum;
        break;
      }
      case 'spiral': {
        const cx = sampW * 0.5, cy = sampH * 0.5;
        const dx = p.x - cx, dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const angle = Math.atan2(dy, dx);
        fx = Math.cos(angle + 1.2) * lum * 3 - dx / dist * 0.5;
        fy = Math.sin(angle + 1.2) * lum * 3 - dy / dist * 0.5;
        break;
      }
      case 'explode': {
        const cx = sampW * 0.5, cy = sampH * 0.5;
        const dx = p.x - cx, dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        fx = (dx / dist) * lum * 3;
        fy = (dy / dist) * lum * 3;
        break;
      }
    }

    // Turbulence
    fx += (Math.random() - 0.5) * turb * 4;
    fy += (Math.random() - 0.5) * turb * 4;

    p.vx = p.vx * 0.9 + fx * speed * 0.1;
    p.vy = p.vy * 0.9 + fy * speed * 0.1;
    p.x += p.vx;
    p.y += p.vy;
    p.life++;

    // Reset if out of bounds or old
    if (p.x < -10 || p.x > sampW + 10 || p.y < -10 || p.y > sampH + 10 || p.life > 300) {
      resetParticle(p);
    }
  }
}

function draw() {
  // Trail fade
  const trailAlpha = 1 - +trailEl.value / 100;
  ctx.fillStyle = `rgba(0,0,0,${trailAlpha})`;
  ctx.fillRect(0, 0, sampW, sampH);

  const pSize = +particleSizeEl.value;
  const colorMode = colorModeSel.value;
  const time = performance.now() * 0.001;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let r, g, b;

    switch (colorMode) {
      case 'source': {
        const c = getSourceColor(p.x, p.y);
        r = c[0]; g = c[1]; b = c[2];
        break;
      }
      case 'velocity': {
        const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const t = Math.min(1, v / 3);
        r = t * 255;
        g = (1 - Math.abs(t - 0.5) * 2) * 255;
        b = (1 - t) * 255;
        break;
      }
      case 'white':
        r = g = b = 255;
        break;
      case 'rainbow': {
        const hue = ((p.x / sampW + p.y / sampH + time * 0.1) % 1) * 6;
        const s = Math.floor(hue), frac = hue - s;
        switch (s % 6) {
          case 0: r = 255; g = frac * 255; b = 0; break;
          case 1: r = (1-frac)*255; g = 255; b = 0; break;
          case 2: r = 0; g = 255; b = frac*255; break;
          case 3: r = 0; g = (1-frac)*255; b = 255; break;
          case 4: r = frac*255; g = 0; b = 255; break;
          case 5: r = 255; g = 0; b = (1-frac)*255; break;
        }
        break;
      }
    }

    // Fade in young particles
    const alpha = Math.min(1, p.life / 10);
    ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha})`;
    ctx.fillRect(p.x - pSize * 0.5, p.y - pSize * 0.5, pSize, pSize);
  }
}

function loop() {
  if (!paused && sampData) {
    // Re-sample for video/camera sources
    if (mediaSource.type !== 'image' && mediaSource.ready) {
      sampCtx.drawImage(mediaSource.drawable, 0, 0, sampW, sampH);
      sampData = sampCtx.getImageData(0, 0, sampW, sampH).data;
    }
    step();
    draw();
  }
  animId = requestAnimationFrame(loop);
}

onChange(() => {
  sampleSource();
  initParticles();
  if (!animId) loop();
});

particleCountSel.addEventListener('change', () => { initParticles(); });

// Buttons
document.getElementById('btn-reset').addEventListener('click', () => {
  sampleSource();
  initParticles();
});

document.getElementById('btn-pause').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('btn-pause').textContent = paused ? 'Play' : 'Pause';
});

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'pixel-flow.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
