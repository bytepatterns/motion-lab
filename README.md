# motion-lab

**Motion graphics drawn entirely in code — one HTML file per piece, every frame deterministic, sound synthesized in the same file.**

No timeline editor, no stock footage, no samples, no fonts to download. Each piece is a single `index.html`: open it and it plays in the browser; hand it to the renderer and it becomes an MP4, frame for frame and sample for sample the same every time.

## Gallery

Click a preview to open the piece live in your browser (click once more there for sound).

<!-- gallery:start -->
<table>
<tr>
<td width="50%" valign="top">
<a href="https://bytepatterns.github.io/motion-lab/projects/01-showreel/"><img src="out/01-showreel.gif" width="100%" alt="Motion Showreel — animated preview"></a>
<br><b>01 · Motion Showreel</b> <sub>18 s</sub>
<br>Eighteen seconds of kinetic type, shape morphs, a dive through a letter and a tunnel warp, cut to a synthesized 120 BPM beat.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/01-showreel/">open in browser</a> · <a href="out/01-showreel.png">still</a> · <a href="projects/01-showreel/index.html">source</a></sub>
</td>
<td width="50%" valign="top">
<a href="https://bytepatterns.github.io/motion-lab/projects/02-product-launch/"><img src="out/02-product-launch.gif" width="100%" alt="BytePatterns Launch Film — animated preview"></a>
<br><b>02 · BytePatterns Launch Film</b> <sub>24 s</sub>
<br>A 24-second launch film: a paragraph turns into sorted bars, product cards play their own lessons, and 300 tiles light up.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/02-product-launch/">open in browser</a> · <a href="out/02-product-launch.png">still</a> · <a href="projects/02-product-launch/index.html">source</a></sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://bytepatterns.github.io/motion-lab/projects/03-history-of-sorting/"><img src="out/03-history-of-sorting.gif" width="100%" alt="A Short History of Sorting — animated preview"></a>
<br><b>03 · A Short History of Sorting</b> <sub>30 s</sub>
<br>Merge sort, Shellsort, quicksort, heapsort and Timsort, 1945 to 2002, each one running for real on a row of bars.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/03-history-of-sorting/">open in browser</a> · <a href="out/03-history-of-sorting.png">still</a> · <a href="projects/03-history-of-sorting/index.html">source</a></sub>
</td>
<td width="50%" valign="top">
<a href="https://bytepatterns.github.io/motion-lab/projects/04-fourier-epicycles/"><img src="out/04-fourier-epicycles.gif" width="100%" alt="Fourier Epicycles — animated preview"></a>
<br><b>04 · Fourier Epicycles</b> <sub>20 s</sub>
<br>Spinning circles add up to a square wave as the series grows from 1 to 31 terms, and you hear the same sum.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/04-fourier-epicycles/">open in browser</a> · <a href="out/04-fourier-epicycles.png">still</a> · <a href="projects/04-fourier-epicycles/index.html">source</a></sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://bytepatterns.github.io/motion-lab/projects/05-double-pendulum/"><img src="out/05-double-pendulum.gif" width="100%" alt="Same Start, Different Fate — animated preview"></a>
<br><b>05 · Same Start, Different Fate</b> <sub>24 s</sub>
<br>Three double pendulums released 0.001 rad apart move as one, then split apart around the twelve-second mark.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/05-double-pendulum/">open in browser</a> · <a href="out/05-double-pendulum.png">still</a> · <a href="projects/05-double-pendulum/index.html">source</a></sub>
</td>
<td width="50%" valign="top">
<em>not rendered yet</em>
<br><b>06 · Murmuration</b> <sub>24 s</sub>
<br>2,400 starlings follow three local rules at dusk, dodge a hawk and draw a letter in the sky.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/06-murmuration/">open in browser</a> · <a href="projects/06-murmuration/index.html">source</a></sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<em>not rendered yet</em>
<br><b>07 · Raymarch City</b> <sub>20 s</sub>
<br>A camera flight through a neon city that exists only as a distance function in one fragment shader.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/07-raymarch-city/">open in browser</a> · <a href="projects/07-raymarch-city/index.html">source</a></sub>
</td>
<td width="50%" valign="top">
<em>not rendered yet</em>
<br><b>08 · Neon Breakout</b> <sub>20 s</sub>
<br>A neon Breakout level that plays itself: deterministic physics, multi-ball, a fire-ball and every brick cleared.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/08-neon-breakout/">open in browser</a> · <a href="projects/08-neon-breakout/index.html">source</a></sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<em>not rendered yet</em>
<br><b>09 · Sorting Race</b> <sub>28 s</sub>
<br>Eight sorting algorithms sort the same 64 numbers side by side, paced by their real comparison counts.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/09-sorting-race/">open in browser</a> · <a href="projects/09-sorting-race/index.html">source</a></sub>
</td>
<td width="50%" valign="top">
<em>not rendered yet</em>
<br><b>10 · Signal</b> <sub>20 s</sub>
<br>A documentary title sequence: one trace, a pulse that keeps quickening, then silence and the title.
<br><sub><a href="https://bytepatterns.github.io/motion-lab/projects/10-title-sequence/">open in browser</a> · <a href="projects/10-title-sequence/index.html">source</a></sub>
</td>
</tr>
</table>
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
