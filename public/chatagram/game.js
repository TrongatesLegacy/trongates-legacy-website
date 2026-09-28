// Chatagram's rules (docs/widgets.md, "The game"): puzzles, guesses, scoring, padlocks, hidden and fake letters,
// levels, commands and the summaries. No drawing and no timers of its own: the overlay (play.html) passes chat
// messages to handle() and calls tick() when nextWake() says something is due; everything that happens comes back as
// events for the overlay to animate. The clock and the randomness are passed in, so a test can replay any game.
//
//   const g = Chatagram.game(settings, { dict, seeds, now: () => Date.now(), random: Math.random, emit: (e) => … });
//   g.boot(savedSnapshot?)   g.handle({ platform, user, name, text, mod, owner })   g.tick()   g.nextWake()   g.snapshot()
(() => {
  const C = (window.Chatagram = window.Chatagram || {});
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  const STALE = 10 * 60000;             // a saved game older than this (OBS was closed) starts over instead of resuming
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
    const cmds = { start: cfg.cstart, next: cfg.cnext, skip: cfg.cskip, reset: cfg.creset };
    const key = (m) => `${m.platform}:${m.user}`;
    /** @type {any} */
    let s = fresh();

    function fresh(allTime = {}) {
      return { v: 1, phase: 'idle', gameId: 0, level: 0, round: null, players: {}, allTime, recent: [], result: null, gameResult: null, nextAt: 0, savedAt: 0 };
    }
    const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
    function shuffled(xs) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

    // ---- puzzles ---------------------------------------------------------------------------------------------------
    function newRound() {
      const d = Wd.DIFFICULTY[cfg.diff], len = Wd.seedLength(cfg.diff, s.level);
      const all = (deps.seeds[cfg.diff] && deps.seeds[cfg.diff][len]) || [];
      let pool = all.filter((w) => !block.has(w) && !s.recent.includes(w));
      if (!pool.length) pool = all.filter((w) => !block.has(w));
      const seed = pick(pool);
      const { board, bonus } = Wd.solve(seed, deps.dict, { tier: d.tier, minLen: cfg.minlen, block });
      s.recent = [seed, ...s.recent].slice(0, 60);
      const tricky = cfg.tricky > 0 && s.level >= cfg.tricky;
      let letters = seed.split('').map((ch, i) => ({ ch, id: i }));
      if (tricky) {
        const missing = LETTERS.split('').filter((c) => !seed.includes(c) && !'jqxz'.includes(c));
        letters.push({ ch: pick(missing), id: letters.length, fake: true });
      }
      let order = shuffled(letters);
      for (let i = 0; i < 5 && order.map((l) => l.ch).join('') === seed; i++) order = shuffled(letters);
      const t = now(), dur = cfg.time * 1000;
      const hidden = tricky ? pick(order.filter((l) => !l.fake)).id : -1;
      s.round = {
        id: (s.round ? s.round.id : 0) + 1, seed, letters: order, hidden, revealed: !tricky, fakeGone: !tricky,
        answers: board.map((word) => ({ word, by: null, at: 0, pts: 0 })), bonus, bonusFound: [],
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
      const r = s.round, a = r.answers.find((x) => x.word === word);
      if (a) {
        if (a.by) return { kind: 'dup', word, by: a.by };
        const k = key(m);
        if (r.locks.length && r.locked[k] !== undefined && r.locked[k] >= r.opened) return { kind: 'locked', word };
        const t = now(), p = player(m);
        let pts = points(word);
        const longest = word.length === r.seed.length;
        if (longest && cfg.longbonus) pts += LONG_BONUS;
        Object.assign(a, { by: { platform: m.platform, user: m.user, name: p.name }, at: t, pts });
        p.score += pts; p.words++; p.roundScore += pts; p.roundWords++;
        r.order.push(k);
        s.gameStats.words++; s.gameStats.split[m.platform] = (s.gameStats.split[m.platform] || 0) + 1;
        if (!s.gameStats.best || word.length > s.gameStats.best.word.length) s.gameStats.best = { word, name: p.name, platform: m.platform };
        if (r.locks.length) r.locked[k] = lockedUntil(t);
        const res = { kind: 'found', word, by: a.by, pts, longest, tiles: tilesFor(word), index: r.answers.indexOf(a) };
        emit({ type: 'found', ...res });
        const found = r.answers.filter((x) => x.by).length;
        if (!r.fakeGone && found >= Math.ceil(r.goal / 2)) {
          r.fakeGone = true;
          const index = r.letters.findIndex((l) => l.fake);
          r.letters = r.letters.filter((l) => !l.fake);
          emit({ type: 'fakegone', index });
        }
        if (found === r.answers.length) endRound();
        return res;
      }
      if (cfg.bonus && r.bonus.includes(word)) {
        if (r.bonusFound.includes(word)) return { kind: 'dup', word };
        r.bonusFound.push(word);
        const p = player(m); p.score += 1; p.roundScore += 1;
        const res = { kind: 'bonus', word, by: { platform: m.platform, user: m.user, name: p.name }, pts: 1 };
        emit({ type: 'bonus', ...res });
        return res;
      }
      return { kind: 'wrong', word };
    }

    // ---- commands ------------------------------------------------------------------------------------------------------
    const allowed = (m) => cfg.perm === 'all' || m.owner || (cfg.perm === 'mods' && m.mod);
    function command(name) {
      if (name === 'start') { if (s.phase === 'idle' || s.phase === 'over') { startGame(); return true; } return false; }
      if (name === 'next') { if (s.phase === 'cleared') { s.level++; newRound(); return true; } return false; }
      if (name === 'skip') { if (s.phase === 'playing') { emit({ type: 'skip' }); newRound(); return true; } return false; }
      if (name === 'reset') {
        s = fresh(); s.gameStats = { words: 0, best: null, split: {} };
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
        if (!allowed(m)) return { kind: 'denied', command: name };
        return { kind: 'command', command: name, done: command(name) };
      }
      if (s.phase !== 'playing') return { kind: 'ignored' };
      const word = text.replace(/[!?.,]+$/, '');
      if (!/^[a-z]{3,9}$/.test(word)) return { kind: 'ignored' };
      return guess(m, word);
    }

    // ---- time ---------------------------------------------------------------------------------------------------------
    function stars(found, total, goal) { if (found < goal) return 0; if (found >= total) return 3; return found >= goal + (total - goal) / 2 ? 2 : 1; }
    function endRound() {
      const r = s.round, t = now(), found = r.answers.filter((a) => a.by);
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
      for (const p of players) {
        if (!p.roundScore) continue;
        const k = `${p.platform}:${p.user}`, at = s.allTime[k] || (s.allTime[k] = { name: p.name, platform: p.platform, score: 0, words: 0 });
        at.name = p.name; at.score += p.roundScore; at.words += p.roundWords;
      }
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

    /** do whatever is due now */
    function tick() {
      const t = now();
      if (s.phase === 'playing') {
        const r = s.round;
        while (r.opened < r.locks.length && t >= r.locks[r.opened]) { r.opened++; emit({ type: 'unlock', index: r.opened - 1 }); }
        if (!r.revealed && t >= r.startedAt + (r.endsAt - r.startedAt) / 2) { r.revealed = true; emit({ type: 'reveal', index: r.letters.findIndex((l) => l.id === r.hidden) }); }
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
      if (s.phase === 'playing') {
        const r = s.round, due = [r.endsAt];
        if (r.opened < r.locks.length) due.push(r.locks[r.opened]);
        if (!r.revealed) due.push(r.startedAt + (r.endsAt - r.startedAt) / 2);
        if (r.nextShuffle) due.push(r.nextShuffle);
        return Math.min(...due);
      }
      return s.nextAt || Infinity;
    }

    /** start up: resume a saved game if it's recent, otherwise start (or wait for the start command) */
    function boot(saved) {
      const t = now();
      const keepAllTime = cfg.remember && saved && saved.allTime ? saved.allTime : {};
      if (saved && saved.v === 1 && saved.phase !== 'idle' && t - (saved.savedAt || 0) < STALE) {
        s = saved;
        emit({ type: 'resume', phase: s.phase });
        return;
      }
      s = fresh(keepAllTime); s.gameStats = { words: 0, best: null, split: {} };
      if (cfg.restart > 0) startGame(); else emit({ type: 'phase', phase: 'idle' });
    }
    function snapshot() { s.savedAt = now(); return JSON.parse(JSON.stringify(s)); }

    return {
      boot, handle, tick, nextWake, snapshot, points,
      get state() { return s; },
      top(n = 3) { return Object.values(s.players).filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, n); },
      allTimeTop(n = 7) { return Object.values(s.allTime).sort((a, b) => b.score - a.score).slice(0, n); },
      /** the command a player would type (the first name) */
      commandName: (name) => cmds[name][0],
    };
  }

  C.game = game;
  C.game.points = points;
})();
