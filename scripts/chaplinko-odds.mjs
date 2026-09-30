// Chaplinko's odds (docs/widgets.md, "Chaplinko: the board"): drops real balls through the real physics
// (public/chaplinko/physics.js) and writes where they land to public/chaplinko/odds.js, which the set-up page shows
// ("100: 1 in 1,024") and the tests check the physics against. Each seed is dropped twice, once mirrored, so the table
// is exactly fair side to side. Re-run whenever physics.js changes (a test fails until you do).
// Usage: node scripts/chaplinko-odds.mjs [seeds per row count, default 50000 = 100,000 drops]   (about a minute)
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(new URL('.', import.meta.url).pathname, '..');
const ctx = vm.createContext({ Math }); ctx.window = ctx;
vm.runInContext(readFileSync(join(root, 'public/chaplinko/physics.js'), 'utf8'), ctx);
const P = ctx.Chaplinko.physics;
const SEEDS = +process.argv[2] || 50000;

const counts = {};
for (let rows = P.ROWS[0]; rows <= P.ROWS[1]; rows++) {
  const c = new Array(rows + 1).fill(0);
  for (let s = 1; s <= SEEDS; s++) { c[P.drop(s, { rows }).slot]++; c[P.drop(s, { rows, mirror: true }).slot]++; }
  counts[rows] = c;
  console.log(rows, c.join(' '));
}
// the first seeds' landings, exactly: any change to the physics changes some of these (the test replays them)
const check = { rows: 10, slots: Array.from({ length: 60 }, (_, i) => P.drop(i + 1, { rows: 10 }).slot) };

const out = `// Chaplinko's odds: where ${(SEEDS * 2).toLocaleString('en')} real drops landed for each row count, made by
// scripts/chaplinko-odds.mjs from physics.js (every seed dropped twice, once mirrored). Don't edit by hand: re-run the
// script when the physics changes. check: the first 60 seeds' slots at 10 rows, replayed exactly by the tests.
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  K.odds = ${JSON.stringify({ drops: SEEDS * 2, counts, check })};
})();
`;
writeFileSync(join(root, 'public/chaplinko/odds.js'), out);
console.log('wrote public/chaplinko/odds.js');
