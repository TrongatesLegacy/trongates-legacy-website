// Chatagram's overlay: reads chat, runs the game (game.js) and draws it (play.css). docs/widgets.md, "The overlay".
//
// One timer drives the game (set for game.nextWake()), one updates the clock once a second while a round is on;
// animations are Web Animations on transform and opacity only, skipped with reduced motion. The game is saved to this
// browser (OBS keeps it) so a refresh carries on where it was, and so are the leaderboards (scores.js), in their own
// record. Whether the channel is live comes from Twitch or Kick (see "the stream" below).
//
// Link: the settings (settings.js). Also: demo=1 (a pretend chat plays), still=1&screen=play|cleared|over (a frozen
// moment, for pictures and the set-up page's tabs), motion=reduce|full. window.chatagram is there for tests.
(async () => {
  const W = window.Widgets, C = window.Chatagram;
  const q = new URLSearchParams(location.search);
  const cfg = W.settings.decode(C.settings.SCHEMA, q);
  const demo = q.get('demo') === '1', still = q.get('still') === '1', screen = q.get('screen') || 'play';
  const $ = (sel, el = document) => el.querySelector(sel);
  const board = $('#board'), stage = $('.stage');
  const rm = W.theme.reducedMotion(q);
  if (rm) document.documentElement.classList.add('rm');
  W.theme.apply(board, { theme: cfg.theme, accent: cfg.accent });
  if (cfg.bgo < 100) board.style.setProperty('--bgo', String(cfg.bgo / 100));   // Advanced → Background: see-through
  W.theme.listen(board, () => { fitMissed(); document.fonts && document.fonts.ready.then(() => fitMissed()); });   // a theme's font changes the missed words' widths
  board.classList.toggle('compact', cfg.layout === 'compact');
  const [BW, BH] = C.settings.SIZES[cfg.layout];
  // fill the browser source; any other shape than the layout's is centred (e.g. 960 × 540 fills 1920 × 1080 at exactly 2×)
  const fit = () => { const k = Math.min(innerWidth / BW, innerHeight / BH) || 1; stage.style.transform = `translate(${(innerWidth - BW * k) / 2}px, ${(innerHeight - BH * k) / 2}px) scale(${k})`; };
  addEventListener('resize', fit); fit();

  const channels = { twitch: W.platforms.twitch.channel(cfg.twitch), kick: W.platforms.kick.channel(cfg.kick) };
  const platforms = Object.keys(channels).filter((p) => channels[p]);
  const shownPlatforms = demo || still ? (platforms.length ? platforms : ['twitch', 'kick']) : platforms;
  board.classList.toggle('single', shownPlatforms.length === 1);
  if (!cfg.credit) $('.credit').remove();

  // ---- helpers ----------------------------------------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const badge = (p) => `<span class="pf ${p}"><svg><use href="#i-${p}"/></svg></span>`;
  const anim = (el, frames, opts) => (rm || !el || !el.animate ? null : el.animate(frames, opts));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let rseed = 0x9e3779b9 ^ (still ? 7 : Date.now());
  const seeded = () => { rseed = (rseed + 0x6d2b79f5) >>> 0; let t = rseed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---- the words ----------------------------------------------------------------------------------------------------
  const [wordsText, seedsText] = await Promise.all(['words/words.txt', 'words/seeds.txt'].map((f) => fetch(f).then((r) => r.text())));
  const dict = C.words.parseWords(wordsText), seeds = C.words.parseSeeds(seedsText);

  // ---- the game ------------------------------------------------------------------------------------------------------
  let offset = 0, frozen = 0;                                      // tests move time on; still pictures stop it
  const now = () => (frozen || Date.now()) + offset;
  const queue = [];
  // still pictures (the site's previews, the share image) always show a hand-checked, friendly puzzle
  const STILL_SEEDS = { easy: 'heart', normal: 'garden', hard: 'clovers' };
  // Saved in OBS's browser: the game (as it has always been) and, beside it, the leaderboards. A first run after the
  // leaderboards arrived takes All time from the game's save; All time is still written back into the game's save, so an
  // older overlay reading it (a cached copy) sees the same scores. docs/widgets.md, "Saved data".
  const SAVE = `chatagram:v1:${channels.twitch}|${channels.kick}`, SCORES = `chatagram:scores:v1:${channels.twitch}|${channels.kick}`;
  let saved = null, savedScores = null;
  if (!demo && !still) try { saved = JSON.parse(localStorage.getItem(SAVE) || 'null'); savedScores = JSON.parse(localStorage.getItem(SCORES) || 'null'); } catch {}
  const scores = W.scores(demo || still ? pretendScores() : savedScores, { now, gameAllTime: saved && saved.allTime });
  const game = C.game(cfg, { dict, seeds, now, random: still ? seeded : Math.random, emit: (e) => queue.push(e), award: (m, pts, words) => scores.award(m, pts, words), firstSeed: /^[a-z]{3,9}$/.test(q.get('seed') || '') ? q.get('seed') : still ? STILL_SEEDS[cfg.diff] : null });   // seed=: the first puzzle's word (the trailer), if it's a real seed
  let saveTimer = null;
  const writeSaves = () => { try { game.state.allTime = scores.allTime; localStorage.setItem(SAVE, JSON.stringify(game.snapshot())); localStorage.setItem(SCORES, JSON.stringify(scores.record)); } catch {} };
  const save = () => { if (demo || still || saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; writeSaves(); }, 800); };
  // the set-up preview and still pictures: a made-up leaderboard, live (every name is made up)
  function pretendScores() {
    const t = now(), pf = (i) => (shownPlatforms.length > 1 ? shownPlatforms[i % 2] : shownPlatforms[0] || 'twitch');
    const list = (rows) => Object.fromEntries(rows.map(([name, score, words], i) => [`${pf(i)}:${name.toLowerCase()}`, { name, platform: pf(i), score, words }]));
    return { v: 1, status: 'live', checkedAt: t, primary: pf(0), log: [],
      allTime: list([['NeonNacho', 761, 212], ['CaptainQuack', 688, 190], ['PixelPanda', 502, 141], ['ByteSizeBea', 344, 97], ['SleepyWaffle', 305, 88]]),
      stream: { ids: { [pf(0)]: 'pretend' }, started: t - 3600000, lastSeen: t, players: list([['CaptainQuack', 46, 14], ['NeonNacho', 38, 11], ['SleepyWaffle', 30, 9], ['LunaLlama', 22, 6], ['TurboTofu', 16, 5]]) } };
  }

  // ---- drawing: the tiles ---------------------------------------------------------------------------------------------
  const tilesEl = $('#tiles');
  const round = () => game.state.round;
  const shows = (l) => (round().hidden.indexOf(l.id) >= round().shown ? '?' : l.ch);   // a hidden letter not shown yet
  function tileSize() {
    const n = round() ? round().letters.length : 9, avail = BW - (cfg.layout === 'compact' ? 28 : 40), gap = cfg.layout === 'compact' ? 8 : 9;
    const tw = Math.min(cfg.layout === 'compact' ? 58 : 60, Math.floor((avail - gap * (n - 1)) / n));
    tilesEl.style.setProperty('--tw', tw + 'px');
    tilesEl.style.setProperty('--th', (cfg.layout === 'compact' ? 58 : 62) + 'px');
  }
  function drawTiles(letters = round().letters.map(shows)) {
    tileSize();
    tilesEl.innerHTML = letters.map((ch, i) => `<div class="tile${ch === '?' ? ' hidden' : ''}" data-i="${i}"><div class="reel"><b>${esc(ch)}</b></div></div>`).join('');
  }
  // the shuffle: each tile's strip rolls down through 0–2 other letters to its new one, like WOS
  function rollTiles(from, to) {
    const th = cfg.layout === 'compact' ? 58 : 62, pool = [...new Set(to)];
    [...tilesEl.children].forEach((tile, i) => {
      const a = from[i], b = to[i], reel = tile.firstElementChild;
      tile.classList.toggle('hidden', b === '?');
      if (a === b || rm) { reel.innerHTML = `<b>${esc(b)}</b>`; return; }
      const mids = Array.from({ length: Math.floor(Math.random() * 3) }, () => pool[Math.floor(Math.random() * pool.length)]);
      const strip = [b, ...mids, a];
      reel.innerHTML = strip.map((c) => `<b>${esc(c)}</b>`).join('');
      const steps = strip.length - 1, d = 100 * steps + 140;
      const a1 = anim(reel, [{ transform: `translateY(${-steps * th}px)`, filter: 'blur(1.4px)' }, { transform: `translateY(${-th * 0.35}px)`, filter: 'blur(.8px)', offset: 0.7 }, { transform: 'translateY(0)', filter: 'blur(0)' }],
        { duration: d, delay: Math.random() * 60, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'backwards' });
      const done = () => { reel.innerHTML = `<b>${esc(b)}</b>`; };
      if (a1) a1.onfinish = done; else done();
    });
  }
  function dropTiles() {
    [...tilesEl.children].forEach((t, i) => anim(t, [{ transform: `translateY(-90px) rotate(${(i % 2 ? 1 : -1) * (8 + i * 3)}deg)`, opacity: 0 }, { transform: 'translateY(6px)', opacity: 1, offset: 0.75 }, { transform: 'none', opacity: 1 }],
      { duration: 520, delay: i * 70, easing: 'cubic-bezier(.3,.7,.4,1.2)', fill: 'backwards' }));
  }
  function lightTiles(idx) {
    idx.forEach((i, n) => {
      const t = tilesEl.children[i]; if (!t || t.classList.contains('hidden')) return;   // a ? never lights up (it'd give it away)
      setTimeout(() => { t.classList.add('lit'); anim(t, [{ transform: 'none' }, { transform: 'translateY(-8px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' }); }, rm ? 0 : n * 70);
      setTimeout(() => t.classList.remove('lit'), (rm ? 0 : idx.length * 70) + 650);
    });
  }

  // ---- drawing: the countdown and padlocks ---------------------------------------------------------------------------
  const fill = $('.bar .fill'), clockEl = $('#clock'), locksEl = $('#locks');
  let barAnim = null, clockTimer = null;
  function drawTimer() {
    const r = round(); if (!r) return;
    const total = r.endsAt - r.startedAt, left = Math.max(0, r.endsAt - game.clock());
    if (barAnim) barAnim.cancel();
    fill.style.transform = `scaleX(${left / total})`;
    barAnim = still || rm || game.held || game.state.phase !== 'playing' ? null : fill.animate([{ transform: `scaleX(${left / total})` }, { transform: 'scaleX(0)' }], { duration: left, easing: 'linear', fill: 'forwards' });
    locksEl.innerHTML = r.locks.map((t, i) => `<span class="lock${i < r.opened ? ' open' : ''}" style="left:${((t - r.startedAt) / total) * 100}%"><svg viewBox="0 0 16 16"><use href="#i-${i < r.opened ? 'unlock' : 'lock'}"/></svg></span>`).join('');
    tickClock();
  }
  function tickClock() {
    const r = round(); if (!r) return;
    const left = Math.max(0, Math.ceil((r.endsAt - game.clock()) / 1000));
    clockEl.textContent = mmss(left);
    const low = game.state.phase === 'playing' && left <= 10;
    if (low && !board.classList.contains('low')) board.classList.add('low');
    if (!low) board.classList.remove('low');
    if (low && left > 0 && !game.held) anim(clockEl, [{ transform: 'scale(1.3)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
    if (rm) fill.style.transform = `scaleX(${Math.max(0, r.endsAt - game.clock()) / (r.endsAt - r.startedAt)})`;
  }
  const runClock = (on) => { clearInterval(clockTimer); clockTimer = on && !still ? setInterval(tickClock, 1000) : null; };

  // ---- drawing: the words (full layout) ---------------------------------------------------------------------------------
  const wordsEl = $('#words');
  // Columns by length, but the longest lengths share one "N+" column when they only have a few boxes, so a board of
  // mostly short words isn't split into thin, near-empty columns. Merges from the longest end while there are more than
  // three columns and the merged column stays small (6 boxes or fewer); 3- and 4-letter words always keep their own.
  let groupStart = 99;
  function planGroups() {
    const r = round(), count = new Map();
    for (const a of r.answers) count.set(a.word.length, (count.get(a.word.length) || 0) + 1);
    const lens = [...count.keys()].sort((a, b) => a - b);
    groupStart = 99;
    // try "5+", "6+"…: the lowest start whose merged column stays small, as long as that still leaves 3+ columns
    for (const start of lens.filter((l) => l >= 5)) {
      const merged = lens.filter((l) => l >= start).reduce((n, l) => n + count.get(l), 0);
      const cols = lens.filter((l) => l < start).length + 1;
      if (merged <= 6 && cols >= 3 && cols < lens.length) { groupStart = start; break; }
    }
  }
  const groupOf = (len) => (len >= groupStart ? groupStart : Math.min(len, 7));
  const groupLabel = (g, short) => (g === groupStart || g === 7 ? `${g}+` : `${g}`) + (short ? '' : ' LETTERS');
  function drawWords() {
    const r = round(); if (!r || cfg.layout === 'compact') return;
    planGroups();
    const groups = new Map();
    for (const [i, a] of r.answers.entries()) { const k = groupOf(a.word.length); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    for (const idx of groups.values()) idx.sort((x, y) => r.answers[x].word.length - r.answers[y].word.length);
    wordsEl.innerHTML = '';
    // The biggest letter boxes where every column really fits the board's width: names beside the words if at all possible,
    // otherwise without names. Each column's width is measured (letters + name), not guessed, so a big puzzle never ends
    // up squeezed into thin stacks with the rest of the board empty.
    const W = wordsEl.clientWidth, H = wordsEl.clientHeight - 30, GAP = 8, PAD = 16;
    let plan = null;
    for (const names of [true, false]) {
      for (const rowH of [28, 25, 22, 20, 18, 16, 14, 12, 10]) {
        const cw = rowH - 3, maxRows = Math.max(2, Math.floor(H / (rowH + 3))), nameW = names ? Math.round(rowH * 4.6) + 20 : 0;
        const cols = [];
        for (const [len, idx] of groups) for (let c = 0; c * maxRows < idx.length; c++) {
          const part = idx.slice(c * maxRows, (c + 1) * maxRows), maxLen = Math.max(...part.map((i) => r.answers[i].word.length));
          cols.push({ len, idx: part, first: c === 0, all: idx, width: PAD + maxLen * (cw + 2) + nameW + (names ? 5 : 0) });
        }
        const total = cols.reduce((t, c) => t + c.width, 0) + GAP * (cols.length - 1);
        if (total <= W && (!names || rowH >= 14)) { plan = { rowH, cw, names, cols }; break; }
      }
      if (plan) break;
    }
    if (!plan) plan = { rowH: 10, cw: 7, names: false, cols: [] };
    const { rowH, cw, names, cols } = plan;
    wordsEl.style.setProperty('--rh', rowH + 'px');
    wordsEl.style.setProperty('--cw', cw + 'px');
    // every column gets at least what it needs; spare width is shared out by need
    wordsEl.style.gridTemplateColumns = cols.map((c) => `minmax(${c.width}px, ${c.width}fr)`).join(' ');
    for (const c of cols) {
      const got = c.all.filter((i) => r.answers[i].by).length;
      const col = document.createElement('div'); col.className = 'col' + (names ? '' : ' nonames');
      const label = groupLabel(c.len, c.width < 125);   // narrow columns: just the length
      col.innerHTML = `<h4>${c.first ? `<span>${label}</span><span data-count="${c.len}">${got}/${c.all.length}</span>` : ''}</h4>` +
        c.idx.map((i) => `<div class="w" data-a="${i}"></div>`).join('');
      wordsEl.appendChild(col);
      for (const i of c.idx) drawAnswer(i);
    }
  }
  function drawAnswer(i, fresh = false) {
    const a = round().answers[i], el = wordsEl.querySelector(`[data-a="${i}"]`); if (!el) return;
    el.className = 'w' + (a.by ? ' got' : '') + (fresh ? ' new' : '');
    const named = a.by && !el.parentElement.classList.contains('nonames');
    el.innerHTML = `<span class="l">${[...a.word].map((ch) => `<i>${a.by ? esc(ch) : ''}</i>`).join('')}</span>` + (named ? `<span class="by">${badge(a.by.platform)}<span>${esc(a.by.name)}</span></span>` : '');
    if (fresh) {
      // the find lights up where it lands: it pops out big and gold, then settles and stays gold a while
      // one animation on the whole word (the letters never move on their own, so they can't overlap)
      anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.6)', offset: 0.18 }, { transform: 'scale(1.6)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 1400, easing: 'cubic-bezier(.3,.7,.3,1)' });
      setTimeout(() => el.classList.remove('new'), 3500);
      const count = wordsEl.querySelector(`[data-count="${groupOf(a.word.length)}"]`);
      if (count) { const all = round().answers.filter((x) => groupOf(x.word.length) === groupOf(a.word.length)); count.textContent = `${all.filter((x) => x.by).length}/${all.length}`; }
    }
  }

  // ---- drawing: header, footer, recent finds --------------------------------------------------------------------------
  const whoEl = $('#who'), whatEl = $('#what'), goalEl = $('#goal'), levelEl = $('#level');
  function drawStats() {
    const r = round(); if (!r) return;
    const found = r.answers.filter((a) => a.by).length;
    goalEl.innerHTML = `${found}<i>/${r.goal}</i>`;
    goalEl.parentElement.classList.toggle('met', found >= r.goal);
    levelEl.textContent = game.state.level;
    if (cfg.layout === 'compact') $('#foot-left').textContent = `${found} of ${r.answers.length} words found`;
    else if (cfg.top) {
      const top = game.top(3);
      $('#foot-left').innerHTML = top.length ? `<span class="top">TOP: ${top.map((p) => `<span><b>${esc(p.name)}</b> ${p.score}</span>`).join('')}</span>` : '';
    }
  }
  function bannerIdle() {
    const r = round();
    whoEl.innerHTML = `Level ${game.state.level}`;
    whatEl.innerHTML = `<span class="hint">${cfg.layout === 'compact' ? 'Type words in chat!' : `Find words with these letters · the longest has ${r.seed.length}`}</span>`;
  }
  // one scramble at a time: a new find cancels the one before, so the banner always ends on the newest word
  let scrambleTimer = null;
  function scramble(el, word, suffix) {
    clearInterval(scrambleTimer);
    if (rm) { el.innerHTML = esc(word) + suffix; return; }
    let n = 0; const L = 'abcdefghijklmnopqrstuvwxyz';
    const iv = scrambleTimer = setInterval(() => {
      n++;
      el.innerHTML = esc([...word].map((c, i) => (i < n / 2 ? c : L[Math.floor(Math.random() * 26)])).join('')) + suffix;
      if (n / 2 >= word.length) { clearInterval(iv); el.innerHTML = esc(word) + suffix; }
    }, 28);
  }
  const recent = [];
  function drawRecent(fresh = false) {
    $('#recent').innerHTML = `<span class="rl">Recent</span>` + recent.map((f) => `<span class="rf"><b>${esc(f.word)}</b>${badge(f.by.platform)}${esc(f.by.name)}</span>`).join('');
    const first = $('#recent .rf');
    if (fresh && first) anim(first, [{ transform: 'scale(1.5)', background: 'var(--gold)' }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.3,1)' });
  }
  function drawConn(all) {
    $('#conn').innerHTML = shownPlatforms.map((p) => {
      const st = demo || still ? 'live' : (all[p] && all[p].state) || 'connecting';
      return `<span title="${esc(st)}"><i class="dot ${st === 'live' ? 'live' : st === 'error' ? 'error' : ''}"></i>${badge(p)}${W.platforms[p].label}${st === 'error' ? ' · not found' : ''}</span>`;
    }).join('');
  }

  // ---- bubbles and confetti -----------------------------------------------------------------------------------------------
  const bubblesEl = $('#bubbles'), fx = $('#fx');
  function bubble(html, cls = '') {
    if (still) return;
    const b = document.createElement('div'); b.className = 'bubble ' + cls; b.innerHTML = html;
    b.style.left = `${14 + Math.random() * 72}%`;
    bubblesEl.appendChild(b);
    while (bubblesEl.children.length > 4) bubblesEl.firstElementChild.remove();
    const a = anim(b, [{ transform: 'translate(-50%, 10px) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%, -30px)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%, -40px)', opacity: 0 }], { duration: 2000, easing: 'ease-out' });
    if (a) a.onfinish = () => b.remove(); else setTimeout(() => b.remove(), 1500);
  }
  function confetti() {
    if (rm) return;
    const colours = ['var(--accent)', 'var(--gold)', '#53fc18', '#9146ff', '#ff5a5f', '#4f8cff'];
    for (let i = 0; i < 28; i++) {
      const c = document.createElement('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = colours[i % colours.length];
      fx.appendChild(c);
      const a = anim(c, [{ transform: `translateY(0) rotate(0)` }, { transform: `translate(${(Math.random() - 0.5) * 120}px, ${BH + 30}px) rotate(${Math.random() * 720}deg)` }], { duration: 1200 + Math.random() * 900, delay: Math.random() * 200, easing: 'cubic-bezier(.2,.6,.4,1)' });
      if (a) a.onfinish = () => c.remove();
    }
    anim($('.front'), [{ boxShadow: 'var(--edge), 0 0 0 0 transparent' }, { boxShadow: 'var(--edge), 0 0 40px 8px var(--accent)' }, { boxShadow: 'var(--edge), 0 0 0 0 transparent' }], { duration: 1100 });
  }

  // ---- the summary (the card's back) --------------------------------------------------------------------------------------
  const back = $('.back');
  const starsHtml = (n) => `<div class="stars">${'★'.repeat(n)}<i>${'★'.repeat(3 - n)}</i></div>`;
  const nextLine = (label) => {
    const s = game.state;
    if (!s.nextAt) return `<div class="next">Type <b>${esc(game.commandName(s.phase === 'cleared' ? 'next' : 'start'))}</b> ${s.phase === 'cleared' ? 'for the next level' : 'to play again'}</div>`;
    const total = (s.phase === 'cleared' ? cfg.next : cfg.restart) * 1000, left = Math.max(0, Math.ceil((s.nextAt - game.clock()) / 1000)), c = 2 * Math.PI * 15;
    return `<div class="next"><svg class="ring" viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, s.nextAt - game.clock()) / total)}"/><text x="18" y="18">${left}</text></svg>${label.replace('{s}', `<span class="secs">${left}</span>`)}</div>`;
  };
  const ranks = (list) => list.map((p, i) => `<div class="rank"><span class="n">${i + 1}</span>${shownPlatforms.length > 1 ? badge(p.platform) : '<span></span>'}<span class="nm">${esc(p.name)}</span><span class="ws">${p.words} word${p.words === 1 ? '' : 's'}</span><span class="pts">${p.pts}</span></div>`).join('') || '<div class="hl">Nobody scored this time</div>';
  function splitBox(split) {
    if (shownPlatforms.length < 2) return '';
    const t = split.twitch || 0, k = split.kick || 0, all = t + k || 1;
    const words = (n) => `${n} word${n === 1 ? '' : 's'}`;
    return `<h4><span>TWITCH VS KICK</span></h4><div class="splitl"><span>${badge('twitch')} <b>${words(t)}</b></span><span><b>${words(k)}</b> ${badge('kick')}</span></div><div class="split"><span class="twitch" style="width:${(t / all) * 100}%"></span><span class="kick" style="width:${(k / all) * 100}%"></span></div>`;
  }
  function highlights(h) {
    const rows = [h.fastest && ['Fastest find', `${esc(h.fastest.name)} · ${esc(h.fastest.word.toUpperCase())} in ${h.fastest.secs} s`], h.streak && ['Longest streak', `${esc(h.streak.name)} · ${h.streak.n} in a row`], h.save && ['Last-second save', `${esc(h.save.name)} · ${esc(h.save.word.toUpperCase())}`]].filter(Boolean);
    return rows.length ? `<h4><span>ROUND HIGHLIGHTS</span></h4>` + rows.map(([a, b]) => `<div class="hl"><span>${a}</span><b>${b}</b></div>`).join('') : '';
  }
  function drawSummary() {
    const s = game.state, r = s.result; if (!r) return;
    back.classList.toggle('over', s.phase === 'over');
    const g = s.gameResult, compact = cfg.layout === 'compact';
    if (s.phase === 'cleared') {
      const head = `<div class="sum-head"><div class="sum-title"><small>Level ${r.level} complete${compact ? ` · ${r.found} of ${r.total} words` : ''}</small><b>Cleared!</b>${compact ? '' : ` ${r.found} of ${r.total} words`}</div>${starsHtml(r.stars)}</div>`;
      const label = `Level ${r.level + 1} in {s} s`;
      if (compact) {
        back.innerHTML = head + `<div class="row3">${r.mvps.slice(0, 3).map((p, i) => `<div class="pcard"><small>${['MVP', '2ND', '3RD'][i]}</small><span class="who">${badge(p.platform)}${esc(p.name)}</span><b>${p.pts}</b></div>`).join('')}</div>` + LB_SEC + nextLine(label);
      } else {
        back.innerHTML = head + `<div class="kpis"><div class="kpi"><small>WORDS</small><b>${r.found}<i>/${r.total}</i></b></div><div class="kpi"><small>GOAL</small><b>${r.goal} <span class="ok">✓ beat</span></b></div><div class="kpi"><small>TIME LEFT</small><b>${mmss(r.timeLeft)}</b></div><div class="kpi"><small>PLAYERS</small><b>${r.players}</b></div></div>` +
          `<div class="two"><div class="box"><h4><span>ROUND MVPS</span><span>PTS</span></h4>${ranks(r.mvps)}${missedSec('MISSED', r.missed)}</div><div class="box">${splitBox(r.split) || highlights(r.highlights)}${LB_SEC}${nextLine(label + ': longer words')}</div></div>`;
      }
    } else if (s.phase === 'over' && g) {
      const head = `<div class="sum-head"><div class="sum-title"><small>Level ${g.level} · goal missed, ${r.found} of ${r.goal}</small><b>Game over</b></div>${starsHtml(r.stars)}</div>`;
      const label = 'New game in {s} s';
      if (compact) {
        back.innerHTML = head + `<div class="row3">${g.mvps.slice(0, 2).map((p, i) => `<div class="pcard"><small>${['MVP', '2ND'][i]}</small><span class="who">${badge(p.platform)}${esc(p.name)}</span><b>${p.pts}</b></div>`).join('')}${g.best ? `<div class="pcard"><small>BEST WORD</small><span class="who">${esc(g.best.word.toUpperCase())}</span><span class="who" style="font-weight:600">${badge(g.best.platform)}${esc(g.best.name)}</span></div>` : ''}</div>` + LB_SEC + nextLine(label);
      } else {
        back.innerHTML = head + `<div class="kpis"><div class="kpi"><small>REACHED</small><b>Level ${g.level}</b></div><div class="kpi"><small>WORDS, ALL LEVELS</small><b>${g.words}</b></div><div class="kpi"><small>BEST WORD</small><b>${g.best ? esc(g.best.word) : '–'}</b></div><div class="kpi"><small>PLAYERS</small><b>${g.players}</b></div></div>` +
          `<div class="two"><div class="box"><h4><span>GAME MVPS</span><span>PTS</span></h4>${ranks(g.mvps)}${missedSec('THE ONE THAT GOT AWAY', g.away)}</div><div class="box">${splitBox(g.split) || highlights(r.highlights)}${LB_SEC}${nextLine(label)}</div></div>`;
      }
    }
    fillLbSec(); fitMissed();
  }
  // the missed words, at the foot of the MVPs' column (longest first, the first one biggest): as many as fit, the rest
  // counted in a "+N more". Measured, so short words show more; again once fonts load and when the theme changes.
  const missedSec = (title, words) => words.length ? `<div class="missed-sec"><h4><span>${title}</span></h4><div class="missed">${words.map((w, i) => `<span class="${i ? '' : 'best'}">${esc(w)}</span>`).join('')}<span class="more" hidden></span></div></div>` : '';
  function fitMissed() {
    const sec = back.querySelector('.missed-sec'); if (!sec) return;
    const col = sec.parentElement, chips = [...sec.querySelectorAll('.missed span:not(.more)')], more = sec.querySelector('.more');
    const over = () => col.scrollHeight > col.clientHeight + 1;
    sec.hidden = false; more.hidden = true; for (const c of chips) c.hidden = false;
    for (let n = chips.length; n > 1 && over(); n--) { chips[n - 1].hidden = true; more.textContent = `+${chips.length - n + 1} more`; more.hidden = false; }
    if (over()) sec.hidden = true;
  }
  document.fonts && document.fonts.ready.then(fitMissed);
  let sumTimer = null;
  // the countdown ring drains smoothly to the moment the next level / game starts (one animation, no ticking); only the
  // number inside changes each second. Reduced motion: the ring steps once a second instead.
  let ringAnim = null;
  function runRing() {
    if (ringAnim) { ringAnim.cancel(); ringAnim = null; }
    const fg = back.querySelector('.ring .fg'), s = game.state; if (!fg || !s.nextAt || still) return;
    const c = +fg.getAttribute('stroke-dasharray'), total = (s.phase === 'cleared' ? cfg.next : cfg.restart) * 1000, left = Math.max(0, s.nextAt - game.clock());
    fg.setAttribute('stroke-dashoffset', String(c * (1 - left / total)));
    if (!rm && !game.held && fg.animate) ringAnim = fg.animate([{ strokeDashoffset: c * (1 - left / total) }, { strokeDashoffset: c }], { duration: left, easing: 'linear', fill: 'forwards' });
  }
  function tickRing() {
    const s = game.state, t = back.querySelector('.ring text'), fg = back.querySelector('.ring .fg'); if (!t || !s.nextAt) return;
    const total = (s.phase === 'cleared' ? cfg.next : cfg.restart) * 1000, leftMs = Math.max(0, s.nextAt - game.clock()), left = Math.ceil(leftMs / 1000);
    t.textContent = left;
    const label = back.querySelector('.next .secs'); if (label) label.textContent = left;
    if (rm && fg) fg.setAttribute('stroke-dashoffset', String(+fg.getAttribute('stroke-dasharray') * (1 - leftMs / total)));
  }
  const runSummaryClock = (on) => { clearInterval(sumTimer); sumTimer = on && !still ? setInterval(tickRing, 250) : null; if (on) runRing(); };

  // ---- the end card: big text over the board, then the summary fades in (no flip: it's calmer on stream) ----------------
  const endEl = $('#endcard');
  let ending = false, lastFoundAt = 0;
  const END_HOLD = 1600;              // ms from the last find to the end card
  function showEnd([text, sub, bad]) {
    if (rm) return;
    ending = true; board.classList.remove('summary');
    endEl.className = 'endcard on' + (bad ? ' bad' : '');
    endEl.innerHTML = `<div class="shade"></div><div class="card-in"><div class="txt">${[...text].map((c) => `<span>${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
    anim(endEl.querySelector('.shade'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });
    anim(endEl.querySelector('.card-in'), [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out', fill: 'both' });
    [...endEl.querySelectorAll('.txt span')].forEach((c, i) => anim(c, [{ transform: 'translateY(40px) scale(.4)', opacity: 0 }, { transform: 'translateY(-8px) scale(1.15)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 480, delay: 120 + i * 45, easing: 'ease-out', fill: 'both' }));
    const subEl = endEl.querySelector('.sub'); if (subEl) anim(subEl, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: 700, fill: 'both' });
  }
  function hideEnd() { ending = false; endEl.className = 'endcard'; endEl.innerHTML = ''; }

  // ---- the message over the board -------------------------------------------------------------------------------------------
  const msg = $('#msg');
  function message(h, p) { msg.innerHTML = h ? `<div><h2>${h}</h2><p>${p}</p></div>` : ''; msg.classList.toggle('on', !!h); }

  // ---- the stream: is the channel live, and which stream is it? (docs/widgets.md, "Leaderboards") ------------------------
  // Asked when the overlay starts, before the leaderboard is shown (unless a live answer is under 2 minutes old), when a
  // round starts (if the last answer is over 5 minutes old) and every 10 minutes while live. Offline and idle: never on
  // its own. The platform that answered "live" last time is asked first; the other only if that one isn't live.
  const ASK_WAIT = 8000, ROUND_ASK = 5 * 60000;
  let asking = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function checkStream() {
    if (still) return null;
    if (demo || !platforms.length) {
      if (demo) scores.checked({ state: 'live', platform: shownPlatforms[0] || 'twitch', id: 'pretend', started: scores.record.stream ? scores.record.stream.started : now() });
      return null;
    }
    if (asking) return asking;
    asking = (async () => {
      const first = scores.record.primary, order = platforms.slice().sort((a, b) => (b === first) - (a === first));
      const states = [];
      for (const p of order) {
        const r = await Promise.race([W.platforms[p].stream(channels[p]), sleep(ASK_WAIT).then(() => ({ state: 'unknown' }))]);
        if (r && r.state === 'live') { scores.checked({ ...r, platform: p }); return; }
        states.push(r ? r.state : 'unknown');
      }
      scores.checked({ state: states.every((x) => x === 'offline') ? 'offline' : 'unknown' });
    })().catch(() => {}).finally(() => { asking = null; if (!demo) writeSaves(); lbChecked(); });
    return asking;
  }

  // ---- the leaderboard: !cg top (docs/widgets.md, "Leaderboards") ---------------------------------------------------------
  // Full layout while a round is on: a panel over the word board (the letters and timer stay, nothing pauses). Full layout
  // on a card (or waiting to start): a bigger popup over a dimmed backdrop, the countdown paused. Compact: it covers the
  // whole widget and every timer pauses. This stream is only shown once a check confirms the stream it belongs to.
  const LB_SHOW = 8000, LB_LATE = 300, LB_GIVE_UP = 3000, LB_MIN_WAIT = 400;
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateOf = (t, short) => { const d = new Date(t); return `${short ? '' : DAYS[d.getDay()] + ' '}${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const wordsN = (n) => `${n} word${n === 1 ? '' : 's'}`;
  let lb = null;
  /** what This stream's half shows: 'stream' | 'last' | 'game' | 'checking' (gaveUp: stop waiting for the answer) */
  function lbView(gaveUp) {
    if (asking && !scores.fresh() && !gaveUp) return { kind: 'checking', list: [] };
    const v = asking && !scores.fresh() ? { kind: 'game' } : scores.view(5);
    return v.kind === 'game' ? { kind: 'game', list: game.top(5) } : v;
  }
  function lbTitle(v, { podium = false, short = false } = {}) {
    if (v.kind === 'last') return podium && !short ? `LAST STREAM’S PODIUM${v.started ? ' · ' + dateOf(v.started) : ''}` : `LAST STREAM${v.started && !(short && podium === 'line') ? ' · ' + dateOf(v.started, short) : ''}`;
    const what = v.kind === 'game' ? 'THIS GAME' : 'THIS STREAM';
    return podium === true ? `${what}’S PODIUM` : what;
  }
  const lbEmpty = (v) => (v.kind === 'last' ? 'Nobody scored last stream' : v.kind === 'game' ? 'No scores yet this game' : v.kind === 'all' ? 'No scores yet' : 'No scores yet this stream');
  const lbSide = (v) => (v.kind === 'last' ? '<span class="off">OFFLINE</span>' : v.kind === 'checking' ? '<span class="chk">Checking stream…</span>' : '<span>PTS</span>');
  function lbRows(v, n, words = true) {
    if (v.kind === 'checking') return '<div class="rank sk"><i></i><i></i><i></i></div>'.repeat(n);
    if (!v.list.length) return `<div class="hl none">${lbEmpty(v)}</div>`;
    const rows = v.list.slice(0, n).map((p, i) => `<div class="rank"><span class="n">${i + 1}</span>${badge(p.platform)}<span class="nm">${esc(p.name)}</span>${words ? `<span class="ws">${wordsN(p.words)}</span>` : '<span></span>'}<span class="pts">${p.score}</span></div>`);
    for (let i = rows.length; i < n; i++) rows.push(`<div class="rank empty"><span class="n">${i + 1}</span><span></span><span class="nm">—</span><span></span><span></span></div>`);
    return rows.join('');
  }
  function lbPodium(v) {
    const place = (i) => {
      const p = v.kind === 'checking' ? null : v.list[i];
      const who = v.kind === 'checking' ? '<div class="who"><i class="skl"></i></div><div class="pp">&nbsp;</div>'
        : p ? `<div class="who">${badge(p.platform)}<span>${esc(p.name)}</span></div><div class="pp">${p.score}<small>${wordsN(p.words)}</small></div>` : '<div class="who"><span>—</span></div><div class="pp">&nbsp;</div>';
      return `<div class="p p${i + 1}">${i ? '' : '<i class="crown"></i>'}${who}<div class="step">${i + 1}</div></div>`;
    };
    return `<div class="pod">${place(1)}${place(0)}${place(2)}</div>`;
  }
  function lbPaused(kind) {
    const s = game.state;
    if (kind === 'play' || !game.held) return '';
    if (s.phase === 'playing') return '<span class="paused">Timer paused</span> · ';
    if (!s.nextAt) return '';
    if (kind === 'cmp') return '<span class="paused">Countdown paused</span> · ';
    return `<span class="paused">${s.phase === 'cleared' ? 'Next level' : 'New game'} countdown paused</span> · `;
  }
  function lbInner(me) {
    const v = lbView(me.gaveUp), all = { kind: 'all', list: scores.allTimeTop(5) }, short = me.kind === 'cmp';
    const list = (x, title) => `<div class="box"><h4><span>${title}</span>${lbSide(x)}</h4>${lbRows(x, 5, !short)}</div>`;
    const cols = cfg.remember ? list(v, lbTitle(v, { short })) + list(all, 'ALL TIME')
      : `<div class="box"><h4><span>${lbTitle(v, { podium: true, short })}</span>${v.kind === 'last' || v.kind === 'checking' ? lbSide(v) : ''}</h4>${lbPodium(v)}</div>` + list(v, lbTitle(v, { short }));
    return `<div class="hd"><b>LEADERBOARD</b><span>${lbPaused(me.kind)}${esc(me.text)} · asked by ${esc(me.by)}</span></div><div class="cols">${cols}</div><div class="lbbar"><i></i></div>`;
  }
  function lbDraw() {
    const me = lb; if (!me) return;
    if (!me.el) {
      me.el = document.createElement('div');
      me.el.className = `lb ${me.kind}${cfg.remember ? '' : ' podium'}`;
      if (me.kind === 'big') { me.wrap = document.createElement('div'); me.wrap.className = 'lbwrap'; me.wrap.innerHTML = '<div class="lbdim"></div>'; me.wrap.appendChild(me.el); board.appendChild(me.wrap); }
      else if (me.kind === 'play') $('.front').appendChild(me.el);
      else board.appendChild(me.el);
      anim(me.wrap || me.el, [{ opacity: 0, transform: me.kind === 'play' ? 'translateY(12px)' : 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }
    if (me.kind === 'play') Object.assign(me.el.style, { left: wordsEl.offsetLeft + 'px', top: wordsEl.offsetTop + 'px', width: wordsEl.offsetWidth + 'px', height: wordsEl.offsetHeight + 'px' });
    me.el.innerHTML = lbInner(me);
    if (me.until) runLbBar();
  }
  // the bar along the bottom: how long it stays
  function runLbBar() {
    const i = lb && lb.el.querySelector('.lbbar i'); if (!i) return;
    const left = Math.max(0, lb.until - Date.now()), k = left / LB_SHOW;
    i.style.transform = `scaleX(${k})`;
    if (!rm && i.animate) i.animate([{ transform: `scaleX(${k})` }, { transform: 'scaleX(0)' }], { duration: left, easing: 'linear', fill: 'forwards' });
  }
  const timersNow = () => { drawTimer(); tickClock(); runRing(); tickRing(); };
  async function showLeaderboard(e) {
    if (lb || still) return;
    const compact = cfg.layout === 'compact', phase = game.state.phase;
    const me = lb = { kind: compact ? 'cmp' : phase === 'playing' && !ending ? 'play' : 'big', by: e.by || 'Streamer', text: e.text || game.commandName('top') || '', el: null, wrap: null, until: 0, gaveUp: false };
    if (me.kind !== 'play' && game.hold(true)) { timersNow(); save(); }
    const ask = scores.fresh() ? null : checkStream();
    if (ask) await Promise.race([ask, sleep(LB_LATE)]);           // a quick answer: the popup opens already showing it
    if (lb !== me) return;
    lbDraw();
    if (asking && !scores.fresh()) {                               // slow: the placeholder shows, for at least LB_MIN_WAIT
      const from = Date.now();
      await Promise.race([asking, sleep(LB_GIVE_UP)]);
      if (lb !== me) return;
      const wait = LB_MIN_WAIT - (Date.now() - from); if (wait > 0) await sleep(wait);
      if (lb !== me) return;
      if (asking) me.gaveUp = true;                                // no answer: this game instead (never an unconfirmed stream)
      lbDraw();
    }
    me.until = Date.now() + LB_SHOW; runLbBar();
    me.timer = setTimeout(hideLeaderboard, LB_SHOW);
  }
  function hideLeaderboard() {
    const me = lb; if (!me) return;
    lb = null; clearTimeout(me.timer);
    const el = me.wrap || me.el;
    const out = el && anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    if (out) out.onfinish = () => el.remove(); else if (el) el.remove();
    if (game.hold(false)) { flush(); timersNow(); schedule(); }
  }
  // an answer arrived: whatever shows the leaderboard catches up
  function lbChecked() { if (lb && lb.el && (lb.gaveUp || lb.until)) { lb.gaveUp = false; lbDraw(); } fillLbSec(); }

  // the standing leaderboard on the cleared and game-over cards (left off when there's no answer: the MVPs show this game)
  const LB_SEC = '<div class="lbsec" hidden></div>';
  function fillLbSec() {
    const el = back.querySelector('.lbsec'); if (!el) return;
    const v = lbView(false);
    if (v.kind === 'game') { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    if (cfg.layout === 'compact') {
      el.innerHTML = `<span class="rl">${lbTitle(v, { short: true, podium: 'line' })}</span>` + (v.kind === 'checking' ? '<span class="rf sk"><i></i></span>'.repeat(3)
        : v.list.length ? v.list.slice(0, 3).map((p, i) => `<span class="rf"><span class="n">${i + 1}</span>${badge(p.platform)}${esc(p.name)} <b>${p.score}</b></span>`).join('') : `<span class="none">${lbEmpty(v)}</span>`);
      return;
    }
    const col = (x, title) => `<div><h5>${title}${x.kind === 'last' ? '<span class="off">OFFLINE</span>' : ''}</h5>${lbRows(x, 5, false)}</div>`;
    el.innerHTML = `<h4><span>LEADERBOARD</span></h4><div class="mini${cfg.remember ? '' : ' one'}">${col(v, lbTitle(v, { short: cfg.remember }))}${cfg.remember ? col({ kind: 'all', list: scores.allTimeTop(5) }, 'ALL TIME') : ''}</div>`;
  }

  // ---- events → drawing -------------------------------------------------------------------------------------------------------
  function drawAll() {
    const s = game.state;
    if (!ending) board.classList.toggle('summary', s.phase === 'cleared' || s.phase === 'over');
    if (s.phase === 'idle') {
      drawTiles('chatagram'.split('')); whoEl.textContent = 'Chatagram'; whatEl.innerHTML = '<span class="hint">Waiting to start</span>';
      message('Waiting to start', `Type <code>${esc(game.commandName('start'))}</code> in chat to play`);
      runClock(false); return;
    }
    message('');
    if (round()) { drawTiles(); drawTimer(); drawWords(); drawStats(); if (!whoEl.textContent) bannerIdle(); }
    if (s.phase === 'playing') runClock(true); else { runClock(false); drawSummary(); }
    runSummaryClock(s.phase !== 'playing');
  }
  let pendingFind = null, findFrame = 0;
  function onEvent(e) {
    switch (e.type) {
      case 'round':
        pendingFind = null;
        recent.length = 0; drawRecent();
        board.classList.remove('summary', 'low'); hideEnd();
        drawAll(); bannerIdle(); dropTiles(); anim(wordsEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
        if (now() - scores.record.checkedAt > ROUND_ASK) checkStream();       // points are coming: know which stream they're for
        break;
      case 'found': {
        lastFoundAt = Date.now();
        drawAnswer(e.index, true);                                   // every find lights up its own slot
        recent.unshift({ word: e.word, by: e.by }); recent.length = Math.min(recent.length, 3);
        // the banner, the letter tiles and the recent chips show only the newest find of a burst (finds arriving in the
        // same moment would otherwise restart them over each other): drawn once, on the next frame
        pendingFind = e;
        if (!findFrame) findFrame = requestAnimationFrame(() => {
          findFrame = 0; const f = pendingFind; if (!f) return; pendingFind = null;
          whoEl.innerHTML = `${shownPlatforms.length > 1 ? badge(f.by.platform) : ''} ${esc(f.by.name)} found`;
          scramble(whatEl, f.word, ` <small>+${f.pts}${f.longest ? ' · longest!' : ''}</small>`);
          lightTiles(f.tiles.length ? f.tiles : []);
          drawRecent(true);
        });
        const before = goalEl.parentElement.classList.contains('met');
        drawStats();
        if (!before && goalEl.parentElement.classList.contains('met')) anim(goalEl.parentElement, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 500 });
        if (e.longest) confetti();
        break;
      }
      case 'bonus': clearInterval(scrambleTimer); whoEl.innerHTML = `${shownPlatforms.length > 1 ? badge(e.by.platform) : ''} ${esc(e.by.name)} found a bonus word`; whatEl.innerHTML = `${esc(e.word)} <small>+1</small>`; drawStats(); break;
      case 'shuffle': rollTiles([...tilesEl.children].map((t) => t.querySelector('.reel b').textContent), round().letters.map(shows)); break;
      case 'reveal': {
        const t = tilesEl.children[e.index]; if (!t) break;
        const a = anim(t, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 200 });
        const swap = () => { t.classList.remove('hidden'); t.firstElementChild.innerHTML = `<b>${esc(round().letters[e.index].ch)}</b>`; anim(t, [{ transform: 'rotateY(-90deg)' }, { transform: 'none' }], { duration: 200 }); };
        if (a) a.onfinish = swap; else swap();
        break;
      }
      case 'unlock': drawTimer(); { const l = locksEl.children[e.index]; anim(l, [{ transform: 'scale(1)' }, { transform: 'scale(1.5) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 500 }); } break;
      case 'end':
        drawStats(); runClock(false); board.classList.remove('low');
        {
          // the last find gets its moment (its highlight) before the end card covers the board
          const hold = rm ? 0 : Math.max(0, END_HOLD - (Date.now() - lastFoundAt));
          const card = e.phase === 'cleared' ? ['Cleared!', `${e.result.found} of ${e.result.total} words`, false] : [e.result.timeLeft > 0 ? 'Game over' : 'Time’s up!', `${e.result.found} of ${e.result.goal} needed`, true];
          ending = true;
          if (!scores.fresh()) checkStream();                         // the card's leaderboard: asked now, ready when it shows
          if (lb && lb.kind === 'play') hideLeaderboard();            // the panel belonged to the round (the card has its own)
          setTimeout(() => showEnd(card), hold);
          setTimeout(() => { drawSummary(); hideEnd(); board.classList.add('summary'); runSummaryClock(true); }, rm ? 0 : hold + 2200);
        }
        break;
      case 'skip': break;
      case 'leaderboard': showLeaderboard(e); break;
      case 'clearscores': scores.clear(); writeSaves(); if (lb) lbDraw(); fillLbSec(); break;
      case 'reset': case 'game': case 'phase': case 'resume': drawAll(); break;
    }
  }
  function flush() { while (queue.length) onEvent(queue.shift()); save(); }

  // ---- time --------------------------------------------------------------------------------------------------------------------
  let wake = null;
  // one timer, for the next thing due; only re-set when that moment changes (a busy chat mustn't churn timers)
  let wakeAt = Infinity;
  function schedule() {
    if (still) return;
    const w = game.nextWake();
    if (w === wakeAt && wake) return;
    clearTimeout(wake); wake = null; wakeAt = w;
    if (w !== Infinity) wake = setTimeout(() => { wake = null; wakeAt = Infinity; game.tick(); flush(); schedule(); }, Math.max(0, w - now()));
  }

  // ---- chat ---------------------------------------------------------------------------------------------------------------------
  function hear(m) {
    const r = game.handle(m);
    if (r.kind === 'locked' && cfg.lockmsg) bubble(`🔒 ${esc(m.name)}: wait for the padlock`, 'no');
    else if (cfg.wrong && (r.kind === 'dup' || (r.kind === 'wrong' && dict.tierOf.has(r.word)))) bubble(`${esc(m.name)}: ${esc(r.word)}`, 'no');
    flush(); schedule();
    // the pretend chat, for the Chatagram page's hero to show beside the game (it draws its own bubbles)
    if (demo && !m.owner && window.parent !== window) try { window.parent.postMessage({ type: 'chatagram-chat', name: m.name, color: m.color, platform: m.platform, text: m.text, found: r.kind === 'found' || r.kind === 'bonus' ? r.word : '', pts: r.pts || 0 }, '*'); } catch {}
    return r;
  }

  // ---- start ----------------------------------------------------------------------------------------------------------------------
  drawConn({});
  const OWNER = { platform: shownPlatforms[0], user: 'streamer', name: 'Streamer', owner: true, mod: true };
  if (still) {
    // a frozen moment: a seeded game, a few finds, then (for the summary tabs) the round's end
    frozen = Date.now();
    game.boot();
    if (game.state.phase === 'idle') game.handle({ ...OWNER, text: game.commandName('start') });
    const say = C.demo(() => game.state, () => {}, { platforms: shownPlatforms, random: seeded, setTimeout: () => 0, clearTimeout: () => {} });
    const r = round(), want = screen === 'cleared' ? r.goal + 2 : screen === 'over' ? Math.max(1, r.goal - 4) : Math.ceil(r.answers.length * 0.4);
    for (let i = 0; i < 400 && r.answers.filter((a) => a.by).length < want; i++) {
      const m = say.message(); offset += 1500;
      if (r.answers.some((a) => a.word === m.text && !a.by)) game.handle(m);
    }
    if (screen !== 'play') { offset = r.endsAt - frozen; game.tick(); } else offset = Math.min(offset, 35000);
    queue.length = 0;
    drawAll();
    if (screen === 'play') { const f = r.answers.filter((a) => a.by).sort((a, b) => b.at - a.at); if (f[0]) { whoEl.innerHTML = `${shownPlatforms.length > 1 ? badge(f[0].by.platform) : ''} ${esc(f[0].by.name)} found`; whatEl.innerHTML = `${esc(f[0].word)} <small>+${f[0].pts}</small>`; recent.push(...f.slice(0, 3).map((a) => ({ word: a.word, by: a.by }))); drawRecent(); } }
    board.classList.toggle('summary', screen !== 'play');
    if (screen !== 'play') for (const f of document.querySelectorAll('.face')) f.style.transition = 'none';
  } else if (!demo && !platforms.length) {
    drawTiles('chatagram'.split('')); whoEl.textContent = 'Chatagram'; runClock(false);
    message('Add your channel', 'Set Chatagram up at <code>trongateslegacy.com/chatagram</code>, then paste the link it gives you');
  } else {
    game.boot(saved);
    flush(); drawAll(); if (game.state.phase === 'playing') { bannerIdle(); dropTiles(); }
    schedule();
    if (demo) {
      C.demo(() => game.state, hear, { platforms: shownPlatforms });
      // with "keep playing" off, the pretend streamer types the command after a few seconds
      setInterval(() => {
        const st = game.state;
        if (st.nextAt) return;
        if (st.phase === 'idle' || st.phase === 'over') hear({ ...OWNER, text: game.commandName('start') });
        else if (st.phase === 'cleared') hear({ ...OWNER, text: game.commandName('next') });
      }, 6000);
    }
    else {
      W.chat({ twitch: channels.twitch, kick: channels.kick, kickId: cfg.kickid || undefined }, hear, drawConn);
      checkStream();
      // while live, ask every 10 minutes (so a crash or a dropped stream is told apart from a new one); offline, never
      setInterval(() => { const d = scores.record; if (d.status === 'live' && now() - d.checkedAt >= W.scores.LIVE_EVERY) checkStream(); }, 60000);
    }
    // the set-up page's preview: its "Show leaderboard" button
    if (demo) addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'chatagram-leaderboard') showLeaderboard({ by: 'Streamer', text: game.commandName('top') || '!cg top' }); });
  }
  document.documentElement.dataset.ready = '1';
  window.chatagram = {
    game, cfg, hear, scores, checkStream,
    leaderboard: { show: (by = 'Streamer', text = '!cg top') => showLeaderboard({ by, text }), hide: hideLeaderboard, get open() { return lb ? { kind: lb.kind, gaveUp: lb.gaveUp, until: lb.until } : null; } },
    advance(ms) { offset += ms; for (let i = 0; i < 200 && game.nextWake() <= now(); i++) game.tick(); flush(); drawAll(); schedule(); },
  };
})();
