// Shared shell for antlii-style tools: a floating Tweakpane control panel
// (MAIN / EXPORT / OPTIONS tabs) over a full-bleed p5 canvas. Reused by every
// tool built on the new stack. p5 is loaded as a global (window.p5) by the
// host page; Tweakpane is imported as an ES module.
import { Pane } from 'tweakpane';

export function createTool({ name, version = '0.1', backHref = '../../' }) {
  const root = document.createElement('div');
  root.className = 'antlii-tool';

  const canvasHost = document.createElement('div');
  canvasHost.className = 'antlii-canvas';
  root.appendChild(canvasHost);

  const paneHost = document.createElement('div');
  paneHost.className = 'antlii-pane';
  root.appendChild(paneHost);

  const back = document.createElement('a');
  back.className = 'antlii-back';
  back.href = backHref;
  back.textContent = '← Tools';
  root.appendChild(back);

  document.body.appendChild(root);

  const pane = new Pane({ container: paneHost, title: `${name} · v${version}` });
  const tab = pane.addTab({
    pages: [{ title: 'MAIN' }, { title: 'EXPORT' }, { title: 'OPTIONS' }],
  });
  const pages = { main: tab.pages[0], export: tab.pages[1], options: tab.pages[2] };

  function startSketch(factory) {
    const P5 = window.p5;
    if (!P5) throw new Error('p5 not loaded (expected window.p5)');
    return new P5(factory, canvasHost);
  }

  function getCanvas() {
    return canvasHost.querySelector('canvas');
  }

  // For non-p5 tools (e.g. Paper.js): create a full-bleed <canvas> in the host.
  // The tool wires its own renderer (e.g. paper.setup) and resize handling.
  function mountCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvasHost.appendChild(canvas);
    return canvas;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) root.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.key === 'f' && !typing) toggleFullscreen();
  });

  return { root, pane, pages, canvasHost, startSketch, mountCanvas, getCanvas, toggleFullscreen };
}

// Dev hooks (window.__<name>) are useful for A/B-driving a tool against its
// live antlii.work counterpart, but pollute the global namespace in production.
// `exposeDebug(name, obj)` only attaches when the URL has `?debug` — so the
// hook remains discoverable for power users (open /tools/flake/?debug) without
// being visible by default.
export const isDebug = () => {
  try { return new URLSearchParams(location.search).has('debug'); }
  catch { return false; }
};
export function exposeDebug(name, obj) {
  if (isDebug()) window['__' + name] = obj;
}
