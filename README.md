# motion-lab

**Motion graphics drawn entirely in code — one HTML file per piece, every frame deterministic, sound synthesized in the same file.**

No timeline editor, no stock footage, no samples, no fonts to download. Each piece is a single `index.html`: open it and it plays in the browser; hand it to the renderer and it becomes an MP4, frame for frame and sample for sample the same every time.

## Gallery

Click a preview to open the piece live in your browser (click once more there for sound).

<!-- gallery:start -->
<!-- gallery:end -->

## Quick start

```bash
git clone https://github.com/bytepatterns/motion-lab.git
cd motion-lab
npm i                               # Playwright + its headless Chromium
node tools/render.mjs 01-showreel   # -> out/01-showreel.mp4 (1920x1080, 30 fps, AAC)
```

Or skip the install and just open `projects/01-showreel/index.html` in a browser.

Requirements: **Node 20+** and **ffmpeg + ffprobe** on your PATH.

| Command | What it does |
|---|---|
| `node tools/render.mjs NN-slug` | draws every frame headless, pipes the PNGs into ffmpeg (h264, yuv420p, crf 18), muxes the synthesized soundtrack → `out/NN-slug.mp4` |
| `node tools/still.mjs NN-slug [frame ...]` | poster frame → `out/NN-slug.png`; with frame numbers → `out/stills/` |
| `node tools/gif.mjs NN-slug` | a 6-8 s, 960 px, ≤ 3 MB loop with a two-pass palette → `out/NN-slug.gif` |
| `node tools/verify.mjs NN-slug` | checks the piece and its MP4 against the contract, exits 1 on failure |
| `node tools/all.mjs [NN-slug ...]` | render + still + gif + verify for every piece, then rebuilds this gallery |
| `node tools/build-readme.mjs` | rebuilds the gallery above from `projects/*/index.html` |

`render.mjs` takes `--workers N` (parallel pages), `--range a:b` (a quick preview of a few frames) and `--keep-frames` (also write the PNGs to `out/frames/`).

## How a piece works

Every piece exposes one object, and the tools use nothing else:

```js
window.__motion = {
  title, description,           // shown in the gallery
  fps: 30, width: 1920, height: 1080,
  frames: 540,                  // 15-30 s
  seek(i) {},                   // draws frame i: synchronous, a pure function of i
  async audio() {},             // the whole soundtrack as one AudioBuffer (OfflineAudioContext, 48 kHz stereo)
};
```

- **`seek(i)` is pure.** No clock, no `Math.random` — randomness comes from a seeded PRNG (`mulberry32`). Frame 400 looks the same whether it is drawn first, last or twice, so the renderer draws frames in parallel and out of order, and `verify` re-draws random frames to prove it.
- **Sound is scheduled from frame numbers.** A kick on frame 45 is `at = 45 / 30` seconds in the `OfflineAudioContext`, so picture and sound cannot drift.
- **The browser and the renderer run the same code.** In a tab, a small player block calls `seek` from `requestAnimationFrame` and starts the sound on your first click; in the renderer it stays out of the way.

The full rules — canvas, fonts, determinism, audio format, what `verify` checks — are in **[CONTRACT.md](CONTRACT.md)**.

## What `verify` checks

| Group | Checks |
|---|---|
| file | one self-contained file: no external `src` / `href`, no CSS imports, has a `<title>` |
| page | loads without errors and without a single network request; `__motion` has 30 fps, 1920×1080, 450-900 frames |
| frames | random frames are not empty, are pixel-identical when re-drawn out of order, and `seek` never calls `Math.random`, `Date.now` or `performance.now` |
| audio | 2 channels, 48 kHz, exactly `frames / fps` seconds, not silent, no clipping |
| mp4 | h264 1920×1080 yuv420p, duration within 0.1 s, audio stream present and audible |
| luma | every frame of the MP4 decoded: none near-black, none a flat colour |

## Add your own piece

1. `cp -r template projects/11-my-piece` (the folder name is `NN-slug`, and the file must stay `index.html`).
2. Replace `draw(f)` and `renderAudio()` with your own; set `title`, `description`, `frames`.
3. Open it in a browser while you work. `?frame=240` freezes on a frame, `Space` pauses.
4. `node tools/all.mjs 11-my-piece` — then look at a few frames with `node tools/still.mjs 11-my-piece 30 240 480`.

If `verify` fails, the piece is fixed — never the tool.

## Project layout

```
projects/NN-slug/index.html   one piece = one file
template/index.html           starter piece with the player block and helpers
tools/                        render, still, gif, verify, all, build-readme (+ lib.mjs)
out/                          GIFs and posters are committed; MP4s and frames are not
CONTRACT.md                   the rules every piece follows
```

## More from BytePatterns

Animated algorithm lessons, free and without an account: [bytepatterns.com](https://bytepatterns.com?utm_source=github&utm_medium=readme&utm_campaign=motion-lab) · the reel engine: [code-motion](https://github.com/bytepatterns/code-motion)

## License

[MIT](LICENSE). The soundtracks are synthesized by the code in each file, so they carry no third-party licence.
