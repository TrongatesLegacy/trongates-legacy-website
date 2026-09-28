// Chatagram left running for hours on the virtual clock, driven the way the overlay drives it (one timer, set for
// game.nextWake()), with a busy fake chat: it never spins, never stalls, and always moves on from a summary.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, rng, Clock } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams, JSON }); ctx.window = ctx;
for (const f of ['public/widgets/lib/settings.js', 'public/chatagram/words.js', 'public/chatagram/settings.js', 'public/chatagram/game.js']) vm.runInContext(read(f), ctx);
const C = ctx.Chatagram, S = ctx.Widgets.settings;
const dict = C.words.parseWords(read('public/chatagram/words/words.txt'));
const seeds = C.words.parseSeeds(read('public/chatagram/words/seeds.txt'));
const SEEDS = (process.env.TGL_SEEDS | 0) || 40;

function run(over, seed, hours) {
  const clock = new Clock(), rand = rng(seed), events = [];
  clock.now = 1_000_000;
  const g = C.game({ ...S.defaults(C.settings.SCHEMA), ...over }, { dict, seeds, now: () => clock.now, random: rand, emit: (e) => events.push(e.type) });
  let timer = null, wakes = 0;
  // the overlay's scheduler: one timer, for the next thing due
  const schedule = () => { if (timer) clock.cancel(timer); timer = null; const w = g.nextWake(); if (w !== Infinity) timer = clock.at(Math.max(0, w - clock.now), () => { timer = null; wakes++; g.tick(); schedule(); }, 'wake'); };
  g.boot(); schedule();
  // chat: every 0.5–4 s someone guesses (a real answer some of the time)
  const names = ['PixelPanda', 'NeonNacho', 'SleepyWaffle', 'GridRunner', 'CaptainQuack'];
  const chatter = () => {
    const s = g.state, n = rand.pick(names);
    const text = s.phase === 'playing' && rand() < 0.5 ? rand.pick(s.round.answers).word : rand.pick(['hello', 'lol', 'gg', 'zzzz', 'nice']);
    g.handle({ platform: rand() < 0.5 ? 'twitch' : 'kick', user: n.toLowerCase(), name: n, text, mod: false, owner: false });
    schedule();
    clock.at(rand.int(500, 4000), chatter, 'chat');
  };
  clock.at(1000, chatter, 'chat');
  const r = clock.run({ until: clock.now + hours * 3600000, maxSteps: 400000 });
  return { r, events, wakes, g, clock, schedule };
}

test('hours of play: no runaway, rounds keep coming, summaries always lead on', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { r, events, wakes, g } = run({}, seed, 1);
    assert.ok(!r.runaway, `seed ${seed}: runaway`);
    const rounds = events.filter((e) => e === 'round').length, ends = events.filter((e) => e === 'end').length;
    assert.ok(rounds >= 20, `seed ${seed}: only ${rounds} rounds in an hour`);
    assert.ok(Math.abs(rounds - ends) <= 1, `seed ${seed}: ${rounds} rounds, ${ends} ends`);
    // wakes per round: shuffles (9 in 90 s), the end, the summary's move on: bounded
    assert.ok(wakes / rounds < 16, `seed ${seed}: ${(wakes / rounds).toFixed(1)} wakes a round`);
    assert.ok(['playing', 'cleared', 'over'].includes(g.state.phase));
  }
});

test('with "keep playing" off, the game stops after game over and the clock runs dry', () => {
  const { clock, g, schedule } = run({ next: 5, restart: 0 }, 7, 0);
  assert.equal(g.state.phase, 'idle', 'waits for !start');
  // the owner starts it; no chat after that, so nobody finds anything and level 1 ends in game over
  clock.q = clock.q.filter((t) => t.label !== 'chat');
  g.handle({ platform: 'twitch', user: 'captainquack', name: 'CaptainQuack', text: '!start', mod: true, owner: true }); schedule();
  const r = clock.run({ until: clock.now + 3600000, maxSteps: 10000 });
  assert.ok(!r.runaway);
  assert.equal(g.state.phase, 'over');
  assert.equal(g.nextWake(), Infinity);
  assert.equal(clock.q.filter((t) => t.label === 'wake').length, 0, 'no timer left waiting');
});

test('padlocks and tricky letters from level 1: still no runaway', () => {
  for (let seed = 1; seed <= Math.ceil(SEEDS / 4); seed++) {
    const { r, events } = run({ locks: 4, tricky: 1, shuffle: 5 }, seed, 0.5);
    assert.ok(!r.runaway, `seed ${seed}`);
    assert.ok(events.includes('unlock') && events.includes('reveal'), `seed ${seed}: padlocks and reveals happened`);
  }
});
