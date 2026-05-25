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

Inventory verified 2026-05-24 (HTTP check of `antlii.github.io/<slug>/`). **12 of 16 have live antlii sources** to port faithfully (FLAKE + SPLITX done → 10 to go). The other 4 return 404 under every plausible slug — no live original, so treat them as original Ksawery tools (build by inspiration; no A/B possible).

| Tool | dir | type | live source | status |
|---|---|---|---|---|
| FLAKE | `flake-tool` | vector/raster | `flake-tool` ✓ | ✅ complete + validated |
| SPLITX | `splitx` | raster+SVG | `splitx-tool` ✓ | ✅ complete + validated |
| BOIDS | `boids-tool` | simulation | `boids-tool` ✓ | ⏳ port |
| BLUUR | `bluur` | shader | `bluur-tool` ✓ | ⏳ port |
| TEXTR | `textr` | type | `textr-tool` ✓ | ⏳ port |
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
