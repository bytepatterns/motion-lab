// node tools/still.mjs <NN-slug>                 -> out/NN-slug.png  (poster frame, used by the README)
// node tools/still.mjs <NN-slug> 30 240 480      -> out/stills/NN-slug-f00030.png ... (for looking at frames)
// node tools/still.mjs <NN-slug> 240 --out a.png -> a.png
// --variant vertical                             -> out/NN-slug.vertical.png, out/stills/NN-slug.vertical-f00030.png
import fs from 'node:fs';
import path from 'node:path';
import { resolveSlug, parseArgs, launch, openPiece, grabFrame, outPath, outName, specOf, fmtBytes, log, fail } from './lib.mjs';

const { pos, flags } = parseArgs();
const slug = resolveSlug(pos[0]);
const variant = typeof flags.variant === 'string' ? flags.variant : null;
specOf(variant);
const browser = await launch();
const { page, meta, errors } = await openPiece(browser, slug, { variant });
const base = slug + (variant ? '.' + variant : '');
if (errors.length) log(`warning: page errors: ${errors.join(' | ')}`);

const poster = Number.isInteger(meta.poster) ? meta.poster : Math.floor(meta.frames / 2);
const frames = pos.slice(1).map(Number);
const jobs = frames.length
  ? frames.map((f) => {
      if (!Number.isInteger(f) || f < 0 || f >= meta.frames) fail(`frame ${f} is outside 0..${meta.frames - 1}`);
      return { f, file: flags.out && frames.length === 1 ? path.resolve(flags.out) : outPath('stills', `${base}-f${String(f).padStart(5, '0')}.png`) };
    })
  : [{ f: poster, file: flags.out ? path.resolve(flags.out) : outPath(outName(slug, variant, 'png')) }];

for (const { f, file } of jobs) {
  const png = await grabFrame(page, f);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  log(`frame ${f} (${(f / meta.fps).toFixed(2)} s) -> ${path.relative(process.cwd(), file)} (${fmtBytes(png.length)})`);
}
await browser.close();
