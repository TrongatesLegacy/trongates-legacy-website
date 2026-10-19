// Renders Inputty's pictures from the real overlay, with a few keys held down: artwork/inputty/og.html to
// public/inputty/assets/og.jpg (1200 × 630, the link preview) and artwork/inputty/scene.html to
// public/inputty/assets/scene.webp (960 × 540, its scene and lineup picture on the widgets page). The pages are served
// next to public/ (the test server).
// Usage: node --experimental-websocket artwork/inputty/render.mjs   (needs Google Chrome + ffmpeg). Look at it after.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../../tests/helpers/chrome.mjs';
import { siteServer } from '../../tests/helpers/server.mjs';

const here = new URL('.', import.meta.url).pathname, root = join(here, '../..');
const site = await siteServer({ files: { '/og-compose.html': readFileSync(join(here, 'og.html'), 'utf8'), '/scene-compose.html': readFileSync(join(here, 'scene.html'), 'utf8') } });
const chrome = await launch();
async function shoot(page, w, h) {
  const tab = await chrome.open(site.origin + page, { width: w, height: h });
  await tab.until(`document.querySelector('iframe').contentWindow?.IOInput && document.querySelector('iframe').contentDocument.documentElement.dataset.ready === '1'`, 10000);
  // hold W, Shift and the left mouse button, like someone mid-game
  await tab.eval(`(() => { const I = document.querySelector('iframe').contentWindow.IOInput; I.key(0x11, true); I.key(0x2a, true); I.mouse(1, true); return 1; })()`);
  await tab.eval('Promise.all([document.fonts.ready, document.querySelector("iframe").contentDocument.fonts.ready]).then(() => new Promise((r) => setTimeout(r, 600)))');
  const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  await tab.close();
  const png = join(tmpdir(), 'inputty-shot.png');
  writeFileSync(png, Buffer.from(data, 'base64'));
  return png;
}
try {
  const og = join(root, 'public/inputty/assets/og.jpg'), scene = join(root, 'public/inputty/assets/scene.webp');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', await shoot('/og-compose.html', 1200, 630), '-q:v', '3', og]);
  execFileSync('cwebp', ['-quiet', '-q', '84', await shoot('/scene-compose.html', 960, 540), '-o', scene]);
  console.log(`og.jpg (${Math.round(statSync(og).size / 1024)} KB), scene.webp (${Math.round(statSync(scene).size / 1024)} KB) in public/inputty/assets/. Look at them before committing.`);
} finally { await chrome.close(); await site.close(); }
