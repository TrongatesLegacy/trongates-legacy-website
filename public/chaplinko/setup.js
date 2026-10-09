// The Chaplinko page: the form ⇄ the settings ⇄ the OBS links (the board's, and the separate leaderboard's), the live
// preview, the odds, the channel checks, the looks gallery and the hero. docs/widgets.md, "The Chaplinko page".
// Settings come from the page's own link (open /chaplinko/?kick=name… to edit an existing link's settings) or what this
// browser used last.
(() => {
  const W = window.Widgets, K = window.Chaplinko, SCHEMA = K.settings.SCHEMA;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const form = $('#form');
  const KEY = 'chaplinko:setup';
  const THEME_NAMES = { chatagram: 'Chatagram', chaplinko: 'Chaplinko', neutral: 'Neutral', light: 'Light', neon: 'Neon', candy: 'Candy', royal: 'Royal', deep: 'Deep', cozy: 'Cozy' };
  const THEME_BG = { chatagram: '#16122b', chaplinko: '#0a1233', neutral: '#1b1e26', light: '#f4f5f8', neon: '#03060d', candy: '#6b2fd6', royal: '#0a0510', deep: '#020b11', cozy: '#f3e6cf' };
  const ACCENTS = [['ff7a1a', 'Tangerine'], ['ff3d8b', 'Jackpot pink'], ['2ee6a8', 'Mint'], ['22e5ff', 'Cyan'], ['4f8cff', 'Blue'], ['ffc93c', 'Sun'], ['b48cff', 'Lilac']];
  const ADVANCED = ['bigwin', 'motion', 'speed', 'hint', 'showcmd', 'nearmiss', 'max', 'cool', 'ignore', 'remember', 'credit', 'cmd', 'perm'];

  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const fromLink = location.search.length > 1;
  let s = W.settings.decode(SCHEMA, fromLink ? location.search : saved ? W.settings.encode(SCHEMA, saved) : '');
  s.cmd = K.settings.shortCommand(s.cmd);                                     // an older, longer command is shortened here
  let manualKickId = !!(fromLink && s.kickid);

  // ---- swatches ------------------------------------------------------------------------------------------------------
  const swatches = (name) => K.settings.THEMES.map((t) => `<label title="${THEME_NAMES[t]}"><input type="radio" name="${name}" value="${t}" aria-label="${THEME_NAMES[t]}"><span style="background:linear-gradient(90deg, ${THEME_BG[t]} 58%, #${W.theme.ACCENTS[t]} 0)${t === 'light' || t === 'cozy' ? ';box-shadow:inset 0 0 0 1px #0003' : ''}"></span></label>`).join('');
  $('#theme-pick').innerHTML = swatches('theme');
  $('#lbtheme-pick').innerHTML = swatches('lbtheme');
  // accent swatches: the board's (accent) and the leaderboard's own (lbaccent, with its own theme)
  const PICKERS = { accent: { box: '#accents', theme: () => s.theme, radio: 'accentpick', custom: 'accent-custom' }, lbaccent: { box: '#lbaccents', theme: () => (s.lbtheme === 'same' ? s.theme : s.lbtheme), radio: 'lbaccentpick', custom: 'lbaccent-custom' } };
  function drawAccents() {
    for (const [key, p] of Object.entries(PICKERS)) {
      const def = W.theme.ACCENTS[p.theme()], cur = s[key];
      const list = [[def, 'The theme’s own colour'], ...ACCENTS.filter(([c]) => c !== def)].slice(0, 7);
      const custom = cur && !list.some(([c]) => c === cur) ? cur : '';
      $(p.box).innerHTML = list.map(([c, n], i) => `<label title="${n}"><input type="radio" name="${p.radio}" value="${i ? c : ''}" aria-label="${n}"><span style="background:#${c}"></span></label>`).join('') +
        `<label class="custom${custom ? ' on' : ''}" title="Any colour"${custom ? ` style="background:#${custom}"` : ''}><input type="color" id="${p.custom}" value="#${custom || def}" aria-label="Pick any colour"></label>`;
      const pick = custom ? null : cur && list.slice(1).some(([c]) => c === cur) ? cur : '';
      for (const r of $$(`input[name=${p.radio}]`)) r.checked = pick !== null && r.value === pick;
    }
  }

  // ---- tag fields (ignored users): chips with a ×; Enter, comma or leaving the box adds ---------------------------------------
  function drawTags(box) {
    const k = box.dataset.tags, input = box.querySelector('input'), typed = input ? input.value : '', focused = input && document.activeElement === input;
    box.innerHTML = s[k].map((t) => `<span class="tag">${esc(t)}<button type="button" data-remove="${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`).join('') +
      `<input type="text" autocomplete="off" spellcheck="false" enterkeyhint="done" placeholder="${esc(box.dataset.placeholder)}" aria-label="${esc(box.dataset.placeholder)}">`;
    const inp = box.querySelector('input'); inp.value = typed; if (focused) inp.focus();
  }
  function addTags(box, text) {
    const k = box.dataset.tags, add = text.split(/[,\s]+/).map((x) => x.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    for (const t of add) if (!s[k].includes(t)) s[k] = [...s[k], t];
    box.querySelector('input').value = '';
    drawTags(box); update({ fill: false });
  }
  for (const box of $$('[data-tags]')) {
    box.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) { s[box.dataset.tags] = s[box.dataset.tags].filter((t) => t !== rm.dataset.remove); drawTags(box); box.querySelector('input').focus(); update({ fill: false }); }
      else box.querySelector('input').focus();
    });
    box.addEventListener('keydown', (e) => {
      const inp = e.target; if (inp.tagName !== 'INPUT') return;
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(box, inp.value); }
      else if (e.key === 'Backspace' && !inp.value && s[box.dataset.tags].length) { s[box.dataset.tags] = s[box.dataset.tags].slice(0, -1); drawTags(box); update({ fill: false }); }
    });
    box.addEventListener('focusout', (e) => { if (e.target.tagName === 'INPUT' && e.target.value.trim()) addTags(box, e.target.value); });
  }

  // ---- form ⇄ settings -------------------------------------------------------------------------------------------------
  const separate = () => s.layout === 'separate' || s.side === 'off';
  function fill() {
    for (const [k, f] of Object.entries(SCHEMA)) {
      for (const el of $$(`[name="${k}"]`, form)) {
        if (el.type === 'radio') el.checked = el.value === String(s[k]);
        else if (el.type === 'checkbox') el.checked = !!s[k];
        else if (f.type === 'list') el.value = s[k].join(', ');
        else if (k === 'kickid') el.value = manualKickId && s.kickid ? s.kickid : '';
        else el.value = s[k];
      }
    }
    for (const box of $$('[data-tags]')) drawTags(box);
    $('#theme-name').textContent = THEME_NAMES[s.theme];
    $('#own').checked = s.lbtheme !== 'same';
    for (const r of $$('input[name=lbtheme]')) r.checked = r.value === (s.lbtheme === 'same' ? s.theme : s.lbtheme);
    drawAccents();
  }
  function read(el) {
    const k = el.name, f = SCHEMA[k]; if (!f) return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (f.type === 'int') { v = parseInt(el.value, 10); if (k === 'kickid') { manualKickId = !!v; v = v || 0; } }
    else if (f.type === 'list') v = el.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    else v = el.value;
    const clean = W.settings.read(f, f.type === 'bool' ? (v ? '1' : '0') : f.type === 'list' ? v.join(',') : String(v));
    s[k] = clean === undefined ? (f.type === 'list' ? [] : f.def) : clean;
  }
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.closest('[data-tags]')) return;
    const picker = Object.entries(PICKERS).find(([, p]) => el.name === p.radio || el.id === p.custom);
    if (picker && el.name === picker[1].radio) s[picker[0]] = el.value;
    else if (picker) { s[picker[0]] = el.value.replace('#', ''); const c = el.closest('.custom'); c.classList.add('on'); c.style.background = el.value; for (const r of $$(`input[name=${picker[1].radio}]`)) r.checked = false; update({ fill: false }); return; }
    else if (el.id === 'own') { s.lbtheme = el.checked ? s.theme : 'same'; s.lbaccent = ''; }
    else if (el.type === 'text' || (el.tagName === 'INPUT' && !['radio', 'checkbox'].includes(el.type))) {
      read(el);
      if (el.name === 'kick' || el.name === 'kickid') check('kick');
      if (el.name === 'twitch') check('twitch');
      update({ fill: false }); return;
    }
    else read(el);
    if (el.name === 'theme') s.accent = '';
    if (el.name === 'lbtheme') s.lbaccent = '';
    update();
  });
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'twitch') { s.twitch = W.platforms.twitch.channel(el.value); el.value = s.twitch; }
    if (el.name === 'kick') { s.kick = W.platforms.kick.channel(el.value); el.value = s.kick; }
    if (el.name === 'cmd') { s.cmd = K.settings.shortCommand(el.value); el.value = s.cmd; }
    if (el.id === 'accent-custom' || el.id === 'lbaccent-custom') drawAccents();
    update({ fill: false });
  });

  // ---- the odds: each slot's points and its real chance (odds.js: 100,000 drops through the same physics) ------------------------
  function drawOdds() {
    const values = K.settings.slotValues(s), counts = K.odds.counts[s.rows], top = Math.max(...values);
    // the board is symmetric, so each value once, from the edge in: its chance per ball (both sides together) and a bar
    const n = values.length, rows = [];
    for (let i = 0; i < Math.ceil(n / 2); i++) { const c = i === n - 1 - i ? counts[i] : counts[i] + counts[n - 1 - i]; rows.push([values[i], c / K.odds.drops]); }
    const most = Math.max(...rows.map(([, p]) => p));
    const chance = (p) => (p >= 0.1 ? `${Math.round(p * 100)}%` : `1 in ${Math.round(1 / p).toLocaleString('en')}`);
    $('#odds').innerHTML = rows.map(([v, p]) => `<div class="${v === top ? 'top' : ''}"><b>${v}</b><span class="bar"><i style="width:${Math.max(2, (p / most) * 100)}%"></i></span><span class="ch">${chance(p)}</span></div>`).join('');
    const c = K.settings.command(s);
    $('#cmd-name').textContent = c;
    for (const el of $$('[data-cmd]')) el.textContent = el.dataset.cmd ? `${c} ${el.dataset.cmd}` : c;
  }

  // ---- channel checks: say under each box whether the channel exists ---------------------------------------------------------
  async function twitchUser(login) {
    try {
      const r = await fetch('https://gql.twitch.tv/gql', { method: 'POST', headers: { 'Client-Id': W.platforms.twitch.GQL_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query{user(login:${JSON.stringify(login)}){login displayName}}` }) });
      if (!r.ok) return undefined;
      const j = await r.json();
      return j && j.data ? j.data.user : undefined;
    } catch { return undefined; }
  }
  const timers = {}, asks = { twitch: 0, kick: 0 }, found = { twitch: null, kick: null };
  function status(p, cls, text) { const el = $(`#${p}-st`); el.className = 'st' + (cls ? ' ' + cls : ''); el.textContent = text; }
  function check(p) {
    clearTimeout(timers[p]);
    const name = W.platforms[p].channel(s[p]);
    found[p] = null;
    if (p === 'kick' && !manualKickId) s.kickid = 0;
    if (!name) { status(p, '', ''); kickIdField(); readyToCopy(); return; }
    status(p, 'wait', 'Checking…');
    timers[p] = setTimeout(async () => {
      const ask = ++asks[p];
      if (p === 'twitch') {
        const u = await twitchUser(name);
        if (ask !== asks[p]) return;
        if (u) { found.twitch = true; status(p, 'ok', `Found ${u.displayName || u.login} on Twitch`); }
        else if (u === null) { found.twitch = false; status(p, 'bad', `No Twitch channel called “${name}”. Check the spelling.`); }
        else status(p, '', 'Couldn’t check with Twitch just now. If the name is right, it will work.');
      } else {
        const id = await W.platforms.kick.chatroom(name);
        if (ask !== asks[p]) return;
        if (id) { found.kick = true; status(p, 'ok', `Found ${name} on Kick, chat ready`); if (!manualKickId) { s.kickid = id; update({ fill: false }); } }
        else if (manualKickId && s.kickid) status(p, 'ok', 'Using the chatroom ID you entered');
        else { found.kick = false; status(p, 'bad', `Kick didn’t confirm “${name}”. Check the spelling.`); }
      }
      kickIdField();
    }, 500);
    kickIdField(); readyToCopy();
  }
  function kickIdField() { $('#kickid-field').hidden = !(manualKickId || (s.kick && found.kick === false)); }

  // ---- the links -----------------------------------------------------------------------------------------------------------------
  const hasChannel = () => !!(W.platforms.twitch.channel(s.twitch) || W.platforms.kick.channel(s.kick));
  const boardQuery = () => W.settings.encode(SCHEMA, s);
  const lbQuery = () => { const v = K.settings.leaderboardSettings(s), sch = Object.fromEntries(K.settings.LB_KEYS.map((k) => [k, SCHEMA[k]])); return W.settings.encode(sch, v); };
  const boardLink = () => `${location.origin}/chaplinko/play${boardQuery() ? '?' + boardQuery() : ''}`;
  const lbLink = () => `${location.origin}/chaplinko/leaderboard${lbQuery() ? '?' + lbQuery() : ''}`;
  function readyToCopy() {
    const ok = hasChannel();
    $('#copy').disabled = !ok; $('#copy-lb').disabled = !ok;
    $('#links').hidden = !ok;
    $('#need').hidden = ok;
    if (!ok) $('#link').hidden = true;
  }

  // ---- the preview: the board (and the separate leaderboard) with a pretend chat, over a pretend game ---------------------------------
  const pv = $('#pv'), lbpv = $('#lbpv');
  let lastPv = '', lastLb = '', pvTimer = null, loaded = false;
  const lbSize = () => (s.lbshape === 'strip' ? K.settings.SIZES.strip : K.settings.SIZES.panel(s.lbn));
  function fitFrame(frame, box, [w, h]) {
    frame.width = w; frame.height = h;
    const k = Math.min((box.clientWidth - 16) / w, (box.clientHeight - 16) / h);
    frame.style.transform = `translate(-50%,-50%) scale(${k})`;
    const poster = box.querySelector('.poster');
    if (poster) Object.assign(poster.style, { left: '50%', top: '50%', width: w * k + 'px', height: h * k + 'px', transform: 'translate(-50%, -50%)' });
  }
  const polls = new Map();
  function showWhenReady(frame) {
    const poster = frame.parentElement.querySelector('.poster');
    clearInterval(polls.get(frame));
    frame.classList.remove('ready'); if (poster) poster.classList.remove('gone');
    const poll = setInterval(() => {
      let ok = false; try { ok = frame.contentDocument.documentElement.dataset.ready === '1'; } catch {}
      if (ok) { clearInterval(poll); requestAnimationFrame(() => { frame.classList.add('ready'); if (poster) poster.classList.add('gone'); }); }
    }, 100);
    polls.set(frame, poll);
    setTimeout(() => clearInterval(poll), 15000);
  }
  function layoutPreview() {
    const sep = separate(), comb = s.layout === 'combined' && s.side !== 'off';
    fitFrame(pv, $('#pv-screen'), comb ? K.settings.SIZES.combined : K.settings.SIZES.separate);
    $('#pv-poster').setAttribute('src', comb ? 'assets/themes/combined.webp' : s.bgo === 0 ? 'assets/themes/clear.webp' : `assets/themes/${s.theme}.webp`);
    $('#lb-screen').hidden = $('#lb-lab').hidden = !sep || s.layout === 'combined';
    if (!$('#lb-screen').hidden) fitFrame(lbpv, $('#lb-screen'), lbSize());
  }
  function preview() {
    layoutPreview(); rmNotes();
    if (!loaded) return;
    const shown = { ...s, theme: SCHEMA.theme.def, accent: '' };               // theme and accent go by message (no reload)
    const src = `play.html?${W.settings.encode(SCHEMA, shown)}&demo=1&share=1${s.motion === 'reduce' ? '' : animate()}`;   // share: this pretend board feeds the pretend leaderboard
    if (src !== lastPv) { lastPv = src; pv.src = src; showWhenReady(pv); pv.onload = () => themePreview(); } else themePreview();
    if (!$('#lb-screen').hidden) {
      const v = K.settings.leaderboardSettings(s);
      const lsrc = `leaderboard.html?${W.settings.encode(SCHEMA, { ...v, theme: SCHEMA.theme.def, accent: '', lbtheme: 'same' })}&demo=1`;
      if (lsrc !== lastLb) { lastLb = lsrc; lbpv.src = lsrc; showWhenReady(lbpv); lbpv.onload = () => themePreview(); }
    }
  }
  // Reduced motion (the device's setting): the boards here drop nothing, as asked, so say so; the visitor can choose to see
  // them fall anyway (remembered, only on this page: the OBS links never carry it, and OBS ignores the device's setting).
  const rmQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let watch = localStorage.getItem('chaplinko:animate') === '1';
  const animate = () => (watch && rmQuery.matches ? '&animate=1' : '');
  function rmNotes() {
    const say = watch ? '<p><button type="button" title="Your device asks for less motion">Keep the balls still</button></p>'
      : '<p><span>Your device asks for less motion, so the balls are invisible here. In OBS they fall.</span><button type="button" class="btn small">SHOW THEM FALLING</button></p>';
    for (const [id, show] of [['hero-rm', true], ['pv-rm', s.motion !== 'reduce']]) {
      const el = $('#' + id);
      el.hidden = !rmQuery.matches || !show;
      if (el.dataset.watch !== String(watch)) { el.innerHTML = say; el.dataset.watch = String(watch); el.classList.toggle('on', watch); }
    }
  }
  function heroSrc() { const src = 'play.html?demo=1' + animate(); if (loaded && !hero.src.endsWith(src)) { hero.src = src; showWhenReady(hero); } }
  for (const id of ['hero-rm', 'pv-rm']) $('#' + id).addEventListener('click', (e) => {
    if (!e.target.closest('button')) return;
    watch = !watch;
    try { watch ? localStorage.setItem('chaplinko:animate', '1') : localStorage.removeItem('chaplinko:animate'); } catch {}
    rmNotes(); heroSrc(); preview();
  });
  rmQuery.addEventListener('change', () => { rmNotes(); heroSrc(); preview(); });
  function themePreview() {
    try { pv.contentWindow.postMessage({ type: 'widget-theme', theme: s.theme, accent: s.accent }, '*'); } catch {}
    const v = K.settings.leaderboardSettings(s);
    try { lbpv.contentWindow.postMessage({ type: 'widget-theme', theme: v.theme, accent: v.accent }, '*'); } catch {}
  }
  function update({ fill: refill = true } = {}) {
    if (refill) fill();
    rmNotes();
    const comb = s.layout === 'combined';
    $('#side-field').hidden = !comb;
    $('#layout-note').textContent = comb ? 'One source, 960 × 540: the board with the leaderboard beside it.' : 'Two sources: the board (640 × 540) and the leaderboard, each placed where you like.';
    $('#shape-field').hidden = comb;
    $('#own-field').hidden = comb && s.side === 'off';                    // its own theme works beside the board too
    $('#own-look').hidden = $('#own-accent').hidden = s.lbtheme === 'same' || (comb && s.side === 'off');
    $('#every-field').hidden = s.lbshow !== 'both';
    $('#lbbgo-field').hidden = comb && s.side === 'off';
    $('#lb-card').hidden = comb && s.side === 'off';
    const [bw, bh] = comb && s.side !== 'off' ? K.settings.SIZES.combined : K.settings.SIZES.separate, [lw, lh] = lbSize();
    $('#copy').textContent = comb ? 'COPY OBS LINK' : 'COPY BOARD LINK';
    $('#copy-lb').hidden = comb;
    $('#sizes').innerHTML = comb ? `Browser source <b>${bw} × ${bh}</b>` : `Board <b>${bw} × ${bh}</b> · leaderboard <b>${lw} × ${lh}</b>`;
    $('#link').textContent = comb ? boardLink() : `${boardLink()}\n\n${lbLink()}`;
    $('#open').href = boardLink();
    const n = W.settings.changed(SCHEMA, s, ADVANCED) + (manualKickId && s.kickid ? 1 : 0);
    $('#chg').hidden = !n; $('#chg').textContent = `${n} changed`;
    $('#reset').disabled = !W.settings.changed(SCHEMA, s, resettable());
    drawOdds();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    readyToCopy();
    layoutPreview();
    themePreview();
    clearTimeout(pvTimer); pvTimer = setTimeout(preview, 350);
  }
  addEventListener('resize', () => { layoutPreview(); fitHero(); });

  // ---- copy ------------------------------------------------------------------------------------------------------------------------
  async function copy(btn, l, label) {
    if (!hasChannel()) return;
    try { await navigator.clipboard.writeText(l); btn.textContent = 'COPIED!'; }
    catch { $('#link').hidden = false; $('#show').setAttribute('aria-expanded', 'true'); getSelection().selectAllChildren($('#link')); btn.textContent = 'PRESS CTRL+C'; }
    setTimeout(() => { btn.textContent = label(); }, 1800);
  }
  $('#copy').addEventListener('click', (e) => copy(e.currentTarget, boardLink(), () => (s.layout === 'combined' ? 'COPY OBS LINK' : 'COPY BOARD LINK')));
  $('#copy-lb').addEventListener('click', (e) => copy(e.currentTarget, lbLink(), () => 'COPY LEADERBOARD LINK'));
  $('#open').addEventListener('click', (e) => { if (!hasChannel()) e.preventDefault(); });
  $('#show').addEventListener('click', (e) => { if (!hasChannel()) return; const l = $('#link'); l.hidden = !l.hidden; e.currentTarget.setAttribute('aria-expanded', String(!l.hidden)); e.currentTarget.textContent = l.hidden ? 'Show links' : 'Hide links'; });
  $('#link').style.whiteSpace = 'pre-wrap';
  // the odds tooltip: shows on hover or focus; a tap (phones) pins it open, a tap anywhere else closes it
  const info = $('#odds-info');
  info.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); const open = !info.classList.contains('open'); info.classList.toggle('open', open); e.currentTarget.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', (e) => { if (!info.contains(e.target)) { info.classList.remove('open'); info.querySelector('button').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { info.classList.remove('open'); info.querySelector('button').setAttribute('aria-expanded', 'false'); } });
  // Reset to defaults (Advanced, top right): every setting back to its default, except the channels (the owner: all
  // settings, not just the advanced ones; wiping the channel names too is never what anyone wants)
  const KEEP = ['twitch', 'kick', 'kickid'];
  const resettable = () => Object.keys(SCHEMA).filter((k) => !KEEP.includes(k));
  $('#reset').addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    for (const k of resettable()) s[k] = Array.isArray(SCHEMA[k].def) ? [...SCHEMA[k].def] : SCHEMA[k].def;
    update();
  });
  if (fromLink && W.settings.changed(SCHEMA, s, ADVANCED)) $('#adv').open = true;

  // ---- the looks gallery (pictures, made by artwork/chaplinko/render-previews.mjs) and the hero ------------------------------------------
  $('#tgrid').innerHTML = K.settings.THEMES.map((t) => `<li><button type="button" class="thm" data-theme-pick="${t}" aria-label="Use the ${THEME_NAMES[t]} theme"><img src="assets/themes/${t}.webp" alt="" width="640" height="540" loading="lazy"><h3>${THEME_NAMES[t]}</h3></button></li>`).join('');
  for (const b of $$('[data-theme-pick]')) b.addEventListener('click', () => { s.theme = b.dataset.themePick; s.accent = ''; if (s.bgo === 0) s.bgo = 95; update(); $('#setup').scrollIntoView(); });
  // The hero shows a picture straight away; the live board (with the pretend chat) starts after the page has loaded and fades
  // in over it once it has drawn, so nothing competes with the first paint (docs/website.md).
  const hero = $('#hero-frame');
  const fitHero = () => fitFrame(hero, $('#hero-screen'), K.settings.SIZES.separate);
  fitHero();
  // the pretend chat beside the hero board: its last three messages
  const chat = $('#chat');
  addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'chaplinko-chat' || e.source !== hero.contentWindow) return;
    const m = document.createElement('div'); m.className = 'msg';
    // an emote shows as itself, as it would in chat (only the page's own pictures: same origin)
    const em = d.emote && typeof d.emote.url === 'string' && d.emote.url.startsWith(location.origin + '/chaplinko/assets/emotes/') ? d.emote : null;
    const text = em ? `${esc(d.text.replace(em.name, '').trim())} <img src="${esc(em.url)}" alt="${esc(em.name)}" width="22" height="22">` : esc(d.text);
    m.innerHTML = `<b style="color:${/^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : '#ff7a1a'}">${esc(d.name)}</b>${text}`;
    chat.appendChild(m);
    while (chat.children.length > 3) chat.firstElementChild.remove();
    if (m.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) m.animate([{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(10px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }]   /* revealed, not faded: a dimmed bubble fails colour contrast */, { duration: 250, easing: 'ease-out' });
  });
  const afterLoad = () => setTimeout(() => { loaded = true; heroSrc(); preview(); }, 300);
  if (document.readyState === 'complete') afterLoad(); else addEventListener('load', afterLoad);

  // ---- the menu shows where you are ---------------------------------------------------------------------------------------------------
  // The section whose top has passed under the menu bar (the last one at the very bottom, as it may never get there);
  // a clicked link stays lit while the page scrolls to it, as a short section can't reach the top of a tall window.
  const links = $$('.menu a'), secs = ['how', 'looks', 'setup', 'faq'].map((id) => document.getElementById(id));
  const light = (id) => { for (const a of links) a.classList.toggle('on', a.getAttribute('href') === '#' + id); };
  let held = 0, queued = false;
  const spot = () => {
    queued = false;
    if (held) return;
    const line = $('.nav').offsetHeight + 24, el = document.documentElement;
    const atEnd = innerHeight + scrollY >= el.scrollHeight - 4;
    light(atEnd && scrollY > 0 ? secs[secs.length - 1].id : (secs.filter((x) => x.getBoundingClientRect().top <= line).pop() || {}).id);
  };
  const settle = () => { clearTimeout(held); held = setTimeout(() => { held = 0; }, 250); };
  addEventListener('scroll', () => { if (held) settle(); else if (!queued) { queued = true; requestAnimationFrame(spot); } }, { passive: true });
  for (const a of links) a.addEventListener('click', () => { light(a.getAttribute('href').slice(1)); settle(); });
  spot();

  fill(); update();
  if (s.twitch) check('twitch');
  if (s.kick) check('kick');
  window.chaplinkoSetup = { get settings() { return s; }, boardLink, lbLink, found };
})();
