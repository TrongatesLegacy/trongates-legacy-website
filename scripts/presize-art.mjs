// Pre-size the character art: every form drawn at the same size and place on the shared 640x960 canvas, so the
// website and the OBS scenes show any form with no per-form adjustment. See docs/design-system.md, Character sizing.
//
//   node --experimental-websocket scripts/presize-art.mjs            bake every form in artwork/forms/forms.json
//   node --experimental-websocket scripts/presize-art.mjs --measure  report each form's head against Tron's
//   node --experimental-websocket scripts/presize-art.mjs --bounds   each form's whole outline on the canvas
//   node --experimental-websocket scripts/presize-art.mjs --only princess --quality 82
//
// Sources: artwork/forms/<file>.webp (the untouched art) and artwork/forms/forms.json (each form's transform, as
// measured against Tron's head). Output: public/assets/img/<file>.webp (640x960) and <file>-400.webp (400x600).
// Tron is the reference: his files are used as they are and never rewritten here.
//
// How it works: headless Chrome draws each source in a 640x960 box exactly as the website's hero did (object-fit:
// contain, object-position and transform-origin 50% 80%, the form's transform) on a transparent page, the box is
// cropped out and encoded with cwebp. Anything the transform pushes outside the box would be clipped, so that's
// checked first and stops the bake. Needs Google Chrome, ffmpeg and cwebp (all on the owner's Mac).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true; };
const ROOT = new URL('..', import.meta.url).pathname, SRC = join(ROOT, 'artwork/forms'), OUT = join(ROOT, 'public/assets/img');
const cfg = JSON.parse(readFileSync(join(SRC, 'forms.json'), 'utf8'));
const [CW, CH] = cfg.canvas, M = 400;                         // margin round the box, to catch anything pushed outside it
const QUALITY = +arg('quality', 82), ONLY = arg('only', null), MEASURE = !!arg('measure', false), BOUNDS = !!arg('bounds', false);
const tmp = mkdtempSync(join(tmpdir(), 'presize-'));

// ---- headless Chrome, one page, transparent background -------------------------------------------------------
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmp, 'profile')}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); } catch {}
}
let id = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m.result || m); delete wait[m.id]; } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const W = CW + 2 * M, H = CH + 2 * M;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await send('Page.enable');
await send('Page.navigate', { url: 'about:blank' });
await new Promise((r) => setTimeout(r, 300));
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.value;

// draw one source with a transform; return the whole page as raw RGBA
async function draw(file, transform) {
  const src = 'data:image/webp;base64,' + readFileSync(file).toString('base64');
  await ev(`(async () => {
    document.body.style.cssText = 'margin:0;background:transparent';
    document.body.innerHTML = '<div style="position:absolute;left:${M}px;top:${M}px;width:${CW}px;height:${CH}px"><img id="i" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:${cfg.origin};transform-origin:${cfg.origin};transform:${transform}"></div>';
    const i = document.getElementById('i'); i.src = ${JSON.stringify(src)}; await i.decode(); return 1;
  })()`);
  await new Promise((r) => setTimeout(r, 100));
  const png = join(tmp, 'page.png'), raw = join(tmp, 'page.rgba');
  writeFileSync(png, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
  return { png, rgba: readFileSync(raw) };
}
const alpha = (rgba, x, y) => rgba[(y * W + x) * 4 + 3];

// visible pixels outside the box (they'd be cut off by baking)
function outside(rgba) {
  let n = 0, l = W, t = H, r = -1, b = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha(rgba, x, y) < 24) continue;
    if (x >= M && x < M + CW && y >= M && y < M + CH) continue;
    n++; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  return n ? { n, box: [l - M, t - M, r - M, b - M] } : null;
}
// the head, the website's way: per row, the longest run of solid pixels (so thin details like the rod don't count);
// the figure's top is the first row with a run of 6px or more, the head width the widest run in the top 38% of it
function head(rgba) {
  const runs = [];
  for (let y = M; y < M + CH; y++) {
    let best = 0, cur = 0, start = 0, bestMid = 0;
    for (let x = M; x < M + CW; x++) {
      if (alpha(rgba, x, y) > 128) { if (!cur) start = x; cur++; if (cur > best) { best = cur; bestMid = (start + x) / 2 - M; } } else cur = 0;
    }
    runs.push({ w: best, mid: bestMid });
  }
  const top = runs.findIndex((r) => r.w >= 6), bottom = runs.length - 1 - [...runs].reverse().findIndex((r) => r.w >= 6);
  const zone = runs.slice(top, top + Math.round((bottom - top) * 0.38));
  const widest = zone.reduce((a, r) => (r.w > a.w ? r : a), { w: 0, mid: 0 });
  return { top, bottom, width: widest.w, mid: Math.round(widest.mid) };
}

// the whole visible outline, in canvas coordinates (can go below 0 / past the canvas if the transform pushes it out)
function bounds(rgba) {
  let l = W, t = H, r = -1, b = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha(rgba, x, y) >= 24) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return [l - M, t - M, r - M, b - M];
}
const forms = Object.entries(cfg.forms).filter(([k]) => !ONLY || k === ONLY);
if (BOUNDS) {
  const show = (b) => `x ${b[0]}…${b[2]} (${b[2] - b[0] + 1} wide), y ${b[1]}…${b[3]} (${b[3] - b[1] + 1} tall)`;
  console.log(`reference ${cfg.reference}: ${show(bounds((await draw(join(OUT, cfg.reference + '.webp'), 'none')).rgba))}`);
  for (const [name, f] of forms) {
    let all = null;
    for (const file of f.files) {
      const b = bounds((await draw(join(SRC, file + '.webp'), arg('transform', f.transform))).rgba);
      all = all ? [Math.min(all[0], b[0]), Math.min(all[1], b[1]), Math.max(all[2], b[2]), Math.max(all[3], b[3])] : b;
    }
    const raw = bounds((await draw(join(SRC, f.files[0] + '.webp'), 'none')).rgba);
    console.log(`${name}: with ${arg('transform', f.transform)}: ${show(all)} (all variants) · untransformed: ${show(raw)}`);
  }
} else if (MEASURE) {
  const ref = head((await draw(join(OUT, cfg.reference + '.webp'), 'none')).rgba);
  console.log(`reference ${cfg.reference}: head top ${ref.top}, width ${ref.width}, centre x ${ref.mid} (figure ${ref.top}-${ref.bottom})`);
  for (const [name, f] of forms) {
    const raw = head((await draw(join(SRC, f.files[0] + '.webp'), 'none')).rgba), now = head((await draw(join(SRC, f.files[0] + '.webp'), f.transform)).rgba);
    const scale = ref.width / raw.width;
    console.log(`${name}: untouched head width ${raw.width} → suggests scale ${scale.toFixed(3)}; with its transform: head top ${now.top} (${now.top - ref.top >= 0 ? '+' : ''}${now.top - ref.top}), width ${now.width} (${now.width - ref.width >= 0 ? '+' : ''}${now.width - ref.width}), centre x ${now.mid} (${now.mid - ref.mid >= 0 ? '+' : ''}${now.mid - ref.mid})`);
  }
} else {
  // check every file first: nothing is written unless all of them fit
  const jobs = [];
  for (const [name, f] of forms) for (const file of f.files) jobs.push({ name, file, transform: f.transform, quality: String(arg('quality', f.quality || QUALITY)) });
  let bad = 0;
  for (const j of jobs) {
    const out = outside((await draw(join(SRC, j.file + '.webp'), j.transform)).rgba);
    if (out) { bad++; console.log(`✗ ${j.file}: ${out.n} visible pixels outside the ${CW}x${CH} canvas (x ${out.box[0]}…${out.box[2]}, y ${out.box[1]}…${out.box[3]}): baking would cut them off; adjust ${j.name}'s transform in forms.json`); }
  }
  if (bad) { console.log('Nothing written.'); process.exitCode = 1; }
  else for (const j of jobs) {
    const { png } = await draw(join(SRC, j.file + '.webp'), j.transform);
    const box = join(tmp, j.file + '.png'), box400 = join(tmp, j.file + '-400.png');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-vf', `crop=${CW}:${CH}:${M}:${M}`, '-frames:v', '1', '-update', '1', box]);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', box, '-vf', 'scale=400:600:flags=lanczos', '-frames:v', '1', '-update', '1', box400]);
    const size = (p) => { try { return statSync(p).size; } catch { return 0; } };
    const b640 = size(join(OUT, j.file + '.webp')), b400 = size(join(OUT, j.file + '-400.webp'));
    execFileSync('cwebp', ['-quiet', '-q', j.quality, '-alpha_q', '100', '-m', '6', box, '-o', join(OUT, j.file + '.webp')]);
    execFileSync('cwebp', ['-quiet', '-q', j.quality, '-alpha_q', '100', '-m', '6', box400, '-o', join(OUT, j.file + '-400.webp')]);
    console.log(`✓ ${j.file}: 640x960 ${(b640 / 1024).toFixed(0)} → ${(size(join(OUT, j.file + '.webp')) / 1024).toFixed(0)} KB, 400x600 ${b400 ? (b400 / 1024).toFixed(0) + ' → ' : '(new) '}${(size(join(OUT, j.file + '-400.webp')) / 1024).toFixed(0)} KB`);
  }
}
ws.close(); chrome.kill();
await new Promise((r) => chrome.once('exit', r));
try { rmSync(tmp, { recursive: true, force: true }); } catch {}
