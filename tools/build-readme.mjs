// node tools/build-readme.mjs
//
// Rewrites the gallery between <!-- gallery:start --> and <!-- gallery:end -->
// in README.md from every projects/NN-slug/index.html: title and description
// from window.__motion (falling back to <title>), the GIF (or the still) from
// out/, an "open in browser" link and the source link. One row per piece; the
// second column is its vertical cut (out/NN-slug.vertical.gif), if it has one.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, listProjects, launch, openPiece, pieceFile, log, fail } from './lib.mjs';

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const pagesBase = (pkg.motionLab && pkg.motionLab.pagesBase) || '';
const readmePath = path.join(ROOT, 'README.md');
const START = '<!-- gallery:start -->', END = '<!-- gallery:end -->';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function readMeta(browser, slug, variant = null) {
  try {
    const { meta, context } = await openPiece(browser, slug, { variant });
    await context.close();
    return meta;
  } catch (e) {
    if (variant) return null;
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
  // the vertical cut, 9:16
  const vm = m.variants && m.variants.includes('vertical') ? await readMeta(browser, slug, 'vertical') : null;
  const vgif = fs.existsSync(path.join(OUT, `${slug}.vertical.gif`)) ? `out/${slug}.vertical.gif` : null;
  const vpng = fs.existsSync(path.join(OUT, `${slug}.vertical.png`)) ? `out/${slug}.vertical.png` : null;
  const vlive = pagesBase ? `${pagesBase}projects/${slug}/?variant=vertical` : `projects/${slug}/index.html?variant=vertical`;
  const vcell = vm && (vgif || vpng)
    ? `<a href="${vlive}"><img src="${vgif || vpng}" width="100%" alt="${esc(m.title)} — vertical cut, ${vgif ? 'animated preview' : 'still frame'}"></a>
<br><sub>9:16 · ${Math.round(vm.frames / vm.fps)} s</sub>
<br><sub>${[`<a href="${vlive}">open</a>`, vgif && vpng ? `<a href="${vpng}">still</a>` : null].filter(Boolean).join(' · ')}</sub>`
    : '<sub>—</sub>';
  cells.push(`<tr>
<td width="72%" valign="top">
${media}
<br><b>${slug.slice(0, 2)} · ${esc(m.title)}</b>${secs ? ` <sub>${secs}</sub>` : ''}
<br>${esc(m.description)}
<br><sub>${links}</sub>
</td>
<td width="28%" valign="top">
${vcell}
</td>
</tr>`);
}
await browser.close();

const gallery = cells.length ? `<table>\n<tr><th>piece</th><th>vertical</th></tr>\n${cells.join('\n')}\n</table>` : '_No pieces yet._';

let readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
const a = readme.indexOf(START), b = readme.indexOf(END);
if (a < 0 || b < a) fail(`README.md needs ${START} and ${END} markers`);
readme = readme.slice(0, a + START.length) + '\n' + gallery + '\n' + readme.slice(b);
fs.writeFileSync(readmePath, readme);
log(`README gallery: ${slugs.length} piece(s) — ${slugs.join(', ')}`);
