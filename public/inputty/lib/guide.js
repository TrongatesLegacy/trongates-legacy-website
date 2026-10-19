// Inputty's guided set-up (docs/widgets.md, "Inputty"): one state (what you play with, the layout, the look), the live
// preview, finding input-overlay and a controller, the link, and small building blocks each page lays out and styles
// its own way (all class names start g-). The page loads presets, ours, codes, looks, render and drawn first.
(() => {
  const L = window.IOLooks, P = window.IO_PRESETS;
  const INSTALLER = {
    version: '5.0.6', size: '3.7 MB',
    // the latest stable release (5.1.0 is a pre-release). Built for real: a daily job keeps this current, as check-kick does
    url: 'https://github.com/univrsal/input-overlay/releases/download/5.0.6/input-overlay-5.0.6-windows-x64-Installer.exe',
    file: 'input-overlay-5.0.6-windows-x64-Installer.exe',
    linux: 'https://github.com/univrsal/input-overlay/releases/download/5.0.6/input-overlay-5.0.6-x86_64-linux-gnu.deb',
    page: 'https://github.com/univrsal/input-overlay/releases/tag/5.0.6',
  };
  const ua = navigator.userAgent;
  // ?os=windows|mac|linux|phone previews the page as someone on that system would see it
  const OS = new URLSearchParams(location.search).get('os') || (/Android|iPhone|iPad|Mobile/i.test(ua) ? 'phone' : /Win/i.test(navigator.platform || ua) ? 'windows' : /Mac/i.test(navigator.platform || ua) ? 'mac' : /Linux/i.test(ua) ? 'linux' : 'other');
  const KIND = { Keyboard: 'keyboard', Mouse: 'mouse', Controller: 'controller', Retro: 'controller', 'Fight stick': 'controller' };
  const DEVICE_DEFAULTS = {
    kbm: { p: 'wasd', v: 0, a: 0, p2: 'mouse', v2: 0, a2: 0 },
    pad: { p: 'xboxone', v: 0, a: 0, p2: '', v2: 0, a2: 0 },
    both: { p: 'wasd', v: 0, a: 0, p2: 'xboxone', v2: 0, a2: 0 },
  };

  // ---- colours (the look step's chips) ----
  const COLOURS = {
    key: { label: 'Keys', help: 'the keys and buttons' },
    accent: { label: 'Pressed', help: 'a key or button while it is held' },
    ink: { label: 'Letters', help: 'the letters on the keys' },
    edge: { label: 'Edges', help: 'sides, outlines and shadows' },
    hi: { label: 'Shine', help: 'the highlight on top of each key' },
  };
  const COLOUR_PARTS = Object.keys(COLOURS), NO_COLOURS = { key: '', accent: '', ink: '', edge: '', hi: '' };
  const SWATCHES = ['ffffff', 'f3eefc', 'c9b2ff', 'b18cff', 'ff9fc6', 'ff7fdc', '8fa8ff', '5fd4ff', '6ff0b0', 'ffe066', 'ff9a3d', 'ff5a5a', '2b2a4a', '15171d'];
  const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (h) => { const [r, g2, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g2 + 0.0722 * b; };
  /** how different two colours look (CIE76 ΔE in Lab): brightness contrast alone calls gold and pink "the same" */
  function dE(a, b) {
    const lab = (h) => {
      const [r, g2, bl] = rgb(h).map(lin), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const x = f((r * 0.4124 + g2 * 0.3576 + bl * 0.1805) / 0.95047), y = f(r * 0.2126 + g2 * 0.7152 + bl * 0.0722), z = f((r * 0.0193 + g2 * 0.1192 + bl * 0.9505) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const A = lab(a), B = lab(b);
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  }
  const mixHex = (a, b, t) => { const A = rgb(a), B = rgb(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const idle = { keys: new Set(), mouse: new Set(), wheel: { t: -1e9, rot: 0 }, move: { vx: 0, vy: 0, angle: 0 }, pad: { connected: false, index: 0, buttons: [], axes: [0, 0, 0, 0, 0, 0] } };
  const measured = new Map();   // small picture → Promise<{ line, edge, hi }>
  /** which colours change a picture: drawn in a fixed look, then with Edges and with Shine pushed far off; a colour
   *  counts when it moves more than 2% of the picture's pixels (some have no dark or no light parts at all). line: it's
   *  light line art (WASD, the outline mouse), whose Keys colour is its lines */
  function measure(variant, art) {
    const key = art.thumb || art.src;
    if (!measured.has(key)) measured.set(key, (async () => {
      const v = new window.IORender.PresetView(variant.layout, key, { pixel: variant.pixel, aw: art.aw });
      await v.load();
      const base = L.look({ ...L.DEFAULTS });
      const px = (look) => { v.setLook(look); v.draw(idle); return v.canvas.getContext('2d').getImageData(0, 0, v.canvas.width, v.canvas.height).data; };
      const a = px(base), e = px({ ...base, edge: 'ff0000' }), h = px({ ...base, hi: '00ff00' });
      const far = (x, i) => Math.abs(a[i] - x[i]) + Math.abs(a[i + 1] - x[i + 1]) + Math.abs(a[i + 2] - x[i + 2]) > 60;
      let n = 0, de = 0, dh = 0;
      for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 40) continue; n++; if (far(e, i)) de++; if (far(h, i)) dh++; }
      return { line: v.levels().light, edge: de > n * 0.02, hi: dh > n * 0.02 };
    })());
    return measured.get(key);
  }

  function create({ theme = 'zojie' } = {}) {
    // starts on WASD and Mouse (the owner), written into the link (a link without them means looks.js's DEFAULTS)
    const s = { ...L.DEFAULTS, ...DEVICE_DEFAULTS.kbm, theme, device: '', title: 'my inputs' };
    const subs = new Set();
    const g = {
      s, OS, INSTALLER, P, L,
      ws: { status: 'looking', tries: 0, gotKey: false, gotPad: false },
      pad: '', size: null,
      on(f) { subs.add(f); return () => subs.delete(f); },
      emit(why) { subs.forEach((f) => f(why)); },
      set(patch, why = 'set') { Object.assign(s, patch); syncPreview(); g.emit(why); },
      device(d) { g.set({ device: d, ...DEVICE_DEFAULTS[d] }, 'device'); },
      needsHelper() { return s.device === 'kbm' || s.device === 'both'; },
      presets(kind) { return P.filter((p) => KIND[p.group] === kind); },
      preset(id) { return P.find((p) => p.id === id); },
      url(preview) { const q = L.query(preview ? { ...s, demo: 1 } : { ...s, demo: 0 }); return new URL('/inputty/play.html' + (q ? '?' + q : ''), location.href).href; },
      async copy(btn, label = btn.textContent) {
        try { await navigator.clipboard.writeText(g.url(false)); btn.textContent = 'Copied ✓'; } catch { btn.textContent = 'Select the link and copy it'; }
        g.emit('copied');
        setTimeout(() => (btn.textContent = label), 1800);
      },
    };

    // ---- the live preview(s): layout changes reload, look changes are sent live ----
    const frames = new Set();
    let layoutKey = '';
    g.preview = (iframe) => { frames.add(iframe); iframe.src = g.url(true); return iframe; };
    function syncPreview() {
      const key = [s.p, s.v, s.a, s.p2, s.v2, s.a2].join();
      const look = { theme: s.theme, accent: s.accent, key: s.key, edge: s.edge, hi: s.hi, ink: s.ink, orig: s.orig, frame: s.frame, title: s.title, bgo: s.bgo, fx: s.fx, outline: s.outline };
      frames.forEach((f) => { if (key !== layoutKey) f.src = g.url(true); else f.contentWindow?.postMessage({ type: 'io-look', look }, '*'); });
      layoutKey = key;
    }
    // this page's own keys, clicks and scrolls go to the previews, so it can be tried here
    const send = (m) => frames.forEach((f) => f.contentWindow?.postMessage({ type: 'io-input', ...m }, '*'));
    const typing = (e) => e.target.closest?.('input[type=text], textarea, select');
    addEventListener('keydown', (e) => { if (!e.repeat && !typing(e)) send({ kind: 'key', code: e.code, down: true }); });
    addEventListener('keyup', (e) => send({ kind: 'key', code: e.code, down: false }));
    addEventListener('mousedown', (e) => send({ kind: 'mouse', button: e.button, down: true }));
    addEventListener('mouseup', (e) => send({ kind: 'mouse', button: e.button, down: false }));
    addEventListener('wheel', (e) => send({ kind: 'wheel', deltaY: e.deltaY }), { passive: true });
    addEventListener('blur', () => send({ kind: 'blur' }));
    addEventListener('message', (e) => { if (e.data?.type === 'io-size') { g.size = e.data; g.emit('size'); } });

    // ---- is input-overlay there? (it runs inside OBS on this PC) and a controller ----
    let ws = null, retry = null;
    function connect() {
      clearTimeout(retry);
      if (ws) { ws.onclose = null; ws.close(); }
      try { ws = new WebSocket(`ws://127.0.0.1:${s.port}/`); } catch { return; }
      ws.onopen = () => { g.ws.status = 'found'; g.ws.tries = 0; g.emit('ws'); };
      ws.onmessage = (e) => {
        if (!g.ws.gotKey && /"key_pressed"|"mouse_pressed"/.test(e.data)) { g.ws.gotKey = true; g.emit('ws'); }
      };
      ws.onclose = () => { ws = null; g.ws.tries++; g.ws.status = g.ws.tries > 2 ? 'missing' : 'looking'; g.emit('ws'); retry = setTimeout(connect, 2000); };
    }
    g.reconnect = (port) => { s.port = port; g.ws = { status: 'looking', tries: 0, gotKey: false }; connect(); g.emit('ws'); };
    // only look once someone's going to need it (keys or mouse): a page that just opened makes no connections
    let looking = false;
    subs.add((why) => { if (why === 'device' && !looking && g.needsHelper()) { looking = true; connect(); } });
    (function pollPad() {
      const gp = [...(navigator.getGamepads?.() || [])].find(Boolean);
      const name = gp ? gp.id.replace(/\s*\(.*$/, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '') : '';
      if (name !== g.pad) { g.pad = name; g.emit('pad'); }
      setTimeout(pollPad, 700);
    })();

    // ---- which colours the chosen layouts take ----
    const chosenLayouts = () => [[s.p, s.v, s.a], [s.p2, s.v2, s.a2]].filter(([id]) => id && g.preset(id))
      .map(([id, v, a]) => { const p = g.preset(id); return { variant: p.variants[v] || p.variants[0], a }; });
    /** a chosen layout → { parts: the colours that change it, line: is it line art } */
    async function colourParts({ variant, a }) {
      if (variant.drawn) return { parts: variant.drawn.kind === 'keys' ? COLOUR_PARTS : COLOUR_PARTS.filter((k) => k !== 'ink'), line: false };
      if (+s.orig) return { parts: [], line: false };
      const m = await measure(variant, variant.arts[a] || variant.arts[0]);
      return { parts: m.line ? ['key', 'accent'] : ['key', 'accent', ...(m.edge ? ['edge'] : []), ...(m.hi ? ['hi'] : [])], line: m.line };
    }
    g.colourParts = async () => { const got = await Promise.all(chosenLayouts().map(colourParts)); return COLOUR_PARTS.filter((k) => got.some((x) => x.parts.includes(k))); };

    // ---- building blocks ----
    const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const thumbCache = new Map();
    /** is this canvas sitting on something light? (its own background, else the nearest one behind it) */
    function onLight(el) {
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor, n = (c.match(/[\d.]+/g) || []).map(Number);
        if (!n.length || (n.length > 3 && n[3] < 0.5) || /transparent/.test(c)) continue;
        const [r, g2, b] = /color\(srgb/.test(c) ? n.slice(0, 3).map((v) => v * 255) : n;
        return (0.2126 * r + 0.7152 * g2 + 0.0722 * b) / 255 > 0.6;
      }
      return false;
    }
    /** a picture of a preset in the current look, drawn into a canvas */
    async function thumb(p, canvas, vi = 0, { ai = 0, orig = false } = {}) {
      const variant = p.variants[vi] || p.variants[0];
      const key = [p.id, vi, ai].join(':');
      // cache the loading promise, not the view: a second call while the image is still loading waits for it too
      if (p.history) return;
      if (!thumbCache.has(key)) {
        const v = variant.drawn ? new window.IODrawn.DrawnView(variant.drawn)
          : ((art) => new window.IORender.PresetView(variant.layout, art.thumb || art.src, { pixel: variant.pixel, aw: art.aw }))(variant.arts[ai] || variant.arts[0]);
        thumbCache.set(key, v.load().then(() => v));
      }
      const view = await thumbCache.get(key);
      if (!canvas.isConnected) return;
      const look = L.look({ ...s, orig: 0 });
      // on a light card, light line art (white outlines) would vanish: draw it dark, as the overlay does on light panels
      if (view.drawn) view.setLook(look, L.THEMES[s.theme]); else view.setLook(orig ? null : { ...look, lightBg: onLight(canvas) });
      view.draw({ keys: new Set(), mouse: new Set(), wheel: { t: -1e9, rot: 0 }, move: { vx: 0, vy: 0, angle: 0 }, pad: { connected: false, index: 0, buttons: [], axes: [0, 0, 0, 0, 0, 0] } });
      paintInto(canvas, view.canvas, variant.pixel);
      // a picture in its own colours that's white line art needs something dark behind it on a light card; otherwise
      // it sits on the card like every other picture
      if (orig && view.levels) canvas.classList.toggle('g-dark', view.levels().light && onLight(canvas.parentElement));
    }

    /** paint a big drawing into a small canvas smoothly: at the screen's real resolution (sharp on retina), shrunk in
     *  halving steps (one big jump skips pixels and makes thin lines jagged); pixel art stays crisp, unsmoothed */
    function paintInto(canvas, src, pixel) {
      if (!canvas.dataset.w) { canvas.dataset.w = canvas.width; canvas.dataset.h = canvas.height; }
      const dpr = Math.min(3, window.devicePixelRatio || 1), cssW = canvas.clientWidth || +canvas.dataset.w;
      const W = Math.round(cssW * dpr), H = Math.round(W * (+canvas.dataset.h / +canvas.dataset.w));
      if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
      const k = Math.min(W / src.width, H / src.height), tw = src.width * k, th = src.height * k;
      let img = src, w = src.width, h = src.height;
      if (!pixel) {
        while (w / 2 >= tw) {
          const t = document.createElement('canvas');
          t.width = Math.round(w / 2); t.height = Math.round(h / 2);
          const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high';
          tc.drawImage(img, 0, 0, t.width, t.height);
          img = t; w = t.width; h = t.height;
        }
      }
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, W, H);
      c.imageSmoothingEnabled = !pixel; c.imageSmoothingQuality = 'high';
      c.drawImage(img, (W - tw) / 2, (H - th) / 2, tw, th);
    }
    g.paintInto = paintInto;

    /** draw a preset (first style) in a given theme into a canvas, for galleries */
    g.drawIn = async (canvas, id, theme, vi = 0) => {
      const p = g.preset(id), variant = p.variants[vi] || p.variants[0];
      const view = variant.drawn ? new window.IODrawn.DrawnView(variant.drawn) : new window.IORender.PresetView(variant.layout, variant.arts[0].thumb || variant.arts[0].src, { pixel: variant.pixel, aw: variant.arts[0].aw });
      await view.load();
      const look = L.look({ ...s, theme, accent: '', orig: 0 });
      if (view.drawn) view.setLook(look, L.THEMES[theme]); else view.setLook({ ...look, lightBg: false });
      const held = { keys: new Set([0x11, 0x2a, 0x39]), mouse: new Set([1]), wheel: { t: -1e9, rot: 0 }, move: { vx: 4, vy: -3, angle: 0 }, pad: { connected: true, index: 0, buttons: Object.assign(new Array(21).fill(false), { 0: true, 11: true }), axes: [0.6, -0.4, 0, 0, 0.7, 0] } };
      const paint = () => {
        view.draw(held);
        paintInto(canvas, view.canvas, variant.pixel);
      };
      paint();
      document.fonts?.ready.then(paint);
    };

    /** lay a grid's items out so the last row never holds a lone item: of the column counts that fit, take the most
     *  that divides evenly, else the most that leaves at least two on the last row. min: an item's narrowest width */
    g.balance = (el, { min = 140, max = Infinity, gap = 10 } = {}) => {
      const fit = () => {
        const items = [...el.children].filter((c) => !c.classList.contains('g-detail') && !c.hidden);
        const n = items.length, w = el.clientWidth;
        if (!n || !w) return;
        const cap = Math.max(1, Math.min(n, Math.floor((w + gap) / (min + gap))));
        let best = cap;
        if (n > cap) {
          const ok = [];
          for (let k = cap; k >= Math.max(2, Math.ceil(cap / 2)); k--) ok.push(k);
          best = ok.find((k) => n % k === 0) ?? ok.find((k) => n % k >= 2);
          // nothing fits evenly (7 items, room for 2): squeeze in more, narrower columns (down to 70% wide) for 4 + 3
          if (!best) {
            const roomy = Math.max(cap, Math.floor((w + gap) / (min * 0.7 + gap)));
            for (let k = cap + 1; k <= Math.min(n, roomy) && !best; k++) if (n % k === 0 || n % k >= 2) best = k;
          }
          best ??= n % cap === 1 ? 1 : cap;
        }
        el.style.gridTemplateColumns = `repeat(${best}, minmax(0, ${max === Infinity ? '1fr' : max + 'px'}))`;
      };
      new ResizeObserver(fit).observe(el);
      new MutationObserver(fit).observe(el, { childList: true });
      fit();
      return fit;
    };

    g.ui = {
      /** three big choices: keyboard & mouse, controller, both */
      device(el, labels = {}) {
        const L2 = { kbm: ['⌨️', 'Keyboard & mouse', labels.kbm || 'WASD, clicks and scrolls'], pad: ['🎮', 'Controller', labels.pad || 'Xbox, PlayStation, Switch and more'], both: ['⌨️🎮', 'Both', labels.both || 'Keys and a controller'] };
        // the page can carry these buttons in its HTML already (so nothing moves when the script arrives): keep them
        if (!el.querySelector('.g-device')) el.innerHTML = Object.entries(L2).map(([k, [ico, t, d]]) => `<button type="button" class="g-device" data-d="${k}" aria-pressed="${s.device === k}"><span class="g-ico">${ico}</span><b>${t}</b><small>${d}</small></button>`).join('');
        el.onclick = (e) => { const b = e.target.closest('.g-device'); if (b) g.device(b.dataset.d); };
        g.on(() => el.querySelectorAll('.g-device').forEach((b) => b.setAttribute('aria-pressed', String(s.device === b.dataset.d))));
      },
      /** layouts to pick from (kind: keyboard | mouse | controller), with pictures; slot: p or p2. Picking one opens
       *  its styles and colours as pictures in a full-width row right under it (not at the bottom, out of sight) */
      layouts(el, kind, slot = 'p', { limit = 0, styles = true } = {}) {
        const list = g.presets(kind).filter((p) => !p.history && p.licence !== 'brand' && p.licence !== 'unclear');
        const shown = limit ? list.slice(0, limit) : list;
        const vk = slot === 'p' ? 'v' : 'v2', ak = slot === 'p' ? 'a' : 'a2';
        el.innerHTML = `<div class="g-layouts">${shown.map((p) => `<button type="button" class="g-layout" data-id="${p.id}" aria-pressed="${s[slot] === p.id}"><canvas width="220" height="120"></canvas><span>${esc(p.name)}</span>${p.ours ? '<i class="g-ours">new</i>' : ''}</button>`).join('')}</div>`;
        const grid = el.querySelector('.g-layouts');
        g.balance(grid, { min: 140 });
        const detail = document.createElement('div');
        detail.className = 'g-styles g-detail';
        const cards = () => [...grid.querySelectorAll('.g-layout')];
        const drawCards = () => cards().forEach((b) => thumb(g.preset(b.dataset.id), b.querySelector('canvas')));
        function place() {
          const card = cards().find((b) => b.dataset.id === s[slot]);
          if (!styles || !card || !detail.innerHTML) { detail.remove(); return; }
          const all = cards(), top = card.offsetTop;
          let last = card;
          for (let i = all.indexOf(card) + 1; i < all.length && all[i].offsetTop === top; i++) last = all[i];
          if (last.nextElementSibling !== detail) last.after(detail);
          detail.style.setProperty('--notch-x', card.offsetLeft + card.offsetWidth / 2 + 'px');
        }
        function fill() {
          const p = g.preset(s[slot]);
          if (!styles || !p || !shown.includes(p)) { detail.innerHTML = ''; place(); return; }
          const vi = Math.min(s[vk], p.variants.length - 1), variant = p.variants[vi], arts = variant.arts || [];
          const tile = (attrs, on, name) => `<button type="button" class="g-tile" ${attrs} aria-pressed="${on}"><canvas width="176" height="96"></canvas><span>${esc(name)}</span></button>`;
          let html = '';
          if (p.axes) {
            // a preset built from choices (the outline mouse): one row per choice; each tile is the variant you'd get by
            // changing just that choice
            const cur = variant.opts;
            for (const ax of p.axes) {
              html += `<div class="g-detail-row"><span class="g-detail-k">${esc(ax.label)}</span><div class="g-tiles">${ax.values.map(([k, n]) => {
                const i = p.variants.findIndex((v) => Object.entries({ ...cur, [ax.key]: k }).every(([a, b]) => v.opts[a] === b));
                return tile(`data-v="${i}"`, cur[ax.key] === k, n);
              }).join('')}</div></div>`;
            }
          } else if (p.variants.length > 1) html += `<div class="g-detail-row"><span class="g-detail-k">Style</span><div class="g-tiles">${p.variants.map((v, i) => tile(`data-v="${i}"`, i === vi, v.name)).join('')}</div></div>`;
          if (!variant.drawn) html += `<div class="g-detail-row"><span class="g-detail-k">Colours</span><div class="g-tiles">${tile('data-orig="0"', !+s.orig, 'Theme colours')}${arts.map((a, i) => tile(`data-a="${i}"`, !!+s.orig && i === s[ak], arts.length > 1 ? a.name : 'Its own colours')).join('')}</div></div>`;
          detail.innerHTML = html ? `<div class="g-detail-h"><b>${esc(p.name)}</b></div>${html}` : '';
          detail.querySelectorAll('.g-tiles').forEach((t) => g.balance(t, { min: 112, max: 150, gap: 8 }));
          detail.querySelectorAll('[data-v]').forEach((b) => thumb(p, b.querySelector('canvas'), +b.dataset.v));
          detail.querySelectorAll('[data-orig]').forEach((b) => thumb(p, b.querySelector('canvas'), vi));
          detail.querySelectorAll('[data-a]').forEach((b) => thumb(p, b.querySelector('canvas'), vi, { ai: +b.dataset.a, orig: true }));
          place();
        }
        el.onclick = (e) => {
          const b = e.target.closest('.g-layout');
          if (b) { g.set({ [slot]: b.dataset.id, [vk]: 0, [ak]: 0 }, 'layout'); return; }
          const t = e.target.closest('.g-tile');
          if (!t) return;
          if (t.dataset.v !== undefined) g.set({ [vk]: +t.dataset.v, [ak]: 0 }, 'layout');
          else if (t.dataset.orig !== undefined) g.set({ orig: 0 }, 'layout');
          else g.set({ [ak]: +t.dataset.a, orig: 1 }, 'layout');
        };
        new ResizeObserver(place).observe(grid);
        g.on((why) => {
          if (why === 'theme' || why === 'accent' || why === 'fonts') { drawCards(); fill(); }
          if (why === 'layout' || why === 'device') { cards().forEach((b) => b.setAttribute('aria-pressed', String(s[slot] === b.dataset.id))); fill(); }
        });
        drawCards(); fill();
        return { redraw: () => { drawCards(); fill(); } };
      },
      /** the frame round the overlay (no frame, a panel, or a little window with a title): its own row after el */
      frame(el) {
        el.innerHTML = `<span class="g-frame-k">Frame</span><div class="g-seg">${[['none', 'No frame'], ['panel', 'Panel'], ['window', 'Window']].map(([v, t]) => `<button type="button" data-f="${v}">${t}</button>`).join('')}</div><input type="text" class="g-title" maxlength="28" aria-label="Window title" placeholder="Window title">`;
        el.classList.add('g-frame');
        const input = el.querySelector('.g-title');
        input.value = s.title;
        const draw = () => {
          const f = L.frameOf(s);
          el.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
          input.hidden = f !== 'window';
        };
        el.onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) g.set({ frame: b.dataset.f }, 'frame'); };
        input.oninput = () => g.set({ title: input.value }, 'title');
        g.on((why) => (why === 'frame' || why === 'theme') && draw());
        draw();
      },
      /** sparkles on key presses (lightning, stars): Off or On; the theme's own until chosen */
      sparkles(el) {
        el.classList.add('g-frame', 'g-sparkles');
        el.innerHTML = `<span class="g-frame-k">Sparkles</span><div class="g-seg">${[['0', 'Off'], ['1', 'On ✦']].map(([v, t]) => `<button type="button" data-x="${v}">${t}</button>`).join('')}</div>`;
        const draw = () => { const on = L.fxOf(s) ? '1' : '0'; el.querySelectorAll('[data-x]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.x === on))); };
        el.onclick = (e) => { const b = e.target.closest('[data-x]'); if (b) g.set({ fx: b.dataset.x }, 'fx'); };
        g.on((why) => (why === 'fx' || why === 'theme') && draw());
        draw();
      },
      /** the whole look, in order: theme, its colours, frame, sparkles (step 3, after the layouts) */
      look(el) {
        el.classList.add('g-look');
        el.innerHTML = `<div class="g-look-row"><span class="g-frame-k">Theme</span><div class="g-look-themes"></div></div>
          <div class="g-look-row g-look-c"><span class="g-frame-k">Colours</span><div class="g-look-cols"></div></div>
          <div class="g-look-row g-look-f"></div><div class="g-look-row g-look-x"></div>`;
        g.ui.themes(el.querySelector('.g-look-themes'), { frame: false });
        g.ui.colours(el.querySelector('.g-look-cols'));
        g.ui.frame(el.querySelector('.g-look-f'));
        g.ui.sparkles(el.querySelector('.g-look-x'));
      },
      /** the eight themes */
      themes(el, { names = true, frame = true } = {}) {
        if (frame && !el.nextElementSibling?.classList.contains('g-frame')) { const f = document.createElement('div'); el.after(f); g.ui.frame(f); }
        el.innerHTML = Object.entries(L.THEMES).map(([id, t]) => `<button type="button" class="g-theme" data-t="${id}" aria-pressed="${s.theme === id}" style="--t-edge:#${t.edge};--t-key:#${t.key};--t-hi:#${t.hi};--t-acc:#${t.accent}"><span class="g-dots"><i></i><i></i><i></i><i></i></span>${names ? `<span>${t.label}</span>` : ''}</button>`).join('');
        el.classList.add('g-themes');
        g.balance(el, { min: 92, gap: 8 });
        el.onclick = (e) => { const b = e.target.closest('.g-theme'); if (b) g.set({ theme: b.dataset.t, ...NO_COLOURS }, 'theme'); };
        g.on(() => el.querySelectorAll('.g-theme').forEach((b) => b.setAttribute('aria-pressed', String(s.theme === b.dataset.t))));
      },
      /** the theme's colours, made yours: one chip per colour that changes the chosen layouts (all on one row), each
       *  opening its palette. Line art (WASD, the outline mouse) takes Keys (its lines) and Pressed only; our drawn
       *  layouts take Keys, Pressed, Letters (keyboards), Edges and Shine; a picture takes Edges and Shine only when they
       *  visibly change it (colourParts). Once Keys or Pressed is changed, a warning shows when the two are too alike to
       *  spot a press on stream, with a one-click fix */
      colours(host) {
        let open = '', token = 0, lineFirst = false;   // lineFirst: the first layout is line art, so Keys is its lines' colour
        const T = () => L.THEMES[s.theme];
        /** a colour as the theme has it (line art's Keys: its lines, which are dark when drawn on a light panel) */
        const own = (k) => {
          if (k === 'ink') return '';
          if (k !== 'key' || !lineFirst) return T()[k];
          const look = L.look({ ...s, key: '', orig: 0 });
          return look.lightBg ? look.edge : look.lines;
        };
        const value = (k) => L.hex(s[k]) || own(k);
        const set = (k, v) => g.set({ [k]: v }, k === 'accent' ? 'accent' : 'theme');
        /** the pressed colour nearest the chosen one that stands out from Keys (ΔE 35+) */
        function fixPressed() {
          const key = value('key'), acc = value('accent');
          const toward = lum(key) > 0.4 ? T().edge : 'ffffff';
          for (let t = 0.1; t <= 1; t += 0.05) { const c = mixHex(acc, toward, t); if (dE(c, key) >= 35) return c; }
          return toward;
        }
        const palette = (k) => {
          const cur = L.hex(s[k]);
          return `<div class="g-pal" data-k="${k}">
            ${k === 'ink' ? `<button type="button" class="g-sw g-auto" data-c="" aria-pressed="${!cur}" title="Auto: whichever reads best">Auto</button>`
              : `<button type="button" class="g-sw" data-c="" aria-pressed="${!cur}" title="${T().label}'s own" aria-label="${T().label}'s own" style="--c:#${own(k)}">★</button>`}
            ${SWATCHES.map((c) => `<button type="button" class="g-sw" data-c="${c}" aria-pressed="${cur === c}" aria-label="#${c}" style="--c:#${c}"></button>`).join('')}
            <label class="g-sw g-any" title="Any colour"><input type="color" value="#${value(k) || '2b2a4a'}" aria-label="Any colour"></label>
          </div>`;
        };
        let dragging = false;   // the any-colour picker is open: only its chip updates (rebuilding would close it)
        async function draw() {
          if (dragging) { const i = host.querySelector(`.g-chip[data-k="${open}"] i`); if (i) i.style.setProperty('--c', '#' + value(open)); return; }
          const my = ++token;
          const got = await Promise.all(chosenLayouts().map(colourParts));
          if (my !== token) return;
          lineFirst = !!got[0]?.line;
          const ks = COLOUR_PARTS.filter((k) => got.some((x) => x.parts.includes(k)));
          if (!ks.includes(open)) open = '';
          if (!ks.length) { host.innerHTML = `<p class="g-note">This layout keeps its own colours. Pick <b>Theme colours</b> under its styles to colour it.</p>`; return; }
          const auto = (k) => k === 'ink' && !L.hex(s.ink);
          host.innerHTML = `<div class="g-chips" style="--n:${ks.length}">${ks.map((k) => `<button type="button" class="g-chip" data-k="${k}" aria-expanded="${open === k}">
              <i style="--c:#${value(k) || 'ffffff'}">${auto(k) ? 'Auto' : ''}</i><span>${COLOURS[k].label}</span></button>`).join('')}</div>
            ${open ? `<div class="g-pop"><p><b>${COLOURS[open].label}</b> <span>${COLOURS[open].help}</span></p>${palette(open)}</div>` : ''}
            ${(L.hex(s.key) || L.hex(s.accent)) && dE(value('key'), value('accent')) < 30 ? `<p class="g-warn-row">Pressed is close to the key colour, so presses may be hard to spot on stream. <button type="button" class="g-fix">Make it stand out</button></p>` : ''}
            ${COLOUR_PARTS.some((k) => L.hex(s[k])) ? `<button type="button" class="g-reset">Back to ${T().label}'s colours</button>` : ''}`;
          // the swatches in even rows (never one alone on the last)
          const pal = host.querySelector('.g-pal');
          if (pal) { const sw = parseFloat(getComputedStyle(pal).getPropertyValue('--sw')); g.balance(pal, { min: sw, max: sw, gap: 7 }); }
        }
        host.addEventListener('click', (e) => {
          const c = e.target.closest('.g-chip');
          if (c) { open = open === c.dataset.k ? '' : c.dataset.k; draw(); return; }
          const b = e.target.closest('.g-sw[data-c]'), pal = e.target.closest('.g-pal');
          if (b && pal) set(pal.dataset.k, b.dataset.c);
          else if (e.target.closest('.g-fix')) set('accent', fixPressed());
          else if (e.target.closest('.g-reset')) g.set(NO_COLOURS, 'theme');
        });
        host.addEventListener('input', (e) => { const pal = e.target.closest('.g-pal'); if (pal && e.target.type === 'color') { dragging = true; set(pal.dataset.k, e.target.value.slice(1)); } });
        host.addEventListener('change', (e) => { if (e.target.type === 'color') { dragging = false; draw(); } });
        // drawn once a device is picked (the step is hidden until then): measuring pictures waits off the page's load
        g.on((why) => { if (s.device && ['theme', 'accent', 'layout', 'device', 'frame', 'fonts'].includes(why)) draw(); });
        if (s.device) draw();
      },
      /** the big download button, straight to the installer */
      download(el, { label = 'Download the helper' } = {}) {
        el.innerHTML = OS === 'mac' ? `<p class="g-note">The keyboard and mouse helper is Windows-only (and Linux). Streaming from this Mac? Pick <b>Controller</b>: it needs nothing installed.</p>`
          : `<a class="g-download" href="${INSTALLER.url}" download><span class="g-dl-ico">⬇</span><span><b>${label}</b><small>input-overlay ${INSTALLER.version} for Windows · ${INSTALLER.size} · free</small></span></a>
             <p class="g-small">Straight from its makers on GitHub. ${OS === 'linux' ? `On Linux? <a href="${INSTALLER.linux}">Get the .deb</a>.` : `<a href="${INSTALLER.page}" target="_blank" rel="noopener">What's this?</a>`}</p>`;
      },
      /** a live line: is input-overlay there, and have keys come through */
      helperStatus(el) {
        const draw = () => {
          const w = g.ws;
          el.className = 'g-status ' + (w.status === 'found' ? 'is-good' : w.status === 'missing' ? 'is-warn' : 'is-wait');
          el.innerHTML = w.status === 'found'
            ? (w.gotKey ? '<b>✓ Working!</b> Your keys are coming through.' : '<b>✓ Found it.</b> Now press a key in another window (your game, say).')
            : w.status === 'missing' ? '<b>Not found yet.</b> Is OBS open, with the box ticked, and restarted since?'
            : '<span class="g-spin"></span> Looking for it on this PC…';
        };
        g.on((why) => why === 'ws' && draw());
        draw();
      },
      padStatus(el) {
        const draw = () => { el.className = 'g-status ' + (g.pad ? 'is-good' : 'is-wait'); el.innerHTML = g.pad ? `<b>✓ Controller found:</b> ${esc(g.pad)}` : '<span class="g-spin"></span> Plug in your controller and press any button.'; };
        g.on((why) => why === 'pad' && draw());
        draw();
      },
      /** the link and its copy button, with the size to give the Browser source */
      link(el, { label = 'Copy link' } = {}) {
        el.innerHTML = `<button type="button" class="g-copy">${label}</button><code class="g-url"></code><small class="g-size"></small>`;
        const btn = el.querySelector('.g-copy');
        btn.onclick = () => g.copy(btn, label);
        const draw = () => { el.querySelector('.g-url').textContent = g.url(false); el.querySelector('.g-size').textContent = g.size ? `Width ${g.size.w} · Height ${g.size.h}` : ''; };
        g.on(draw); draw();
      },
    };
    document.fonts?.addEventListener('loadingdone', () => g.emit('fonts'));
    return g;
  }

  window.Guide = { create, INSTALLER, OS };
})();
