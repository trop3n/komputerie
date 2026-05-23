// DITHR — image dithering / rasterization. Source image processed through
// ordered (Bayer), halftone, CMYK halftone, or ASCII algorithms with
// brightness/contrast/invert and optional gradient recolor. Rebuilt on change.
// p5 2D. Drop an image to load. (Blue-noise, 3D OBJ, and video ingestion are
// follow-ups; image rasterization is the core.)
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { interpolateHex } from '../../js/antlii/palette.js';

const params = {
  algorithm: 'ordered', cell: 6, brightness: 0, contrast: 10, invert: false,
  fg: '#e8e8e8', bg: '#0a0a12',
  gradient: false, c0: '#0f3460', c1: '#e94560', c2: '#fdcb6e',
};
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const RAMP = ' .:-=+*#%@';

const tool = createTool({ name: 'DITHR', version: '0.1' });
let pb = null, srcImg = null, dirty = true, pInst = null;
const tmp = document.createElement('canvas');
const tctx = tmp.getContext('2d', { willReadFrequently: true });
function colorsArr() { return [params.c0, params.c1, params.c2]; }
function grad(t) { t = Math.max(0, Math.min(1, t)); const cs = colorsArr(); const pos = t * (cs.length - 1), k = Math.min(Math.floor(pos), cs.length - 2); return interpolateHex(cs[k], cs[Math.min(k + 1, cs.length - 1)], pos - k); }

function makeDefault(p) {
  const g = p.createGraphics(900, 600); g.pixelDensity(1);
  const ctx = g.drawingContext;
  const grd = ctx.createLinearGradient(0, 0, 900, 600);
  grd.addColorStop(0, '#f6f6f6'); grd.addColorStop(0.5, '#7a7a8a'); grd.addColorStop(1, '#101018');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 900, 600);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = `hsla(${Math.random() * 360},20%,${30 + Math.random() * 50}%,0.8)`; ctx.beginPath(); ctx.arc(Math.random() * 900, Math.random() * 600, 50 + Math.random() * 130, 0, Math.PI * 2); ctx.fill(); }
  g.fill('#fff'); g.textSize(150); g.textAlign(p.CENTER, p.CENTER); g.textStyle(p.BOLD); g.text('DITHR', 450, 300);
  return g;
}
function makeBuffer() {
  const cap = 1100, mx = Math.max(srcImg.width, srcImg.height), k = Math.min(cap / mx, 1.5);
  pb = pInst.createGraphics(Math.max(2, Math.round(srcImg.width * k)), Math.max(2, Math.round(srcImg.height * k))); pb.pixelDensity(1);
}

function build() {
  if (!pb || !srcImg) return;
  const W = pb.width, H = pb.height, cell = params.cell;
  const sw = Math.max(1, Math.ceil(W / cell)), sh = Math.max(1, Math.ceil(H / cell));
  tmp.width = sw; tmp.height = sh; tctx.imageSmoothingEnabled = true; tctx.clearRect(0, 0, sw, sh);
  tctx.drawImage(srcImg.canvas, 0, 0, srcImg.width, srcImg.height, 0, 0, sw, sh);
  const data = tctx.getImageData(0, 0, sw, sh).data;

  const cf = (259 * (params.contrast * 2.55 + 255)) / (255 * (259 - params.contrast * 2.55));
  const bri = params.brightness / 100;
  const lumAt = (sx, sy) => {
    const i = (sy * sw + sx) * 4;
    let l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    l = (cf * (l * 255 - 128) + 128) / 255 + bri;
    if (params.invert) l = 1 - l;
    return Math.max(0, Math.min(1, l));
  };

  pb.push(); pb.background(params.bg); pb.noStroke();
  const algo = params.algorithm;
  if (algo === 'ascii') { pb.textFont('monospace'); pb.textAlign(pInst.CENTER, pInst.CENTER); pb.textSize(cell * 1.05); }

  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const lum = lumAt(sx, sy);
      const cx = sx * cell + cell / 2, cy = sy * cell + cell / 2;
      const ink = params.gradient ? grad(1 - lum) : params.fg;
      if (algo === 'ordered') {
        if ((1 - lum) > (BAYER[sx % 4][sy % 4] + 0.5) / 16) { pb.fill(ink); pb.rect(sx * cell, sy * cell, cell, cell); }
      } else if (algo === 'halftone') {
        const r = (1 - lum) * cell * 0.72; if (r > 0.3) { pb.fill(ink); pb.ellipse(cx, cy, r * 2, r * 2); }
      } else if (algo === 'cmyk') {
        const i = (sy * sw + sx) * 4; const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const k = 1 - Math.max(r, g, b); const denom = (1 - k) || 1;
        const c = (1 - r - k) / denom, m = (1 - g - k) / denom, y = (1 - b - k) / denom;
        pb.blendMode(pInst.MULTIPLY);
        const o = cell * 0.2, rad = cell * 0.46;
        pb.fill('#00aeef'); pb.ellipse(cx - o, cy - o, c * rad * 2, c * rad * 2);
        pb.fill('#ec008c'); pb.ellipse(cx + o, cy - o, m * rad * 2, m * rad * 2);
        pb.fill('#fff200'); pb.ellipse(cx - o, cy + o, y * rad * 2, y * rad * 2);
        pb.fill('#231f20'); pb.ellipse(cx + o, cy + o, k * rad * 2, k * rad * 2);
        pb.blendMode(pInst.BLEND);
      } else {
        const ch = RAMP[Math.min(RAMP.length - 1, Math.floor((1 - lum) * RAMP.length))];
        if (ch && ch !== ' ') { pb.fill(ink); pb.text(ch, cx, cy); }
      }
    }
  }
  pb.pop();
}

pInst = tool.startSketch((p) => {
  p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight); p.pixelDensity(1); srcImg = makeDefault(p); makeBuffer(); dirty = true; };
  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
  p.draw = () => {
    if (dirty) { build(); dirty = false; }
    p.background(8, 8, 14);
    if (pb) { const s = Math.min(p.width / pb.width, p.height / pb.height); p.image(pb, (p.width - pb.width * s) / 2, (p.height - pb.height * s) / 2, pb.width * s, pb.height * s); }
  };
});
tool.pane.on('change', () => { dirty = true; });

const host = tool.canvasHost;
host.addEventListener('dragover', (e) => e.preventDefault());
host.addEventListener('drop', (e) => {
  e.preventDefault(); const file = e.dataTransfer?.files?.[0];
  if (!file || !/^image\//i.test(file.type)) return;
  const url = URL.createObjectURL(file);
  pInst.loadImage(url, (img) => { srcImg = img; makeBuffer(); dirty = true; URL.revokeObjectURL(url); }, () => URL.revokeObjectURL(url));
});

// ---- UI ----
const main = tool.pages.main;
const fAlgo = main.addFolder({ title: 'Raster' });
fAlgo.addBinding(params, 'algorithm', { options: { Ordered: 'ordered', Halftone: 'halftone', CMYK: 'cmyk', ASCII: 'ascii' } });
fAlgo.addBinding(params, 'cell', { label: 'cell', min: 2, max: 40, step: 1 });
fAlgo.addBinding(params, 'brightness', { min: -100, max: 100, step: 1 });
fAlgo.addBinding(params, 'contrast', { min: -100, max: 100, step: 1 });
fAlgo.addBinding(params, 'invert');

const fColor = main.addFolder({ title: 'Color' });
fColor.addBinding(params, 'fg', { label: 'ink', view: 'color' });
fColor.addBinding(params, 'bg', { label: 'paper', view: 'color' });
fColor.addBinding(params, 'gradient', { label: 'gradient map' });
fColor.addBinding(params, 'c0', { label: 'grad 1', view: 'color' });
fColor.addBinding(params, 'c1', { label: 'grad 2', view: 'color' });
fColor.addBinding(params, 'c2', { label: 'grad 3', view: 'color' });

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'dithr' });

const presets = {
  Newsprint: { algorithm: 'halftone', cell: 7, contrast: 25, fg: '#0a0a0a', bg: '#f4f1ea', gradient: false },
  'CMYK Print': { algorithm: 'cmyk', cell: 8, contrast: 15, bg: '#ffffff' },
  Terminal: { algorithm: 'ascii', cell: 9, contrast: 30, fg: '#7CFC98', bg: '#04100a', gradient: false },
  'Bayer Duotone': { algorithm: 'ordered', cell: 4, contrast: 20, gradient: true, c0: '#10092e', c1: '#e94560', c2: '#fdcb6e', bg: '#10092e' },
  'ASCII Matrix': { algorithm: 'ascii', cell: 7, contrast: 35, fg: '#39ff14', bg: '#020a02', gradient: false },
  'Pop Halftone': { algorithm: 'halftone', cell: 9, contrast: 20, gradient: true, c0: '#0984e3', c1: '#fd79a8', c2: '#fdcb6e', bg: '#0a0a12' },
  Risoprint: { algorithm: 'cmyk', cell: 6, contrast: 25, bg: '#fdf6ec' },
  'Bayer Mono': { algorithm: 'ordered', cell: 3, contrast: 30, fg: '#e8e8e8', bg: '#0a0a0a', gradient: false },
  'Sunset Dither': { algorithm: 'ordered', cell: 5, contrast: 25, gradient: true, c0: '#2d0a31', c1: '#e94560', c2: '#ffd460', bg: '#2d0a31' },
  'Comic CMYK': { algorithm: 'cmyk', cell: 12, contrast: 30, bg: '#ffffff' },
};
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, onApply: () => { dirty = true; } });
