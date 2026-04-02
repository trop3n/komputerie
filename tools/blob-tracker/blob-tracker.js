import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

// --- State ---
let animId = null;
let backgroundFrame = null;
let trackedBlobs = [];
let nextBlobId = 1;
let lastFrameTime = performance.now();
let fpsSmooth = 0;
let frameNum = 0;
const trails = new Map();

// --- Font cache ---
let _mono;
function mono() {
  if (!_mono) _mono = getComputedStyle(document.body).getPropertyValue('--mono').trim() || 'monospace';
  return _mono;
}

function colorWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// --- Element refs ---
const els = {
  threshold: document.getElementById('threshold'),
  blur: document.getElementById('blur'),
  minArea: document.getElementById('min-area'),
  maxBlobs: document.getElementById('max-blobs'),
  brightness: document.getElementById('brightness'),
  contrast: document.getElementById('contrast'),
  hueCenter: document.getElementById('hue-center'),
  hueRange: document.getElementById('hue-range'),
  satMin: document.getElementById('sat-min'),
  smoothing: document.getElementById('smoothing'),
  trailLength: document.getElementById('trail-length'),
  thickness: document.getElementById('thickness'),
  fillOpacity: document.getElementById('fill-opacity'),
  blobCount: document.getElementById('blob-count'),
  fpsDisplay: document.getElementById('fps-display'),
  colorControls: document.getElementById('color-controls'),
  hueRangeGroup: document.getElementById('hue-range-group'),
  satMinGroup: document.getElementById('sat-min-group'),
  bgControls: document.getElementById('bg-controls'),
};

// --- Helpers ---
function getRadio(id) { return document.querySelector(`#${id} input:checked`)?.value; }
function getMode() { return getRadio('mode-radios') || 'threshold'; }
function getDisplay() { return getRadio('display-radios') || 'overlay'; }
function getInvert() { return getRadio('invert-radios') === 'on'; }
function getConnections() { return getRadio('connections-radios') === 'on'; }
function getLabels() { return getRadio('labels-radios') === 'on'; }
function getMetrics() { return getRadio('metrics-radios') === 'on'; }
function getGrid() { return getRadio('grid-radios') === 'on'; }
function getBoxStyle() { return getRadio('box-style-radios') || 'brackets'; }
function getDotted() { return getRadio('dotted-radios') === 'on'; }

// --- Tab switching ---
document.querySelectorAll('#tab-radios input').forEach(r => {
  r.addEventListener('change', () => {
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === r.value);
    });
  });
});

// --- Event wiring ---
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

document.querySelectorAll('#mode-radios input').forEach(r => {
  r.addEventListener('change', () => {
    const isColor = r.value === 'color';
    const isBgSub = r.value === 'bg-sub';
    els.colorControls.style.display = isColor ? '' : 'none';
    els.hueRangeGroup.style.display = isColor ? '' : 'none';
    els.satMinGroup.style.display = isColor ? '' : 'none';
    els.bgControls.style.display = isBgSub ? '' : 'none';
  });
});

document.getElementById('btn-capture-bg').addEventListener('click', () => {
  if (!mediaSource.ready) return;
  const w = sampCanvas.width, h = sampCanvas.height;
  if (w === 0 || h === 0) return;
  backgroundFrame = sampCtx.getImageData(0, 0, w, h);
});

// --- Detection functions ---

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function applyBlur(data, w, h, radius) {
  if (radius <= 0) return data;
  const src = new Uint8ClampedArray(data);
  const size = radius * 2 + 1;
  const area = size * size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const py = Math.min(h - 1, Math.max(0, y + ky));
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const si = (py * w + px) * 4;
          rSum += src[si]; gSum += src[si + 1]; bSum += src[si + 2];
        }
      }
      const di = (y * w + x) * 4;
      data[di] = rSum / area;
      data[di + 1] = gSum / area;
      data[di + 2] = bSum / area;
    }
  }
  return data;
}

function createBinaryMask(srcData, w, h, mode, thresh, invert, hueCenter, hueRange, satMin, bright, cont) {
  const mask = new Uint8Array(w * h);
  const f = (259 * (cont + 255)) / (255 * (259 - cont));
  const brightAdj = bright * 2.55;
  for (let i = 0; i < w * h; i++) {
    const si = i * 4;
    let r = Math.max(0, Math.min(255, f * (srcData[si] + brightAdj - 128) + 128));
    let g = Math.max(0, Math.min(255, f * (srcData[si + 1] + brightAdj - 128) + 128));
    let b = Math.max(0, Math.min(255, f * (srcData[si + 2] + brightAdj - 128) + 128));
    if (mode === 'color') {
      const [hue, sat] = rgbToHsl(r, g, b);
      let hueDiff = Math.abs(hue - hueCenter);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      mask[i] = (hueDiff <= hueRange && sat >= satMin) ? 1 : 0;
    } else {
      mask[i] = (0.299 * r + 0.587 * g + 0.114 * b) >= thresh ? 1 : 0;
    }
    if (invert) mask[i] = mask[i] ? 0 : 1;
  }
  return mask;
}

function createBgSubMask(srcData, bgData, w, h, thresh, invert, bright, cont) {
  const mask = new Uint8Array(w * h);
  const f = (259 * (cont + 255)) / (255 * (259 - cont));
  const brightAdj = bright * 2.55;
  for (let i = 0; i < w * h; i++) {
    const si = i * 4;
    const r1 = Math.max(0, Math.min(255, f * (srcData[si] + brightAdj - 128) + 128));
    const g1 = Math.max(0, Math.min(255, f * (srcData[si + 1] + brightAdj - 128) + 128));
    const b1 = Math.max(0, Math.min(255, f * (srcData[si + 2] + brightAdj - 128) + 128));
    const dr = r1 - bgData[si], dg = g1 - bgData[si + 1], db = b1 - bgData[si + 2];
    mask[i] = Math.sqrt(dr * dr + dg * dg + db * db) >= thresh ? 1 : 0;
    if (invert) mask[i] = mask[i] ? 0 : 1;
  }
  return mask;
}

function labelConnectedComponents(mask, w, h, minArea, maxBlobs) {
  const labels = new Int32Array(w * h);
  const blobs = [];
  let labelId = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!mask[idx] || labels[idx]) continue;
      labelId++;
      const stack = [idx];
      let area = 0, minX = x, maxX = x, minY = y, maxY = y, sumX = 0, sumY = 0;
      while (stack.length > 0) {
        const ci = stack.pop();
        if (labels[ci]) continue;
        const cx = ci % w, cy = (ci / w) | 0;
        if (!mask[ci]) continue;
        labels[ci] = labelId;
        area++; sumX += cx; sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx > 0 && !labels[ci - 1]) stack.push(ci - 1);
        if (cx < w - 1 && !labels[ci + 1]) stack.push(ci + 1);
        if (cy > 0 && !labels[ci - w]) stack.push(ci - w);
        if (cy < h - 1 && !labels[ci + w]) stack.push(ci + w);
      }
      if (area >= minArea) {
        blobs.push({ id: 0, label: labelId, area, cx: sumX / area, cy: sumY / area, minX, minY, maxX, maxY, vx: 0, vy: 0 });
      }
    }
  }
  blobs.sort((a, b) => b.area - a.area);
  return blobs.slice(0, maxBlobs);
}

function trackBlobs(detected, smoothing) {
  const maxDist = 60;
  const used = new Set();
  const updated = [];
  for (const prev of trackedBlobs) {
    let best = null, bestDist = maxDist;
    for (const det of detected) {
      if (used.has(det)) continue;
      const d = Math.sqrt((det.cx - prev.cx) ** 2 + (det.cy - prev.cy) ** 2);
      if (d < bestDist) { bestDist = d; best = det; }
    }
    if (best) {
      used.add(best);
      best.id = prev.id;
      // Velocity from raw detection before smoothing
      best.vx = best.cx - prev.cx;
      best.vy = best.cy - prev.cy;
      // Motion smoothing
      if (smoothing > 0) {
        best.cx = (1 - smoothing) * best.cx + smoothing * prev.cx;
        best.cy = (1 - smoothing) * best.cy + smoothing * prev.cy;
      }
      updated.push(best);
    }
  }
  for (const det of detected) {
    if (!used.has(det)) { det.id = nextBlobId++; det.vx = 0; det.vy = 0; updated.push(det); }
  }
  trackedBlobs = updated;
  return updated;
}

// --- Trail management ---

function updateTrails(blobs, maxLen) {
  const activeIds = new Set(blobs.map(b => b.id));
  for (const blob of blobs) {
    if (!trails.has(blob.id)) trails.set(blob.id, []);
    trails.get(blob.id).push({ x: blob.cx, y: blob.cy });
  }
  for (const [id, trail] of trails) {
    while (trail.length > maxLen) trail.shift();
    if (!activeIds.has(id)) trail.shift();
    if (trail.length === 0) trails.delete(id);
  }
}

// --- Blob colors ---

const blobColors = [
  '#ff6b6b', '#51cf66', '#339af0', '#fcc419', '#cc5de8',
  '#20c997', '#ff922b', '#a9e34b', '#748ffc', '#f06595',
  '#66d9e8', '#ffd43b', '#845ef7', '#63e6be', '#e64980',
  '#94d82d', '#4dabf7', '#ff8787', '#38d9a9', '#da77f2',
];

function getBlobColor(id) {
  return blobColors[(id - 1) % blobColors.length];
}

// --- Drawing functions ---

function drawScanlines(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 50) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y < h; y += 50) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
}

function drawCornerBrackets(ctx, x, y, w, h, color, thickness) {
  const cl = Math.min(w, h) * 0.3;
  // Glow pass
  ctx.strokeStyle = colorWithAlpha(color, 0.25);
  ctx.lineWidth = thickness + 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y);
  ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl);
  ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h);
  ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
  ctx.stroke();
  // Sharp pass
  ctx.strokeStyle = colorWithAlpha(color, 0.85);
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y);
  ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl);
  ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h);
  ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
  ctx.stroke();
}

function drawFullBox(ctx, x, y, w, h, color, thickness) {
  // Glow
  ctx.strokeStyle = colorWithAlpha(color, 0.25);
  ctx.lineWidth = thickness + 1.5;
  ctx.strokeRect(x, y, w, h);
  // Sharp
  ctx.strokeStyle = colorWithAlpha(color, 0.85);
  ctx.lineWidth = thickness;
  ctx.strokeRect(x, y, w, h);
}

function drawBoundingBox(ctx, x, y, w, h, color, thickness, useBrackets, useDotted) {
  if (useDotted) ctx.setLineDash([4, 4]);
  if (useBrackets) {
    drawCornerBrackets(ctx, x, y, w, h, color, thickness);
  } else {
    drawFullBox(ctx, x, y, w, h, color, thickness);
  }
  if (useDotted) ctx.setLineDash([]);
}

function drawCrosshair(ctx, cx, cy, size, color) {
  const gap = size * 0.35;
  // Glow
  ctx.strokeStyle = colorWithAlpha(color, 0.3);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy); ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + size);
  ctx.stroke();
  // Sharp
  ctx.strokeStyle = colorWithAlpha(color, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy); ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + size);
  ctx.stroke();
  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawDataLabel(ctx, blob, scale, color, canvasW, canvasH) {
  const pad = 6;
  const labelW = 82, labelH = 42;
  let lx = (blob.maxX + 1) * scale + pad;
  let ly = blob.minY * scale;
  if (lx + labelW > canvasW) lx = blob.minX * scale - pad - labelW;
  if (lx < 0) lx = pad;
  if (ly + labelH > canvasH) ly = canvasH - labelH - pad;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(lx, ly, labelW, labelH);
  ctx.fillStyle = color;
  ctx.fillRect(lx, ly, 2, labelH);

  const f = mono();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold 10px ${f}`;
  ctx.fillStyle = color;
  ctx.fillText(`ID ${blob.id}`, lx + 7, ly + 4);
  ctx.font = `9px ${f}`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(`${blob.area} px`, lx + 7, ly + 17);
  ctx.fillText(`${Math.round(blob.cx)}, ${Math.round(blob.cy)}`, lx + 7, ly + 28);
}

function drawConnections(ctx, blobs, scale, dotted) {
  if (blobs.length < 2) return;
  if (dotted) ctx.setLineDash([3, 4]);
  else ctx.setLineDash([3, 4]);
  const f = mono();
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i], b = blobs[j];
      const ax = a.cx * scale, ay = a.cy * scale;
      const bx = b.cx * scale, by = b.cy * scale;
      const dist = Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      ctx.font = `8px ${f}`;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(dist), mx, my - 5);
    }
  }
  ctx.setLineDash([]);
}

function drawTrailDots(ctx, scale) {
  for (const [id, trail] of trails) {
    const color = getBlobColor(id);
    const len = trail.length;
    for (let i = 0; i < len - 1; i++) {
      const alpha = ((i + 1) / len) * 0.55;
      ctx.fillStyle = colorWithAlpha(color, alpha);
      ctx.beginPath();
      ctx.arc(trail[i].x * scale, trail[i].y * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMetrics(ctx, blobs, procW, procH, canvasW, canvasH) {
  const f = mono();
  const pad = 8;
  const lineH = 13;
  const headerH = 20;
  const panelH = headerH + blobs.length * lineH + pad;
  const panelW = 200;

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(pad, pad, panelW, panelH);

  ctx.font = `9px ${f}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('DATA', pad + 6, pad + 4);

  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const xn = (b.cx / procW).toFixed(2);
    const yn = (b.cy / procH).toFixed(2);
    const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy).toFixed(1);
    const color = getBlobColor(b.id);
    const y = pad + headerH + i * lineH;

    ctx.fillStyle = color;
    ctx.fillText(`${b.id}`, pad + 6, y);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`${xn},${yn}`, pad + 30, y);
    ctx.fillText(`${spd}`, pad + 110, y);
    ctx.fillText(`${Math.floor(b.area)}`, pad + 150, y);
  }
}

function drawHUD(ctx, blobs, w, h) {
  const f = mono();
  const pad = 8;
  ctx.font = `9px ${f}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(`TRACK  F:${String(frameNum).padStart(5, '0')}  OBJ:${blobs.length}`, pad, h - pad);
  // Frame border
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

// --- Main render ---

function render() {
  if (!mediaSource.ready) return;
  frameNum++;

  const srcW = mediaSource.width, srcH = mediaSource.height;
  const procW = Math.min(srcW, 320);
  const procH = Math.round(procW * (srcH / srcW));

  sampCanvas.width = procW;
  sampCanvas.height = procH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, procW, procH);
  const srcData = sampCtx.getImageData(0, 0, procW, procH);

  const mode = getMode();
  const display = getDisplay();
  const showConnections = getConnections();
  const showLabels = getLabels();
  const showMetrics = getMetrics();
  const showGrid = getGrid();
  const boxStyle = getBoxStyle();
  const dotted = getDotted();
  const thresh = +els.threshold.value;
  const blurRadius = +els.blur.value;
  const minArea = +els.minArea.value;
  const maxBlobs = +els.maxBlobs.value;
  const bright = +els.brightness.value;
  const cont = +els.contrast.value;
  const invert = getInvert();
  const trailLen = +els.trailLength.value;
  const smoothing = +els.smoothing.value;
  const thickness = +els.thickness.value;
  const fillAlpha = +els.fillOpacity.value / 100;

  let frameData = srcData.data;
  if (blurRadius > 0) {
    frameData = new Uint8ClampedArray(frameData);
    applyBlur(frameData, procW, procH, blurRadius);
  }

  let mask;
  if (mode === 'bg-sub') {
    if (!backgroundFrame || backgroundFrame.width !== procW || backgroundFrame.height !== procH) {
      canvas.width = procW;
      canvas.height = procH;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, procW, procH);
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Capture a background frame first', procW / 2, procH / 2);
      return;
    }
    mask = createBgSubMask(frameData, backgroundFrame.data, procW, procH, thresh, invert, bright, cont);
  } else {
    mask = createBinaryMask(frameData, procW, procH, mode, thresh, invert, +els.hueCenter.value, +els.hueRange.value, +els.satMin.value, bright, cont);
  }

  const detected = labelConnectedComponents(mask, procW, procH, minArea, maxBlobs);
  const blobs = trackBlobs(detected, smoothing);
  updateTrails(blobs, Math.max(1, trailLen));

  // Output scaling
  const scale = Math.max(1, Math.floor(
    Math.min(canvas.parentElement?.clientWidth || procW, canvas.parentElement?.clientHeight || procH)
    / Math.max(procW, procH) * 2
  ));
  const outW = procW * scale, outH = procH * scale;
  canvas.width = outW;
  canvas.height = outH;
  ctx.imageSmoothingEnabled = false;

  if (display === 'mask') {
    maskCanvas.width = procW;
    maskCanvas.height = procH;
    const maskImgData = maskCtx.createImageData(procW, procH);
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i] ? 255 : 0;
      maskImgData.data[i * 4] = v;
      maskImgData.data[i * 4 + 1] = v;
      maskImgData.data[i * 4 + 2] = v;
      maskImgData.data[i * 4 + 3] = 255;
    }
    maskCtx.putImageData(maskImgData, 0, 0);
    ctx.drawImage(maskCanvas, 0, 0, outW, outH);
    for (const blob of blobs) {
      const color = getBlobColor(blob.id);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(blob.minX * scale, blob.minY * scale, (blob.maxX - blob.minX + 1) * scale, (blob.maxY - blob.minY + 1) * scale);
      ctx.fillStyle = color;
      ctx.font = `bold 10px ${mono()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${blob.id}`, blob.cx * scale, blob.minY * scale - 3);
    }
  } else {
    // --- Data-viz art overlay ---
    ctx.drawImage(sampCanvas, 0, 0, outW, outH);

    // Darken for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, outW, outH);

    // Scanlines
    drawScanlines(ctx, outW, outH);

    // Grid
    if (showGrid) drawGrid(ctx, outW, outH);

    // Trails
    if (trailLen > 0) drawTrailDots(ctx, scale);

    // Connections
    if (showConnections) drawConnections(ctx, blobs, scale, dotted);

    // Per-blob overlays
    const bracketPad = 5;
    const useBrackets = boxStyle === 'brackets';
    for (const blob of blobs) {
      const color = getBlobColor(blob.id);
      const bx = blob.minX * scale - bracketPad;
      const by = blob.minY * scale - bracketPad;
      const bw = (blob.maxX - blob.minX + 1) * scale + bracketPad * 2;
      const bh = (blob.maxY - blob.minY + 1) * scale + bracketPad * 2;

      // Fill
      if (fillAlpha > 0) {
        ctx.fillStyle = colorWithAlpha(color, fillAlpha);
        ctx.fillRect(bx, by, bw, bh);
      }

      // Bounding box
      drawBoundingBox(ctx, bx, by, bw, bh, color, thickness, useBrackets, dotted);

      // Crosshair
      drawCrosshair(ctx, blob.cx * scale, blob.cy * scale, 10, color);

      // Data label
      if (showLabels) drawDataLabel(ctx, blob, scale, color, outW, outH);
    }

    // Metrics panel
    if (showMetrics) drawMetrics(ctx, blobs, procW, procH, outW, outH);

    // HUD
    drawHUD(ctx, blobs, outW, outH);
  }

  // FPS
  const now = performance.now();
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  fpsSmooth = fpsSmooth * 0.9 + (dt > 0 ? 1000 / dt : 0) * 0.1;
  els.blobCount.textContent = `Blobs: ${blobs.length}`;
  els.fpsDisplay.textContent = `FPS: ${fpsSmooth.toFixed(0)}`;
}

// --- Loop ---
function loop() {
  if (mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}
onChange(() => { if (!animId) loop(); });

// --- Fullscreen & Save ---
function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'blob-tracker.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
