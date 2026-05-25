# Handoff.md — antlii-stack faithful-recreation playbook

Living doc for porting the **antlii-stack tools** (the non-"classic" suite) into faithful homages of the originals at antlii.work. One tool per session; update the **Progress tracker** + **Session log** at the bottom when you finish one, so the next session starts fresh with current state.

> Read `CLAUDE.md` (architecture) and `AGENTS.md` first. The legacy raster-tool cleanup that previously lived in this file is in git history.

---

## The core insight (why this works now)

The earlier v1 tools were built from a *written spec* (`antlii-tool-specs.md`) and diverge **structurally** from the originals — different algorithms, not just different tuning. But **antlii ships the full, unminified, modular source of every tool on GitHub Pages.** antlii.work is just a Cargo portfolio that iframes those apps. So we can read the *actual* algorithm and validate our build visually against the live tool. See memory `antlii-source-readable`.

- Tool apps: `https://antlii.github.io/<slug>/` (e.g. `flake-tool`, `boids-tool`, `sampl-tool`, `textr-tool`).
- Per-tool scripts: `https://antlii.github.io/<slug>/scripts/*.js`.
- Shared assets: `https://antlii.github.io/assets/...` (libs, `json/1000-color-palettes.json`).

**Real stack:** p5.js 1.11.2 · Tweakpane 3.1.10 (+essentials/infodump/textarea) · Paper.js 0.12.18 (custom-SVG import + SVG export only) · simplex-noise (4D) seeded by alea · h264-mp4-encoder + p5.capture for MP4.

---

## IP posture (decided with the user — hold this line)

**Study & reimplement** — faithful *behaviour*, original *assets*.
- ✅ Match: algorithms, parameter taxonomy, defaults, ranges, easing, interaction model, render cadence. These are functional.
- ✅ Write our own implementation on our shell.
- ❌ Do NOT copy verbatim: preset **names**, the curated `1000-color-palettes.json`, bespoke shape **art**, branding, the watermark/license/embed-protect scripts. Author our own preset names, palettes, and shape paths.

---

## The shared foundation (`js/antlii/`) — reuse, don't reinvent

| Module | API | Use for |
|---|---|---|
| `shell.js` | `createTool({name,version,backHref})` → `{root, pane, pages:{main,export,options}, canvasHost, startSketch(factory), mountCanvas(), getCanvas(), toggleFullscreen()}` | Every tool. `startSketch` = p5 instance mode; `mountCanvas` = bare canvas for Paper. |
| `export.js` | `attachExport(page, {getCanvas, getSVG?, name})` | PNG (multi-res) + SVG (if `getSVG`) + video (WebM/MP4) + frame-zip. Free for every tool. |
| `presets.js` | `attachPresets(page, {pane, params, presets, randomize?, onApply?})` | Simple flat presets (shallow `Object.assign`). For **nested** state use FLAKE's clean-slate deep-merge pattern (copy it from `flake.js`). |
| `noise.js` | `seedNoise(seed)`, `noise2D/3D/4D(...)`, `alea(seed)→rng` | Seedable simplex. **4D** is for looped motion (2 dims animate). Vendored `simplex-noise` under `js/vendor/simplex/`. |
| `palette.js` | `PALETTES`, `randomPalette(rng?)`, `buildLayers(colors,layers,rng)`, `toTransitionStops(colors)`, `paletteLerp(stops,t)`, `interpolateHex`, `pickColor`, `attachPaletteControls(folder,{palette,pane,onChange})` | Color modes (solid/sequence/transition), curated palettes, swatch + Random/Shuffle UI. |
| `shapes.js` | `SHAPE_OPTS`, `makeShape(type,size)` (Paper item) | Vector tools. |
| `typography.js` | `FONT_OPTIONS`, `loadFont(name)`, `parseFont(buf)`, `textUnits(font,text,size,mode)` | Type tools. |

**Panel:** Tweakpane **4** + an antlii-style dark/compact theme in `css/style.css` (`.antlii-pane { --tp-* }`). We stayed on TP4 (no downgrade); use `addBinding`. For multi-button rows / swatches, use `attachPaletteControls` or plain `addButton`s (the TP3 buttongrid/infodump/textarea plugins are not available).

---

## The method (step by step)

### 0. Setup
- Serve: `python3 -m http.server 8000` (from repo root). Hard-refresh after editing shared modules (no cache headers).
- Playwright MCP is the validation tool. The live antlii tools and `localhost` are both reachable.

### 1. Find & download the real source
Identify the live slug (usually `<name>-tool` or `<name>`), then **confirm it exists** — navigate Playwright to `https://antlii.github.io/<slug>/`. If antlii has no such tool, it's an original Ksawery tool: build by inspiration, note it, skip the source steps.

Get the exact script list (it varies per tool) from the page's network requests, or curl the index and grep `<script src>`. Then download to `/tmp` (reference only — never commit antlii source):
```bash
curl -sS --create-dirs -o "/tmp/antlii-ref/<slug>/scripts/#1.js" \
  "https://antlii.github.io/<slug>/scripts/{var,ui,presets,preset,ease,palette,random,path,svg,image,system,export,events,main}.js"
curl -sS --create-dirs -o "/tmp/antlii-ref/<slug>/index.html" "https://antlii.github.io/<slug>/"
```

### 2. Study — build an accurate mental model
Typical module roles (FLAKE's set; others differ):
- `var.js` — params object with **defaults**, enums/option maps, shape data, preset-name list.
- `ui.js` — every Tweakpane control: exact **ranges/steps**, folder structure.
- `main.js` — `setup`/`draw`, the core algorithm (the heart).
- `presets.js` — named-preset values (study structure; author your own).
- `system.js` — canvas/`gForm` setup, resolutions, pixel density.
- `ease.js`, `palette.js`, `random.js` (randomizer), `path.js`, `svg.js`, `image.js`, `export.js`, `events.js`.

Write down: the algorithm, the full param model + defaults + ranges, the panel layout (tabs/folders), the export options, and **one concrete preset** to use as an A/B target (read its exact values from `presets.js`).

### 3. Reimplement on the shell
- Copy the closest tool-type template: raster → `ritm`, vector → `splitx`, shader → `refract-tool`, type → `textr`, image-manip → `skaaan`, simulation → (see FLAKE/`boids-tool`).
- `tools/<name>/index.html`: TP4 import map + the global libs it needs (p5 / paper-full / opentype) + `<script type="module" src="<name>.js">`.
- `tools/<name>/<name>.js`: `createTool(...)`, build folders/bindings on `pages.main` with the **real ranges/defaults**, `attachExport` (+ `getSVG` for vector), reuse `noise`/`palette`/`shapes`/`typography`. Render via `startSketch` (p5) or `mountCanvas` (Paper).
- Use the real **numeric defaults** (functional). Use **original** preset names/palettes/shape art.
- Leave a dev hook (`window.__<name> = { applyPreset, ...state, renderSVG }`) for A/B testing.

### 4. Validate against the live tool (the key step)
- Serve locally; open `http://localhost:8000/tools/<name>/`. Check console = 0 errors.
- Open the live tool; its top-level functions are global — drive it with `window.loadPreset('<presetKey>')` (preset keys are in the live `var.js` `presetTypes`). Screenshot.
- Set your build to the **same preset values** (via the dev hook) and screenshot. Compare **structure/character** (topology, density, symmetry, color behaviour). The fine noise texture will differ — that's fine.
- Iterate until it's clearly the same family. Save A/B images to `/tmp/antlii-ref/compare/`.

### 5. Finish fully
- Presets (original names) applying onto a **clean default slate**; a striking default; SVG export (vector); drag-drop (custom SVG / image mask) where the original has it; verify across several presets with 0 console errors.
- Add the tool's card to `index.html` + a preview to `js/antlii/previews.js`.
- Move dev screenshots out of the repo (`/tmp/antlii-ref/compare/`); `git status` should show only intended files. **Never `rm -rf` a tracked dir** (the repo tracks `.playwright-mcp/`).

### 6. Update state
- Update the **Progress tracker** + **Session log** below.
- Update memory: `antlii-build-progress` (+ create/adjust others as needed).

---

## Worked example — FLAKE (the template, ✅ complete)

**What it is:** a dense shuffled point field (~5–16k stamps) where ONE alea-seeded **4D-simplex** sample per point drives BOTH the stamp's *size* (a triangle wave within each palette band → concentric rings) AND its *color*, with radial **branch symmetry**, swirl, a parametric polar mask, a raster image mask, and looped motion. Shapes blend on a transparent buffer, then composite over the bg. Paper.js only normalizes dropped custom SVGs.

**Validated:** A/B against the live "Quantum Processing" preset (`window.loadPreset('staticQuantumProcessing')`) — same nested-square rings, quad-dot XOR texture, 3×3 tiling. Images in `/tmp/antlii-ref/compare/`.

**Files:** `tools/flake-tool/{index.html,flake.js}`. It dogfoods the shared `noise` (4D) + `palette` (swatches/Random) + TP4 theme. Note the render-space pattern: compute in a fixed ratio resolution (`gForm`), composite, and CSS-fit the canvas to the viewport so parameter magnitudes match the reference.

---

## Conventions & gotchas

- **No bundler/build**, ever. CDN + import maps; vendored libs (`js/vendor/`) for offline-safe pieces.
- One shared stylesheet (`css/style.css`); no per-tool CSS.
- **Comment-light** code; each `js/antlii/` module gets a short header.
- Verify in a browser via Playwright — there are no tests.
- Cache: `http.server` sends no cache headers → hard-refresh / fresh tab after editing shared modules; confirm a change took by reading state through the dev hook.
- Module-scoped consts aren't on `window` — expose a dev hook for testing, remove before any "ship".
- Tweakpane bindings hold the **object reference** — to swap preset state, mutate objects **in place** (don't reassign `params.x`/`palette.array`), or bindings detach. FLAKE's `resetToDefaults`/`applyPreset` show the in-place deep-merge pattern.

---

## Progress tracker

Foundation: ✅ noise (2D/3D/**4D** + alea, vendored simplex) · ✅ palette system + swatch UI · ✅ TP4 antlii theme. Optional/deferred: h264-mp4-encoder export (ffmpeg.wasm works), generalized clean-slate `presets.js`.

Inventory verified 2026-05-24 (HTTP check of `antlii.github.io/<slug>/`). **12 of 16 have live antlii sources** to port faithfully (FLAKE + SPLITX + BOIDS + BLUUR + TEXTR done → 7 to go). The other 4 return 404 under every plausible slug — no live original, so treat them as original Ksawery tools (build by inspiration; no A/B possible).

| Tool | dir | type | live source | status |
|---|---|---|---|---|
| FLAKE | `flake-tool` | vector/raster | `flake-tool` ✓ | ✅ complete + validated |
| SPLITX | `splitx` | raster+SVG | `splitx-tool` ✓ | ✅ complete + validated |
| BOIDS | `boids-tool` | simulation | `boids-tool` ✓ | ✅ complete + validated |
| BLUUR | `bluur` | shader | `bluur-tool` ✓ | ✅ complete + validated |
| TEXTR | `textr` | type | `textr-tool` ✓ | ✅ complete + validated |
| SAMPL | `sampl` | type | `sampl-tool` ✓ | ⏳ port |
| RASTR | `rastr` | type | `rastr-tool` ✓ | ⏳ port |
| DITHR | `dithr` | raster | `dithr-tool` ✓ | ⏳ port |
| BIOM | `biom` | generative | `biom-tool` ✓ | ⏳ port |
| DRIFT | `drift` | image-manip | `drift-tool` ✓ | ⏳ port |
| KLON | `klon` | image-manip | `klon-tool` ✓ | ⏳ port |
| SKAAAN | `skaaan` | image-manip | `skaaan-tool` ✓ | ⏳ port |
| RITM | `ritm` | raster | — none | ⚪ original Ksawery tool |
| REFRACT | `refract-tool` | shader | — none | ⚪ original Ksawery tool |
| PLAIN | `plain` | p5 3D | — none | ⚪ original Ksawery tool |
| STIIL | `stiil` | image-manip | — none | ⚪ original Ksawery tool |

---

## Session log

- **2026-05-24** — Discovered antlii source is open; established the method. Re-ported **FLAKE** end-to-end (engine, masks, SVG export, custom-SVG drop, 8 presets) and validated A/B. Re-aligned the foundation: `noise.js` 4D+alea (vendored simplex), `palette.js` system + swatch UI, TP4 antlii theme in `css/style.css`. FLAKE dogfoods all three; RITM/SPLITX confirmed unbroken. **Next:** pick a tool from the tracker and run the method.
- **2026-05-25** — Re-ported **SPLITX** end-to-end. The v1 was structurally wrong (radial golden-angle scatter on Paper.js); the real engine stamps ONE base shape `form.count.base`× into an offscreen buffer — each stamp transformed by a *sequenced* base scale (`form.sequence`) + per-channel noise/sin **scale / xmove / ymove / rotate** (each with amp·freq·cycle·phase·speed·seed, ordered forward/backward/equal) + a linear **transition** spread — then the buffer is **split-mirrored** (none/H/V/quad) by clipping each cell and flipping ±1. Colour modes: XOR-cutout (`globalCompositeOperation='xor'`, single palette colour), Sequence, Transition (RGB / LAB). Live render = p5 `createGraphics` buffers + `drawingContext.fill(Path2D,'evenodd')`; **SVG export = Paper.js reconstruction** of the same `formData` (CompoundPath + clip layers), the only faithful way to bake per-stamp transforms + the XOR compound path. Notes: gForm/gDraw run `angleMode(DEGREES)`; `ymove` amplitude multiplies by `formData.width` (not height) — replicated as-is. Authored own shape library (rect/circle/ring/oval/triangle/rhombus/cross/star/hexagon/petals/checker/blob + custom-SVG drop), 6 original-named presets (2 reuse real numeric configs w/ own palettes), original LAB transition (vs their Color.js LCH). Validated A/B vs live `splitVibration` (clean match — orange/black XOR quad-X moiré) and `lotusMetamorphosis` (same family). All 6 presets + every colour mode + all splits + animation + transparent-checker bg + SVG export = 0 console errors. Updated landing preview (`previews.js`) to the nested-contour quad-X. **Next:** pick a tool from the tracker (BOIDS / BLUUR / TEXTR / …) and run the method.
- **2026-05-25** — Re-ported **BOIDS** end-to-end. Real engine = a Reynolds flock (alignment / cohesion / separation, each `setMag(speedMax).sub(vel).max(steering)`, weighted by an **alignment bias** `bias ** (otherVel·thisVel)`) over a 3×3 **spatial-hash grid**, with neighbour **subsampling by `accuracy`** (`step = ceil(candidateCount / 2**accuracy)`), edge **wrap or repel**, mouse attract/repel, per-boid **noise wander**, velocity **drag**, and `lerpAngle` heading easing. Shapes (ellipse/rect/triangle/mixed) are oriented to velocity, **scale-randomised**, **skewed** by speed or angle, and rendered either as vector fill+stroke or as **clipped windows into a dropped image**; colour modes none/single/interp-by-(random/speed/angle). The whole `params → g` derivation lives in `syncGlobals` (vision = `vision·min(w,h)/100`, scale = `10·((w+h)/1280)·scale`, etc.); arrays (pos/vel/type/scale/colour) are p5-`randomSeed`-seeded, sized to `boids.max`, and boids index into them. The V2D class + flock math are adapted from Daniel Huang's MIT boids (the basis antlii credits) — kept attribution. **Port specifics:** runs on the shared p5 shell (instance mode → all p5 calls via a module-level `P`); simulation renders directly on the render-space canvas (CSS-fit), no separate gForm. **Two gotchas:** (1) `params.speed.value` is an interval `{min,max}` that the reference binds with the TP3 Essentials *interval* slider — we lack it, so split into two Speed Min/Max sliders. (2) p5 runs `setup()` **synchronously inside `new p5()`** on some loads but not others → the module-end `applyPreset()` raced `P`/`presets` init (TDZ or null-`P`); fixed by deferring the initial preset to the **first `draw()` tick** via a `pendingPreset` flag (a reusable pattern for shell tools that need post-init bootstrap). We ship **no texture** (antlii's is their asset) → default to vector render + colour bg; drop an image for the texture modes (render=image clips the shape and `copy()`s a window of the image; bg=image draws it; transparent bg = CSS checker on a cleared canvas so PNG export stays transparent). Authored 7 original-named presets (the two image-render originals — jellyGeometry/severance — retuned to vector); **Jelly Bloom** needed a scale/count drop (the original relied on a translucent texture). Validated A/B vs live `defaultPreset` (same 2500-triangle repel-flock behaviour) + `coralStream`/`jellyGeometry` family; speed-colour+speed-skew (fluid streaks) and angle-colour+angle-skew (flow-field) both confirmed. All 7 presets + every shape/colour/edge/ratio + animation = 0 console errors. BOIDS needs only p5 (no Paper/SVG; reference disabled SVG too). Landing card + flocking preview already fit — left as-is. **Next:** pick a tool from the tracker (BLUUR shader / TEXTR type / DITHR raster / …) and run the method.
- **2026-05-25** — Re-ported **BLUUR** end-to-end (v1 was a metaball-field GLSL shader — structurally wrong). **Key insight:** despite the "shader" label, BLUUR's *engine* is a 2D-canvas tool — the reference draws a shuffled grid of forms onto a 2D `gForm` buffer using a **per-shape `ctx.filter = blur(Npx)`** (the signature soft-overlap look) + a per-form `globalCompositeOperation` (blend mode) + Inigo-Quilez **cosine-palette** colours; GLSL is used *only* for the post pass (full-screen gaussian blur + brightness/contrast + film grain). So I ran the whole pipeline on 2D canvas: per-shape blur + blend (heart), then post fx as behaviorally-equivalent native filters (`blur()`+`contrast()`+`brightness()`) + a procedural per-pixel **grain** overlay mixed at its opacity. Ported faithfully: the grid→shuffle→`createForms` per-form noise model (corners/size/angle/offset/blur/blend each seeded by `cnv.seed.base` simplex with per-channel coord offsets), `formCoords/Size/Blur/Color`, `map2` easing, all 12 blend modes → canvas composite ops, the cosine palette (`generatePalette`) + a Lab custom-palette interp (vs their Color.js LCH), palette-derived **pale bg** (own lighten-toward-white method vs their oklch), the full randomizer suite, and custom-SVG drag-drop (Paper-parsed → shape entries; reference's asc/desc/random sort). State objects are shaped **exactly like the reference** (`cnv/form/post/palette/svg/rec`) so reference-style preset objects deep-merge onto a clean-slate default; the dev hook `window.__bluur.applyPreset()` accepts a live antlii preset verbatim for A/B. **Port specifics:** responsive ratio-locked canvas (gForm == display size) so absolute per-form blur-px tracks the reference's own window-size-dependent blur ratio; deferred the opening preset to the first `draw()` tick via `pendingPreset` (the BOIDS init-race pattern). Dropped the `defined`/150-palette mode (antlii's curated JSON — IP) → Procedural + Custom only. Authored 6 original-named presets (Prism Stacks reuses the real `prismaticForms` numeric config w/ own palette handling; others original). Validated A/B vs live `loadPreset('prismaticForms')` — same family (vertical 1×6 stack of heavy-blur soft forms, EXCLUSION colour-mixing, pale-yellow palette ground; exact hues differ since our simplex permutation differs — expected). Citrus Haze (custom MULTIPLY) + Solar Tiles (8×8 BLEND tile grid) + all 6 presets render with **0 console errors**. Updated landing card copy + preview (warm overlapping blurred forms, multiply, pale ground). **Gotcha learned:** OVERLAY/soft blends over a transparent buffer + pale generative colours wash out — authored presets need a covering blend (BLEND/MULTIPLY) or saturated colours. **Next:** pick a tool from the tracker (TEXTR type / SAMPL type / RASTR type / DITHR raster / BIOM / DRIFT / KLON / SKAAAN) and run the method.
- **2026-05-25** — Re-ported **TEXTR** end-to-end (v1 was a ring/grid letter scatter — structurally wrong). Most intricate engine so far: a phrase becomes a **stack of rows** (vertical) or **row of columns** (horizontal) of repeated words/letters; each row's **count** follows an order pattern (none/forward/backward/**backforth**/random → the text mass forms diamonds/hourglasses), and every copy is displaced **perpendicular** to the layout axis by a **sin / doublesin / 4D-noise** wave whose phase comes from the copy index AND the row's position (`yFreq = map(rowPos,0,cnvsize,-PI,PI)*freqY`) → a travelling wave; plus per-copy **scale** modulation, an **amp-easing** envelope (uniform/center/edge/side), **collision** spacing, infinite **scroll**. Ported the full `getTextBounds → generateForms → Form{scroll,update,motion,freqFunction,ampEase,collision,display,getOrderRange}` pipeline + all 24 easings (referenced by name). **Reference uses fontkit** (`font.layout()`); reimplemented glyph metrics on **opentype.js** (our stack): `font.getPath(str,0,0,size)` (baseline y=0, glyph extends up = −y — the same convention the reference flips fontkit into), `.toPathData()` for Path2D + Paper, `getBoundingBox()` for centre/height, `getAdvanceWidth()` for advance. Fixed render-space canvas (RATIOS) CSS-fit to viewport; p5 2D, draw via `ctx.fill(Path2D)` save/translate/scale per copy; **SVG export = Paper.js reconstruction** of the same arrangement (re-runs scroll/update/motion/collision into a clipped layer). State shaped like the reference (`cnv/params`) → presets deep-merge onto a clean-slate default; `window.__textr.applyPreset()` accepts a live antlii preset for A/B. Bootstrap deferred to the first `draw()` tick once the font resolves (`pendingPreset`). **Gotcha (cost a debug cycle):** TP4 `addBinding` on an object value `{min,max}` (e.g. `count.scope`) throws a cryptic minified `n` — TP4 only binds `{x,y,z,w}`; split into two sliders (same lesson as BOIDS' interval). Also the v1 `index.html` loaded paper+opentype but **not p5** — the rewrite uses `startSketch`, so added the p5 global. Ship our own fonts (Space Mono/Anton/Archivo Black/Bungee/Major Mono from `typography.js`) — not the reference's Google-Fonts-API picker (their asset). 6 original-named presets across all 4 text modes + both layouts. A/B-validated by driving the live tool's globals to the same controlled config (vertical/repeatLetter/backforth) with its default Roboto — **same family**: letter-cycling diamond field with sine-wave flow + stray edge singles; density/positions differ from Anton-vs-Roboto metrics + simplex (expected). Lateral Drift (columns spelling the phrase, vertical wave + center-amp envelope) + Diamond Wave (repeated words + scale modulation) render the right character; SVG export = 280 valid paths; 0 console errors. Landing card + preview updated to the kinetic-rows look. **Next:** pick a tool from the tracker (SAMPL type / RASTR type / DITHR raster / BIOM / DRIFT / KLON / SKAAAN) and run the method.
