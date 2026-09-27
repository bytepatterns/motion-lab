// node tools/build-readme.mjs
//
// Rewrites the gallery between <!-- gallery:start --> and <!-- gallery:end -->
// in README.md from every projects/NN-slug/index.html: title and description
// from window.__motion (falling back to <title>), the GIF (or the still) from
// out/, an "open in browser" link and the source link.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, listProjects, launch, openPiece, pieceFile, log, fail } from './lib.mjs';

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const pagesBase = (pkg.motionLab && pkg.motionLab.pagesBase) || '';
const readmePath = path.join(ROOT, 'README.md');
const START = '<!-- gallery:start -->', END = '<!-- gallery:end -->';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function readMeta(browser, slug) {
  try {
    const { meta, context } = await openPiece(browser, slug);
    await context.close();
    return meta;
  } catch (e) {
    const html = fs.readFileSync(pieceFile(slug), 'utf8');
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || slug;
    log(`warning: ${slug} did not load (${e.message.split('\n')[0]}); using <title>`);
    return { title: title.replace(/\s+[—-]\s+motion-lab$/i, ''), description: '', frames: 0, fps: 30 };
  }
}

const slugs = listProjects();
const browser = await launch();
const cells = [];
for (const slug of slugs) {
  const m = await readMeta(browser, slug);
  const gif = fs.existsSync(path.join(OUT, `${slug}.gif`)) ? `out/${slug}.gif` : null;
  const png = fs.existsSync(path.join(OUT, `${slug}.png`)) ? `out/${slug}.png` : null;
  const live = pagesBase ? `${pagesBase}projects/${slug}/` : `projects/${slug}/index.html`;
  const secs = m.frames && m.fps ? `${Math.round(m.frames / m.fps)} s` : '';
  const media = gif || png
    ? `<a href="${live}"><img src="${gif || png}" width="100%" alt="${esc(m.title)} — ${gif ? 'animated preview' : 'still frame'}"></a>`
    : '<em>not rendered yet</em>';
  const links = [
    `<a href="${live}">open in browser</a>`,
    png && gif ? `<a href="${png}">still</a>` : null,
    `<a href="projects/${slug}/index.html">source</a>`,
  ].filter(Boolean).join(' · ');
  cells.push(`<td width="50%" valign="top">
${media}
<br><b>${slug.slice(0, 2)} · ${esc(m.title)}</b>${secs ? ` <sub>${secs}</sub>` : ''}
<br>${esc(m.description)}
<br><sub>${links}</sub>
</td>`);
}
await browser.close();

const rows = [];
for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>\n${cells[i]}\n${cells[i + 1] || '<td width="50%"></td>'}\n</tr>`);
const gallery = cells.length ? `<table>\n${rows.join('\n')}\n</table>` : '_No pieces yet._';

let readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
const a = readme.indexOf(START), b = readme.indexOf(END);
if (a < 0 || b < a) fail(`README.md needs ${START} and ${END} markers`);
readme = readme.slice(0, a + START.length) + '\n' + gallery + '\n' + readme.slice(b);
fs.writeFileSync(readmePath, readme);
log(`README gallery: ${slugs.length} piece(s) — ${slugs.join(', ')}`);
