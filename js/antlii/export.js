// Export controls for antlii tools, shared across every tool via attachExport:
//  - PNG still (with integer upscale)
//  - SVG (vector tools, when getSVG is provided)
//  - Video recording (WebM via MediaRecorder, native MP4 where supported)
//  - PNG/WebP frame sequence zipped (for compiling to MP4 with FFmpeg, etc.)
export function attachExport(page, { getCanvas, getSVG, name = 'export' }) {
  const opts = { scale: 1 };
  page.addBinding(opts, 'scale', { label: 'Resolution ×', min: 1, max: 4, step: 1 });

  page.addButton({ title: 'Save PNG' }).on('click', () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const out = opts.scale === 1 ? canvas : upscale(canvas, opts.scale);
    out.toBlob((blob) => download(blob, `${name}.png`), 'image/png');
  });

  if (getSVG) {
    page.addButton({ title: 'Save SVG' }).on('click', () => {
      const svg = getSVG();
      if (svg) download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
    });
  }

  page.addBlade({ view: 'separator' });

  // ---- Video recording (WebM / MP4 via MediaRecorder) ----
  const vid = { fps: 30, status: 'idle' };
  page.addBinding(vid, 'fps', { min: 12, max: 60, step: 1 });
  const recBtn = page.addButton({ title: 'Record Video' });
  const vidStatus = page.addBinding(vid, 'status', { readonly: true, label: 'video' });
  let rec = null, chunks = null;
  recBtn.on('click', () => {
    if (rec) { rec.stop(); return; }
    const canvas = getCanvas();
    const mime = pickVideoMime();
    if (!canvas || typeof canvas.captureStream !== 'function' || !mime) {
      vid.status = 'unsupported'; vidStatus.refresh(); return;
    }
    try {
      const stream = canvas.captureStream(vid.fps);
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    } catch (e) { console.error('record init failed', e); vid.status = 'error'; vidStatus.refresh(); rec = null; return; }
    chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      download(new Blob(chunks, { type: mime }), `${name}.${ext}`);
      rec = null; recBtn.title = 'Record Video'; vid.status = 'idle'; vidStatus.refresh();
    };
    rec.start();
    recBtn.title = '■ Stop'; vid.status = 'recording…'; vidStatus.refresh();
  });

  // ---- Frame sequence (PNG/WebP zip) ----
  const fr = { frames: 60, format: 'png', status: 'idle' };
  page.addBinding(fr, 'frames', { min: 6, max: 600, step: 6 });
  page.addBinding(fr, 'format', { options: { PNG: 'png', WebP: 'webp' } });
  const frBtn = page.addButton({ title: 'Export Frames (zip)' });
  const frStatus = page.addBinding(fr, 'status', { readonly: true, label: 'frames' });
  let exporting = false;
  frBtn.on('click', async () => {
    if (exporting) return;
    const canvas = getCanvas();
    if (!canvas) return;
    exporting = true; fr.status = 'loading zip…'; frStatus.refresh();
    try {
      const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
      const zip = new JSZip();
      const type = fr.format === 'webp' ? 'image/webp' : 'image/png';
      for (let i = 0; i < fr.frames; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const blob = await new Promise((res) => canvas.toBlob(res, type));
        if (blob) zip.file(`${name}_${String(i).padStart(4, '0')}.${fr.format}`, blob);
        fr.status = `${i + 1}/${fr.frames}`; frStatus.refresh();
      }
      download(await zip.generateAsync({ type: 'blob' }), `${name}_frames.zip`);
      fr.status = 'done'; frStatus.refresh();
    } catch (e) {
      console.error('frame export failed', e); fr.status = 'error'; frStatus.refresh();
    }
    exporting = false;
  });
}

function pickVideoMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ } }
  return null;
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

function upscale(src, scale) {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
