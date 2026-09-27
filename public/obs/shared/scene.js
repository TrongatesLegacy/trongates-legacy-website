// Behaviour shared by the scene overlays: light trails on the grid, the layout guide labels, the form-cycling
// character art, and a glitch on the title when the form changes. Loaded after theme.js.
(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---- guide labels: each [data-slot] gets its exact OBS transform written on it -------------------
  // Boxes are measured from the rendered page, so the numbers always match what's drawn.
  function labelSlots() {
    $$('[data-slot]').forEach((el) => {
      const b = el.getBoundingClientRect();
      let label = el.querySelector(':scope > .slot-label');
      if (!label) { label = document.createElement('div'); label.className = 'slot-label'; el.appendChild(label); }
      label.textContent = `${el.dataset.slot}\nX ${Math.round(b.left)}  Y ${Math.round(b.top)}  W ${Math.round(b.width)}  H ${Math.round(b.height)}`;
    });
  }

  // ---- Botrix widgets embedded in their frames ------------------------------------------------------
  // ?chat=<Botrix chat widget URL>&goal=<follower goal widget URL> (URL-encoded) loads the widget straight into
  // the frame, so it needs no browser source, position or Custom CSS of its own in OBS. The widget's look is
  // set in Botrix (design, font size); the links carry the account's widget id, so they only ever live in the
  // OBS source's URL (and the index page's browser storage), never in the repo.
  // ?key=<OBS_KEY> instead fetches the links kept in Netlify env vars (netlify/functions/obs-widgets.mjs), so
  // changing them there updates every scene; a chat=/goal= on the URL still wins for its frame. demo=1 adds
  // Botrix's sample messages (the index previews).
  // ---- parts turned off (hide=chat,goal,music,discord,socials,ticker,art,rings): gone before anything loads ----
  $$('[data-part]').forEach((el) => { if (TGL.hidden(el.dataset.part)) el.remove(); });
  if (TGL.hidden('art')) document.documentElement.classList.add('no-art');

  // ---- the left column (Be right back, Just chatting): the chat frame takes the room now playing and the goal
  // leave: always when they're turned off, and while nothing's playing (it glides back before now playing
  // returns). Same numbers as model.js chatBox(), which the dock uses to fit its shared chat.
  const colChat = /** @type {HTMLElement} */ (document.querySelector('.frame.col-chat'));
  const column = (musicRoom, animate = true) => {
    if (!colChat) return;
    const top = musicRoom ? 126 : 10, bottom = document.querySelector('.frame.col-goal') ? 850 : 1000;
    colChat.classList.toggle('still', !animate);
    colChat.style.top = top + 'px'; colChat.style.height = bottom - top + 'px';
    setTimeout(labelSlots, animate ? 600 : 0);
  };
  column(false, false);

  const SLOTS = { chat: 'Botrix chat', goal: 'Botrix follower goal' };
  const demo = (url) => url + (TGL.param('demo') === '1' ? '&isDemo=true&preview=1' : '');
  const embed = (key, url) => {
    const el = document.querySelector(`[data-slot="${SLOTS[key]}"]`);
    if (!url || !el || !/^https:\/\//.test(url) || el.querySelector('.widget')) return;
    if (key === 'goal' && TGL.param('goalcolor') !== '0') return goalInColour(el, url);
    const f = document.createElement('iframe');
    f.src = demo(url); f.title = SLOTS[key]; f.className = 'widget ' + key;
    el.appendChild(f);
  };
  // The goal follows the scene colour: Botrix takes its colours from the link, so each form gets its own copy
  // of the widget with fill/accent/border/track in that colour, made the first time the form shows and kept
  // (switching crossfades, nothing reloads; the cycling scenes only ever make three).
  function goalInColour(el, url) {
    const copies = {};
    const inColour = (f) => {
      const u = new URL(url), c = TGL.FORMS[f].accent;
      for (const [k, v] of [['fillColor', c], ['accentColor', c], ['borderColor', c + '66'], ['trackColor', c + '22']]) u.searchParams.set(k, v);
      return demo(u.href);
    };
    const showFor = (f) => {
      if (!TGL.FORMS[f]) return;
      let fr = copies[f];
      if (!fr) {
        fr = copies[f] = document.createElement('iframe');
        fr.title = SLOTS.goal; fr.className = 'widget goal'; fr.dataset.form = f;
        fr.onload = () => setTimeout(() => { fr.dataset.ready = '1'; if (fr.dataset.want) swap(); }, 800);   // let it draw first
        fr.src = inColour(f); el.appendChild(fr);
      }
      Object.values(copies).forEach((x) => delete x.dataset.want); fr.dataset.want = '1';
      if (fr.dataset.ready) swap();
    };
    const swap = () => Object.values(copies).forEach((x) => x.classList.toggle('shown', !!x.dataset.want));
    showFor(document.documentElement.dataset.form);
    // the cycling scenes switch every few seconds, through any of the forms: load every form's copy up front
    if (TGL.cycling) for (const f of Object.keys(TGL.FORMS)) if (!copies[f]) { const now = document.documentElement.dataset.form; showFor(f); showFor(now); }
    // the colour changes through theme.js (dock, veadotube) and the cycling scenes' paint(): both set data-form
    new MutationObserver(() => showFor(document.documentElement.dataset.form)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-form'] });
  }
  for (const key of Object.keys(SLOTS)) embed(key, TGL.param(key));
  const siteKey = TGL.param('key');
  if (siteKey && Object.keys(SLOTS).some((k) => document.querySelector(`[data-slot="${SLOTS[k]}"]`) && !TGL.param(k))) {
    // local files (file://) ask the live site
    const api = (/^https?:$/.test(location.protocol) ? '' : 'https://www.trongateslegacy.com') + '/api/obs-widgets';
    const load = () => fetch(api, { headers: { 'X-OBS-Key': siteKey }, cache: 'no-store' })
      .then((r) => (r.status === 401 || r.status === 404 ? {} : r.ok ? r.json() : Promise.reject()))
      .then((links) => Object.entries(links).forEach(([k, url]) => { if (!TGL.param(k)) embed(k, url); }))
      .catch(() => setTimeout(load, 30000));          // offline or starting up: try again
    load();
  }

  // ---- now playing: SMTC Bridge (Windows; https://github.com/nuttylmao/smtc-bridge) ------------------
  // The bridge serves whatever Windows' media controls show (Spotify, Apple Music, YouTube Music, browsers…) as
  // JSON at http://127.0.0.1:5000/now-playing, CORS open. Polled once a second, only inside OBS (a normal browser
  // would ask for "Apps on device" and mark the page Not Secure) unless ?music=1. Options:
  //   music=0 off · music=1 poll outside OBS too · music=demo sample track · music=always stay up while paused
  //   musichost=127.0.0.1:5000 the bridge's address · app=Spotify only follow this app (part of its id)
  //   musicdebug=1 show the bridge's raw timeline numbers in place of the time (for checking a player)
  //   cidertoken=…  Cider's API token (Cider → Settings → Connectivity → Manage External Application Access)
  // Some players (Cider) give Windows no timeline at all (position 0, length 0). Then the position and length come
  // from Cider's own API (http://localhost:10767/api/v1/playback/now-playing) if it answers.
  const np = document.querySelector('[data-np]');
  if (np) {
    const mode = TGL.param('music', '');
    np.innerHTML = `<i class="sk sk-tron lk-t"></i><i class="sk sk-royal lk-p"></i><i class="sk sk-chunky lk-b"></i><div class="np-art"><img alt=""></div><div class="np-info">
      <div class="np-top"><span class="np-eq"><i></i><i></i><i></i></span>Now playing<span class="np-time"></span></div>
      <div class="np-title"></div><div class="np-artist"></div><div class="np-bar"><i></i></div></div>`;
    const img = np.querySelector('img'), q = (s) => np.querySelector(s);
    const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
    let track = null, lastPlaying = 0, wanted = false, timer;
    // in the left column the chat makes room first, then now playing fades in (and the other way round)
    const reveal = (on) => {
      if (on === wanted) return;
      wanted = on; clearTimeout(timer);
      if (!colChat) { np.classList.toggle('on', on); return; }
      if (on) { column(true); timer = setTimeout(() => np.classList.add('on'), TGL.reduced ? 0 : 500); }
      else { np.classList.remove('on'); timer = setTimeout(() => column(false), TGL.reduced ? 0 : 650); }
    };
    const show = (t) => {                       // t: {title, artist, art, pos, end, at, playing}
      track = t;
      if (!t) { reveal(false); return; }
      q('.np-title').textContent = t.title; q('.np-artist').textContent = t.artist || '';
      if (t.art && img.getAttribute('src') !== t.art) img.src = t.art;
      if (!t.art) img.removeAttribute('src');
      np.classList.toggle('paused', !t.playing);
      reveal(true);
    };
    const tick = () => {                        // progress between polls, from the bridge's last position
      np.classList.toggle('no-time', !track || !track.end);
      if (!track || !track.end) { q('.np-bar i').style.width = '0'; q('.np-time').textContent = track?.debug || ''; return; }
      const pos = Math.max(0, Math.min(track.end, track.pos + (track.playing ? Date.now() - track.at : 0)));
      q('.np-bar i').style.width = (100 * pos / track.end).toFixed(2) + '%';
      q('.np-time').textContent = track.debug || `${mmss(pos)} / ${mmss(track.end)}`;
    };
    // The bridge's timeline, made safe for every player: Windows gives the position as of LastUpdatedTime
    // ("2026-09-25 10:15:30.123456+00:00"); some players leave that unset (year 1601) or odd, and some give the
    // length only as the seek range. An unusable time falls back to when this position was first seen here.
    let seen = { key: '', at: 0 };
    // Cider's API: asked only while the bridge has no timeline; if it doesn't answer, it's asked again every 30s
    let ciderNext = 0;
    const cider = async () => {
      if (Date.now() < ciderNext) return null;
      try {
        const tok = TGL.param('cidertoken', '');
        const r = await fetch('http://localhost:10767/api/v1/playback/now-playing', { headers: tok ? { apptoken: tok } : {}, cache: 'no-store' });
        if (!r.ok) throw 0;
        const j = await r.json(); return j && j.info;
      } catch { ciderNext = Date.now() + 30000; return null; }
    };
    const timeline = (m, tl) => {
      const end = (tl.EndTime || 0) - (tl.StartTime || 0) > 0 ? tl.EndTime - (tl.StartTime || 0)
        : (tl.MaxSeekTime || 0) - (tl.MinSeekTime || 0) > 0 ? tl.MaxSeekTime - (tl.MinSeekTime || 0) : 0;
      const pos = (tl.Position || 0) - (tl.StartTime || 0);
      const key = `${m.Title}|${m.Artist}|${tl.Position}`;
      if (key !== seen.key) seen = { key, at: Date.now() };
      const t = Date.parse(String(tl.LastUpdatedTime || '').replace(' ', 'T'));
      const at = Number.isFinite(t) && t > Date.now() - 6 * 3600e3 && t < Date.now() + 5000 ? t : seen.at;
      return { pos, end, at };
    };
    setInterval(tick, 250);
    if (mode === 'demo') {
      const start = Date.now();
      wanted = true; column(true, false); np.classList.add('on');   // the previews: already in place, no glide
      show({ title: 'Neon Grid Runner', artist: 'Lulu Gang Radio', art: '', pos: 72000, end: 214000, at: start, playing: true });
    } else if (mode !== '0' && (window.obsstudio || mode === '1' || mode === 'always')) {
      const host = TGL.param('musichost', '127.0.0.1:5000'), app = TGL.param('app', '').toLowerCase();
      const poll = async () => {
        try {
          const d = await (await fetch(`http://${host}/now-playing`, { cache: 'no-store' })).json();
          const list = d.sessions || [];
          const s = (app ? list.find((x) => (x.source_app_id || '').toLowerCase().includes(app))
            : list.find((x) => x.source_app_id === d.current_session_id)) || list.find((x) => x.playback_info?.PlaybackStatus === 4);
          const m = s?.media_properties, tl = s?.timeline_properties || {};
          const playing = s?.playback_info?.PlaybackStatus === 4;
          if (playing) lastPlaying = Date.now();
          let tlx = m ? timeline(m, tl) : null;
          if (tlx && !tlx.end) {                         // no timeline from Windows: ask Cider itself
            const c = await cider();
            if (c && c.durationInMillis && (!c.name || c.name === m.Title)) tlx = { pos: Math.round((c.currentPlaybackTime || 0) * 1000), end: c.durationInMillis, at: Date.now() };
          }
          // keep it up through track changes (status 2) for a few seconds; ?music=always keeps it up while paused
          if (!m || !m.Title || (!playing && mode !== 'always' && Date.now() - lastPlaying > 4000)) show(null);
          else show({ title: m.Title, artist: m.Artist, art: m.Thumbnail, playing, ...tlx,
            debug: TGL.param('musicdebug') === '1' ? `P${tl.Position} S${tl.StartTime} E${tl.EndTime} M${tl.MaxSeekTime} U${String(tl.LastUpdatedTime).slice(11, 23)}` : '' });
        } catch { show(null); }                  // bridge not running: stay hidden, keep asking
        setTimeout(poll, 1000);
      };
      poll();
    }
  }

  // ---- light cycles: riders on the grid that turn at intersections --------------------------------
  // Same idea as the website's background; they fade out under [data-quiet] zones (text) so they never
  // cut through copy. Canvas is capped at 30fps, which is plenty for OBS. Princess Trina's look turns the riders into
  // glitter comets with a few gold twinkles; the Blobfish's has bubbles instead. A look change never removes what's on
  // screen: old riders and bubbles fade out where they are while the new kind arrives a few at a time.
  function trails() {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('trails'));
    if (!cv || TGL.reduced) return;
    const ctx = cv.getContext('2d'), W = cv.width = 1920, H = cv.height = 1080, CELL = 60;
    const count = +cv.dataset.riders || 6, GOLD = '#ffd98a', LILAC = '#b48cff', TEAL = '#45d6c8';
    const MODES = { princess: 'glitter', blobfish: 'bubble' };
    const mode = () => MODES[document.documentElement.dataset.look] || 'cycle';
    // --accent is a registered <color>, which newer Chromium reports as rgb(…): the trails need #rrggbb (they add alpha)
    const accent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22e5ff';
      const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(v);
      return m ? '#' + m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('') : v.slice(0, 7);
    };
    const hex = (t) => Math.round(Math.max(0, Math.min(1, t)) * 255).toString(16).padStart(2, '0');
    const spawn = (r) => {
      r.kind = mode(); r.alpha = 1; r.retire = false;
      if (r.kind === 'bubble') { r.kind = 'cycle'; r.retire = true; r.alpha = 0; }   // no riders with the bubbles: they wait, unseen
      const horiz = Math.random() < .6, fwd = Math.random() < .5;
      r.x = horiz ? (fwd ? -CELL : W + CELL) : Math.floor(Math.random() * W / CELL) * CELL;
      r.y = horiz ? Math.floor(Math.random() * (H - 440) / CELL) * CELL : (fwd ? -CELL : H - 440);
      r.dx = horiz ? (fwd ? 1 : -1) : 0; r.dy = horiz ? 0 : (fwd ? 1 : -1);
      r.speed = 120 + Math.random() * 120; r.left = CELL; r.pts = [[r.x, r.y]]; r.max = CELL * (5 + Math.random() * 5);
      return r;
    };
    const riders = Array.from({ length: count }, (_, i) => spawn({ rival: i === count - 1 }));
    let bubbles = [], twinkles = [], nextBubble = 0, nextTwinkle = 0, since = 0;
    const quiet = () => $$('[data-quiet]').map((el) => el.getBoundingClientRect());
    let zones = quiet(); setInterval(() => (zones = quiet()), 2000);
    const star = (x, y, sz, a, turn, fill, glow) => {
      ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.shadowColor = glow; ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const rr = i % 2 ? sz * .25 : sz, an = i * Math.PI / 4 + turn; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    };
    const drawCycle = (r, pts, len, c, a) => {
      const col = r.rival ? '#ff8a3d' : c;
      let run = 0; const tot = Math.max(len, 1);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], seg = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
        const g = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
        g.addColorStop(0, col + hex(run / tot)); g.addColorStop(1, col + hex((run + seg) / tot)); run += seg;
        ctx.strokeStyle = g; ctx.lineCap = 'round';
        ctx.globalAlpha = .22 * a; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        ctx.globalAlpha = .95 * a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.8, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
    };
    // Princess's riders: sparkles along the trail, brighter towards a bright star at the head
    const drawGlitter = (r, pts, len, c, a, t) => {
      let run = 0; const tot = Math.max(len, 1);
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], seg = Math.abs(bx - ax) + Math.abs(by - ay);
        for (let d = (16 - (run % 16)) % 16; d < seg; d += 16) {
          const at = run + d, k = at / tot, tw = .55 + .45 * Math.sin(t / 90 + at * .7);
          ctx.globalAlpha = a * k * tw * .9; ctx.fillStyle = Math.round(at / 16) % 3 ? LILAC : GOLD;
          ctx.beginPath(); ctx.arc(ax + (bx - ax) * d / seg + Math.sin(at) * 3, ay + (by - ay) * d / seg + Math.cos(at) * 3, 1 + k * 2, 0, 6.3); ctx.fill();
        }
        run += seg;
      }
      star(r.x, r.y, 8, a, t / 400, '#fff', c);
    };
    // the Blobfish's bubbles rise and wobble, and pop near the top; the first few appear anywhere, the rest from below
    const bubbling = (m, dt, t, c) => {
      const want = m === 'bubble' ? count * 3 : 0;
      if (bubbles.filter((b) => !b.gone).length < want && t > nextBubble) {
        bubbles.push({ x: Math.random() * W, y: since < 2 ? H * (.3 + Math.random() * .6) : H - 60, r: 3 + Math.random() * 6, vy: 30 + Math.random() * 36, ph: Math.random() * 6, age: 0, life: 1, gone: false });
        nextBubble = t + 150;
      }
      bubbles = bubbles.filter((b) => {
        if (m !== 'bubble' || b.y < H * .1) b.gone = true;
        if (b.gone) b.life -= dt / (b.y < H * .1 ? .25 : .9);
        if (b.life <= 0) return false;
        b.y -= b.vy * dt; b.ph += dt * 2; b.age += dt;
        const x = b.x + Math.sin(b.ph) * 1.5 * b.r, a = b.life * Math.min(1, b.age / .6);
        ctx.globalAlpha = a * .75; ctx.strokeStyle = b.r > 6 ? c : TEAL; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.3); ctx.stroke();
        ctx.globalAlpha = a * .5; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - b.r * .35, b.y - b.r * .35, b.r * .22, 0, 6.3); ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;
    };
    // Princess's twinkles: never more than three, each fading in and out somewhere over about two seconds
    const twinkling = (m, dt, t) => {
      if (m === 'glitter' && twinkles.length < 3 && t > nextTwinkle) {
        twinkles.push({ x: Math.random() * W, y: Math.random() * H * .6, t: 0, d: 1.6 + Math.random() });
        nextTwinkle = t + 500 + Math.random() * 900;
      }
      twinkles = twinkles.filter((q) => {
        q.t += dt * (m === 'glitter' ? 1 : 3);
        if (q.t >= q.d) return false;
        const a = Math.sin(q.t / q.d * Math.PI);
        star(q.x, q.y, 4 + a * 4, a * .8, q.t * .6, '#ffe3a6', GOLD);
        return true;
      });
    };
    let last = performance.now(), acc = 0;
    const frame = (t) => {
      requestAnimationFrame(frame);
      acc += t - last; last = t;
      if (acc < 33) return;                                  // ~30fps
      const dt = Math.min(acc / 1000, .08); acc = 0; since += dt;
      ctx.clearRect(0, 0, W, H);
      const c = accent(), m = mode();
      for (const r of riders) {
        if (r.kind !== m) r.retire = true;
        if (r.retire) {                                       // an old kind: fades out where it is, then comes back as the new kind
          r.alpha -= dt / .9;
          if (r.alpha <= 0) {
            if (m === 'bubble') { r.alpha = 0; continue; }
            spawn(r); r.alpha = -Math.random() * 1.5;         // a staggered return, so they don't all arrive at once
          }
        } else if (r.alpha < 1) r.alpha = Math.min(1, r.alpha + dt / .6);
        let move = r.speed * dt;
        while (move > 0) {
          const d = Math.min(move, r.left);
          r.x += r.dx * d; r.y += r.dy * d; r.left -= d; move -= d;
          if (r.left <= 0) { r.left = CELL; if (Math.random() < .25) { r.pts.push([r.x, r.y]); const s = Math.random() < .5 ? 1 : -1; [r.dx, r.dy] = r.dx ? [0, s] : [s, 0]; } }
        }
        const pts = [...r.pts, [r.x, r.y]];
        let len = 0; for (let i = 1; i < pts.length; i++) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        while (len > r.max && r.pts.length > 1) { const a = r.pts[0], b = r.pts[1]; len -= Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); r.pts.shift(); }
        if (r.x < -CELL * 12 || r.x > W + CELL * 12 || r.y < -CELL * 12 || r.y > H) { const keep = r.alpha; spawn(r); if (r.kind === m) r.alpha = Math.min(keep, 1); }
        if (r.alpha > 0) (r.kind === 'glitter' ? drawGlitter : drawCycle)(r, [...r.pts, [r.x, r.y]], len, c, r.alpha, t);
      }
      bubbling(m, dt, t, c);
      twinkling(m, dt, t);
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (const z of zones) for (const [p, a] of [[50, .4], [26, .5], [6, .7]]) {
        ctx.globalAlpha = a; ctx.beginPath(); ctx.roundRect(z.left - p, z.top - p, z.width + p * 2, z.height + p * 2, 30); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    requestAnimationFrame(frame);
  }

  // ---- character art (starting, BRB, ending): cycles the forms with the website's glitch swap ------
  // Three turns: Tron, Princess Trina, the Blobfish, holding each for HOLD ms; the scene colour follows the form
  // on show. Tron's turn is cyan the first time and then a random one of cyan / gold / red. Starts on the selected
  // form (?form=, else the last one picked by the dock or veadotube; a Tron colour counts as Tron's first turn).
  // Picking a form while it runs glitches straight to it, and OBS showing the scene again starts over (paused while hidden).
  // The switch-in is the website's, in the new form's look: Tron glitches in (four 60ms steps of horizontal slices mixing
  // the old and new art, with a red/cyan split); Princess Trina sparkles in (a dissolve with glitter); the Blobfish ripples
  // in (bands swaying as through water). ?cycle=0 shows the veadotube form (static) instead, ?art=0 hides the art.
  const ART = { cyan: 'tron-cyan-mclosed-eopen', yellow: 'tron-yellow-mclosed-eopen', red: 'tron-red-mclosed-eopen', princess: 'princess-uwu', blobfish: 'blobfish-mclosed-eopen' };
  const CYCLE = ['tron', 'princess', 'blobfish'], TRONS = ['cyan', 'yellow', 'red'], HOLD = 6000;
  const turnOf = (f) => (TRONS.includes(f) ? 'tron' : f);
  // the website's own character art (one pre-sized canvas for every form: scripts/presize-art.mjs), so no per-form
  // adjustment here; ../assets works hosted (/assets/img) and from a local copy of the whole public folder
  const artSrc = (f) => `../assets/img/${ART[f] || ART.cyan}.webp`;
  const artBox = document.querySelector('.art-stage .art');
  if (artBox) {
    const img = /** @type {HTMLImageElement} */ (artBox.querySelector('img[data-form-art]'));
    const glitchEl = document.createElement('div'); glitchEl.className = 'art-glitch'; artBox.appendChild(glitchEl);
    const show = (f) => { img.src = artSrc(f); };
    Object.keys(ART).forEach((f) => { const i = new Image(); i.src = artSrc(f); });   // warm all five
    if (!TGL.cycling) { show(TGL.form); TGL.onChange(show); }
    else {
      const reduced = TGL.reduced;
      // While OBS isn't showing the scene, Chrome slows its timers and draws nothing, so glitches would stall and pile
      // up, then all play at once when the scene comes back (a fast run through the forms). So: hidden = no timer and
      // no animation (a pick just swaps the art), at most one glitch waits behind the one playing, and showing the
      // scene again drops whatever's left and starts clean on the current form.
      let n = 0, tronSeen = false, timer, hidden = false, gen = 0, pending = null, busy = null;
      // fresh = the scene (re)starting: Tron's next turn is cyan again unless it's on now; a pick mid-cycle keeps the count
      const startOn = (f, fresh = true) => { n = Math.max(0, CYCLE.indexOf(turnOf(f))); tronSeen = (fresh ? false : tronSeen) || turnOf(f) === 'tron'; };
      const formFor = (turn) => {
        if (turn !== 'tron') return turn;
        const f = tronSeen ? TRONS[Math.floor(Math.random() * TRONS.length)] : 'cyan';
        tronSeen = true; return f;
      };
      startOn(TGL.form); TGL.paint(TGL.form); show(TGL.form);
      const step = (ms) => new Promise((r) => setTimeout(r, ms));
      const band = (y, h, dx, f, alpha = 1) => `<i style="clip-path:inset(${y.toFixed(1)}% 0 ${Math.max(0, 100 - y - h).toFixed(1)}% 0);transform:translateX(${dx.toFixed(1)}px);opacity:${alpha.toFixed(2)}"><b style="background-image:url('${artSrc(f)}')"></b></i>`;
      // each style: its steps (how far the new form shows at each), the step the scene recolours on, one frame's HTML
      const SWITCH_IN = {
        glitch: { steps: [.25, .5, .75, .92], paintAt: 2, frame(p, from, to) {
          let html = '', y = 0;
          while (y < 100) { const h = 10 + Math.random() * 16; html += band(y, h, (Math.random() - .5) * 30, Math.random() < p ? to : from); y += h; }
          return html;
        } },
        princess: { steps: [.15, .32, .5, .68, .84, .95], paintAt: 3, frame(p, from, to) {
          let html = band(0, 100, 0, from, 1 - p) + band(0, 100, 0, to, p);
          for (let i = 0; i < 9; i++) {
            const k = Math.sin(p * Math.PI) * (.6 + Math.random() * .6);
            html += `<s style="left:${(18 + Math.random() * 64).toFixed(1)}%;top:${(12 + Math.random() * 70).toFixed(1)}%;transform:scale(${k.toFixed(2)}) rotate(${Math.round(Math.random() * 90)}deg)"></s>`;
          }
          return html;
        } },
        blobfish: { steps: [.15, .32, .5, .68, .84, .95], paintAt: 3, frame(p, from, to) {
          let html = '';
          const amp = Math.sin(p * Math.PI) * 18;
          for (let y = 0; y < 100; y += 100 / 14) { const dx = Math.sin(y / 9 + p * 9) * amp; html += band(y, 100 / 14, dx, from, 1 - p) + band(y, 100 / 14, -dx, to, p); }
          return html;
        } },
      };
      let shown = TGL.form;
      const swap = (to) => { shown = to; TGL.paint(to); show(to); };
      const play = async (to, g) => {
        const from = shown; shown = to;
        if (from === to) return;
        if (reduced) { swap(to); return; }
        const style = SWITCH_IN[TGL.lookOf(to)] || SWITCH_IN.glitch;
        artBox.classList.add('glitching'); glitchEl.classList.toggle('soft', style !== SWITCH_IN.glitch);
        for (const [i, p] of style.steps.entries()) { if (g !== gen) return; if (i === style.paintAt) TGL.paint(to); glitchEl.innerHTML = style.frame(p, from, to); await step(60); }
        if (g !== gen) return;
        show(to);
        await Promise.race([img.decode().catch(() => {}), step(400)]);
        if (g !== gen) return;
        // the image back first, the switch-in layer cleared a frame later: never a frame with neither
        artBox.classList.remove('glitching');
        requestAnimationFrame(() => { if (g === gen && !artBox.classList.contains('glitching')) glitchEl.innerHTML = ''; });
      };
      const glitchTo = (to) => {
        if (hidden) { swap(to); return Promise.resolve(); }
        pending = to;
        if (busy) return busy;
        const run = (async () => {
          await null;   // let run be assigned before the loop can finish
          const g = gen;
          while (pending !== null && g === gen) { const t = pending; pending = null; await play(t, g); }
          if (busy === run) busy = null;
        })();
        return (busy = run);
      };
      const next = () => { clearTimeout(timer); if (hidden) return; timer = setTimeout(async () => { await glitchTo(formFor(CYCLE[n = (n + 1) % CYCLE.length])); next(); }, HOLD); };
      next();
      TGL.onChange((f) => { startOn(f, false); glitchTo(f); next(); });
      // OBS browser sources: visible = on show anywhere (a transition's start, the preview), active = on program
      const reset = () => {
        gen++; pending = null; busy = null; clearTimeout(timer);
        artBox.classList.remove('glitching'); glitchEl.innerHTML = '';
        startOn(TGL.form); swap(TGL.form);
      };
      const pause = () => { if (!hidden) { hidden = true; reset(); } };
      const resume = () => { hidden = false; reset(); next(); };
      // (OBS's browser source events: CustomEvent with detail.visible / detail.active)
      addEventListener('obsSourceVisibleChanged', (/** @type {any} */ e) => (e.detail && e.detail.visible ? resume() : pause()));
      addEventListener('obsSourceActiveChanged', (/** @type {any} */ e) => { if (e.detail && e.detail.active) resume(); });
      document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
    }
  }

  // ---- the look (Princess Trina's, the Blobfish's, Tron's) follows the form -------------------------------------
  // theme.js sets <html data-look> for the first frame; afterwards every recolour (the dock, veadotube, a cycling scene's
  // paint) comes through data-form, and the look follows it here. The titles, the socials strip and the floor would
  // visibly jump between fonts, marks and patterns, so they fade out for a moment, the look (and its font, fetched now
  // if needed: at most 1.2 s) swaps meanwhile, and they come back, all while the colours blend and the frames morph. The
  // old look's layers stay for the cross-fade (data-was), then go. Hidden (OBS not showing the scene) or reduced motion:
  // it just swaps. The cycling scenes load both fonts up front.
  const root = document.documentElement;
  const LOOK_FONTS = { princess: '900 1em "Cinzel Decorative"', blobfish: '400 1em "Lilita One"' };
  const loadLook = (look) => (LOOK_FONTS[look] ? Promise.race([document.fonts.load(LOOK_FONTS[look]).catch(() => {}), new Promise((r) => setTimeout(r, 1200))]) : null);
  if (TGL.cycling) Object.keys(LOOK_FONTS).forEach(loadLook);
  // a fade, not the website's blur: a blur is a new filter layer for the GPU at the moment it's busiest (every scene and
  // every preview on the index changing at once)
  const FADE = [{ opacity: 1 }, { opacity: 0 }];
  // the floor only dims while its pattern changes: fading it out with everything else read as the scene flashing to black
  const DIM = [{ opacity: 1 }, { opacity: .35 }], outOf = (el) => (el.matches('.floor') ? DIM : FADE);
  let lookWant = root.dataset.look, lookBusy = false, wasTimer = 0;
  async function setLook(look) {
    lookWant = look;
    if (lookBusy || root.dataset.look === lookWant) return;
    lookBusy = true;
    const quick = TGL.reduced || document.hidden;
    const els = quick ? [] : $$('.title, .ticker, .floor');
    const gone = els.map((el) => el.animate(outOf(el), { duration: 160, easing: 'ease-in', fill: 'forwards' }));
    if (!quick) await new Promise((r) => setTimeout(r, 160));
    while (root.dataset.look !== lookWant) {      // another pick may arrive while its font loads: follow it
      const want = lookWant;
      await loadLook(want);
      if (want !== lookWant) continue;
      const was = root.dataset.look;
      root.dataset.look = want;
      clearTimeout(wasTimer);
      if (quick) delete root.dataset.was;
      else { root.dataset.was = was; wasTimer = setTimeout(() => delete root.dataset.was, 850); }
    }
    els.forEach((el) => el.animate([...outOf(el)].reverse(), { duration: 240, easing: 'ease-out' }));
    gone.forEach((a) => a.cancel());
    lookBusy = false;
  }
  new MutationObserver(() => setLook(TGL.lookOf(root.dataset.form))).observe(root, { attributes: true, attributeFilter: ['data-form'] });

  // ---- glitch the title whenever the form changes --------------------------------------------------
  TGL.onChange(() => $$('.glitch').forEach((el) => { el.classList.remove('now'); void el.offsetWidth; el.classList.add('now'); }));

  document.fonts.ready.then(() => { labelSlots(); trails(); });
})();
