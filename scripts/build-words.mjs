// Builds Chatagram's word lists: public/chatagram/words/words.txt and seeds.txt (docs/widgets.md, "Words").
// Run by hand when the lists should change (a new blocklist word, a newer SCOWL); the output is committed, so the
// site still has no build step. Like presize-art.mjs.
//
//   git clone --depth 1 -b v2 https://github.com/en-wl/wordlist.git /tmp/scowl && (cd /tmp/scowl && make)   # once, ~1 min
//   node scripts/build-words.mjs --scowl /tmp/scowl
//   node scripts/build-words.mjs --scowl /tmp/scowl --freq /tmp/en_full.txt   # + list rare words still getting boxes
//
// Sources: SCOWL/ESDB (Kevin Atkinson, MIT-like licence: its notice is copied into words/LICENSE.txt), which rates
// every word by how common it is and tags the offensive and vulgar ones; LDNOOBW (CC BY 4.0,
// scripts/words/ldnoobw-en.txt), a second bad-word list; scripts/words/blocklist.txt, our own.
//
// What it keeps: plain lowercase words of 3–9 letters (no names, abbreviations, contractions, hyphens or accents),
// none blocked. A word spelt the same in the US and the UK gets the smallest SCOWL size it's in (35, 50, 60 or 70);
// a US-only or UK-only spelling (color, colour) gets 71, so it's only ever a bonus word and nobody is stuck on the
// other country's spelling. Seeds: for each difficulty and length, the well-known words whose puzzle has a sensible
// number of board words (public/chatagram/words.js). Only words that fit inside at least one seed are written.
//
// Bonus only: scripts/words/bonus-only.txt lists everyday words most people wouldn't think of (odd plurals and verb forms,
// rare short words: eke, yens, loyaler, timider). They're still real, so they still score as bonus words, but they never
// get a box and are never the scrambled word. scripts/words/checked.txt lists words that are rare in everyday speech but
// well known (raccoons, epilepsy): looked at and kept. --freq <file> (a word-frequency list, "word count" per line, e.g.
// the OpenSubtitles one in docs/widgets.md, "Words"; never committed) writes the rare words that are in neither list to
// rare-words.txt in the system's temp folder, to review after a rebuild.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname, OUT = join(ROOT, 'public/chatagram/words');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i < 0 ? null : process.argv[i + 1]; };
const scowl = arg('scowl');
if (!scowl || !existsSync(join(scowl, 'scowl.db'))) {
  console.error('Needs a built SCOWL v2 checkout: see the top of this file (--scowl <dir with scowl.db>)');
  process.exit(1);
}
const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(readFileSync(join(ROOT, 'public/chatagram/words.js'), 'utf8'), ctx);
const Wd = ctx.Chatagram.words;

// ---- blocked words ------------------------------------------------------------------------------------------------
const listFile = (f) => readFileSync(join(ROOT, 'scripts/words', f), 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'));
const blockedBase = new Set([...listFile('ldnoobw-en.txt'), ...listFile('blocklist.txt')].filter((w) => /^[a-z]+$/.test(w)));
const SUFFIXES = ['s', 'es', 'd', 'ed', 'ing'];
const blocked = (w) => blockedBase.has(w) || SUFFIXES.some((s) => w.endsWith(s) && (blockedBase.has(w.slice(0, -s.length)) || (s === 'ing' && blockedBase.has(w.slice(0, -3) + 'e'))));
// bonus only (exact words: a plural or verb form is judged on its own) and rare-but-kept
const bonusOnly = new Set(listFile('bonus-only.txt')), checked = new Set(listFile('checked.txt'));
const BONUS_TIER = 60;

// ---- SCOWL tiers --------------------------------------------------------------------------------------------------
const SIZES = [35, 50, 60, 70];
function list(size, spelling) {
  const out = execFileSync('python3', ['./scowl', 'word-list', String(size), spelling, '1', '--categories=', '--wo-poses=abbr',
    '--wo-usage-notes=offensive-1,offensive-2,vulgar-1,vulgar-3', '--deaccent'], { cwd: scowl, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  return new Set(out.split('\n').filter((w) => /^[a-z]{3,9}$/.test(w) && !blocked(w)));
}
const tier = new Map();
for (const size of SIZES) {
  const us = list(size, 'A'), uk = list(size, 'B');
  for (const w of us) if (uk.has(w) && !tier.has(w)) tier.set(w, size);
  if (size === 70) for (const w of new Set([...us, ...uk])) if (!tier.has(w)) tier.set(w, 71);
}
const unknownBonus = [...bonusOnly].filter((w) => !tier.has(w));
for (const w of bonusOnly) if (tier.has(w) && tier.get(w) < BONUS_TIER) tier.set(w, BONUS_TIER);
const dict = Wd.index([...tier].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)));

// ---- seeds ----------------------------------------------------------------------------------------------------------
const ALWAYS_SEEDS = ['heart', 'garden', 'clovers'];
const seeds = {}, used = new Set(), report = [];
for (const [name, d] of Object.entries(Wd.DIFFICULTY)) {
  seeds[name] = {};
  for (const len of [...new Set(d.lengths)]) {
    const picked = [];
    for (const [w, t] of dict.list) {
      if (w.length !== len || t > d.seedTier) continue;
      const { board } = Wd.solve(w, dict, { tier: d.tier, minLen: 3 });
      if (board.length < Wd.MIN_ANSWERS || board.length > Wd.MAX_ANSWERS) continue;
      if (board.filter((x) => x.length >= 4).length < Wd.MIN_ANSWERS_4) continue;
      picked.push(w);
    }
    // at most 1,200 per list, spread evenly through the alphabet (plenty for any stream, half the download); the still
    // pictures' words (play.js STILL_SEEDS: the site's previews, the link preview, the trailer) are always kept
    const step = picked.length / Math.min(picked.length, 1200);
    const spread = Array.from({ length: Math.min(picked.length, 1200) }, (_, i) => picked[Math.floor(i * step)]);
    seeds[name][len] = [...new Set([...spread, ...picked.filter((w) => ALWAYS_SEEDS.includes(w))])].sort();
    picked.length = 0; picked.push(...seeds[name][len]);
    report.push(`${name} ${len}: ${picked.length} seeds`);
    for (const s of picked) used.add(s);
  }
}
// only words that fit inside some seed can ever be played
const seedCounts = [...used].map((s) => Wd.counts(s));
const seedMasks = [...used].map((s) => ~Wd.mask(s));
const playable = dict.list.filter(([w, , wm]) => seedCounts.some((c, i) => !(wm & seedMasks[i]) && Wd.fits(w, c)));

// ---- write ------------------------------------------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
let words = '';
for (const t of [...SIZES, 71]) { words += `#${t}\n`; for (const [w, x] of playable) if (x === t) words += w + '\n'; }
writeFileSync(join(OUT, 'words.txt'), words);
let seedText = '';
for (const [name, byLen] of Object.entries(seeds)) for (const [len, ws] of Object.entries(byLen)) seedText += `#${name} ${len}\n${ws.join('\n')}\n`;
writeFileSync(join(OUT, 'seeds.txt'), seedText);
const copyright = readFileSync(join(scowl, 'Copyright'), 'utf8').split('\n=== AU')[0].trim();
writeFileSync(join(OUT, 'LICENSE.txt'), `Chatagram's word lists (words.txt, seeds.txt) are made from these sources.

SCOWL / English Speller Database (ESDB), https://github.com/en-wl/wordlist
------------------------------------------------------------------------
${copyright}

List of Dirty, Naughty, Obscene, and Otherwise Bad Words (LDNOOBW), used to leave words out
------------------------------------------------------------------------------------------
https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
`);

// ---- report (read it: docs/widgets.md, "Words") -----------------------------------------------------------------------
const byTier = {}; for (const [, t] of playable) byTier[t] = (byTier[t] || 0) + 1;
console.log(`words.txt: ${playable.length} words (of ${dict.list.length}); by tier ${JSON.stringify(byTier)}, ${(words.length / 1024).toFixed(0)} KB`);
console.log(`seeds.txt: ${used.size} seeds, ${(seedText.length / 1024).toFixed(0)} KB`);
for (const r of report) console.log('  ' + r);
console.log(`blocked: ${blockedBase.size} words (+ s/es/d/ed/ing forms)`);
console.log(`bonus only: ${bonusOnly.size} words (${unknownBonus.length} not in SCOWL${unknownBonus.length ? ': ' + unknownBonus.slice(0, 20).join(' ') : ''}); checked and kept: ${checked.size}`);

// ---- rare words still getting boxes (--freq) --------------------------------------------------------------------------
// Rare by the frequency list's rank: everyday words beyond 40,000 (short ones beyond 20,000), medium words (Hard only)
// beyond 80,000. Only words that can get a box and are in neither list; review each into bonus-only.txt or checked.txt.
const freqFile = arg('freq');
if (freqFile) {
  const rank = new Map();
  readFileSync(freqFile, 'utf8').split('\n').forEach((l, i) => { const w = l.split(/[\s\t]/)[0]; if (w && !rank.has(w)) rank.set(w, i); });
  const R = (w) => rank.get(w) ?? Infinity;
  const rare = playable.filter(([w, t]) => t <= 50 && !bonusOnly.has(w) && !checked.has(w) &&
    (t === 35 ? R(w) > (w.length <= 4 ? 20000 : 40000) : R(w) > 80000));
  const out = join(tmpdir(), 'rare-words.txt');
  writeFileSync(out, rare.map(([w, t]) => `${w}\t${t}\t${R(w) === Infinity ? '-' : R(w)}`).join('\n') + '\n');
  console.log(`rare words still getting boxes, not yet reviewed: ${rare.length} (word, tier, rank) → ${out}`);
}
