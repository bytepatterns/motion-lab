// Shared helpers for the motion-lab tools. No dependencies beyond Playwright,
// plus ffmpeg / ffprobe on PATH.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS = path.join(ROOT, 'projects');
export const OUT = path.join(ROOT, 'out');

export const log = (...a) => console.log(...a);
export const fail = (msg) => { console.error(`error: ${msg}`); process.exit(1); };

/** Every project folder that has an index.html, sorted by name. */
export function listProjects() {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs.readdirSync(PROJECTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-[a-z0-9-]+$/.test(d.name))
    .filter((d) => fs.existsSync(path.join(PROJECTS, d.name, 'index.html')))
    .map((d) => d.name)
    .sort();
}

/** Accepts "01-showreel", "01" or "showreel". */
export function resolveSlug(arg) {
  if (!arg) fail('missing project, e.g. 01-showreel');
  const all = listProjects();
  if (all.includes(arg)) return arg;
  const hit = all.filter((s) => s.startsWith(arg + '-') || s.endsWith('-' + arg) || s.slice(3) === arg);
  if (hit.length === 1) return hit[0];
  fail(`no project matches "${arg}". Known: ${all.join(', ') || '(none)'}`);
}

export const pieceFile = (slug) => path.join(PROJECTS, slug, 'index.html');
export const outPath = (...p) => { const f = path.join(OUT, ...p); fs.mkdirSync(path.dirname(f), { recursive: true }); return f; };

/**
 * What the tools expect from the main piece and from each optional variant
 * (window.__motion.variants.<name>). A variant's files carry its name:
 * out/NN-slug.vertical.mp4, .png, .gif.
 */
export const SPECS = {
  main: { width: 1920, height: 1080, minFrames: 450, maxFrames: 900, gifWidth: 960, gifLimit: 3 * 1024 * 1024 },
  vertical: {
    width: 1080, height: 1920, minFrames: 360, maxFrames: 600, gifWidth: 540, gifLimit: 2 * 1024 * 1024,
    // Reels / Shorts / TikTok overlap: everything a viewer must see stays in here
    safe: { left: 60, right: 900, top: 230, bottom: 1400 },
  },
};
export function specOf(variant) {
  if (!variant) return SPECS.main;
  if (!SPECS[variant] || variant === 'main') fail(`unknown variant "${variant}". Known: ${Object.keys(SPECS).filter((k) => k !== 'main').join(', ')}`);
  return SPECS[variant];
}
/** out/ file name for a piece or one of its variants: name('01-showreel', 'vertical', 'mp4') -> 01-showreel.vertical.mp4 */
export const outName = (slug, variant, ext) => `${slug}${variant ? '.' + variant : ''}.${ext}`;

/** Parses flags like --workers 4 / --keep-frames; everything else is positional. */
export function parseArgs(argv = process.argv.slice(2)) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

export async function launch() {
  return chromium.launch({
    headless: true,
    // Software GL keeps WebGL pieces deterministic and available on any machine.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
}

/**
 * Opens a piece in render mode (the player stays idle) and waits for
 * window.__motion. With { instrument: true } calls to Math.random, Date.now,
 * performance.now and new Date() are counted in window.__clockCalls.
 * With { variant: 'vertical' } window.__motion is replaced by the piece merged
 * with __motion.variants.vertical (its own canvas, size, frames, seek, audio),
 * so every tool below works on the variant unchanged.
 */
export async function openPiece(browser, slug, { instrument = false, variant = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const url = pathToFileURL(pieceFile(slug)).href;
  const requests = [], errors = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u === url || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return;
    requests.push(u);
  });
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((instr) => {
    window.__MOTION_RENDER__ = true;
    if (!instr) return;
    window.__clockCalls = 0;
    const wrap = (obj, key) => { const f = obj[key]; obj[key] = function (...a) { window.__clockCalls++; return f.apply(this, a); }; };
    wrap(Math, 'random'); wrap(Date, 'now'); wrap(Performance.prototype, 'now');
    const D = Date;
    window.Date = new Proxy(D, { construct(t, a) { if (a.length === 0) window.__clockCalls++; return new t(...a); } });
  }, instrument);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__motion && typeof window.__motion.seek === 'function', null, { timeout: 15000 })
    .catch(() => { throw new Error(`${slug}: window.__motion.seek never appeared${errors.length ? ' — ' + errors[0] : ''}`); });
  const variants = await page.evaluate(() => Object.keys(window.__motion.variants || {}));
  if (variant) {
    const problem = await page.evaluate((v) => {
      const M = window.__motion, V = M.variants && M.variants[v];
      if (!V) return `no __motion.variants.${v}`;
      if (typeof V.seek !== 'function') return `__motion.variants.${v}.seek is not a function`;
      if (!V.canvas || typeof V.canvas.toDataURL !== 'function') return `__motion.variants.${v}.canvas is missing`;
      window.__motionMain = M;
      window.__motion = Object.assign({}, M, V, { variant: v, variants: undefined, poster: V.poster, gifStart: V.gifStart });
      return '';
    }, variant);
    if (problem) throw new Error(`${slug}: ${problem}`);
  }
  const meta = await page.evaluate(() => {
    const M = window.__motion;
    return {
      title: M.title, description: M.description, fps: M.fps, width: M.width, height: M.height,
      frames: M.frames, poster: M.poster, gifStart: M.gifStart, variant: M.variant || null,
      hasAudio: typeof M.audio === 'function', docTitle: document.title,
    };
  });
  meta.variants = variants;
  return { page, context, meta, requests, errors };
}

/** Draws frame i and returns the canvas as a PNG buffer. */
export async function grabFrame(page, i) {
  const dataUrl = await page.evaluate((i) => {
    window.__motion.seek(i);
    const c = window.__motion.canvas || document.querySelector('canvas');
    return c.toDataURL('image/png');
  }, i);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

/** Runs __motion.audio() in the page; returns 16-bit interleaved PCM plus stats. */
export async function grabAudio(page) {
  const r = await page.evaluate(async () => {
    const b = await window.__motion.audio();
    const n = b.length, ch = b.numberOfChannels;
    const L = b.getChannelData(0), R = ch > 1 ? b.getChannelData(1) : L;
    const pcm = new Int16Array(n * 2);
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i];
      const al = Math.abs(l), ar = Math.abs(r);
      if (al > peak) peak = al; if (ar > peak) peak = ar;
      sum += l * l + r * r;
      pcm[2 * i] = Math.max(-1, Math.min(1, l)) * 32767;
      pcm[2 * i + 1] = Math.max(-1, Math.min(1, r)) * 32767;
    }
    const u8 = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(bin), sampleRate: b.sampleRate, channels: ch, length: n, peak, rms: Math.sqrt(sum / (2 * n || 1)) };
  });
  return { ...r, pcm: Buffer.from(r.b64, 'base64'), b64: undefined };
}

export function writeWav(file, pcm, sampleRate, channels = 2) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

/** Spawns a process; resolves with { code, stdout, stderr } (stdout as Buffer when raw). */
export function run(cmd, args, { raw = false, onStdout, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [], err = [];
    p.stdout.on('data', (d) => (onStdout ? onStdout(d) : out.push(d)));
    p.stderr.on('data', (d) => { err.push(d); if (!quiet) process.stderr.write(d); });
    p.on('error', reject);
    p.on('close', (code) => {
      const so = Buffer.concat(out);
      resolve({ code, stdout: raw ? so : so.toString(), stderr: Buffer.concat(err).toString() });
    });
  });
}

export async function ffprobe(file) {
  const r = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  if (r.code !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

export async function checkTools() {
  try {
    await run('ffmpeg', ['-version']);
    await run('ffprobe', ['-version']);
  } catch {
    fail('ffmpeg and ffprobe must be on PATH (https://ffmpeg.org/download.html)');
  }
}

export const fmtBytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB');
export const fmtTime = (ms) => (ms / 1000).toFixed(1) + ' s';
