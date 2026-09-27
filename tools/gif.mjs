// node tools/gif.mjs <NN-slug> [--variant vertical] [--start 4] [--dur 7]
//
// Cuts a 6-8 s loop from out/NN-slug.mp4 into out/NN-slug.gif: 960 px wide,
// two-pass palette (palettegen + paletteuse). Steps frame rate and palette size
// down until the file is <= 3 MB. --start defaults to __motion.gifStart (or 0).
// --variant vertical: out/NN-slug.vertical.mp4 -> out/NN-slug.vertical.gif, 540 px wide, <= 2 MB.
import fs from 'node:fs';
import path from 'node:path';
import { resolveSlug, parseArgs, launch, openPiece, outPath, outName, specOf, run, checkTools, fmtBytes, log, fail } from './lib.mjs';

const { pos, flags } = parseArgs();
const slug = resolveSlug(pos[0]);
const variant = typeof flags.variant === 'string' ? flags.variant : null;
const spec = specOf(variant);
const LIMIT = spec.gifLimit, WIDTH = spec.gifWidth;
await checkTools();
const mp4 = outPath(outName(slug, variant, 'mp4'));
if (!fs.existsSync(mp4)) fail(`${path.relative(process.cwd(), mp4)} not found — run: node tools/render.mjs ${slug}${variant ? ' --variant ' + variant : ''}`);

const browser = await launch();
const { meta } = await openPiece(browser, slug, { variant });
await browser.close();

const total = meta.frames / meta.fps;
let dur = Math.min(8, Math.max(6, Number(flags.dur) || 7), total);
let start = Number(flags.start ?? meta.gifStart ?? 0) || 0;
start = Math.max(0, Math.min(start, total - dur));

const gif = outPath(outName(slug, variant, 'gif'));
// Grain and gradients are what make GIFs heavy: scale with area averaging and
// a light spatial denoise (no temporal pass: it ghosts on hard cuts) first, then trade dither, frame rate, palette and length for size.
const tries = [
  { fps: 15, colors: 256, dither: 'bayer:bayer_scale=3' },
  { fps: 12, colors: 256, dither: 'bayer:bayer_scale=2' },
  { fps: 12, colors: 192, dither: 'none' },
  { fps: 12, colors: 128, dither: 'none' },
  { fps: 10, colors: 128, dither: 'none' },
  { fps: 10, colors: 96, dither: 'none', dur: 6 },
  { fps: 10, colors: 64, dither: 'none', dur: 6 },
  { fps: 8, colors: 64, dither: 'none', dur: 6 },
  { fps: 8, colors: 48, dither: 'none', dur: 6 },
  { fps: 8, colors: 32, dither: 'none', dur: 6 },
  // last resort for full-frame motion or grain (a camera flight, film grain): a heavier spatial denoise
  { fps: 8, colors: 32, dither: 'none', dur: 5, dn: 10 },
  { fps: 6, colors: 48, dither: 'none', dur: 6, dn: 10 },
  { fps: 6, colors: 32, dither: 'none', dur: 6, dn: 10 },
  { fps: 6, colors: 32, dither: 'none', dur: 5, dn: 12 },
];
for (const t of tries) {
  const d = Math.min(dur, t.dur ?? dur);
  const dn = t.dn || 4;
  const vf = `fps=${t.fps},scale=${WIDTH}:-2:flags=area,hqdn3d=${dn}:${dn}:0:0,split[a][b];` +
    `[a]palettegen=max_colors=${t.colors}:stats_mode=diff[p];[b][p]paletteuse=dither=${t.dither}:diff_mode=rectangle`;
  const r = await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-t', String(d), '-i', mp4, '-an', '-filter_complex', vf, '-loop', '0', gif]);
  if (r.code !== 0) fail(`ffmpeg: ${r.stderr}`);
  const size = fs.statSync(gif).size;
  log(`  ${t.fps} fps, ${t.colors} colours, ${d} s from ${start.toFixed(1)} s -> ${fmtBytes(size)}`);
  if (size <= LIMIT) { log(`wrote ${path.relative(process.cwd(), gif)} (${fmtBytes(size)})`); process.exit(0); }
}
fail(`could not get ${path.basename(gif)} under ${fmtBytes(LIMIT)} — pick a calmer --start window`);
