// The Trongates control panel: one component for the OBS dock (control.html) and the OBS index page.
//
//   TGLPanel.mount(element, { mode: 'dock' | 'index', onChange(settings, env) {}, onForm(form) {} })
//
// Dock: talks to OBS (obsws.js), veadotube and SMTC Bridge; finds the Trongates overlays in your scenes by their
// URL, rewrites their options, keeps a shared chat source, adds widget sources, tidies the layout. Nothing in
// OBS changes before Review & apply (except the Sources tab's add buttons, and the shared chat's crop following
// the music). Index: the same settings, driving the previews and the copied addresses. Settings are saved in the
// browser (the dock: per scene collection) and move between the two with a settings link (#s=…).
// Needs theme.js (TGL), model.js (TGLModel), dock-colour.js (TGLDockColour) and its parts (panel-obs.js,
// panel-layout.js, panel-tabs.js) first, obsws.js for the dock, and panel.css. See obs/README.md.
(() => {
  const M = TGLModel;
  const FORM_KEYS = ['cyan', 'yellow', 'red', 'princess', 'blobfish'];
  const SHORT = { cyan: 'Tron', yellow: 'Tron gold', red: 'Tron red', princess: 'Princess', blobfish: 'Blobfish' };
  const TAG = 'tgl_managed', SHARED_NAME = 'Trongates · Shared chat';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


  /**
   * @param {HTMLElement} el where the panel draws itself
   * @param {{ mode?: 'dock' | 'index', onChange?: (settings: any, env: any) => void, onForm?: (form: string) => void }} [opts]
   */
  function mount(el, { mode = 'dock', onChange = () => {}, onForm = () => {} } = {}) {
    const dock = mode === 'dock';
    const params = new URLSearchParams(location.search);
    // The OBS WebSocket connection (port, password): its own save, shared by every scene collection (the dock needs
    // it before OBS can say which collection is open). obs= / obspw= in the address are read once, like settings links.
    const readConn = () => { try { return JSON.parse(localStorage.getItem('tgl-panel-obs') || 'null'); } catch { return null; } };
    const conn = { port: '', pw: '', ...(readConn() || {}) };
    const saveConn = () => { try { localStorage.setItem('tgl-panel-obs', JSON.stringify(conn)); } catch {} };
    if (params.get('obs') || params.get('obspw')) {
      const mark = `obs:${params.get('obs') || ''}:${params.get('obspw') || ''}`;
      let seen = []; try { seen = JSON.parse(localStorage.getItem('tgl-panel-imported') || '[]'); } catch {}
      if (!seen.includes(mark)) {
        if (params.get('obs')) conn.port = params.get('obs');
        if (params.get('obspw') !== null) conn.pw = params.get('obspw');
        saveConn();
        try { localStorage.setItem('tgl-panel-imported', JSON.stringify([...seen, mark].slice(-20))); } catch {}
      }
    }
    // what the scenes get (obs= / obspw=): the dock always (it's what its buttons need); the index only if filled in
    const obsCfg = () => (dock ? { port: conn.port || '4455', pw: conn.pw } : conn.port ? { port: conn.port, pw: conn.pw } : null);
    el.classList.add('tgl-panel');

    // ---------------------------------------------------------------- settings: load, save, import once
    let storeKey = 'tgl-panel';
    const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    // the index's older saves (links, key, music app, shared chat): carried over once
    function legacy() {
      const g = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
      if (!g('tgl-botrix-chat') && !g('tgl-botrix-goal') && !g('tgl-obs-key') && !g('tgl-obs-app') && !g('tgl-obs-shared')) return null;
      const s = M.defaults();
      s.links.chat = g('tgl-botrix-chat'); s.links.goal = g('tgl-botrix-goal'); s.key = g('tgl-obs-key'); s.music.app = g('tgl-obs-app'); s.shared = g('tgl-obs-shared') === '1';
      for (const k of ['tgl-botrix-chat', 'tgl-botrix-goal', 'tgl-obs-key', 'tgl-obs-app', 'tgl-obs-shared']) try { localStorage.removeItem(k); } catch {}
      return s;
    }
    // a settings link in this page's address: #s=… (older index links: #w=…, #key=… / ?key=…), imported once
    function fromAddress() {
      const h = new URLSearchParams(location.hash.slice(1));
      try {
        if (h.get('s')) return { s: M.unpack(h.get('s')), mark: h.get('s') };
        if (h.get('w')) {
          const o = JSON.parse(M.b64.dec(h.get('w'))), s = M.defaults();
          if (M.isLink(o.chat)) s.links.chat = o.chat; if (M.isLink(o.goal)) s.links.goal = o.goal;
          if (o.key) s.key = o.key; if (o.app) s.music.app = o.app; if (o.shared) s.shared = true;
          return { s, mark: h.get('w'), partial: true };
        }
      } catch { return { bad: true }; }
      const key = h.get('key') || params.get('key');
      if (key) return { key, mark: 'key:' + key };
      return null;
    }
    let s = M.normalise(read(storeKey) || legacy() || M.defaults());
    let importNote = '';
    // a settings link in the address, if it's new (returns true when something was imported)
    function importAddress() {
      const addr = fromAddress(), imported = read('tgl-panel-imported') || [];
      if (addr && addr.bad) { importNote = 'The settings link in the address is incomplete (cut off when copied?), so nothing was imported.'; return false; }
      if (!addr || imported.includes(addr.mark)) return false;
      const keepDock = s.dock;
      if (addr.key) s.key = addr.key;
      else if (addr.partial) s = M.normalise({ ...s, key: addr.s.key || s.key, links: { ...s.links, ...Object.fromEntries(Object.entries(addr.s.links).filter(([, v]) => v)) }, music: { ...s.music, app: addr.s.music.app || s.music.app }, shared: addr.s.shared || s.shared });
      else s = M.normalise(addr.s);
      s.dock = keepDock;
      write('tgl-panel-imported', [...imported, addr.mark].slice(-20));
      importNote = 'Settings imported from the address. Changes you make now are kept; the address is only read once.';
      if (dock) write('tgl-panel-pending', s);   // applied to the scene collection when OBS tells us which one
      return true;
    }
    importAddress();
    // the dock's own settings (per scene collection): scene choices, pickers, lock, the measured avatar
    // tx: the transitions (on, default, each scene's pick by name, the overlay's scenes by uuid)
    const newTx = () => ({ on: false, default: '', scenes: {}, overlay: {} });
    const newDock = () => ({ map: {}, ignore: [], pick: { capture: {}, veado: {} }, lock: false, avatar: { chatting: 880, game: 580 }, tx: newTx() });
    const fixDock = (d) => { d = d || newDock(); d.tx = { ...newTx(), ...(d.tx || {}) }; d.avatar = { chatting: 880, game: 580, ...(d.avatar || {}) }; if (d.avatar.chatting === 820) d.avatar.chatting = 880; if ([454, 534].includes(d.avatar.game)) d.avatar.game = 580; return d; };   // 820, 454 and 534: earlier defaults
    s.dock = fixDock(s.dock);
    const save = () => { write(storeKey, s); onChange(s, env.links); refresh(); };
    const set = (path, value) => { const ks = path.split('.'); let o = s; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = value; save(); };

    // ---------------------------------------------------------------- live state
    let tab = read('tgl-panel-tab') || 'live';
    const env = { state: 'off', links: {}, text: '' };                 // Netlify: what the key unlocks
    const obs = { state: dock ? 'connecting' : 'off', client: null, collection: '', scan: null, busy: false, error: '' };
    const music = { state: 'off', track: null, visible: null, raw: '' };
    let reviewing = null;                                             // { title, acts }

    // ---------------------------------------------------------------- Netlify key
    const api = () => (/^https?:$/.test(location.protocol) ? '' : 'https://www.trongateslegacy.com') + '/api/obs-widgets';
    async function checkKey() {
      env.links = {}; env.state = 'off'; env.text = '';
      if (s.key) {
        try {
          const r = await fetch(api(), { headers: { 'X-OBS-Key': s.key }, cache: 'no-store' });
          if (r.status === 401) { env.state = 'bad'; env.text = 'wrong key'; }
          else if (r.status === 404) { env.state = 'warn'; env.text = 'not set up in Netlify'; }
          else if (!r.ok) throw 0;
          else { env.links = await r.json(); env.state = Object.keys(env.links).length ? 'ok' : 'warn'; env.text = ['chat', 'goal'].map((k) => k + (env.links[k] ? ' ✓' : ' ✗')).join(' '); }
        } catch { env.state = 'bad'; env.text = "can't reach the site"; }
      }
      onChange(s, env.links); refresh();
    }

    // ---------------------------------------------------------------- colour and veadotube (dock-colour.js)
    const veado = TGLDockColour.create({ TGL, dock, settings: () => s, addr: () => s.veado.addr || params.get('veado') || M.VEADO_DEFAULT,
      obs: () => obs.client, onForm, refresh: () => refresh() });
    const formFor = veado.formFor, choose = veado.choose, connectVeado = veado.connect, reconnectVeado = veado.reconnect;

    // ---------------------------------------------------------------- now playing (the dock reads SMTC Bridge too,
    // to show the song and to crop the shared chat exactly when the scenes make room for the panel)
    let lastPlaying = 0;
    async function pollMusic() {
      const host = s.music.host || M.BRIDGE_DEFAULT, app = (s.music.app || '').toLowerCase();
      try {
        const d = await (await fetch(`http://${host}/now-playing`, { cache: 'no-store' })).json();
        const list = d.sessions || [];
        const x = (app ? list.find((y) => (y.source_app_id || '').toLowerCase().includes(app)) : list.find((y) => y.source_app_id === d.current_session_id))
          || list.find((y) => y.playback_info?.PlaybackStatus === 4);
        const m = x?.media_properties, tl = x?.timeline_properties || {}, playing = x?.playback_info?.PlaybackStatus === 4;
        if (playing) lastPlaying = Date.now();
        music.state = 'ok';
        music.track = m && m.Title ? { title: m.Title, artist: m.Artist, art: m.Thumbnail, app: x.source_app_id, playing } : null;
        music.raw = x ? `P${tl.Position} S${tl.StartTime} E${tl.EndTime} M${tl.MaxSeekTime} U${tl.LastUpdatedTime}` : 'no session';
        // no timeline from Windows: see whether Cider's own API answers (for the troubleshooting line; the scenes do the same)
        if (x && !tl.EndTime && !tl.MaxSeekTime && Date.now() > (music.ciderNext || 0)) {
          music.ciderNext = Date.now() + 5000;
          try {
            const r = await fetch('http://localhost:10767/api/v1/playback/now-playing', { headers: s.music.ciderToken ? { apptoken: s.music.ciderToken } : {}, cache: 'no-store' });
            music.cider = r.ok ? 'ok' : r.status === 401 || r.status === 403 ? (s.music.ciderToken ? 'wrong token' : 'needs a token') : 'error ' + r.status;
            if (r.ok) { const j = await r.json(); music.cider += j.info ? ` (${Math.round(j.info.currentPlaybackTime || 0)}s of ${Math.round((j.info.durationInMillis || 0) / 1000)}s)` : ''; }
          } catch { music.cider = 'not reachable (Cider closed, API off, or it won\'t let web pages read it)'; }
        } else if (x && (tl.EndTime || tl.MaxSeekTime)) music.cider = '';
        setVisible(!!music.track && (playing || s.music.always || Date.now() - lastPlaying <= 4000));
      } catch { music.state = 'bad'; music.track = null; music.raw = ''; setVisible(false); }
      if (tab === 'live' || tab === 'widgets') refresh();
      setTimeout(pollMusic, 1000);
    }
    let cropTimer;
    function setVisible(v) {
      if (music.visible === v) return;
      music.visible = v;
      clearTimeout(cropTimer);
      // the scenes: chat moves first, then now playing fades in; on stop, now playing fades, then the chat moves
      cropTimer = setTimeout(() => placeSharedLive().catch(() => {}), v ? 0 : 650);
    }


    // ---------------------------------------------------------------- the other parts, sharing this panel as P:
    // panel-obs.js (OBS: scan, Review & apply, Sources), panel-layout.js (Tidy, Measure avatar), panel-tabs.js (drawing)
    const P = { M, TGL, dock, params, el, conn, obs, env, music, veado, esc, SHORT, FORM_KEYS, TAG, SHARED_NAME,
      read, write, obsCfg, newDock, fixDock, save, set, checkKey, refresh };
    const vars = { s: [() => s, (v) => { s = v; }], tab: [() => tab, (v) => { tab = v; }], storeKey: [() => storeKey, (v) => { storeKey = v; }],
      reviewing: [() => reviewing, (v) => { reviewing = v; }], importNote: [() => importNote, (v) => { importNote = v; }] };
    for (const [k, [get, put]] of Object.entries(vars)) Object.defineProperty(P, k, { get, set: put });
    for (const part of ['obs', 'layout', 'tabs']) Object.assign(P, window.TGLPanelParts[part](P));
    const { connectObs, call, reconnectObs, rescan, managedRows, plan, placeSharedLive, review, runReview, currentScene, addWidget, tagInput,
      checks, measure, measureAvatar, head, foot, reviewHtml, bodies } = P;

    let raf = 0;
    function refresh() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
    function render() {
      const a = /** @type {HTMLInputElement} */ (document.activeElement);
      if (a && el.contains(a) && ['text', 'password', 'number'].includes(a.type)) return;   // don't redraw under someone typing
      const bdScroll = el.querySelector('.bd')?.scrollTop || 0;
      // <details> sections stay open across redraws (the Widgets tab redraws every second for the song)
      const open = new Set([...el.querySelectorAll('details[open] summary')].map((x) => x.textContent));
      const body = bodies[tab]();
      el.innerHTML = head() + `<div class="bd">${body}</div>` + foot() + (reviewing ? reviewHtml() : '');
      el.querySelectorAll('details').forEach((x) => { if (open.has(x.querySelector('summary')?.textContent)) x.open = true; });
      el.querySelector('.bd').scrollTop = bdScroll;
    }

    // ---------------------------------------------------------------- events (delegated)
    const copy = async (text, btn) => {
      try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      if (btn) { const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1400); }
    };
    const link = (page) => new URL(page, location.href).href.split('#')[0] + '#s=' + M.pack({ ...s, dock: undefined });
    el.addEventListener('click', async (e) => {
      const b = /** @type {HTMLElement} */ (e.target).closest('button'); if (!b || !el.contains(b)) return;
      const d = b.dataset;
      if (d.tab) { tab = d.tab; write('tgl-panel-tab', tab); refresh(); return; }
      if (d.form) { choose(d.form, d.state); return; }
      if (d.part) { const [k, p] = d.part.split(':'), off = s.scenes[k].off; s.scenes[k].off = off.includes(p) ? off.filter((x) => x !== p) : [...off, p]; save(); return; }
      if (d.flag) { const [k, f] = d.flag.split(':'); s.scenes[k][f] = !s.scenes[k][f]; save(); return; }
      if (d.refresh) { call('PressInputPropertiesButton', { inputUuid: d.refresh, propertyName: 'refreshnocache' }).catch(() => {}); return; }
      if (d.add) {
        const sel = /** @type {HTMLSelectElement} */ (el.querySelector('[data-target]')); const scene = sel ? sel.value : await currentScene();
        b.disabled = true; try { await addWidget(d.add, scene, d.copy === '1'); } catch (err) { alert(err.message); } return;
      }
      if (d.tag) { await tagInput(obs.scan.inputs.get(d.tag), d.tagv); if (d.tagv === 'shared-chat') { s.shared = true; save(); } return; }
      if (d.txOverlay) { const c = P.transitionScenes().find((x) => x.uuid === d.txOverlay); if (c) { s.dock.tx.overlay[c.uuid] = !P.overlayIn(c); save(); } return; }
      if (d.ignore) { s.dock.ignore = [...(s.dock.ignore || []), d.ignore]; save(); return; }
      switch (d.act) {
        case 'review': review('Review & apply', plan()); break;
        case 'cancel': reviewing = null; refresh(); break;
        case 'apply': runReview(); break;
        case 'rescan': rescan(); break;
        case 'refresh-all': {
          const ids = new Set([...managedRows().map((r) => r.input.uuid), ...(obs.scan?.widgets || []).filter((w) => w.input.tag).map((w) => w.input.uuid)]);
          for (const id of ids) call('PressInputPropertiesButton', { inputUuid: id, propertyName: 'refreshnocache' }).catch(() => {});
          break;
        }
        case 'shared-now': if (!s.shared) { s.shared = true; save(); } review('Shared chat', plan().filter((a) => /Shared chat|shared|overlay/i.test(a.label))); break;
        case 'shared-remove': s.shared = false; save(); review('Remove the shared chat', plan()); break;
        case 'tidy': review('Tidy layout', checks().filter((c) => c.fix).map((c) => c.fix)); break;
        case 'measure':
          if (!confirm('Measure the avatar now? veadotube will step through all your states for a few seconds (viewers would see it if you\'re live). Stay quiet while it runs.')) break;
          measureAvatar().then(() => refresh()).catch((err) => { measure.note = err.message; refresh(); });
          break;
        case 'copy-link': copy(link(dock ? 'control' : ''), b); break;
        case 'copy-hold': copy(new URL('assets/trongates-hold.webm', location.href).href, b); break;
        case 'copy-rescue': {
          const q = `obs=${encodeURIComponent(conn.port || '4455')}${conn.pw ? '&obspw=' + encodeURIComponent(conn.pw) : ''}`;
          copy(new URL('rescue?' + q, location.href).href, b); break;
        }
        case 'copy-dock': {
          const q = `obs=${encodeURIComponent(conn.port || '4455')}${conn.pw ? '&obspw=' + encodeURIComponent(conn.pw) : ''}`;
          copy(new URL('control?' + q, location.href).href + '#s=' + M.pack({ ...s, dock: undefined }), b); break;
        }
        case 'import': {
          const text = prompt('Paste a settings link (or just the part after #s=):'); if (!text) break;
          try {
            const code = (/[#&]s=([^&#\s]+)/.exec(text) || [, text.trim()])[1];
            const got = M.unpack(code);
            if (!confirm('Replace these settings with the imported ones? (In OBS, nothing changes until Review & apply.)')) break;
            s = M.normalise({ ...got, dock: s.dock }); s.dock = s.dock || got.dock; importNote = 'Settings imported.'; save(); checkKey();
          } catch { alert("That doesn't look like a complete settings link."); }
          break;
        }
        case 'rebuild': if (obs.scan && confirm('Rebuild these settings from what your OBS overlays say now?')) { const dockPart = s.dock; s = M.normalise(M.fromUrls(obs.scan.rows.map((r) => r.input.url))); s.dock = dockPart; save(); checkKey(); } break;
        case 'clear':
          if (!confirm('Clear the settings saved in this browser (key, links, music app, scene choices)?')) break;
          for (const k of Object.keys(localStorage)) if (k.startsWith('tgl-')) localStorage.removeItem(k);
          s = M.normalise(M.defaults()); s.dock = newDock();
          history.replaceState(null, '', location.pathname + location.search.replace(/([?&])key=[^&]*&?/, '$1').replace(/[?&]$/, ''));
          importNote = ''; save(); checkKey(); break;
      }
    });
    el.addEventListener('change', (e) => {
      const t = /** @type {HTMLInputElement} */ (e.target), d = t.dataset;
      if (d.set) {
        let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value || 0 : t.value.trim();
        if (d.set === 'linksMode') { s.linksMode = v; save(); return; }
        set(d.set, v);
        if (d.set === 'key') checkKey();
        if (d.set === 'veado.addr' && dock) reconnectVeado();
        return;
      }
      if (d.conn) {
        conn[d.conn] = t.value.trim(); saveConn();
        if (dock) reconnectObs();
        save(); return;
      }
      if (d.map !== undefined) { if (t.value) s.veado.map[d.map] = t.value; else delete s.veado.map[d.map]; save(); return; }
      if (d.row) { s.dock.map[d.row] = t.value; save(); return; }
      if (d.txScene !== undefined) { if (t.value) s.dock.tx.scenes[d.txScene] = t.value; else delete s.dock.tx.scenes[d.txScene]; save(); return; }
      if (d.pick) { const [what, uuid] = d.pick.split(':'); s.dock.pick[what][uuid] = t.value; save(); return; }
      if (d.target !== undefined) { obs.target = t.value; }
    });
    el.addEventListener('focusout', () => setTimeout(() => { if (!el.contains(document.activeElement)) refresh(); }, 0));

    // ---------------------------------------------------------------- start
    TGL.onChange(() => refresh());
    TGL.onStatus(() => refresh());                   // e.g. the circuit breaker tripping (theme.js)
    // a settings link pasted into a tab that's already open (only the part after # changes, so no reload)
    addEventListener('hashchange', () => { if (importAddress()) { if (dock) { try { localStorage.removeItem('tgl-panel-pending'); } catch {} } save(); checkKey(); } });
    if (dock) {
      connectObs(); connectVeado(); pollMusic();
      currentScene && setTimeout(async () => { try { obs.target = await currentScene(); refresh(); } catch {} }, 1500);
    }
    checkKey();
    render();
    return { get settings() { return s; }, get env() { return env.links; }, get obs() { return obsCfg(); }, refresh };
  }

  window.TGLPanel = { mount };
})();
