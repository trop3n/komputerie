import { createSourceSelector } from '../../js/media-source.js';

// --- Canvas setup ---
const glCanvas = document.getElementById('gl-canvas');
const uiCanvas = document.getElementById('ui-canvas');
const app = document.getElementById('app');

const CW = 1280, CH = 720;
glCanvas.width = CW;
glCanvas.height = CH;
uiCanvas.width = CW;
uiCanvas.height = CH;

const gl = glCanvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
const uiCtx = uiCanvas.getContext('2d');

if (!gl) { document.body.textContent = 'WebGL not supported'; throw new Error('No WebGL'); }

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

// --- WebGL shaders ---

const vertSrc = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 vUV;
uniform vec2 u_resolution;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vUV = a_texCoord;
}
`;

const fragSrc = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D u_image;
uniform float u_opacity;
void main() {
  vec4 c = texture2D(u_image, vUV);
  gl_FragColor = vec4(c.rgb, c.a * u_opacity);
}
`;

// --- WebGL helpers ---

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertSrc));
gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(prog);
gl.useProgram(prog);

const aPos = gl.getAttribLocation(prog, 'a_position');
const aTex = gl.getAttribLocation(prog, 'a_texCoord');
const uRes = gl.getUniformLocation(prog, 'u_resolution');
const uImg = gl.getUniformLocation(prog, 'u_image');
const uOpacity = gl.getUniformLocation(prog, 'u_opacity');

gl.enableVertexAttribArray(aPos);
gl.enableVertexAttribArray(aTex);
gl.uniform2f(uRes, CW, CH);

const posBuf = gl.createBuffer();
const texBuf = gl.createBuffer();
const idxBuf = gl.createBuffer();

// Source texture
const srcTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, srcTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

// Upload placeholder
const placeholderData = new Uint8Array(CW * CH * 4);
for (let y = 0; y < CH; y++) {
  for (let x = 0; x < CW; x++) {
    const i = (y * CW + x) * 4;
    const t = (x + y) / (CW + CH);
    placeholderData[i] = Math.floor(t * 200 + 30);
    placeholderData[i + 1] = Math.floor(80 + t * 100);
    placeholderData[i + 2] = Math.floor(200 - t * 120);
    placeholderData[i + 3] = 255;
  }
}
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CW, CH, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderData);

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// --- Surface data model ---

let surfaces = [];
let activeSurfaceId = null;
let nextSurfaceId = 1;

function createSurface(name, gridX = 1, gridY = 1, warpMode = 'quad') {
  const margin = 0.15;
  const x0 = CW * margin, y0 = CH * margin;
  const w = CW * (1 - 2 * margin), h = CH * (1 - 2 * margin);

  const cols = gridX + 1, rows = gridY + 1;
  const points = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push({
        x: x0 + (c / gridX) * w,
        y: y0 + (r / gridY) * h,
      });
    }
  }

  return {
    id: nextSurfaceId++,
    name,
    gridX,
    gridY,
    warpMode,
    points,
    opacity: 1,
    subdivisions: 16,
  };
}

function getActiveSurface() {
  return surfaces.find(s => s.id === activeSurfaceId) || null;
}

// --- Bezier surface evaluation ---

function bernstein(n, i, t) {
  let coeff = 1;
  for (let k = 0; k < i; k++) coeff = coeff * (n - k) / (k + 1);
  return coeff * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

function evaluateBezierSurface(points, gridX, gridY, u, v) {
  const cols = gridX + 1, rows = gridY + 1;
  let x = 0, y = 0;
  for (let r = 0; r < rows; r++) {
    const bv = bernstein(gridY, r, v);
    for (let c = 0; c < cols; c++) {
      const bu = bernstein(gridX, c, u);
      const p = points[r * cols + c];
      const w = bu * bv;
      x += p.x * w;
      y += p.y * w;
    }
  }
  return { x, y };
}

// --- Bilinear interpolation for quad mode ---

function bilinearQuad(points, gridX, gridY, u, v) {
  const cellX = Math.min(Math.floor(u * gridX), gridX - 1);
  const cellY = Math.min(Math.floor(v * gridY), gridY - 1);
  const lu = (u * gridX) - cellX;
  const lv = (v * gridY) - cellY;

  const cols = gridX + 1;
  const tl = points[cellY * cols + cellX];
  const tr = points[cellY * cols + cellX + 1];
  const bl = points[(cellY + 1) * cols + cellX];
  const br = points[(cellY + 1) * cols + cellX + 1];

  return {
    x: tl.x * (1 - lu) * (1 - lv) + tr.x * lu * (1 - lv) + bl.x * (1 - lu) * lv + br.x * lu * lv,
    y: tl.y * (1 - lu) * (1 - lv) + tr.y * lu * (1 - lv) + bl.y * (1 - lu) * lv + br.y * lu * lv,
  };
}

// --- Build mesh geometry for a surface ---

function buildMesh(surface) {
  const { points, gridX, gridY, warpMode, subdivisions } = surface;
  const subs = subdivisions;
  const evalFn = warpMode === 'bezier' ? evaluateBezierSurface : bilinearQuad;

  const positions = [];
  const texCoords = [];
  const indices = [];

  for (let iy = 0; iy <= subs; iy++) {
    for (let ix = 0; ix <= subs; ix++) {
      const u = ix / subs;
      const v = iy / subs;
      const p = evalFn(points, gridX, gridY, u, v);
      positions.push(p.x, p.y);
      texCoords.push(u, v);
    }
  }

  for (let iy = 0; iy < subs; iy++) {
    for (let ix = 0; ix < subs; ix++) {
      const a = iy * (subs + 1) + ix;
      const b = a + 1;
      const c = a + (subs + 1);
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  return {
    positions: new Float32Array(positions),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices),
  };
}

// --- Render all surfaces via WebGL ---

function updateSourceTexture() {
  if (!mediaSource.ready) return;
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mediaSource.drawable);
}

function renderGL() {
  gl.viewport(0, 0, CW, CH);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(prog);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(uImg, 0);
  gl.uniform2f(uRes, CW, CH);

  for (const surface of surfaces) {
    const mesh = buildMesh(surface);

    gl.uniform1f(uOpacity, surface.opacity);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.texCoords, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);

    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }
}

// --- UI overlay: draw control points and grid ---

const POINT_RADIUS = 6;
const POINT_ACTIVE_RADIUS = 8;

function drawUI() {
  uiCtx.clearRect(0, 0, CW, CH);

  const showGrid = getRadio('grid-vis-radios') !== 'off';
  if (!showGrid) return;

  for (const surface of surfaces) {
    const isActive = surface.id === activeSurfaceId;
    const { points, gridX, gridY, warpMode, subdivisions } = surface;
    const cols = gridX + 1;
    const evalFn = warpMode === 'bezier' ? evaluateBezierSurface : bilinearQuad;

    // Draw mesh wireframe
    uiCtx.strokeStyle = isActive ? 'rgba(0,255,150,0.4)' : 'rgba(255,255,255,0.15)';
    uiCtx.lineWidth = 0.5;

    const subs = subdivisions;
    for (let iy = 0; iy <= subs; iy++) {
      uiCtx.beginPath();
      for (let ix = 0; ix <= subs; ix++) {
        const p = evalFn(points, gridX, gridY, ix / subs, iy / subs);
        if (ix === 0) uiCtx.moveTo(p.x, p.y);
        else uiCtx.lineTo(p.x, p.y);
      }
      uiCtx.stroke();
    }
    for (let ix = 0; ix <= subs; ix++) {
      uiCtx.beginPath();
      for (let iy = 0; iy <= subs; iy++) {
        const p = evalFn(points, gridX, gridY, ix / subs, iy / subs);
        if (iy === 0) uiCtx.moveTo(p.x, p.y);
        else uiCtx.lineTo(p.x, p.y);
      }
      uiCtx.stroke();
    }

    // Draw control point grid lines and points for active surface
    if (isActive) {
      uiCtx.strokeStyle = 'rgba(0,255,150,0.6)';
      uiCtx.lineWidth = 1.5;
      for (let r = 0; r < gridY + 1; r++) {
        uiCtx.beginPath();
        for (let c = 0; c < cols; c++) {
          const p = points[r * cols + c];
          if (c === 0) uiCtx.moveTo(p.x, p.y);
          else uiCtx.lineTo(p.x, p.y);
        }
        uiCtx.stroke();
      }
      for (let c = 0; c < cols; c++) {
        uiCtx.beginPath();
        for (let r = 0; r < gridY + 1; r++) {
          const p = points[r * cols + c];
          if (r === 0) uiCtx.moveTo(p.x, p.y);
          else uiCtx.lineTo(p.x, p.y);
        }
        uiCtx.stroke();
      }

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const corner = isCornerPoint(i, gridX, gridY);
        const hovered = i === hoveredPoint;
        const dragging = i === dragPoint;
        const r = (hovered || dragging) ? POINT_ACTIVE_RADIUS : POINT_RADIUS;

        uiCtx.beginPath();
        uiCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
        uiCtx.fillStyle = dragging ? '#ff4444' : corner ? '#00ff96' : '#66ddaa';
        uiCtx.fill();
        uiCtx.strokeStyle = '#000';
        uiCtx.lineWidth = 1.5;
        uiCtx.stroke();
      }
    }
  }
}

function isCornerPoint(idx, gridX, gridY) {
  const cols = gridX + 1;
  const c = idx % cols, r = Math.floor(idx / cols);
  return (c === 0 || c === gridX) && (r === 0 || r === gridY);
}

// --- Mouse interaction ---

let dragPoint = -1;
let hoveredPoint = -1;
let dragOffX = 0, dragOffY = 0;

function canvasCoords(e) {
  const rect = uiCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width * CW,
    y: (e.clientY - rect.top) / rect.height * CH,
  };
}

function findNearestPoint(mx, my) {
  const surface = getActiveSurface();
  if (!surface) return -1;
  let best = -1, bestD = POINT_ACTIVE_RADIUS * 2;
  for (let i = 0; i < surface.points.length; i++) {
    const p = surface.points[i];
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function isPointInSurface(x, y, surface) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of surface.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

uiCanvas.addEventListener('mousedown', (e) => {
  const { x, y } = canvasCoords(e);

  // Try to grab a control point on the active surface first
  const idx = findNearestPoint(x, y);
  if (idx >= 0) {
    const surface = getActiveSurface();
    dragPoint = idx;
    dragOffX = surface.points[idx].x - x;
    dragOffY = surface.points[idx].y - y;
    return;
  }

  // Otherwise try to select a different surface
  for (let i = surfaces.length - 1; i >= 0; i--) {
    const s = surfaces[i];
    if (s.id === activeSurfaceId) continue;
    if (isPointInSurface(x, y, s)) {
      setActiveSurface(s.id);
      return;
    }
  }
});

uiCanvas.addEventListener('mousemove', (e) => {
  const { x, y } = canvasCoords(e);

  if (dragPoint >= 0) {
    const surface = getActiveSurface();
    if (!surface) return;
    const snap = getRadio('snap-radios') === 'on';
    let nx = x + dragOffX, ny = y + dragOffY;
    if (snap) {
      const step = 20;
      nx = Math.round(nx / step) * step;
      ny = Math.round(ny / step) * step;
    }
    surface.points[dragPoint].x = nx;
    surface.points[dragPoint].y = ny;
  } else {
    hoveredPoint = findNearestPoint(x, y);
  }
});

uiCanvas.addEventListener('mouseup', () => { dragPoint = -1; });
uiCanvas.addEventListener('mouseleave', () => { dragPoint = -1; hoveredPoint = -1; });

// --- Surface list UI ---

function createSurfaceItem(s) {
  const item = document.createElement('div');
  item.className = 'surface-item' + (s.id === activeSurfaceId ? ' active' : '');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'surface-name';
  nameSpan.textContent = s.name;

  const visBtn = document.createElement('button');
  visBtn.className = 'btn-vis';
  visBtn.title = 'Toggle visibility';
  visBtn.textContent = s.opacity > 0 ? '\u25C9' : '\u25CE';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-del';
  delBtn.title = 'Delete';
  delBtn.textContent = '\u00D7';

  item.appendChild(nameSpan);
  item.appendChild(visBtn);
  item.appendChild(delBtn);

  item.addEventListener('click', (e) => {
    if (e.target === visBtn || e.target === delBtn) return;
    setActiveSurface(s.id);
  });

  delBtn.addEventListener('click', () => {
    surfaces = surfaces.filter(sf => sf.id !== s.id);
    if (activeSurfaceId === s.id) {
      activeSurfaceId = surfaces.length > 0 ? surfaces[0].id : null;
    }
    syncUIFromSurface();
    renderSurfaceList();
  });

  visBtn.addEventListener('click', () => {
    s.opacity = s.opacity > 0 ? 0 : 1;
    if (s.id === activeSurfaceId) {
      document.getElementById('surface-opacity').value = s.opacity;
      document.querySelector('.range-value[data-for="surface-opacity"]').textContent = s.opacity;
    }
    renderSurfaceList();
  });

  return item;
}

function renderSurfaceList() {
  const list = document.getElementById('surface-list');
  list.replaceChildren();
  for (const s of surfaces) {
    list.appendChild(createSurfaceItem(s));
  }
}

function setActiveSurface(id) {
  activeSurfaceId = id;
  syncUIFromSurface();
  renderSurfaceList();
}

function syncUIFromSurface() {
  const s = getActiveSurface();
  if (!s) return;
  document.getElementById('grid-x').value = s.gridX;
  document.querySelector('.range-value[data-for="grid-x"]').textContent = s.gridX;
  document.getElementById('grid-y').value = s.gridY;
  document.querySelector('.range-value[data-for="grid-y"]').textContent = s.gridY;
  document.getElementById('subdivisions').value = s.subdivisions;
  document.querySelector('.range-value[data-for="subdivisions"]').textContent = s.subdivisions;
  document.getElementById('surface-opacity').value = s.opacity;
  document.querySelector('.range-value[data-for="surface-opacity"]').textContent = s.opacity;

  const warpRadio = document.querySelector('#warp-radios input[value="' + s.warpMode + '"]');
  if (warpRadio) warpRadio.checked = true;
}

function rebuildSurfaceGrid(surface, newGridX, newGridY) {
  const oldPoints = surface.points;
  const newCols = newGridX + 1;
  const newRows = newGridY + 1;
  const newPoints = [];
  const evalFn = surface.warpMode === 'bezier' ? evaluateBezierSurface : bilinearQuad;

  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      const u = c / newGridX;
      const v = r / newGridY;
      const p = evalFn(oldPoints, surface.gridX, surface.gridY, u, v);
      newPoints.push({ x: p.x, y: p.y });
    }
  }

  surface.gridX = newGridX;
  surface.gridY = newGridY;
  surface.points = newPoints;
}

// --- UI event wiring ---

function getRadio(id) { return document.querySelector('#' + id + ' input:checked')?.value; }

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector('.range-value[data-for="' + r.id + '"]');
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

document.getElementById('grid-x').addEventListener('change', () => {
  const s = getActiveSurface();
  if (!s) return;
  rebuildSurfaceGrid(s, +document.getElementById('grid-x').value, s.gridY);
});

document.getElementById('grid-y').addEventListener('change', () => {
  const s = getActiveSurface();
  if (!s) return;
  rebuildSurfaceGrid(s, s.gridX, +document.getElementById('grid-y').value);
});

document.getElementById('subdivisions').addEventListener('input', () => {
  const s = getActiveSurface();
  if (s) s.subdivisions = +document.getElementById('subdivisions').value;
});

document.getElementById('surface-opacity').addEventListener('input', () => {
  const s = getActiveSurface();
  if (s) s.opacity = +document.getElementById('surface-opacity').value;
});

document.querySelectorAll('#warp-radios input').forEach(r => {
  r.addEventListener('change', () => {
    const s = getActiveSurface();
    if (s) s.warpMode = r.value;
  });
});

document.getElementById('btn-add-surface').addEventListener('click', () => {
  const s = createSurface(
    'Surface ' + nextSurfaceId,
    +document.getElementById('grid-x').value,
    +document.getElementById('grid-y').value,
    getRadio('warp-radios') || 'quad'
  );
  s.subdivisions = +document.getElementById('subdivisions').value;
  surfaces.push(s);
  setActiveSurface(s.id);
});

document.getElementById('btn-dup-surface').addEventListener('click', () => {
  const src = getActiveSurface();
  if (!src) return;
  const dup = {
    ...src,
    id: nextSurfaceId++,
    name: src.name + ' copy',
    points: src.points.map(p => ({ x: p.x + 30, y: p.y + 30 })),
  };
  surfaces.push(dup);
  setActiveSurface(dup.id);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  const s = getActiveSurface();
  if (!s) return;
  const fresh = createSurface(s.name, s.gridX, s.gridY, s.warpMode);
  s.points = fresh.points;
});

document.getElementById('btn-save-config').addEventListener('click', () => {
  const data = surfaces.map(s => ({
    name: s.name, gridX: s.gridX, gridY: s.gridY,
    warpMode: s.warpMode, opacity: s.opacity,
    subdivisions: s.subdivisions, points: s.points,
  }));
  localStorage.setItem('mesher-config', JSON.stringify(data));
});

document.getElementById('btn-load-config').addEventListener('click', () => {
  const raw = localStorage.getItem('mesher-config');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    surfaces = [];
    for (const d of data) {
      surfaces.push({
        id: nextSurfaceId++,
        name: d.name || 'Surface ' + nextSurfaceId,
        gridX: d.gridX, gridY: d.gridY,
        warpMode: d.warpMode || 'quad',
        opacity: d.opacity ?? 1,
        subdivisions: d.subdivisions || 16,
        points: d.points,
      });
    }
    if (surfaces.length > 0) setActiveSurface(surfaces[0].id);
    else activeSurfaceId = null;
    renderSurfaceList();
  } catch (e) { console.error('Failed to load config', e); }
});

// --- Fullscreen / Output mode ---

function toggleFullscreen() { app.classList.toggle('fullscreen'); }

document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-output').addEventListener('click', () => {
  app.classList.toggle('output');
  if (!app.classList.contains('fullscreen')) app.classList.add('fullscreen');
});
document.getElementById('btn-exit-fs').addEventListener('click', () => {
  app.classList.remove('fullscreen', 'output');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') app.classList.remove('fullscreen', 'output');
});

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'mesher.png';
  link.href = glCanvas.toDataURL('image/png');
  link.click();
});

// --- Source handling ---

onChange(() => { updateSourceTexture(); });

// --- Animation loop ---

let sourceUpdateCounter = 0;

function loop() {
  if (mediaSource.ready && mediaSource.type !== 'image') {
    sourceUpdateCounter++;
    if (sourceUpdateCounter % 2 === 0) updateSourceTexture();
  }

  renderGL();

  if (!app.classList.contains('output')) {
    drawUI();
  }

  requestAnimationFrame(loop);
}

// --- Init with one default surface ---
const defaultSurface = createSurface('Surface 1', 1, 1, 'quad');
surfaces.push(defaultSurface);
activeSurfaceId = defaultSurface.id;
renderSurfaceList();
syncUIFromSurface();

loop();
