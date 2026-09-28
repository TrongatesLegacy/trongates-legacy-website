// Chatagram's word logic, shared by the overlay (play.html) and the word-list builder (scripts/build-words.mjs), so a
// puzzle is worked out the same way in both. No drawing here. See docs/widgets.md, "Words".
//
// words.txt holds every usable word once, grouped by how common it is (SCOWL sizes: 35 everyday, 50 medium, 60 the
// spell-checker default, 70 large, 71 = a US-only or UK-only spelling). Board words, the slots on screen, come from the
// difficulty's tier and below; anything else in the file counts as a bonus word. seeds.txt lists the scrambled words
// for each difficulty and length, each already checked to make a good puzzle.
(() => {
  const W = (window.Chatagram = window.Chatagram || {});

  /** @typedef {{ tier: number, seedTier: number, lengths: number[] }} Difficulty */
  /** @type {Record<string, Difficulty>} */
  const DIFFICULTY = {
    // lengths: the seed's length for level 1, 2, 3…; the last one repeats
    easy: { tier: 35, seedTier: 35, lengths: [5, 6, 6, 7] },
    normal: { tier: 35, seedTier: 35, lengths: [6, 6, 7, 7, 8] },
    hard: { tier: 50, seedTier: 50, lengths: [7, 7, 8, 8, 9] },
  };
  // a puzzle has this many board words (3 letters and up): enough to play, few enough to fit the full layout (a 7-letter
  // everyday word like "kitchen" makes about 40; "strange" makes 100, so it isn't a seed)
  const MIN_ANSWERS = 12, MAX_ANSWERS = 50, MIN_ANSWERS_4 = 6;   // …and at least 6 when the shortest word is 4

  const A = 97;
  /** @param {string} word */
  function counts(word) { const c = new Uint8Array(26); for (let i = 0; i < word.length; i++) c[word.charCodeAt(i) - A]++; return c; }
  /** can word be made from these letter counts? */
  function fits(word, have) {
    const used = new Uint8Array(26);
    for (let i = 0; i < word.length; i++) { const k = word.charCodeAt(i) - A; if (++used[k] > have[k]) return false; }
    return true;
  }

  /** which letters a word uses, as bits (a quick first check before counting) */
  function mask(word) { let m = 0; for (let i = 0; i < word.length; i++) m |= 1 << (word.charCodeAt(i) - A); return m; }
  /** @typedef {{ tierOf: Map<string, number>, list: [string, number, number][] }} Dict  list: [word, tier, mask] */
  /** @param {[string, number][]} pairs @returns {Dict} */
  function index(pairs) { return { tierOf: new Map(pairs), list: pairs.map(([w, t]) => [w, t, mask(w)]) }; }
  /** words.txt → Dict */
  function parseWords(text) {
    const pairs = []; let tier = 0;
    for (const line of text.split('\n')) {
      if (!line) continue;
      if (line[0] === '#') { tier = +line.slice(1).trim(); continue; }
      pairs.push([line, tier]);
    }
    return index(pairs);
  }
  /** seeds.txt → { easy: { 6: [...], 7: [...] }, … } */
  function parseSeeds(text) {
    /** @type {Record<string, Record<number, string[]>>} */
    const out = {}; let d = '', len = 0;
    for (const line of text.split('\n')) {
      if (!line) continue;
      if (line[0] === '#') { [d, len] = line.slice(1).trim().split(' '); (out[d] = out[d] || {})[+len] = []; continue; }
      out[d][+len].push(line);
    }
    return out;
  }

  /**
   * Every word that can be made from the seed's letters, split into board words (tier ≤ the difficulty's, at least
   * minLen letters) and bonus words (any other listed word). Board words sorted by length, then A–Z.
   * @param {string} seed @param {Dict} dict @param {{ tier: number, minLen: number, block?: Set<string> }} o
   */
  function solve(seed, dict, o) {
    const have = counts(seed), m = ~mask(seed), board = [], bonus = [];
    for (const [w, t, wm] of dict.list) {
      if (wm & m || w.length > seed.length || w.length < 3 || (o.block && o.block.has(w)) || !fits(w, have)) continue;
      if (t <= o.tier && w.length >= o.minLen) board.push(w); else bonus.push(w);
    }
    board.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    return { board, bonus };
  }

  /** the seed length for a level (1-based) */
  const seedLength = (difficulty, level) => { const L = DIFFICULTY[difficulty].lengths; return L[Math.min(level, L.length) - 1]; };

  W.words = { DIFFICULTY, MIN_ANSWERS, MAX_ANSWERS, MIN_ANSWERS_4, counts, fits, mask, index, parseWords, parseSeeds, solve, seedLength };
})();
