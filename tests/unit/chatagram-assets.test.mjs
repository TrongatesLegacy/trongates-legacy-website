// The pictures the Chatagram and widgets pages show before a live game starts (artwork/chatagram/render-previews.mjs):
// one per theme and layout, at the layout's shape, so no theme or layout is ever missing its picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT, read } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams }); ctx.window = ctx;
for (const f of ['public/widgets/lib/theme.js', 'public/chatagram/settings.js']) vm.runInContext(read(f), ctx);
const THEMES = [...ctx.Widgets.theme.THEMES], SIZES = ctx.Chatagram.settings.SIZES;
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), 'RIFFWEBP', `${file} is not a WebP`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}

test('every theme has a picture in both layouts, at the layout\'s shape', () => {
  for (const t of THEMES) for (const [layout, suffix] of [['compact', ''], ['full', '-full']]) {
    const file = `${ROOT}public/chatagram/assets/themes/${t}${suffix}.webp`;
    assert.ok(existsSync(file), `${t}${suffix}.webp is missing: run artwork/chatagram/render-previews.mjs`);
    const [w, h] = webpSize(file), [lw, lh] = SIZES[layout];
    assert.ok(Math.abs(w / h - lw / lh) < 0.01, `${t}${suffix}.webp is ${w}×${h}, not the ${layout} layout's shape (${lw}×${lh})`);
  }
});

test('the full layout is 16:9, so it fills a 1920 × 1080 source exactly', () => {
  assert.deepEqual([...SIZES.full], [960, 540]);
});
