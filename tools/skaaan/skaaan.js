// SKAAAN — interactive slit-scan distortion. A working buffer holds a fitted
// image; dragging stretches a 1px slit across the drag delta (smear), and an
// optional auto-scan sweeps a smearing slit across on its own. Drop an image to
// load it. Space = scan, R = restart, D = download. p5 2D. Proves the mouse-
// driven image-manipulation pattern shared by DRIFT / KLON / STIIL.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';

const params = {
  smearAxis: 'horizontal', scanning: false, scanSpeed: 4, scanWidth: 24, background: '#06070d',
};

const tool = createTool({ name: 'SKAAAN', version: '0.1' });
let buf = null, srcImg = null, scanX = 0, pInst = null;

function makeDefault(p) {
  const g = p.createGraphics(900, 600); g.pixelDensity(1);
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(0, 0, 900, 600);
  grad.addColorStop(0, '#e94560'); grad.addColorStop(0.4, '#533483'); grad.addColorStop(0.7, '#0f3460'); grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 900, 600);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `hsla(${Math.random() * 360},70%,60%,0.55)`;
    ctx.beginPath(); ctx.arc(Math.random() * 900, Math.random() * 600, 40 + Math.random() * 120, 0, Math.PI * 2); ctx.fill();
  }
  g.fill('#ffffff'); g.textSize(170); g.textAlign(p.CENTER, p.CENTER); g.textStyle(p.BOLD); g.text('SKAAAN', 450, 300);
  return g;
}

function restart() {
  if (!buf || !srcImg) return;
  buf.background(params.background);
  const iw = srcImg.width, ih = srcImg.height;
  const s = Math.min(buf.width / iw, buf.height / ih);
  const w = iw * s, h = ih * s;
  buf.image(srcImg, (buf.width - w) / 2, (buf.height - h) / 2, w, h);
}

function smear(x0, y0, x1, y1) {
  if (!buf) return;
  const ctx = buf.drawingContext;
  if (params.smearAxis !== 'vertical' && Math.abs(x1 - x0) >= 1) {
    const left = Math.min(x0, x1), w = Math.abs(x1 - x0) + 1;
    ctx.drawImage(buf.canvas, x0, 0, 1, buf.height, left, 0, w, buf.height);
  }
  if (params.smearAxis !== 'horizontal' && Math.abs(y1 - y0) >= 1) {
    const top = Math.min(y0, y1), h = Math.abs(y1 - y0) + 1;
    ctx.drawImage(buf.canvas, 0, y0, buf.width, 1, 0, top, buf.width, h);
  }
}

pInst = tool.startSketch((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);
    buf = p.createGraphics(p.width, p.height); buf.pixelDensity(1);
    srcImg = makeDefault(p);
    restart();
  };
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    buf = p.createGraphics(p.width, p.height); buf.pixelDensity(1);
    restart();
  };
  p.draw = () => {
    if (params.scanning && buf) {
      const ctx = buf.drawingContext;
      const x = Math.floor(scanX) % buf.width;
      ctx.drawImage(buf.canvas, x, 0, 1, buf.height, x, 0, params.scanWidth, buf.height);
      scanX = (scanX + params.scanSpeed) % buf.width;
    }
    if (buf) p.image(buf, 0, 0);
  };
});

// ---- Pointer smear (bound to the canvas host, so the panel doesn't trigger it) ----
let down = false, px = 0, py = 0;
const host = tool.canvasHost;
const at = (e) => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
host.addEventListener('pointerdown', (e) => { down = true; [px, py] = at(e); });
host.addEventListener('pointermove', (e) => {
  if (!down) return;
  const [x, y] = at(e);
  smear(px, py, x, y);
  px = x; py = y;
});
window.addEventListener('pointerup', () => { down = false; });

// ---- Drag-drop image ----
host.addEventListener('dragover', (e) => e.preventDefault());
host.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || !/^image\//i.test(file.type)) return;
  const url = URL.createObjectURL(file);
  pInst.loadImage(url, (img) => { srcImg = img; restart(); URL.revokeObjectURL(url); }, () => URL.revokeObjectURL(url));
});

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.code === 'Space') { e.preventDefault(); params.scanning = !params.scanning; tool.pane.refresh(); }
  else if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === 'd' || e.key === 'D') savePNG();
});

function savePNG() {
  const c = tool.getCanvas();
  if (!c) return;
  c.toBlob((b) => { const a = document.createElement('a'); a.download = 'skaaan.png'; a.href = URL.createObjectURL(b); a.click(); URL.revokeObjectURL(a.href); }, 'image/png');
}

// ---- UI ----
const main = tool.pages.main;
const fScan = main.addFolder({ title: 'Scan' });
fScan.addBinding(params, 'smearAxis', { label: 'axis', options: { Horizontal: 'horizontal', Vertical: 'vertical', Both: 'both' } });
fScan.addBinding(params, 'scanning', { label: 'auto scan' });
fScan.addBinding(params, 'scanSpeed', { label: 'scan spd', min: 1, max: 30, step: 1 });
fScan.addBinding(params, 'scanWidth', { label: 'scan width', min: 2, max: 80, step: 1 });
fScan.addBinding(params, 'background', { view: 'color' });

const fHelp = main.addFolder({ title: 'Controls', expanded: false });
fHelp.addButton({ title: 'Drag on canvas to smear' }).on('click', () => {});
fHelp.addButton({ title: 'Space: scan · R: restart · D: save' }).on('click', () => {});

tool.pages.options.addButton({ title: 'Restart (R)' }).on('click', restart);
attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'skaaan' });

const presets = {
  'Soft Sweep': { smearAxis: 'horizontal', scanning: true, scanSpeed: 3, scanWidth: 18, background: '#06070d' },
  'Cross Smear': { smearAxis: 'both', scanning: false, background: '#0a0a12' },
};
attachPresets(tool.pages.options, { pane: tool.pane, params, presets });
