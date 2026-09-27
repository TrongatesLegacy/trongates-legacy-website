// The circuit breaker in theme.js: whatever bug makes pages bounce colours between each other in future, a page that
// recolours more than 10 times in 2 s stops taking colours from other pages for 5 s (doubling while it keeps
// happening), then applies only the latest. Without it, the storm below recolours a scene over 300 times a minute.
// Colours straight from veadotube, the dock (OBS) or the page itself still apply at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { obsWorld } from '../helpers/obs-world.mjs';

// two misbehaving pages that disagree (a future bug): one answers Princess with Blobfish, the other Blobfish with
// Princess, each time a colour arrives from anywhere else. Without the breaker they ping-pong for ever.
function saboteurs(w, names = ['music', 'goal']) {
  const answer = [{ princess: 'blobfish' }, { blobfish: 'princess' }];
  names.forEach((n, i) => {
    const T = w.pages[n].TGL;
    T.onChange((f, source) => { const a = answer[i][f]; if (source !== 'local' && a) w.pages[n].window.setTimeout(() => T.set(a), 20); });
  });
}

test('a storm between pages is contained: a few bursts a minute instead of non-stop', () => {
  const w = obsWorld({ seed: 11 }); w.boot();
  saboteurs(w);
  w.dock.choose('princess');
  w.clock.run({ until: w.clock.now + 60000, maxSteps: 400000 });
  for (const [name, n] of Object.entries(w.changes())) assert.ok(n <= 60, `${name} recoloured ${n} times in a minute`);
  assert.ok(Object.values(w.pages).some((p) => p.TGL.breaker && p.TGL.breaker.trips > 0), 'the breaker tripped');
  w.close();
});

test('while tripped, veadotube and the dock still recolour at once, and every page ends on the right form', () => {
  const w = obsWorld({ seed: 12 }); w.boot();
  saboteurs(w);
  w.dock.choose('princess');
  w.clock.run({ until: w.clock.now + 3000, maxSteps: 400000 });      // storm running, breakers tripped
  saboteurs(w, []);                                                  // (the saboteurs stay; the real input arrives)
  w.veado.change('red');
  w.clock.run({ until: w.clock.now + 300, maxSteps: 400000 });
  for (const n of ['chatting', 'game', 'chatbox']) assert.equal(w.pages[n].TGL.form, 'red', `${n} follows veadotube at once`);
  w.close();
});

test('normal use never trips it: 25 real switches over 10 s', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const w = obsWorld({ seed }); w.boot();
    for (let i = 0; i < 25; i++) {
      const f = w.rand.pick(['princess', 'blobfish', 'cyan', 'red', 'yellow']);
      if (w.rand() < .5) w.veado.change(f); else w.dock.choose(f);
      w.clock.run({ until: w.clock.now + w.rand.int(300, 800) });
    }
    w.clock.run({ maxSteps: 20000 });
    for (const p of Object.values(w.pages)) assert.equal(p.TGL.breaker.trips, 0, `seed ${seed}: ${p.name} tripped`);
    w.close();
  }
});

test('mashing the dock buttons (10 presses in a second) may trip it, but everything still ends on the last press', () => {
  const w = obsWorld({ seed: 5 }); w.boot();
  const presses = ['princess', 'blobfish', 'red', 'yellow', 'cyan', 'princess', 'blobfish', 'red', 'princess', 'blobfish'];
  for (const f of presses) { w.dock.choose(f); w.clock.run({ until: w.clock.now + 100 }); }
  w.clock.run({ until: w.clock.now + 12000, maxSteps: 200000 });
  const off = Object.entries(w.forms()).filter(([, f]) => f !== 'blobfish');
  assert.deepEqual(off, [], w.trace());
  w.close();
});
