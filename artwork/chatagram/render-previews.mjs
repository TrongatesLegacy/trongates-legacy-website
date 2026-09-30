// Renders the pictures the Chatagram and widgets pages show before (or instead of) a live game:
// public/chatagram/assets/themes/<theme>.webp (compact) and <theme>-full.webp (full), for every theme. Each is the real
// overlay in its seeded "still" mode (play.html?still=1), on a transparent background. Re-run whenever the overlay's
// look changes (a test checks every theme has both pictures). docs/widgets.md, "The Chatagram page".
// Usage: node --experimental-websocket artwork/chatagram/render-previews.mjs [theme…]   (needs Google Chrome + cwebp;
// name themes to render only those, e.g. a newly added one)
import { writeFileSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { launch } from '../../tests/helpers/chrome.mjs';
import { siteServer } from '../../tests/helpers/server.mjs';

const root = join(new URL('.', import.meta.url).pathname, '../..'), out = join(root, 'public/chatagram/assets/themes');
const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(readFileSync(join(root, 'public/widgets/lib/theme.js'), 'utf8').replace('matchMedia(', '(() => ({ matches: false }))('), ctx);
vm.runInContext(readFileSync(join(root, 'public/chatagram/settings.js'), 'utf8'), ctx);
const only = process.argv.slice(2), THEMES = [...ctx.Chatagram.settings.THEMES].filter((t) => !only.length || only.includes(t)), SIZES = ctx.Chatagram.settings.SIZES;
// compact at 1.5× (shown up to ~400 px wide on retina screens); full at 1× (the live game replaces it within a second)
const LAYOUTS = { compact: { scale: 1.5, suffix: '' }, full: { scale: 1, suffix: '-full' } };
mkdirSync(out, { recursive: true });
const site = await siteServer(), chrome = await launch();
try {
  for (const [layout, { scale, suffix }] of Object.entries(LAYOUTS)) {
    const [w, h] = SIZES[layout];
    for (const theme of THEMES) {
      const tab = await chrome.open(`${site.origin}/chatagram/play.html?still=1&theme=${theme}&layout=${layout}`, { width: w, height: h });
      await tab.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
      await tab.until('document.documentElement.dataset.ready === "1"', 10000);
      await tab.eval('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))');
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale } });
      await tab.close();
      const png = join(tmpdir(), `cg-${theme}${suffix}.png`), webp = join(out, `${theme}${suffix}.webp`);
      writeFileSync(png, Buffer.from(data, 'base64'));
      execFileSync('cwebp', ['-quiet', '-q', '82', '-alpha_q', '90', png, '-o', webp]);
      console.log(`${webp.replace(root, '')} ${Math.round(statSync(webp).size / 1024)} KB`);
    }
  }
} finally { await chrome.close(); await site.close(); }
