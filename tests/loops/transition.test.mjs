// The transition overlay's timing (transition.js player), on a virtual clock: it covers around the cut, restarts
// without uncovering, clears early when OBS says it's done, and can never leave the screen covered.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { Clock, read } from '../helpers/sim.mjs';

const ctx = vm.createContext({ Math, document: {} }); ctx.window = ctx;
vm.runInContext(read('public/obs/shared/transition.js'), ctx, { filename: 'transition.js' });
const X = ctx.TGLTransition;

// a player on a virtual clock; frames every 16 ms (or never, to act as a page OBS isn't drawing)
function rig({ frames = true } = {}) {
  const clock = new Clock(), drawn = [];
  let cleared = 0;
  const p = X.player({
    now: () => clock.now, frame: (fn) => { if (frames) clock.at(16, fn); }, later: (fn, ms) => clock.at(ms, fn), cancel: (id) => clock.cancel(id),
    draw: (anim, prog) => drawn.push([clock.now, anim, prog]), clear: () => { cleared++; },
  });
  return { clock, p, drawn, get cleared() { return cleared; } };
}

test('pick: the Stinger\'s name says which animation (anything else draws nothing)', () => {
  assert.equal(X.pick('Trongates · Derez'), 'derez');
  assert.equal(X.pick('derez grid'), 'derez');
  assert.equal(X.pick('Trongates · Shutters'), 'shutters');
  assert.equal(X.pick('Logo shutter'), 'shutters');
  for (const n of ['Fade', 'Cut', 'Stinger', '', undefined]) assert.equal(X.pick(n), null, String(n));
});

test('one transition: drawn for 1.2 s, fully covering around the cut, then cleared and stopped', () => {
  const r = rig();
  r.p.start('derez');
  const res = r.clock.run({ maxSteps: 1000 });
  assert.ok(res.drained, 'nothing left running afterwards');
  assert.equal(r.cleared, 1);
  assert.equal(r.p.playing, null);
  const at = (ms) => r.drawn.find(([t]) => t >= ms)[2];
  assert.ok(at(600) > X.COVER[0] && at(600) < X.COVER[1], 'the cut (600 ms) is inside the full cover');
  assert.ok(r.drawn.at(-1)[0] <= X.MS);
});

test('a new switch mid-transition carries on covered: no uncovering, one more full cover, then clear', () => {
  const r = rig();
  r.p.start('derez'); r.clock.run({ until: 550 });            // covered
  r.p.start('shutters');
  const after = [];
  r.clock.run({ maxSteps: 2000 });
  for (const [t, anim, prog] of r.drawn) if (t > 550) after.push([anim, prog]);
  assert.equal(after[0][0], 'shutters');
  assert.ok(after[0][1] >= X.COVER[0] - .02, `restarted at ${after[0][1].toFixed(2)}: still covered`);
  assert.equal(r.p.playing, null); assert.equal(r.cleared, 1);
});

test('OBS says the transition ended early: whatever cover is left starts clearing at once', () => {
  const r = rig();
  r.p.start('shutters'); r.clock.run({ until: 500 });
  r.p.end();
  r.clock.run({ until: 520 });
  assert.ok(r.drawn.at(-1)[2] >= X.COVER[1], 'jumped to clearing');
  r.clock.run({ maxSteps: 1000 });
  assert.equal(r.p.playing, null);
});

test('never stuck covered: with no frames at all (OBS not drawing the page), the safety timer clears it', () => {
  const r = rig({ frames: false });
  r.p.start('derez');
  r.clock.run({ until: 5000 });
  assert.equal(r.p.playing, null); assert.equal(r.cleared, 1);
});

test('a storm of switches (every 100 ms for 5 s) settles and clears, with nothing left running', () => {
  const r = rig();
  for (let t = 0; t < 5000; t += 100) { r.clock.run({ until: t }); r.p.start(t % 200 ? 'derez' : 'shutters'); }
  const res = r.clock.run({ maxSteps: 5000 });
  assert.ok(res.drained); assert.equal(r.p.playing, null);
});
