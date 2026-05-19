# Handoff.md

Session state for the next agent. Read `CLAUDE.md` and `AGENTS.md` before making changes.

## What this project is

Static HTML/JS/CSS visual-tools collection. No build, no npm, no tests. Serve with `python3 -m http.server 8000`. 16 browser-based tools in `tools/`, shared code in `js/` and `css/`.

## Completed work (stages 1–5)

### Stage 1 — Critical bugs (10 fixes)
- **refract** double Y-flip in grid shader (line 135)
- **rhythm** quadratic speed (was squaring speed each frame)
- **pixelator** negative fillRect from unclamped outline gap
- **boids** zero-velocity trap (division by zero in separation)
- **boids** boundary speed bypass (boids exceeded maxSpeed at edges)
- **cellular-automata** smooth brush directional bias (temp buffer for reads)
- **cellular-automata** stale 2D state on 1D rule switch (grid clear)
- **srt2video** broken gap indicator (`getNextGap` logic)
- **video2midi** stuck notes on channel change (channel stored in `prevNotes`)
- **flake** broken mirror symmetry (`Math.abs` on both axes)

### Stage 2 — Performance (6 sweeps)
- Canvas dimension guards across 11 tools (avoid negative width/height)
- Pre-allocated `Float32Array` for dithering error diffusion
- Pre-allocated `ImageData` for pixel-flow source sampling
- Separable two-pass box blur in blob-tracker (~20x faster)
- `setTransform` replacing `save`/`restore` in flake
- Mutable `Vec2` ops in boids (~1M allocs/sec eliminated)

### Stage 3 — String allocation
- Added `rgbStr()` and `rgbaStr()` cached string helpers to `js/color.js`
- Applied to pixelator, shapes, text, flipdigits, pixel-flow, rhythm, video2midi

### Stage 4 — Medium bugs (5 real fixes, 6 investigated non-issues)
- **srt2video** `Math.max(...array)` → `reduce()` (stack overflow on large SRT files)
- **blob-tracker** greedy matching → global nearest-neighbor (sort-by-distance algorithm)
- **blob-tracker** redundant `Uint8ClampedArray` copy before `applyBlur` removed
- **mesher** `loadConfig` now validates gridX/Y bounds, point structure, opacity, subdivisions
- **refract** null check after `createProgram` with error message
- **mesher** shader compile + program link status checks added
- Non-issues confirmed: HSL color picker (canvas handles it), rhythm throttling (intentional), video2midi quantize (correct), pixel-flow hue (always positive), text getImageData (API handles negatives), flipdigits animation (design choice)

### Stage 5 — rAF lifecycle + save
- **5a**: 9 tools (pixelator, shapes, text, dithering, gradient-map, video2midi, pixel-flow, blob-tracker, flipdigits) now cancel `animId` via `cancelAnimationFrame` on source switch, restart only for non-image sources
- **5b**: All 15 tools with save buttons converted from `canvas.toDataURL()` (sync) to `canvas.toBlob()` (async, object URL, revoked after download)
- **5c**: Evaluated source-resolution save — all tools already save at their processing resolution which is intentionally capped; no change needed

## Remaining work

### Stage 6 — WebGL hardening
Applies to `tools/mesher/mesher.js` and `tools/refract/refract.js` only (the two WebGL tools).

**6.1 Context-lost recovery**
- Listen for `webglcontextlost` and `webglcontextrestored` events on the GL canvas
- On lost: cancel animation loop, show a message, set a flag
- On restored: re-create shaders, programs, textures, framebuffers, re-upload source

**6.2 FBO status check**
- After `gl.framebufferTexture2D(...)` in refract (line ~262), call `gl.checkFramebufferStatus(gl.FRAMEBUFFER)` and log/warn if not `FRAMEBUFFER_COMPLETE`
- Same for mesher if any FBOs are added later

**6.3 Skip unnecessary clears**
- In refract `render()`, `gl.clear(gl.COLOR_BUFFER_BIT)` runs every frame even when pass 1 overwrites every pixel. Only needed before pass 1 if the displacement shader might not cover the full quad (it does cover it, so the clear is redundant). Consider removing or gating behind a debug flag.

**6.4 Delta-time instead of hardcoded 0.016**
- `refract.js` line 312: `animTime += 0.016` — should use actual frame delta
- `rhythm.js` line 209: `currentTime += 0.016` — same
- `flake.js` line 498: `currentTime += motionSpeed * 0.016` — same
- `mesher.js` has no time-based animation (source-driven only)
- Pattern: store `lastTime = performance.now()`, compute `dt = (now - lastTime) / 1000`, clamp to max 0.1 to avoid spiral

**6.5 UNPACK_FLIP_Y_WEBGL**
- Both mesher and refract upload source textures via `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mediaSource.drawable)`
- Video elements need `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` to avoid vertical flip
- Refract's displace shader already flips Y on line 90 (`vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y)`) which compensates, so adding UNPACK_FLIP_Y would double-flip. Need to test and pick one approach.
- Mesher's vertex shader flips Y on line 30 (`clip.y = -clip.y`), and its texCoords go 0→1 top-to-bottom. Same analysis needed.

### Stage 7 — Minor polish
Small UX/quality improvements. Candidates (evaluate each before implementing):

- **Consistent canvas sizing**: Some tools use fixed CW/CH (800x600), others adapt to source. Consider making the fixed-size tools also adapt.
- **Keyboard shortcuts**: Space for play/pause in srt2video, cellular-automata, pixel-flow. Escape already handles fullscreen.
- **Cursor changes**: Crosshair cursor when drawing on cellular-automata canvas.
- **Smooth source transitions**: Fade between source changes instead of hard cuts.
- **Default parameter tuning**: Review default values for each tool — some may look better with different starting params.
- **Index page previews**: `js/previews.js` generates animated canvas previews; verify they look good for all 16 tools.
- **Mobile touch support**: cellular-automata drawing, mesher point dragging, blob-tracker interactions.

## Key files modified in this session

| File | Changes |
|------|---------|
| `js/color.js` | Added `rgbStr()`, `rgbaStr()` cached string helpers |
| `tools/boids/boids.js` | Mutable Vec2, zero-vel guard, boundary speed, toBlob save |
| `tools/flake/flake.js` | Mirror symmetry fix, setTransform, toBlob save |
| `tools/refract/refract.js` | Y-flip fix, shader link check, toBlob save |
| `tools/rhythm/rhythm.js` | Speed fix, pre-computed colors, toBlob save |
| `tools/pixelator/pixelator.js` | Outline gap clamp, rgbStr, rAF lifecycle, toBlob save |
| `tools/cellular-automata/cellular-automata.js` | Temp buffer, grid clear on 1D switch, toBlob save |
| `tools/srt2video/srt2video.js` | getNextGap fix, Math.max→reduce, toBlob save |
| `tools/video2midi/video2midi.js` | Channel in prevNotes, rAF lifecycle |
| `tools/dithering/dithering.js` | Pre-allocated error buffer, rAF lifecycle, toBlob save |
| `tools/blob-tracker/blob-tracker.js` | Separable blur, global NN matching, removed redundant copy, rAF lifecycle, toBlob save |
| `tools/text/text.js` | rgbStr, rAF lifecycle, toBlob save |
| `tools/shapes/shapes.js` | rgbStr, rAF lifecycle, toBlob save |
| `tools/flipdigits/flipdigits.js` | rgbStr, rAF lifecycle, toBlob save |
| `tools/pixel-flow/pixel-flow.js` | rgbaStr, pre-allocated ImageData, rAF lifecycle, toBlob save |
| `tools/gradient-map/gradient-map.js` | rAF lifecycle, toBlob save |
| `tools/mesher/mesher.js` | loadConfig validation, shader compile+link checks, toBlob save |

## Important decisions / gotchas

- All `rgbStr` keys use `(r << 16) | (g << 8) | b`; `rgbaStr` quantizes alpha to 10 levels and keys on `packed_rgb * 11 + qa`
- Pixel-flow trail alpha compositing makes ImageData writes impossible — kept `fillRect` with cached `rgbaStr`
- Shapes tool kept `save`/`restore` because `drawShape()` uses internal `ctx.rotate()` — can't use `setTransform` without refactoring
- Blob-tracker's `applyBlur` now mutates input data in place (caller no longer copies before calling)
- Boids `separation` formula was caught: `dx / (d * dSq)` → `dx / dSq`
- The antlii spec document was fully drafted but the write failed due to length — content needs to be recreated if still wanted
