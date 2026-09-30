// Chaplinko's leaderboard (docs/widgets.md, "Chaplinko: the leaderboard"): This stream and All time, as a panel or a
// strip, used by the separate leaderboard source (leaderboard.html) and inside the board in the combined layout. Climbing
// it is the point, so it's the most animated thing: scores count up, rows slide past each other with the places climbed
// (▲2), a new #1 gets a ball dropped on their name, and with "both" it switches lists every so many seconds, waiting for
// a score that's still moving. When busy it batches: scores count up continuously, rows reorder at most once a second.
// Web Animations on transform and opacity only; reduced motion: every change is instant.
//
//   const lb = Chaplinko.leaderboard(el, { shape, n, show, every, remember, rm, calm, dots });   lb.update(data);
//   data: { stream: { kind: 'stream' | 'last' | 'recent', list }, all: list }   list: [{ key, name, platform, score }]
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  const REORDER = 1000, HOLD = 3000, COUNT = 600;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const fmt = (n) => Math.round(n).toLocaleString('en');
  const TITLES = { stream: 'This stream', last: 'Last stream', recent: 'Recent', all: 'All time' };

  /** @param {HTMLElement} el @param {{ shape?: string, n?: number, show?: string, every?: number, remember?: boolean, rm?: boolean, calm?: boolean, dots?: boolean, cmd?: string, now?: () => number }} o */
  function leaderboard(el, o) {
    const now = o.now || (() => Date.now());
    const strip = o.shape === 'strip', n = strip ? 3 : o.n || 5;
    const lists = !o.remember ? ['stream'] : o.show === 'both' ? ['stream', 'all'] : [o.show === 'all' ? 'all' : 'stream'];
    const anim = (e, frames, opts) => (o.rm || !e || !e.animate ? null : e.animate(frames, opts));
    let data = { stream: { kind: 'stream', list: [] }, all: [] };
    let current = lists[0], changedAt = 0, reorderedAt = 0, reorderTimer = null, switchTimer = null, switchDue = 0;
    const shown = new Map();              // key → { row, score (shown), target, chip, chipN, chipTimer, up, upTimer, counting }
    let order = [], leader = null, glowKey = null, glowUntil = 0;

    el.classList.add('lb', strip ? 'strip' : 'panel');
    el.innerHTML = strip
      ? `<span class="lbl" id="lb-lbl"></span><div class="rows"></div>`
      : `<h2>Leaderboard</h2>${lists.length > 1 ? `<div class="tabs">${lists.map((k) => `<span data-k="${k}">${TITLES[k]}</span>`).join('')}<i class="pill"></i></div><div class="bar"><i></i></div>` : `<div class="one"></div>`}<div class="rows"></div>`;
    const rowsEl = el.querySelector('.rows');

    const title = (k) => (k === 'all' ? TITLES.all : TITLES[data.stream.kind] || TITLES.stream);
    const listOf = (k) => ((k === 'all' ? data.all : data.stream.list) || []).slice(0, n);
    function drawTabs() {
      if (strip) { el.querySelector('.lbl').textContent = title(current); return; }
      const one = el.querySelector('.one');
      if (one) { one.textContent = title(current); return; }
      const tabs = [...el.querySelectorAll('.tabs span')];
      tabs.forEach((t) => { t.textContent = title(t.dataset.k); t.classList.toggle('on', t.dataset.k === current); });
      const on = tabs.find((t) => t.dataset.k === current), pill = el.querySelector('.pill');
      if (on && pill) Object.assign(pill.style, { left: on.offsetLeft + 'px', width: on.offsetWidth + 'px' });
    }
    // the bar under the tabs fills until the next switch
    function runBar(ms) {
      const i = el.querySelector('.bar i'); if (!i) return;
      i.getAnimations && i.getAnimations().forEach((a) => a.cancel());
      i.style.transform = 'scaleX(0)';
      if (!o.rm && i.animate) i.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
      else i.style.transform = 'scaleX(1)';
    }

    function rowHtml(p, i) {
      return `<b class="rk">${i + 1}</b>${o.dots ? `<span class="dot ${p.platform === 'kick' ? 'kk' : 'tw'}"></span>` : ''}<span class="n">${esc(p.name)}</span><span class="up"></span><span class="chip"></span><span class="p">${fmt(p.score)}</span>`;
    }
    function empty() {
      // offline, the stream's list is the last stream's; drops count for All time until the next stream
      const off = current === 'stream' && data.stream.kind === 'last';
      rowsEl.innerHTML = off ? `<div class="empty"><span class="bb"></span>Not live: drops count for All time</div>` : `<div class="empty"><span class="bb"></span>No drops yet. Type <b>${esc(o.cmd || '!drop')}</b></div>`;
      shown.clear(); order = [];
    }

    // count a row's points up to its new value (one rAF loop for every row that's counting; stops when they're done)
    let counting = false;
    function countUp() {
      if (counting) return; counting = true;
      const tick = () => {
        let busy = false; const t = now();
        for (const s of shown.values()) {
          if (s.score === s.target) continue;
          const k = Math.min(1, (t - s.from) / COUNT), v = s.start + (s.target - s.start) * (1 - Math.pow(1 - k, 3));
          s.score = k >= 1 ? s.target : v; s.row.querySelector('.p').textContent = fmt(s.score);
          if (k < 1) busy = true;
        }
        if (busy) requestAnimationFrame(tick); else counting = false;
      };
      requestAnimationFrame(tick);
    }

    /** redraw the shown list: rows reused by player, moved with FLIP, new ones in, gone ones out */
    function draw(fresh) {
      const list = listOf(current);
      drawTabs();
      if (!list.length) { empty(); return; }
      rowsEl.querySelector('.empty')?.remove();
      const before = new Map(); for (const [k, s] of shown) before.set(k, s.row.getBoundingClientRect());
      const oldRank = new Map(order.map((k, i) => [k, i]));
      const keep = new Set(list.map((p) => p.key));
      for (const [k, s] of shown) if (!keep.has(k)) {                                      // pushed out: slides away
        shown.delete(k);
        const a = anim(s.row, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: strip ? 'translateY(10px)' : 'translateX(-24px)' }], { duration: 300, easing: 'ease-in' });
        if (a) a.onfinish = () => s.row.remove(); else s.row.remove();
      }
      list.forEach((p, i) => {
        let s = shown.get(p.key);
        if (!s) {
          const row = document.createElement('div'); row.className = 'row'; row.dataset.key = p.key; row.innerHTML = rowHtml(p, i);
          s = { row, score: p.score, target: p.score, start: p.score, from: 0, chipN: 0 };
          shown.set(p.key, s);
          if (!fresh) anim(row, [{ opacity: 0, transform: strip ? 'translateY(10px)' : 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        }
        rowsEl.appendChild(s.row);                                                         // in rank order
        s.row.querySelector('.rk').textContent = i + 1;
        s.row.querySelector('.n').textContent = p.name;
        if (p.score !== s.target) {                                                        // points went up
          const gained = p.score - s.target;
          s.start = s.score; s.target = p.score; s.from = now();
          if (o.rm) { s.score = s.target; s.row.querySelector('.p').textContent = fmt(s.score); } else countUp();
          chip(s, gained);
          anim(s.row.querySelector('.p'), [{ transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
          if (!strip) s.row.classList.remove('sweep'), void s.row.offsetWidth, o.rm || s.row.classList.add('sweep');
        }
        const was = oldRank.get(p.key);
        if (was !== undefined && was > i) climb(s, was - i);
      });
      order = list.map((p) => p.key);
      // FLIP: every row that moved slides from where it was; a climber lifts above the rest
      if (!fresh) for (const [k, s] of shown) {
        const b = before.get(k); if (!b) continue;
        const a = s.row.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
        if (!dx && !dy) continue;
        const up = strip ? dx > 0 : dy > 0;
        s.row.classList.toggle('lift', up);
        const m = anim(s.row, [{ transform: `translate(${dx}px, ${dy}px)${up && !o.calm ? ' scale(1.04)' : ''}` }, { transform: 'none' }], { duration: 420, easing: o.calm ? 'ease-out' : 'cubic-bezier(.34,1.56,.64,1)' });
        if (m) m.onfinish = () => s.row.classList.remove('lift'); else s.row.classList.remove('lift');
      }
      // a new #1 gets a ball dropped on their name
      if (order[0] !== leader) { if (leader !== null && !fresh && !o.calm) newLeader(shown.get(order[0])); leader = order[0]; }
      if (glowKey && now() < glowUntil) shown.get(glowKey)?.row.classList.add('jp');
    }
    function chip(s, gained) {
      s.chipN += gained;
      const c = s.row.querySelector('.chip'); c.textContent = '+' + fmt(s.chipN); c.classList.add('on');
      clearTimeout(s.chipTimer);
      s.chipTimer = setTimeout(() => { s.chipN = 0; c.classList.remove('on'); }, 1400);
    }
    function climb(s, places) {
      s.up = (s.upOn ? s.up : 0) + places; s.upOn = true;
      const u = s.row.querySelector('.up'); u.textContent = '▲' + s.up; u.classList.add('on');
      clearTimeout(s.upTimer);
      s.upTimer = setTimeout(() => { s.upOn = false; u.classList.remove('on'); }, HOLD);
    }
    function newLeader(s) {
      if (!s) return;
      const b = document.createElement('span'); b.className = 'crown'; s.row.appendChild(b);
      const a = anim(b, [{ transform: 'translateY(-40px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1, offset: 0.45 }, { transform: 'translateY(-10px)', offset: 0.65 }, { transform: 'translateY(0)', offset: 0.8 }, { transform: 'translateY(-3px)', offset: 0.9 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 900, easing: 'ease-in' });
      s.row.classList.remove('shine'); void s.row.offsetWidth; s.row.classList.add('shine');
      setTimeout(() => { b.remove(); s.row.classList.remove('shine'); }, a ? 2400 : 0);
    }

    // new data: drawn at once when nothing moved recently, otherwise at most once a second (a flood reads as a surge)
    function update(d) {
      const before = JSON.stringify(listOf(current).map((p) => [p.key, p.score]));
      data = d;
      const after = JSON.stringify(listOf(current).map((p) => [p.key, p.score]));
      if (after === before && shown.size) { drawTabs(); return; }
      changedAt = now();
      const wait = REORDER - (now() - reorderedAt);
      if (wait <= 0 || o.rm) { reorderedAt = now(); draw(false); }
      else if (!reorderTimer) reorderTimer = setTimeout(() => { reorderTimer = null; reorderedAt = now(); draw(false); }, wait);
    }

    // switching lists (show both): every `every` seconds, but never while a score on the shown list is still moving
    function scheduleSwitch(ms) {
      clearTimeout(switchTimer);
      if (lists.length < 2) return;
      switchDue = now() + ms; runBar(ms);
      switchTimer = setTimeout(trySwitch, ms);
    }
    function trySwitch() {
      const quiet = now() - changedAt;
      if (quiet < HOLD) { switchTimer = setTimeout(trySwitch, HOLD - quiet); return; }
      switchTo(lists[(lists.indexOf(current) + 1) % lists.length]);
      scheduleSwitch((o.every || 15) * 1000);
    }
    function switchTo(k) {
      const rows = [...rowsEl.children];
      const out = rows.map((r, i) => anim(r, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: strip ? 'translateY(-8px)' : 'translateY(-10px)' }], { duration: 220, delay: i * 30, easing: 'ease-in', fill: 'forwards' }));
      const swap = () => {
        current = k; shown.clear(); rowsEl.innerHTML = ''; order = []; leader = null;
        draw(true); leader = order[0];
        if (strip) anim(el.querySelector('.lbl'), [{ transform: 'rotateX(90deg)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
        [...rowsEl.children].forEach((r, i) => anim(r, [{ opacity: 0, transform: strip ? 'translateX(-14px)' : 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      };
      const last = out.filter(Boolean).at(-1);
      if (last) last.onfinish = swap; else swap();
    }

    /** a jackpot on the board: the winner's row glows jackpot pink for 3 s */
    function jackpot(key) {
      glowKey = key; glowUntil = now() + 3000;
      const s = shown.get(key); if (s) { s.row.classList.add('jp'); setTimeout(() => s.row.classList.remove('jp'), 3000); }
    }

    // appearing: the title, then the rows deal in
    function start() {
      draw(true);
      anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'backwards' });
      [...rowsEl.children].forEach((r, i) => anim(r, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 150 + i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      scheduleSwitch((o.every || 15) * 1000);
    }

    return {
      update, jackpot, start, draw: () => draw(true),
      get current() { return current; }, get lists() { return lists; }, get switchDue() { return switchDue; },
      /** tests and pictures: show one list now */
      show(k) { if (lists.includes(k)) { current = k; shown.clear(); rowsEl.innerHTML = ''; order = []; draw(true); leader = order[0]; } },
      stop() { clearTimeout(switchTimer); clearTimeout(reorderTimer); },
    };
  }

  /** the leaderboard's lists from a scores record (widgets/lib/scores.js): This stream (or the last one, or recent points
   * when no answer yet) and All time, each as [{ key, name, platform, score }] */
  function lists(scores, n = 10) {
    const withKeys = (obj) => Object.entries(obj).map(([key, p]) => ({ key, ...p }));
    const v = scores.view(n);
    let stream;
    if (v.kind === 'stream' || v.kind === 'last') stream = { kind: v.kind, list: v.list };
    else {
      // no answer yet about the stream: the points since the last answer, so the board is never empty while people play
      const r = {}; for (const [k, name, platform, pts] of scores.record.log) { const p = r[k] || (r[k] = { name, platform, score: 0 }); p.score += pts; p.name = name; }
      stream = { kind: 'recent', list: withKeys(r).sort((a, b) => b.score - a.score).slice(0, n) };
    }
    const all = scores.allTimeTop(n);
    return { stream, all };
  }

  K.leaderboard = leaderboard;
  K.leaderboard.lists = lists;
})();
