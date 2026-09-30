// Chaplinko's physics (public/chaplinko/physics.js) and its odds table (odds.js, made by scripts/chaplinko-odds.mjs):
// drops replay exactly, the board is fair side to side, every ball lands, and the table still matches the physics (so a
// change to the physics can't quietly make the top slot easier or harder: re-run the script and the numbers show it).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from '../helpers/sim.mjs';

const ctx = vm.createContext({ Math }); ctx.window = ctx;
for (const f of ['physics.js', 'odds.js']) vm.runInContext(read('public/chaplinko/' + f), ctx);
const P = ctx.Chaplinko.physics, ODDS = ctx.Chaplinko.odds;

test('the odds table matches the physics: its first 60 drops replay exactly (re-run scripts/chaplinko-odds.mjs after changing physics.js)', () => {
  const got = ODDS.check.slots.map((_, i) => P.drop(i + 1, { rows: ODDS.check.rows }).slot);
  assert.deepEqual(got, ODDS.check.slots);
});

test('the odds table: every row count 8–12, every drop counted, exactly fair side to side, the edge slots the rarest', () => {
  for (let rows = 8; rows <= 12; rows++) {
    const c = ODDS.counts[rows];
    assert.equal(c.length, rows + 1, `${rows} rows`);
    assert.equal(c.reduce((a, b) => a + b, 0), ODDS.drops, `${rows} rows: every drop landed somewhere`);
    assert.deepEqual([...c].reverse(), [...c], `${rows} rows: mirrored`);
    const edge = c[0], rest = c.slice(1, -1);
    assert.ok(edge > 0 && edge < Math.min(...rest), `${rows} rows: the edge slot can be hit and is the rarest`);
  }
  // more rows, a rarer top slot
  assert.ok(ODDS.counts[8][0] > ODDS.counts[10][0] && ODDS.counts[10][0] > ODDS.counts[12][0]);
});

test('a drop replays exactly from its seed, and its mirror lands in the mirrored slot', () => {
  for (const rows of [8, 10, 12]) for (let s = 1; s <= 40; s++) {
    const a = P.drop(s, { rows }), b = P.drop(s, { rows }), m = P.drop(s, { rows, mirror: true });
    assert.equal(a.slot, b.slot);
    assert.equal(m.slot, rows - a.slot, `${rows} rows, seed ${s}`);
  }
});

test('every ball lands, within 8 s on its own', () => {
  for (const rows of [8, 10, 12]) for (let s = 1000; s < 1150; s++) {
    const r = P.drop(s, { rows });
    assert.ok(r.slot >= 0 && r.slot <= rows && r.time < 8, `${rows} rows, seed ${s}: ${r.time.toFixed(1)} s`);
  }
});

test('a crowd: 100 balls at once, bumping each other, all land and none stays on the board', () => {
  for (const collide of [true, false]) {
    const w = P.world({ rows: 10, collide });
    for (let i = 0; i < 100; i++) w.add({ seed: i + 1 });
    let landed = 0;
    for (let i = 0; i < 120 * 35 && w.balls.length; i++) landed += w.step().filter((e) => e.type === 'land').length;
    assert.equal(w.balls.length, 0, `collide ${collide}: ${w.balls.length} still on the board`);
    assert.equal(landed, 100);
  }
});

test('the layout: the slots sit under the gaps of the bottom row, and the board fits 640 × 540 at every row count', () => {
  for (let rows = 8; rows <= 12; rows++) {
    const L = P.layout(rows), bottom = L.pegs.filter((p) => p.row === rows - 1);
    assert.equal(L.slots.n, rows + 1);
    assert.equal(bottom.length, rows + 2);
    assert.ok(Math.abs(bottom[0].x - L.slots.x0) < 1e-9 && Math.abs(bottom.at(-1).x - (L.slots.x0 + L.slots.n * L.slots.w)) < 1e-9);
    assert.ok(L.slots.x0 >= 20 && L.slots.x0 + L.slots.n * L.slots.w <= 620, `${rows} rows fit the width`);
    assert.ok(L.top - L.pegR > 36, `${rows} rows: the pegs start below the chute`);
    assert.ok(L.ballR * 2 < L.gap - 2 * L.pegR, `${rows} rows: a ball fits between two pegs`);
  }
  assert.equal(P.layout(20).rows, 12, 'rows are kept to 8–12');
  assert.equal(P.layout(3).rows, 8);
});
