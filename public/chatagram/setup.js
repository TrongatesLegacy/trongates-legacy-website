// The Chatagram page's set-up: the form ⇄ the settings ⇄ the OBS link, the live preview, the Kick channel check, the
// theme gallery and the hero's demo. docs/widgets.md, "The Chatagram page". Settings come from the page's own link
// (open /chatagram/?kick=name… to edit an existing overlay link's settings) or what this browser used last.
(() => {
  const W = window.Widgets, C = window.Chatagram, SCHEMA = C.settings.SCHEMA;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const form = $('#form');
  const KEY = 'chatagram:setup';
  const THEME_NAMES = { chatagram: 'Chatagram', neutral: 'Neutral', light: 'Light', neon: 'Neon', candy: 'Candy', royal: 'Royal', deep: 'Deep', cozy: 'Cozy' };
  const THEME_BG = { chatagram: '#16122b', neutral: '#1b1e26', light: '#f4f5f8', neon: '#03060d', candy: '#6b2fd6', royal: '#0a0510', deep: '#020b11', cozy: '#f3e6cf' };
  const ACCENTS = [['ffc93c', 'Sun'], ['ff5a5f', 'Coral'], ['2ee6a8', 'Mint'], ['22e5ff', 'Cyan'], ['4f8cff', 'Blue'], ['b48cff', 'Lilac'], ['ff63b8', 'Pink']];
  const ADVANCED = ['shuffle', 'minlen', 'goal', 'tricky', 'longbonus', 'bonus', 'locks', 'lockmsg', 'next', 'restart', 'cstart', 'cnext', 'cskip', 'creset', 'perm', 'bubbles', 'ignore', 'block', 'top', 'remember', 'credit'];

  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const fromLink = location.search.length > 1;
  let s = W.settings.decode(SCHEMA, fromLink ? location.search : saved ? W.settings.encode(SCHEMA, saved) : '');
  let manualKickId = !!(fromLink && s.kickid);

  // ---- swatches ------------------------------------------------------------------------------------------------------
  $('#theme-pick').innerHTML = W.theme.THEMES.map((t) => `<label title="${THEME_NAMES[t]}"><input type="radio" name="theme" value="${t}" aria-label="${THEME_NAMES[t]}"><span style="background:linear-gradient(90deg, ${THEME_BG[t]} 58%, #${W.theme.ACCENTS[t]} 0)${t === 'light' || t === 'cozy' ? ';box-shadow:inset 0 0 0 1px #0003' : ''}"></span></label>`).join('');
  function drawAccents() {
    const def = W.theme.ACCENTS[s.theme];
    const list = [[def, 'Theme default'], ...ACCENTS.filter(([c]) => c !== def)].slice(0, 7);
    const custom = s.accent && !list.some(([c]) => c === s.accent) ? s.accent : '';
    $('#accents').innerHTML = list.map(([c, n], i) => `<label title="${n}"><input type="radio" name="accentpick" value="${i ? c : ''}" aria-label="${n}"><span style="background:#${c}"></span></label>`).join('') +
      `<label class="custom"><input type="color" id="accent-custom" value="#${custom || def}" aria-label="Custom accent colour">${custom ? '#' + custom : 'custom'}</label>`;
    const pick = s.accent && list.slice(1).some(([c]) => c === s.accent) ? s.accent : custom ? null : '';
    for (const r of $$('input[name=accentpick]')) r.checked = pick !== null && r.value === pick;
    $('#accent-note').textContent = `Theme default: ${ACCENTS.find(([c]) => c === def)?.[1] || '#' + def}`;
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
    $('#auto').checked = s.next > 0 && s.restart > 0;
    $('#theme-name').textContent = THEME_NAMES[s.theme];
    for (const r of $$('input[name=lockmsg]')) r.disabled = !s.locks;
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
    if (k === 'cstart' || k === 'cnext' || k === 'cskip' || k === 'creset') if (!s[k].length) s[k] = [...f.def];
  }
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'auto') { if (el.checked) { s.next = SCHEMA.next.def; s.restart = SCHEMA.restart.def; } else { s.next = 0; s.restart = 0; } }
    else if (el.name === 'accentpick') s.accent = el.value;
    else if (el.id === 'accent-custom') s.accent = el.value.replace('#', '');
    else if (el.type === 'text' || el.tagName === 'INPUT' && !['radio', 'checkbox'].includes(el.type)) { read(el); if (el.name === 'kick') checkKick(); update({ fill: false }); return; }
    else read(el);
    if (el.name === 'theme') s.accent = '';
    update();
  });
  // tidy what was typed once they leave the box (channel links → names)
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'twitch') { s.twitch = W.platforms.twitch.channel(el.value); el.value = s.twitch; }
    if (el.name === 'kick') { s.kick = W.platforms.kick.channel(el.value); el.value = s.kick; }
    update({ fill: false });
  });

  // ---- Kick channel check ------------------------------------------------------------------------------------------------
  let kickTimer = null, kickAsk = 0;
  function checkKick() {
    clearTimeout(kickTimer);
    const slug = W.platforms.kick.channel(s.kick), st = $('#kick-st');
    if (!manualKickId) s.kickid = 0;
    if (!slug) { st.textContent = ''; st.className = 'st'; return; }
    st.textContent = 'checking…'; st.className = 'st wait';
    kickTimer = setTimeout(async () => {
      const ask = ++kickAsk, id = await W.platforms.kick.chatroom(slug);
      if (ask !== kickAsk) return;
      if (id) { st.textContent = '● found'; st.className = 'st ok'; if (!manualKickId) { s.kickid = id; update({ fill: false }); } }
      else { st.textContent = '● not confirmed'; st.className = 'st bad'; st.title = 'Kick didn’t confirm this channel. Check the spelling; the overlay will try again itself.'; }
    }, 600);
  }

  // ---- the link, the badge, the preview ------------------------------------------------------------------------------------
  const pv = $('#pv'), pvScreen = $('#pv-screen');
  let screen = 'play', lastPv = '', pvTimer = null;
  const query = () => W.settings.encode(SCHEMA, s);
  const link = () => `${location.origin}/chatagram/play${query() ? '?' + query() : ''}`;
  function fitFrame(frame, box) {
    const [w, h] = C.settings.SIZES[s.layout];
    frame.width = w; frame.height = h;
    const k = Math.min((box.clientWidth - 16) / w, (box.clientHeight - 16) / h);
    frame.style.transform = `translate(-50%,-50%) scale(${k})`;
  }
  function preview() {
    const shown = { ...s, theme: SCHEMA.theme.def, accent: '' };             // theme and accent go by message (no reload)
    const src = `play.html?${W.settings.encode(SCHEMA, shown)}&${screen === 'play' ? 'demo=1' : 'still=1&screen=' + screen}`;
    fitFrame(pv, pvScreen);
    if (src !== lastPv) {
      lastPv = src; pv.src = src;
      pv.onload = () => themePreview();
    } else themePreview();
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
    themePreview();
    clearTimeout(pvTimer); pvTimer = setTimeout(preview, 350);
  }
  for (const b of $$('.tabs button')) b.addEventListener('click', () => { screen = b.dataset.screen; for (const x of $$('.tabs button')) x.setAttribute('aria-pressed', String(x === b)); preview(); });
  addEventListener('resize', () => { fitFrame(pv, pvScreen); fitHero(); });

  // ---- copy -----------------------------------------------------------------------------------------------------------------------
  async function copy(btn) {
    const l = link();
    try { await navigator.clipboard.writeText(l); btn.textContent = 'Copied!'; }
    catch { $('#link').hidden = false; $('#show').setAttribute('aria-expanded', 'true'); getSelection().selectAllChildren($('#link')); btn.textContent = 'Press Ctrl+C to copy'; }
    setTimeout(() => { btn.textContent = 'Copy OBS link'; }, 1800);
  }
  $('#copy').addEventListener('click', (e) => copy(e.currentTarget));
  $('#copy2').addEventListener('click', (e) => copy(e.currentTarget));
  $('#show').addEventListener('click', (e) => { const l = $('#link'); l.hidden = !l.hidden; e.currentTarget.setAttribute('aria-expanded', String(!l.hidden)); e.currentTarget.textContent = l.hidden ? 'Show link' : 'Hide link'; });
  if (fromLink && W.settings.changed(SCHEMA, s, ADVANCED)) $('#adv').open = true;   // coming back with advanced settings: show them

  // ---- theme gallery (loads as it scrolls into view) and the hero's demo (after the page has loaded) -----------------------------
  $('#tgrid').innerHTML = W.theme.THEMES.map((t) => `<li><div class="screen"><iframe loading="lazy" tabindex="-1" title="${THEME_NAMES[t]} theme" width="560" height="230" src="play.html?theme=${t}&layout=compact&still=1"></iframe></div><h3>${THEME_NAMES[t]}</h3></li>`).join('');
  const fitGallery = () => $$('#tgrid .screen').forEach((box) => { const f = box.firstElementChild, k = Math.min((box.clientWidth - 12) / 560, (box.clientHeight - 12) / 230); f.style.transform = `translate(-50%,-50%) scale(${k})`; });
  const hero = $('#hero-frame');
  const fitHero = () => { const box = $('#hero-screen'), k = Math.min((box.clientWidth - 20) / 900, (box.clientHeight - 20) / 470); hero.style.transform = `translate(-50%,-50%) scale(${k})`; fitGallery(); };
  fitHero();
  const startHero = () => setTimeout(() => { hero.src = 'play.html?demo=1'; }, 1200);
  if (document.readyState === 'complete') startHero(); else addEventListener('load', startHero);

  // ---- the menu shows where you are -------------------------------------------------------------------------------------------------
  const links = $$('.menu a');
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) for (const a of links) a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); }, { rootMargin: '-45% 0px -50% 0px' });
  for (const id of ['how', 'themes', 'setup', 'faq']) io.observe(document.getElementById(id));

  fill(); update();
  if (s.kick) checkKick();
  window.chatagramSetup = { get settings() { return s; }, link, query };
})();
