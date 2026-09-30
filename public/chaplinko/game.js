// Chaplinko's rules (docs/widgets.md, "Chaplinko: the game"): chat commands, the queue of balls waiting to drop, scoring
// a landing, big wins, near misses and how busy the board is. No drawing and no timers: the overlay (play.js) asks
// what to drop (take), says where balls landed (land), and passes the clock in, so the tests replay anything exactly.
//
//   const g = Chaplinko.game(cfg, { now, layout, award });   g.handle(message) → what happened
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  const QUEUE_MAX = 600;          // balls waiting: about 30 s at the fastest; drops past this are ignored until it drains
  const TOP_COOLDOWN = 60000;     // viewers share one !drop top a minute (mods and the owner never wait)
  const SPACING = { quiet: 120, busy: 90, frenzy: 50 };   // ms between balls leaving the chute
  const LEVELS = { busy: 15, frenzy: 50 };                // balls on the board (Frenzy also whenever balls are queued)
  const CALM_AFTER = 3000;        // a level only drops after this long below its line (no flicker)
  const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/u;

  /**
   * @param {any} cfg  settings (settings.js)
   * @param {{ now: () => number, layout: any, award?: (m: any, pts: number, balls: number) => void, saved?: any }} deps
   */
  function game(cfg, deps) {
    const now = deps.now, L = deps.layout;
    const values = K.settings.slotValues(cfg);
    const distinct = [...new Set(values)].sort((a, b) => b - a);
    // with every slot worth the same there's no top prize (no card on every landing)
    const top = distinct.length > 1 ? distinct[0] : Infinity, second = distinct.length > 2 ? distinct[1] : -1, high = distinct[Math.floor((distinct.length - 1) / 2)];
    const names = (k) => (cfg[k] || []).map((x) => String(x).toLowerCase());
    const ignore = new Set(names('ignore'));
    const last = new Map();                                   // platform:user → when they last dropped (the cooldown)
    let queue = [], queued = 0, paused = false, topAt = 0, nextAt = 0;
    let level = 'quiet', calmSince = 0;
    // jackpots today (for the card's "the first today"); saved beside the scores
    const today = () => new Date(now()).toDateString();
    let jp = deps.saved && deps.saved.day === today() ? { day: deps.saved.day, n: +deps.saved.jackpots || 0 } : { day: today(), n: 0 };

    const allowed = (m, who) => who === 'all' || m.owner || (who === 'mods' && m.mod);
    /** what a !drop drops: an emote the platform marked, else the first emoji, else a ball */
    function what(m, rest) {
      if (m.emotes && m.emotes.length) { const e = m.emotes[0]; return { kind: 'emote', url: e.url, name: e.name }; }
      const e = EMOJI.exec(rest);
      return e ? { kind: 'emoji', text: e[0] } : null;
    }
    /** which command a message is, if any: the exact names first (!drop top), then the drop itself (!drop anything) */
    function command(text) {
      const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
      for (const k of ['cwipe', 'ctop', 'cpause', 'cresume', 'cclear']) if (names(k).includes(t)) return { k };
      for (const n of names('cdrop')) if (t === n || t.startsWith(n + ' ')) return { k: 'cdrop', rest: text.trim().slice(n.length) };
      return null;
    }

    /** a chat message → { kind: 'drop' | 'command' | 'cooldown' | 'paused' | 'full' | 'ignored' | 'none', … } */
    function handle(m) {
      if (!m || typeof m.text !== 'string') return { kind: 'none' };
      if (ignore.has(String(m.user).toLowerCase())) return { kind: 'ignored' };
      const c = command(m.text);
      if (!c) return { kind: 'none' };
      const by = { platform: m.platform, user: m.user, name: m.name, color: m.color || '' };
      switch (c.k) {
        case 'cwipe': return m.owner ? { kind: 'command', cmd: 'clearscores', by } : { kind: 'ignored' };
        case 'ctop':
          if (!cfg.lb || !allowed(m, cfg.perm)) return { kind: 'ignored' };
          if (!m.mod && !m.owner && now() - topAt < TOP_COOLDOWN) return { kind: 'cooldown' };
          if (!m.mod && !m.owner) topAt = now();
          return { kind: 'command', cmd: 'top', by };
        case 'cpause': if (!allowed(m, cfg.perm)) return { kind: 'ignored' }; paused = true; return { kind: 'command', cmd: 'pause', by };
        case 'cresume': if (!allowed(m, cfg.perm)) return { kind: 'ignored' }; paused = false; return { kind: 'command', cmd: 'resume', by };
        case 'cclear': if (!allowed(m, cfg.perm)) return { kind: 'ignored' }; queue = []; queued = 0; return { kind: 'command', cmd: 'clear', by };
      }
      // !drop
      if (paused) return { kind: 'paused' };
      const key = `${m.platform}:${m.user}`, t = now();
      if (cfg.cool > 0 && last.has(key) && t - last.get(key) < cfg.cool * 1000) return { kind: 'cooldown' };
      if (queued + cfg.balls > QUEUE_MAX) return { kind: 'full' };
      last.set(key, t);
      if (last.size > 5000) last.delete(last.keys().next().value);
      const item = what(m, c.rest || '');
      queue.push({ by, item, left: cfg.balls });
      queued += cfg.balls;
      return { kind: 'drop', by, item, n: cfg.balls };
    }

    /**
     * the balls to drop now, given how many are on the board: one at a time, spaced by the level (faster in Frenzy),
     * never past the most on screen. Each: { by, item }.
     */
    function take(onBoard) {
      const t = now(), out = [];
      updateLevel(onBoard, t);
      if (t < nextAt) return out;
      while (queue.length && onBoard + out.length < cfg.max && t >= nextAt) {
        const q = queue[0];
        out.push({ by: q.by, item: q.item });
        if (--q.left <= 0) queue.shift();
        queued--;
        nextAt = (nextAt && t - nextAt < SPACING[level] ? nextAt : t) + SPACING[level];
        if (level !== 'frenzy') break;                          // one ball a call outside Frenzy (the chute pops each out)
      }
      return out;
    }
    /** when take() will next have something (Infinity: nothing queued) */
    const nextWake = () => (queue.length ? Math.max(nextAt, now()) : Infinity);

    function updateLevel(onBoard, t) {
      const want = onBoard > LEVELS.frenzy || (queued > 0 && onBoard + queued > LEVELS.frenzy) ? 'frenzy' : onBoard + queued > LEVELS.busy ? 'busy' : 'quiet';
      const rank = { quiet: 0, busy: 1, frenzy: 2 };
      if (rank[want] >= rank[level]) { level = want; calmSince = 0; }
      else if (!calmSince) calmSince = t;
      else if (t - calmSince >= CALM_AFTER) { level = want; calmSince = 0; }
      return level;
    }

    /**
     * a ball landed: its points go to whoever dropped it. tier: 'jackpot' (the top slot), 'big' (the second-highest),
     * 'high' (the upper half of the values), 'low'. card: whether the big win card (or toast) shows. near: a near miss
     * (it touched the top slot's edge and fell the other way).
     */
    function land(by, slot, x) {
      const pts = values[slot] ?? 0;
      if (deps.award && by) deps.award(by, pts, 1);
      const tier = pts === top ? 'jackpot' : pts === second ? 'big' : pts >= high && pts > 0 ? 'high' : 'low';
      let card = false, nth = 0;
      if (tier === 'jackpot') {
        if (jp.day !== today()) jp = { day: today(), n: 0 };
        nth = ++jp.n;
        card = cfg.bigwin !== 'off';
      } else if (tier === 'big') card = cfg.bigwin === 'top2';
      let near = false;
      if (cfg.nearmiss && tier !== 'jackpot' && L && x != null) {
        for (const side of [-1, 1]) {
          const other = slot + side; if (values[other] !== top) continue;
          const edge = L.slots.x0 + (side > 0 ? slot + 1 : slot) * L.slots.w;
          if (Math.abs(x - edge) < L.ballR * 0.9) near = true;
        }
      }
      return { pts, slot, tier, card, nth, near };
    }

    /** the chance of each slot, from odds.js: "1 in N" for the card and the set-up page */
    const oneIn = (slot) => { const c = K.odds && K.odds.counts[cfg.rows]; return c && c[slot] ? Math.round(K.odds.drops / c[slot]) : 0; };

    return {
      handle, take, land, nextWake, oneIn, values,
      get level() { return level; },
      get queued() { return queued; },
      get paused() { return paused; },
      clearQueue() { queue = []; queued = 0; },
      snapshot: () => ({ day: jp.day, jackpots: jp.n }),
      top, second,
    };
  }

  K.game = game;
  K.game.QUEUE_MAX = QUEUE_MAX;
  K.game.LEVELS = LEVELS;
  K.game.SPACING = SPACING;
  K.game.CALM_AFTER = CALM_AFTER;
})();
