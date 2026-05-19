import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

let CW = 800, CH = 600;
canvas.width = CW;
canvas.height = CH;

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'), { transition: canvas });

// --- Vec2 ---

class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vec2(this.x * s, this.y * s); }
  mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  normalize() { const m = this.mag(); return m > 0 ? this.scale(1 / m) : new Vec2(); }
  limit(max) { const m = this.mag(); return m > max ? this.normalize().scale(max) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  static random() { const a = Math.random() * Math.PI * 2; return new Vec2(Math.cos(a), Math.sin(a)); }
  static fromAngle(a) { return new Vec2(Math.cos(a), Math.sin(a)); }
  addMut(v) { this.x += v.x; this.y += v.y; return this; }
  subMut(v) { this.x -= v.x; this.y -= v.y; return this; }
  scaleMut(s) { this.x *= s; this.y *= s; return this; }
  normalizeMut() { const m = this.mag(); if (m > 0) { this.x /= m; this.y /= m; } return this; }
  limitMut(max) { const m = this.mag(); if (m > max) { this.normalizeMut().scaleMut(max); } return this; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vec2(this.x, this.y); }
}

// --- Flow field (from media source) ---

let flowField = null;
let flowW = 0, flowH = 0;
let flowCounter = 0;

function getLum(data, x, y, w) {
  const i = (y * w + x) * 4;
  return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
}

function updateFlowField() {
  if (!mediaSource.ready) { flowField = null; return; }
  const fw = 80;
  const fh = Math.round(fw * mediaSource.height / mediaSource.width) || 60;
  if (sampCanvas.width !== fw || sampCanvas.height !== fh) {
    sampCanvas.width = fw;
    sampCanvas.height = fh;
  }
  sampCtx.drawImage(mediaSource.drawable, 0, 0, fw, fh);
  const data = sampCtx.getImageData(0, 0, fw, fh).data;

  flowW = fw;
  flowH = fh;
  flowField = new Float32Array(fw * fh);

  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const lx = x > 0 ? getLum(data, x - 1, y, fw) : getLum(data, x, y, fw);
      const rx = x < fw - 1 ? getLum(data, x + 1, y, fw) : getLum(data, x, y, fw);
      const ly = y > 0 ? getLum(data, x, y - 1, fw) : getLum(data, x, y, fw);
      const ry = y < fh - 1 ? getLum(data, x, y + 1, fw) : getLum(data, x, y, fw);
      // Perpendicular to gradient → follows contours
      flowField[y * fw + x] = Math.atan2(-(rx - lx), ry - ly);
    }
  }
}

function getFlowAngle(bx, by) {
  if (!flowField) return null;
  const gx = Math.min(flowW - 1, Math.max(0, Math.floor(bx / CW * flowW)));
  const gy = Math.min(flowH - 1, Math.max(0, Math.floor(by / CH * flowH)));
  return flowField[gy * flowW + gx];
}

// --- Boid ---

class Boid {
  constructor(x, y, index) {
    this.pos = new Vec2(x, y);
    this.vel = Vec2.random().scale(1.5 + Math.random() * 2);
    this.acc = new Vec2();
    this.index = index;
  }

  separation(neighbors, radius, maxSpeed, maxForce) {
    const steer = new Vec2();
    const scratch = new Vec2();
    let count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      const dx = this.pos.x - other.pos.x, dy = this.pos.y - other.pos.y;
      const dSq = dx * dx + dy * dy;
      if (dSq > 0 && dSq < radius * radius) {
        scratch.set(dx / dSq, dy / dSq);
        steer.addMut(scratch);
        count++;
      }
    }
    }
    if (count === 0) return new Vec2();
    return steer.scaleMut(1 / count).normalizeMut().scaleMut(maxSpeed).subMut(this.vel).limitMut(maxForce).copy();
  }

  alignment(neighbors, radius, maxSpeed, maxForce) {
    const sum = new Vec2();
    let count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      const dx = this.pos.x - other.pos.x, dy = this.pos.y - other.pos.y;
      if (dx * dx + dy * dy < radius * radius) {
        sum.addMut(other.vel);
        count++;
      }
    }
    if (count === 0) return new Vec2();
    return sum.scaleMut(1 / count).normalizeMut().scaleMut(maxSpeed).subMut(this.vel).limitMut(maxForce).copy();
  }

  cohesion(neighbors, radius, maxSpeed, maxForce) {
    const sum = new Vec2();
    let count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      const dx = this.pos.x - other.pos.x, dy = this.pos.y - other.pos.y;
      if (dx * dx + dy * dy < radius * radius) {
        sum.addMut(other.pos);
        count++;
      }
    }
    if (count === 0) return new Vec2();
    const target = sum.scaleMut(1 / count);
    return target.subMut(this.pos).normalizeMut().scaleMut(maxSpeed).subMut(this.vel).limitMut(maxForce).copy();
  }

  update(neighbors, p) {
    const sep = this.separation(neighbors, p.sepR, p.maxSpeed, p.maxForce).scaleMut(p.sepW);
    const ali = this.alignment(neighbors, p.alignR, p.maxSpeed, p.maxForce).scaleMut(p.alignW);
    const coh = this.cohesion(neighbors, p.cohR, p.maxSpeed, p.maxForce).scaleMut(p.cohW);
    this.acc.set(0, 0).addMut(sep).addMut(ali).addMut(coh);

    if (p.sourceInfluence > 0) {
      const angle = getFlowAngle(this.pos.x, this.pos.y);
      if (angle !== null) {
        const flow = Vec2.fromAngle(angle).scaleMut(p.maxSpeed).subMut(this.vel).limitMut(p.maxForce).scaleMut(p.sourceInfluence);
        this.acc.addMut(flow);
      }
    }

    this.vel.addMut(this.acc).limitMut(p.maxSpeed);
    if (this.vel.mag() < p.minSpeed) {
      if (this.vel.mag() > 0) {
        this.vel.normalizeMut().scaleMut(p.minSpeed);
      } else {
        const r = Vec2.fromAngle(Math.random() * Math.PI * 2).scaleMut(p.minSpeed);
        this.vel.set(r.x, r.y);
      }
    }
    this.pos.addMut(this.vel);
  }

  handleBoundary(w, h, mode) {
    if (mode === 'wrap') {
      if (this.pos.x > w) this.pos.x = 0;
      if (this.pos.x < 0) this.pos.x = w;
      if (this.pos.y > h) this.pos.y = 0;
      if (this.pos.y < 0) this.pos.y = h;
    } else if (mode === 'bounce') {
      if (this.pos.x <= 0 || this.pos.x >= w) {
        this.vel.x = -this.vel.x;
        this.pos.x = Math.max(0, Math.min(w, this.pos.x));
      }
      if (this.pos.y <= 0 || this.pos.y >= h) {
        this.vel.y = -this.vel.y;
        this.pos.y = Math.max(0, Math.min(h, this.pos.y));
      }
    } else if (mode === 'avoid') {
      const margin = 60, turn = 0.4;
      if (this.pos.x < margin) this.vel.x += turn;
      if (this.pos.x > w - margin) this.vel.x -= turn;
      if (this.pos.y < margin) this.vel.y += turn;
      if (this.pos.y > h - margin) this.vel.y -= turn;
    }
  }

  draw(ctx, color, size, shape, opacity) {
    const angle = this.vel.heading();
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.globalAlpha = opacity;

    if (shape === 'triangle') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size * 0.5, size * 0.6);
      ctx.lineTo(size * 0.5, size * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'circle') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'line') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size * 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// --- Flock management ---

let boids = [];

function resizeFlock(count) {
  const current = boids.length;
  if (count > current) {
    for (let i = current; i < count; i++) {
      boids.push(new Boid(Math.random() * CW, Math.random() * CH, i));
    }
  } else if (count < current) {
    boids.length = count;
  }
  boids.forEach((b, i) => { b.index = i; });
}

function scatterFlock() {
  for (const b of boids) {
    b.pos.x = Math.random() * CW;
    b.pos.y = Math.random() * CH;
  }
  // Clear trails
  ctx.fillStyle = els.background.value;
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, CW, CH);
}

// --- Element refs ---

const els = {
  sourceInfluence: document.getElementById('source-influence'),
  count: document.getElementById('count'),
  sepR: document.getElementById('sep-r'),
  sepW: document.getElementById('sep-w'),
  alignR: document.getElementById('align-r'),
  alignW: document.getElementById('align-w'),
  cohR: document.getElementById('coh-r'),
  cohW: document.getElementById('coh-w'),
  maxSpeed: document.getElementById('max-speed'),
  minSpeed: document.getElementById('min-speed'),
  maxForce: document.getElementById('max-force'),
  boidSize: document.getElementById('boid-size'),
  trail: document.getElementById('trail'),
  opacity: document.getElementById('opacity'),
  hueStart: document.getElementById('hue-start'),
  hueRange: document.getElementById('hue-range'),
  saturation: document.getElementById('saturation'),
  lightness: document.getElementById('lightness'),
  uniformColor: document.getElementById('uniform-color'),
  background: document.getElementById('background'),
};

function getRadio(id) { return document.querySelector(`#${id} input:checked`)?.value; }

// --- UI wiring ---

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

// Color mode toggle
document.querySelectorAll('#color-mode-radios input').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('uniform-color-group').style.display = r.value === 'uniform' ? '' : 'none';
    document.getElementById('hsl-controls').style.display = r.value === 'uniform' ? 'none' : '';
  });
});

document.getElementById('btn-scatter').addEventListener('click', scatterFlock);

// --- Color ---

function getBoidColor(boid) {
  const mode = getRadio('color-mode-radios') || 'velocity';
  if (mode === 'uniform') return els.uniformColor.value;

  const hueStart = +els.hueStart.value;
  const hueRange = +els.hueRange.value;
  const sat = +els.saturation.value;
  const lit = +els.lightness.value;
  const maxSpeed = +els.maxSpeed.value;
  let t;

  if (mode === 'velocity') {
    t = Math.min(boid.vel.mag() / maxSpeed, 1);
  } else if (mode === 'heading') {
    t = (boid.vel.heading() + Math.PI) / (2 * Math.PI);
  } else {
    t = boids.length > 1 ? boid.index / (boids.length - 1) : 0;
  }

  const hue = (hueStart + t * hueRange) % 360;
  return `hsl(${hue},${sat}%,${lit}%)`;
}

// --- Render ---

function render() {
  // Resize flock if needed
  const targetCount = +els.count.value;
  if (boids.length !== targetCount) resizeFlock(targetCount);

  // Trail: semi-transparent background fill
  const trailAlpha = +els.trail.value / 255;
  ctx.globalAlpha = trailAlpha;
  ctx.fillStyle = els.background.value;
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = 1;

  // Update flow field periodically for video/camera
  if (mediaSource.ready && mediaSource.type !== 'image') {
    flowCounter++;
    if (flowCounter % 10 === 0) updateFlowField();
  }

  // Read params
  const p = {
    sepR: +els.sepR.value,
    sepW: +els.sepW.value,
    alignR: +els.alignR.value,
    alignW: +els.alignW.value,
    cohR: +els.cohR.value,
    cohW: +els.cohW.value,
    maxSpeed: +els.maxSpeed.value,
    minSpeed: +els.minSpeed.value,
    maxForce: +els.maxForce.value,
    sourceInfluence: +els.sourceInfluence.value,
  };

  const boundary = getRadio('boundary-radios') || 'wrap';
  const shape = getRadio('shape-radios') || 'triangle';
  const size = +els.boidSize.value;
  const opacity = +els.opacity.value / 100;

  // Update & draw
  for (const boid of boids) {
    boid.update(boids, p);
    boid.handleBoundary(CW, CH, boundary);
    boid.vel.limitMut(p.maxSpeed);
  }

  for (const boid of boids) {
    const color = getBoidColor(boid);
    boid.draw(ctx, color, size, shape, opacity);
  }
}

// --- Loop ---

let animId = null;
function loop() {
  render();
  animId = requestAnimationFrame(loop);
}

// --- Init ---
resizeFlock(150);
ctx.fillStyle = '#050505';
ctx.fillRect(0, 0, CW, CH);
loop();

onChange(() => {
  updateFlowField();
  if (mediaSource.ready) {
    const ratio = mediaSource.width / mediaSource.height;
    if (ratio >= 1) { CW = 800; CH = Math.max(200, Math.round(800 / ratio)); }
    else { CH = 800; CW = Math.max(200, Math.round(800 * ratio)); }
    canvas.width = CW;
    canvas.height = CH;
    scatterFlock();
  }
});

// --- Fullscreen & Save ---

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  canvas.toBlob(blob => {
    const link = document.createElement('a');
    link.download = 'boids.png';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
});
