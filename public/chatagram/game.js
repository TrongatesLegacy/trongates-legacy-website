// Chatagram's rules (docs/widgets.md, "The game"): puzzles, guesses, scoring, padlocks, hidden letters,
// levels, commands and the summaries. No drawing and no timers of its own: the overlay (play.html) passes chat
// messages to handle() and calls tick() when nextWake() says something is due; everything that happens comes back as
// events for the overlay to animate. The clock and the randomness are passed in, so a test can replay any game.
//
//   const g = Chatagram.game(settings, { dict, seeds, now: () => Date.now(), random: Math.random, emit: (e) => …, award: (m, pts, words) => … });
//   g.boot(savedSnapshot?)   g.handle({ platform, user, name, text, mod, owner })   g.tick()   g.nextWake()   g.snapshot()
//   g.hold(true|false): stop every timer (the leaderboard covering the board) and carry on from where they stopped
//
// Points go to the leaderboards (scores.js) through deps.award as they're scored; the game itself only keeps this
// game's players. state.allTime is still in the save, filled in by the overlay, so an older overlay reading it sees them.
(() => {
  const C = (window.Chatagram = window.Chatagram || {});
  const STALE = 10 * 60000;             // a saved game older than this (OBS was closed) starts over instead of resuming
  const COOLDOWN = 60000;               // the leaderboard command, when everyone can use commands (mods and the owner never wait)
  const HOLD_MAX = 12000;               // a hold saved mid-way (OBS refreshed under the leaderboard) gives back at most this
  const LONG_BONUS = 5;
  /** points for a board word: 3 letters 2, 4 → 4, 5 → 6… */
  const points = (word) => Math.max(2, word.length * 2 - 4);

  /**
   * @param {Record<string, any>} cfg  decoded settings (settings.js)
   * @param {{ dict: any, seeds: any, now: () => number, random: () => number, emit?: (e: any) => void }} deps
   */
  function game(cfg, deps) {
    const Wd = C.words, now = deps.now, rnd = deps.random, emit = deps.emit || (() => {});
    const block = new Set(cfg.block || []);
    const ignore = new Set(cfg.ignore || []);
    const cmds = { start: cfg.cstart, next: cfg.cnext, skip: cfg.cskip, reset: cfg.creset, top: cfg.lb ? cfg.ctop || [] : [], clear: cfg.cclear || [] };
    const key = (m) => `${m.platform}:${m.user}`;
    /** @type {any} */
    let s = fresh();

    function fresh() {
      return { v: 1, phase: 'idle', gameId: 0, level: 0, round: null, players: {}, allTime: {}, recent: [], result: null, gameResult: null, nextAt: 0, savedAt: 0, heldAt: 0, lbAt: 0 };
    }
    // the game's own time: stands still while held (see hold())
    const clock = () => s.heldAt || now();
    const award = deps.award || (() => {});
    const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
    function shuffled(xs) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

    // ---- puzzles ---------------------------------------------------------------------------------------------------
    // The board shows a limited number of boxes, growing slowly with the level (12 at level 1, +3 a level, up to cfg.slots),
    // spread over the lengths in proportion (at least one each, the longest word always). A box is for a length, not a
    // fixed word: any real word of that length fills the next open box, and once a length's boxes are full, more words of
    // that length don't count. The words picked here are only what's shown as "missed" if boxes stay empty.
    const slotsFor = (level) => Math.min(cfg.slots, 12 + 3 * (level - 1));
    function pickSlots(words, seed) {
      const max = slotsFor(s.level);
      if (words.length <= max) return { shown: words };
      const byLen = new Map();
      for (const w of words) { if (!byLen.has(w.length)) byLen.set(w.length, []); byLen.get(w.length).push(w); }
      const keep = new Set([seed]);
      const lens = [...byLen.keys()].sort((a, b) => b - a);
      for (const len of lens) {
        const pool = shuffled(byLen.get(len).filter((w) => !keep.has(w)));
        const share = Math.max(1, Math.round((max * byLen.get(len).length) / words.length));
        for (const w of pool.slice(0, Math.max(0, share - (len === seed.length ? 1 : 0)))) keep.add(w);
      }
      // trim or top up to exactly cfg.slots (shortest first to trim, then any left over to fill)
      let shown = words.filter((w) => keep.has(w));
      while (shown.length > max) { const i = shown.findIndex((w) => w !== seed); shown.splice(i, 1); }
      for (const w of shuffled(words.filter((x) => !keep.has(x)))) { if (shown.length >= max) break; shown.push(w); }
      shown.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
      return { shown };
    }

    function newRound() {
      const d = Wd.DIFFICULTY[cfg.diff], len = Wd.seedLength(cfg.diff, s.level);
      const all = (deps.seeds[cfg.diff] && deps.seeds[cfg.diff][len]) || [];
      let pool = all.filter((w) => !block.has(w) && !s.recent.includes(w));
      if (!pool.length) pool = all.filter((w) => !block.has(w));
      // deps.firstSeed: the first puzzle's word, when a caller wants a known one (the pictures on the site)
      const seed = deps.firstSeed && !s.recent.length && all.includes(deps.firstSeed) ? deps.firstSeed : pick(pool);
      s.recent = [seed, ...s.recent].slice(0, 60);
      const { board: every, bonus } = Wd.solve(seed, deps.dict, { tier: d.tier, minLen: cfg.minlen, block });
      const { shown: board } = pickSlots(every, seed);
      // tricky levels hide real letters as ?: one from cfg.tricky (shown at half time), two from 3 levels later (shown at
      // 40% and 70% of the round). (There was also a fake letter, as in WOS, until 2026-09-29: here any real word counts,
      // so a fake letter made real words that were turned down, e.g. a fake G beside UNLEASH: hang, glue, angle… The
      // owner dropped it for a second hidden letter.)
      const tricky = cfg.tricky > 0 && s.level >= cfg.tricky;
      const nHidden = !tricky ? 0 : s.level >= cfg.tricky + 3 ? 2 : 1;
      const letters = seed.split('').map((ch, i) => ({ ch, id: i }));
      let order = shuffled(letters);
      for (let i = 0; i < 5 && order.map((l) => l.ch).join('') === seed; i++) order = shuffled(letters);
      const t = clock(), dur = cfg.time * 1000;
      const hidden = shuffled(order).slice(0, nHidden).map((l) => l.id);
      s.round = {
        id: (s.round ? s.round.id : 0) + 1, seed, letters: order,
        hidden, shown: 0, reveals: nHidden === 2 ? [0.4, 0.7] : [0.5],   // the hidden letters' ids, how many are shown, when
        answers: board.map((word) => ({ word, by: null, at: 0, pts: 0 })), valid: every, bonus, bonusFound: [],
        goal: Math.max(1, Math.ceil(board.length * cfg.goal / 100)),
        startedAt: t, endsAt: t + dur,
        locks: Array.from({ length: cfg.locks }, (_, i) => t + Math.round(dur * (i + 1) / (cfg.locks + 1))), opened: 0, locked: {},
        nextShuffle: cfg.shuffle > 0 ? t + cfg.shuffle * 1000 : 0,
        order: [],                                                     // who found what, in order (streaks, highlights)
      };
      for (const p of Object.values(s.players)) { p.roundScore = 0; p.roundWords = 0; }
      s.phase = 'playing'; s.result = null; s.nextAt = 0;
      emit({ type: 'round', round: s.round, level: s.level });
    }

    function startGame() {
      s.gameId++; s.level = 1; s.players = {}; s.gameResult = null; s.round = null;
      s.gameStats = { words: 0, best: null, split: {} };
      emit({ type: 'game', gameId: s.gameId });
      newRound();
    }

    // ---- guesses -----------------------------------------------------------------------------------------------------
    function player(m) {
      const k = key(m);
      const p = s.players[k] || (s.players[k] = { platform: m.platform, user: m.user, name: m.name, score: 0, words: 0, roundScore: 0, roundWords: 0 });
      p.name = m.name || p.name;
      return p;
    }
    /** which tiles spell the word, left to right as the letters stand now (for the overlay to light them up) */
    function tilesFor(word) {
      const used = new Set(), out = [];
      for (const ch of word) {
        const i = s.round.letters.findIndex((l, j) => !used.has(j) && l.ch === ch);
        if (i < 0) return [];
        used.add(i); out.push(i);
      }
      return out;
    }
    // the padlock that lets them guess again (a number past the last one: not this round; kept as a number so it saves)
    const lockedUntil = (t) => { const i = s.round.locks.findIndex((x) => x > t); return i < 0 ? s.round.locks.length : i; };

    function guess(m, word) {
      const r = s.round;
      let a = r.answers.find((x) => x.word === word);
      if (!a && (r.valid || []).includes(word)) {
        // a real word that isn't the one picked for a box: it takes the next open box of its length, if there is one
        a = r.answers.find((x) => !x.by && x.word.length === word.length);
        if (!a) return { kind: 'full', word };
        a.word = word;
      }
      if (a) {
        if (a.by) return { kind: 'dup', word, by: a.by };
        const k = key(m);
        if (r.locks.length && r.locked[k] !== undefined && r.locked[k] >= r.opened) return { kind: 'locked', word };
        const t = clock(), p = player(m);
        let pts = points(word);
        const longest = word.length === r.seed.length;
        if (longest && cfg.longbonus) pts += LONG_BONUS;
        Object.assign(a, { by: { platform: m.platform, user: m.user, name: p.name }, at: t, pts });
        p.score += pts; p.words++; p.roundScore += pts; p.roundWords++;
        award(m, pts, 1);
        r.order.push(k);
        s.gameStats.words++; s.gameStats.split[m.platform] = (s.gameStats.split[m.platform] || 0) + 1;
        if (!s.gameStats.best || word.length > s.gameStats.best.word.length) s.gameStats.best = { word, name: p.name, platform: m.platform };
        if (r.locks.length) r.locked[k] = lockedUntil(t);
        const res = { kind: 'found', word, by: a.by, pts, longest, tiles: tilesFor(word), index: r.answers.indexOf(a) };
        emit({ type: 'found', ...res });
        const found = r.answers.filter((x) => x.by).length;
        if (found === r.answers.length) endRound();
        return res;
      }
      if (cfg.bonus && r.bonus.includes(word)) {
        if (r.bonusFound.includes(word)) return { kind: 'dup', word };
        r.bonusFound.push(word);
        const p = player(m); p.score += 1; p.roundScore += 1;
        award(m, 1, 0);
        const res = { kind: 'bonus', word, by: { platform: m.platform, user: m.user, name: p.name }, pts: 1 };
        emit({ type: 'bonus', ...res });
        return res;
      }
      return { kind: 'wrong', word };
    }

    // ---- commands ------------------------------------------------------------------------------------------------------
    const allowed = (m) => cfg.perm === 'all' || m.owner || (cfg.perm === 'mods' && m.mod);
    function command(name, m, text) {
      if (name === 'top') {
        // everyone can ask when commands are open to everyone, once a minute; mods and the owner whenever they like
        const t = now();
        if (cfg.perm === 'all' && !m.mod && !m.owner && t - (s.lbAt || 0) < COOLDOWN) return false;
        if (cfg.perm === 'all' && !m.mod && !m.owner) s.lbAt = t;
        emit({ type: 'leaderboard', by: m.name, text });
        return true;
      }
      if (name === 'clear') { emit({ type: 'clearscores' }); return true; }
      if (name === 'start') { if (s.phase === 'idle' || s.phase === 'over') { startGame(); return true; } return false; }
      if (name === 'next') { if (s.phase === 'cleared') { s.level++; newRound(); return true; } return false; }
      if (name === 'skip') { if (s.phase === 'playing') { emit({ type: 'skip' }); newRound(); return true; } return false; }
      if (name === 'reset') {                          // the game only: the leaderboards stay
        const lbAt = s.lbAt;
        s = fresh(); s.lbAt = lbAt; s.gameStats = { words: 0, best: null, split: {} };
        emit({ type: 'reset' });
        if (cfg.restart > 0) startGame(); else emit({ type: 'phase', phase: 'idle' });
        return true;
      }
      return false;
    }

    /** a chat message: a command, a guess, or nothing @returns {any} */
    function handle(m) {
      if (!m || typeof m.text !== 'string') return { kind: 'ignored' };
      if (ignore.has(m.user) || ignore.has(String(m.name || '').toLowerCase())) return { kind: 'ignored' };
      const text = m.text.trim().toLowerCase().replace(/\s+/g, ' ');
      for (const [name, list] of Object.entries(cmds)) {
        if (!list.includes(text)) continue;
        if (name === 'clear' ? !m.owner : !allowed(m)) return { kind: 'denied', command: name };
        return { kind: 'command', command: name, done: command(name, m, text) };
      }
      if (s.phase !== 'playing') return { kind: 'ignored' };
      const word = text.replace(/[!?.,]+$/, '');
      if (!/^[a-z]{3,9}$/.test(word)) return { kind: 'ignored' };
      return guess(m, word);
    }

    // ---- time ---------------------------------------------------------------------------------------------------------
    function stars(found, total, goal) { if (found < goal) return 0; if (found >= total) return 3; return found >= goal + (total - goal) / 2 ? 2 : 1; }
    function endRound() {
      const r = s.round, t = clock(), found = r.answers.filter((a) => a.by);
      const cleared = found.length >= r.goal;
      const players = Object.values(s.players);
      const mvps = players.filter((p) => p.roundScore > 0).sort((a, b) => b.roundScore - a.roundScore).slice(0, 7)
        .map((p) => ({ name: p.name, platform: p.platform, pts: p.roundScore, words: p.roundWords }));
      const split = {}; for (const a of found) split[a.by.platform] = (split[a.by.platform] || 0) + 1;
      // highlights (shown instead of the platform split when there's one platform)
      const fastest = found.slice().sort((a, b) => a.at - b.at)[0];
      let streak = null, run = 0;
      r.order.forEach((k, i) => { run = i && r.order[i - 1] === k ? run + 1 : 1; if (!streak || run > streak.n) streak = { k, n: run }; });
      const lastSave = found.filter((a) => r.endsAt - a.at <= 5000 && a.at <= r.endsAt).sort((a, b) => b.at - a.at)[0];
      const missed = r.answers.filter((a) => !a.by).map((a) => a.word).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
      s.result = {
        level: s.level, cleared, found: found.length, total: r.answers.length, goal: r.goal, stars: stars(found.length, r.answers.length, r.goal),
        timeLeft: Math.max(0, Math.round((r.endsAt - t) / 1000)), players: players.filter((p) => p.roundWords > 0).length, mvps, split, missed,
        highlights: {
          fastest: fastest && { name: fastest.by.name, word: fastest.word, secs: Math.max(1, Math.round((fastest.at - r.startedAt) / 1000)) },
          streak: streak && streak.n > 1 && { name: s.players[streak.k].name, n: streak.n },
          save: lastSave && { name: lastSave.by.name, word: lastSave.word, left: Math.max(0, Math.round((r.endsAt - lastSave.at) / 1000)) },
        },
      };
      if (cleared) {
        s.phase = 'cleared';
        s.nextAt = cfg.next > 0 ? t + cfg.next * 1000 : 0;
      } else {
        s.phase = 'over';
        s.gameResult = {
          level: s.level, words: s.gameStats.words, best: s.gameStats.best, split: { ...s.gameStats.split }, players: players.length,
          mvps: players.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 7).map((p) => ({ name: p.name, platform: p.platform, pts: p.score, words: p.words })),
          away: missed.slice(0, 3),
        };
        s.nextAt = cfg.restart > 0 ? t + cfg.restart * 1000 : 0;
      }
      emit({ type: 'end', result: s.result, game: s.gameResult, phase: s.phase });
    }

    /** when the next hidden letter is shown */
    const revealAt = (r) => r.startedAt + (r.endsAt - r.startedAt) * r.reveals[r.shown];

    /** do whatever is due now */
    function tick() {
      if (s.heldAt) return;
      const t = now();
      if (s.phase === 'playing') {
        const r = s.round;
        while (r.opened < r.locks.length && t >= r.locks[r.opened]) { r.opened++; emit({ type: 'unlock', index: r.opened - 1 }); }
        while (r.shown < r.hidden.length && t >= revealAt(r)) { const id = r.hidden[r.shown++]; emit({ type: 'reveal', index: r.letters.findIndex((l) => l.id === id) }); }
        if (t >= r.endsAt) return endRound();
        if (r.nextShuffle && t >= r.nextShuffle) {
          const before = r.letters.map((l) => l.ch).join('');
          let next = shuffled(r.letters);
          for (let i = 0; i < 5 && next.map((l) => l.ch).join('') === before; i++) next = shuffled(r.letters);
          r.letters = next;
          r.nextShuffle = t + cfg.shuffle * 1000;
          emit({ type: 'shuffle', from: before, letters: r.letters });
        }
      } else if (s.nextAt && t >= s.nextAt) {
        s.nextAt = 0;
        if (s.phase === 'cleared') { s.level++; newRound(); } else if (s.phase === 'over') startGame();
      }
    }
    /** when tick() next has something to do (Infinity: waiting for chat) */
    function nextWake() {
      if (s.heldAt) return Infinity;
      if (s.phase === 'playing') {
        const r = s.round, due = [r.endsAt];
        if (r.opened < r.locks.length) due.push(r.locks[r.opened]);
        if (r.shown < r.hidden.length) due.push(revealAt(r));
        if (r.nextShuffle) due.push(r.nextShuffle);
        return Math.min(...due);
      }
      return s.nextAt || Infinity;
    }

    /**
     * Hold: every timer stops (the round's end, padlocks, the half-time reveal, shuffles, the countdown to the next level
     * or game) and carries on from where it stopped when released. Guesses still count while held, at the moment the hold
     * began. @returns {boolean} whether anything changed
     */
    function hold(on) {
      if (on) { if (s.heldAt) return false; s.heldAt = now(); return true; }
      if (!s.heldAt) return false;
      shift(now() - s.heldAt); s.heldAt = 0;
      return true;
    }
    /** move every timer on by ms (the time spent held) */
    function shift(ms) {
      if (!(ms > 0)) return;
      const r = s.round;
      if (s.phase === 'playing' && r) {
        r.startedAt += ms; r.endsAt += ms; r.locks = r.locks.map((x) => x + ms);
        if (r.nextShuffle) r.nextShuffle += ms;
        for (const a of r.answers) if (a.by) a.at += ms;           // so "fastest find" and "last-second save" stay true
      }
      if (s.nextAt) s.nextAt += ms;
    }

    /** start up: resume a saved game if it's recent, otherwise start (or wait for the start command) */
    function boot(saved) {
      const t = now();
      if (saved && saved.v === 1 && saved.phase !== 'idle' && t - (saved.savedAt || 0) < STALE) {
        s = saved;
        for (const [k, v] of Object.entries({ allTime: {}, heldAt: 0, lbAt: 0 })) if (s[k] === undefined) s[k] = v;   // a save from an older version
        if (s.heldAt) { shift(Math.min(t - s.heldAt, HOLD_MAX)); s.heldAt = 0; }   // refreshed under the leaderboard: carry on
        if (s.round) {                                  // a round saved by an older version
          const r = s.round;
          if (r.letters.some((l) => l.fake)) r.letters = r.letters.filter((l) => !l.fake);          // fake letters (to 2026-09-29)
          if (!Array.isArray(r.hidden)) { r.hidden = r.hidden >= 0 ? [r.hidden] : []; r.shown = r.revealed ? r.hidden.length : 0; r.reveals = [0.5]; }
        }
        emit({ type: 'resume', phase: s.phase });
        return;
      }
      const lbAt = saved && saved.lbAt || 0;
      s = fresh(); s.lbAt = lbAt; s.gameStats = { words: 0, best: null, split: {} };
      if (cfg.restart > 0) startGame(); else emit({ type: 'phase', phase: 'idle' });
    }
    function snapshot() { s.savedAt = now(); return JSON.parse(JSON.stringify(s)); }

    return {
      boot, handle, tick, nextWake, snapshot, points, hold, clock,
      get state() { return s; },
      get held() { return !!s.heldAt; },
      top(n = 3) { return Object.values(s.players).filter((p) => p.score > 0).sort((a, b) => b.score - a.score || b.words - a.words).slice(0, n); },
      /** the command a player would type (the first name) */
      commandName: (name) => cmds[name][0],
    };
  }

  C.game = game;
  C.game.points = points;
})();
