# antlii.work — Per-Tool Spec Sheets (Phase 1 audit)

Ground-truth audit of the live antlii.work tool suite (Anatolii Babii / "Antlii"), captured 2026-05-20 via browser. This is the authoritative requirements source for the recreation; it supersedes the code-derived `antlii-spec.md`. See `antlii-recreation-plan.md` for the roadmap.

**Method:** each tool's own OVERVIEW description (inputs, modes, export, presets, interactions) was captured from its program page; FLAKE and BOIDS were additionally inspected at the control-tree level. Exhaustive per-parameter tables are deferred to each tool's build phase (captured live by expanding tabs then) — Phase 1 fixes *what each tool is* and *how the suite is built*.

## Shared architecture (consistent across the suite)

- **Stack:** p5.js for rendering. The control panel is almost certainly **Tweakpane** (interface library by Hiroki Kokubun, credited by SKAAAN): Tweakpane *tabs* = `MAIN / EXPORT / OPTIONS / LICENSE`; Tweakpane *folders* = the per-tool collapsible sections; *number bindings* = the numeric textbox inputs; *list bindings* = the dropdowns.
- **Vector layer:** Paper.js / SVG geometry for the shape & type tools (FLAKE, RASTR, SAMPL, TEXTR, SPLITX; partial BLUUR).
- **Shaders (GLSL):** DITHR (gradient maps), BLUUR (noise textures), REFRACT (displacement/refraction).
- **3D (p5 WebGL):** DITHR (OBJ model import + lighting + animation), PLAIN (low-poly plane mesh).
- **Universal:** named Preset List + Restart + **JSON preset import/export** (custom SVGs/masks embedded in preset); Randomize / seed system; fullscreen; a license layer ("(Tool) (Unlicensed)" badge, LICENSE tab; SKAAAN notes free non-commercial use).
- **Inputs (per tool):** image upload, **Unsplash** fetch (REFRACT, DRIFT, others), custom **SVG** drag-drop (FLAKE, SPLITX, BLUUR), **Google + custom fonts** (RASTR, SAMPL, TEXTR), 3D **OBJ** (DITHR), raster **image mask** (FLAKE).
- **Export matrix:** PNG (all, multi-resolution); **SVG** (FLAKE, RASTR, SAMPL, TEXTR, SPLITX); **MP4 + PNG/WebP frame sequences** (the animation tools); single-PNG only (KLON, SKAAAN).

## Per-tool sheets

### FLAKE — v0.39 · *audited deeply*
Generative symmetrical vector patterns on a grid, SDF-inspired (distance-to-tile-center drives scale/color/transform). Tabs: CANVAS/STYLE/PATTERN/SHAPE/NOISE/SWIRL/MASK/MOTION/RANDOM. Inputs: shape library + custom SVG drag-drop + raster image mask (brightness/alpha modulates pattern). 30 presets. Export: SVG, MP4, PNG/WebP sequences. → **rework** of recreation `Flake` (closest existing match).

### BOIDS — v0.22 · *audited deeply*
p5.js flocking sim (separation/alignment/cohesion), based on Daniel Huang's Boids. Tabs: CANVAS/SHAPE/COLOR/FLOCKING/SIMULATION. Shape Type Mixed/Ellipse/Rectangle/Triangle; Skew Mode (speed/angle) + level/reaction; Scale Randomization; Random Seed. 11 presets. → **rework** of recreation `Boids`.

### DITHR — v0.28
Rasterization of **3D OBJ models, video (MP4/MOV/WebM), and raster images**. Algorithms: ASCII (built-in fonts), ordered (Bayer matrices), basic halftone, **CMYK halftone**, blue-noise **void-and-cluster**. **WebGL-shader gradient maps**. 3D model interaction + basic lighting + object animation. Export: PNG (multi-res) + MP4/WebM (for 3D/video). JSON presets. → far beyond recreation `Dithering`; **major rework / near-new**.

### REFRACT — v0.24
Image displacement + simple refraction (shaders). Inputs: upload or **Unsplash**. Output: video clips or stills. JSON presets. → **rework** of recreation `Refract` (add Unsplash, video export).

### RITM — v0.59
Abstract waveform graphics via **Simplex noise** + generative color-palette system. Animation loops + stills capture. JSON presets. → cleanest match to recreation `Rhythm`; **rework**.

### RASTR — v0.32  *(NOT a pixelator)*
Transforms **written text** into geometric/kinetic compositions via custom rasterization: canvas split into cells (Rasterization Quality), each text-bearing cell renders a styleable/animated shape. Custom + Google Fonts. `\n` for manual line breaks. Export: SVG, PNG, MP4, WebP sequences (static vs realtime auto-switch; Select Frame). JSON presets. → **new** (type→shape-grid); loosely overlaps `Shapes`/`Text`.

### DRIFT — v0.25
Realtime evolving visuals from bitmap (upload/**Unsplash**). User selects/resizes an image area → tool copies it into a `Form` shape and animates it (repeat/move/transform) via Form + Animation params. Hotkey-driven (H = help). ~dozen presets, import/export. → **new** (area-copy-animate); not the same as `Pixel Flow`.

### BIOM — v0.16
Organic, cell-like **visual growth** via form repetition + soft color transitions, framed in a customizable **Swiss-style poster** layout. Hi-res animation/stills export. JSON presets. → **new** (generative poster art); not cellular-automata.

### SAMPL — v0.36 · *vector typography*
Each glyph → vector outline; points sampled along outline become anchors for geometric shapes (amount/size/rotation/color/movement). Fills: primitives, gradients, image-based. Animation engine (position/scale/rotation). Google + custom (drag-drop) fonts. Export: SVG, MP4, PNG/WebP. JSON presets. → **new/major** (loosely overlaps `Shapes`).

### TEXTR — v0.32 · *vector typography*
Text → vector paths; duplicate/distribute as words or individual letters with extensive transforms. Google + custom (drag-drop) fonts. Export: SVG, MP4, PNG/WebP. JSON presets. → **new/major** (overlaps recreation `Text`, but vector).

### SPLITX — v0.25
Built-in vector shapes or custom **SVG** → dynamic compositions via duplication/offset/scale/rotation driven by noise + trig. Signature: **split canvas H / V / quad with mirroring** (kaleidoscope). Interactive mouse/touch shape transforms; SVG drag-drop. Export: SVG, MP4, PNG/WebP. Presets. → **new**.

### BLUUR — v0.25
Blur/color/shape **fusion**: built-in shape or custom SVG(s) (multi, sortable asc/desc/random) merge through blur levels; color shifts across animation cycle. **GLSL noise** + multiple blend modes. 6 form tabs (count/size/offset/angle/blur/color-blend) each with Random Settings; Random Seed + master Noise Seed. PALETTE section: **Predefined (150) / Custom (Populate+shuffle) / Procedural** (Inigo Quilez cosine palettes, per-RGB tuning); Blend Range + Blend Mode in COL tab. Export: PNG, MP4, PNG/WebP. JSON presets (SVGs embedded). → **new**.

### KLON — v0.33
Collage/mashup from images via interactive **grid "slice brush"**: pick an area of a source image, paint with it, snap to grid; block-based compositions. Hotkeys (C/M/S/A/E/I/D/T/R/G/H, arrow keys for grid spacing). PNG download. → **new**.

### SKAAAN — v0.x
Interactive **slit-scan** image distortion: upload image, Start/Stop scan (Spacebar), drag mouse over image to distort, Restart (R), Download PNG (D). Desktop/Chrome; JPG/PNG/WebP w/ transparency. Uses a creative-coding lib + Jonas Wagner's algorithm + **Tweakpane**. Free for non-commercial use. → **new**.

### STIIL — v0.37
Abstract graphics / generative visuals from imported images with a variety of artistic effects; dense but preset-driven UI. JSON presets. *(Description is high-level; needs a control-tree pass at build time to enumerate effects.)* → **new**.

### PLAIN — v0.69
Interactive **low-poly 3D plane** graphics: vertex geometry + Simplex noise → abstract forms, extensive animation params. Loops + stills capture. JSON presets. Fullscreen recommended. → **new** (p5 WebGL 3D).

## Corrected real → recreation mapping

| Real tool | Disposition | Existing code to reuse |
|---|---|---|
| FLAKE | rework | `Flake` (good base) |
| BOIDS | rework | `Boids` (good base) |
| REFRACT | rework | `Refract` (good base) |
| RITM | rework | `Rhythm` (good base) |
| DITHR | major rework | `Dithering` (concepts only; add 3D/video/CMYK/blue-noise/shaders) |
| TEXTR | new (vector) | `Text` (concept only) |
| SAMPL | new (vector) | `Shapes` (concept only) |
| RASTR | new (vector type) | partial `Text`/`Shapes` |
| DRIFT | new | — |
| BIOM | new | — |
| SPLITX | new | — |
| BLUUR | new | — |
| KLON | new | — |
| SKAAAN | new | — |
| STIIL | new | — |
| PLAIN | new (3D) | — |
| **keep (no antlii match)** | Mesher, Blob Tracker, Video2MIDI, SRT2Video, Flipdigits, Gradient Map, Pixelator, Pixel Flow, Cellular Automata | retained per user — additive superset, drop nothing |

## Scope implications (revised)

- **Only ~4 tools are clean reuses** (FLAKE, BOIDS, REFRACT, RITM). DITHR is a major rework. **~11 are effectively net-new** — dominated by vector-shape (SVG), typography (glyph sampling), image-manipulation (KLON/SKAAAN/DRIFT/STIIL), and 3D (DITHR-OBJ, PLAIN) tools that don't map onto the current raster effects. So "match antlii exactly" ≈ a ground-up suite build that reuses little existing code.
- **Recommended stack:** p5.js + **Tweakpane** (matches the suite's UX natively) + Paper.js (vector) + GLSL (shader tools). This should anchor the Phase-2 shared-infra design.
- **Scope is an additive superset (user decision 2026-05-20):** keep ALL current tools (including Pixelator, Pixel Flow, Cellular Automata, and the six earlier flagged for drop); add the net-new antlii tools on the new stack. Overlapping tools (Flake/Boids/Refract/Rhythm/Dithering) are reworked toward their antlii equivalents. RITM is net-new, so Rhythm is unaffected.
- **Per-parameter tables still pending** for STIIL (thin description) and the full tab trees of every tool — captured at each tool's build phase.

## Open questions for the user
1. **Stack confirmation:** adopt Tweakpane + p5.js (+ Paper.js/GLSL) to match the suite natively? (Reinforces the Phase-0 "no-build vs bundler" decision — Tweakpane/p5/Paper all load via CDN/ESM.)
2. **Expanded drop list:** also drop Pixelator, Pixel Flow, Cellular Automata (no antlii counterpart)?
3. **3D scope:** DITHR (OBJ import) and PLAIN (low-poly mesh) need p5 WebGL 3D — in scope now, or defer as a later wave?
4. **Build order:** start the Phase-3 vertical slice with FLAKE (vector, most complex) as planned, or prove the stack on an easier clean-reuse tool (RITM/REFRACT) first?
