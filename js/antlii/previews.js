// Lightweight animated Canvas2D previews for the antlii-stack landing cards.
// Each effect is an evocative approximation of the tool (not the real engine),
// kept cheap so 8 can animate together. Drives canvas[data-preview="<name>"].

const W = 180, H = 120;

const effects = {
  ritm: {
    draw(ctx, f) {
      ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
      const lines = 14;
      for (let i = 0; i < lines; i++) {
        const y = H * (i + 1) / (lines + 1);
        ctx.strokeStyle = `hsl(${(200 + i / lines * 90) % 360},75%,62%)`;
        ctx.lineWidth = 1.5; ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const v = Math.sin(x * 0.05 + f * 0.04 + i * 0.3) * 8 + Math.sin(x * 0.13 + f * 0.03) * 5;
          ctx.lineTo(x, y + v);
        }
        ctx.stroke();
      }
    },
  },
  splitx: {
    draw(ctx, f) {
      ctx.fillStyle = '#06070d'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        for (let i = 0; i < 6; i++) {
          const a = f * 0.02 + i * 0.6, r = 8 + i * 7;
          ctx.save();
          ctx.translate(cx + sx * Math.cos(a) * r, cy + sy * Math.sin(a) * r);
          ctx.rotate(a * sx);
          ctx.strokeStyle = `hsl(${(210 + i * 18) % 360},70%,62%)`; ctx.lineWidth = 1.2;
          const s = 4 + i;
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.866, s * 0.5); ctx.lineTo(-s * 0.866, s * 0.5); ctx.closePath(); ctx.stroke();
          ctx.restore();
        }
      }
    },
  },
  flake: {
    draw(ctx, f) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      const gx = 6, gy = 4, cw = W / gx, ch = H / gy;
      for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) {
        const x = c * cw + cw / 2, y = r * ch + ch / 2;
        const dist = Math.hypot(c - gx / 2 + 0.5, r - gy / 2 + 0.5) / 3;
        ctx.save(); ctx.translate(x, y); ctx.rotate(f * 0.03 + dist * 3);
        ctx.strokeStyle = `hsl(${((260 - dist * 120) % 360 + 360) % 360},55%,55%)`; ctx.lineWidth = 1;
        const s = cw * 0.32 * (1 - dist * 0.4);
        for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s); ctx.stroke(); }
        ctx.restore();
      }
    },
  },
  textr: {
    draw(ctx, f) {
      ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, txt = 'ANTLII', n = 12;
      ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + f * 0.01;
        ctx.save(); ctx.translate(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38 * 0.62); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = `hsl(${(i / n * 140 + 200) % 360},70%,65%)`; ctx.fillText(txt[i % txt.length], 0, 0);
        ctx.restore();
      }
    },
  },
  sampl: {
    draw(ctx, f) {
      ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, n = 46;
      for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2, r = 34 + Math.cos(t * 3) * 8;
        const s = 2 + (1 + Math.sin(t * 2 + f * 0.05)) * 1.6;
        ctx.fillStyle = `hsl(${(i / n * 120 + 330) % 360},75%,62%)`;
        ctx.beginPath(); ctx.arc(cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.7, s, 0, Math.PI * 2); ctx.fill();
      }
    },
  },
  rastr: {
    draw(ctx, f) {
      ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
      const gx = 22, gy = 14, cw = W / gx, ch = H / gy;
      for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) {
        const m = Math.sin(c * 0.5 - f * 0.05) * 0.5 + 0.5;
        const cov = Math.max(0, m - Math.abs(r - gy / 2) / (gy / 2) * 0.8);
        if (cov <= 0.12) continue;
        ctx.fillStyle = `hsl(${(c / gx * 160 + 180) % 360},70%,62%)`;
        ctx.beginPath(); ctx.arc(c * cw + cw / 2, r * ch + ch / 2, cw * 0.5 * cov, 0, Math.PI * 2); ctx.fill();
      }
    },
  },
  refract: {
    init() {
      const g = document.createElement('canvas'); g.width = W; g.height = H;
      const c = g.getContext('2d');
      const grad = c.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#16213e'); grad.addColorStop(0.5, '#0f3460'); grad.addColorStop(0.8, '#533483'); grad.addColorStop(1, '#e94560');
      c.fillStyle = grad; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      for (let x = 0; x <= W; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 0; y <= H; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      return { img: g };
    },
    draw(ctx, f, s) {
      const fx = 8, fy = 6, cw = W / fx, ch = H / fy;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < fy; r++) for (let c = 0; c < fx; c++) {
        const ox = Math.sin(c * 1.7 + r * 0.9 + f * 0.03) * 6, oy = Math.cos(c * 1.1 + r * 1.3 + f * 0.025) * 6;
        ctx.drawImage(s.img, c * cw, r * ch, cw, ch, c * cw + ox, r * ch + oy, cw, ch);
      }
    },
  },
  bluur: {
    draw(ctx, f) {
      ctx.fillStyle = '#06070d'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const a = f * 0.01 + i * 0.9;
        const x = W / 2 + Math.cos(a) * 40 * Math.sin(i + f * 0.005), y = H / 2 + Math.sin(a * 1.2) * 26;
        const r = 28 + Math.sin(f * 0.02 + i) * 10;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `hsla(${(f * 0.5 + i * 40) % 360},80%,60%,0.55)`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },
};

export function initPreviews() {
  document.querySelectorAll('canvas[data-preview]').forEach((canvas) => {
    const fx = effects[canvas.dataset.preview];
    if (!fx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const state = fx.init ? fx.init() : null;
    let f = 0;
    (function loop() { fx.draw(ctx, f, state); f++; requestAnimationFrame(loop); })();
  });
}
