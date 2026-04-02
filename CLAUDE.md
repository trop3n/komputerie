# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ksawery is a collection of browser-based visual/creative tools built with vanilla JavaScript and HTML5 Canvas. No build system, bundlers, or frameworks — just static files served directly.

## Development

Serve the project root with any static HTTP server (ES modules require it):

```
python3 -m http.server 8000
# or
npx serve .
```

Open `index.html` for the tool index, or navigate directly to `tools/<name>/` for individual tools.

There are no tests, linters, or build steps.

## Architecture

### Tool Layout Pattern

Every tool follows the same two-file structure:
- `tools/<name>/index.html` — sidebar controls + canvas area, loads JS as `type="module"`
- `tools/<name>/<name>.js` — all logic in a single file

Most tools import `MediaSource` from `js/media-source.js`. Standalone tools (cellular-automata, srt2video, flipdigits) manage their own state without external media input.

### Shared Modules

**`js/previews.js`** — Animated canvas previews for the root index page. Exports `initPreviews()` which drives `<canvas data-preview="toolname">` elements on each tool card.

**`js/media-source.js`** — Unified media input API:
- `MediaSource` class with properties: `.drawable` (HTMLVideoElement|HTMLImageElement), `.ready` (boolean), `.width`, `.height`, `.type` (`'camera'|'screen'|'video'|'image'`)
- Async methods: `useCamera()`, `useScreen()`, `useVideo(file)`, `useImage(file)`, `stop()`
- `createSourceSelector(container)` factory builds the full source UI (radio buttons + file input + default gradient sample). Returns `{ mediaSource, onChange(callback) }`

### Shared Styles

**`css/style.css`** — Single stylesheet for all tools.

CSS variables (`:root`):
- Colors: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-dim`, `--accent`
- Typography: `--mono` (IBM Plex Mono), `--sans` (IBM Plex Sans)

Layout classes:
- `.tool-layout` — flex container, 100vh
- `.tool-sidebar` — 280px fixed, scrollable
- `.tool-canvas-area` — flex:1, black background, canvas uses `object-fit: contain` and `image-rendering: crisp-edges`

Control components:
- `.control-group` — label + input column
- `.range-row` — range input + `.range-value` span (linked via `data-for` attribute)
- `.radio-row` — horizontal radio buttons styled as toggle group
- `.color-swatch-row` — flex-wrap color pickers (click=change, right-click=remove, "+"=add)
- `.btn`, `.btn-row` — buttons and button groups
- `.separator` — `<hr>` divider between control sections

### UI Conventions

- Sidebar on left with controls, canvas fills remaining space
- Fullscreen toggle via `.tool-layout.fullscreen` class hides sidebar, exit button appears on hover
- Every tool has Save PNG and Fullscreen buttons at bottom of sidebar
- Back link (`← Tools`) at top of sidebar links to root index

### Common JS Patterns

**Initialization:**
```javascript
import { createSourceSelector } from '../../js/media-source.js';
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');
const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));
```

**Range value display** (universal across all tools):
```javascript
document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; render(); });
});
```

**Render/animation loop** — image sources render once, video/camera/screen sources use `requestAnimationFrame`:
```javascript
function loop() {
  if (mediaSource.type !== 'image' && mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}
onChange(() => { render(); if (mediaSource.type !== 'image' && !animId) loop(); });
```

**Fullscreen and Save PNG** are wired identically in every tool — toggle `app.classList` for fullscreen, `canvas.toDataURL('image/png')` for save.

### Performance Patterns

- **Offscreen canvas sampling**: Separate `sampCanvas`/`sampCtx` with `{ willReadFrequently: true }` for pixel reads
- **Resolution scaling**: Input downscaled (e.g., max 480px), output upscaled to display size. Nearest-neighbor via `image-rendering: crisp-edges`
- **Luminance formula**: `0.299 * r + 0.587 * g + 0.114 * b`
- **Caching**: Expensive computations cached (Bayer matrices, parsed color palettes)

## Current Tools (11)

| Tool | Dir | Standalone |
|------|-----|:----------:|
| Blob Tracker | `tools/blob-tracker/` | |
| Cellular Automata | `tools/cellular-automata/` | ✓ |
| Dithering | `tools/dithering/` | |
| Flipdigits Player | `tools/flipdigits/` | ✓ |
| Gradient Map | `tools/gradient-map/` | |
| Pixel Flow | `tools/pixel-flow/` | |
| Pixelator | `tools/pixelator/` | |
| Shapes | `tools/shapes/` | |
| SRT to Video | `tools/srt2video/` | ✓ |
| Text | `tools/text/` | |
| Video to MIDI | `tools/video2midi/` | |

## Adding a New Tool

1. Create `tools/<name>/index.html` following the existing sidebar+canvas template structure (back link → h1 → `#source-controls` → separators + controls → btn-row → canvas area + exit button)
2. Create `tools/<name>/<name>.js` importing from `../../js/media-source.js` (unless standalone)
3. Add a card to the root `index.html` tools grid
4. Use existing CSS classes from `css/style.css` — avoid tool-specific stylesheets
5. Follow the established variable names: `canvas`, `ctx`, `app`, `mediaSource`, `animId`
