// Renders the pictures the Chaplinko and widgets pages show before (or instead of) a live board:
// public/chaplinko/assets/themes/<theme>.webp (the board with its background, for the Looks gallery), clear.webp (the
// board transparent, the default: the hero and the set-up preview) and combined.webp (the combined layout, transparent).
// Each is the real board in its seeded "still" mode (play.html?still=1). Re-run whenever the board's look changes (a test
// checks every theme has its picture). docs/widgets.md, "The Chaplinko page".
// Usage: node --experimental-websocket artwork/chaplinko/render-previews.mjs [name…]   (needs Google Chrome + cwebp)
import { writeFileSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { launch } from '../../tests/helpers/chrome.mjs';
import { siteServer } from '../../tests/helpers/server.mjs';

const root = join(new URL('.', import.meta.url).pathname, '../..'), out = join(root, 'public/chaplinko/assets/themes');
const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(readFileSync(join(root, 'public/widgets/lib/theme.js'), 'utf8').replace('matchMedia(', '(() => ({ matches: false }))('), ctx);
const jobs = [
  ...[...ctx.Widgets.theme.THEMES].map((t) => ({ name: t, query: `theme=${t}&bgo=100`, w: 640, h: 540 })),
  { name: 'clear', query: '', w: 640, h: 540 },
  { name: 'combined', query: 'layout=combined', w: 960, h: 540 },
];
const only = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const site = await siteServer(), chrome = await launch();
try {
  for (const j of jobs.filter((x) => !only.length || only.includes(x.name))) {
    const tab = await chrome.open(`${site.origin}/chaplinko/play.html?still=1&${j.query}`, { width: j.w, height: j.h });
    await tab.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await tab.until('document.documentElement.dataset.ready === "1"', 10000);
    await tab.eval('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 400)))');
    const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: j.w, height: j.h, scale: 1 } });
    await tab.close();
    const png = join(tmpdir(), `cp-${j.name}.png`), webp = join(out, `${j.name}.webp`);
    writeFileSync(png, Buffer.from(data, 'base64'));
    execFileSync('cwebp', ['-quiet', '-q', '82', '-alpha_q', '90', png, '-o', webp]);
    console.log(`${webp.replace(root, '')} ${Math.round(statSync(webp).size / 1024)} KB`);
  }
} finally { await chrome.close(); await site.close(); }
