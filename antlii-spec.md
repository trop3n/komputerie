# antlii.work — Tool Specification

Browser-based visual/creative tool collection. Static HTML/JS/CSS, no build system. 16 tools in `tools/`, shared code in `js/` and `css/`.

## Architecture

### Shared Modules

**`js/media-source.js`** — `MediaSource` class + `createSourceSelector(container, { transition } = {})` factory. Sources: camera, screen capture, video file, image file. Returns `{ mediaSource, onChange }`. The `transition` option accepts a DOM element and applies a CSS opacity fade on source change.

**`js/color.js`** — `parseColor(hex)`, `rgbStr(r,g,b)`, `rgbaStr(r,g,b,a)` with cached string pooling.

**`js/previews.js`** — `initPreviews()` drives animated canvas previews on the root index page.

**`css/style.css`** — Single stylesheet. CSS variables: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-dim`, `--accent`, `--mono`, `--sans`. Layout: `.tool-layout` (flex, 100vh), `.tool-sidebar` (280px fixed), `.tool-canvas-area` (flex:1, black bg).

### Conventions

- Every tool: `tools/<name>/index.html` + `tools/<name>/<name>.js`
- Sidebar on left, canvas fills remaining space
- Fullscreen toggles `.tool-layout.fullscreen` class
- Save PNG via `canvas.toBlob()` (async)
- Back link (`← Tools`) at top of sidebar
- Standalone tools (no media source): cellular-automata, srt2video, flipdigits
- WebGL tools: mesher, refract

---

## Tool Specs

### 1. Pixelator

**Dir:** `tools/pixelator/` | **Source:** media | **Canvas:** 2D

Downsamples media to a pixel grid, redraws using configurable shapes.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Pixel Size | range | 8 | 2–64 |
| Style | select | square | square, circle, diamond, cross, ascii |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Saturation | range | 0 | -100–100 |
| Outline | range | 0 | 0–4 (step 0.5) |

Notes: ASCII mode uses 10-char ramp `' .:-=+*#%@'`. Outline adds black stroke to circles/diamonds, gap to squares. Processing capped at 1024px wide.

---

### 2. Shapes

**Dir:** `tools/shapes/` | **Source:** media | **Canvas:** 2D

Media source rendered as a grid of vector shapes sized by luminance.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Shape | select | circle | circle, square, triangle, diamond, line, cross, ring, hexagon |
| Grid Size | radio | 16 | 4, 8, 16, 32, 64, 128 |
| Colors | color swatches | #fff, #000 | dynamic add/remove (min 1) |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Diversity | range | 50 | 0–100 |
| Simplification | range | 0 | 0–100 |

Notes: Diversity rotates shapes by luminance deviation. Simplification quantizes luminance steps. Output capped at 1024px.

---

### 3. Text

**Dir:** `tools/text/` | **Source:** media | **Canvas:** 2D

Overlays text characters colored by source pixels. Supports generators and glitch effects.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Text Source | select | custom | custom, lorem, binary, hex, alphabet |
| Custom Text | textarea | "Hello World" | — |
| Colors | color swatches | #fff | dynamic add/remove (min 1) |
| Font Size | range | 16 | 4–120 |
| Saturation | range | 0 | -100–100 |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Glitch | toggle btn | off | — |
| Colorize | toggle btn | off | — |

Notes: Glitch offsets ~2% of chars + 5 random scanline shifts. Colorize replaces source colors with palette. Generators: lorem (500 words), binary (2000 bits), hex (1000 digits), alphabet (500 chars). Processing capped at 640px.

---

### 4. Dithering

**Dir:** `tools/dithering/` | **Source:** media | **Canvas:** 2D

Applies dithering algorithms with configurable palette.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Algorithm | select | ordered | ordered, floyd-steinberg, atkinson, threshold, random |
| Dither Size | range | 4 | 1–16 |
| Levels | range | 4 | 2–16 |
| Colors | color swatches | #000, #fff | dynamic add/remove (min 2) |
| Blur | range | 0 | 0–10 (step 0.5) |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Saturation | range | 0 | -100–100 |
| Randomize | button | — | — |

Notes: Bayer matrix cached as Float32Array. Error-diffusion uses pre-allocated buffer. Processing capped at 480px. Randomize generates 2–5 random palette colors.

---

### 5. Gradient Map

**Dir:** `tools/gradient-map/` | **Source:** media | **Canvas:** 2D

Maps luminance to a multi-stop color gradient with presets.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Colors | color swatches | #000, #fff | dynamic add/remove (min 2) |
| Preset | select | custom | custom, duotone-blue, duotone-orange, tritone-sunset, cyberpunk, infrared, sepia, cyanotype, heatmap, neon-nights |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Mix | range | 100 | 0–100 |
| Randomize | button | — | — |

Notes: 256-entry LUT built from color stops. Mix blends gradient with original. Presets overwrite colors; manual edit switches to custom. Randomize sorts by luminance. Processing capped at 960px.

---

### 6. Video to MIDI

**Dir:** `tools/video2midi/` | **Source:** media | **Canvas:** 2D

Samples horizontal luminance points, maps to MIDI notes on a musical scale.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Sample Points | select | 16 | 8, 16, 32, 64 |
| MIDI Channel | select | Ch 1 | Ch 1, Ch 2, Ch 10/Drums |
| Base Note | range | 48 | 24–84 |
| Note Range | range | 24 | 12–48 |
| Threshold | range | 20 | 0–100 |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Scale | select | Major | Chromatic, Major, Minor, Pentatonic, Blues, Dorian |
| Connect MIDI | button | — | — |

Notes: Uses Web MIDI API for real hardware/software output. Note names drawn on canvas. All notes flushed on channel change and page unload.

---

### 7. Pixel Flow

**Dir:** `tools/pixel-flow/` | **Source:** media | **Canvas:** 2D

Particle flow visualization driven by source luminance gradients.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Flow Mode | select | Luminance | Luminance, Edge, Wind, Gravity, Spiral, Explode |
| Particle Count | select | 15000 | 5000, 15000, 30000, 60000 |
| Speed | range | 1 | 0.1–5 (step 0.1) |
| Particle Size | range | 1 | 1–6 (step 0.5) |
| Trail Length | range | 85 | 0–100 |
| Turbulence | range | 20 | 0–100 |
| Color Mode | select | Source | Source, Velocity, White, Rainbow |
| Reset | button | — | — |
| Pause | button | — | — |

Notes: Six flow modes. Particles reset after 300 frames or leaving bounds. Young particles fade in over 10 frames. Canvas adapts to source size (max 480px). **Space** toggles pause.

---

### 8. Rhythm

**Dir:** `tools/rhythm/` | **Source:** media | **Canvas:** 2D

Animated waveform lines with simplex noise, configurable gradient colors.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Source Influence | range | 0 | 0–100 |
| Waveform | radio | Noise | Noise, Sine, Square, Saw, Triangle |
| Line Count | range | 20 | 1–80 |
| Spacing | range | 8 | 1–50 |
| Amplitude | range | 100 | 0–300 |
| Frequency | range | 0.01 | 0.001–0.1 (step 0.001) |
| Speed | range | 1 | 0–5 (step 0.1) |
| Phase Offset | range | 0.1 | 0–1 (step 0.05) |
| Stroke Weight | range | 2 | 0.5–10 (step 0.5) |
| Stroke Opacity | range | 100 | 10–100 (step 5) |
| Cap | radio | Round | Round, Square |
| Gradient | radio | Linear | Linear, Radial, Wave |
| Hue Start | range | 200 | 0–360 (step 5) |
| Hue Range | range | 60 | 0–360 (step 5) |
| Saturation | range | 85 | 0–100 (step 5) |
| Lightness | range | 65 | 0–100 (step 5) |
| Cycle Colors | radio | Off | Off, On |
| Cycle Speed | range | 0.5 | 0.1–5 (step 0.1) |
| Background | color | #050505 | — |

Notes: Built-in simplex noise (2D/3D). Canvas adapts to source aspect ratio (max 800px). Source sampled every 5 frames at 200px wide.

---

### 9. Flake

**Dir:** `tools/flake/` | **Source:** media | **Canvas:** 2D

Tiled shape grid with noise-driven rotation, easing curves, swirl, mask, and motion.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Source Influence | range | 0 | 0–100 |
| Cells X | range | 10 | 2–40 |
| Cells Y | range | 10 | 2–40 |
| Seed | range | 0 | 0–100 |
| Cell Offset X | range | 0 | 0–1 (step 0.05) |
| Cell Offset Y | range | 0 | 0–1 (step 0.05) |
| Cell Rotation | range | 0 | 0–360 |
| Shape | select | Flake | Circle, Oval, Square, Triangle, Star, Cross, Heart, Arrow, Flower, Flake, Spark, Flash, Clips, Checker, Quad Circle, Three Dots, Pinhole |
| Scale | range | 0.75 | 0.05–2 (step 0.05) |
| Scale Power | range | 0 | 0–3 (step 0.1) |
| Scaling Ease | select | None | None, linear, sine in/out, quad in/out/in-out, cubic in/out/in-out, expo in/out/in-out, circ in/out/in-out |
| Base Rotation | range | 0 | 0–360 |
| Angle Multiplier | range | 1 | 0–4 (step 0.1) |
| Grid Map X | range | 6 | 0.5–20 (step 0.5) |
| Grid Map Y | range | 6 | 0.5–20 (step 0.5) |
| Symmetry | radio | Standard | Standard, Mirrored |
| Noise Layers | range | 4 | 1–8 |
| Base Frequency | range | 0.07 | 0.01–0.5 (step 0.01) |
| Amplify | range | 0.5 | 0.1–3 (step 0.1) |
| Freq Mode | radio | Cos | Cos, Sin |
| Branch Amount | range | 1 | 0–12 (step 0.1) |
| Freq Easing | select | None | (same as Scaling Ease options) |
| Swirl | radio | Off | Off, Rotary, Wave |
| Swirl Frequency | range | 1 | 0.1–5 (step 0.1) |
| Swirl Amplify | range | 0 | 0–5 (step 0.1) |
| Swirl Base | range | 0 | 0–1 (step 0.05) |
| Mask | radio | Off | Off, Parametric |
| Mask Branches | range | 6 | 1–12 |
| Roundness | range | 0 | 0–5 (step 0.1) |
| Mask Inner | range | 0.1 | 0–0.5 (step 0.01) |
| Mask Outer | range | 0.9 | 0.3–1.5 (step 0.01) |
| Motion | radio | Off | Off, Noise, Scale |
| Motion Speed | range | 0.5 | 0.1–3 (step 0.1) |
| Motion Amplify | range | 20 | 0–100 |
| Render | radio | Fill | Fill, Stroke, Mixed |
| Color Mode | radio | Transition | Solid, Sequence, Transition |
| Palette | color swatches | #6c5ce7, #fff, #b2bec3, #fdcb6e | dynamic add/remove |
| Blend Mode | select | Multiply | Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion, Lighter, XOR |
| Background | color | #ffffff | — |

Notes: 17 shape types. Multi-octave noise vector field. Brick-offset tessellation. Parametric polar-coordinate mask. Canvas adapts to source aspect ratio (max 800px).

---

### 10. Boids

**Dir:** `tools/boids/` | **Source:** media | **Canvas:** 2D

Flocking simulation with separation/alignment/cohesion, optional flow-field from media source.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Source Influence | range | 0 | 0–3 (step 0.1) |
| Count | range | 150 | 10–500 (step 10) |
| Boundary | radio | Wrap | Wrap, Bounce, Avoid |
| Separation Radius | range | 28 | 5–100 |
| Separation Weight | range | 1.5 | 0–5 (step 0.1) |
| Alignment Radius | range | 50 | 5–150 |
| Alignment Weight | range | 1.0 | 0–5 (step 0.1) |
| Cohesion Radius | range | 50 | 5–150 |
| Cohesion Weight | range | 1.0 | 0–5 (step 0.1) |
| Max Speed | range | 4 | 0.5–12 (step 0.5) |
| Min Speed | range | 0.5 | 0–5 (step 0.1) |
| Max Force | range | 0.15 | 0.01–0.8 (step 0.01) |
| Shape | radio | Triangle | Triangle, Circle, Line |
| Size | range | 8 | 2–30 |
| Trail | range | 20 | 1–255 |
| Color Mode | radio | Vel | Vel, Dir, Idx, Uni |
| Color (uniform) | color | #4a9eff | shown only when Uni |
| Hue Start | range | 200 | 0–360 (step 5) |
| Hue Range | range | 140 | 0–360 (step 5) |
| Saturation | range | 85 | 0–100 (step 5) |
| Lightness | range | 65 | 0–100 (step 5) |
| Opacity | range | 100 | 10–100 (step 5) |
| Background | color | #050505 | — |
| Scatter | button | — | — |

Notes: Flow field from source luminance gradients (perpendicular, contour-following). Updated every 10 frames. Canvas adapts to source aspect ratio (max 800px). Scatter randomizes positions and clears trails.

---

### 11. Blob Tracker

**Dir:** `tools/blob-tracker/` | **Source:** media | **Canvas:** 2D

Real-time blob detection and tracking with data-viz overlay. Tabbed sidebar (Video, Track, Style, Text, Lines).

| Control | Type | Default | Range |
|---------|------|---------|-------|
| **Video tab** | | | |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| **Track tab** | | | |
| Mode | radio | Threshold | Threshold, BG Sub, Color |
| Threshold | range | 128 | 0–255 |
| Invert | radio | Off | Off, On |
| Blur | range | 2 | 0–10 |
| Min Area | range | 100 | 10–5000 (step 10) |
| Max Blobs | range | 20 | 1–50 |
| Smoothing | range | 0.3 | 0–0.8 (step 0.1) |
| Hue Center | range | 0 | 0–360 (Color mode only) |
| Hue Range | range | 30 | 5–180 (Color mode only) |
| Min Saturation | range | 30 | 0–100 (Color mode only) |
| Capture BG | button | — | (BG Sub mode only) |
| **Style tab** | | | |
| Display | radio | Overlay | Overlay, Mask |
| Box Style | radio | Brackets | Brackets, Full |
| Dotted | radio | Off | Off, On |
| Thickness | range | 2 | 1–5 (step 0.5) |
| Fill Opacity | range | 6 | 0–30 |
| **Text tab** | | | |
| Labels | radio | On | On, Off |
| Metrics | radio | Off | Off, On |
| **Lines tab** | | | |
| Connections | radio | On | On, Off |
| Trail Length | range | 20 | 0–60 |
| Grid | radio | Off | Off, On |

Notes: Three detection modes (threshold, background subtraction, color range). Flood-fill connected components. Nearest-neighbor tracking with persistent IDs. 20-color palette for blob IDs. Processing at 320px max, upscaled with nearest-neighbor. Live FPS and blob count display.

---

### 12. Mesher

**Dir:** `tools/mesher/` | **Source:** media | **Canvas:** WebGL

Projection mapping with draggable control-point grids, multiple surfaces, quad/Bezier warp.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| + Add Surface | button | — | — |
| Duplicate | button | — | — |
| Surface List | dynamic list | — | select/visibility/delete |
| Warp Mode | radio | Quad | Quad, Bezier |
| Grid X | range | 1 | 1–8 |
| Grid Y | range | 1 | 1–8 |
| Subdivisions | range | 16 | 4–32 |
| Opacity | range | 1 | 0–1 (step 0.05) |
| Show Grid | radio | On | On, Off |
| Snap to Grid | radio | Off | Off, On |
| Save Config | button | — | localStorage |
| Load Config | button | — | localStorage |
| Reset | button | — | — |
| Output Mode | button | — | fullscreen + hide UI |

Notes: Dual-canvas (WebGL + 2D overlay). Multiple independent surfaces. Corner points green, interior light green, dragged red. Config persists to localStorage. WebGL context loss recovery. Canvas fixed at 1280x720. **Escape** exits both fullscreen and output mode.

---

### 13. Refract

**Dir:** `tools/refract/` | **Source:** media | **Canvas:** WebGL

Two-pass WebGL displacement + refraction grid effects.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Displace Mode | radio | Box | Box, Flow, Sine |
| Seed | range | 601 | 0–1000 |
| Content Scale X | range | 1 | 0.1–3 (step 0.05) |
| Content Scale Y | range | 1 | 0.1–3 (step 0.05) |
| Animate | radio | Off | Off, On |
| **Box mode** | | | |
| Amp X / Y | range | 3 / 3 | 0–20 (step 0.1) |
| Freq X / Y | range | 8 / 8 | 1–40 |
| Speed X / Y | range | 0 / 0 | 0–100 |
| **Flow mode** | | | |
| Complexity | range | 3 | 1–8 |
| Frequency | range | 3 | 0.5–20 (step 0.5) |
| Amp X / Y | range | 5 / 5 | 0–20 (step 0.1) |
| Speed X / Y | range | 0 / 0 | 0–100 |
| **Sine mode** | | | |
| Amp X / Y | range | 3 / 3 | 0–20 (step 0.1) |
| Freq X / Y | range | 8 / 8 | 1–40 |
| Speed X / Y | range | 0 / 0 | 0–100 |
| **Refraction** | | | |
| Mode | radio | Off | Off, Grid |
| Grid Amount X / Y | range | 20 / 20 | 2–60 |
| Skew X / Y | range | 1.25 / 1.25 | 0–5 (step 0.05) |

Notes: Pass 1 renders displacement to FBO. Pass 2 applies grid refraction or copies to screen. Box mode uses cell hash, Flow uses FBM/simplex noise, Sine uses sinusoidal displacement. Grid refraction tiles with barrel distortion. Mirror-wrap UV at edges. WebGL context loss recovery. Canvas fixed at 800x600.

---

### 14. Cellular Automata

**Dir:** `tools/cellular-automata/` | **Source:** standalone | **Canvas:** 2D

Grid-based automata simulator with 11 rules and interactive drawing.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Rule | select | game-of-life | game-of-life, highlife, seeds, brian-brain, day-night, diamoeba, anneal, morley, rule-30, rule-90, rule-110, perlin, plasma, feedback |
| Grid Size | select | 128 | 64, 128, 256, 512 |
| Palette | select | greyscale | greyscale, binary, fire, ocean, neon, pastel, rainbow, cyberpunk, earth, ice, acid, sunset, custom |
| Custom Colors | color swatches | #000, #0f0, #fff | dynamic add/remove (min 2, custom palette only) |
| Brush | radio | rect | rect, line, spray, smooth |
| Brush Size | range | 4 | 1–32 |
| Speed (FPS) | range | 15 | 1–60 |
| Effects: Noise | button | — | 5% random perturbation |
| Effects: Invert | button | — | 255 - val |
| Effects: Glitch | button | — | random row shifts |
| Effects: Blur | button | — | neighbor average |
| Generate | button | — | randomize grid |
| Clear | button | — | zero grid |
| Pause / Play | button | Pause | toggle |

Notes: Toroidal wrapping. 1D rules (30/90/110) scroll top-to-bottom. Mouse drawing with 4 brush types. Save exports upscaled to >=1024px. Crosshair cursor on canvas. **Space** toggles pause.

---

### 15. SRT to Video

**Dir:** `tools/srt2video/` | **Source:** standalone | **Canvas:** 2D

SRT subtitle renderer with playback controls and timeline scrubbing.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| SRT File | file input | — | .srt files |
| Font Size | range | 36 | 12–120 |
| Font | select | Monospace | Monospace, Sans-serif, Serif, Courier New, Georgia |
| Text Color | color | #fff | — |
| Background | color | #000 | — |
| Brightness | range | 0 | -100–100 |
| Contrast | range | 0 | -100–100 |
| Show Time Gaps | radio | Off | Off, On |
| Play | button | — | — |
| Pause | button | — | — |
| Restart | button | — | — |
| Timeline | range | 0 | 0–totalDuration ms |

Notes: Word wraps at 85% canvas width. Gap indicator shows countdown to next subtitle. 4px progress bar. Auto-stop at end. Canvas fixed at 800x450. **Space** toggles play/pause.

---

### 16. Flipdigits Player

**Dir:** `tools/flipdigits/` | **Source:** media | **Canvas:** 2D

Media source rendered as a flip-dot display with animated transitions.

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Columns | range | 28 | 4–80 |
| Rows | range | 14 | 4–60 |
| Flip Speed | range | 8 | 1–20 |
| Dot Style | select | flip | flip, round, square, led |
| Active Color | color | #cccc00 | — |
| Threshold | range | 128 | 0–255 |

Notes: Flip style simulates 3D flip with vertical squash + highlight. LED style adds glow halo. Off color hardcoded to rgb(30,30,30). Grid lines at 30% opacity. Canvas sized from cols/rows. Inactive dot color hardcoded to `#111111`.

---

## Canvas Dimensions

| Tool | Size | Adaptive |
|------|------|----------|
| Pixelator | source-based | yes |
| Shapes | source-based (max 1024) | yes |
| Text | source-based (max 640) | yes |
| Dithering | source-based (max 480) | yes |
| Gradient Map | source-based (max 960) | yes |
| Video to MIDI | source-based (max 480) | yes |
| Pixel Flow | source-based (max 480) | yes |
| Rhythm | source aspect ratio (max 800) | yes |
| Flake | source aspect ratio (max 800) | yes |
| Boids | source aspect ratio (max 800) | yes |
| Blob Tracker | source-based (max 320) | yes |
| Mesher | 1280x720 | fixed |
| Refract | 800x600 | fixed |
| Cellular Automata | grid size (64–512) | user-selected |
| SRT to Video | 800x450 | fixed |
| Flipdigits | computed from cols/rows | user-selected |

## Keyboard Shortcuts

| Key | Tools | Action |
|-----|-------|--------|
| Escape | all | Exit fullscreen |
| Space | srt2video, cellular-automata, pixel-flow | Toggle play/pause |
