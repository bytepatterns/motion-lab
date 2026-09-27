// node tools/render.mjs <NN-slug> [--workers 4] [--keep-frames] [--range 0:90]
//
// Opens the piece headless at 1920x1080 (deviceScaleFactor 1), calls seek(i)
// for every frame, captures canvas.toDataURL('image/png') and pipes the PNGs
// straight into ffmpeg (h264, yuv420p, crf 18). The soundtrack from audio() is
// written as a 48 kHz stereo WAV and muxed in. Output: out/NN-slug.mp4
//
// --workers N     pages rendering in parallel (default: min(4, cpus/2)); seek(i)
//                 is pure in i, so frames can be drawn out of order
// --keep-frames   also write every PNG to out/frames/NN-slug/
// --range a:b     render only frames a..b-1 (quick previews; still full audio)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  resolveSlug, parseArgs, launch, openPiece, grabFrame, grabAudio, writeWav, outPath, checkTools, fmtBytes, fmtTime, log, fail,
} from './lib.mjs';

const { pos, flags } = parseArgs();
const slug = resolveSlug(pos[0]);
await checkTools();

const t0 = Date.now();
const browser = await launch();
const main = await openPiece(browser, slug);
const { meta } = main;
if (!(meta.frames > 0) || !(meta.fps > 0)) fail(`${slug}: __motion.frames / fps missing`);
if (main.errors.length) log(`warning: page errors: ${main.errors.join(' | ')}`);

let [from, to] = [0, meta.frames];
if (flags.range) {
  const [a, b] = String(flags.range).split(':').map(Number);
  from = Math.max(0, a | 0); to = Math.min(meta.frames, b || meta.frames);
}
const total = to - from;
const workers = Math.max(1, Math.min(total, Number(flags.workers) || Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)))));
log(`${slug}: "${meta.title}" — ${meta.frames} frames @ ${meta.fps} fps (${(meta.frames / meta.fps).toFixed(2)} s), rendering ${from}..${to - 1} with ${workers} worker(s)`);

// ---- audio --------------------------------------------------------------
const framesDir = outPath('frames', slug, '.keep');
fs.rmSync(path.dirname(framesDir), { recursive: true, force: true });
fs.mkdirSync(path.dirname(framesDir), { recursive: true });
const wav = path.join(path.dirname(framesDir), 'audio.wav');
let hasAudio = false;
if (meta.hasAudio) {
  const ta = Date.now();
  const a = await grabAudio(main.page);
  writeWav(wav, a.pcm, a.sampleRate, 2);
  hasAudio = true;
  log(`audio: ${a.channels} ch, ${a.sampleRate} Hz, ${(a.length / a.sampleRate).toFixed(3)} s, peak ${(20 * Math.log10(a.peak || 1e-9)).toFixed(1)} dBFS (${fmtTime(Date.now() - ta)})`);
} else log('warning: no __motion.audio() — rendering a silent video');

// ---- ffmpeg -------------------------------------------------------------
const mp4 = outPath(`${slug}${flags.range ? '.preview' : ''}.mp4`);
const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(meta.fps), '-c:v', 'png', '-i', '-'];
if (hasAudio) ffArgs.push('-ss', String(from / meta.fps), '-i', wav);
ffArgs.push('-map', '0:v');
if (hasAudio) ffArgs.push('-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(meta.fps),
  '-t', String(total / meta.fps), '-movflags', '+faststart', mp4);
const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res) => ff.on('close', res));
ff.stdin.on('error', () => {});

// ---- frames -------------------------------------------------------------
const pages = [main.page];
for (let w = 1; w < workers; w++) pages.push((await openPiece(browser, slug)).page);
const ready = new Map();
let nextToTake = from, nextToWrite = from, lastPct = -1;
let wake = null;
const keep = !!flags['keep-frames'];

async function writer() {
  while (nextToWrite < to) {
    if (!ready.has(nextToWrite)) { await new Promise((r) => (wake = r)); continue; }
    const buf = ready.get(nextToWrite); ready.delete(nextToWrite);
    if (keep) fs.writeFileSync(path.join(path.dirname(framesDir), String(nextToWrite).padStart(5, '0') + '.png'), buf);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    nextToWrite++;
    const pct = Math.floor(((nextToWrite - from) / total) * 10);
    if (pct !== lastPct) { lastPct = pct; process.stdout.write(`  ${pct * 10}%${pct === 10 ? '\n' : ''}`); }
  }
  ff.stdin.end();
}
async function worker(page) {
  while (nextToTake < to) {
    const i = nextToTake++;
    // Keep the reorder buffer small so memory stays flat.
    while (i - nextToWrite > workers * 8) await new Promise((r) => setTimeout(r, 5));
    ready.set(i, await grabFrame(page, i));
    if (wake) { const w = wake; wake = null; w(); }
  }
}
const tf = Date.now();
await Promise.all([writer(), ...pages.map(worker)]);
const code = await ffDone;
await browser.close();
if (!keep) fs.rmSync(path.dirname(framesDir), { recursive: true, force: true });
if (code !== 0) fail(`ffmpeg exited with ${code}`);
const size = fs.statSync(mp4).size;
log(`wrote ${path.relative(process.cwd(), mp4)} — ${fmtBytes(size)}, frames ${fmtTime(Date.now() - tf)} (${((Date.now() - tf) / total).toFixed(0)} ms/frame), total ${fmtTime(Date.now() - t0)}`);
