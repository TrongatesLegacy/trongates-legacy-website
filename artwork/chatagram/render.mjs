// Renders artwork/chatagram/og.html to public/chatagram/assets/og.jpg (1200 × 630), Chatagram's link-preview image.
// The page is served next to public/ (the test server), so the overlay in it is the real one in its "still" mode.
// Usage: node --experimental-websocket artwork/chatagram/render.mjs   (needs Google Chrome + ffmpeg). Look at it after.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../../tests/helpers/chrome.mjs';
import { siteServer } from '../../tests/helpers/server.mjs';

const here = new URL('.', import.meta.url).pathname, root = join(here, '../..');
const site = await siteServer({ files: { '/og-compose.html': readFileSync(join(here, 'og.html'), 'utf8') } });
const chrome = await launch();
try {
  const tab = await chrome.open(site.origin + '/og-compose.html', { width: 1200, height: 630 });
  await tab.until(`document.querySelector('iframe').contentDocument?.documentElement.dataset.ready === '1'`, 10000);
  await tab.eval('Promise.all([document.fonts.ready, document.querySelector("iframe").contentDocument.fonts.ready]).then(() => new Promise((r) => setTimeout(r, 400)))');
  const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  const png = join(tmpdir(), 'chatagram-og.png'), jpg = join(root, 'public/chatagram/assets/og.jpg');
  writeFileSync(png, Buffer.from(data, 'base64'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', jpg]);
  console.log(`public/chatagram/assets/og.jpg (${Math.round(statSync(jpg).size / 1024)} KB). Look at it before committing.`);
} finally { await chrome.close(); await site.close(); }
