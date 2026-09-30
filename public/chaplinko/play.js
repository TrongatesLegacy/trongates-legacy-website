// Chaplinko's board: reads chat, runs the rules (game.js) and the physics (physics.js), and draws it all on one canvas.
// docs/widgets.md, "Chaplinko".
//
// One animation loop, running only while something moves or fades (an idle board costs nothing), stepping the physics
// at a fixed 120 steps a second (slower or faster for the speed setting). How much each ball gets drawn depends on how
// busy the board is (game.level: quiet, busy, frenzy). The scores are saved in this browser (scores.js, the same record
// Chatagram uses) and announced on a BroadcastChannel, which is how the separate leaderboard (leaderboard.html) follows
// them. Whether the channel is live comes from Twitch or Kick, as in Chatagram.
//
// Link: the settings (settings.js). Also: demo=1 (a pretend chat plays), still=1&screen=play|jackpot (a frozen moment, for
// pictures), motion=reduce|calm|full. window.chaplinko is there for tests.
(async () => {
  const W = window.Widgets, K = window.Chaplinko, P = K.physics;
  const q = new URLSearchParams(location.search);
  const cfg = W.settings.decode(K.settings.SCHEMA, q);
  const demo = q.get('demo') === '1', still = q.get('still') === '1', screen = q.get('screen') || 'play';
  const $ = (s, el = document) => el.querySelector(s);
  const root = $('#w'), boardEl = $('#board'), stage = $('.stage'), chute = $('#chute'), cv = $('#cv');
  const rm = W.theme.reducedMotion(q), calm = cfg.motion === 'calm';
  if (rm) document.documentElement.classList.add('rm');
  root.classList.toggle('calm', calm);
  W.theme.apply(root, { theme: cfg.theme, accent: cfg.accent });
  root.style.setProperty('--bgo', String(cfg.bgo / 100));
  boardEl.classList.toggle('clear', cfg.bgo === 0);          // the board's own; the leaderboard beside it has its own (lbbgo)
  const combined = cfg.layout === 'combined' && cfg.side !== 'off';
  root.classList.toggle('left', combined && cfg.side === 'left');
  const [BW, BH] = combined ? K.settings.SIZES.combined : K.settings.SIZES.separate;
  if (!cfg.credit) $('.credit').remove();

  // ---- fit the browser source (any other shape than the layout's is centred); the canvas is drawn at the real size --------
  let fitK = 1;
  const fit = () => {
    fitK = Math.min(innerWidth / BW, innerHeight / BH) || 1;
    stage.style.transform = `translate(${(innerWidth - BW * fitK) / 2}px, ${(innerHeight - BH * fitK) / 2}px) scale(${fitK})`;
    sizeCanvas();
  };
  const ctx = cv.getContext('2d');
  function sizeCanvas() {
    const r = Math.max(1, Math.min(3, (devicePixelRatio || 1) * fitK));
    cv.width = Math.round(640 * r); cv.height = Math.round(540 * r); ctx.setTransform(r, 0, 0, r, 0, 0);
    draw();
  }

  const channels = { twitch: W.platforms.twitch.channel(cfg.twitch), kick: W.platforms.kick.channel(cfg.kick) };
  const platforms = Object.keys(channels).filter((p) => channels[p]);
  const shownPlatforms = demo || still ? (platforms.length ? platforms : ['twitch', 'kick']) : platforms;
  const cmdName = K.settings.command(cfg);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const anim = (el, frames, opts) => (rm || !el || !el.animate ? null : el.animate(frames, opts));

  // ---- the clock, seeded randomness (still pictures) --------------------------------------------------------------------
  let offset = 0, frozen = 0;
  const now = () => (frozen || Date.now()) + offset;
  let rseed = still ? 7 : (Math.random() * 4294967296) >>> 0;
  const seeded = () => { rseed = (rseed + 0x6d2b79f5) >>> 0; let t = rseed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---- saved: the scores (shared with the separate leaderboard) and today's jackpots ---------------------------------------
  const pair = `${channels.twitch}|${channels.kick}`;
  const SCORES = demo || still ? 'chaplinko:scores:demo' : `chaplinko:scores:v1:${pair}`, SAVE = `chaplinko:v1:${pair}`;
  let savedScores = null, saved = null;
  if (!demo && !still) try { savedScores = JSON.parse(localStorage.getItem(SCORES) || 'null'); saved = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch {}
  const scores = W.scores(demo || still ? pretendScores() : savedScores, { now });
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(demo || still ? 'chaplinko:demo' : `chaplinko:${pair}`) : null;
  let saveTimer = null;
  // a pretend board only shares its scores when asked (share=1: the set-up page's preview, paired with its pretend leaderboard)
  const shares = !still && (!demo || q.get('share') === '1');
  const writeSaves = () => { if (!shares) return; try { localStorage.setItem(SCORES, JSON.stringify(scores.record)); if (!demo) localStorage.setItem(SAVE, JSON.stringify(game.snapshot())); } catch {} if (bc) bc.postMessage({ type: 'scores' }); };
  const save = () => { if (still || saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; writeSaves(); lbRefresh(); }, 250); };
  // the preview and pictures: made-up players (every name is made up)
  function pretendScores() {
    const t = Date.now(), pf = (i) => (shownPlatforms.length > 1 ? shownPlatforms[i % 2] : shownPlatforms[0] || 'twitch');
    const list = (rows) => Object.fromEntries(rows.map(([name, score], i) => [`${pf(i)}:${name.toLowerCase()}`, { name, platform: pf(i), score, words: Math.ceil(score / 6) }]));
    return { v: 1, status: 'live', checkedAt: t, primary: pf(0), log: [],
      allTime: list([['NeonNacho', 4488], ['CaptainQuack', 4325], ['PixelPanda', 3852], ['ByteSizeBea', 2960], ['SleepyWaffle', 2210], ['LunaLlama', 1804], ['TurboTofu', 1377], ['GridRunner', 950], ['KevXD', 604], ['Sprout', 312]]),
      stream: { ids: { [pf(0)]: 'pretend' }, started: t - 3600000, lastSeen: t, players: list([['CaptainQuack', 1284], ['PixelPanda', 1122], ['MossyMoose', 865], ['NeonNacho', 640], ['LunaLlama', 512], ['KevXD', 377], ['Sprout', 240], ['TurboTofu', 180], ['GridRunner', 96], ['ByteSizeBea', 40]]) } };
  }

  // ---- the physics and the rules -----------------------------------------------------------------------------------------
  const world = P.world({ rows: cfg.rows });
  const L = world.layout;
  const game = K.game(cfg, { now, layout: L, saved, award: (m, pts, n) => scores.award(m, pts, n) });
  const SPEED = { slow: 0.75, normal: 1, fast: 1.3 }[cfg.speed];

  // ---- colours: read from the theme, mixed here (the canvas can't use CSS variables) ----------------------------------------
  const probe = document.createElement('canvas').getContext('2d');
  const rgba = (c) => {
    probe.fillStyle = '#000'; probe.fillStyle = String(c || '').trim() || '#000';
    const v = probe.fillStyle;
    if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    const m = v.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1];
  };
  const css = ([r, g, b, a = 1]) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  // mixing in Oklab, so blue to orange goes through purple and pink, not mud
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const toLab = ([r, g, b]) => {
    r = lin(r); g = lin(g); b = lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const fromLab = ([L_, a, b]) => {
    const l = (L_ + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L_ - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L_ - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => Math.max(0, Math.min(255, gam(x))));
  };
  // mixing in OKLCH (by hue, the short way round), so blue to orange goes through purple and pink, not grey or brown
  const mix = (a, b, t) => {
    const A = toLab(a), B = toLab(b), ca = Math.hypot(A[1], A[2]), cb = Math.hypot(B[1], B[2]);
    let ha = Math.atan2(A[2], A[1]), hb = Math.atan2(B[2], B[1]);
    if (ca < 0.02) ha = hb; if (cb < 0.02) hb = ha;                                   // a grey has no hue of its own
    let dh = hb - ha; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
    const l = A[0] + (B[0] - A[0]) * t, c = ca + (cb - ca) * t, h = ha + dh * t;
    return [...fromLab([l, c * Math.cos(h), c * Math.sin(h)]), (a[3] ?? 1) + ((b[3] ?? 1) - (a[3] ?? 1)) * t];
  };
  let C = {};
  function readPalette() {
    // the board's own colours (a transparent Light or Cozy board swaps in light text: play.css), and the theme's own text
    // for things drawn on the theme's own light surfaces (the slots, the tallies)
    const s = getComputedStyle(boardEl), v = (k) => s.getPropertyValue(k).trim(), own = v('--text');
    C = { accent: rgba(v('--accent')), ink: rgba(v('--accent-ink')), text: rgba(v('--ontop')), muted: rgba(v('--ontop-muted')), slot: rgba(v('--slot')), panel: rgba(v('--panel')), gold: rgba(v('--gold')),
      surfaceText: rgba(own), display: `${v('--display-weight') || 400} {px}px ${v('--display') || 'sans-serif'}`, font: v('--font') || 'sans-serif' };
    C.peg = css(mix(C.text, C.accent, 0.15));
    const values = game.values, max = Math.max(...values);
    C.slots = values.map((val) => (val === max ? css(C.gold) : css(mix(C.slot[3] < 1 ? [...C.slot.slice(0, 3), 1] : C.slot, C.accent, Math.pow(val / max, 0.45) * 0.85))));
    C.slotInk = values.map((val) => (val === max || val / max > 0.3 ? css(C.ink) : css(C.surfaceText)));
    colorCache.clear();
    draw();
  }
  const font = (px) => C.display.replace('{px}', px);

  // ---- ball colours: the chatter's chat colour (lightened if too dark to see), the accent, the platform, or rainbow ------------
  const colorCache = new Map();
  let hue = 0;
  function ballColor(by) {
    if (cfg.color === 'accent') return css(C.accent);
    if (cfg.color === 'platform') return by.platform === 'kick' ? '#53fc18' : '#9146ff';
    if (cfg.color === 'rainbow') { hue = (hue + 47) % 360; return `hsl(${hue} 90% 62%)`; }
    const c = by.color; if (!c) return css(C.accent);
    if (!colorCache.has(c)) {
      const x = rgba(c), lab = toLab(x);
      colorCache.set(c, lab[0] < 0.55 ? css(mix(x, [255, 255, 255, 1], (0.55 - lab[0]) / 0.45 * 0.8)) : css(x));
    }
    return colorCache.get(c);
  }
  // emote pictures (only from Twitch's and Kick's own image servers, found by the platform): loaded once each. A canvas
  // only ever draws an animated GIF's first frame, so an animated emote's frames are decoded (ImageDecoder: both image
  // servers allow reading the file, and OBS's browser has it) and played while the ball falls. Without ImageDecoder, or
  // for a still emote, the picture as it is.
  const images = new Map(), MAX_FRAMES = 100;   // 100 frames of a 56–70 px emote is under 2 MB; at most 80 emotes kept
  function image(url) {
    if (images.has(url)) return images.get(url);
    const img = new Image(); const rec = { img, ok: false, bad: false, frames: null, total: 0 };
    img.onload = () => { rec.ok = true; }; img.onerror = () => { rec.bad = true; };
    img.src = url; images.set(url, rec);
    if (images.size > 80) { const [, old] = images.entries().next().value; images.delete(images.keys().next().value); if (old.frames) old.frames.forEach((f) => f.bmp.close()); }
    animate(url, rec);
    return rec;
  }
  async function animate(url, rec) {
    if (!('ImageDecoder' in window) || rm) return;
    try {
      const r = await fetch(url, { mode: 'cors' }); if (!r.ok) return;
      const data = new Uint8Array(await r.arrayBuffer()), head = String.fromCharCode(...data.slice(0, 12));
      const type = head.startsWith('GIF8') ? 'image/gif' : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP' ? 'image/webp' : '';
      if (!type) return;                                                     // a PNG: still
      const dec = new window.ImageDecoder({ data, type });
      await dec.tracks.ready;
      const track = dec.tracks.selectedTrack;
      if (!track || !track.animated) { dec.close(); return; }
      await dec.completed;
      const frames = []; let total = 0;
      for (let i = 0; i < Math.min(track.frameCount, MAX_FRAMES); i++) {
        const { image: f } = await dec.decode({ frameIndex: i });
        const bmp = await createImageBitmap(f);
        total += Math.max(20, (f.duration || 100000) / 1000); f.close();   // durations are in microseconds; GIFs under 20 ms play at 100 ms in browsers, near enough
        frames.push({ bmp, until: total });
      }
      dec.close();
      if (frames.length > 1) { rec.frames = frames; rec.total = total; rec.ok = true; } else frames.forEach((f) => f.bmp.close());
    } catch {}
  }
  const frameOf = (rec) => { if (!rec.frames) return rec.img; const t = performance.now() % rec.total; return (rec.frames.find((f) => t < f.until) || rec.frames[0]).bmp; };
  // a white shine drawn over every ball (one picture, not a gradient per ball)
  const shine = document.createElement('canvas'); shine.width = shine.height = 64;
  { const g = shine.getContext('2d'), gr = g.createRadialGradient(22, 19, 0, 22, 19, 40); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(0.35, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill(); }

  // ---- effects: everything that fades, drawn on the canvas ---------------------------------------------------------------
  const heat = new Float32Array(L.pegs.length), heatColor = new Array(L.pegs.length).fill('');
  const pegIndex = new Map(L.pegs.map((p, i) => [p, i]));
  let rings = [], sparks = [], nums = [], confetti = [], beams = [], ripples = [], shocks = [], appear = 0;
  const slotFx = L.pegs.length ? new Array(L.slots.n).fill(null) : [];
  const tallies = new Array(L.slots.n).fill(null).map(() => ({ n: 0, at: 0, bump: 0 }));
  let slowUntil = 0, wobble = null;
  const lv = () => game.level;

  function onHit(e) {
    const i = pegIndex.get(e.peg), c = e.ball.data.color;
    if (!calm) { heat[i] = Math.min(1, heat[i] + (lv() === 'frenzy' ? 0.3 : 0.45)); heatColor[i] = c; }
    if (lv() === 'quiet') { rings.push({ x: e.peg.x, y: e.peg.y, c, t: 0, r: e.peg.r }); e.ball.squash = 1; }
    else if (lv() === 'busy') heat[i] = Math.max(heat[i], 0.6);
  }
  function onLand(by, slot, x, color) {
    const res = game.land(by, slot, x), level = lv(), cx = L.slots.x0 + (slot + 0.5) * L.slots.w;
    save();
    if (level === 'frenzy') { const t = tallies[slot]; if (now() - t.at > 2000) t.n = 0; t.n++; t.at = now(); t.bump = 1; }
    else slotFx[slot] = { t: 0, color };
    const showNum = level === 'quiet' || (level === 'busy' && res.tier !== 'low') || res.tier === 'jackpot';
    if (showNum) number(cx, L.slots.y - 14, '+' + res.pts, res.tier === 'low' ? css(C.text) : color, res.tier === 'jackpot' ? 26 : res.tier === 'big' ? 20 : res.tier === 'high' ? 17 : 13, slot);
    const sparkle = !calm && (res.tier === 'jackpot' || (res.tier === 'big' && level !== 'frenzy') || (res.tier === 'high' && level === 'quiet'));
    if (sparkle) for (let i = 0; i < (res.tier === 'jackpot' ? 14 : 6); i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 90; sparks.push({ x: cx, y: L.slots.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, c: i % 2 ? color : css(C.text), t: 0 }); }
    if (res.near && level === 'quiet' && !rm) { number(cx, L.slots.y - 46, 'so close!', css(C.gold), 15, -1, true); wobble = { slot: slot + (game.values[slot + 1] === game.top ? 1 : -1), t: 0 }; }
    if (res.tier === 'big' && res.card && level !== 'frenzy') toast(by, res.pts);
    if (res.tier === 'jackpot') {
      if (bc && shares) bc.postMessage({ type: 'jackpot', key: `${by.platform}:${by.user}` });
      if (lbc) lbc.jackpot(`${by.platform}:${by.user}`);
      if (res.card && !(still && screen !== 'jackpot')) jackpot({ by, res, slot, color });   // a still picture only shows the card when asked
    }
    return res;
  }
  // numbers floating up from a slot: the same slot within 0.3 s merges ("+2 ×3")
  function number(x, y, text, c, size, slot, italic) {
    const t = now(), last = slot >= 0 && nums.find((n) => n.slot === slot && t - n.at < 300 && n.base === text);
    if (last) { last.times++; last.text = `${text} ×${last.times}`; last.t = 0; return; }
    nums.push({ x, y, text, base: text, c, size, slot, italic, t: 0, at: t, times: 1 });
  }

  // ---- the chute: the commands, or what's happening ---------------------------------------------------------------------
  let chuteHtml = null, goUntil = 0, lastDropAt = Date.now(), idleTimer = null;
  function drawChute() {
    const level = lv(), queued = game.queued;
    let h = '';
    if (game.paused) h = '<span class="m">❚❚</span> PAUSED';
    else if (Date.now() < goUntil) h = '<span class="a">GO!</span>';
    else if (level === 'frenzy') h = `<span class="a">FRENZY</span>${queued ? ` <span class="m">·</span> +${queued} waiting` : ''}`;
    else if (queued) h = `<span class="a">×${queued}</span> more coming`;
    else if (cfg.showcmd) h = `${esc(cmdName)} <span class="m">·</span> ${esc(cmdName)} <span class="a">:emote:</span>`;
    else h = leaderLine();                                   // commands off: who leads (or the name, before anyone has)
    if (h !== chuteHtml) { chuteHtml = h; chute.innerHTML = h; }
    root.classList.toggle('frenzy', level === 'frenzy');
  }
  // the chute without the commands: This stream's leader (or All time's when not live), else the game's name
  let leaderCache = '', leaderAt = 0;
  function leaderLine() {
    if (Date.now() - leaderAt < 500) return leaderCache;
    leaderAt = Date.now();
    const { stream, all } = K.leaderboard.lists(scores, 1), p = (stream.kind === 'stream' && stream.list[0]) || all[0];
    leaderCache = p ? `<span class="lead"></span><span class="m">${stream.kind === 'stream' && stream.list[0] ? 'LEADING' : 'ALL-TIME #1'}</span> ${esc(p.name)} <span class="a">${K.leaderboard.fmt(p.score)}</span>` : '<span class="nm">CHAPLINKO</span>';
    return leaderCache;
  }
  function dropped() {
    lastDropAt = Date.now(); chute.classList.remove('idle'); clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!game.paused) chute.classList.add('idle'); }, 60000);   // idle a minute: a shine along the commands
  }
  let lastGulp = 0;
  function gulp() {
    if (calm || lv() === 'frenzy' || Date.now() - lastGulp < 110) return;
    lastGulp = Date.now();
    anim(chute, [{ transform: 'translateX(-50%) scale(1, 1)' }, { transform: 'translateX(-50%) scale(1.06, .82)', offset: 0.35 }, { transform: 'translateX(-50%) scale(.98, 1.05)', offset: 0.7 }, { transform: 'translateX(-50%)' }], { duration: 220, easing: 'ease-out' });
  }

  // ---- dropping a ball ---------------------------------------------------------------------------------------------------
  function spawn(it) {
    const color = ballColor(it.by), seed = still ? (seeded() * 4294967296) >>> 0 : (Math.random() * 4294967296) >>> 0;
    const data = { by: it.by, item: it.item, color };
    if (it.item && it.item.kind === 'emote') data.img = image(it.item.url);
    if (rm) { const r = P.drop(seed, { rows: cfg.rows }); onLand(it.by, r.slot, L.slots.x0 + (r.slot + 0.5) * L.slots.w, color); return; }   // reduced motion: nothing falls
    const b = world.add({ seed, data }); b.trail = []; b.squash = 0;
    gulp();
  }

  // ---- the jackpot: one live card that grows into a streak ----------------------------------------------------------------------
  // The first jackpot opens the card: slow motion (not in Frenzy), the card springing in, confetti and a shake. A jackpot that
  // lands while the card is up joins it instead of waiting behind it: the count punches up (JACKPOT! ×2, ×3…), a new name slides
  // in (the same person again: "PixelPanda ×2"), the points count on and more confetti bursts. Every jackpot fires its own beam
  // and ripple from its slot. The card leaves 2 s after the last one (at least 4 s after it opened; 2 s in Frenzy), so it's
  // always about what just happened, never a queue running behind.
  let jc = null;
  const STREAK_HOLD = 2000;
  const who = (b) => `${shownPlatforms.length > 1 ? `<span class="dot ${b.platform === 'kick' ? 'kk' : 'tw'}"></span>` : ''}${esc(b.name)}`;
  function jackpot(j) {
    const cx = L.slots.x0 + (j.slot + 0.5) * L.slots.w, frenzy = lv() === 'frenzy';
    if (!rm && !calm) { beams.push({ x: cx, t: 0 }); ripples.push({ x: cx, y: L.slots.y, t: 0 }); kick(); }
    if (!jc) openCard(j, frenzy); else addToCard(j);
    const stay = frenzy ? 2000 : 4000;
    clearTimeout(jc.timer);
    jc.timer = setTimeout(closeCard, Math.max(jc.openedAt + stay - Date.now(), jc.count > 1 ? STREAK_HOLD : 0));
  }
  function burst(n, delay = 0) {
    if (rm || calm) return;
    setTimeout(() => { for (let i = 0; i < n; i++) { const left = i % 2, a = (left ? -0.35 : -2.8) + (Math.random() - 0.5) * 0.9, s = 380 + Math.random() * 380; confetti.push({ x: left ? 10 : 630, y: 530, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, c: [css(C.gold), css(C.accent), css(C.text), '#2ee6a8', '#5ad1ff'][i % 5], w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, t: 0 }); } kick(); }, delay);
  }
  function openCard(j, frenzy) {
    if (!rm && !calm) { if (!frenzy) slowUntil = now() + 400; burst(80, 700); setTimeout(shake, 700); }
    const dim = document.createElement('div'); dim.className = 'dim';
    const card = document.createElement('div'); card.className = 'card';
    const oneIn = game.oneIn(j.slot), nth = ['', 'the first', 'the second', 'the third'][j.res.nth] || `number ${j.res.nth}`;
    card.innerHTML = `<div class="k"><span class="jk">${[...'JACKPOT!'].map((c) => `<span>${c}</span>`).join('')}</span><span class="x" hidden></span></div>` +
      `<div class="names"></div><div class="pts">+0</div><div class="sub">${oneIn ? `1 in ${oneIn.toLocaleString('en')} · ` : ''}${nth} today</div>`;
    boardEl.append(dim, card);
    jc = { card, dim, count: 0, people: new Map(), total: 0, shown: 0, openedAt: Date.now(), oneIn, timer: null, firstNth: j.res.nth };
    anim(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'backwards' });
    const cardIn = anim(card, [{ transform: 'translate(-50%, -50%) rotate(-8deg) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -50%) rotate(-1deg) scale(1.08)', opacity: 1, offset: 0.65 }, { transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)', opacity: 1 }], { duration: 480, delay: rm ? 0 : 450, easing: 'ease-out', fill: 'backwards' });
    if (!cardIn) card.style.opacity = '1';
    [...card.querySelectorAll('.jk span')].forEach((s, i) => anim(s, [{ transform: 'translateY(26px) scale(.4)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 520 + i * 45, easing: 'ease-out', fill: 'backwards' }));
    addToCard(j, true);
  }
  function addToCard(j, first) {
    const c = jc, key = `${j.by.platform}:${j.by.user}`;
    c.count++; c.total += j.res.pts;
    const p = c.people.get(key) || { by: j.by, n: 0 }; p.n++; c.people.set(key, p);
    // the names: up to three, each with ×N when they hit more than once, then "+N more"
    const list = [...c.people.values()], names = c.card.querySelector('.names');
    names.innerHTML = list.slice(0, 3).map((x) => `<div class="who" data-key="${esc(`${x.by.platform}:${x.by.user}`)}">${who(x.by)}${x.n > 1 ? ` <b class="times">×${x.n}</b>` : ''}</div>`).join('') + (list.length > 3 ? `<div class="more">+${list.length - 3} more</div>` : '');
    if (!first) {
      const x = c.card.querySelector('.x'); x.hidden = false; x.textContent = `×${c.count}`;
      c.card.querySelector('.sub').textContent = `${c.count} jackpots in a row${c.oneIn ? ` · 1 in ${c.oneIn.toLocaleString('en')} each` : ''}`;
      anim(x, [{ transform: 'scale(2.2)', opacity: 0 }, { transform: 'scale(.9)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' });
      anim(c.card, [{ transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)' }, { transform: 'translate(-50%, -50%) rotate(-4deg) scale(1.07)', offset: 0.35 }, { transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)' }], { duration: 360, easing: 'ease-out' });
      const row = c.card.querySelector(`.who[data-key="${CSS.escape(key)}"]`);
      if (row) anim(row, p.n > 1 ? [{ transform: 'scale(1.25)' }, { transform: 'none' }] : [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'ease-out' });
      burst(40);
    }
    // the points count on from where they are to the streak's total
    const ptsEl = c.card.querySelector('.pts'), from = c.shown, to = c.total;
    if (rm) { ptsEl.textContent = '+' + to; c.shown = to; return; }
    const t0 = performance.now() + (first ? 600 : 0), me = (c.countId = (c.countId || 0) + 1);
    const up = (t) => { if (c.countId !== me) return; const k = Math.max(0, Math.min(1, (t - t0) / 600)); c.shown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); ptsEl.textContent = '+' + c.shown; if (k < 1) requestAnimationFrame(up); };
    requestAnimationFrame(up);
  }
  // the end: the card swells and flashes, then explodes into shards of itself and sparks, with a shockwave across the board
  // (calm or reduced motion: it just fades)
  function closeCard() {
    const c = jc; if (!c) return;
    jc = null;                                                          // a jackpot from now on opens a fresh card
    anim(c.dim, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: calm ? 0 : 220, fill: 'forwards' });
    const done = () => { c.card.remove(); c.dim.remove(); };
    if (rm) return done();
    if (calm) { const a = anim(c.card, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); if (a) a.onfinish = done; else done(); return; }
    const swell = anim(c.card, [{ transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)', filter: 'brightness(1)' }, { transform: 'translate(-50%, -50%) rotate(-3deg) scale(1.12)', filter: 'brightness(1.8)', offset: 0.75 }, { transform: 'translate(-50%, -50%) rotate(0deg) scale(1.3)', filter: 'brightness(3)', opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    const boom = () => {
      const r = c.card.getBoundingClientRect(), b = boardEl.getBoundingClientRect(), k = b.width / 640 || 1;
      const x = (r.left + r.width / 2 - b.left) / k, y = (r.top + r.height / 2 - b.top) / k, w = r.width / k, h = r.height / k;
      shocks.push({ x, y, t: 0 });
      const shard = css(C.panel), edge = css(C.gold);
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2, sp = 250 + Math.random() * 650, big = i < 34;
        confetti.push({ x: x + (Math.random() - 0.5) * w * 0.8, y: y + (Math.random() - 0.5) * h * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18,
          c: big ? (i % 3 ? shard : edge) : [edge, css(C.accent), css(C.text), '#fff'][i % 4], w: big ? 12 + Math.random() * 16 : 4 + Math.random() * 5, h: big ? 8 + Math.random() * 10 : 3 + Math.random() * 3, t: 0.3 });
      }
      done(); kick();
    };
    if (swell) swell.onfinish = boom; else boom();
  }

  function shake() { anim(boardEl, [{ transform: 'none' }, { transform: 'translate(-4px, 2px)' }, { transform: 'translate(4px, -2px)' }, { transform: 'translate(-2px, 1px)' }, { transform: 'none' }], { duration: 320 }); }
  function toast(by, pts) {
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `<b>BIG WIN</b>${shownPlatforms.length > 1 ? `<span class="dot ${by.platform === 'kick' ? 'kk' : 'tw'}"></span>` : ''}${esc(by.name)} <span>+${pts}</span>`;
    boardEl.appendChild(t);
    const a = anim(t, [{ transform: 'translateX(-120%)', opacity: 0 }, { transform: 'translateX(6px)', opacity: 1, offset: 0.12 }, { transform: 'none', opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1, offset: 0.88 }, { transform: 'translateX(-120%)', opacity: 0 }], { duration: 2500, easing: 'ease-out' });
    if (a) a.onfinish = () => t.remove(); else setTimeout(() => t.remove(), 2500);
  }

  // ---- drawing -----------------------------------------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  const clear = () => cfg.bgo === 0;
  function draw() {
    if (!C.slots) return;
    const t = now(), level = lv(), sh = clear();
    ctx.clearRect(0, 0, 640, 540);
    // the pegs (appearing row by row when the board loads); hot pegs glow in the colour of the ball that hit them
    for (let i = 0; i < L.pegs.length; i++) {
      const p = L.pegs[i], k = appear >= 1 ? 1 : Math.max(0, Math.min(1, (appear * 800 - p.row * 30) / 200));
      if (!k) continue;
      let r = p.r * k, rip = 0;
      for (const w of ripples) { const d = Math.hypot(p.x - w.x, p.y - w.y), front = w.t * 900; rip = Math.max(rip, Math.max(0, 1 - Math.abs(d - front) / 45) * (1 - w.t / 0.6)); }
      if (heat[i] > 0.02 || rip > 0.02) {
        ctx.globalAlpha = Math.min(1, heat[i] * 0.55 + rip * 0.6); ctx.fillStyle = rip > heat[i] ? css(C.gold) : heatColor[i];
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
      if (sh) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(p.x + 0.8, p.y + 1.4, r + 0.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = rip > 0.3 ? css(C.gold) : heat[i] > 0.5 ? heatColor[i] : C.peg;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(p.x - r * 0.28, p.y - r * 0.28, r * 0.42, 0, TAU); ctx.fill();
    }
    // rings where balls hit pegs (quiet)
    for (const g of rings) { const k = g.t / 0.25; ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = g.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, g.r + 3 + k * 10, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // the beam from a jackpot slot
    for (const beam of beams) { const k = beam.t / 0.7, g = ctx.createLinearGradient(0, L.slots.y, 0, 0); g.addColorStop(0, css([...C.gold.slice(0, 3), 0.85 * (1 - k)])); g.addColorStop(1, css([...C.gold.slice(0, 3), 0])); ctx.fillStyle = g; ctx.fillRect(beam.x - L.slots.w * 0.42, 0, L.slots.w * 0.84, L.slots.y); }
    // the slots: dip and flash when a ball lands; a tally in Frenzy; the top slot glows
    const rise = appear >= 1 ? 0 : Math.max(0, 1 - Math.max(0, appear * 800 - 300) / 400);
    const max = Math.max(...game.values);
    for (let s = 0; s < L.slots.n; s++) {
      const fx = slotFx[s], k = fx ? fx.t / 0.2 : 1, dip = fx && k < 1 ? Math.sin(Math.PI * k) * 3 : 0, sc = fx && k < 1 ? 1 + Math.sin(Math.PI * k) * 0.08 : 1;
      let rot = 0; if (wobble && wobble.slot === s) rot = Math.sin(wobble.t * 30) * 0.08 * (1 - wobble.t / 0.7);
      const x = L.slots.x0 + s * L.slots.w, y = L.slots.y + dip + rise * 30, w = L.slots.w, h = L.slots.h, cx = x + w / 2, cy = y + h / 2;
      ctx.save(); ctx.globalAlpha = 1 - rise; ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      if (game.values[s] === max) { ctx.globalAlpha *= 0.45; ctx.fillStyle = C.slots[s]; rrect(x - 2, y - 2, w + 1, h + 4, 9); ctx.filter = 'blur(5px)'; ctx.fill(); ctx.filter = 'none'; ctx.globalAlpha = 1 - rise; }
      if (sh) { ctx.fillStyle = 'rgba(0,0,0,.4)'; rrect(x + 2.5, y + 2, w - 3, h, 6); ctx.fill(); }
      ctx.fillStyle = C.slots[s]; rrect(x + 1.5, y, w - 3, h, 6); ctx.fill();
      if (fx && fx.t < 0.5) { ctx.globalAlpha = (1 - fx.t / 0.5) * 0.55 * (1 - rise); ctx.fillStyle = fx.color; rrect(x + 1.5, y, w - 3, h, 6); ctx.fill(); ctx.globalAlpha = 1 - rise; }
      const v = String(game.values[s]), size = w < 36 ? (v.length > 2 ? 10 : 12) : v.length > 2 ? 13 : 15;
      ctx.font = font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.slotInk[s]; ctx.fillText(v, cx, cy + 1);
      ctx.restore();
      const tl = tallies[s];
      if (level === 'frenzy' || t - tl.at < 2600) {
        const age = t - tl.at;
        if (tl.n && age < 2600) {
          const a = age < 2000 ? 1 : 1 - (age - 2000) / 600, b = 1 + tl.bump * 0.25;
          ctx.globalAlpha = a; ctx.fillStyle = css(C.panel); rrect(cx - w * 0.36 * b, L.slots.y - 24, w * 0.72 * b, 17 * b, 8); ctx.fill();
          ctx.fillStyle = css(C.surfaceText); ctx.font = font(11 * b); ctx.fillText('×' + tl.n, cx, L.slots.y - 15.5); ctx.globalAlpha = 1;
        }
      }
    }
    // the balls: a trail (quiet: long, busy: short, frenzy: none), the ball in its colour with a shine, or the emote
    const trailLen = calm || level === 'frenzy' ? 0 : level === 'busy' ? 3 : 6;
    for (const b of world.balls) {
      const c = b.data.color;
      if (trailLen && b.trail) for (let i = 0; i < Math.min(trailLen, b.trail.length); i++) { const p = b.trail[b.trail.length - 1 - i]; ctx.globalAlpha = 0.16 * (1 - i / trailLen); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0], p[1], b.r * (1 - i * 0.08), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      const item = b.data.item;
      if (item && item.kind === 'emoji') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); ctx.font = `${Math.round(b.r * 1.9)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (sh) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1; }
        ctx.fillText(item.text, 0, 1); ctx.restore(); continue;
      }
      if (item && item.kind === 'emote' && b.data.img && b.data.img.ok) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
        if (sh) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1; }
        ctx.drawImage(frameOf(b.data.img), -b.r * 1.05, -b.r * 1.05, b.r * 2.1, b.r * 2.1); ctx.restore(); continue;
      }
      if (sh) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(b.x + 1, b.y + 2, b.r, 0, TAU); ctx.fill(); }
      const sq = b.squash > 0 ? 1 - b.squash * 0.06 : 1;
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r / sq, b.r * sq, 0, 0, TAU); ctx.fill();
      ctx.drawImage(shine, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    // sparkles, floating numbers, confetti
    for (const s of sparks) { const k = s.t / 0.6; ctx.globalAlpha = 1 - k; ctx.fillStyle = s.c; star(s.x, s.y, 4.5 * (1 - k * 0.5)); }
    ctx.globalAlpha = 1;
    for (const n of nums) {
      const k = n.t / 0.9;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = (n.italic ? 'italic ' : '') + font(n.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = n.y - (rm ? 0 : k * 40);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(n.text, n.x + 1, y + 1.5);
      ctx.fillStyle = n.c; ctx.fillText(n.text, n.x, y);
    }
    ctx.globalAlpha = 1;
    // the card's explosion: a shockwave ring and a flash
    for (const w of shocks) { const k = w.t / 0.55; ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = css(C.gold); ctx.lineWidth = 10 * (1 - k) + 1; ctx.beginPath(); ctx.arc(w.x, w.y, 30 + k * 360, 0, TAU); ctx.stroke(); ctx.globalAlpha = (1 - k) * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w.x, w.y, 30 + k * 140, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const f of confetti) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 1.6) / 0.6); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.fillStyle = f.c; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  function star(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.28, y - s * 0.28); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.28, y + s * 0.28); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.28, y + s * 0.28); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.28, y - s * 0.28); ctx.fill(); }

  // ---- the loop: only while something moves or fades -------------------------------------------------------------------------
  let running = false, last = 0, acc = 0;
  const caps = () => { if (sparks.length > 150) sparks.splice(0, sparks.length - 150); if (rings.length > 60) rings.splice(0, rings.length - 60); if (nums.length > 40) nums.splice(0, nums.length - 40); };
  function busy() {
    const t = now();
    return world.balls.length || game.queued || rings.length || sparks.length || nums.length || confetti.length || beams.length || ripples.length || shocks.length || wobble || appear < 1 ||
      heat.some((h) => h > 0.02) || slotFx.some((f) => f && f.t < 0.5) || tallies.some((x) => x.n && t - x.at < 2600);
  }
  function kick() { if (!running && !still) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(ts) {
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000)); last = ts;
    tick(dt);
    draw(); drawChute();
    if (busy()) requestAnimationFrame(frame); else { running = false; draw(); }
  }
  function tick(dt) {
    for (const it of game.take(world.balls.length)) spawn(it);
    const slow = now() < slowUntil ? 0.33 : 1;
    acc += dt * SPEED * slow;
    let steps = 0;
    while (acc >= P.STEP && steps < 40) {
      acc -= P.STEP; steps++;
      for (const e of world.step()) {
        if (e.type === 'hit') onHit(e);
        else if (e.type === 'land') onLand(e.ball.data.by, e.slot, e.x, e.ball.data.color);
      }
    }
    if (acc > P.STEP * 40) acc = 0;
    for (const b of world.balls) { if (b.trail) { b.trail.push([b.x, b.y]); if (b.trail.length > 6) b.trail.shift(); } if (b.squash > 0) b.squash = Math.max(0, b.squash - dt * 14); }
    const fade = (list, life) => list.filter((x) => (x.t += dt) < life);
    rings = fade(rings, 0.25); nums = fade(nums, 0.9);
    sparks = fade(sparks, 0.6); for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; }
    confetti = fade(confetti, 2.2); for (const f of confetti) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; f.vx *= 0.99; f.r += f.vr * dt; }
    beams = fade(beams, 0.7); ripples = fade(ripples, 0.6); shocks = fade(shocks, 0.55);
    if (wobble && (wobble.t += dt) > 0.7) wobble = null;
    if (appear < 1) appear = Math.min(1, appear + dt / 0.8);
    for (let i = 0; i < heat.length; i++) if (heat[i] > 0) heat[i] = Math.max(0, heat[i] - dt / 2);
    for (const f of slotFx) if (f) f.t += dt;
    for (const x of tallies) if (x.bump > 0) x.bump = Math.max(0, x.bump - dt * 5);
    caps();
  }

  // ---- the leaderboard beside the board (combined) ---------------------------------------------------------------------------
  let lbc = null, lbTimer = null, lbTheme = () => {};
  if (combined) {
    // its own wrapper, carrying the theme again (so its background can differ from the board's) and its own transparency
    const wrap = document.createElement('div'); wrap.className = 'lbw'; root.appendChild(wrap);
    // the board's theme (following theme messages), or the leaderboard's own when the streamer picked one (in combined too)
    lbTheme = cfg.lbtheme !== 'same'
      ? () => W.theme.apply(wrap, { theme: cfg.lbtheme, accent: cfg.lbaccent })
      : () => { W.theme.apply(wrap, { theme: root.dataset.theme, accent: root.style.getPropertyValue('--accent').replace('#', '') }); if (!root.style.getPropertyValue('--accent')) wrap.style.removeProperty('--accent'); };
    lbTheme();
    wrap.style.setProperty('--bgo', String(cfg.lbbgo / 100)); wrap.classList.toggle('clear', cfg.lbbgo === 0);
    const el = document.createElement('div'); wrap.appendChild(el);
    lbc = K.leaderboard(el, { shape: 'panel', n: cfg.lbn, show: cfg.lbshow, every: cfg.lbevery, remember: cfg.remember, rm, calm, dots: shownPlatforms.length > 1, cmd: cmdName });
    lbc.update(K.leaderboard.lists(scores, cfg.lbn));
    lbc.start();
  }
  function lbRefresh() { if (!lbc || lbTimer) return; lbTimer = setTimeout(() => { lbTimer = null; lbc.update(K.leaderboard.lists(scores, cfg.lbn)); }, 60); }

  // ---- !plinko top: both lists over the board for 8 s -----------------------------------------------------------
  let topEl = null;
  function showTop() {
    if (topEl) return;
    const { stream, all } = K.leaderboard.lists(scores, 5);
    // the exact scores here (chat asked for them), unlike the leaderboard's three figures
    const rows = (list) => list.length ? list.map((p, i) => `<div class="row"><b class="rk">${i + 1}</b><span class="n">${esc(p.name)}</span><span class="p">${Math.round(p.score).toLocaleString('en')}</span></div>`).join('') : '<div class="row"><span class="n">No drops yet</span></div>';
    topEl = document.createElement('div'); topEl.className = 'toplist lb';
    topEl.innerHTML = `<div><h3>${stream.kind === 'last' ? 'Last stream' : 'This stream'}</h3>${rows(stream.list)}</div>${cfg.remember ? `<div><h3>All time</h3>${rows(all)}</div>` : ''}`;
    if (!cfg.remember) topEl.style.gridTemplateColumns = '1fr';
    boardEl.appendChild(topEl);
    anim(topEl, [{ opacity: 0, transform: 'translate(-50%, -46%)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 260, easing: 'ease-out' });
    setTimeout(() => { const e = topEl; topEl = null; const a = anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); if (a) a.onfinish = () => e.remove(); else e.remove(); }, 8000);
  }

  // ---- chat -------------------------------------------------------------------------------------------------------------------
  function hear(m) {
    const r = game.handle(m);
    if (r.kind === 'drop') dropped();
    if (r.kind === 'command') {
      if (r.cmd === 'resume') goUntil = Date.now() + 1200;
      if (r.cmd === 'clear') {                                    // every ball pops into a puff, scoring nothing
        for (const b of world.clear()) if (!rm) { rings.push({ x: b.x, y: b.y, c: b.data.color, t: 0, r: b.r * 0.6 }); for (let i = 0; i < 5; i++) { const a = i * 1.26; sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, c: b.data.color, t: 0.2 }); } }
      }
      if (r.cmd === 'clearscores') { scores.clear(); writeSaves(); lbRefresh(); }
      if (r.cmd === 'top') showTop();
    }
    if (demo && m.text && window.parent !== window) try { const e = m.emotes && m.emotes[0]; window.parent.postMessage({ type: 'chaplinko-chat', name: m.name, color: m.color, platform: m.platform, text: m.text, emote: e ? { name: e.name, url: e.url } : null }, '*'); } catch {}
    drawChute(); kick();
    return r;
  }

  // ---- the stream: is the channel live, and which stream is it? (as Chatagram: docs/widgets.md, "Leaderboards") ----------------
  const ASK_WAIT = 8000, SOON = 5 * 60000;
  let asking = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function checkStream() {
    if (demo || still || !platforms.length || asking) return asking;
    asking = (async () => {
      const first = scores.record.primary, order = platforms.slice().sort((a, b) => (b === first) - (a === first)), states = [];
      for (const p of order) {
        const r = await Promise.race([W.platforms[p].stream(channels[p]), sleep(ASK_WAIT).then(() => ({ state: 'unknown' }))]);
        if (r && r.state === 'live') { scores.checked({ ...r, platform: p }); return; }
        states.push(r ? r.state : 'unknown');
      }
      scores.checked({ state: states.every((x) => x === 'offline') ? 'offline' : 'unknown' });
    })().catch(() => {}).finally(() => { asking = null; writeSaves(); lbRefresh(); });
    return asking;
  }

  // ---- start ----------------------------------------------------------------------------------------------------------------------
  W.theme.listen(root, () => { lbTheme(); readPalette(); });
  addEventListener('resize', fit);
  const msg = $('#msg');
  try { await Promise.race([document.fonts.load(`16px ${getComputedStyle(root).getPropertyValue('--display')}`), sleep(1500)]); } catch {}
  readPalette(); fit();
  if (rm || still) appear = 1;
  drawChute();
  if (still) {
    // a frozen moment: seeded drops part way down, a landing or two, and (screen=jackpot) the card
    frozen = Date.now();
    const say = K.demo(() => {}, { platforms: shownPlatforms, random: seeded, setTimeout: () => 0, clearTimeout: () => {}, cmd: cmdName });
    for (let i = 0; i < 7; i++) { hear(say.message()); for (let s = 0; s < 70; s++) { offset += 1000 / 120; tick(1 / 120); } }
    draw(); drawChute();
    if (screen === 'jackpot') { const by = { platform: shownPlatforms[0], user: 'pixelpanda', name: 'PixelPanda', color: '#ff4f9a' }; jackpot({ by, res: { pts: game.top, nth: 1, tier: 'jackpot' }, slot: 0, color: '#ff4f9a' }); confetti = []; beams = []; ripples = []; }
  } else if (!demo && !platforms.length) {
    msg.innerHTML = `<div><h2>Add your channel</h2><p>Set Chaplinko up at <code>trongateslegacy.com/chaplinko</code>, then paste the link it gives you</p></div>`; msg.classList.add('on');
  } else {
    kick(); dropped();
    if (demo) {
      scores.checked({ state: 'live', platform: shownPlatforms[0], id: 'pretend', started: scores.record.stream ? scores.record.stream.started : now() });
      writeSaves();
      K.demo(hear, { platforms: shownPlatforms, cmd: cmdName });
    } else {
      W.chat({ twitch: channels.twitch, kick: channels.kick, kickId: cfg.kickid || undefined }, (m) => { if (now() - scores.record.checkedAt > SOON) checkStream(); hear(m); });
      checkStream();
      setInterval(() => { const d = scores.record; if (d.status === 'live' && now() - d.checkedAt >= W.scores.LIVE_EVERY) checkStream(); }, 60000);
    }
  }
  document.documentElement.dataset.ready = '1';
  window.chaplinko = { cfg, game, world, scores, hear, checkStream, get running() { return running; }, leaderboard: lbc, advance(ms) { offset += ms; },
    land: (by, slot) => { const r = onLand(by, slot, null, ballColor(by)); kick(); return r; } };
})();
