// node tools/verify.mjs <NN-slug> [--variant vertical]
//
// Checks a piece against CONTRACT.md and its render in out/NN-slug.mp4
// (with --variant vertical: __motion.variants.vertical and out/NN-slug.vertical.mp4).
// Exits 1 if any check fails.
//
//  file      single file: no external src/href or CSS imports, has a <title>
//  page      loads without errors, makes no requests, __motion fields are valid
//  frames    random frames are non-empty, identical when re-drawn out of order,
//            and seek() never touches Math.random / Date.now / performance.now
//  audio     2 ch, 48 kHz, frames/fps seconds, not silent, does not clip
//  mp4       h264 1920x1080 yuv420p, duration = frames/fps +-0.1 s, audio stream present
//  luma      every frame of the mp4: not near-black, not a flat colour
//  safe      vertical only: on the sampled frames no content pixel (luma > 70,
//            3 in a row) lies outside the platform-safe area x 60..900, y 230..1400
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  resolveSlug, parseArgs, launch, openPiece, grabAudio, pieceFile, outPath, outName, specOf, run, ffprobe, checkTools, fmtBytes, log,
} from './lib.mjs';

const { pos, flags } = parseArgs();
const slug = resolveSlug(pos[0]);
const variant = typeof flags.variant === 'string' ? flags.variant : null;
const spec = specOf(variant);
const WH = `${spec.width}x${spec.height}`;
await checkTools();

const results = [];
const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail });

// ---- file -------------------------------------------------------------
const html = fs.readFileSync(pieceFile(slug), 'utf8');
check('file', 'has <title>', /<title>[^<]+<\/title>/i.test(html));
const ext = html.match(/<(script|img|link|iframe|audio|video|source)\b[^>]*\b(src|href)\s*=\s*["']?(?!data:|#)[^"'\s>]+/gi) || [];
check('file', 'no external src/href', ext.length === 0, ext.slice(0, 3).join(' | '));
const imp = html.match(/@import|url\(\s*["']?(?!data:|#)[a-z]/gi) || [];
check('file', 'no CSS imports / url()', imp.length === 0, imp.slice(0, 3).join(' | '));
check('file', 'size', true, fmtBytes(Buffer.byteLength(html)));

// ---- page -------------------------------------------------------------
const browser = await launch();
const piece = await openPiece(browser, slug, { instrument: true, variant });
const { page, meta } = piece;
check('page', 'no page errors on load', piece.errors.length === 0, piece.errors.slice(0, 2).join(' | '));
check('page', `fps 30, ${WH}`, meta.fps === 30 && meta.width === spec.width && meta.height === spec.height, `${meta.fps} fps ${meta.width}x${meta.height}`);
check('page', `frames ${spec.minFrames}..${spec.maxFrames}`, Number.isInteger(meta.frames) && meta.frames >= spec.minFrames && meta.frames <= spec.maxFrames, `${meta.frames} frames = ${(meta.frames / meta.fps).toFixed(2)} s`);
check('page', 'title + description', typeof meta.title === 'string' && meta.title.length > 2 && typeof meta.description === 'string' && meta.description.length > 10, meta.title);
check('page', '<title> matches __motion.title', meta.docTitle.toLowerCase().includes(String(meta.title).toLowerCase()), meta.docTitle);
check('page', 'audio() defined', meta.hasAudio);
const canvasInfo = await page.evaluate(() => {
  const c = window.__motion.canvas || document.querySelector('canvas');
  return c ? { w: c.width, h: c.height } : null;
});
check('page', `canvas ${WH} backing store`, canvasInfo && canvasInfo.w === spec.width && canvasInfo.h === spec.height, JSON.stringify(canvasInfo));

// ---- frames -----------------------------------------------------------
const N = meta.frames;
const rnd = (k) => Math.floor(((Math.sin(k * 12.9898 + N * 78.233) * 43758.5453) % 1 + 1) % 1 * N);
const sample = [...new Set([0, N - 1, Math.floor(N / 2), rnd(1), rnd(2), rnd(3), rnd(4)])];
await page.evaluate(() => { window.__clockCalls = 0; });
const stats = await page.evaluate((frames) => {
  const M = window.__motion;
  const c = M.canvas || document.querySelector('canvas');
  const probe = document.createElement('canvas'); probe.width = 192; probe.height = 108;
  const p = probe.getContext('2d', { willReadFrequently: true });
  const shot = (i) => { M.seek(i); return c.toDataURL('image/png'); };
  const out = [];
  for (const i of frames) {
    const a = shot(i);
    shot((i * 7 + 13) % M.frames); shot((i + Math.floor(M.frames / 3)) % M.frames);
    const b = shot(i);
    M.seek(i);
    p.clearRect(0, 0, 192, 108); p.drawImage(c, 0, 0, 192, 108);
    const d = p.getImageData(0, 0, 192, 108).data;
    let s = 0, s2 = 0, alpha = 0;
    for (let k = 0; k < d.length; k += 4) {
      const y = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
      s += y; s2 += y * y; alpha += d[k + 3];
    }
    const n = d.length / 4, mean = s / n;
    out.push({ i, same: a === b, mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)), alpha: alpha / n });
  }
  return { out, clock: window.__clockCalls };
}, sample);
const empty = stats.out.filter((s) => s.alpha < 250 || s.std < 1.5);
check('frames', `non-empty canvas (${sample.length} frames)`, empty.length === 0 && stats.out.length >= 3,
  empty.map((s) => `f${s.i}: std ${s.std.toFixed(2)} alpha ${s.alpha.toFixed(0)}`).join(', ') || sample.join(','));
const nondet = stats.out.filter((s) => !s.same);
check('frames', 'deterministic seek (re-draw out of order)', nondet.length === 0, nondet.map((s) => 'f' + s.i).join(', '));
check('frames', 'no Math.random / Date.now / performance.now in seek', stats.clock === 0, stats.clock ? `${stats.clock} calls` : '');

// ---- safe area (variants that have one) ---------------------------------
// The same rule as a full-clip layout check, on the sampled frames: a pixel is
// content when its luma is above 70 and it ends a run of 3 such pixels in a row.
if (spec.safe) {
  const LUMA = 70, RUN = 3;
  const safe = await page.evaluate(({ frames, S, LUMA, RUN }) => {
    const M = window.__motion, c = M.canvas;
    const probe = document.createElement('canvas'); probe.width = c.width; probe.height = c.height;
    const p = probe.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (const i of frames) {
      M.seek(i);
      p.clearRect(0, 0, c.width, c.height); p.drawImage(c, 0, 0);
      const d = p.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height;
      let outside = 0, minX = w, maxX = -1, minY = h, maxY = -1;
      for (let y = 0; y < h; y++) {
        let run = 0;
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4, L = 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
          if (L <= LUMA) { run = 0; continue; }
          if (++run < RUN) continue;
          const px = x - RUN + 1;
          if (px < minX) minX = px; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (px < S.left || x > S.right || y < S.top || y > S.bottom) outside++;
        }
      }
      out.push({ i, outside, minX, maxX, minY, maxY });
    }
    return out;
  }, { frames: sample, S: spec.safe, LUMA, RUN });
  const S = spec.safe, bad = safe.filter((r) => r.outside > 0);
  const box = (r) => `f${r.i}: ${r.outside} px outside, content x ${r.minX}..${r.maxX} y ${r.minY}..${r.maxY}`;
  const all = safe.reduce((a, r) => ({ minX: Math.min(a.minX, r.minX), maxX: Math.max(a.maxX, r.maxX), minY: Math.min(a.minY, r.minY), maxY: Math.max(a.maxY, r.maxY) }),
    { minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 });
  check('safe', `content inside x ${S.left}..${S.right}, y ${S.top}..${S.bottom} (${safe.length} frames, luma > ${LUMA})`, bad.length === 0,
    bad.length ? bad.slice(0, 3).map(box).join(' | ') : `content x ${all.minX}..${all.maxX}, y ${all.minY}..${all.maxY}`);
}

// ---- audio ------------------------------------------------------------
if (meta.hasAudio) {
  const a = await grabAudio(page);
  const want = N / meta.fps, got = a.length / a.sampleRate;
  check('audio', '2 ch, 48 kHz', a.channels === 2 && a.sampleRate === 48000, `${a.channels} ch ${a.sampleRate} Hz`);
  check('audio', 'length = frames/fps (+-0.1 s)', Math.abs(got - want) <= 0.1, `${got.toFixed(3)} s vs ${want.toFixed(3)} s`);
  const peakDb = 20 * Math.log10(a.peak || 1e-9), rmsDb = 20 * Math.log10(a.rms || 1e-9);
  check('audio', 'no clipping (peak <= 0 dBFS)', a.peak <= 1.0, `peak ${peakDb.toFixed(1)} dBFS`);
  check('audio', 'not silent (rms > -45 dBFS)', rmsDb > -45, `rms ${rmsDb.toFixed(1)} dBFS`);
}
await browser.close();

// ---- mp4 --------------------------------------------------------------
const mp4 = outPath(outName(slug, variant, 'mp4'));
if (!fs.existsSync(mp4)) {
  check('mp4', 'exists', false, `run: node tools/render.mjs ${slug}${variant ? ' --variant ' + variant : ''}`);
} else {
  const pr = await ffprobe(mp4);
  const v = pr.streams.find((s) => s.codec_type === 'video');
  const au = pr.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(pr.format.duration), want = N / meta.fps;
  check('mp4', `h264 ${WH} yuv420p`, v && v.codec_name === 'h264' && v.width === spec.width && v.height === spec.height && v.pix_fmt === 'yuv420p',
    v ? `${v.codec_name} ${v.width}x${v.height} ${v.pix_fmt}` : 'no video');
  check('mp4', 'duration = frames/fps (+-0.1 s)', Math.abs(dur - want) <= 0.1, `${dur.toFixed(3)} s vs ${want.toFixed(3)} s, ${v?.nb_frames} frames`);
  check('mp4', 'audio stream present', !!au, au ? `${au.codec_name} ${au.sample_rate} Hz ${au.channels} ch` : 'none');
  if (au) {
    const vd = await run('ffmpeg', ['-hide_banner', '-i', mp4, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
    const mean = Number((vd.stderr.match(/mean_volume:\s*(-?[\d.]+)/) || [])[1]);
    const max = Number((vd.stderr.match(/max_volume:\s*(-?[\d.]+)/) || [])[1]);
    check('mp4', 'muxed audio audible', mean > -45, `mean ${mean} dB, max ${max} dB`);
  }
  check('mp4', 'size', true, fmtBytes(fs.statSync(mp4).size));

  // ---- luma, every frame ----------------------------------------------
  const w = spec.width > spec.height ? 160 : 90, h = spec.width > spec.height ? 90 : 160, fs_ = w * h;
  const raw = await run('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { raw: true });
  const n = Math.floor(raw.stdout.length / fs_);
  const flat = [], dark = [];
  let minMean = 255, minStd = 255;
  for (let f = 0; f < n; f++) {
    let s = 0, s2 = 0;
    for (let k = f * fs_; k < (f + 1) * fs_; k++) { const y = raw.stdout[k]; s += y; s2 += y * y; }
    const mean = s / fs_, std = Math.sqrt(Math.max(0, s2 / fs_ - mean * mean));
    minMean = Math.min(minMean, mean); minStd = Math.min(minStd, std);
    if (mean < 3) dark.push(f); else if (std < 1.0) flat.push(f);
  }
  const span = (a) => a.length ? `${a.length} frame(s): ${a.slice(0, 8).join(',')}${a.length > 8 ? '…' : ''}` : '';
  check('luma', `decoded ${n} frames`, n === N, `${n} vs ${N}`);
  check('luma', 'no near-black frames (mean luma >= 3)', dark.length === 0, span(dark) || `min mean ${minMean.toFixed(1)}`);
  check('luma', 'no flat frames (luma std >= 1)', flat.length === 0, span(flat) || `min std ${minStd.toFixed(1)}`);
}

// ---- report -----------------------------------------------------------
let failed = 0;
log(`\nverify ${slug}${variant ? ' [' + variant + ']' : ''} — "${meta.title}"`);
for (const r of results) {
  if (!r.ok) failed++;
  log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.group.padEnd(6)} ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
