// The widgets' leaderboards (docs/widgets.md, "Leaderboards"): All time and This stream, and which stream is on. Rules
// only: the overlay (Chatagram's or Chaplinko's play.js) asks Twitch or Kick whether the channel is live and passes the
// answer to checked(); every point scored comes in through award(). The clock is passed in, so the tests replay any day
// of streams. Each widget keeps its own record under its own key; "words" is what the widget counts beside the points
// (Chatagram: words found; Chaplinko: balls dropped).
//
// Saved as its own record, apart from the game's save (docs/widgets.md, "Saved data"):
//   { v: 1, allTime: { 'platform:user': { name, platform, score, words } },
//     stream: null | { ids: { twitch?, kick? }, started, lastSeen, players: { … as allTime } },
//     log: [[key, name, platform, pts, words, at], …],   points not yet placed in a confirmed stream
//     status: '' | 'live' | 'offline' | 'unknown', checkedAt, primary: '' | 'twitch' | 'kick' }
// New versions only ever add fields: anything saved before always loads.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const SAME = 40 * 60000;          // a new stream id starting within this of the last one seen live: the same stream
  const FRESH = 2 * 60000;          // a live answer younger than this is shown without asking again
  const LIVE_EVERY = 10 * 60000;    // while live, the overlay asks this often (so a stream's end is known to within this)
  const LOG_MAX = 3000;

  const blank = () => ({ v: 1, allTime: {}, stream: null, log: [], status: '', checkedAt: 0, primary: '' });
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);

  /** a saved record (or nothing) → a valid one; a first run takes the all-time scores from the game's own save */
  function load(saved, gameAllTime) {
    const d = blank(), s = obj(saved);
    if (!s) { d.allTime = players(gameAllTime); return d; }
    d.allTime = players(s.allTime);
    const st = obj(s.stream);
    if (st && Number.isFinite(st.started)) d.stream = { ids: { ...obj(st.ids) }, started: st.started, lastSeen: +st.lastSeen || st.started, players: players(st.players) };
    d.log = Array.isArray(s.log) ? s.log.filter((e) => Array.isArray(e) && e.length >= 6).slice(-LOG_MAX) : [];
    d.status = ['live', 'offline', 'unknown'].includes(s.status) ? s.status : '';
    d.checkedAt = +s.checkedAt || 0;
    d.primary = s.primary === 'twitch' || s.primary === 'kick' ? s.primary : '';
    return d;
  }
  /** players kept only if they look right (a bad save must never break the overlay) */
  function players(x) {
    const out = {};
    for (const [k, p] of Object.entries(obj(x) || {})) {
      if (obj(p) && Number.isFinite(p.score)) out[k] = { name: String(p.name || k.split(':')[1] || ''), platform: p.platform === 'kick' ? 'kick' : 'twitch', score: p.score, words: +p.words || 0 };
    }
    return out;
  }
  const add = (list, k, name, platform, pts, words) => {
    const p = list[k] || (list[k] = { name, platform, score: 0, words: 0 });
    p.name = name || p.name; p.score += pts; p.words += words;
  };
  const top = (list, n) => Object.values(list).filter((p) => p.score > 0).sort((a, b) => b.score - a.score || b.words - a.words).slice(0, n);

  /** @param {any} saved  @param {{ now: () => number, gameAllTime?: any }} deps */
  function scores(saved, deps) {
    const now = deps.now;
    const d = load(saved, deps.gameAllTime);

    /** points scored: All time at once; This stream once a check says which stream they belong to */
    function award(m, pts, words) {
      if (!pts && !words) return;
      const k = `${m.platform}:${m.user}`;
      add(d.allTime, k, m.name, m.platform, pts, words);
      d.log.push([k, m.name, m.platform, pts, words, now()]);
      if (d.log.length > LOG_MAX) d.log.splice(0, d.log.length - LOG_MAX);
    }
    // points from the log that fall inside [from, to] go into the stream
    const place = (from, to) => { for (const [k, name, platform, pts, words, at] of d.log) if (at >= from && at <= to) add(d.stream.players, k, name, platform, pts, words); };

    /**
     * a check's answer: { state: 'live', platform, id, started } | { state: 'offline' } | { state: 'unknown' }.
     * A new stream id counts as the same stream when it started within SAME of the last time the old one was seen live
     * (a crash, a dropped connection); otherwise This stream starts again. @returns {boolean} whether This stream restarted
     */
    function checked(res) {
      const t = now();
      let restarted = false;
      if (res && res.state === 'live' && res.id != null) {
        const id = String(res.id), started = Number.isFinite(res.started) ? res.started : t;
        const st = d.stream;
        if (st && st.ids[res.platform] === id) { /* the same stream */ }
        else if (st && started - st.lastSeen <= SAME) st.ids[res.platform] = id;
        else { d.stream = { ids: { [res.platform]: id }, started, lastSeen: t, players: {} }; restarted = true; }
        place(d.stream.started, t);
        d.stream.lastSeen = t;
        d.log = [];
        d.status = 'live'; d.primary = res.platform; d.checkedAt = t;
      } else if (res && res.state === 'offline') {
        // the stream ended some time after it was last seen live: what was scored up to one check later counts (the
        // stream's last minutes); anything after that was off stream (All time only)
        if (d.stream) place(d.stream.started, d.stream.lastSeen + LIVE_EVERY);
        d.log = [];
        d.status = 'offline'; d.checkedAt = t;
      } else {
        d.status = 'unknown'; d.checkedAt = t;                                // nothing reset, nothing placed: asked again later
      }
      return restarted;
    }

    /**
     * what the leaderboard can show now: 'stream' (confirmed live), 'last' (confirmed offline: the last stream's final
     * scores), 'game' (no answer: the caller shows this game instead). Points since the last check are shown with the
     * stream they must belong to (it was live a moment ago and nothing has said otherwise).
     */
    function view(n = 5) {
      if (d.status === 'live' && d.stream) {
        const list = JSON.parse(JSON.stringify(d.stream.players));
        for (const [k, name, platform, pts, words, at] of d.log) if (at >= d.stream.started) add(list, k, name, platform, pts, words);
        return { kind: 'stream', started: d.stream.started, list: top(list, n) };
      }
      if (d.status === 'offline') return { kind: 'last', started: d.stream ? d.stream.started : 0, list: d.stream ? top(d.stream.players, n) : [] };
      return { kind: 'game', list: [] };
    }

    return {
      award, checked, view,
      /** a live answer recent enough to show without asking again */
      fresh: () => d.status === 'live' && now() - d.checkedAt < FRESH,
      allTimeTop: (n = 5) => top(d.allTime, n),
      /** the broadcaster's clear: both leaderboards (the stream itself is still the stream) */
      clear() { d.allTime = {}; d.log = []; if (d.stream) d.stream.players = {}; },
      get record() { return d; },
      get allTime() { return d.allTime; },
    };
  }

  W.scores = scores;
  W.scores.SAME = SAME;
  W.scores.FRESH = FRESH;
  W.scores.LIVE_EVERY = LIVE_EVERY;
})();
