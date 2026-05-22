// Export controls for antlii tools. v1: PNG (with integer upscale for higher
// output resolution). Frame-sequence (PNG/WebP), MP4 (MediaRecorder/ffmpeg.wasm),
// and SVG (vector tools) are planned follow-ups and will hook in here.
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
      if (!svg) return;
      download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
    });
  }
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
