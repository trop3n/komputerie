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

**Tool layout pattern:** Every tool follows the same structure:
- `tools/<name>/index.html` — page with sidebar controls + canvas area, uses shared CSS and loads its JS as `type="module"`
- `tools/<name>/<name>.js` — all logic: imports `MediaSource`, wires up controls, runs a render/animation loop on a `<canvas>`

**Shared modules:**
- `js/media-source.js` — `MediaSource` class and `createSourceSelector()` factory. Handles camera, screen capture, video file, and image input with a unified API (`.drawable`, `.ready`, `.width`, `.height`). Every tool that processes media imports this.

**Shared styles:**
- `css/style.css` — single stylesheet for all tools. Defines CSS variables (`--bg`, `--surface`, `--border`, `--text`, `--mono`, `--sans`), the sidebar/canvas layout (`.tool-layout`, `.tool-sidebar`, `.tool-canvas-area`), and all control components (`.control-group`, `.radio-row`, `.range-row`, `.btn`, `.color-swatch-row`). Dark theme, monospace aesthetic.

**UI conventions:**
- Sidebar on left (280px) with controls, canvas fills remaining space
- Fullscreen toggle hides sidebar, shows an exit button on hover
- Range inputs have a `.range-value` span linked via `data-for` attribute
- Color palettes use editable swatches (click to change, right-click to remove, "+" to add)
- Every tool has Save PNG and Fullscreen buttons

**Current tools:** dithering, cellular-automata, gradient-map, shapes, text, pixel-flow

## Adding a New Tool

1. Create `tools/<name>/index.html` following the existing sidebar+canvas template
2. Create `tools/<name>/<name>.js` importing from `../../js/media-source.js`
3. Add a card to the root `index.html` tools grid
4. Use existing CSS classes — avoid tool-specific stylesheets
