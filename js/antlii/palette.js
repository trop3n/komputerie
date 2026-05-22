// Color helpers shared by antlii tools: hex interpolation and palette picking
// across solid / sequence / transition modes.
export function interpolateHex(a, b, t) {
  const r1 = parseInt(a.slice(1, 3), 16), g1 = parseInt(a.slice(3, 5), 16), b1 = parseInt(a.slice(5, 7), 16);
  const r2 = parseInt(b.slice(1, 3), 16), g2 = parseInt(b.slice(3, 5), 16), b2 = parseInt(b.slice(5, 7), 16);
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

export function pickColor(colors, mode, i, n) {
  if (!colors.length) return '#ffffff';
  if (mode === 'solid' || colors.length === 1) return colors[0];
  const t = n > 1 ? i / (n - 1) : 0;
  if (mode === 'sequence') return colors[Math.min(Math.floor(t * colors.length), colors.length - 1)];
  const tt = t * (colors.length - 1);
  const k = Math.min(Math.floor(tt), colors.length - 2);
  return interpolateHex(colors[k], colors[Math.min(k + 1, colors.length - 1)], tt - k);
}
