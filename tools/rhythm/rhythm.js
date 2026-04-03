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

// --- Simplex noise (2D/3D) ---

const PERM = new Uint8Array(512);
const GRAD3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

(function seedNoise() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function dot3(g, x, y, z) { return g[0] * x + g[1] * y + g[2] * z; }
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

function noise3D(xin, yin, zin) {
  const F3 = 1 / 3, G3 = 1 / 6;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
    else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
    else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
  } else {
    if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
    else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
    else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
  }
  const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
  const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
  const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
  const ii=i&255,jj=j&255,kk=k&255;
  let n0=0,n1=0,n2=0,n3=0;
  let t0=0.6-x0*x0-y0*y0-z0*z0;
  if(t0>0){t0*=t0;n0=t0*t0*dot3(GRAD3[PERM[ii+PERM[jj+PERM[kk]]]%12],x0,y0,z0);}
  let t1=0.6-x1*x1-y1*y1-z1*z1;
  if(t1>0){t1*=t1;n1=t1*t1*dot3(GRAD3[PERM[ii+i1+PERM[jj+j1+PERM[kk+k1]]]%12],x1,y1,z1);}
  let t2=0.6-x2*x2-y2*y2-z2*z2;
  if(t2>0){t2*=t2;n2=t2*t2*dot3(GRAD3[PERM[ii+i2+PERM[jj+j2+PERM[kk+k2]]]%12],x2,y2,z2);}
  let t3=0.6-x3*x3-y3*y3-z3*z3;
  if(t3>0){t3*=t3;n3=t3*t3*dot3(GRAD3[PERM[ii+1+PERM[jj+1+PERM[kk+1]]]%12],x3,y3,z3);}
  return 32*(n0+n1+n2+n3);
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

// --- Waveform functions ---

function getNoiseWave(x, phase, time, amplitude) {
  const noiseScale = 0.005;
  const octaves = 3;
  let value = 0, amp = 1, freq = noiseScale, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise3D(x * freq, phase, time) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return (value / total) * amplitude;
}

function getSineWave(x, phase, frequency, amplitude) {
  return Math.sin(x * frequency + phase) * amplitude;
}

function getSquareWave(x, phase, frequency, amplitude) {
  return (Math.sin(x * frequency + phase) >= 0 ? 1 : -1) * amplitude;
}

function getSawtoothWave(x, phase, frequency, amplitude) {
  const period = 2 * Math.PI / frequency;
  const pos = ((x + phase / frequency) % period + period) % period;
  return ((pos / period) * 2 - 1) * amplitude;
}

function getTriangleWave(x, phase, frequency, amplitude) {
  const period = 2 * Math.PI / frequency;
  const pos = ((x + phase / frequency) % period + period) % period;
  const norm = (pos / period) * 2 - 1;
  return (Math.abs(norm) * 2 - 1) * amplitude;
}

// --- Element refs ---

const els = {
  sourceInfluence: document.getElementById('source-influence'),
  lineCount: document.getElementById('line-count'),
  spacing: document.getElementById('spacing'),
  amplitude: document.getElementById('amplitude'),
  frequency: document.getElementById('frequency'),
  speed: document.getElementById('speed'),
  phaseOffset: document.getElementById('phase-offset'),
  strokeWeight: document.getElementById('stroke-weight'),
  strokeOpacity: document.getElementById('stroke-opacity'),
  hueStart: document.getElementById('hue-start'),
  hueRange: document.getElementById('hue-range'),
  saturation: document.getElementById('saturation'),
  lightness: document.getElementById('lightness'),
  cycleSpeed: document.getElementById('cycle-speed'),
  background: document.getElementById('background'),
};

function getRadio(id) { return document.querySelector(`#${id} input:checked`)?.value; }

// --- UI wiring ---

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

// --- Color ---

function getLineColor(index, totalLines, time) {
  const hueStart = +els.hueStart.value;
  const hueRange = +els.hueRange.value;
  const sat = +els.saturation.value;
  const lit = +els.lightness.value;
  const gradMode = getRadio('gradient-radios') || 'linear';
  const cycleOn = getRadio('cycle-radios') === 'on';
  const cycleSpeed = +els.cycleSpeed.value;

  let t;
  if (gradMode === 'linear') {
    t = totalLines > 1 ? index / (totalLines - 1) : 0;
  } else if (gradMode === 'radial') {
    t = Math.abs(index - totalLines / 2) / (totalLines / 2);
  } else {
    t = Math.sin(index * 0.5 + time * cycleSpeed) * 0.5 + 0.5;
  }

  let hue = (hueStart + t * hueRange) % 360;
  if (cycleOn) {
    hue = (hue + time * cycleSpeed * 60) % 360;
  }

  return `hsl(${hue},${sat}%,${lit}%)`;
}

// --- Render ---

let sourceUpdateCounter = 0;

function render() {
  currentTime += (+els.speed.value) * 0.016;

  // Update source for video/camera
  if (mediaSource.ready && mediaSource.type !== 'image') {
    sourceUpdateCounter++;
    if (sourceUpdateCounter % 5 === 0) updateSourceSample();
  }

  const bg = els.background.value;
  const lineCount = +els.lineCount.value;
  const spacing = +els.spacing.value;
  const amplitude = +els.amplitude.value;
  const frequency = +els.frequency.value;
  const speed = +els.speed.value;
  const phaseOffset = +els.phaseOffset.value;
  const strokeWeight = +els.strokeWeight.value;
  const strokeOpacity = +els.strokeOpacity.value / 100;
  const cap = getRadio('cap-radios') || 'round';
  const waveMode = getRadio('wave-mode-radios') || 'noise';
  const sourceInfluence = +els.sourceInfluence.value / 100;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  const startY = (CH - (lineCount - 1) * spacing) / 2;
  ctx.lineCap = cap;

  for (let i = 0; i < lineCount; i++) {
    const baseY = startY + i * spacing;
    const phase = i * phaseOffset + currentTime * speed;
    const color = getLineColor(i, lineCount, currentTime);

    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWeight;
    ctx.globalAlpha = strokeOpacity;
    ctx.beginPath();

    for (let x = 0; x <= CW; x += 2) {
      let value;
      if (waveMode === 'noise') {
        value = getNoiseWave(x, phase, currentTime * speed, amplitude);
      } else if (waveMode === 'sine') {
        value = getSineWave(x, phase, frequency, amplitude);
      } else if (waveMode === 'square') {
        value = getSquareWave(x, phase, frequency, amplitude);
      } else if (waveMode === 'sawtooth') {
        value = getSawtoothWave(x, phase, frequency, amplitude);
      } else {
        value = getTriangleWave(x, phase, frequency, amplitude);
      }

      // Source influence: modulate amplitude by luminance
      if (sourceInfluence > 0 && sampData) {
        const lum = getSourceLuminance(x / CW, (baseY + value) / CH);
        value *= (1 - sourceInfluence) + sourceInfluence * lum * 2;
      }

      const y = baseY + value;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

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

ctx.fillStyle = '#050505';
ctx.fillRect(0, 0, CW, CH);
loop();

// --- Fullscreen & Save ---

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'rhythm.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
