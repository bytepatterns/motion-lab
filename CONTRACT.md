# The piece contract

Every piece in this repository follows the same contract. The tools in `tools/`
depend on nothing else, so a piece that honours it renders, verifies and shows
up in the README gallery without touching any tool.

Start from [`template/index.html`](template/index.html): it already contains the
player block, the helpers and a working `__motion` object.

## 1. One folder, one file

```
projects/NN-slug/index.html
```

- `NN` is a two-digit number, `slug` is lowercase kebab-case (`01-showreel`).
- **One file.** No `<script src>`, no stylesheet, no image, no font file, no
  `fetch`. A page that makes any request other than `data:` / `blob:` fails
  `verify`.
- **Fonts** come from the system stack only:
  `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  (and `ui-monospace, "Cascadia Code", Consolas, Menlo, monospace` for code).
  Glyphs drawn as paths inside the file are fine.
- **No bitmap assets.** Everything is drawn: Canvas 2D, WebGL, or both.
- A `<title>` that matches `__motion.title` (a `— motion-lab` suffix is fine).

## 2. The canvas

- One `<canvas width="1920" height="1080">`. It is the **first `<canvas>` in
  the document**, or the one you expose as `__motion.canvas`.
- CSS may scale it to fit the window; the backing store stays 1920×1080.
- The renderer captures the canvas pixels only. DOM overlays (the sound button,
  captions you draw in HTML) never reach the video — draw everything that
  matters on the canvas.
- WebGL: create the context with `{ preserveDrawingBuffer: true }` and draw
  inside `seek(i)`; the time uniform comes from `i`, never from a clock.
- Composite 2D over WebGL by drawing the WebGL canvas into the 2D one
  (`ctx.drawImage(glCanvas, 0, 0)`) inside `seek(i)`, so the captured canvas
  is complete.

## 3. `window.__motion`

```js
window.__motion = {
  title: 'Fifteen-second showreel',        // short, English, shown in the README
  description: 'Kinetic type, shape morphs and a synth beat.',  // one sentence
  fps: 30, width: 1920, height: 1080,
  frames: 540,                             // 450..900 (15..30 s)
  poster: 270,                             // optional: frame used for the README still (default frames/2)
  gifStart: 4,                             // optional: second where the README GIF starts (default 0)
  seek(i) {},                              // draws frame i, synchronously
  async audio() {},                        // resolves to the whole soundtrack as an AudioBuffer
};
```

### `seek(i)` — the only way a frame is drawn

- **Synchronous.** When `seek(i)` returns, frame `i` is on the canvas.
- **Pure in `i`.** The result must not depend on which frame was drawn before.
  Frames are rendered in parallel, out of order, and re-drawn during
  verification. `verify` draws random frames twice with other frames in between
  and requires identical pixels.
- **No clocks, no global randomness.** `Math.random`, `Date.now`,
  `performance.now` and `new Date()` are forbidden inside `seek` (`verify`
  counts calls to them). Use a seeded PRNG — `mulberry32(seed)` is in the
  template — and re-create it from a fixed seed (or from `i`) every time you
  need it.
- **Trails, motion blur, afterimages** are drawn by re-evaluating the scene at
  earlier sub-frame times inside the same `seek` call, never by leaving the
  previous frame on the canvas.
- **Clear the whole canvas** each frame (a full-size `fillRect` of your
  background). Reset `ctx.setTransform`, `globalAlpha`, `filter`,
  `globalCompositeOperation` and `shadowBlur` before you return.
- `i` is an integer in `[0, frames - 1]`; clamp it defensively.
- No flat frames: every frame must contain something other than one solid
  colour (`verify` flags a frame whose luma is uniform or near-black). A fade to
  black for the loop should stop just short of pure black or keep a texture.

### `audio()` — the whole soundtrack, offline

- Returns a `Promise<AudioBuffer>`: **2 channels, 48 000 Hz, exactly
  `frames / fps` seconds** (`Math.round(48000 * frames / fps)` samples), built
  with `new OfflineAudioContext(2, length, 48000)` and `startRendering()`.
- Everything is synthesised in the file: oscillators, noise from the seeded
  PRNG, filters, envelopes, `DynamicsCompressorNode`, convolution from a
  generated impulse. **No sample files, no licensed audio, no network.**
- Schedule sounds from the same frame numbers that drive the picture
  (`at = frame / fps`), so sound and picture cannot drift.
- Peak at or under 1.0 (0 dBFS) with some headroom; `verify` fails a buffer
  that clips or is silent.
- It may run for a few seconds; it is called once per render.

## 4. The player block

Copy it from the template unchanged. It gives every piece the same behaviour
in a browser:

- autoplays and loops (`requestAnimationFrame` → `seek`);
- sound starts on the first click (browser autoplay policy) and the picture
  restarts from frame 0 in sync with it; a second click mutes;
- `Space` pauses; `?frame=N` shows a single frame (handy for stills);
- when the renderer sets `window.__MOTION_RENDER__ = true` before the page
  loads, the player does nothing except `seek(0)`.

The player is the only place a clock is allowed.

## 5. Style rules

- Big type, drawn with canvas text (`ctx.font`, `ctx.letterSpacing`) so it is
  kerned and anti-aliased. Nothing a viewer must read under 28 px.
- Keep readable text inside a 5 % title-safe margin (x 96..1824, y 54..1026).
- Camera moves use eased curves (cubic / expo / back), not linear ramps.
- **No names of AI tools, models or companies anywhere in a piece.**
- English text only in the pieces.
- Full-frame film grain or per-frame noise over the whole canvas makes the
  README GIF (<= 3 MB) blurry or impossible; keep texture subtle, static, or
  local to an element.

## 6. Definition of done

```bash
node tools/render.mjs NN-slug     # out/NN-slug.mp4
node tools/still.mjs  NN-slug     # out/NN-slug.png (poster frame)
node tools/gif.mjs    NN-slug     # out/NN-slug.gif (960 px, 6-8 s, <= 3 MB)
node tools/verify.mjs NN-slug     # exits 0
```

or all four at once: `node tools/all.mjs NN-slug`. Then look at a few frames
(`node tools/still.mjs NN-slug 30 200 400` → `out/stills/`) before calling it
finished. If `verify` fails, the piece is fixed — never the tool.
