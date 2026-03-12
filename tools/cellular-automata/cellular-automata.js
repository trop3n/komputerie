const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const app = document.getElementById('app');

// State
let gridW = 128, gridH = 128;
let grid, nextGrid;
let paused = false;
let animId = null;
let lastFrame = 0;
let drawing = false;
let lastDrawPos = null;

// Controls
const ruleSel = document.getElementById('rule');
const sizeSel = document.getElementById('grid-size');
const paletteSel = document.getElementById('palette');
const fpsRange = document.getElementById('fps');
const brushSizeRange = document.getElementById('brush-size');

// Range display
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

// Palettes
const palettes = {
  greyscale: i => [i, i, i],
  binary: i => i > 0 ? [255, 255, 255] : [0, 0, 0],
  fire: i => [Math.min(255, i * 3), Math.max(0, i * 1.5 - 50), Math.max(0, i * 0.5 - 100)],
  ocean: i => [0, Math.min(255, i * 0.8), Math.min(255, i * 1.5)],
  neon: i => {
    const t = i / 255;
    return [Math.sin(t * 3.14) * 255, Math.sin(t * 3.14 + 2) * 128 + 127, Math.sin(t * 3.14 + 4) * 255];
  },
  pastel: i => {
    const t = i / 255;
    return [180 + t * 75, 160 + t * 75, 200 + t * 55];
  },
  rainbow: i => {
    const t = i / 255 * 6;
    const s = Math.floor(t), f = t - s;
    const q = 255 * (1 - f), u = 255 * f;
    switch (s % 6) {
      case 0: return [255, u, 0];
      case 1: return [q, 255, 0];
      case 2: return [0, 255, u];
      case 3: return [0, q, 255];
      case 4: return [u, 0, 255];
      case 5: return [255, 0, q];
    }
  },
  cyberpunk: i => {
    const t = i / 255;
    return [t * 255, t * 50, t * 200 + 55];
  },
  earth: i => {
    const t = i / 255;
    return [60 + t * 140, 40 + t * 120, 20 + t * 60];
  },
  ice: i => {
    const t = i / 255;
    return [180 + t * 75, 200 + t * 55, 220 + t * 35];
  },
  acid: i => {
    const t = i / 255;
    return [t * 100, 200 + t * 55, t * 50];
  },
  sunset: i => {
    const t = i / 255;
    return [200 + t * 55, 80 + t * 100, 50 + t * 40];
  },
};

let customColors = ['#000000', '#00ff00', '#ffffff'];
const customColorsGroup = document.getElementById('custom-colors-group');
const swatchContainer = document.getElementById('color-swatches');

function parseHex(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.fillStyle = hex; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function customPalette(val) {
  const parsed = customColors.map(parseHex);
  if (parsed.length < 2) return [val, val, val];
  const t = val / 255;
  const seg = t * (parsed.length - 1);
  const idx = Math.min(Math.floor(seg), parsed.length - 2);
  const local = seg - idx;
  const a = parsed[idx], b = parsed[idx + 1];
  return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local, a[2] + (b[2] - a[2]) * local];
}

function buildSwatches() {
  swatchContainer.replaceChildren();
  customColors.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'color-swatch';
    div.style.background = c;
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = c;
    inp.addEventListener('input', () => { customColors[i] = inp.value; div.style.background = inp.value; });
    inp.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (customColors.length > 2) { customColors.splice(i, 1); buildSwatches(); }
    });
    div.appendChild(inp);
    swatchContainer.appendChild(div);
  });
  const add = document.createElement('div');
  add.className = 'color-swatch-add';
  add.textContent = '+';
  add.addEventListener('click', () => { customColors.push(`hsl(${Math.random()*360},60%,50%)`); buildSwatches(); });
  swatchContainer.appendChild(add);
}
buildSwatches();

paletteSel.addEventListener('change', () => {
  customColorsGroup.style.display = paletteSel.value === 'custom' ? '' : 'none';
});

function getColor(val) {
  const name = paletteSel.value;
  if (name === 'custom') return customPalette(val);
  return (palettes[name] || palettes.greyscale)(val);
}

// Grid management
function createGrid(w, h) {
  return new Uint8Array(w * h);
}

function initGrid() {
  gridW = gridH = +sizeSel.value;
  grid = createGrid(gridW, gridH);
  nextGrid = createGrid(gridW, gridH);
  canvas.width = gridW;
  canvas.height = gridH;
}

function randomize() {
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() > 0.5 ? 255 : 0;
  }
}

function clear() {
  grid.fill(0);
}

function getCell(x, y) {
  const wx = ((x % gridW) + gridW) % gridW;
  const wy = ((y % gridH) + gridH) % gridH;
  return grid[wy * gridW + wx];
}

function setCell(x, y, val) {
  if (x >= 0 && x < gridW && y >= 0 && y < gridH) {
    grid[y * gridW + x] = val;
  }
}

// Count live neighbors (for binary rules, alive = val > 0)
function countNeighbors(x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (getCell(x + dx, y + dy) > 0) count++;
    }
  }
  return count;
}

// Average neighbor value (for continuous rules)
function avgNeighbors(x, y) {
  let sum = 0, count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      sum += getCell(x + dx, y + dy);
      count++;
    }
  }
  return sum / count;
}

// Rules
const rules = {
  'game-of-life': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    return (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 255 : 0;
  },
  'highlife': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    return (alive && (n === 2 || n === 3)) || (!alive && (n === 3 || n === 6)) ? 255 : 0;
  },
  'seeds': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    return !alive && n === 2 ? 255 : 0;
  },
  'brian-brain': (x, y) => {
    const v = getCell(x, y);
    if (v === 255) return 128;  // alive -> dying
    if (v === 128) return 0;    // dying -> dead
    const n = countNeighbors(x, y);
    return n === 2 ? 255 : 0;
  },
  'day-night': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    if (alive) return [3,4,6,7,8].includes(n) ? 255 : 0;
    return [3,6,7,8].includes(n) ? 255 : 0;
  },
  'diamoeba': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    if (alive) return [5,6,7,8].includes(n) ? 255 : 0;
    return [3,5,6,7,8].includes(n) ? 255 : 0;
  },
  'anneal': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    if (alive) return [3,5,6,7,8].includes(n) ? 255 : 0;
    return [4,6,7,8].includes(n) ? 255 : 0;
  },
  'morley': (x, y) => {
    const n = countNeighbors(x, y);
    const alive = getCell(x, y) > 0;
    if (alive) return [2,4,5].includes(n) ? 255 : 0;
    return n === 3 ? 255 : 0;
  },
  'perlin': (x, y) => {
    const v = getCell(x, y);
    const avg = avgNeighbors(x, y);
    const noise = (Math.random() - 0.5) * 20;
    return Math.max(0, Math.min(255, (v + avg) / 2 + noise));
  },
  'plasma': (x, y) => {
    const v = getCell(x, y);
    const avg = avgNeighbors(x, y);
    const wave = Math.sin(x * 0.1 + performance.now() * 0.001) * 30;
    return Math.max(0, Math.min(255, avg + wave));
  },
  'feedback': (x, y) => {
    const v = getCell(x, y);
    const avg = avgNeighbors(x, y);
    const diff = avg - v;
    return Math.max(0, Math.min(255, v + diff * 0.3 + (Math.random() - 0.5) * 10));
  },
};

// 1D elementary automata
let row1D = 0;

function step1D(ruleNum) {
  if (row1D === 0) {
    // Initialize first row
    for (let x = 0; x < gridW; x++) {
      grid[x] = Math.random() > 0.5 ? 255 : 0;
    }
    row1D = 1;
    return;
  }
  if (row1D >= gridH) {
    // Scroll up
    grid.copyWithin(0, gridW);
    row1D = gridH - 1;
  }
  const prevY = row1D - 1;
  for (let x = 0; x < gridW; x++) {
    const l = getCell(x - 1, prevY) > 0 ? 1 : 0;
    const c = getCell(x, prevY) > 0 ? 1 : 0;
    const r = getCell(x + 1, prevY) > 0 ? 1 : 0;
    const pattern = (l << 2) | (c << 1) | r;
    grid[row1D * gridW + x] = (ruleNum >> pattern) & 1 ? 255 : 0;
  }
  row1D++;
}

const rule1DMap = { 'rule-30': 30, 'rule-90': 90, 'rule-110': 110 };

function step() {
  const ruleKey = ruleSel.value;

  if (rule1DMap[ruleKey] !== undefined) {
    step1D(rule1DMap[ruleKey]);
    return;
  }

  const ruleFn = rules[ruleKey] || rules['game-of-life'];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      nextGrid[y * gridW + x] = ruleFn(x, y);
    }
  }
  [grid, nextGrid] = [nextGrid, grid];
}

function draw() {
  const imageData = ctx.createImageData(gridW, gridH);
  const data = imageData.data;
  for (let i = 0; i < grid.length; i++) {
    const [r, g, b] = getColor(grid[i]);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

function loop(now) {
  animId = requestAnimationFrame(loop);
  const fps = +fpsRange.value;
  const interval = 1000 / fps;
  if (now - lastFrame < interval) return;
  lastFrame = now;
  if (!paused) step();
  draw();
}

// Effects
document.querySelectorAll('[data-effect]').forEach(btn => {
  btn.addEventListener('click', () => {
    const effect = btn.dataset.effect;
    if (effect === 'noise') {
      for (let i = 0; i < grid.length; i++) {
        if (Math.random() < 0.05) grid[i] = Math.random() * 255;
      }
    } else if (effect === 'invert') {
      for (let i = 0; i < grid.length; i++) grid[i] = 255 - grid[i];
    } else if (effect === 'glitch') {
      for (let i = 0; i < 10; i++) {
        const y = Math.floor(Math.random() * gridH);
        const shift = Math.floor((Math.random() - 0.5) * 20);
        const row = grid.slice(y * gridW, (y + 1) * gridW);
        for (let x = 0; x < gridW; x++) {
          grid[y * gridW + x] = row[((x + shift) % gridW + gridW) % gridW];
        }
      }
    } else if (effect === 'blur') {
      const tmp = new Uint8Array(grid.length);
      for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
          tmp[y * gridW + x] = avgNeighbors(x, y);
        }
      }
      grid.set(tmp);
    }
  });
});

// Drawing on canvas
function canvasToGrid(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = gridW / rect.width;
  const scaleY = gridH / rect.height;
  return {
    x: Math.floor((e.clientX - rect.left) * scaleX),
    y: Math.floor((e.clientY - rect.top) * scaleY),
  };
}

function brushDraw(gx, gy) {
  const size = +brushSizeRange.value;
  const brush = document.querySelector('input[name="brush"]:checked').value;
  const half = Math.floor(size / 2);

  if (brush === 'rect') {
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        setCell(gx + dx, gy + dy, 255);
      }
    }
  } else if (brush === 'spray') {
    for (let i = 0; i < size * size; i++) {
      const dx = Math.round((Math.random() - 0.5) * size);
      const dy = Math.round((Math.random() - 0.5) * size);
      setCell(gx + dx, gy + dy, 255);
    }
  } else if (brush === 'smooth') {
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const cx = gx + dx, cy = gy + dy;
        if (cx >= 0 && cx < gridW && cy >= 0 && cy < gridH) {
          const avg = avgNeighbors(cx, cy);
          grid[cy * gridW + cx] = Math.round((grid[cy * gridW + cx] + avg) / 2);
        }
      }
    }
  } else if (brush === 'line') {
    if (lastDrawPos) {
      const dx = gx - lastDrawPos.x, dy = gy - lastDrawPos.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        setCell(Math.round(lastDrawPos.x + dx * t), Math.round(lastDrawPos.y + dy * t), 255);
      }
    }
  }
  lastDrawPos = { x: gx, y: gy };
}

canvas.addEventListener('mousedown', e => {
  drawing = true;
  lastDrawPos = null;
  const pos = canvasToGrid(e);
  brushDraw(pos.x, pos.y);
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const pos = canvasToGrid(e);
  brushDraw(pos.x, pos.y);
});

window.addEventListener('mouseup', () => { drawing = false; lastDrawPos = null; });

// Buttons
document.getElementById('btn-generate').addEventListener('click', () => {
  row1D = 0;
  randomize();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  row1D = 0;
  clear();
});

document.getElementById('btn-pause').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('btn-pause').textContent = paused ? 'Play' : 'Pause';
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
  app.classList.toggle('fullscreen');
});

document.getElementById('btn-save').addEventListener('click', () => {
  // Render at display resolution
  const tempCanvas = document.createElement('canvas');
  const scale = Math.max(1, Math.floor(1024 / gridW));
  tempCanvas.width = gridW * scale;
  tempCanvas.height = gridH * scale;
  const tctx = tempCanvas.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
  const link = document.createElement('a');
  link.download = 'cellular-automata.png';
  link.href = tempCanvas.toDataURL('image/png');
  link.click();
});

sizeSel.addEventListener('change', () => {
  row1D = 0;
  initGrid();
  randomize();
});

ruleSel.addEventListener('change', () => {
  row1D = 0;
});

// Init
initGrid();
randomize();
requestAnimationFrame(loop);
