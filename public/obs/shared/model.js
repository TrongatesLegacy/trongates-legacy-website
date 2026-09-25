// The Trongates OBS settings, and how they become each scene's URL. Shared by the control panel (panel.js) in the
// OBS dock and on the index page, so both build exactly the same addresses. No DOM, no network.
//
// The scenes themselves only ever read their URL (theme.js / scene.js), so everything here can also be done by
// hand; see obs/README.md for the options.
(() => {
  // Scene types: the file, which parts can be turned off, and how the colour works (cycling scenes run their own
  // form cycle; "follows" scenes take the colour from veadotube).
  const PARTS = {
    chat: 'Chat', goal: 'Goal', music: 'Now playing', discord: 'Discord', socials: 'Social links', ticker: 'Socials strip', art: 'Character',
  };
  const TYPES = {
    starting: { title: 'Starting soon', file: 'starting', parts: ['music', 'discord', 'socials', 'ticker', 'art'], cycling: true },
    brb: { title: 'Be right back', file: 'brb', parts: ['chat', 'goal', 'music', 'discord', 'ticker', 'art'], cycling: true, column: true },
    chatting: { title: 'Just chatting', file: 'chatting', parts: ['chat', 'goal', 'music', 'ticker'], follows: true, column: true },
    game: { title: 'Game', file: 'game', parts: ['ticker'], windowParts: ['chat', 'goal', 'music', 'ticker'], follows: true },
    ending: { title: 'Ending', file: 'ending', parts: ['music', 'discord', 'socials', 'ticker', 'art'], cycling: true },
  };
  // The frames on their own, for separate OBS sources
  const WIDGETS = {
    chatbox: { title: 'Chat box', file: 'chat', w: 500, h: 800, uses: ['chat'] },
    goal: { title: 'Follower goal', file: 'goal', w: 500, h: 134, uses: ['goal'] },
    music: { title: 'Now playing', file: 'music', w: 560, h: 100, uses: ['music'] },
    bare: { title: 'Shared chat', file: 'chat', w: 554, h: 608, uses: ['chat'], extra: { bare: '1' } },
  };
  const partsOf = (type, layout) => (type === 'game' && layout === 'window' ? TYPES.game.windowParts : TYPES[type].parts);
  const VEADO_DEFAULT = '127.0.0.1:54765', BRIDGE_DEFAULT = '127.0.0.1:5000';

  const defaults = () => ({
    v: 1,
    key: '', links: { chat: '', goal: '' }, shared: false, goalColor: true,
    music: { app: '', always: false, host: '' },
    veado: { addr: '', switch: true, tron: 'cyan', map: {}, delay: 0 },
    motion: 'auto', sample: true,
    scenes: Object.fromEntries(Object.keys(TYPES).map((t) => [t, { off: [], cycle: true, follow: true, layout: 'full' }])),
  });
  // fill in anything missing (older saves, partial imports)
  const normalise = (s) => {
    const d = defaults(), o = s && typeof s === 'object' ? s : {};
    const out = { ...d, ...o, links: { ...d.links, ...(o.links || {}) }, music: { ...d.music, ...(o.music || {}) },
      veado: { ...d.veado, ...(o.veado || {}), map: { ...((o.veado || {}).map || {}) } }, scenes: {} };
    for (const t of Object.keys(TYPES)) out.scenes[t] = { ...d.scenes[t], ...((o.scenes || {})[t] || {}), off: [...(((o.scenes || {})[t] || {}).off || [])] };
    return out;
  };

  const isLink = (u) => /^https:\/\//.test(u || '');
  // Botrix links come from pasted links or the Netlify key (s.linksMode; older saves: pasted if there are any)
  const pasted = (s, k) => s.linksMode !== 'key' && isLink(s.links[k]);
  // where a widget's link comes from (env: what the key returned)
  const linkFor = (s, k, env) => (pasted(s, k) ? s.links[k] : env && isLink(env[k]) ? env[k] : '');

  // The options for a scene or widget page, as [name, value] pairs, in a stable order.
  // ctx: { layout, preview: { form, guide, sample }, obs: { port, pw }, env }
  function options(kind, s, ctx = {}) {
    const o = [], add = (k, v) => o.push([k, String(v)]);
    const scene = TYPES[kind], widget = WIDGETS[kind];
    const sc = scene ? s.scenes[kind] : null;
    const layout = scene && kind === 'game' ? (ctx.layout || sc.layout) : 'full';
    const has = (p) => (scene ? partsOf(kind, layout).includes(p) && !sc.off.includes(p) : widget.uses.includes(p));
    if (scene && kind === 'game' && layout === 'window') add('layout', 'window');
    if (widget && widget.extra) for (const [k, v] of Object.entries(widget.extra)) add(k, v);
    const off = scene ? partsOf(kind, layout).filter((p) => sc.off.includes(p)) : [];
    if (off.length) add('hide', off.join(','));
    // Botrix: pasted links go in whole, Netlify ones through the key; a shared chat means the scene loads none
    const useShared = scene && s.shared && has('chat');
    let needKey = false;
    for (const k of ['chat', 'goal']) {
      if (!has(k)) continue;
      if (k === 'chat' && useShared) { add('chat', 0); continue; }
      if (pasted(s, k)) add(k, s.links[k]); else if (s.key) needKey = true;
    }
    if (needKey) add('key', s.key);
    if (has('goal') && !s.goalColor) add('goalcolor', 0);
    // now playing
    if (has('music')) {
      if (ctx.preview) add('music', ctx.preview.sample ? 'demo' : 0);
      else {
        if (s.music.app) add('app', s.music.app);
        if (s.music.always) add('music', 'always');
        if (s.music.host && s.music.host !== BRIDGE_DEFAULT) add('musichost', s.music.host);
      }
    }
    // colour: cycling scenes cycle unless told not to; the rest follow veadotube unless told not to
    const cycles = scene && scene.cycling && sc.cycle;
    if (scene && scene.cycling && !sc.cycle) add('cycle', 0);
    const follows = !cycles && (!scene || sc.follow);
    if (scene && !scene.cycling && !sc.follow) add('noveado', 1);
    if (ctx.preview) add('noveado', 1);
    else if (follows) {
      if (s.veado.addr && s.veado.addr !== VEADO_DEFAULT) add('veado', s.veado.addr);
      const map = Object.entries(s.veado.map || {}).filter(([, f]) => f);
      if (map.length) add('map', map.map(([k, f]) => `${k}:${f}`).join(','));
      if (+s.veado.delay > 0) add('veadodelay', +s.veado.delay);
    }
    if (s.motion === 'full' || s.motion === 'reduce') add('motion', s.motion);
    // the dock's colour buttons reach the scenes through the OBS WebSocket
    if (!ctx.preview && ctx.obs && ctx.obs.port) { add('obs', ctx.obs.port); if (ctx.obs.pw) add('obspw', ctx.obs.pw); }
    if (ctx.preview) {
      if (ctx.preview.form) add('form', ctx.preview.form);
      if (ctx.preview.guide) add('guide', 1);
      if (ctx.preview.sample && (has('chat') || has('goal'))) add('demo', 1);
    }
    return o;
  }
  // Every option the panel owns: when it rewrites a URL these are replaced, anything else is kept as it was.
  const OWNED = ['layout', 'bare', 'hide', 'chat', 'goal', 'key', 'goalcolor', 'music', 'app', 'musichost', 'cycle', 'noveado',
    'veado', 'map', 'veadodelay', 'motion', 'obs', 'obspw', 'art', 'demo', 'guide', 'form'];
  const query = (pairs) => pairs.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',').replace(/%3A/g, ':')}`).join('&');
  // A URL with the panel's options in place of its own (base: an existing address, hosted or file://)
  function withOptions(base, pairs) {
    const [path, qs = ''] = base.split('#')[0].split('?');
    const keep = qs.split('&').filter((p) => p && !OWNED.includes(decodeURIComponent(p.split('=')[0])));
    const all = [...keep, query(pairs)].filter(Boolean).join('&');
    return all ? `${path}?${all}` : path;
  }
  const sameUrl = (a, b) => {
    const norm = (u) => { const [p, q = ''] = u.split('#')[0].split('?'); return p + '?' + q.split('&').filter(Boolean).map((x) => { const [k, v = ''] = x.split('='); return `${decodeURIComponent(k)}=${decodeURIComponent(v)}`; }).sort().join('&'); };
    return norm(a) === norm(b);
  };

  // Which Trongates page an address is, if any: { kind: 'brb' | … | 'chatbox' | 'goal' | 'music' | 'bare', layout }
  function recognise(url) {
    const m = /\/obs\/(starting|brb|chatting|game|ending|chat|goal|music)(?:\.html)?(?:[?#]|$)/.exec(url || '');
    if (!m) return /botrix\.live\/widgets\/chat\//.test(url || '') ? { kind: 'botrix-chat' } : /botrix\.live\/widgets\/goals?\//.test(url || '') ? { kind: 'botrix-goal' } : null;
    const q = new URLSearchParams((url.split('?')[1] || '').split('#')[0]);
    let kind = m[1];
    if (kind === 'chat') kind = q.get('bare') === '1' ? 'bare' : 'chatbox';
    return { kind, layout: kind === 'game' && q.get('layout') === 'window' ? 'window' : 'full', q };
  }
  // Settings read back out of the overlays' URLs (for a dock whose saved copy was wiped): what they agree on
  function fromUrls(urls) {
    const s = defaults();
    for (const url of urls) {
      const r = recognise(url);
      if (!r || !r.q) continue;
      const q = r.q, get = (k) => q.get(k);
      if (get('key')) s.key = get('key');
      for (const k of ['chat', 'goal']) if (isLink(get(k))) s.links[k] = get(k);
      if (get('chat') === '0') s.shared = true;
      if (get('goalcolor') === '0') s.goalColor = false;
      if (get('app')) s.music.app = get('app');
      if (get('music') === 'always') s.music.always = true;
      if (get('musichost')) s.music.host = get('musichost');
      if (get('veado')) s.veado.addr = get('veado');
      if (get('veadodelay')) s.veado.delay = +get('veadodelay') || 0;
      if (get('map')) for (const p of get('map').split(',')) { const [a, b] = p.split(':'); if (a && b) s.veado.map[a.trim().toLowerCase()] = b.trim(); }
      if (get('motion')) s.motion = get('motion');
      if (TYPES[r.kind]) {
        const sc = s.scenes[r.kind];
        if (r.kind === 'game') sc.layout = r.layout;
        sc.off = (get('hide') || '').split(',').filter((p) => PARTS[p]);
        if (get('music') === '0' && !sc.off.includes('music')) sc.off.push('music');
        if (get('art') === '0' && !sc.off.includes('art')) sc.off.push('art');
        if (get('cycle') === '0') sc.cycle = false;
        if (get('noveado') === '1') sc.follow = false;
      }
    }
    return s;
  }

  // Settings links: #s=<base64url of the JSON>
  const b64 = {
    enc: (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (str) => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))),
  };
  const pack = (s) => b64.enc(JSON.stringify(s));
  const unpack = (str) => normalise(JSON.parse(b64.dec(str)));

  // The shared chat's geometry (on a 1920x1080 canvas): the chat frame's inner box in each scene. On Be right back
  // and Just chatting it depends on whether now playing and the goal take up room in the left column.
  const SHARED_W = 554, SHARED_H = 882;
  function chatBox(kind, s, musicShown) {
    const sc = s.scenes[kind];
    if (kind === 'game') return { x: 1381, y: 132, w: 494, h: 450 };
    const music = !sc.off.includes('music') && musicShown, goal = !sc.off.includes('goal');
    const top = music ? 130 : 10, bottom = goal ? 808 : 962;   // the chat frame, in .content coordinates
    return { x: 58, y: 64 + top + 52, w: 554, h: bottom - top - 70 };
  }

  window.TGLModel = { PARTS, TYPES, WIDGETS, partsOf, defaults, normalise, options, withOptions, sameUrl, recognise, fromUrls,
    pack, unpack, b64, linkFor, isLink, pasted, chatBox, SHARED_W, SHARED_H, VEADO_DEFAULT, BRIDGE_DEFAULT };
})();
