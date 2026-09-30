// The Chatagram page's set-up: the form ⇄ the settings ⇄ the OBS link, the live preview, the channel checks, the tag
// fields, the theme gallery and the hero. docs/widgets.md, "The Chatagram page". Settings come from the page's own link
// (open /chatagram/?kick=name… to edit an existing overlay link's settings) or what this browser used last.
(() => {
  const W = window.Widgets, C = window.Chatagram, SCHEMA = C.settings.SCHEMA;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const form = $('#form');
  const KEY = 'chatagram:setup';
  const THEME_NAMES = { chatagram: 'Chatagram', chaplinko: 'Chaplinko', neutral: 'Neutral', light: 'Light', neon: 'Neon', candy: 'Candy', royal: 'Royal', deep: 'Deep', cozy: 'Cozy' };
  const THEME_BG = { chatagram: '#16122b', chaplinko: '#0a1233', neutral: '#1b1e26', light: '#f4f5f8', neon: '#03060d', candy: '#6b2fd6', royal: '#0a0510', deep: '#020b11', cozy: '#f3e6cf' };
  const ACCENTS = [['ffc93c', 'Sun'], ['ff5a5f', 'Coral'], ['2ee6a8', 'Mint'], ['22e5ff', 'Cyan'], ['4f8cff', 'Blue'], ['b48cff', 'Lilac'], ['ff63b8', 'Pink']];
  const ADVANCED = ['shuffle', 'slots', 'minlen', 'goal', 'tricky', 'longbonus', 'bonus', 'locks', 'lockmsg', 'next', 'restart', 'cstart', 'cnext', 'cskip', 'creset', 'ctop', 'cclear', 'perm', 'lb', 'wrong', 'ignore', 'block', 'top', 'remember', 'bgo', 'credit'];

  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const fromLink = location.search.length > 1;
  let s = W.settings.decode(SCHEMA, fromLink ? location.search : saved ? W.settings.encode(SCHEMA, saved) : '');
  let manualKickId = !!(fromLink && s.kickid);

  // ---- swatches ------------------------------------------------------------------------------------------------------
  $('#theme-pick').innerHTML = C.settings.THEMES.map((t) => `<label title="${THEME_NAMES[t]}"><input type="radio" name="theme" value="${t}" aria-label="${THEME_NAMES[t]}"><span style="background:linear-gradient(90deg, ${THEME_BG[t]} 58%, #${W.theme.ACCENTS[t]} 0)${t === 'light' || t === 'cozy' ? ';box-shadow:inset 0 0 0 1px #0003' : ''}"></span></label>`).join('');
  function drawAccents() {
    const def = W.theme.ACCENTS[s.theme];
    const list = [[def, 'The theme’s own colour'], ...ACCENTS.filter(([c]) => c !== def)].slice(0, 7);
    const custom = s.accent && !list.some(([c]) => c === s.accent) ? s.accent : '';
    $('#accents').innerHTML = list.map(([c, n], i) => `<label title="${n}"><input type="radio" name="accentpick" value="${i ? c : ''}" aria-label="${n}"><span style="background:#${c}"></span></label>`).join('') +
      `<label class="custom${custom ? ' on' : ''}" title="Any colour"${custom ? ` style="background:#${custom}"` : ''}><input type="color" id="accent-custom" value="#${custom || def}" aria-label="Pick any colour"></label>`;
    const pick = custom ? null : s.accent && list.slice(1).some(([c]) => c === s.accent) ? s.accent : '';
    for (const r of $$('input[name=accentpick]')) r.checked = pick !== null && r.value === pick;
  }

  // ---- tag fields (ignored users, blocked words): chips with a ×; Enter, comma or leaving the box adds -------------------------
  function drawTags(box) {
    const k = box.dataset.tags, input = box.querySelector('input'), typed = input ? input.value : '', focused = input && document.activeElement === input;
    box.innerHTML = s[k].map((t) => `<span class="tag">${esc(t)}<button type="button" data-remove="${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`).join('') +
      `<input type="text" autocomplete="off" spellcheck="false" enterkeyhint="done" placeholder="${esc(box.dataset.placeholder)}" aria-label="${esc(box.dataset.placeholder)}">`;
    const inp = box.querySelector('input'); inp.value = typed; if (focused) inp.focus();
  }
  function addTags(box, text) {
    const k = box.dataset.tags, add = text.split(/[,\s]+/).map((x) => x.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    const before = s[k].length;
    for (const t of add) if (!s[k].includes(t)) s[k] = [...s[k], t];
    box.querySelector('input').value = '';
    if (s[k].length !== before || add.length) { drawTags(box); update({ fill: false }); }
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
    box.addEventListener('paste', (e) => { const t = (e.clipboardData || window.clipboardData).getData('text'); if (/[,\s]/.test(t)) { e.preventDefault(); addTags(box, t); } });
  }

  // ---- form ⇄ settings -------------------------------------------------------------------------------------------------
  function fill() {
    for (const [k, f] of Object.entries(SCHEMA)) {
      const els = $$(`[name="${k}"]`, form); if (!els.length) continue;
      for (const el of els) {
        if (el.type === 'radio') el.checked = el.value === String(s[k]);
        else if (el.type === 'checkbox') el.checked = !!s[k];
        else if (f.type === 'list') el.value = s[k].join(', ');
        else if (k === 'kickid') el.value = manualKickId && s.kickid ? s.kickid : '';
        else el.value = s[k];
      }
    }
    for (const box of $$('[data-tags]')) drawTags(box);
    $('#auto').checked = s.next > 0 && s.restart > 0;
    $('#theme-name').textContent = THEME_NAMES[s.theme];
    for (const r of $$('input[name=lockmsg]')) r.disabled = !s.locks;
    $('input[name=ctop]').disabled = !s.lb;
    $('#lbshow').hidden = !s.lb;
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
    if (['cstart', 'cnext', 'cskip', 'creset', 'ctop', 'cclear'].includes(k) && !s[k].length) s[k] = [...f.def];
  }
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.closest('[data-tags]')) return;
    if (el.id === 'auto') { if (el.checked) { s.next = SCHEMA.next.def; s.restart = SCHEMA.restart.def; } else { s.next = 0; s.restart = 0; } }
    else if (el.name === 'accentpick') s.accent = el.value;
    else if (el.id === 'accent-custom') { s.accent = el.value.replace('#', ''); const c = el.closest('.custom'); c.classList.add('on'); c.style.background = el.value; for (const r of $$('input[name=accentpick]')) r.checked = false; update({ fill: false }); return; }
    else if (el.type === 'text' || el.tagName === 'INPUT' && !['radio', 'checkbox'].includes(el.type)) {
      read(el);
      if (el.name === 'kick' || el.name === 'kickid') check('kick');
      if (el.name === 'twitch') check('twitch');
      update({ fill: false }); return;
    }
    else read(el);
    if (el.name === 'theme') s.accent = '';
    update();
  });
  // tidy what was typed once they leave the box (channel links → names)
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'twitch') { s.twitch = W.platforms.twitch.channel(el.value); el.value = s.twitch; }
    if (el.name === 'kick') { s.kick = W.platforms.kick.channel(el.value); el.value = s.kick; }
    if (el.id === 'accent-custom') drawAccents();
    update({ fill: false });
  });

  // ---- channel checks: say under each box whether the channel exists ---------------------------------------------------------
  // Twitch: its public web API (the same one twitch.tv uses; no key). Kick: its channel API, which also gives the chatroom
  // id the overlay needs. Only the set-up page asks; the overlay never does (for Twitch) or only if the link has no id (Kick).
  async function twitchUser(login) {
    try {
      const r = await fetch('https://gql.twitch.tv/gql', { method: 'POST', headers: { 'Client-Id': W.platforms.twitch.GQL_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query{user(login:${JSON.stringify(login)}){login displayName}}` }) });
      if (!r.ok) return undefined;
      const j = await r.json();
      return j && j.data ? j.data.user : undefined;                        // null: no such channel; undefined: couldn't ask
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
  // the chatroom ID box only appears when Kick couldn't confirm the channel (or one was typed in before)
  function kickIdField() { $('#kickid-field').hidden = !(manualKickId || (s.kick && found.kick === false)); }

  // ---- copy only once a channel is in -----------------------------------------------------------------------------------------
  const hasChannel = () => !!(W.platforms.twitch.channel(s.twitch) || W.platforms.kick.channel(s.kick));
  function readyToCopy() {
    const ok = hasChannel();
    $('#copy').disabled = !ok;
    $('#links').hidden = !ok;                         // Show link · Open in new tab: only once there's a link
    for (const a of [$('#show'), $('#open')]) { a.setAttribute('aria-disabled', String(!ok)); a.tabIndex = ok ? 0 : -1; }
    $('#need').hidden = ok;
    if (!ok) $('#link').hidden = true;
  }

  // ---- the link, the badge, the preview ------------------------------------------------------------------------------------
  const pv = $('#pv'), pvScreen = $('#pv-screen');
  let screen = 'play', lastPv = '', pvTimer = null, loaded = false;
  const query = () => W.settings.encode(SCHEMA, s);
  const link = () => `${location.origin}/chatagram/play${query() ? '?' + query() : ''}`;
  function fitFrame(frame, box) {
    const [w, h] = C.settings.SIZES[frame === pv ? s.layout : 'full'];
    frame.width = w; frame.height = h;
    const k = Math.min((box.clientWidth - 16) / w, (box.clientHeight - 16) / h);
    frame.style.transform = `translate(-50%,-50%) scale(${k})`;
    fitPoster(frame);
  }
  // a preview fades in over its picture once the game inside has drawn
  // …and the picture underneath fades out then, so the two never show together (they'd look like two games stacked)
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
  // the picture sits exactly where the live board will (same size and centre), so the hand-over doesn't jump
  function fitPoster(frame) {
    const poster = frame.parentElement.querySelector('.poster'); if (!poster) return;
    const box = frame.parentElement, [w, h] = [frame.width, frame.height], k = Math.min((box.clientWidth - 16) / w, (box.clientHeight - 16) / h);
    // centred exactly as the live game is (left/top 50% and a -50% shift), so the swap can't move anything
    Object.assign(poster.style, { inset: 'auto', left: '50%', top: '50%', width: w * k + 'px', height: h * k + 'px', transform: 'translate(-50%, -50%)' });
  }
  function preview() {
    const shown = { ...s, theme: SCHEMA.theme.def, accent: '' };             // theme and accent go by message (no reload)
    const src = `play.html?${W.settings.encode(SCHEMA, shown)}&${screen === 'play' ? 'demo=1' : 'still=1&screen=' + screen}`;
    setPoster();
    if (!loaded) return;                                                      // starts after the page has loaded
    if (src !== lastPv) {
      lastPv = src; pv.src = src; showWhenReady(pv);
      pv.onload = () => themePreview();
    } else themePreview();
  }
  // the picture for the chosen theme and layout, placed exactly where the live board will be: set at once (not when the
  // preview loads), so the first frame already shows the right board in the right place
  function setPoster() {
    const poster = $('#pv-poster'), want = `assets/themes/${s.theme}${s.layout === 'full' ? '-full' : ''}.webp`;
    if (poster.getAttribute('src') !== want) poster.setAttribute('src', want);
    fitFrame(pv, pvScreen);
  }
  const themePreview = () => { try { pv.contentWindow.postMessage({ type: 'widget-theme', theme: s.theme, accent: s.accent }, '*'); } catch {} };
  function update({ fill: refill = true } = {}) {
    if (refill) fill();
    const l = link();
    $('#link').textContent = l; $('#open').href = l;
    $('#size').textContent = C.settings.SIZES[s.layout].join(' × ');
    const keys = ADVANCED.filter((k) => !((k === 'next' || k === 'restart') && s.next === 0 && s.restart === 0));
    const n = W.settings.changed(SCHEMA, s, keys) + (manualKickId && s.kickid ? 1 : 0);
    $('#chg').hidden = !n; $('#chg').textContent = `${n} changed`;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    readyToCopy();
    setPoster();
    themePreview();
    clearTimeout(pvTimer); pvTimer = setTimeout(preview, 350);
  }
  for (const b of $$('.tabs button')) b.addEventListener('click', () => { screen = b.dataset.screen; for (const x of $$('.tabs button')) x.setAttribute('aria-pressed', String(x === b)); preview(); });
  // "Show leaderboard": the preview shows it as !cg top would (on the Playing tab, where the pretend chat plays)
  $('#lbshow').addEventListener('click', () => {
    const ask = () => { try { pv.contentWindow.postMessage({ type: 'chatagram-leaderboard' }, '*'); } catch {} };
    if (screen === 'play' && pv.classList.contains('ready')) return ask();
    if (screen !== 'play') $('.tabs button[data-screen=play]').click();
    const wait = setInterval(() => { if (pv.classList.contains('ready')) { clearInterval(wait); ask(); } }, 100);
    setTimeout(() => clearInterval(wait), 8000);
  });
  addEventListener('resize', () => { fitFrame(pv, pvScreen); fitHero(); });

  // ---- copy -----------------------------------------------------------------------------------------------------------------------
  async function copy(btn) {
    if (!hasChannel()) return;
    const l = link();
    try { await navigator.clipboard.writeText(l); btn.textContent = 'Copied!'; }
    catch { $('#link').hidden = false; $('#show').setAttribute('aria-expanded', 'true'); getSelection().selectAllChildren($('#link')); btn.textContent = 'Press Ctrl+C to copy'; }
    setTimeout(() => { btn.textContent = 'Copy OBS link'; }, 1800);
  }
  $('#copy').addEventListener('click', (e) => copy(e.currentTarget));
  $('#open').addEventListener('click', (e) => { if (!hasChannel()) e.preventDefault(); });
  $('#show').addEventListener('click', (e) => { if (!hasChannel()) return; const l = $('#link'); l.hidden = !l.hidden; e.currentTarget.setAttribute('aria-expanded', String(!l.hidden)); e.currentTarget.textContent = l.hidden ? 'Show link' : 'Hide link'; });
  if (fromLink && W.settings.changed(SCHEMA, s, ADVANCED)) $('#adv').open = true;   // coming back with advanced settings: show them

  // ---- theme gallery (pictures, made by artwork/chatagram/render.mjs) and the hero ----------------------------------------------
  // The hero shows a picture straight away; the live game (its script and word lists) starts after the page has loaded and
  // fades in over it once it has drawn, so nothing competes with the first paint (docs/website.md).
  $('#tgrid').innerHTML = C.settings.THEMES.map((t) => `<li><button type="button" class="thm" data-theme-pick="${t}" aria-label="Use the ${THEME_NAMES[t]} theme"><div class="screen"><img class="poster" src="assets/themes/${t}.webp" alt="" width="560" height="230" loading="lazy"></div><h3>${THEME_NAMES[t]}</h3></button></li>`).join('');
  for (const b of $$('[data-theme-pick]')) b.addEventListener('click', () => { s.theme = b.dataset.themePick; s.accent = ''; update(); $('#setup').scrollIntoView(); });
  const hero = $('#hero-frame');
  const fitHero = () => fitFrame(hero, $('#hero-screen'));
  fitHero();
  // the hero game's pretend chat as speech bubbles off its left edge: the last three; a find in yellow, as tiles, with its points
  const chat = $('#chat');
  addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'chatagram-chat' || e.source !== hero.contentWindow) return;
    const m = document.createElement('div'); m.className = 'b' + (d.found ? ' hit' : '');
    const color = /^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : 'var(--ink)', pf = d.platform === 'kick' ? 'kick' : 'twitch';
    m.innerHTML = `<span class="pf ${pf}"><svg><use href="#i-${pf}"/></svg></span><b style="color:${color}">${esc(d.name)}</b>`
      + (d.found ? `<span class="tiles">${[...String(d.found).toUpperCase()].map((c) => `<i>${esc(c)}</i>`).join('')}</span><span class="pts">+${+d.pts || 0}</span>` : `<span>${esc(d.text)}</span>`);
    // Chatagram's own motion: the bubble pops out of its tail corner and its letters flip in like the board's tiles; the
    // ones above glide up (measured before and after, then animated back, so nothing jumps); the oldest floats off
    const calm = !m.animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stay = [...chat.querySelectorAll('.b:not(.out)')], was = stay.map((b) => b.getBoundingClientRect().top);
    chat.appendChild(m);
    for (const old of stay.slice(0, Math.max(0, stay.length - 2))) {
      old.classList.add('out');
      if (calm) old.remove();
      else old.animate([{ opacity: 1 }, { opacity: 0, translate: '-6px -14px' }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished.then(() => old.remove(), () => old.remove());
    }
    if (calm) return;
    stay.forEach((b, i) => {
      const dy = was[i] - b.getBoundingClientRect().top;
      if (dy && !b.classList.contains('out')) b.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(.3,1.25,.55,1)' });
    });
    // the pop waits until the glide has cleared its spot, so the new bubble never lands on the one moving up
    const wait = stay.length ? 170 : 0;
    // it swings into its tilt and settles like a card set down: past it, back, a little past, then still (each step eased)
    m.animate([{ opacity: 0, scale: .4, rotate: '9deg' }, { opacity: 1, scale: 1.05, rotate: '-5deg', offset: .38 }, { scale: .99, rotate: '.5deg', offset: .6 },
      { scale: 1.01, rotate: '-2.8deg', offset: .8 }, { opacity: 1, scale: 1, rotate: '-2deg' }], { duration: 680, delay: wait, easing: 'ease-in-out', composite: 'replace', fill: 'backwards' });
    [...m.querySelectorAll('.tiles i, .pts')].forEach((t, i) => t.animate([{ transform: 'rotateX(90deg) scale(.6)' }, { transform: 'rotateX(-12deg) scale(1.1)', offset: .7 }, { transform: 'none' }],
      { duration: 300, delay: wait + 90 + i * 45, easing: 'ease-out', fill: 'backwards' }));
  });
  const afterLoad = () => setTimeout(() => {
    loaded = true;
    hero.src = 'play.html?demo=1'; showWhenReady(hero);
    preview();
  }, 300);
  if (document.readyState === 'complete') afterLoad(); else addEventListener('load', afterLoad);

  // ---- the menu shows where you are -------------------------------------------------------------------------------------------------
  const links = $$('.menu a');
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) for (const a of links) a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); }, { rootMargin: '-45% 0px -50% 0px' });
  for (const id of ['how', 'themes', 'setup', 'faq']) io.observe(document.getElementById(id));

  fill(); update();
  if (s.twitch) check('twitch');
  if (s.kick) check('kick');
  window.chatagramSetup = { get settings() { return s; }, link, query, found };
})();
