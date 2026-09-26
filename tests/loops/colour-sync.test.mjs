// The scenes' colour, kept in step between the dock, veadotube and every scene (theme.js, dock-colour.js), on the
// simulated OBS browser (tests/helpers/sim.mjs). Every scenario must:
//   settle   — after the last input, nothing is left running (a runaway is a loop: the 2026-09-26 Princess/Blobfish bug)
//   agree    — every page ends on veadotube's actual state (or the last button, when veadotube never answers)
//   not flicker — one veadotube switch per button press, and at most one recolour per input on any page
import test from 'node:test';
import assert from 'node:assert/strict';
import { obsWorld } from '../helpers/obs-world.mjs';
import { readAt, fakeVeado } from '../helpers/sim.mjs';

const SEEDS = +process.env.TGL_SEEDS || 40;   // TGL_SEEDS=400 for a longer run
const settle = (w, what) => {
  const r = w.clock.run({ maxSteps: 20000 });
  assert.ok(!r.runaway, `${what}: still going after 20000 events (a loop). What each page applied:\n${w.trace()}`);
};
const agree = (w, want, what) => {
  const forms = w.forms(), off = Object.entries(forms).filter(([, f]) => f !== want);
  assert.deepEqual(off, [], `${what}: pages not on ${want}: ${JSON.stringify(Object.fromEntries(off))}\n${w.trace()}`);
};
const bounded = (w, inputs, what) => {
  // no flicker: a page changes colour at most once per input, however many routes the input reaches it by
  // (veadotube, the other pages, the dock). Before the pick times and the quiet period, 4 presses gave up to 26.
  const max = inputs;
  for (const [name, n] of Object.entries(w.changes())) assert.ok(n <= max, `${what}: ${name} recoloured ${n} times for ${inputs} inputs\n${w.trace()}`);
};

test('veadotube switching quickly (0–60 ms apart) settles, and every page follows it', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const w = obsWorld({ seed }); w.boot();
    const n = w.rand.int(2, 4);
    for (let i = 0; i < n; i++) { w.veado.change(w.rand.pick(['princess', 'blobfish', 'cyan', 'red'])); w.clock.run({ until: w.clock.now + w.rand.int(0, 60) }); }
    const what = `seed ${seed}`;
    settle(w, what); agree(w, w.veado.current, what); bounded(w, n, what);
    w.close();
  }
});

test('dock buttons pressed quickly: one veadotube switch per press, and everything ends on the last press', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const w = obsWorld({ seed }); w.boot();
    const presses = [];
    const n = w.rand.int(2, 4);
    for (let i = 0; i < n; i++) { const f = w.rand.pick(['princess', 'blobfish', 'cyan', 'yellow']); presses.push(f); w.dock.choose(f); w.clock.run({ until: w.clock.now + w.rand.int(0, 80) }); }
    const what = `seed ${seed}, presses ${presses.join(' ')}`;
    settle(w, what);
    assert.equal(w.veado.sets.length, n, `${what}: ${w.veado.sets.length} veadotube switches for ${n} presses`);
    agree(w, presses.at(-1), what); bounded(w, n, what);
    w.close();
  }
});

test('veadotube never confirming: the dock gives up after 3 s and recolours to the last press, once', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const w = obsWorld({ seed, veado: { confirm: null } }); w.boot();
    w.dock.choose('princess'); w.clock.run({ until: w.clock.now + 30 }); w.dock.choose('blobfish');
    settle(w, `seed ${seed}`);
    assert.equal(w.veado.sets.length, 2);
    agree(w, 'blobfish', `seed ${seed}`); bounded(w, 2, `seed ${seed}`);
    w.close();
  }
});

test('veadotube sending duplicate or out-of-order confirmations: still settles on its real state', () => {
  for (const veado of [{ duplicate: true }, { outOfOrder: true }, { duplicate: true, outOfOrder: true }]) {
    for (let seed = 1; seed <= 20; seed++) {
      const w = obsWorld({ seed, veado }); w.boot();
      for (const f of ['princess', 'blobfish', 'princess']) { w.dock.choose(f); w.clock.run({ until: w.clock.now + w.rand.int(0, 40) }); }
      const what = `${JSON.stringify(veado)} seed ${seed}`;
      settle(w, what); agree(w, w.veado.current, what); bounded(w, 3, what);
      w.close();
    }
  }
});

test('scenes waiting before recolouring (veadodelay=300) still settle and agree', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = obsWorld({ seed, sceneQuery: 'veadodelay=300' }); w.boot();
    w.veado.change('princess'); w.clock.run({ until: w.clock.now + w.rand.int(0, 50) }); w.veado.change('blobfish');
    settle(w, `seed ${seed}`); agree(w, 'blobfish', `seed ${seed}`);
    w.close();
  }
});

test('a long random session (buttons and veadotube, 25 inputs over ~10 s) settles and agrees', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const w = obsWorld({ seed }); w.boot();
    let last = null;
    for (let i = 0; i < 25; i++) {
      const f = w.rand.pick(['princess', 'blobfish', 'cyan', 'red', 'yellow']);
      if (w.rand() < .5) w.veado.change(f); else w.dock.choose(f);
      last = f;
      w.clock.run({ until: w.clock.now + w.rand.int(0, 800) });
    }
    const what = `seed ${seed}`;
    settle(w, what); agree(w, w.veado.current, what); bounded(w, 25, what);
    assert.ok(last);
    w.close();
  }
});

test('veadotube going away: every page retries every 5 s with one socket at a time, and follows again once it is back', () => {
  const w = obsWorld({ seed: 3 }); w.boot();
  w.veado.dropAll(); w.net.down('127.0.0.1:54765');
  const before = Object.fromEntries(Object.values(w.pages).map((p) => [p.name, p.stats.sockets]));
  w.clock.run({ until: w.clock.now + 60000 });
  for (const p of Object.values(w.pages)) {
    const tries = p.stats.sockets - before[p.name];
    const follows = !['brb', 'starting', 'ending'].includes(p.name);
    // the pages that follow veadotube: ~12 tries a minute (and their OBS socket stays up); never a pile of sockets
    if (follows) assert.ok(tries >= 10 && tries <= 13, `${p.name}: ${tries} veadotube connection attempts in 60 s`);
    assert.ok(p.sockets.size <= 2, `${p.name}: ${p.sockets.size} sockets open`);
  }
  // back: the next retry connects, and a switch reaches everyone
  const back = fakeVeado(w.net, '127.0.0.1:54765');
  w.clock.run({ until: w.clock.now + 6000 });
  back.change('princess');
  settle(w, 'after reconnecting'); agree(w, 'princess', 'after reconnecting');
  w.close();
});

test('proof: the colour sync from before the fix (e181e2d~1) loops in this model', (t) => {
  const old = readAt('e181e2d~1', 'public/obs/shared/theme.js');
  if (!old) return t.skip('git history not available');
  let loops = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = obsWorld({ seed, theme: ['theme.js (e181e2d~1)', old] }); w.boot();
    w.dock.choose('princess'); w.clock.run({ until: w.clock.now + 20 }); w.dock.choose('blobfish');
    if (w.clock.run({ maxSteps: 20000 }).runaway) loops++;
    w.close();
    if (loops) break;
  }
  assert.ok(loops > 0, 'the old code never looped here, so these tests would not have caught the bug');
});
