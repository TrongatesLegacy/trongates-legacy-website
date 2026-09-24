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
  const SLOTS = { chat: 'Botrix chat', goal: 'Botrix follower goal' };
  const embed = (key, url) => {
    const el = document.querySelector(`[data-slot="${SLOTS[key]}"]`);
    if (!url || !el || !/^https:\/\//.test(url) || el.querySelector('.widget')) return;
    const f = document.createElement('iframe');
    f.src = url + (TGL.param('demo') === '1' ? '&isDemo=true&preview=1' : ''); f.title = SLOTS[key]; f.className = 'widget ' + key;
    el.appendChild(f);
  };
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
  const np = document.querySelector('[data-np]');
  if (np) {
    const mode = TGL.param('music', '');
    np.innerHTML = `<div class="np-art"><img alt=""></div><div class="np-info">
      <div class="np-top"><span class="np-eq"><i></i><i></i><i></i></span>Now playing<span class="np-time"></span></div>
      <div class="np-title"></div><div class="np-artist"></div><div class="np-bar"><i></i></div></div>`;
    const img = np.querySelector('img'), q = (s) => np.querySelector(s);
    const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
    let track = null, lastPlaying = 0;
    const show = (t) => {                       // t: {title, artist, art, pos, end, at, playing}
      track = t;
      if (!t) { np.classList.remove('on'); return; }
      q('.np-title').textContent = t.title; q('.np-artist').textContent = t.artist || '';
      if (t.art && img.getAttribute('src') !== t.art) img.src = t.art;
      if (!t.art) img.removeAttribute('src');
      np.classList.toggle('paused', !t.playing);
      np.classList.add('on');
    };
    const tick = () => {                        // progress between polls, from the bridge's last position
      if (!track || !track.end) { q('.np-bar i').style.width = '0'; q('.np-time').textContent = ''; return; }
      const pos = Math.min(track.end, track.pos + (track.playing ? Date.now() - track.at : 0));
      q('.np-bar i').style.width = (100 * pos / track.end).toFixed(2) + '%';
      q('.np-time').textContent = `${mmss(pos)} / ${mmss(track.end)}`;
    };
    setInterval(tick, 250);
    if (mode === 'demo') {
      const start = Date.now();
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
          // keep it up through track changes (status 2) for a few seconds; ?music=always keeps it up while paused
          if (!m || !m.Title || (!playing && mode !== 'always' && Date.now() - lastPlaying > 4000)) show(null);
          else show({ title: m.Title, artist: m.Artist, art: m.Thumbnail, pos: (tl.Position || 0) - (tl.StartTime || 0),
            end: (tl.EndTime || 0) - (tl.StartTime || 0), at: tl.LastUpdatedTime ? Date.parse(tl.LastUpdatedTime) : Date.now(), playing });
        } catch { show(null); }                  // bridge not running: stay hidden, keep asking
        setTimeout(poll, 1000);
      };
      poll();
    }
  }

  // ---- light cycles: riders on the grid that turn at intersections --------------------------------
  // Same idea as the website's background; they fade out under [data-quiet] zones (text) so they never
  // cut through copy. Canvas is capped at 30fps, which is plenty for OBS.
  function trails() {
    const cv = document.getElementById('trails');
    if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d'), W = cv.width = 1920, H = cv.height = 1080, CELL = 60;
    const count = +cv.dataset.riders || 6;
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22e5ff';
    const hex = (t) => Math.round(Math.max(0, Math.min(1, t)) * 255).toString(16).padStart(2, '0');
    const spawn = (r) => {
      const horiz = Math.random() < .6, fwd = Math.random() < .5;
      r.x = horiz ? (fwd ? -CELL : W + CELL) : Math.floor(Math.random() * W / CELL) * CELL;
      r.y = horiz ? Math.floor(Math.random() * (H - 440) / CELL) * CELL : (fwd ? -CELL : H - 440);
      r.dx = horiz ? (fwd ? 1 : -1) : 0; r.dy = horiz ? 0 : (fwd ? 1 : -1);
      r.speed = 120 + Math.random() * 120; r.left = CELL; r.pts = [[r.x, r.y]]; r.max = CELL * (5 + Math.random() * 5);
      return r;
    };
    const riders = Array.from({ length: count }, (_, i) => spawn({ rival: i === count - 1 }));
    const quiet = () => $$('[data-quiet]').map((el) => el.getBoundingClientRect());
    let zones = quiet(); setInterval(() => (zones = quiet()), 2000);
    let last = performance.now(), acc = 0;
    const frame = (t) => {
      requestAnimationFrame(frame);
      acc += t - last; last = t;
      if (acc < 33) return;                                  // ~30fps
      const dt = Math.min(acc / 1000, .08); acc = 0;
      ctx.clearRect(0, 0, W, H);
      const c = accent();
      for (const r of riders) {
        let move = r.speed * dt;
        while (move > 0) {
          const d = Math.min(move, r.left);
          r.x += r.dx * d; r.y += r.dy * d; r.left -= d; move -= d;
          if (r.left <= 0) { r.left = CELL; if (Math.random() < .25) { r.pts.push([r.x, r.y]); const s = Math.random() < .5 ? 1 : -1; [r.dx, r.dy] = r.dx ? [0, s] : [s, 0]; } }
        }
        const pts = [...r.pts, [r.x, r.y]];
        let len = 0; for (let i = 1; i < pts.length; i++) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        while (len > r.max && r.pts.length > 1) { const a = r.pts[0], b = r.pts[1]; len -= Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); r.pts.shift(); }
        if (r.x < -CELL * 12 || r.x > W + CELL * 12 || r.y < -CELL * 12 || r.y > H) spawn(r);
        const col = r.rival ? '#ff8a3d' : c;
        let run = 0, tot = Math.max(len, 1);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], seg = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
          const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
          g.addColorStop(0, col + hex(run / tot)); g.addColorStop(1, col + hex((run + seg) / tot)); run += seg;
          ctx.strokeStyle = g; ctx.lineCap = 'round';
          ctx.globalAlpha = .22; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.globalAlpha = .95; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.8, 0, 6.3); ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (const z of zones) for (const [p, a] of [[50, .4], [26, .5], [6, .7]]) {
        ctx.globalAlpha = a; ctx.beginPath(); ctx.roundRect(z.left - p, z.top - p, z.width + p * 2, z.height + p * 2, 30); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    requestAnimationFrame(frame);
  }

  // ---- character art (starting, BRB, ending): cycles the forms with the website's glitch swap ------
  // Starts on the selected form (?form=, else the last one picked by the dock or veadotube), then glitches through
  // the others (cyan Tron, Princess Trina, the Blobfish), holding each for HOLD ms; the scene colour follows the
  // form on show. Picking a form while it runs glitches straight to it, and OBS showing the scene again restarts
  // the cycle on the selected form. The glitch is the hero's: four 60ms steps of horizontal slices mixing the old and new art, with a
  // red/cyan split. ?cycle=0 shows the veadotube form (static) instead, ?art=0 hides the art.
  const ART = { cyan: 'tron-cyan-mclosed-eopen', yellow: 'tron-yellow-mclosed-eopen', red: 'tron-red-mclosed-eopen', princess: 'princess-uwu', blobfish: 'blobfish-mclosed-eopen' };
  const ART_T = { cyan: 'none', yellow: 'none', red: 'none', princess: 'translate(.75%, -1.9%) scale(.937)', blobfish: 'translate(-12.7%, -5.8%) scale(1.18)' };
  const CYCLE = ['cyan', 'princess', 'blobfish'], HOLD = 6000;
  const artSrc = (f) => `assets/forms/${ART[f] || ART.cyan}.webp`;
  const artBox = document.querySelector('.art-stage .art');
  if (TGL.param('art') === '0') document.documentElement.classList.add('no-art');
  if (artBox) {
    const img = artBox.querySelector('img[data-form-art]');
    const glitchEl = document.createElement('div'); glitchEl.className = 'art-glitch'; artBox.appendChild(glitchEl);
    const show = (f) => { img.src = artSrc(f); img.style.transform = ART_T[f]; };
    CYCLE.forEach((f) => { const i = new Image(); i.src = artSrc(f); });          // warm all three
    if (!TGL.cycling) { show(TGL.form); TGL.onChange(show); }
    else {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const order = (f) => [f, ...CYCLE.filter((c) => c !== f)];
      let seq = order(TGL.form), n = 0, timer, busy = Promise.resolve();
      TGL.paint(seq[0]); show(seq[0]);
      const step = (ms) => new Promise((r) => setTimeout(r, ms));
      const slices = (from, to, p) => {
        let html = '', y = 0;
        while (y < 100) {
          const h = 10 + Math.random() * 16, f = Math.random() < p ? to : from, dx = (Math.random() - .5) * 30;
          html += `<i style="clip-path:inset(${y.toFixed(1)}% 0 ${Math.max(0, 100 - y - h).toFixed(1)}% 0);transform:translateX(${dx.toFixed(1)}px)"><b style="background-image:url('${artSrc(f)}');transform:${ART_T[f]}"></b></i>`;
          y += h;
        }
        glitchEl.innerHTML = html;
      };
      let shown = seq[0];
      const glitchTo = (to) => (busy = busy.then(async () => {
        const from = shown; shown = to;
        if (from === to) return;
        if (reduced) { TGL.paint(to); show(to); return; }
        artBox.classList.add('glitching');
        for (const [i, p] of [.25, .5, .75, .92].entries()) { if (i === 2) TGL.paint(to); slices(from, to, p); await step(60); }
        show(to);
        await img.decode().catch(() => {});
        artBox.classList.remove('glitching'); glitchEl.innerHTML = '';
      }));
      const next = () => { clearTimeout(timer); timer = setTimeout(async () => { await glitchTo(seq[n = (n + 1) % seq.length]); next(); }, HOLD); };
      next();
      TGL.onChange((f) => { seq = order(f); n = 0; glitchTo(f); next(); });
      addEventListener('obsSourceActiveChanged', (e) => {   // OBS browser sources: the scene became visible again
        if (!e.detail || !e.detail.active) return;
        seq = order(TGL.form); n = 0; shown = seq[0]; TGL.paint(shown); show(shown); next();
      });
    }
  }

  // ---- glitch the title whenever the form changes --------------------------------------------------
  TGL.onChange(() => $$('.glitch').forEach((el) => { el.classList.remove('now'); void el.offsetWidth; el.classList.add('now'); }));

  document.fonts.ready.then(() => { labelSlots(); trails(); });
})();
