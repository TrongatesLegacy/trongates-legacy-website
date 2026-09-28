// Chatagram's word lists (public/chatagram/words/, built by scripts/build-words.mjs) and the word logic that reads them
// (public/chatagram/words.js). The lists are committed output, so these check what actually ships.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from '../helpers/sim.mjs';

const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(read('public/chatagram/words.js'), ctx);
const Wd = ctx.Chatagram.words;
const dict = Wd.parseWords(read('public/chatagram/words/words.txt'));
const seeds = Wd.parseSeeds(read('public/chatagram/words/seeds.txt'));
const listFile = (f) => read('scripts/words/' + f).split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#') && /^[a-z]+$/.test(l));
const BLOCKED = new Set([...listFile('ldnoobw-en.txt'), ...listFile('blocklist.txt')]);
const isBlocked = (w) => BLOCKED.has(w) || ['s', 'es', 'd', 'ed', 'ing'].some((s) => w.endsWith(s) && BLOCKED.has(w.slice(0, -s.length)));

test('words.txt: plain lowercase words of 3–9 letters, each once, in known tiers', () => {
  assert.ok(dict.list.length > 15000, `only ${dict.list.length} words`);
  assert.equal(dict.tierOf.size, dict.list.length, 'a word is listed twice');
  for (const [w, t] of dict.list) {
    assert.match(w, /^[a-z]{3,9}$/, `bad word: ${w}`);
    assert.ok([35, 50, 60, 70, 71].includes(t), `${w} has tier ${t}`);
  }
});

test('no blocked word (LDNOOBW, our blocklist, or their plurals and verb forms) is in any list', () => {
  const bad = [...dict.list].map(([w]) => w).filter(isBlocked);
  assert.deepEqual(bad, []);
  for (const byLen of Object.values(seeds)) for (const ws of Object.values(byLen)) assert.deepEqual([...ws].filter(isBlocked), []);
  // spot checks: SCOWL's own offensive/vulgar tags did their part too
  for (const w of ['shit', 'fuck', 'cunt', 'bitch', 'asshole', 'penis', 'rape', 'nazi']) assert.ok(!dict.tierOf.has(w), w);
});

test('every difficulty and seed length has plenty of seeds, and each makes a good puzzle', () => {
  for (const [name, d] of Object.entries(Wd.DIFFICULTY)) {
    for (const len of new Set(d.lengths)) {
      const list = seeds[name][len];
      assert.ok(list && list.length >= 200, `${name} ${len}: ${list && list.length} seeds`);
      // check a spread of them (every one is checked when the list is built)
      for (let i = 0; i < list.length; i += Math.ceil(list.length / 40)) {
        const s = list[i];
        assert.equal(s.length, len, s);
        assert.ok(dict.tierOf.get(s) <= d.seedTier, `${s} is not well known enough for ${name}`);
        const { board } = Wd.solve(s, dict, { tier: d.tier, minLen: 3 });
        assert.ok(board.length >= Wd.MIN_ANSWERS && board.length <= Wd.MAX_ANSWERS, `${name} ${s}: ${board.length} board words`);
        assert.ok(board.filter((w) => w.length >= 4).length >= Wd.MIN_ANSWERS_4, `${name} ${s}: too few 4+ letter words`);
        assert.ok(board.includes(s), `${s} isn't one of its own answers`);
      }
    }
  }
});

test('solve: board words fit the seed, are sorted, and respect tier and shortest length; the rest are bonus words', () => {
  const seed = 'garden';                          // a normal-difficulty 6-letter seed
  assert.ok(seeds.normal[6].includes(seed));
  const { board, bonus } = Wd.solve(seed, dict, { tier: 35, minLen: 3 });
  for (const w of [...board, ...bonus]) assert.ok(Wd.fits(w, Wd.counts(seed)), w);
  assert.ok(['garden', 'danger', 'grand', 'red', 'drag'].every((w) => board.includes(w)), board.join(' '));
  assert.deepEqual([...board], [...board].sort((a, b) => a.length - b.length || (a < b ? -1 : 1)));
  for (const w of board) assert.ok(dict.tierOf.get(w) <= 35, `${w} above the tier`);
  for (const w of bonus) assert.ok(dict.tierOf.get(w) > 35, `${w} should be a board word`);
  const four = Wd.solve(seed, dict, { tier: 35, minLen: 4 });
  assert.ok(four.board.every((w) => w.length >= 4) && four.bonus.some((w) => w.length === 3));
  const blocked = Wd.solve(seed, dict, { tier: 35, minLen: 3, block: new Set(['danger']) });
  assert.ok(!blocked.board.includes('danger') && !blocked.bonus.includes('danger'));
});

test('fits counts repeated letters', () => {
  assert.ok(Wd.fits('ball', Wd.counts('ballet')));
  assert.ok(!Wd.fits('balls', Wd.counts('ballet')));
  assert.ok(!Wd.fits('cat', Wd.counts('dog')));
});

test('US-only and UK-only spellings are bonus words only (tier 71), never on the board', () => {
  const variants = dict.list.filter(([, t]) => t === 71).map(([w]) => w);
  assert.ok(variants.length > 50);
  for (const w of ['colour', 'color', 'honour', 'honor']) if (dict.tierOf.has(w)) assert.equal(dict.tierOf.get(w), 71, w);
});

test('seedLength follows the difficulty table, the last length repeating', () => {
  assert.equal(Wd.seedLength('normal', 1), 6);
  assert.equal(Wd.seedLength('normal', 3), 7);
  assert.equal(Wd.seedLength('normal', 99), 8);
  assert.equal(Wd.seedLength('easy', 1), 5);
  assert.equal(Wd.seedLength('hard', 5), 9);
});

test('the word lists carry their sources\' licence notices', () => {
  const lic = read('public/chatagram/words/LICENSE.txt');
  assert.match(lic, /Copyright 2000-\d{4} by Kevin Atkinson/);
  assert.match(lic, /CC BY 4\.0/);
});
