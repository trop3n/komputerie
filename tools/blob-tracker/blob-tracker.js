import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let animId = null;
let backgroundFrame = null;
let trackedBlobs = [];
let nextBlobId = 1;
let lastFrameTime = performance.now();
let fpsSmooth = 0;

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
  blobCount: document.getElementById('blob-count'),
  fpsDisplay: document.getElementById('fps-display'),
  colorControls: document.getElementById('color-controls'),
  hueRangeGroup: document.getElementById('hue-range-group'),
  satMinGroup: document.getElementById('sat-min-group'),
  bgControls: document.getElementById('bg-controls'),
};

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

function getMode() {
  return document.querySelector('#mode-radios input:checked')?.value || 'threshold';
}

function getDisplay() {
  return document.querySelector('#display-radios input:checked')?.value || 'overlay';
}

function getInvert() {
  return document.querySelector('#invert-radios input:checked')?.value === 'on';
}

function getShowIds() {
  return document.querySelector('#show-ids-radios input:checked')?.value === 'on';
}

document.querySelectorAll('#mode-radios input').forEach(r => {
  r.addEventListener('change', () => {
    const mode = r.value;
    const isColor = mode === 'color';
    const isBgSub = mode === 'bg-sub';
    els.colorControls.style.display = isColor ? '' : 'none';
    els.hueRangeGroup.style.display = isColor ? '' : 'none';
    els.satMinGroup.style.display = isColor ? '' : 'none';
    els.bgControls.style.display = isBgSub ? '' : 'none';
  });
});

document.getElementById('btn-capture-bg').addEventListener('click', () => {
  if (!mediaSource.ready) return;
  const w = sampCanvas.width;
  const h = sampCanvas.height;
  if (w === 0 || h === 0) return;
  backgroundFrame = sampCtx.getImageData(0, 0, w, h);
});

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
    let r = srcData[si] + brightAdj;
    let g = srcData[si + 1] + brightAdj;
    let b = srcData[si + 2] + brightAdj;
    r = f * (r - 128) + 128;
    g = f * (g - 128) + 128;
    b = f * (b - 128) + 128;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    if (mode === 'color') {
      const [hue, sat] = rgbToHsl(r, g, b);
      let hueDiff = Math.abs(hue - hueCenter);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      mask[i] = (hueDiff <= hueRange && sat >= satMin) ? 1 : 0;
    } else {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      mask[i] = lum >= thresh ? 1 : 0;
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
    let r1 = srcData[si] + brightAdj;
    let g1 = srcData[si + 1] + brightAdj;
    let b1 = srcData[si + 2] + brightAdj;
    r1 = Math.max(0, Math.min(255, f * (r1 - 128) + 128));
    g1 = Math.max(0, Math.min(255, f * (g1 - 128) + 128));
    b1 = Math.max(0, Math.min(255, f * (b1 - 128) + 128));

    const r2 = bgData[si], g2 = bgData[si + 1], b2 = bgData[si + 2];
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    const diff = Math.sqrt(dr * dr + dg * dg + db * db);
    mask[i] = diff >= thresh ? 1 : 0;

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
      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0;
      const pixels = [];

      while (stack.length > 0) {
        const ci = stack.pop();
        if (labels[ci]) continue;
        const cx = ci % w;
        const cy = (ci / w) | 0;
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        if (!mask[ci] || labels[ci]) continue;

        labels[ci] = labelId;
        area++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        pixels.push(ci);

        if (cx > 0) stack.push(ci - 1);
        if (cx < w - 1) stack.push(ci + 1);
        if (cy > 0) stack.push(ci - w);
        if (cy < h - 1) stack.push(ci + w);
      }

      if (area >= minArea) {
        blobs.push({
          id: 0,
          label: labelId,
          area,
          cx: sumX / area,
          cy: sumY / area,
          minX, minY, maxX, maxY,
          pixels,
        });
      }
    }
  }

  blobs.sort((a, b) => b.area - a.area);
  return blobs.slice(0, maxBlobs);
}

function trackBlobs(detected) {
  const maxDist = 60;
  const used = new Set();
  const updated = [];

  for (const prev of trackedBlobs) {
    let best = null;
    let bestDist = maxDist;
    for (const det of detected) {
      if (used.has(det)) continue;
      const dx = det.cx - prev.cx;
      const dy = det.cy - prev.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = det;
      }
    }
    if (best) {
      used.add(best);
      best.id = prev.id;
      updated.push(best);
    }
  }

  for (const det of detected) {
    if (!used.has(det)) {
      det.id = nextBlobId++;
      updated.push(det);
    }
  }

  trackedBlobs = updated;
  return updated;
}

const blobColors = [
  '#ff6b6b', '#51cf66', '#339af0', '#fcc419', '#cc5de8',
  '#20c997', '#ff922b', '#a9e34b', '#748ffc', '#f06595',
  '#66d9e8', '#ffd43b', '#845ef7', '#63e6be', '#e64980',
  '#94d82d', '#4dabf7', '#ff8787', '#38d9a9', '#da77f2',
];

function getBlobColor(id) {
  return blobColors[(id - 1) % blobColors.length];
}

function drawContours(ctx, blobs, w, h, scale, showIds) {
  for (const blob of blobs) {
    const color = getBlobColor(blob.id);
    const perimeter = new Set();

    for (const pi of blob.pixels) {
      const px = pi % w;
      const py = (pi / w) | 0;
      const isEdge =
        px === 0 || px === w - 1 || py === 0 || py === h - 1 ||
        !blob.pixels.includes(pi - 1) || !blob.pixels.includes(pi + 1) ||
        !blob.pixels.includes(pi - w) || !blob.pixels.includes(pi + w);
      if (isEdge) perimeter.add(pi);
    }

    ctx.fillStyle = color;
    for (const pi of perimeter) {
      const px = pi % w;
      const py = (pi / w) | 0;
      ctx.fillRect(px * scale, py * scale, scale, scale);
    }

    if (showIds) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(10, scale * 5)}px ${getComputedStyle(document.body).getPropertyValue('--mono')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${blob.id}`, blob.cx * scale, blob.cy * scale - scale * 3);
      ctx.fillStyle = color;
      ctx.font = `${Math.max(9, scale * 3.5)}px ${getComputedStyle(document.body).getPropertyValue('--mono')}`;
      ctx.fillText(`area: ${blob.area}`, blob.cx * scale, blob.cy * scale + scale * 3);
    }
  }
}

function render() {
  if (!mediaSource.ready) return;

  const srcW = mediaSource.width;
  const srcH = mediaSource.height;
  const procW = Math.min(srcW, 320);
  const procH = Math.round(procW * (srcH / srcW));

  sampCanvas.width = procW;
  sampCanvas.height = procH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, procW, procH);
  const srcData = sampCtx.getImageData(0, 0, procW, procH);

  const mode = getMode();
  const display = getDisplay();
  const showIds = getShowIds();
  const thresh = +els.threshold.value;
  const blurRadius = +els.blur.value;
  const minArea = +els.minArea.value;
  const maxBlobs = +els.maxBlobs.value;
  const bright = +els.brightness.value;
  const cont = +els.contrast.value;
  const invert = getInvert();

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
    const hueCenter = +els.hueCenter.value;
    const hueRange = +els.hueRange.value;
    const satMin = +els.satMin.value;
    mask = createBinaryMask(frameData, procW, procH, mode, thresh, invert, hueCenter, hueRange, satMin, bright, cont);
  }

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

  const detected = labelConnectedComponents(mask, procW, procH, minArea, maxBlobs);
  const blobs = trackBlobs(detected);

  const scale = Math.max(1, Math.floor(Math.min(canvas.parentElement?.clientWidth || procW, canvas.parentElement?.clientHeight || procH) / Math.max(procW, procH) * 2));
  const outW = procW * scale;
  const outH = procH * scale;
  canvas.width = outW;
  canvas.height = outH;
  ctx.imageSmoothingEnabled = false;

  if (display === 'mask') {
    ctx.drawImage(maskCanvas, 0, 0, outW, outH);
  } else if (display === 'contours') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, outW, outH);
    drawContours(ctx, blobs, procW, procH, scale, showIds);
  } else {
    ctx.drawImage(sampCanvas, 0, 0, outW, outH);
    for (const blob of blobs) {
      const color = getBlobColor(blob.id);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        blob.minX * scale,
        blob.minY * scale,
        (blob.maxX - blob.minX + 1) * scale,
        (blob.maxY - blob.minY + 1) * scale,
      );

      ctx.beginPath();
      ctx.arc(blob.cx * scale, blob.cy * scale, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (showIds) {
        ctx.fillStyle = '#000';
        ctx.fillRect(blob.cx * scale - 12, blob.cy * scale - scale * 3 - 8, 24, 12);
        ctx.fillStyle = color;
        ctx.font = `bold 10px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${blob.id}`, blob.cx * scale, blob.cy * scale - scale * 3 - 2);
      }
    }
  }

  const now = performance.now();
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  const fps = dt > 0 ? 1000 / dt : 0;
  fpsSmooth = fpsSmooth * 0.9 + fps * 0.1;

  els.blobCount.textContent = `Blobs: ${blobs.length}`;
  els.fpsDisplay.textContent = `FPS: ${fpsSmooth.toFixed(0)}`;
}

function loop() {
  if (mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}

onChange(() => { if (!animId) loop(); });

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
