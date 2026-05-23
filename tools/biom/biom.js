// BIOM — organic "visual growth". Seeded soft radial-gradient cells with
// concentric rings pulse and grow via noise, blended additively for organic
// fusion and soft color transitions, framed inside a customizable Swiss-style
// poster layout (margin, grid, header label, accent border). p5 2D, animated.
import { createTool } from '../../js/antlii/shell.js';
import { attachPresets } from '../../js/antlii/presets.js';
import { attachExport } from '../../js/antlii/export.js';
import { interpolateHex } from '../../js/antlii/palette.js';

const params = {
  cellCount: 18, growth: 90, pulse: 0.4, rings: 4, softness: 0.5, spread: 1, seed: 3, speed: 0.4,
  paletteCount: 3, c0: '#0a3d62', c1: '#3c6382', c2: '#82ccdd', background: '#0a0e17',
  margin: 0.08, showGrid: true, accent: '#e8e8e8', label: 'BIOM / GROWTH',
};

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function colorsArr() { return [params.c0, params.c1, params.c2].slice(0, Math.max(2, params.paletteCount)); }
function gradient(cs, t) { t = Math.max(0, Math.min(1, t)); const pos = t * (cs.length - 1), k = Math.min(Math.floor(pos), cs.length - 2); return interpolateHex(cs[k], cs[Math.min(k + 1, cs.length - 1)], pos - k); }

const tool = createTool({ name: 'BIOM', version: '0.1' });
let tt = 0;

tool.startSketch((p) => {
  p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight); p.pixelDensity(1); };
  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
  p.draw = () => {
    tt += p.deltaTime / 1000 * params.speed;
    const W = p.width, H = p.height, ctx = p.drawingContext;
    const [br, bg, bb] = hexRgb(params.background);
    p.background(br, bg, bb);
    const M = Math.min(W, H) * params.margin;
    const fx = M, fy = M, fw = W - 2 * M, fh = H - 2 * M;
    const cs = colorsArr();

    ctx.save();
    ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();

    if (params.showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      const step = fw / 12;
      for (let x = fx; x <= fx + fw + 1; x += step) { ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, fy + fh); ctx.stroke(); }
      for (let y = fy; y <= fy + fh + 1; y += step) { ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx + fw, y); ctx.stroke(); }
    }

    const rnd = mulberry32(params.seed >>> 0);
    const cells = [];
    for (let i = 0; i < params.cellCount; i++) cells.push({ x: fx + rnd() * fw, y: fy + rnd() * fh, base: 0.4 + 0.6 * rnd(), phase: rnd() * 6.28, ct: i / Math.max(1, params.cellCount - 1) });

    ctx.globalCompositeOperation = 'lighter';
    for (const c of cells) {
      const r = Math.max(4, params.growth * c.base * (1 + params.pulse * Math.sin(tt * 2 + c.phase)));
      const [cr, cg, cb] = hexRgb(gradient(cs, c.ct));
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${params.softness})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const c of cells) {
      const r = Math.max(4, params.growth * c.base * (1 + params.pulse * Math.sin(tt * 2 + c.phase)));
      const [cr, cg, cb] = hexRgb(gradient(cs, c.ct));
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.45)`; ctx.lineWidth = 1;
      for (let k = 1; k <= params.rings; k++) {
        const rr = r * (k / params.rings) * (0.6 + 0.4 * Math.sin(tt + c.phase + k));
        if (rr < 1) continue;
        ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();

    // Swiss frame
    ctx.strokeStyle = params.accent; ctx.lineWidth = 1.5; ctx.strokeRect(fx, fy, fw, fh);
    ctx.beginPath(); ctx.moveTo(fx, fy + M * 0.9); ctx.lineTo(fx + fw * 0.42, fy + M * 0.9); ctx.stroke();
    p.noStroke(); p.fill(params.accent);
    p.textFont('monospace'); p.textSize(Math.max(10, M * 0.28)); p.textAlign(p.LEFT, p.BASELINE);
    p.text(params.label, fx, fy + M * 0.62);
    p.textAlign(p.RIGHT, p.BASELINE); p.text('No. ' + String(params.seed).padStart(3, '0'), fx + fw, fy + M * 0.62);
  };
});

// ---- UI ----
const main = tool.pages.main;
const fCells = main.addFolder({ title: 'Cells' });
fCells.addBinding(params, 'cellCount', { label: 'count', min: 1, max: 60, step: 1 });
fCells.addBinding(params, 'growth', { min: 10, max: 260, step: 2 });
fCells.addBinding(params, 'pulse', { min: 0, max: 1, step: 0.02 });
fCells.addBinding(params, 'rings', { min: 0, max: 10, step: 1 });
fCells.addBinding(params, 'softness', { min: 0.05, max: 1, step: 0.05 });
fCells.addBinding(params, 'seed', { min: 0, max: 999, step: 1 });
fCells.addBinding(params, 'speed', { min: 0, max: 2, step: 0.05 });

const fColor = main.addFolder({ title: 'Color' });
fColor.addBinding(params, 'paletteCount', { label: 'colors', min: 2, max: 3, step: 1 });
fColor.addBinding(params, 'c0', { label: 'color 1', view: 'color' });
fColor.addBinding(params, 'c1', { label: 'color 2', view: 'color' });
fColor.addBinding(params, 'c2', { label: 'color 3', view: 'color' });
fColor.addBinding(params, 'background', { view: 'color' });

const fPoster = main.addFolder({ title: 'Poster' });
fPoster.addBinding(params, 'margin', { min: 0.02, max: 0.18, step: 0.01 });
fPoster.addBinding(params, 'showGrid', { label: 'grid' });
fPoster.addBinding(params, 'accent', { view: 'color' });
fPoster.addBinding(params, 'label');

attachExport(tool.pages.export, { getCanvas: tool.getCanvas, name: 'biom' });

const presets = {
  Tide: { cellCount: 18, growth: 90, pulse: 0.4, rings: 4, c0: '#0a3d62', c1: '#3c6382', c2: '#82ccdd', background: '#0a0e17', accent: '#e8e8e8' },
  Spore: { cellCount: 30, growth: 70, pulse: 0.6, rings: 2, softness: 0.4, c0: '#1b4332', c1: '#40916c', c2: '#b7e4c7', background: '#06120c', accent: '#d8f3dc' },
  Ember: { cellCount: 14, growth: 130, pulse: 0.5, rings: 5, softness: 0.55, c0: '#3a0ca3', c1: '#e63946', c2: '#fcbf49', background: '#0c0410', accent: '#ffe8d6' },
  Reef: { cellCount: 26, growth: 80, pulse: 0.5, rings: 3, softness: 0.45, c0: '#03452c', c1: '#1b998b', c2: '#a8e6cf', background: '#04140e', accent: '#e8fff5', label: 'BIOM / REEF' },
  Nucleus: { cellCount: 8, growth: 180, pulse: 0.4, rings: 6, softness: 0.5, c0: '#1a1a40', c1: '#4d4dff', c2: '#b8b8ff', background: '#06060f', accent: '#eaeaff', label: 'BIOM / NUCLEUS' },
  Coral: { cellCount: 20, growth: 100, pulse: 0.7, rings: 4, softness: 0.5, c0: '#5c0a2e', c1: '#e63946', c2: '#ffd6a5', background: '#0e0408', accent: '#ffe8d6', label: 'BIOM / CORAL' },
  Frost: { cellCount: 16, growth: 110, pulse: 0.3, rings: 2, softness: 0.4, c0: '#2c3e50', c1: '#7f9cb3', c2: '#eaf2f8', background: '#0a0f14', accent: '#ffffff', label: 'BIOM / FROST' },
  Bloom: { cellCount: 34, growth: 70, pulse: 0.6, rings: 3, softness: 0.5, speed: 0.6, c0: '#3a0ca3', c1: '#c8408f', c2: '#ffcad4', background: '#0a0410', accent: '#ffe5ec', label: 'BIOM / BLOOM' },
  Mono: { cellCount: 18, growth: 120, pulse: 0.45, rings: 4, softness: 0.5, c0: '#1c1c1c', c1: '#777777', c2: '#e0e0e0', background: '#0d0d0d', accent: '#f5f5f5', label: 'BIOM / MONO' },
};
function randomize(p) {
  p.cellCount = 6 + (Math.random() * 50 | 0);
  p.growth = 40 + Math.random() * 200; p.pulse = Math.random(); p.rings = Math.random() * 8 | 0;
  p.softness = 0.2 + Math.random() * 0.7; p.seed = Math.random() * 999 | 0;
  const h = Math.random() * 360;
  p.c0 = `#${hsl(h, 55, 25)}`; p.c1 = `#${hsl((h + 40) % 360, 55, 50)}`; p.c2 = `#${hsl((h + 80) % 360, 65, 78)}`;
}
function hsl(h, s, l) { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l); const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); }; return `${f(0)}${f(8)}${f(4)}`; }
attachPresets(tool.pages.options, { pane: tool.pane, params, presets, randomize });
