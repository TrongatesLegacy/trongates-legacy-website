// Records trailer.html to an MP4 with the music (music.mjs): headless Chrome's screencast frames, with their timestamps,
// become a constant 30 fps video. The page is served next to public/ (the test server), so the game in it is real.
// Usage: node --experimental-websocket artwork/chatagram/trailer/record.mjs ~/Downloads/chatagram-trailer.mp4 [--vertical]
//   --vertical: 1080 × 1920 for Shorts / Reels / TikTok (the same scenes, laid out for a phone)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../../../tests/helpers/chrome.mjs';
import { siteServer } from '../../../tests/helpers/server.mjs';

const here = new URL('.', import.meta.url).pathname;
const V = process.argv.includes('--vertical'), [W, H] = V ? [1080, 1920] : [1920, 1080];
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) || join(homedir(), 'Downloads', V ? 'chatagram-trailer-short.mp4' : 'chatagram-trailer.mp4'), LEN = 30;
const dir = mkdtempSync(join(tmpdir(), 'chatagram-trailer-'));
const music = join(dir, 'music.m4a');
execFileSync('node', [join(here, 'music.mjs'), music]);
const site = await siteServer({ files: { '/trailer.html': readFileSync(join(here, 'trailer.html'), 'utf8') } });
const chrome = await launch();
try {
  const tab = await chrome.open(site.origin + '/trailer.html' + (V ? '?v=1' : ''), { width: W, height: H });
  await tab.until('window.ready()', 10000);
  const frames = [];
  tab.on('Page.screencastFrame', (p) => {
    frames.push({ t: p.metadata.timestamp, data: p.data });
    tab.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
  });
  await tab.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await new Promise((r) => setTimeout(r, 300));
  const t0 = Date.now() / 1000;
  await tab.eval('start(), 1');
  await new Promise((r) => setTimeout(r, (LEN + 0.6) * 1000));
  await tab.send('Page.stopScreencast');
  // frames → a list with each frame's duration, starting at start()
  const kept = frames.filter((f) => f.t >= t0 - 0.05);
  let list = '';
  kept.forEach((f, i) => {
    const file = join(dir, `f${String(i).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = i + 1 < kept.length ? kept[i + 1].t : t0 + LEN;
    list += `file '${file}'\nduration ${Math.max(0.001, Math.min(next, t0 + LEN) - f.t).toFixed(4)}\n`;
  });
  list += `file '${join(dir, `f${String(kept.length - 1).padStart(5, '0')}.jpg`)}'\n`;
  writeFileSync(join(dir, 'list.txt'), list);
  console.log(`${kept.length} frames captured over ${LEN} s (${(kept.length / LEN).toFixed(1)} fps before resampling)`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-i', music,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'copy', '-t', String(LEN), '-movflags', '+faststart', OUT]);
  console.log(OUT);
} finally { await chrome.close(); await site.close(); rmSync(dir, { recursive: true, force: true }); }
