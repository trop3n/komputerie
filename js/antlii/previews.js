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
    // A stamped shape repeated along a diagonal, quad-mirrored into an X of
    // nested contours with a transition ramp — the SPLITX signature.
    draw(ctx, f) {
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, n = 13;
      ctx.lineWidth = 1.1;
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy);
        for (let i = 0; i < n; i++) {
          const wob = Math.sin(f * 0.03 + i * 0.45), r = 6 + i * 6.2;
          ctx.strokeStyle = `hsl(${(212 + i * 12 + f * 0.4) % 360},72%,${58 + wob * 6}%)`;
          ctx.beginPath();
          ctx.moveTo(r * 1.5, r * 0.15);
          ctx.lineTo(r * 0.45 + wob * 2, r * 0.45 + wob * 2);
          ctx.lineTo(r * 0.15, r * 1.5);
          ctx.stroke();
        }
        ctx.restore();
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
    // Stacked rows of a repeated letter (TEXTR's kinetic engine): each row's
    // count forms a back-and-forth diamond, with a per-row sine wave displacing
    // copies horizontally — the new TEXTR signature.
    draw(ctx, f) {
      ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f5f5f5';
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const letters = 'TEXTR', rows = 11, rh = H / (rows + 1);
      for (let r = 0; r < rows; r++) {
        const ch = letters[r % letters.length];
        const count = 3 + Math.round(Math.abs(Math.sin(r / rows * Math.PI)) * 6); // diamond
        const y = rh * (r + 1);
        const phase = (r / rows) * Math.PI * 2;
        for (let i = 0; i < count; i++) {
          const t = count > 1 ? i / (count - 1) - 0.5 : 0;
          const wave = Math.sin(t * Math.PI * 2 + f * 0.04 + phase) * 14;
          ctx.fillText(ch, W / 2 + t * W * 0.62 + wave, y);
        }
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
    // A small grid of soft, per-shape-blurred forms fused through MULTIPLY over a
    // pale palette-derived ground — the new BLUUR engine's signature look.
    draw(ctx, f) {
      ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f3e9d6'; ctx.fillRect(0, 0, W, H);
      const cols = 3, rows = 3, cw = W / cols, ch = H / rows;
      const cols5 = ['#3c2706', '#cc3904', '#e5cf0a', '#f3a712', '#7a5649'];
      ctx.globalCompositeOperation = 'multiply';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const ox = Math.sin(f * 0.012 + i * 1.3) * 10, oy = Math.cos(f * 0.01 + i * 0.7) * 10;
        const x = c * cw + cw / 2 + ox, y = r * ch + ch / 2 + oy;
        const rad = cw * (0.62 + Math.sin(f * 0.015 + i) * 0.16);
        ctx.filter = `blur(${6 + Math.sin(f * 0.02 + i) * 3}px)`;
        ctx.fillStyle = cols5[i % cols5.length];
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
    },
  },
  plain: {
    draw(ctx, f) {
      ctx.fillStyle = '#06070d'; ctx.fillRect(0, 0, W, H);
      const cols = 10, rows = 7, cw = W / cols, ch = H / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const h = Math.sin(c * 0.6 + r * 0.5 + f * 0.04) * 0.5 + 0.5;
        ctx.fillStyle = `hsl(200,45%,${18 + h * 55}%)`;
        const x = c * cw, y = r * ch;
        ctx.beginPath(); ctx.moveTo(x, y + ch); ctx.lineTo(x + cw / 2, y + ch - h * ch * 0.85); ctx.lineTo(x + cw, y + ch); ctx.closePath(); ctx.fill();
      }
    },
  },
  skaaan: {
    init() {
      const g = document.createElement('canvas'); g.width = W; g.height = H;
      const c = g.getContext('2d');
      const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#e94560'); gr.addColorStop(0.5, '#533483'); gr.addColorStop(1, '#0f3460');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { c.fillStyle = `hsla(${Math.random() * 360},70%,60%,0.5)`; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 15 + Math.random() * 28, 0, 7); c.fill(); }
      return { img: g };
    },
    draw(ctx, f, s) {
      ctx.drawImage(s.img, 0, 0);
      const x = (f * 1.4) % W, y = (Math.sin(f * 0.04) * 0.4 + 0.5) * (H - 16);
      ctx.drawImage(s.img, x, 0, 1, H, 0, y, W, 14);
    },
  },
  drift: {
    draw(ctx, f) {
      ctx.fillStyle = 'rgba(6,7,13,0.16)'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = f * 0.03 + i;
        ctx.save(); ctx.translate(cx + Math.cos(a) * (18 + i * 5), cy + Math.sin(a * 1.3) * (14 + i * 4)); ctx.rotate(a);
        ctx.fillStyle = `hsla(${(280 + i * 15) % 360},70%,62%,0.5)`; ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },
  klon: {
    draw(ctx, f) {
      ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
      const cell = 12;
      for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
        if (Math.hypot(x + cell / 2 - W / 2, y + cell / 2 - H / 2) < 46) { ctx.fillStyle = `hsl(${(x / W * 160 + 200 + f * 0.5) % 360},65%,58%)`; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2); }
      }
    },
  },
  stiil: {
    draw(ctx, f) {
      for (let y = 0; y < H; y++) {
        const t = Math.floor((y / H + Math.sin(f * 0.02) * 0.12) * 5) / 5;
        ctx.fillStyle = `rgb(${Math.round(16 + t * 230)},${Math.round(9 + t * 200)},${Math.round(46 + t * 100)})`;
        ctx.fillRect(0, y, W, 1);
      }
    },
  },
  biom: {
    draw(ctx, f) {
      ctx.fillStyle = '#0a0e17'; ctx.fillRect(0, 0, W, H);
      const m = 10;
      ctx.save(); ctx.beginPath(); ctx.rect(m, m, W - 2 * m, H - 2 * m); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = W * ((i * 0.27 + 0.15) % 1), y = H * ((i * 0.4 + 0.3) % 1), r = 18 + Math.sin(f * 0.03 + i) * 8;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `hsla(${(190 + i * 20) % 360},60%,62%,0.5)`); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    },
  },
  dithr: {
    draw(ctx, f) {
      ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], cell = 4;
      for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
        const lum = (x / W) * 0.9 + Math.sin(y / H * 3 + f * 0.03) * 0.1;
        const bi = (((y / cell) | 0) & 3) * 4 + (((x / cell) | 0) & 3);
        if ((1 - lum) * 16 > bayer[bi]) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x, y, cell - 1, cell - 1); }
      }
    },
  },
  boids: {
    init() { const b = []; for (let i = 0; i < 22; i++) b.push({ x: Math.random() * W, y: Math.random() * H, a: Math.random() * 7 }); return { b }; },
    draw(ctx, f, s) {
      ctx.fillStyle = 'rgba(5,6,13,0.28)'; ctx.fillRect(0, 0, W, H);
      for (const o of s.b) {
        o.a += Math.sin(f * 0.02 + o.x * 0.05) * 0.1; o.x += Math.cos(o.a) * 1.2; o.y += Math.sin(o.a) * 1.2;
        if (o.x < 0) o.x += W; if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; if (o.y > H) o.y -= H;
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); ctx.fillStyle = '#9ad0ff';
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, 2.5); ctx.lineTo(-3, -2.5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
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
