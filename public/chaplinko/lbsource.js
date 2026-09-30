// Chaplinko's separate leaderboard source (leaderboard.html): shows the scores the board saves in this browser. The board
// is the only one that writes; this page only reads: when the board announces a change on its BroadcastChannel (at once),
// and every 5 s in case a message was missed. Both OBS browser sources run in one browser, so they share storage
// (/chaplinko/check.html proves it in a given OBS). If the board isn't running, the last saved scores still show.
// docs/widgets.md, "Chaplinko: the leaderboard". Link: the leaderboard's settings (settings.js, LB_KEYS); demo=1 follows
// the pretend board of the set-up page.
(() => {
  const W = window.Widgets, K = window.Chaplinko;
  const q = new URLSearchParams(location.search);
  const cfg = W.settings.decode(K.settings.SCHEMA, q);
  const demo = q.get('demo') === '1';
  const root = document.getElementById('w'), el = document.getElementById('lb'), stage = document.querySelector('.stage');
  const rm = W.theme.reducedMotion(q), calm = cfg.motion === 'calm';
  if (rm) document.documentElement.classList.add('rm');
  W.theme.apply(root, { theme: cfg.theme, accent: cfg.accent });
  W.theme.listen(root);
  root.style.setProperty('--bgo', String(cfg.bgo / 100));
  root.classList.toggle('clear', cfg.bgo === 0);
  const strip = cfg.lbshape === 'strip';
  const [BW, BH] = strip ? K.settings.SIZES.strip : K.settings.SIZES.panel(cfg.lbn);
  const fit = () => { const k = Math.min(innerWidth / BW, innerHeight / BH) || 1; stage.style.transform = `translate(${(innerWidth - BW * k) / 2}px, ${(innerHeight - BH * k) / 2}px) scale(${k})`; };
  addEventListener('resize', fit); fit();

  const channels = { twitch: W.platforms.twitch.channel(cfg.twitch), kick: W.platforms.kick.channel(cfg.kick) };   // exactly as the board names its save
  const pair = `${channels.twitch}|${channels.kick}`;
  const KEY = demo ? 'chaplinko:scores:demo' : `chaplinko:scores:v1:${pair}`;
  const both = demo || (channels.twitch && channels.kick);
  const lb = K.leaderboard(el, { shape: cfg.lbshape, n: cfg.lbn, show: cfg.lbshow, every: cfg.lbevery, remember: cfg.remember, rm, calm, dots: !!both, cmd: '!drop' });
  let last = '';
  function read() {
    let raw = null; try { raw = localStorage.getItem(KEY); } catch {}
    if (raw === last) return;
    last = raw;
    let rec = null; try { rec = JSON.parse(raw || 'null'); } catch {}
    lb.update(K.leaderboard.lists(W.scores(rec, { now: () => Date.now() }), cfg.lbn));
  }
  read(); lb.start();
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(demo ? 'chaplinko:demo' : `chaplinko:${pair}`) : null;
  if (bc) bc.onmessage = (e) => { const d = e.data || {}; if (d.type === 'scores') read(); if (d.type === 'jackpot') { read(); lb.jackpot(d.key); } };
  addEventListener('storage', (e) => { if (e.key === KEY) read(); });
  setInterval(read, 5000);
  document.documentElement.dataset.ready = '1';
  window.chaplinkoLeaderboard = { lb, read, cfg };
})();
