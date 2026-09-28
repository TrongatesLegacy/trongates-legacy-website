// Chatagram's rules (public/chatagram/game.js), with the real word lists, a hand-driven clock and seeded randomness.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, rng } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams, JSON }); ctx.window = ctx;
for (const f of ['public/widgets/lib/settings.js', 'public/chatagram/words.js', 'public/chatagram/settings.js', 'public/chatagram/game.js']) vm.runInContext(read(f), ctx);
const C = ctx.Chatagram, Wd = C.words, S = ctx.Widgets.settings;
const dict = Wd.parseWords(read('public/chatagram/words/words.txt'));
const seeds = Wd.parseSeeds(read('public/chatagram/words/seeds.txt'));
const plain = (o) => JSON.parse(JSON.stringify(o));

/** a game on a hand-driven clock: t.at, t.advance(ms) (ticks whatever falls due on the way), events */
function setup(over = {}, seed = 1) {
  const cfg = { ...S.defaults(C.settings.SCHEMA), ...over };
  const t = { at: 1_000_000, events: [], awards: [] };
  const g = C.game(cfg, { dict, seeds, now: () => t.at, random: rng(seed), emit: (e) => t.events.push(e), award: (m, pts, words) => t.awards.push([m.name, pts, words]) });
  t.g = g; t.cfg = cfg;
  t.advance = (ms) => { const end = t.at + ms; for (let n = 0; n < 10000; n++) { const w = g.nextWake(); if (w > end) break; t.at = Math.max(t.at, w); g.tick(); } t.at = end; };
  t.say = (text, who = {}) => g.handle({ platform: 'twitch', user: 'pixelpanda', name: 'PixelPanda', text, mod: false, owner: false, ...who });
  t.round = () => g.state.round;
  t.words = () => t.round().answers.map((a) => a.word);
  t.of = (type) => t.events.filter((e) => e.type === type);
  return t;
}
const NACHO = { platform: 'kick', user: 'neonnacho', name: 'NeonNacho' };
const MOD = { platform: 'kick', user: 'gridrunner', name: 'GridRunner', mod: true };
const OWNER = { platform: 'twitch', user: 'captainquack', name: 'CaptainQuack', owner: true, mod: true };

test('booting starts level 1 with a real puzzle: every board word fits the seed, the goal is 65%', () => {
  const t = setup(); t.g.boot();
  const s = t.g.state, r = t.round();
  assert.equal(s.phase, 'playing'); assert.equal(s.level, 1);
  assert.equal(r.seed.length, 6);
  assert.ok(seeds.normal[6].includes(r.seed));
  const all = [...Wd.solve(r.seed, dict, { tier: 35, minLen: 3 }).board];
  assert.deepEqual([...r.valid], all, 'every real word is accepted');
  assert.ok(t.words().every((w) => all.includes(w)) && t.words().length === Math.min(12, all.length), 'the boxes are a pick of them');
  assert.equal(r.goal, Math.ceil(r.answers.length * 0.65));
  assert.equal(r.endsAt - r.startedAt, 90000);
  assert.equal(r.letters.map((l) => l.ch).sort().join(''), r.seed.split('').sort().join(''));
});

test('with "keep playing" off it waits for the start command; only mods and the owner can start', () => {
  const t = setup({ restart: 0, next: 0 }); t.g.boot();
  assert.equal(t.g.state.phase, 'idle');
  assert.equal(t.say('!cg start').kind, 'denied');
  assert.equal(t.g.state.phase, 'idle');
  assert.equal(t.say('!cg start', MOD).done, true);
  assert.equal(t.g.state.phase, 'playing');
});

test('guessing: a board word scores (2 per letter - 4) for the finder, then counts as taken', () => {
  const t = setup(); t.g.boot();
  const w = t.words().find((x) => x.length === 4);
  const r = t.say(w.toUpperCase() + '!');
  assert.equal(r.kind, 'found'); assert.equal(r.pts, 4); assert.equal(r.by.name, 'PixelPanda');
  assert.equal(r.tiles.length, 4); assert.equal(r.tiles.map((i) => t.round().letters[i].ch).join(''), w, 'the tiles that spell it');
  assert.equal(t.say(w, NACHO).kind, 'dup');
  assert.equal(t.g.top()[0].score, 4);
  assert.equal(t.say('zzzq').kind, 'wrong');
  assert.equal(t.say('two words').kind, 'ignored');
  assert.equal(t.say('hi').kind, 'ignored', 'too short to be a guess');
  assert.equal(C.game.points('cat'), 2); assert.equal(C.game.points('manic'), 6);
});

test('the longest word gets a bonus (unless switched off)', () => {
  const on = setup(); on.g.boot();
  assert.equal(on.say(on.round().seed).pts, on.round().seed.length * 2 - 4 + 5);
  const off = setup({ longbonus: false }); off.g.boot();
  assert.equal(off.say(off.round().seed).pts, off.round().seed.length * 2 - 4);
});

test('bonus words: real but rarer words score 1 and never take a slot; off, they are just wrong', () => {
  const t = setup(); t.g.boot();
  const b = t.round().bonus.find((w) => w.length >= 3);
  assert.ok(b, 'the puzzle has a bonus word');
  assert.equal(t.say(b).kind, 'bonus');
  assert.equal(t.say(b, NACHO).kind, 'dup');
  assert.ok(!t.words().includes(b));
  const off = setup({ bonus: false }); off.g.boot();
  assert.equal(off.say(off.round().bonus[0]).kind, 'wrong');
});

test('finding every word ends the round at once: cleared, three stars', () => {
  const t = setup(); t.g.boot();
  for (const w of t.words()) t.say(w);
  const s = t.g.state;
  assert.equal(s.phase, 'cleared');
  assert.equal(s.result.stars, 3); assert.equal(s.result.found, s.result.total);
  assert.equal(t.of('end').length, 1);
});

test('time up below the goal: game over, then a new game after the restart delay', () => {
  const t = setup(); t.g.boot();
  t.say(t.words()[0]);
  t.advance(90000);
  const s = t.g.state;
  assert.equal(s.phase, 'over'); assert.equal(s.result.cleared, false); assert.equal(s.result.stars, 0);
  assert.ok(s.gameResult.mvps[0].name === 'PixelPanda' && s.gameResult.away.length > 0);
  t.advance(14000); assert.equal(t.g.state.phase, 'over');
  t.advance(1000); assert.equal(t.g.state.phase, 'playing'); assert.equal(t.g.state.level, 1); assert.equal(t.g.state.gameId, 2);
});

test('goal reached by time up: cleared, next level after 10 s, and levels lengthen the seed', () => {
  const t = setup(); t.g.boot();
  for (const w of t.words().slice(0, t.round().goal)) t.say(w);
  t.advance(90000);
  assert.equal(t.g.state.phase, 'cleared');
  assert.ok(t.g.state.result.stars >= 1);
  t.advance(10000);
  assert.equal(t.g.state.level, 2); assert.equal(t.round().seed.length, 6);
  for (const w of t.words()) t.say(w);
  t.advance(10000);
  assert.equal(t.g.state.level, 3); assert.equal(t.round().seed.length, 7);
});

test('with the next level set to wait, !cg next moves on (mods only)', () => {
  const t = setup({ next: 0 }); t.g.boot();
  for (const w of t.words()) t.say(w);
  t.advance(600000);
  assert.equal(t.g.state.phase, 'cleared', 'still waiting');
  assert.equal(t.say('!cg next').kind, 'denied');
  assert.ok(t.say('!cg next', MOD).done);
  assert.equal(t.g.state.level, 2);
});

test('shortest word 4: no 3-letter slots; 3-letter words are bonus words', () => {
  const t = setup({ minlen: 4 }); t.g.boot();
  assert.ok(t.words().every((w) => w.length >= 4));
  const three = Wd.solve(t.round().seed, dict, { tier: 35, minLen: 3 }).board.find((w) => w.length === 3);
  assert.equal(t.say(three).kind, 'bonus');
});

test('padlocks: a finder waits for the next padlock; others are unaffected; after the last one it is locked till the end', () => {
  const t = setup({ locks: 3 }); t.g.boot();
  const r = t.round(), ws = t.words();
  assert.deepEqual([...r.locks].map((x) => x - r.startedAt), [22500, 45000, 67500]);
  assert.equal(t.say(ws[0]).kind, 'found');
  assert.equal(t.say(ws[1]).kind, 'locked');
  assert.ok(!r.answers[1].by, 'the word stays open for others');
  assert.equal(t.say(ws[1], NACHO).kind, 'found');
  t.advance(22500);
  assert.equal(t.of('unlock').length, 1);
  assert.equal(t.say(ws[2]).kind, 'found', 'free again after the padlock');
  t.advance(50000);
  assert.equal(t.say(ws[3]).kind, 'found');
  assert.equal(t.say(ws[4]).kind, 'locked', 'found after the last padlock: locked for the rest of the round');
  // it survives a save and restore (no Infinity in the snapshot)
  const g2 = setup({ locks: 3 }); g2.at = t.at; g2.g.boot(plain(t.g.snapshot()));
  assert.equal(g2.say(ws[4]).kind, 'locked');
});

test('padlocks off (the default): nobody is ever locked', () => {
  const t = setup(); t.g.boot();
  const ws = t.words();
  assert.deepEqual([...t.round().locks], []);
  for (const w of ws.slice(0, 4)) assert.equal(t.say(w).kind, 'found');
});

test('tricky letters from level 3: a fake letter and a hidden one; the hidden one shows at half time, the fake one drops out', () => {
  const t = setup({ tricky: 1 }); t.g.boot();
  const r = t.round();
  assert.equal(r.letters.length, r.seed.length + 1);
  const fake = r.letters.find((l) => l.fake);
  assert.ok(fake && !r.seed.includes(fake.ch), 'the fake letter is not in the word');
  assert.ok(r.hidden >= 0 && !r.revealed);
  t.advance(45000);
  assert.equal(t.of('reveal').length, 1); assert.ok(t.round().revealed);
  for (const w of t.words().slice(0, Math.ceil(r.goal / 2))) t.say(w);
  assert.equal(t.of('fakegone').length, 1);
  assert.equal(t.round().letters.length, r.seed.length);
  const plainT = setup(); plainT.g.boot();
  assert.equal(plainT.round().letters.length, plainT.round().seed.length, 'level 1 of the default: no tricks');
});

test('the letters shuffle every 10 s whatever chat does (a setting; 0 = never)', () => {
  const t = setup(); t.g.boot();
  const first = t.round().letters.map((l) => l.ch).join('');
  t.advance(10000);
  const sh = t.of('shuffle');
  assert.equal(sh.length, 1); assert.equal(sh[0].from, first);
  assert.notEqual(t.round().letters.map((l) => l.ch).join(''), first);
  t.advance(30000); assert.equal(t.of('shuffle').length, 4);
  const never = setup({ shuffle: 0 }); never.g.boot(); never.advance(60000);
  assert.equal(never.of('shuffle').length, 0);
});

test('commands: renamed, several names, any capitals; who can use them', () => {
  const t = setup({ restart: 0, cstart: ['!cg start', '!newgame'], perm: 'me' }); t.g.boot();
  assert.equal(t.say('!start', OWNER).kind, 'ignored', 'the old name is just chat now');
  assert.equal(t.say('!CG  Start', MOD).kind, 'denied', 'perm=me: mods cannot');
  assert.ok(t.say('!cg start', OWNER).done);
  assert.equal(t.g.commandName('start'), '!cg start');
  const all = setup({ restart: 0, perm: 'all' }); all.g.boot();
  assert.ok(all.say('!cg start').done, 'perm=all: anyone');
});

test('ignored users (bots) and blocked words do nothing', () => {
  const t = setup({ ignore: ['botrix'], block: [] }); t.g.boot();
  const w = t.words()[0];
  assert.equal(t.say(w, { user: 'botrix', name: 'Botrix' }).kind, 'ignored');
  const seed = t.round().seed;
  const b = setup({ block: [w] }, 1); b.g.boot();
  if (b.round().seed === seed) { assert.ok(!b.words().includes(w)); assert.equal(b.say(w).kind, 'wrong'); }
});

test('!cg skip swaps the puzzle at the same level; !cg reset restarts the game (the leaderboards live in scores.js)', () => {
  const t = setup(); t.g.boot();
  t.say(t.words()[0]);
  const seed = t.round().seed;
  assert.ok(t.say('!cg skip', MOD).done);
  assert.notEqual(t.round().seed, seed); assert.equal(t.g.state.level, 1);
  assert.ok(t.say('!cg reset', OWNER).done);
  assert.equal(t.g.top().length, 0);
  assert.equal(t.g.state.phase, 'playing');
});

test('a saved game resumes mid-round after a refresh; an old save starts over but keeps the all-time scores', () => {
  const t = setup(); t.g.boot();
  const w = t.words()[0]; t.say(w);
  t.advance(20000);
  const snap = plain(t.g.snapshot());
  const again = setup(); again.at = t.at + 3000; again.g.boot(snap);
  assert.equal(again.round().seed, t.round().seed);
  assert.equal(again.say(w, NACHO).kind, 'dup');
  // a round that ran out while OBS was closed ends when it resumes
  const late = setup(); late.at = t.at + 80000; late.g.boot(plain(snap)); late.g.tick();
  assert.equal(late.g.state.phase, 'over');
  // over 10 minutes: a fresh game (the leaderboards are kept apart, in scores.js)
  for (const x of t.words()) t.say(x);
  const done = plain(t.g.snapshot());
  const old = setup(); old.at = t.at + 11 * 60000; old.g.boot(done);
  assert.equal(old.g.state.gameId, 1); assert.equal(old.g.state.level, 1);
});

test('summary highlights: fastest find, longest streak and a last-second save', () => {
  const t = setup(); t.g.boot();
  const ws = t.words();
  t.advance(2000); t.say(ws[0]);
  t.advance(1000); t.say(ws[1]); t.say(ws[2]);
  t.say(ws[3], NACHO);
  t.advance(85000); t.say(ws[4], NACHO);
  t.advance(5000);
  const h = t.g.state.result.highlights;
  assert.equal(h.fastest.name, 'PixelPanda'); assert.equal(h.fastest.secs, 2);
  assert.deepEqual(plain(h.streak), { name: 'PixelPanda', n: 3 });
  assert.equal(h.save.name, 'NeonNacho'); assert.equal(h.save.word, ws[4]);
  assert.deepEqual(plain(t.g.state.result.split), { twitch: 3, kick: 2 });
});

test('the same seed never comes up twice in a row across many rounds', () => {
  const t = setup(); t.g.boot();
  const seen = [];
  for (let i = 0; i < 40; i++) { seen.push(t.round().seed); t.say('!cg skip', MOD); }
  assert.equal(new Set(seen).size, seen.length);
});

test('the board shows 12 boxes at level 1, 3 more a level up to the setting; boxes are per length, the longest word always shown', () => {
  let t, all;
  for (let seed = 1; seed < 200; seed++) {
    t = setup({}, seed); t.g.boot();
    all = t.round().valid;
    if (all.length > 20) break;
  }
  const r = t.round();
  assert.ok(all.length > 20, 'found a big puzzle');
  assert.equal(r.answers.length, 12);
  assert.ok(r.answers.some((a) => a.word === r.seed));
  for (const len of new Set(all.map((w) => w.length))) assert.ok(r.answers.some((a) => a.word.length === len), `a ${len}-letter box`);
  assert.equal(r.goal, Math.ceil(12 * 0.65));
  for (const [level, want] of [[2, 15], [5, 24], [9, 36], [12, 40], [20, 40]]) {
    const g = setup({}, 3); g.g.boot(); g.g.state.level = level; g.say('!cg skip', MOD);
    assert.ok(g.round().answers.length <= want, `level ${level}: ${g.round().answers.length} boxes`);
    if (g.round().valid.length >= want) assert.equal(g.round().answers.length, want, `level ${level}`);
  }
});

test('any real word fills the next open box of its length; when that length is full, more of it don\'t count', () => {
  let t;
  for (let seed = 1; seed < 400; seed++) {
    t = setup({}, seed); t.g.boot();
    const r = t.round(), three = r.valid.filter((w) => w.length === 3);
    if (three.length > r.answers.filter((a) => a.word.length === 3).length + 1) break;
  }
  const r = t.round(), boxes = r.answers.filter((a) => a.word.length === 3).length;
  const offBoard = r.valid.filter((w) => w.length === 3 && !r.answers.some((a) => a.word === w));
  assert.ok(offBoard.length >= 2, 'a puzzle with 3-letter words not on the board');
  const res = t.say(offBoard[0]);
  assert.equal(res.kind, 'found', 'a real word not shown still fills a box');
  assert.ok(r.answers.some((a) => a.word === offBoard[0] && a.by));
  // fill the rest of the 3-letter boxes, then one more 3-letter word is refused
  const rest = r.valid.filter((w) => w.length === 3 && w !== offBoard[0]);
  let filled = 1;
  for (const w of rest) { if (filled >= boxes) break; if (t.say(w, NACHO).kind === 'found') filled++; }
  assert.equal(r.answers.filter((a) => a.word.length === 3 && a.by).length, boxes);
  const spare = r.valid.find((w) => w.length === 3 && !r.answers.some((a) => a.word === w));
  if (spare) assert.equal(t.say(spare).kind, 'full');
  assert.equal(r.answers.length, 12, 'no boxes added');
});

test('a caller can choose the first puzzle (the site\'s still pictures use hand-checked words)', () => {
  const cfg = { ...S.defaults(C.settings.SCHEMA) };
  const g = C.game(cfg, { dict, seeds, now: () => 1e6, random: rng(1), firstSeed: 'garden' }); g.boot();
  assert.equal(g.state.round.seed, 'garden');
  g.handle({ platform: 'twitch', user: 'o', name: 'O', owner: true, mod: true, text: '!cg skip' });
  assert.notEqual(g.state.round.seed, 'garden', 'only the first puzzle');
  for (const [d, w] of [['easy', 'heart'], ['normal', 'garden'], ['hard', 'clovers']]) {
    const len = Wd.seedLength(d, 1);
    assert.ok(seeds[d][len].includes(w), `${w} is a ${d} seed, so the pictures really use it`);
  }
});

test('every point scored goes to the leaderboards as it happens (board words and bonus words); none on !cg reset', () => {
  const t = setup(); t.g.boot();
  const w = t.words().find((x) => x.length === 4);
  t.say(w);
  const b = t.round().bonus.find((x) => x.length >= 3); t.say(b, NACHO);
  assert.deepEqual(plain(t.awards), [['PixelPanda', 4, 1], ['NeonNacho', 1, 0]]);
  t.say('!cg reset', OWNER);
  assert.equal(t.awards.length, 2);
});

test('the leaderboard command: !cg top or just !cg, following "who can use commands"', () => {
  const t = setup(); t.g.boot();
  assert.equal(t.say('!cg top').kind, 'denied', 'perm=mods (the default): a viewer can\'t');
  assert.ok(t.say('!cg', MOD).done);
  assert.ok(t.say('!CG TOP', OWNER).done);
  assert.deepEqual(t.of('leaderboard').map((e) => [e.by, e.text]), [['GridRunner', '!cg'], ['CaptainQuack', '!cg top']]);
  const off = setup({ lb: false }); off.g.boot();
  assert.equal(off.say('!cg top', OWNER).kind, 'ignored', 'switched off: just chat');
  const me = setup({ perm: 'me' }); me.g.boot();
  assert.equal(me.say('!cg top', MOD).kind, 'denied');
});

test('with everyone allowed, viewers share a 60-second cooldown; mods and the owner never wait', () => {
  const t = setup({ perm: 'all' }); t.g.boot();
  assert.ok(t.say('!cg top').done);
  assert.equal(t.say('!cg top', NACHO).done, false, 'within the minute: ignored');
  assert.ok(t.say('!cg top', MOD).done, 'mods skip it');
  assert.ok(t.say('!cg', OWNER).done);
  t.advance(59000); assert.equal(t.say('!cg top', NACHO).done, false);
  t.advance(1000); assert.ok(t.say('!cg top', NACHO).done);
  assert.equal(t.of('leaderboard').length, 4);
  // it survives a refresh (saved with the game)
  const again = setup({ perm: 'all' }); again.at = t.at + 1000; again.g.boot(plain(t.g.snapshot()));
  assert.equal(again.say('!cg top').done, false);
});

test('!cg clearscores is the broadcaster\'s only, whatever "who can use commands" says', () => {
  const t = setup({ perm: 'all' }); t.g.boot();
  assert.equal(t.say('!cg clearscores').kind, 'denied');
  assert.equal(t.say('!cg clearscores', MOD).kind, 'denied');
  assert.ok(t.say('!cg clearscores', OWNER).done);
  assert.equal(t.of('clearscores').length, 1);
});

test('the new defaults all start !cg; the old words are just chat now', () => {
  const t = setup({ restart: 0 }); t.g.boot();
  for (const old of ['!start', '!next', '!skip', '!reset']) assert.equal(t.say(old, OWNER).kind, 'ignored', old);
  assert.ok(t.say('!cg start', OWNER).done);
  assert.deepEqual(['start', 'next', 'skip', 'reset', 'top', 'clear'].map((c) => t.g.commandName(c)), ['!cg start', '!cg next', '!cg skip', '!cg reset', '!cg top', '!cg clearscores']);
});

test('holding stops every timer and they carry on from where they stopped: the round, padlocks, reveal, shuffles', () => {
  const t = setup({ locks: 3, tricky: 1 }); t.g.boot();
  const r = t.round(), before = { ends: r.endsAt, locks: [...r.locks], shuffle: r.nextShuffle };
  t.advance(5000);
  assert.ok(t.g.hold(true)); assert.equal(t.g.hold(true), false, 'already held');
  const clock = t.g.clock();
  t.advance(8000);
  assert.equal(t.g.clock(), clock, 'the game\'s time stands still');
  assert.equal(t.g.nextWake(), Infinity);
  assert.equal(t.of('shuffle').length, 0, 'no shuffle while held');
  assert.ok(t.g.hold(false));
  assert.equal(r.endsAt - before.ends, 8000);
  assert.deepEqual([...r.locks].map((x, i) => x - before.locks[i]), [8000, 8000, 8000]);
  assert.equal(r.nextShuffle - before.shuffle, 8000);
  t.advance(4999); assert.equal(t.of('shuffle').length, 0);
  t.advance(1); assert.equal(t.of('shuffle').length, 1, 'the shuffle comes 10 s of play after the start');
  t.advance(r.endsAt - t.at - 1); assert.equal(t.g.state.phase, 'playing');
  t.advance(1); assert.notEqual(t.g.state.phase, 'playing', 'the round lasted its 90 s of play');
});

test('guesses still count while held, as if made the moment it began ("fastest find" stays true)', () => {
  const t = setup(); t.g.boot();
  t.advance(3000); t.g.hold(true); t.advance(6000);
  const w = t.words()[0];
  assert.equal(t.say(w).kind, 'found');
  t.g.hold(false);
  const a = t.round().answers.find((x) => x.word === w);
  assert.equal(a.at - t.round().startedAt, 3000);
  for (const x of t.words()) t.say(x);
  assert.equal(t.g.state.result.highlights.fastest.secs, 3);
});

test('holding on a card pauses the countdown to the next level', () => {
  const t = setup(); t.g.boot();
  for (const w of t.words()) t.say(w);
  assert.equal(t.g.state.phase, 'cleared');
  const next = t.g.state.nextAt;
  t.advance(4000); t.g.hold(true); t.advance(8000); t.g.hold(false);
  assert.equal(t.g.state.nextAt, next + 8000);
  t.advance(5999); assert.equal(t.g.state.phase, 'cleared');
  t.advance(1); assert.equal(t.g.state.phase, 'playing');
});

test('a refresh while held carries on (giving back at most 12 s), never stuck', () => {
  const t = setup(); t.g.boot();
  t.advance(10000); t.g.hold(true);
  const snap = plain(t.g.snapshot()), ends = t.round().endsAt;
  const again = setup(); again.at = t.at + 60000; again.g.boot(snap);
  assert.equal(again.g.held, false);
  assert.equal(again.round().endsAt - ends, 12000);
  assert.notEqual(again.g.nextWake(), Infinity);
});
