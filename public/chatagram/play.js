// Chatagram's overlay: reads chat, runs the game (game.js) and draws it (play.css). docs/widgets.md, "The overlay".
//
// One timer drives the game (set for game.nextWake()), one updates the clock once a second while a round is on;
// animations are Web Animations on transform and opacity only, skipped with reduced motion. The game is saved to this
// browser (OBS keeps it) so a refresh carries on where it was.
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
  W.theme.listen(board);
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
  const game = C.game(cfg, { dict, seeds, now, random: still ? seeded : Math.random, emit: (e) => queue.push(e) });
  const SAVE = `chatagram:v1:${channels.twitch}|${channels.kick}`;
  let saved = null;
  if (!demo && !still) try { saved = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch {}
  let saveTimer = null;
  const save = () => { if (demo || still || saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { localStorage.setItem(SAVE, JSON.stringify(game.snapshot())); } catch {} }, 800); };

  // ---- drawing: the tiles ---------------------------------------------------------------------------------------------
  const tilesEl = $('#tiles');
  const round = () => game.state.round;
  const shows = (l) => (l.id === round().hidden && !round().revealed ? '?' : l.ch);
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
      const t = tilesEl.children[i]; if (!t) return;
      setTimeout(() => { t.classList.add('lit'); anim(t, [{ transform: 'none' }, { transform: 'translateY(-8px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' }); }, rm ? 0 : n * 70);
      setTimeout(() => t.classList.remove('lit'), (rm ? 0 : idx.length * 70) + 650);
    });
  }

  // ---- drawing: the countdown and padlocks ---------------------------------------------------------------------------
  const fill = $('.bar .fill'), clockEl = $('#clock'), locksEl = $('#locks');
  let barAnim = null, clockTimer = null;
  function drawTimer() {
    const r = round(); if (!r) return;
    const total = r.endsAt - r.startedAt, left = Math.max(0, r.endsAt - now());
    if (barAnim) barAnim.cancel();
    fill.style.transform = `scaleX(${left / total})`;
    barAnim = still || rm ? null : fill.animate([{ transform: `scaleX(${left / total})` }, { transform: 'scaleX(0)' }], { duration: left, easing: 'linear', fill: 'forwards' });
    locksEl.innerHTML = r.locks.map((t, i) => `<span class="lock${i < r.opened ? ' open' : ''}" style="left:${((t - r.startedAt) / total) * 100}%"><svg viewBox="0 0 16 16"><use href="#i-${i < r.opened ? 'unlock' : 'lock'}"/></svg></span>`).join('');
    tickClock();
  }
  function tickClock() {
    const r = round(); if (!r) return;
    const left = Math.max(0, Math.ceil((r.endsAt - now()) / 1000));
    clockEl.textContent = mmss(left);
    const low = game.state.phase === 'playing' && left <= 10;
    if (low && !board.classList.contains('low')) board.classList.add('low');
    if (!low) board.classList.remove('low');
    if (low && left > 0) anim(clockEl, [{ transform: 'scale(1.3)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
    if (rm) fill.style.transform = `scaleX(${Math.max(0, r.endsAt - now()) / (r.endsAt - r.startedAt)})`;
  }
  const runClock = (on) => { clearInterval(clockTimer); clockTimer = on && !still ? setInterval(tickClock, 1000) : null; };

  // ---- drawing: the words (full layout) ---------------------------------------------------------------------------------
  const wordsEl = $('#words');
  function drawWords() {
    const r = round(); if (!r || cfg.layout === 'compact') return;
    const groups = new Map();
    for (const [i, a] of r.answers.entries()) { const k = Math.min(a.word.length, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    wordsEl.innerHTML = '';
    // the largest rows that fit every word in at most 5 columns
    const H = wordsEl.clientHeight - 30;
    let rowH = 20, maxRows = 0, cols = [];
    for (rowH of [28, 25, 22, 20, 18, 16, 14, 12]) {
      maxRows = Math.max(3, Math.floor(H / (rowH + 3)));
      cols = [];
      for (const [len, idx] of groups) for (let c = 0; c * maxRows < idx.length; c++) cols.push({ len, idx: idx.slice(c * maxRows, (c + 1) * maxRows), first: c === 0, all: idx });
      if (cols.length <= 5) break;
    }
    wordsEl.style.setProperty('--rh', rowH + 'px');
    wordsEl.style.gridTemplateColumns = cols.map((c) => `${Math.max(...c.idx.map((i) => r.answers[i].word.length)) + 8}fr`).join(' ');
    for (const c of cols) {
      const got = c.all.filter((i) => r.answers[i].by).length;
      const col = document.createElement('div'); col.className = 'col';
      col.innerHTML = `<h4>${c.first ? `<span>${c.len === 7 ? '7+ LETTERS' : `${c.len} LETTERS`}</span><span data-count="${c.len}">${got}/${c.all.length}</span>` : ''}</h4>` +
        c.idx.map((i) => `<div class="w" data-a="${i}"></div>`).join('');
      wordsEl.appendChild(col);
      const maxLen = Math.max(...c.idx.map((i) => r.answers[i].word.length)), avail = col.clientWidth - 16;
      const cap = rowH - 3;                                         // letter boxes as big as the rows allow
      let cw = Math.min(cap, Math.floor((avail - 100) / maxLen) - 2), names = true;
      if (cw < 11) { names = false; cw = Math.min(cap, Math.floor(avail / maxLen) - 2); }
      col.style.setProperty('--cw', cw + 'px');
      col.classList.toggle('nonames', !names);
      for (const i of c.idx) drawAnswer(i);
    }
  }
  function drawAnswer(i, fresh = false) {
    const a = round().answers[i], el = wordsEl.querySelector(`[data-a="${i}"]`); if (!el) return;
    el.className = 'w' + (a.by ? ' got' : '') + (fresh ? ' new' : '');
    const named = a.by && !el.parentElement.classList.contains('nonames');
    el.innerHTML = `<span class="l">${[...a.word].map((ch) => `<i>${a.by ? esc(ch) : ''}</i>`).join('')}</span>` + (named ? `<span class="by">${badge(a.by.platform)}<span>${esc(a.by.name)}</span></span>` : '');
    if (fresh) {
      // the find lights up where it lands: it pops out big and gold, letter by letter, then settles and stays gold a while
      anim(el, [{ transform: 'scale(1.7)', transformOrigin: 'left center' }, { transform: 'scale(1.7)', offset: 0.55 }, { transform: 'none' }], { duration: 1300, easing: 'cubic-bezier(.3,.7,.3,1)' });
      [...el.querySelectorAll('.l i')].forEach((b, n) => anim(b, [{ transform: 'translateY(-10px) scale(1.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: n * 60, easing: 'cubic-bezier(.3,.7,.4,1.3)', fill: 'backwards' }));
      setTimeout(() => el.classList.remove('new'), 3500);
      const count = wordsEl.querySelector(`[data-count="${Math.min(a.word.length, 7)}"]`);
      if (count) { const all = round().answers.filter((x) => Math.min(x.word.length, 7) === Math.min(a.word.length, 7)); count.textContent = `${all.filter((x) => x.by).length}/${all.length}`; }
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
  function scramble(el, word, suffix) {
    if (rm) { el.innerHTML = esc(word) + suffix; return; }
    let n = 0; const L = 'abcdefghijklmnopqrstuvwxyz';
    const iv = setInterval(() => {
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
    const total = (s.phase === 'cleared' ? cfg.next : cfg.restart) * 1000, left = Math.max(0, Math.ceil((s.nextAt - now()) / 1000)), c = 2 * Math.PI * 15;
    return `<div class="next"><svg class="ring" viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, s.nextAt - now()) / total)}"/><text x="18" y="18">${left}</text></svg>${label.replace('{s}', `<span class="secs">${left}</span>`)}</div>`;
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
        back.innerHTML = head + `<div class="row3">${r.mvps.slice(0, 3).map((p, i) => `<div class="pcard"><small>${['MVP', '2ND', '3RD'][i]}</small><span class="who">${badge(p.platform)}${esc(p.name)}</span><b>${p.pts}</b></div>`).join('')}</div>` + nextLine(label);
      } else {
        back.innerHTML = head + `<div class="kpis"><div class="kpi"><small>WORDS</small><b>${r.found}<i>/${r.total}</i></b></div><div class="kpi"><small>GOAL</small><b>${r.goal} <span class="ok">✓ beat</span></b></div><div class="kpi"><small>TIME LEFT</small><b>${mmss(r.timeLeft)}</b></div><div class="kpi"><small>PLAYERS</small><b>${r.players}</b></div></div>` +
          `<div class="two"><div class="box"><h4><span>ROUND MVPS</span><span>PTS</span></h4>${ranks(r.mvps)}</div><div class="box">${splitBox(r.split) || highlights(r.highlights)}${r.missed.length ? `<h4 style="margin-top:6px"><span>MISSED</span></h4><div class="missed">${r.missed.slice(0, 12).map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}${nextLine(label + ': longer words')}</div></div>`;
      }
    } else if (s.phase === 'over' && g) {
      const head = `<div class="sum-head"><div class="sum-title"><small>Level ${g.level} · goal missed, ${r.found} of ${r.goal}</small><b>Game over</b></div>${starsHtml(r.stars)}</div>`;
      const label = 'New game in {s} s';
      if (compact) {
        back.innerHTML = head + `<div class="row3">${g.mvps.slice(0, 2).map((p, i) => `<div class="pcard"><small>${['MVP', '2ND'][i]}</small><span class="who">${badge(p.platform)}${esc(p.name)}</span><b>${p.pts}</b></div>`).join('')}${g.best ? `<div class="pcard"><small>BEST WORD</small><span class="who">${esc(g.best.word.toUpperCase())}</span><span class="who" style="font-weight:600">${badge(g.best.platform)}${esc(g.best.name)}</span></div>` : ''}</div>` + nextLine(label);
      } else {
        back.innerHTML = head + `<div class="kpis"><div class="kpi"><small>REACHED</small><b>Level ${g.level}</b></div><div class="kpi"><small>WORDS, ALL LEVELS</small><b>${g.words}</b></div><div class="kpi"><small>BEST WORD</small><b>${g.best ? esc(g.best.word) : '–'}</b></div><div class="kpi"><small>PLAYERS</small><b>${g.players}</b></div></div>` +
          `<div class="two"><div class="box"><h4><span>GAME MVPS</span><span>PTS</span></h4>${ranks(g.mvps)}</div><div class="box"><h4><span>THE ONE THAT GOT AWAY</span></h4><div class="missed">${g.away.map((w, i) => `<span class="${i ? '' : 'best'}">${esc(w)}</span>`).join('')}</div><div style="margin-top:6px"></div>${splitBox(g.split) || highlights(r.highlights)}${nextLine(label)}</div></div>`;
      }
    }
  }
  let sumTimer = null;
  // the countdown ring drains smoothly to the moment the next level / game starts (one animation, no ticking); only the
  // number inside changes each second. Reduced motion: the ring steps once a second instead.
  let ringAnim = null;
  function runRing() {
    if (ringAnim) { ringAnim.cancel(); ringAnim = null; }
    const fg = back.querySelector('.ring .fg'), s = game.state; if (!fg || !s.nextAt || still) return;
    const c = +fg.getAttribute('stroke-dasharray'), total = (s.phase === 'cleared' ? cfg.next : cfg.restart) * 1000, left = Math.max(0, s.nextAt - now());
    if (!rm && fg.animate) ringAnim = fg.animate([{ strokeDashoffset: c * (1 - left / total) }, { strokeDashoffset: c }], { duration: left, easing: 'linear', fill: 'forwards' });
  }
  function tickRing() {
    const s = game.state, t = back.querySelector('.ring text'), fg = back.querySelector('.ring .fg'); if (!t || !s.nextAt) return;
    const total = (s.phase === 'cleared' ? cfg.next : cfg.restart) * 1000, leftMs = Math.max(0, s.nextAt - now()), left = Math.ceil(leftMs / 1000);
    t.textContent = left;
    const label = back.querySelector('.next .secs'); if (label) label.textContent = left;
    if (rm && fg) fg.setAttribute('stroke-dashoffset', String(+fg.getAttribute('stroke-dasharray') * (1 - leftMs / total)));
  }
  const runSummaryClock = (on) => { clearInterval(sumTimer); sumTimer = on && !still ? setInterval(tickRing, 250) : null; if (on) runRing(); };

  // ---- the end card: big text over the board, then the summary fades in (no flip: it's calmer on stream) ----------------
  const endEl = $('#endcard');
  let ending = false;
  function showEnd([text, sub, bad]) {
    if (rm) return;
    ending = true; board.classList.remove('summary');
    endEl.className = 'endcard on' + (bad ? ' bad' : '');
    endEl.innerHTML = `<div class="shade"></div><div><div class="txt">${[...text].map((c) => `<span>${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
    anim(endEl.querySelector('.shade'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });
    [...endEl.querySelectorAll('.txt span')].forEach((c, i) => anim(c, [{ transform: 'translateY(40px) scale(.4)', opacity: 0 }, { transform: 'translateY(-8px) scale(1.15)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 480, delay: 120 + i * 45, easing: 'ease-out', fill: 'both' }));
    const subEl = endEl.querySelector('.sub'); if (subEl) anim(subEl, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: 700, fill: 'both' });
  }
  function hideEnd() { ending = false; endEl.className = 'endcard'; endEl.innerHTML = ''; }

  // ---- the message over the board -------------------------------------------------------------------------------------------
  const msg = $('#msg');
  function message(h, p) { msg.innerHTML = h ? `<div><h2>${h}</h2><p>${p}</p></div>` : ''; msg.classList.toggle('on', !!h); }

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
  function onEvent(e) {
    switch (e.type) {
      case 'round':
        recent.length = 0; drawRecent();
        board.classList.remove('summary', 'low'); hideEnd();
        drawAll(); bannerIdle(); dropTiles(); anim(wordsEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
        break;
      case 'found': {
        const pts = ` <small>+${e.pts}${e.longest ? ' · longest!' : ''}</small>`;
        whoEl.innerHTML = `${shownPlatforms.length > 1 ? badge(e.by.platform) : ''} ${esc(e.by.name)} found`;
        scramble(whatEl, e.word, pts);
        lightTiles(e.tiles);
        drawAnswer(e.index, true);
        recent.unshift({ word: e.word, by: e.by }); recent.length = Math.min(recent.length, 3); drawRecent(true);
        const before = goalEl.parentElement.classList.contains('met');
        drawStats();
        if (!before && goalEl.parentElement.classList.contains('met')) anim(goalEl.parentElement, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 500 });
        if (e.longest) confetti();
        break;
      }
      case 'bonus': whoEl.innerHTML = `${shownPlatforms.length > 1 ? badge(e.by.platform) : ''} ${esc(e.by.name)} found a bonus word`; whatEl.innerHTML = `${esc(e.word)} <small>+1</small>`; drawStats(); break;
      case 'shuffle': rollTiles([...tilesEl.children].map((t) => t.querySelector('.reel b').textContent), round().letters.map(shows)); break;
      case 'reveal': {
        const t = tilesEl.children[e.index]; if (!t) break;
        const a = anim(t, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 200 });
        const swap = () => { t.classList.remove('hidden'); t.firstElementChild.innerHTML = `<b>${esc(round().letters[e.index].ch)}</b>`; anim(t, [{ transform: 'rotateY(-90deg)' }, { transform: 'none' }], { duration: 200 }); };
        if (a) a.onfinish = swap; else swap();
        break;
      }
      case 'fakegone': {
        const t = tilesEl.children[e.index];
        const a = t && anim(t, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px) rotateX(-70deg)', opacity: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
        const redraw = () => drawTiles();
        if (a) a.onfinish = redraw; else redraw();
        break;
      }
      case 'unlock': drawTimer(); { const l = locksEl.children[e.index]; anim(l, [{ transform: 'scale(1)' }, { transform: 'scale(1.5) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 500 }); } break;
      case 'end':
        drawStats(); runClock(false); board.classList.remove('low');
        showEnd(e.phase === 'cleared' ? ['Cleared!', `${e.result.found} of ${e.result.total} words`, false] : [e.result.timeLeft > 0 ? 'Game over' : 'Time’s up!', `${e.result.found} of ${e.result.goal} needed`, true]);
        setTimeout(() => { drawSummary(); hideEnd(); board.classList.add('summary'); runSummaryClock(true); }, rm ? 0 : 2200);
        break;
      case 'skip': break;
      case 'reset': case 'game': case 'phase': case 'resume': drawAll(); break;
    }
  }
  function flush() { while (queue.length) onEvent(queue.shift()); save(); }

  // ---- time --------------------------------------------------------------------------------------------------------------------
  let wake = null;
  function schedule() {
    clearTimeout(wake); wake = null;
    if (still) return;
    const w = game.nextWake();
    if (w !== Infinity) wake = setTimeout(() => { game.tick(); flush(); schedule(); }, Math.max(0, w - now()));
  }

  // ---- chat ---------------------------------------------------------------------------------------------------------------------
  function hear(m) {
    const r = game.handle(m);
    if (r.kind === 'locked' && cfg.lockmsg) bubble(`🔒 ${esc(m.name)}: wait for the padlock`, 'no');
    else if (cfg.wrong && (r.kind === 'dup' || (r.kind === 'wrong' && dict.tierOf.has(r.word)))) bubble(`${esc(m.name)}: ${esc(r.word)}`, 'no');
    flush(); schedule();
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
    else W.chat({ twitch: channels.twitch, kick: channels.kick, kickId: cfg.kickid || undefined }, hear, drawConn);
  }
  document.documentElement.dataset.ready = '1';
  window.chatagram = {
    game, cfg, hear,
    advance(ms) { offset += ms; for (let i = 0; i < 200 && game.nextWake() <= now(); i++) game.tick(); flush(); drawAll(); schedule(); },
  };
})();
