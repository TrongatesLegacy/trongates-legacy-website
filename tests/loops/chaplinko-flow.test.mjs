// Chaplinko left running on the virtual clock, driven the way the board drives it (each frame: take what's due, step the
// physics, land what landed), through quiet spells, steady spam and raids: every ball dropped lands and scores exactly
// once, the queue never grows past its limit and always drains, nothing stays on the board, and the board calms back
// down to Quiet after a flood (no level stuck on).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, rng } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams, JSON, Math, Date }); ctx.window = ctx;
for (const f of ['public/widgets/lib/settings.js', 'public/chaplinko/settings.js', 'public/chaplinko/physics.js', 'public/chaplinko/odds.js', 'public/chaplinko/game.js']) vm.runInContext(read(f), ctx);
const K = ctx.Chaplinko, S = ctx.Widgets.settings;
const SEEDS = (process.env.TGL_SEEDS | 0) || 3;

function run(link, seed, minutes) {
  const rand = rng(seed), cfg = S.decode(K.settings.SCHEMA, link);
  let now = 1_790_000_000_000, dropped = 0, landed = 0, scored = 0, maxQueue = 0, maxBoard = 0;
  const world = K.physics.world({ rows: cfg.rows });
  const g = K.game(cfg, { now: () => now, layout: world.layout, award: (m, pts, n) => { scored += n; } });
  const levels = new Set();
  const FRAME = 1000 / 60;
  // chat: quiet spells, steady spam, and a raid every few minutes (40 people at once)
  let nextChat = now, raidAt = now + 60000;
  for (let t = 0; t < minutes * 60000; t += FRAME) {
    now += FRAME;
    if (now >= raidAt) { for (let i = 0; i < 40; i++) if (g.handle({ platform: 'twitch', user: 'r' + i, name: 'R' + i, text: '!plinko', mod: false, owner: false }).kind === 'drop') dropped += cfg.balls; raidAt = now + rand.int(120000, 240000); }
    if (now >= nextChat) {
      if (g.handle({ platform: rand() < 0.5 ? 'twitch' : 'kick', user: 'p' + rand.int(0, 30), name: 'P', text: rand() < 0.8 ? '!plinko' : 'hello', mod: false, owner: false }).kind === 'drop') dropped += cfg.balls;
      nextChat = now + (rand() < 0.3 ? rand.int(200, 800) : rand.int(1500, 12000));
    }
    for (const it of g.take(world.balls.length)) world.add({ seed: rand.int(1, 2 ** 31), data: it });
    for (let i = 0; i < 2; i++) for (const e of world.step()) if (e.type === 'land') { landed++; g.land(e.ball.data.by, e.slot, e.x); }
    maxQueue = Math.max(maxQueue, g.queued); maxBoard = Math.max(maxBoard, world.balls.length); levels.add(g.level);
  }
  // chat stops: everything drains
  for (let t = 0; t < 90000 && (g.queued || world.balls.length); t += FRAME) {
    now += FRAME;
    for (const it of g.take(world.balls.length)) world.add({ seed: rand.int(1, 2 ** 31), data: it });
    for (let i = 0; i < 2; i++) for (const e of world.step()) if (e.type === 'land') { landed++; g.land(e.ball.data.by, e.slot, e.x); }
  }
  for (let t = 0; t < 4000; t += FRAME) { now += FRAME; g.take(world.balls.length); }
  return { dropped, landed, scored, maxQueue, maxBoard, levels, queued: g.queued, board: world.balls.length, level: g.level, cfg };
}

test('spam, raids and quiet spells: every ball lands and scores once, the queue drains, the board calms down', () => {
  for (let seed = 1; seed <= SEEDS; seed++) for (const link of ['', 'max=40&balls=10', 'rows=8&balls=1']) {
    const r = run(link, seed, 12);
    const what = `seed ${seed}, "${link}"`;
    assert.ok(r.dropped > 0, what);
    assert.equal(r.landed, r.dropped, `${what}: every ball dropped landed`);
    assert.equal(r.scored, r.landed, `${what}: every landing scored exactly once`);
    assert.ok(r.maxQueue <= K.game.QUEUE_MAX, `${what}: the queue stays within its limit (${r.maxQueue})`);
    assert.ok(r.maxBoard <= r.cfg.max, `${what}: never more than the most on the board (${r.maxBoard})`);
    assert.equal(r.queued, 0, `${what}: the queue drained`);
    assert.equal(r.board, 0, `${what}: nothing stayed on the board`);
    if (40 * r.cfg.balls > K.game.LEVELS.frenzy) assert.ok(r.levels.has('frenzy'), `${what}: the raids made a Frenzy`);   // (40 people × 1 ball isn't one)
    assert.equal(r.level, 'quiet', `${what}: and it calmed down again`);
  }
});
