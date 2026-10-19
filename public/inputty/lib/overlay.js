// The overlay page (the OBS browser source): reads its settings from the link, draws the chosen layouts, and follows
// input from input-overlay's websocket, the Gamepad API and (when focused, or inside the set-up page) the browser.
(() => {
  const { PresetView, T } = window.IORender;
  const L = window.IOLooks, I = window.IOInput;
  let s = L.read();
  const VIEW_H = 380;
  const reduced = () => new URLSearchParams(location.search).get('motion') !== 'full' && !window.obsstudio && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const box = document.querySelector('.box'), viewsEl = box.querySelector('.views'), fit = document.getElementById('fit');
  const views = [];   // { kind: 'preset', view, el } | { kind: 'history', el }

  function applyLook() {
    document.body.dataset.theme = s.theme;
    const acc = L.look({ ...s, orig: 0 }).accent;
    document.body.style.setProperty('--accent', '#' + acc);
    document.body.style.setProperty('--bgo', String(s.bgo / 100));
    box.className = 'box ' + L.frameOf(s);
    // a thin outline in the edge colour keeps every preset readable over any game
    document.body.classList.toggle('outlined', !!+s.outline);
    document.body.style.setProperty('--outline-c', '#' + L.look({ ...s, orig: 0 }).edge);
    box.querySelector('.title').textContent = s.title;
    const look = L.look(s);
    // our drawn presets always take the theme (there's no art of their own to keep)
    views.forEach((v) => v.view && (v.view.drawn ? v.view.setLook(L.look({ ...s, orig: 0 }), L.THEMES[s.theme]) : v.view.setLook(look)));
    refit();
  }

  function refit() {
    fit.style.transform = 'none';
    const w = fit.offsetWidth, h = fit.offsetHeight;
    if (!w || !h) return;
    const k = Math.min(innerWidth / w, innerHeight / h) * 0.96;
    fit.style.transform = `scale(${k})`;
    // tell the set-up page the size that shows it 1:1, for the Browser source's width and height
    if (parent !== window) parent.postMessage({ type: 'io-size', w: Math.ceil(w / 0.96), h: Math.ceil(h / 0.96) }, '*');
  }
  addEventListener('resize', refit);

  async function build() {
    viewsEl.innerHTML = '';
    views.length = 0;
    const picks = [[s.p, s.v, s.a], [s.p2, s.v2, s.a2]].filter(([id]) => id);
    for (const [id, vi, ai] of picks) {
      const preset = window.IO_PRESETS.find((p) => p.id === id);
      if (!preset) continue;
      const variant = preset.variants[Math.min(vi, preset.variants.length - 1)];
      if (preset.history) {
        const el = document.createElement('div');
        el.className = 'history';
        el.style.height = VIEW_H + 'px';
        el.style.width = '520px';
        viewsEl.append(el);
        views.push({ kind: 'history', el });
        continue;
      }
      const view = variant.drawn ? new window.IODrawn.DrawnView(variant.drawn)
        : ((art) => new PresetView(variant.layout, art.src, { pixel: variant.pixel, aw: art.aw }))(variant.arts[Math.min(ai, variant.arts.length - 1)]);
      const el = document.createElement('div');
      el.className = 'view' + (variant.pixel ? ' pixel' : '');
      el.style.height = VIEW_H + 'px';
      el.style.width = Math.round((view.layout.w / view.layout.h) * VIEW_H) + 'px';
      el.append(view.canvas);
      viewsEl.append(el);
      views.push({ kind: 'preset', view, el });
      await view.load();
    }
    applyLook();
  }

  // ---- sparkles (Zojie) ----
  const SPARKS = [['⚡', '#fff27a'], ['✦', '#b8fbff'], ['★', '#ffd6fb'], ['✧', '#fff9c4']];
  function sparkle(el, fx, fy) {
    const sp = document.createElement('span');
    const [ch, col] = SPARKS[Math.floor(Math.random() * SPARKS.length)];
    const ang = Math.random() * Math.PI * 2;
    sp.className = 'spark';
    sp.textContent = ch;
    sp.style.color = col;
    sp.style.left = fx * 100 + '%';
    sp.style.top = fy * 100 + '%';
    sp.style.setProperty('--dx', Math.cos(ang) * 22 + 'px');
    sp.style.setProperty('--dy', Math.sin(ang) * 22 - 14 + 'px');
    sp.style.setProperty('--rot', (Math.random() * 60 - 30) + 'deg');
    el.append(sp);
    setTimeout(() => sp.remove(), 800);
  }

  // ---- the key history ----
  const { NAMES, MODIFIERS } = window.IOCodes;
  function historyKey(ev) {
    if (ev.kind !== 'key' || !ev.down || MODIFIERS.has(ev.code)) return;
    const held = [...I.state.keys].filter((k) => MODIFIERS.has(k)).map((k) => NAMES[k]);
    const label = [...new Set(held), NAMES[ev.code] || '?'];
    for (const v of views) {
      if (v.kind !== 'history') continue;
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = label.map((t, i) => (i < label.length - 1 ? `<b>${t}</b>+` : t)).join(' ');
      v.el.append(chip);
      while (v.el.children.length > 5) v.el.firstElementChild.remove();
      setTimeout(() => chip.classList.add('old'), 2600);
      setTimeout(() => chip.remove(), 3300);
    }
  }

  I.on((ev) => {
    if (ev.src && ev.src !== 'demo') lastReal = performance.now();
    historyKey(ev);
    if (!ev.down || !L.fxOf(s) || reduced()) return;
    for (const v of views) {
      if (v.kind !== 'preset') continue;
      for (const e of v.view.elementsFor(ev).slice(0, 1)) sparkle(v.el, ...v.view.centre(e));
    }
  });

  // ---- demo: presses the layout's own buttons by itself (for previews and screenshots); real input pauses it ----
  let lastReal = -1e9, demoNext = 0, demoHeld = null;
  function demo(now) {
    if (!+s.demo || now - lastReal < 4000) return;
    const t = now / 1000, a = I.state.pad.axes;
    a[0] = Math.cos(t * 2) * 0.9; a[1] = Math.sin(t * 2) * 0.9; a[2] = Math.sin(t * 1.3) * 0.8; a[3] = Math.cos(t * 1.7) * 0.8;
    a[4] = (Math.sin(t * 1.5) + 1) / 2; a[5] = (Math.cos(t * 1.1) + 1) / 2;
    I.state.move.accX += Math.cos(t * 1.6) * 14; I.state.move.accY += Math.sin(t * 1.6) * 14;
    if (now < demoNext) return;
    if (demoHeld) { demoHeld(); demoHeld = null; demoNext = now + 90; return; }
    const els = views.flatMap((v) => (v.view ? v.view.els : []));
    const pressable = els.filter((e) => [T.KEY, T.MOUSE_BUTTON, T.PAD_BUTTON, T.DPAD, T.WHEEL].includes(e.t));
    if (views.some((v) => v.kind === 'history')) pressable.push(...[0x11, 0x1e, 0x1f, 0x20, 0x39, 0x12, 0x13].map((c) => ({ t: T.KEY, c })));
    if (!pressable.length) { demoNext = now + 400; return; }
    const e = pressable[Math.floor(Math.random() * pressable.length)];
    if (e.t === T.KEY) { I.key(e.c, true, 'demo'); demoHeld = () => I.key(e.c, false, 'demo'); }
    else if (e.t === T.MOUSE_BUTTON) { I.mouse(e.c, true, 'demo'); demoHeld = () => I.mouse(e.c, false, 'demo'); }
    else if (e.t === T.PAD_BUTTON) { I.padButton(e.c, true, 'demo'); demoHeld = () => I.padButton(e.c, false, 'demo'); }
    else if (e.t === T.DPAD) { const b = 11 + Math.floor(Math.random() * 4); I.padButton(b, true, 'demo'); demoHeld = () => I.padButton(b, false, 'demo'); }
    else if (e.t === T.WHEEL) { I.wheel(Math.random() < 0.5 ? 1 : -1); }
    if (!I.state.pad.connected && els.some((x) => x.t === T.PLAYER)) I.state.pad.connected = true;
    demoNext = now + 170 + Math.random() * 160;
  }

  function frame(now) {
    I.tick();
    demo(now);
    for (const v of views) if (v.view) v.view.draw(I.state, now);
    requestAnimationFrame(frame);
  }

  // ---- messages from the set-up page around the preview ----
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'io-input') I.local(d);
    if (d.type === 'io-look') { s = { ...s, ...d.look }; applyLook(); }
    if (d.type === 'widget-theme') { if (d.theme && L.THEMES[d.theme]) s.theme = d.theme; if (d.accent !== undefined) s.accent = d.accent; applyLook(); }
  });

  I.listenLocal(window);
  // a preview (demo=1, on the set-up page or the widgets page) gets its keys from the page around it: no websocket
  if (!+s.demo) I.connect(s.port);
  // ready once the layouts are drawn (the widgets page fades its picture out for the live overlay then)
  build().then(() => { requestAnimationFrame(frame); requestAnimationFrame(() => (document.documentElement.dataset.ready = '1')); });
  document.fonts?.ready.then(refit);
})();
