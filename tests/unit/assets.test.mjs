// The character art is pre-sized (docs/design-system.md, "Character sizing"): every form on one 640 × 960 canvas,
// with a 400 × 600 copy, so the site, the scenes and the artwork use any form as is. Measured from the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { ROOT, read } from '../helpers/sim.mjs';

const IMG = ROOT + 'public/assets/img/';
// a WebP's pixel size, from its header (lossy VP8, lossless VP8L, extended VP8X)
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), 'RIFFWEBP', `${file} is not a WebP`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}
const ART = readdirSync(IMG).filter((f) => /^(tron|princess|blobfish)-.*\.webp$/.test(f));

test('every character image is on the shared canvas: 640 × 960, and 400 × 600 for the -400 copy', () => {
  assert.ok(ART.length >= 30, `only ${ART.length} character images found`);
  for (const f of ART) assert.deepEqual(webpSize(IMG + f), f.endsWith('-400.webp') ? [400, 600] : [640, 960], f);
});

test('every full-size character image has its 400 copy', () => {
  for (const f of ART.filter((x) => !x.endsWith('-400.webp'))) assert.ok(existsSync(IMG + f.replace('.webp', '-400.webp')), `${f} has no -400 copy`);
});

test('every image the website and the scenes ask for exists', () => {
  const states = ['mclosed-eopen', 'mclosed-eclosed', 'mopen-eopen', 'mopen-eclosed'];
  const site = [...['cyan', 'yellow', 'red'].flatMap((t) => states.map((s) => `tron-${t}-${s}`)), ...states.map((s) => `blobfish-${s}`), 'princess-peace', 'princess-uwu'];
  const scene = [...read('public/obs/shared/scene.js').matchAll(/'((?:tron|princess|blobfish)-[a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(scene.length >= 5, 'found the scenes\' art list');
  for (const name of [...site, ...scene]) assert.ok(existsSync(IMG + name + '.webp'), `${name}.webp is missing`);
});
