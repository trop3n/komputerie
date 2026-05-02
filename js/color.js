// Shared color parser. Reuses a single 1x1 canvas across calls
// and caches the most recent input, so repeated parses (e.g. range
// inputs firing render() at high frequency) do no allocation.

const _canvas = document.createElement('canvas');
_canvas.width = _canvas.height = 1;
const _ctx = _canvas.getContext('2d', { willReadFrequently: true });
const _cache = new Map();

export function parseColor(value) {
  const cached = _cache.get(value);
  if (cached) return cached;
  _ctx.clearRect(0, 0, 1, 1);
  _ctx.fillStyle = value;
  _ctx.fillRect(0, 0, 1, 1);
  const d = _ctx.getImageData(0, 0, 1, 1).data;
  const rgb = [d[0], d[1], d[2]];
  if (_cache.size > 256) _cache.clear();
  _cache.set(value, rgb);
  return rgb;
}
