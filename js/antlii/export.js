// Export controls for antlii tools, shared across every tool via attachExport:
//  - PNG still (with integer upscale)
//  - SVG (vector tools, when getSVG is provided)
//  - Video recording (MediaRecorder) with fps, bitrate, and fixed-duration
//    auto-stop. Output is native MP4 where the browser supports it, otherwise
//    WebM (compile the frame sequence below to MP4 with FFmpeg if you need it).
//  - PNG/WebP frame sequence zipped (the reliable, antlii-style path to MP4).
//
// Note on MP4: true in-browser transcode would need ffmpeg.wasm, which requires
// either cross-origin isolation (COOP/COEP) or a same-origin vendored ~31 MB
// core — neither fits this static, no-build setup — so we record native MP4
// where available and otherwise hand off to FFmpeg via the frame sequence.
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

  // ---- Video recording ----
  const vid = { format: 'webm', fps: 30, bitrate: 12, duration: 0, status: 'idle' };
  page.addBinding(vid, 'format', { options: { WebM: 'webm', 'MP4*': 'mp4' } });
  page.addBinding(vid, 'fps', { min: 12, max: 60, step: 1 });
  page.addBinding(vid, 'bitrate', { label: 'bitrate Mbps', min: 1, max: 40, step: 1 });
  page.addBinding(vid, 'duration', { label: 'auto-stop s', min: 0, max: 60, step: 1 });
  const recBtn = page.addButton({ title: 'Record Video' });
  const vidStatus = page.addBinding(vid, 'status', { readonly: true, label: 'video' });
  let rec = null, chunks = null, recMime = '', autoStop = null, countdown = null;
  const setStatus = (s) => { vid.status = s; vidStatus.refresh(); };
  const clearTimers = () => { if (autoStop) { clearTimeout(autoStop); autoStop = null; } if (countdown) { clearInterval(countdown); countdown = null; } };

  recBtn.on('click', () => {
    if (rec) { rec.stop(); return; }
    const canvas = getCanvas();
    const wantMp4 = vid.format === 'mp4';
    const mime = pickVideoMime(wantMp4);
    if (!canvas || typeof canvas.captureStream !== 'function' || !mime) { setStatus('unsupported'); return; }
    try {
      const stream = canvas.captureStream(vid.fps);
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: vid.bitrate * 1_000_000 });
    } catch (e) { console.error('record init failed', e); setStatus('error'); rec = null; return; }
    recMime = mime; chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearTimers();
      recBtn.title = 'Record Video';
      const ext = recMime.includes('mp4') ? 'mp4' : 'webm';
      download(new Blob(chunks, { type: recMime }), `${name}.${ext}`);
      rec = null;
      setStatus(wantMp4 && ext !== 'mp4' ? 'no native MP4 → saved WebM (use Frames + FFmpeg)' : 'idle');
    };
    rec.start();
    recBtn.title = '■ Stop';
    if (vid.duration > 0) {
      let left = vid.duration;
      setStatus(`recording… ${left}s`);
      countdown = setInterval(() => { left -= 1; if (left > 0) setStatus(`recording… ${left}s`); }, 1000);
      autoStop = setTimeout(() => { if (rec) rec.stop(); }, vid.duration * 1000);
    } else setStatus('recording…');
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

function pickVideoMime(preferMp4) {
  if (typeof MediaRecorder === 'undefined') return null;
  const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mp4 = ['video/mp4;codecs=avc1', 'video/mp4'];
  const order = preferMp4 ? [...mp4, ...webm] : [...webm, ...mp4];
  for (const m of order) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ } }
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
