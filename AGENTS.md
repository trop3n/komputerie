# AGENTS.md

Static HTML/JS/CSS project — no build, no tests, no linters, no package.json. Serve with any HTTP server (ES modules require it):

```
python3 -m http.server 8000
```

Full architecture docs are in `CLAUDE.md` — read it before making changes.

## Key constraints

- **No tool-specific CSS files.** All tools share `css/style.css`. Use existing classes.
- **No comments in code** unless the user asks for them.
- **No build steps ever.** Files are served as-is. Do not introduce bundlers, transpilers, or npm packages.
- **No tests to run.** Verify changes by opening in a browser.

## Adding a tool

Follow the checklist in `CLAUDE.md` ("Adding a New Tool"). Copy an existing tool's `index.html` + JS as a template — every tool uses the same sidebar+canvas layout, same variable names (`canvas`, `ctx`, `app`, `mediaSource`, `animId`), and same patterns for fullscreen/save/range inputs.

## WebGL tools

`tools/mesher/` and `tools/refract/` use WebGL. These are the only tools with shaders — don't assume Canvas 2D patterns apply there.

## Standalone tools

`cellular-automata`, `srt2video`, and `flipdigits` do **not** import `js/media-source.js`. All other tools do.
