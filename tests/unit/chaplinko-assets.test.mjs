// The pictures the Chaplinko and widgets pages show before a live board starts (artwork/chaplinko/render-previews.mjs),
// the mark and the link-preview image: all there, at the board's shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import { ROOT, read } from '../helpers/sim.mjs';

const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(read('public/chaplinko/settings.js'), ctx);
// a WebP's size, from its header (VP8, VP8L or VP8X)
function webpSize(file) {
  const b = readFileSync(file), kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

test('every theme has its picture, plus the transparent board and the combined layout, at the right shape', () => {
  for (const [name, w, h] of [...[...ctx.Chaplinko.settings.THEMES].map((t) => [t, 640, 540]), ['clear', 640, 540], ['combined', 960, 540]]) {
    const file = `${ROOT}public/chaplinko/assets/themes/${name}.webp`;
    assert.ok(existsSync(file), `${name}.webp is missing: run artwork/chaplinko/render-previews.mjs`);
    assert.deepEqual(webpSize(file), [w, h], `${name}.webp`);
  }
  assert.ok(existsSync(`${ROOT}public/chaplinko/assets/icon.svg`) && existsSync(`${ROOT}public/chaplinko/assets/og.jpg`));
});
