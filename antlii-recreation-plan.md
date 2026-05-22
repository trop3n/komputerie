# antlii.work Recreation — Implementation Plan

A ground-up re-platform of the Ksawery toolset to faithfully match the **live antlii.work** suite (artist Anatolii Babii / "Antlii"). This supersedes `antlii-spec.md`, which documented the *existing* Ksawery code rather than the real site.

## Locked decisions (2026-05-20)

- **Source of truth:** the live antlii.work site (not the spec doc).
- **Architecture:** full re-platform — p5.js (+ Paper.js for vector tools), the shared antlii shell, preset systems, multi-format export.
- **Tool scope (revised 2026-05-20):** additive superset — keep ALL existing tools (drop nothing), rework the overlapping ones toward antlii, and add the net-new antlii tools. Build order: shared shell + RITM first.
- **IP posture:** functional recreation / homage. Reimplement features and UX patterns with **original** preset content, copy, and assets. Do not copy proprietary source, artwork, or ship verbatim branding.

## Ground truth: how the real antlii tools are built

Confirmed by live audit of **FLAKE v0.39** and **BOIDS v0.22** (consistent architecture across the suite):

- **Stack:** p5.js for rendering + **Tweakpane** for the control panel (strongly indicated — SKAAAN credits Hiroki Kokubun's interface library; Tweakpane tabs/folders/number-bindings match the observed UI exactly). Paper.js/SVG for vector tools (FLAKE, RASTR, SAMPL, TEXTR, SPLITX); GLSL for shader tools (DITHR, BLUUR, REFRACT). Parameter-driven.
- **Shared shell:** title + version + license badge; top panels `MAIN / EXPORT / OPTIONS / LICENSE`; **Preset List** dropdown + Restart Preset + Preset Import/Export; per-tool collapsible **tabs**; **numeric textbox** inputs (scrub + type), not range sliders; Randomize engine.
- **Input:** drag-and-drop custom **SVG** shapes; drag-and-drop **raster image masks** (brightness/alpha modulate the result); plus standard media.
- **Export:** scalable **SVG** (vector tools), **MP4**, **PNG/WebP frame sequences**.

The current Ksawery tools are a flat-sidebar, single-PNG, raster (Canvas2D/WebGL) homage with no presets — so this is a rebuild, not a patch.

## Tool inventory & mapping

> **Phase 1 audit complete (2026-05-20).** The table below was the pre-audit guess and is **partly wrong** — see `antlii-tool-specs.md` for the corrected, authoritative mapping. Key corrections: **RASTR** is a vector *typography* tool (not Pixelator); **DRIFT/BIOM** don't match Pixel Flow/Cellular Automata; only **FLAKE, BOIDS, REFRACT, RITM** are clean reuses; **~11 tools are effectively net-new** (vector/type/image/3D).

Real set is 16. Mapping below (pre-audit guess; superseded by `antlii-tool-specs.md`):

| Real tool | Disposition | Current counterpart | Confidence |
|---|---|---|---|
| FLAKE | rebuild (vector) | Flake | audited |
| BOIDS | rebuild (sim) | Boids | audited |
| DITHR | rebuild | Dithering | proposed |
| REFRACT | rebuild | Refract | proposed |
| RITM | rebuild | Rhythm | proposed |
| RASTR | rebuild | Pixelator | proposed |
| DRIFT | rebuild | Pixel Flow | proposed |
| BIOM | rebuild | Cellular Automata | proposed (loose) |
| SAMPL | rebuild as **vector typography** | Shapes | proposed (loose) |
| TEXTR | rebuild as **vector typography** | Text | proposed (loose) |
| SPLITX | **build new** | — | needs audit |
| BLUUR | **build new** | — | needs audit |
| KLON | **build new** | — | needs audit |
| SKAAAN | **build new** | — | needs audit |
| STIIL | **build new** | — | needs audit |
| PLAIN | **build new** | — | needs audit |
| — | **drop** | Mesher, Blob Tracker, Video2MIDI, SRT2Video, Flipdigits, Gradient Map | — |

Math: 10 realign + 6 build new = 16; 6 dropped. (Mesher/Tracker/Blobs belong to the separate okamirufu.com brand.)

## Stack & "no-build" implications

The full re-platform adds p5.js + Paper.js (and a video-encode path). To preserve the project's no-bundler ethos:
- Load libs via **CDN + import map** (or vendored into `js/vendor/`), use **p5 instance mode** inside ES modules.
- MP4/video export: prefer native **`MediaRecorder`** (canvas `captureStream`) → WebM, with optional **ffmpeg.wasm** for MP4 transcode; PNG/WebP frame sequences via `canvas.toBlob` zipped client-side.
- **Consequence:** this changes `AGENTS.md`'s "no external packages" rule — update `CLAUDE.md`/`AGENTS.md` to record the p5.js/Paper.js dependency and the new architecture. *(Open question: accept a light bundler like Vite if CDN/import-map ergonomics get painful — decide in Phase 0.)*

## Shared infrastructure (the backbone)

Everything below is built once and reused by all tools. A **declarative parameter schema** per tool is the keystone — it drives UI generation, presets, randomization, and export metadata.

1. **`js/params.js`** — param schema (id, label, type [number/select/color/toggle/palette], default, min/max/step, tab, group). State store with get/set, change events, serialize/deserialize.
2. **`js/shell.js`** — the tool chrome: title/version/license badge, MAIN/EXPORT/OPTIONS/LICENSE panel switcher, collapsible per-tool tabs, mounts param controls from schema.
3. **`js/controls.js`** — components: numeric **textbox** (drag-scrub + type + clamp), combobox, color, palette (add/remove), toggle, button.
4. **`js/presets.js`** — bundled named presets per tool (original content), apply/restart, import/export to JSON file (incl. embedded custom SVG shape + raster mask).
5. **`js/export.js`** — PNG, PNG/WebP frame-sequence capture, WebM via MediaRecorder (+ optional MP4), SVG serialize for Paper.js tools.
6. **`js/input.js`** — extend `media-source.js`: drag-drop SVG shape parsing → vector path; drag-drop raster mask → brightness/alpha field.
7. **`js/randomize.js`** — schema-aware randomizer with per-param ranges/locks.
8. **Landing/Index** — restructure root to mirror antlii's `Index` grid + `About` (original copy/branding).

## Phased roadmap

### Phase 0 — Foundations & decisions
- Confirm CDN/import-map vs light bundler; vendor p5.js + Paper.js; project skeleton.
- Update `CLAUDE.md`/`AGENTS.md` to the new architecture and dependency stance.
- Lock the original naming/branding/preset-content policy.

### Phase 1 — Complete the live audit (all 16 real tools)
- For each remaining tool (DITHR, REFRACT, RITM, RASTR, DRIFT, BIOM, SAMPL, TEXTR, SPLITX, BLUUR, KLON, SKAAAN, STIIL, PLAIN): capture tabs, every param (label/type/default/range), preset names/count, export options, behaviors, visual style.
- Produce a per-tool spec sheet; finalize the mapping table and confirm the drop list.

### Phase 2 — Build shared infrastructure
- `params.js`, `shell.js`, `controls.js`, `presets.js`, `export.js`, `input.js`, `randomize.js` (see above).
- New shared CSS for the shell (panels/tabs/textboxes) within `css/style.css`.

### Phase 3 — Vertical slice: rebuild **FLAKE** end-to-end (proof of architecture)
- Paper.js SDF tile pattern; tabs CANVAS/STYLE/PATTERN/SHAPE/NOISE/SWIRL/MASK/MOTION; custom SVG shape + raster mask input; original preset library; SVG + MP4/frame export.
- Validates the entire stack before scaling. Treat as the template all other tools copy.

### Phase 4 — Rebuild the realigned tools
- **Raster (p5.js):** BOIDS, DITHR, REFRACT, RITM, RASTR, DRIFT, BIOM — port logic onto the shared shell + param schema + presets + export.
- **Vector (Paper.js):** SAMPL, TEXTR — font loading (Google Fonts + custom drag-drop), glyph→vector outline, point sampling, shape distribution, SVG export.

### Phase 5 — Build the 6 new tools
- SPLITX, BLUUR, KLON, SKAAAN, STIIL, PLAIN — each per its Phase-1 spec, on the shared infra.

### Phase 6 — Parity, polish, decommission
- Visual-fidelity tuning against the live tools; expand preset libraries; performance; mobile/touch; About/License pages.
- Remove the dropped tools and stale spec/docs; refresh index previews.

## Risks & open questions
- **Scope:** 16 parameter-rich tools with vector pipelines, presets, and video export is a large, multi-week program. Phases 3 (FLAKE slice) and 4 are the bulk.
- **MP4 in-browser:** ffmpeg.wasm is heavy; may settle on WebM + frame-sequence export and document MP4 via external FFmpeg (as the real FLAKE suggests).
- **Vector typography (SAMPL/TEXTR):** custom-font glyph→path extraction and sampling is the trickiest new capability.
- **Visual fidelity** without source access is approximate; calibrate against live screenshots per tool.
- **No-build vs bundler** (Phase 0 decision).
- **Mapping confidence:** RASTR/DRIFT/BIOM/SAMPL/TEXTR mappings are inferred; Phase 1 audit confirms or revises them.

## Immediate next step
Begin **Phase 1**: audit the remaining 14 live tools and produce per-tool spec sheets (I've done FLAKE and BOIDS). This locks the requirements before any building starts.
