// node tools/all.mjs [NN-slug ...] [--skip-render] [--workers N]
//
// For every piece (or the ones named): render -> still -> gif -> verify, then
// rebuilds the README gallery. Prints a summary and exits 1 if anything failed.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT, listProjects, resolveSlug, parseArgs, log } from './lib.mjs';

const { pos, flags } = parseArgs();
const slugs = pos.length ? pos.map(resolveSlug) : listProjects();
const node = (script, args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(ROOT, 'tools', script), ...args], { stdio: 'inherit' });
  p.on('close', (code) => resolve(code));
});

const summary = [];
for (const slug of slugs) {
  log(`\n=== ${slug} ===`);
  const row = { slug };
  const w = flags.workers ? ['--workers', String(flags.workers)] : [];
  row.render = flags['skip-render'] ? 'skip' : (await node('render.mjs', [slug, ...w])) === 0 ? 'ok' : 'FAIL';
  row.still = (await node('still.mjs', [slug])) === 0 ? 'ok' : 'FAIL';
  row.gif = row.render === 'FAIL' ? 'skip' : (await node('gif.mjs', [slug])) === 0 ? 'ok' : 'FAIL';
  row.verify = (await node('verify.mjs', [slug])) === 0 ? 'ok' : 'FAIL';
  summary.push(row);
}
await node('build-readme.mjs', []);

log('\nsummary');
log('  piece                         render  still  gif    verify');
for (const r of summary) log(`  ${r.slug.padEnd(30)}${r.render.padEnd(8)}${r.still.padEnd(7)}${r.gif.padEnd(7)}${r.verify}`);
const bad = summary.filter((r) => Object.values(r).includes('FAIL'));
process.exit(bad.length ? 1 : 0);
