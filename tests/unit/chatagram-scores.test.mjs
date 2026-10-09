// Chatagram's leaderboards (public/widgets/lib/scores.js, shared with Chaplinko) on a hand-driven clock: This stream follows the stream Twitch or
// Kick says is on (a crash or a dropped stream carries on, a new stream starts again), All time is always recorded, and
// saves from before the leaderboards (tests/fixtures/chatagram-save-v1.json, written by the game as it was) still load,
// in both directions.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, readAt, rng } from '../helpers/sim.mjs';

const MIN = 60000, HOUR = 60 * MIN;
const ctx = vm.createContext({ URLSearchParams, JSON }); ctx.window = ctx;
for (const f of ['public/widgets/lib/settings.js', 'public/chatagram/words.js', 'public/chatagram/settings.js', 'public/chatagram/game.js', 'public/widgets/lib/scores.js']) vm.runInContext(read(f), ctx);
const C = ctx.Chatagram, S = ctx.Widgets.settings;
const plain = (o) => JSON.parse(JSON.stringify(o));
const FIXTURE = JSON.parse(read('tests/fixtures/chatagram-save-v1.json'));

function setup(saved, gameAllTime) {
  const t = { at: 1_790_000_000_000 };
  t.sc = ctx.Widgets.scores(saved, { now: () => t.at, gameAllTime });
  t.live = (id, started = t.at, platform = 'twitch') => t.sc.checked({ state: 'live', platform, id, started });
  t.offline = () => t.sc.checked({ state: 'offline' });
  t.unknown = () => t.sc.checked({ state: 'unknown' });
  t.score = (name, pts = 4, words = 1, platform = 'twitch') => t.sc.award({ platform, user: name.toLowerCase(), name }, pts, words);
  t.stream = () => plain(t.sc.view().list).map((p) => `${p.name} ${p.score}`);
  t.all = () => plain(t.sc.allTimeTop()).map((p) => `${p.name} ${p.score}`);
  return t;
}

test('points count for All time at once, and for This stream once the stream is confirmed', () => {
  const t = setup();
  t.live('s1');
  t.score('PixelPanda', 6); t.score('NeonNacho', 4, 1, 'kick'); t.score('PixelPanda', 2);
  assert.deepEqual(t.all(), ['PixelPanda 8', 'NeonNacho 4']);
  assert.equal(t.sc.view().kind, 'stream');
  assert.deepEqual(t.stream(), ['PixelPanda 8', 'NeonNacho 4'], 'shown with the stream they must belong to');
  t.at += 5 * MIN; t.live('s1');
  assert.deepEqual(t.stream(), ['PixelPanda 8', 'NeonNacho 4'], 'placed, not counted twice');
  assert.equal(plain(t.sc.record.log).length, 0);
});

test('a new stream id starts This stream again; All time keeps going', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10);
  t.at += 3 * HOUR; t.offline();
  t.at += 20 * HOUR;
  assert.equal(t.live('s2', t.at - MIN), true, 'restarted');
  t.score('NeonNacho', 4);
  assert.deepEqual(t.stream(), ['NeonNacho 4']);
  assert.deepEqual(t.all(), ['PixelPanda 10', 'NeonNacho 4']);
});

test('a crash with OBS closed, back 2 minutes later on a new stream id: the same stream', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10);
  t.at += 7 * MIN;                                   // OBS dies here (the last check saw it live 7 minutes ago)
  t.at += 2 * MIN;
  assert.equal(t.live('s2', t.at - 30000), false, 'carried on');
  t.score('NeonNacho', 4);
  assert.deepEqual(t.stream(), ['PixelPanda 10', 'NeonNacho 4']);
});

test('the stream drops but OBS stays open, back 5 minutes later: the same stream; a 45-minute outage: a new one', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10);
  t.at += 10 * MIN; t.live('s1');                    // the 10-minute check
  t.at += 9 * MIN;                                   // drops just before the next check…
  t.at += 5 * MIN;                                   // …back 5 minutes later; the next check finds the new id
  assert.equal(t.live('s2', t.at - MIN), false);
  assert.deepEqual(t.stream(), ['PixelPanda 10']);
  // a long outage: last seen live at L, the new stream starts 45 minutes later
  const L = t.at; t.at += 50 * MIN;
  assert.equal(t.live('s3', L + 45 * MIN), true);
  assert.deepEqual(t.stream(), []);
});

test('the crash rule allows a full check interval of lag: last seen live 10 minutes before the drop, back after 25', () => {
  const t = setup();
  t.live('s1');
  t.at += 35 * MIN;
  assert.equal(t.live('s2', t.at - MIN), false, 'within 40 minutes of last being seen live');
});

test('a proper end, live again 20 minutes later: one stream (same viewers)', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10);
  t.at += 5 * MIN; t.offline();
  t.at += 20 * MIN;
  assert.equal(t.live('s2', t.at), false);
  assert.deepEqual(t.stream(), ['PixelPanda 10']);
});

test('points scored before a new stream is noticed move into it by their time; earlier ones don\'t', () => {
  const t = setup();
  t.live('s1'); t.at += HOUR; t.offline();
  t.at += 10 * HOUR;
  t.score('PracticeBot', 50);                        // offline practice
  t.at += 10 * MIN; const started = t.at;            // goes live here; no check yet
  t.at += 2 * MIN; t.score('PixelPanda', 6);
  t.at += MIN; t.live('s2', started);
  assert.deepEqual(t.stream(), ['PixelPanda 6']);
  assert.deepEqual(t.all(), ['PracticeBot 50', 'PixelPanda 6'], 'All time has both');
});

test('confirmed offline: the last stream\'s final scores, with its last minutes; later points are All time only', () => {
  const t = setup();
  const started = t.at; t.live('s1', started); t.score('PixelPanda', 10);
  t.at += 10 * MIN; t.live('s1');
  t.at += 4 * MIN; t.score('NeonNacho', 6);          // the stream's last minutes (it ends between checks)
  t.at += 30 * MIN; t.score('AfterBot', 99);         // well after it ended
  t.at += MIN; t.offline();
  const v = plain(t.sc.view());
  assert.equal(v.kind, 'last'); assert.equal(v.started, started);
  assert.deepEqual(v.list.map((p) => p.name), ['PixelPanda', 'NeonNacho']);
  assert.equal(t.all()[0], 'AfterBot 99');
  // offline before any stream was ever seen: an empty Last stream
  const n = setup(); n.offline();
  assert.deepEqual(plain(n.sc.view()), { kind: 'last', started: 0, list: [] });
});

test('no answer never resets or places anything; it shows as "game" (the overlay shows this game instead)', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10);
  t.at += 20 * MIN; t.unknown();
  assert.equal(t.sc.view().kind, 'game');
  assert.equal(t.sc.fresh(), false);
  t.score('NeonNacho', 4);
  t.at += MIN; t.live('s1');
  assert.deepEqual(t.stream(), ['PixelPanda 10', 'NeonNacho 4'], 'kept until an answer said where they belong');
  assert.equal(setup().sc.view().kind, 'game', 'never asked: game');
});

test('a live answer is fresh for 2 minutes', () => {
  const t = setup();
  t.live('s1'); assert.equal(t.sc.fresh(), true);
  t.at += 119000; assert.equal(t.sc.fresh(), true);
  t.at += 2000; assert.equal(t.sc.fresh(), false);
  t.offline(); assert.equal(t.sc.fresh(), false, 'offline is never "fresh live"');
});

test('multistream: a Kick stream id beside the Twitch one is the same stream; the platform that answered is asked first next time', () => {
  const t = setup();
  t.live('tw1', t.at, 'twitch'); t.score('PixelPanda', 10);
  assert.equal(t.sc.record.primary, 'twitch');
  t.at += 10 * MIN;
  assert.equal(t.live('k1', t.at - 10 * MIN, 'kick'), false);
  assert.equal(t.sc.record.primary, 'kick');
  assert.deepEqual(plain(t.sc.record.stream.ids), { twitch: 'tw1', kick: 'k1' });
  assert.deepEqual(t.stream(), ['PixelPanda 10']);
});

test('clearing wipes both lists; the stream itself carries on', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10);
  t.sc.clear();
  assert.deepEqual(t.all(), []); assert.deepEqual(t.stream(), []);
  t.score('NeonNacho', 4);
  assert.deepEqual(t.stream(), ['NeonNacho 4']);
  assert.equal(t.live('s1'), false);
});

test('saved and loaded: everything comes back; a bad or partial record never breaks it; unknown fields are ignored', () => {
  const t = setup();
  t.live('s1'); t.score('PixelPanda', 10); t.at += MIN; t.score('NeonNacho', 4);
  const again = setup(plain(t.sc.record)); again.at = t.at;
  assert.deepEqual(again.stream(), ['PixelPanda 10', 'NeonNacho 4']);
  assert.deepEqual(again.all(), ['PixelPanda 10', 'NeonNacho 4']);
  for (const bad of [null, 'x', 7, [], { v: 1, allTime: 'no', stream: { started: 'x' }, log: 'no', status: 'maybe' }, { future: { field: 1 }, allTime: { 'twitch:a': { name: 'A', platform: 'twitch', score: 3, words: 1 } } }]) {
    const b = setup(bad);
    b.live('s1'); b.score('X', 2);
    assert.ok(Array.isArray(plain(b.sc.allTimeTop())));
  }
  assert.deepEqual(setup({ allTime: { 'twitch:a': { name: 'A', platform: 'twitch', score: 3, words: 1 } }, future: 1 }).all(), ['A 3']);
});

test('first run after the update: All time comes from the game\'s own save (a real one from before)', () => {
  const t = setup(null, FIXTURE.allTime);
  assert.deepEqual(t.all(), Object.values(FIXTURE.allTime).sort((a, b) => b.score - a.score || b.words - a.words).map((p) => `${p.name} ${p.score}`));
  assert.ok(t.all().length === 3);
  // once the leaderboards have their own record, the game's copy isn't read again
  const next = setup(plain(t.sc.record), { 'twitch:ghost': { name: 'Ghost', platform: 'twitch', score: 999, words: 1 } });
  assert.ok(!next.all().some((x) => x.startsWith('Ghost')));
});

// ---- the game's save, across versions ----------------------------------------------------------------------------------
const dict = C.words.parseWords(read('public/chatagram/words/words.txt'));
const seeds = C.words.parseSeeds(read('public/chatagram/words/seeds.txt'));

test('a save from before the leaderboards resumes mid-round in the new game, as it always did', () => {
  const at = FIXTURE.savedAt + 3000;
  const g = C.game(S.defaults(C.settings.SCHEMA), { dict, seeds, now: () => at, random: rng(1) });
  g.boot(plain(FIXTURE));
  assert.equal(g.state.phase, 'playing'); assert.equal(g.state.level, 2);
  assert.equal(g.state.round.seed, FIXTURE.round.seed);
  const taken = FIXTURE.round.answers.find((a) => a.by).word;
  assert.equal(g.handle({ platform: 'twitch', user: 'x', name: 'X', text: taken }).kind, 'dup');
  assert.equal(g.held, false);
});

test('an older overlay (a cached copy) still reads what the new one saves: the game resumes, All time is there', (t) => {
  // the old code comes from git history: a shallow clone (the daily feed update) doesn't have it, like the proof tests
  const oldSettings = readAt('6d8e97d', 'public/chatagram/settings.js'), oldGame = readAt('6d8e97d', 'public/chatagram/game.js');
  if (!oldSettings || !oldGame) return t.skip('git history not available');
  // the new overlay's save: the game's snapshot with All time written back in, plus the new fields
  let at = FIXTURE.savedAt + 3000;
  const g = C.game(S.defaults(C.settings.SCHEMA), { dict, seeds, now: () => at, random: rng(1) });
  g.boot(plain(FIXTURE));
  const sc = ctx.Widgets.scores(null, { now: () => at, gameAllTime: FIXTURE.allTime });
  g.handle({ platform: 'twitch', user: 'x', name: 'X', text: '!cg top', mod: true });
  at += 1000;
  g.state.allTime = sc.allTime;
  const saved = plain(g.snapshot());
  assert.ok('heldAt' in saved && 'lbAt' in saved);
  // …read by the game as it was before the leaderboards
  const old = vm.createContext({ URLSearchParams, JSON }); old.window = old;
  for (const f of ['public/widgets/lib/settings.js', 'public/chatagram/words.js']) vm.runInContext(read(f), old);
  vm.runInContext(oldSettings, old);
  vm.runInContext(oldGame, old);
  const O = old.Chatagram;
  const og = O.game(old.Widgets.settings.defaults(O.settings.SCHEMA), { dict: O.words.parseWords(read('public/chatagram/words/words.txt')), seeds: O.words.parseSeeds(read('public/chatagram/words/seeds.txt')), now: () => at + 2000, random: rng(1) });
  og.boot(saved);
  assert.equal(og.state.phase, 'playing'); assert.equal(og.state.round.seed, FIXTURE.round.seed);
  assert.deepEqual(plain(og.allTimeTop()).map((p) => p.name).sort(), Object.values(FIXTURE.allTime).map((p) => p.name).sort());
});
