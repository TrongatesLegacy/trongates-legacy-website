// Renders the trailer's YouTube thumbnails from thumbnail.html at YouTube's recommended sizes: 3840 × 2160 for the video
// and 2160 × 3840 for the Short, as JPGs under 2 MB (the phone-upload limit; desktop allows 50 MB).
// Usage: node --experimental-websocket artwork/chatagram/trailer/thumbnail.mjs [out dir, default ~/Downloads]
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../../../tests/helpers/chrome.mjs';
import { siteServer } from '../../../tests/helpers/server.mjs';

const here = new URL('.', import.meta.url).pathname, OUT = process.argv[2] || join(homedir(), 'Downloads');
const site = await siteServer({ files: { '/thumbnail.html': readFileSync(join(here, 'thumbnail.html'), 'utf8') } });
const chrome = await launch();
try {
  for (const [name, q, w, h] of [['chatagram-thumbnail.jpg', '', 1920, 1080], ['chatagram-short-thumbnail.jpg', '?v=1', 1080, 1920]]) {
    const tab = await chrome.open(site.origin + '/thumbnail.html' + q, { width: w, height: h });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
    await tab.eval('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode()))).then(() => new Promise((r) => setTimeout(r, 300)))');
    const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 }, captureBeyondViewport: false });
    await tab.close();
    const png = join(tmpdir(), name.replace('.jpg', '.png')), jpg = join(OUT, name);
    writeFileSync(png, Buffer.from(data, 'base64'));
    for (const q of [2, 3, 4, 5]) {                                    // best quality that stays under 2 MB
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-q:v', String(q), jpg]);
      if (statSync(jpg).size < 1.9 * 1024 * 1024) break;
    }
    const dims = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', jpg], { encoding: 'utf8' }).trim();
    console.log(`${jpg} ${dims} ${(statSync(jpg).size / 1024 / 1024).toFixed(2)} MB`);
  }
} finally { await chrome.close(); await site.close(); }
