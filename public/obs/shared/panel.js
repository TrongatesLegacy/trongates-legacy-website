// The Trongates control panel: one component for the OBS dock (control.html) and the OBS index page.
//
//   TGLPanel.mount(element, { mode: 'dock' | 'index', onChange(settings, env) {}, onForm(form) {} })
//
// Dock: talks to OBS (obsws.js), veadotube and SMTC Bridge; finds the Trongates overlays in your scenes by their
// URL, rewrites their options, keeps a shared chat source, adds widget sources, tidies the layout. Nothing in
// OBS changes before Review & apply (except the Sources tab's add buttons, and the shared chat's crop following
// the music). Index: the same settings, driving the previews and the copied addresses. Settings are saved in the
// browser (the dock: per scene collection) and move between the two with a settings link (#s=…).
// Needs theme.js (TGL) and model.js (TGLModel) first, and obsws.js for the dock. See obs/README.md.
(() => {
  const M = TGLModel;
  const FORM_KEYS = ['cyan', 'yellow', 'red', 'princess', 'blobfish'];
  const SHORT = { cyan: 'Tron', yellow: 'Tron gold', red: 'Tron red', princess: 'Princess', blobfish: 'Blobfish' };
  const TAG = 'tgl_managed', SHARED_NAME = 'Trongates · Shared chat';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CSS = `
.tgl-panel { --line: #13263b; --muted: #8ba3bd; --ok: #53fc18; --warn: #ffd23f; --bad: #ff8a96; position: relative; display: flex; flex-direction: column; min-height: 0;
  color: #e8f4ff; font: 600 13px/1.35 "Chakra Petch", system-ui, sans-serif; }
.tgl-panel * { box-sizing: border-box; }
.tgl-panel .hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 0 8px; }
.tgl-panel .hd b { font: 900 13px/1 Orbitron, sans-serif; letter-spacing: .12em; color: var(--accent); text-transform: uppercase; }
.tgl-panel .pills { display: flex; gap: 5px; }
.tgl-panel .pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border: 1px solid var(--line); border-radius: 99px; font-size: 11px; color: var(--muted); }
.tgl-panel .dot { width: 7px; height: 7px; border-radius: 50%; background: #4a5b70; flex: none; }
.tgl-panel .dot.ok { background: var(--ok); box-shadow: 0 0 6px var(--ok); } .tgl-panel .dot.warn { background: var(--warn); } .tgl-panel .dot.bad { background: #ff4155; }
.tgl-panel .tabs { display: flex; border-bottom: 1px solid var(--line); }
.tgl-panel .tabs button { flex: 1 1 auto; padding: 8px 2px 7px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); font: 700 9.5px/1 Orbitron, sans-serif; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; cursor: pointer; }
.tgl-panel .tabs button[aria-selected="true"] { color: var(--accent); border-color: var(--accent); }
.tgl-panel .tabs i { font-style: normal; display: inline-block; min-width: 14px; padding: 1px 3px; margin-left: 3px; border-radius: 7px; background: var(--warn); color: #000; font: 700 9px/1.2 system-ui; }
.tgl-panel .bd { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 9px; padding: 10px 0; overflow-y: auto; min-height: 0; flex: 1; }
.tgl-panel h3 { margin: 4px 0 0; font: 700 10px/1 Orbitron, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
.tgl-panel .forms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.tgl-panel .forms button { padding: 9px 4px; border: 2px solid var(--c); border-radius: 7px; background: color-mix(in srgb, var(--c) 12%, #070d18); color: #e8f4ff; font: 700 10.5px/1.15 Orbitron, sans-serif; letter-spacing: .04em; cursor: pointer; }
.tgl-panel .forms button[aria-pressed="true"] { background: var(--c); color: #03060d; box-shadow: 0 0 12px var(--c); }
.tgl-panel .row { display: flex; align-items: center; gap: 8px; min-width: 0; } .tgl-panel .row > .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .tgl-panel .grow { flex: 1; min-width: 0; }
.tgl-panel .muted, .tgl-panel .hint { color: var(--muted); font-weight: 400; font-size: 12px; }
.tgl-panel .ok { color: var(--ok); } .tgl-panel .warn { color: var(--warn); } .tgl-panel .bad { color: var(--bad); }
.tgl-panel .card, .tgl-panel .scene { grid-template-columns: minmax(0, 1fr); }
.tgl-panel .card { border: 1px solid var(--line); background: rgba(7,13,24,.9); padding: 8px 9px; border-radius: 6px; display: grid; gap: 6px; }
.tgl-panel input[type=text], .tgl-panel input[type=password], .tgl-panel input[type=number], .tgl-panel select {
  min-width: 0; padding: 6px 8px; border: 1px solid var(--line); background: #0b1424; color: #cfe3f5; border-radius: 4px; font: 12px ui-monospace, monospace; }
.tgl-panel select { font: 600 12px "Chakra Petch", sans-serif; }
.tgl-panel input:focus, .tgl-panel select:focus { outline: 1px solid var(--accent); }
.tgl-panel .field { display: grid; gap: 4px; color: var(--muted); font-size: 12px; }
.tgl-panel .tog { appearance: none; width: 30px; height: 16px; border-radius: 9px; background: #1b2b3d; position: relative; flex: none; cursor: pointer; margin: 0; }
.tgl-panel .tog::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #6b7d92; transition: left .15s; }
.tgl-panel .tog:checked { background: color-mix(in srgb, var(--accent) 60%, #000); } .tgl-panel .tog:checked::after { left: 16px; background: #fff; }
.tgl-panel .btn { padding: 7px 10px; border: 1px solid var(--accent); color: var(--accent); background: transparent; font: 700 10.5px/1 Orbitron, sans-serif; letter-spacing: .08em; border-radius: 4px; cursor: pointer; text-align: center; }
.tgl-panel .btn.solid { background: var(--accent); color: #03060d; } .tgl-panel .btn.red { border-color: var(--bad); color: var(--bad); }
.tgl-panel .btn:disabled { opacity: .4; cursor: default; } .tgl-panel .btn.small { padding: 5px 7px; font-size: 9.5px; }
.tgl-panel .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.tgl-panel .chip { padding: 3px 7px; border-radius: 4px; font: 600 11px "Chakra Petch", sans-serif; border: 1px solid var(--accent); color: var(--accent); background: none; cursor: pointer; }
.tgl-panel .chip[aria-pressed="false"] { border-color: var(--line); color: #56687d; text-decoration: line-through; } .tgl-panel .chip.shared { border-style: dashed; }
.tgl-panel .scene { border: 1px solid var(--line); border-radius: 6px; padding: 7px 8px; display: grid; gap: 6px; background: rgba(7,13,24,.9); }
.tgl-panel .scene .t { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } .tgl-panel .scene .t b { font-size: 12.5px; }
.tgl-panel .states { display: grid; gap: 4px; }
.tgl-panel .states .st { display: flex; align-items: center; gap: 6px; padding: 3px 3px 3px 7px; border-radius: 5px; background: #0b1424; border-left: 3px solid var(--c); }
.tgl-panel .states .st.on { outline: 1px solid var(--accent); } .tgl-panel .states .st span { flex: 1; font-size: 12px; } .tgl-panel .states select { padding: 3px 5px; font-size: 11px; }
.tgl-panel .np { display: flex; gap: 8px; align-items: center; } .tgl-panel .np img, .tgl-panel .np .art { width: 36px; height: 36px; object-fit: cover; border-radius: 3px; background: #13263b; flex: none; }
.tgl-panel .np b { display: block; font-size: 12.5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } .tgl-panel .np small { color: var(--muted); font-weight: 400; }
.tgl-panel table { width: 100%; border-collapse: collapse; font-size: 11.5px; } .tgl-panel td, .tgl-panel th { padding: 4px 3px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.tgl-panel th { font: 700 9px/1 Orbitron, sans-serif; letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }
.tgl-panel .ft { border-top: 1px solid var(--line); padding: 8px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tgl-panel .ft span { font-size: 12px; }
.tgl-panel .review { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; gap: 8px; padding: 4px 0; background: #03060d; }
.tgl-panel .review ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.tgl-panel .review li { display: flex; gap: 7px; padding: 5px 0; border-bottom: 1px dashed var(--line); font-size: 12px; }
.tgl-panel .review li b { flex: none; width: 62px; font: 700 9.5px/1.7 Orbitron, sans-serif; letter-spacing: .05em; }
.tgl-panel .review li.done { opacity: .5; } .tgl-panel .review li.err { color: var(--bad); }
.tgl-panel .k-create, .tgl-panel .k-add { color: var(--ok); } .tgl-panel .k-update, .tgl-panel .k-place, .tgl-panel .k-lock { color: var(--accent); } .tgl-panel .k-remove { color: var(--bad); } .tgl-panel .k-skip { color: var(--muted); }
.tgl-panel details summary { cursor: pointer; color: var(--muted); font-size: 12px; }
.tgl-panel code { font: 11.5px ui-monospace, monospace; color: #cfe3f5; overflow-wrap: anywhere; }`;

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
    if (!document.getElementById('tgl-panel-css')) { const st = document.createElement('style'); st.id = 'tgl-panel-css'; st.textContent = CSS; document.head.appendChild(st); }
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
    const newDock = () => ({ map: {}, ignore: [], pick: { capture: {}, veado: {} }, lock: false, avatar: { chatting: 820, game: 454 } });
    const fixDock = (d) => { d = d || newDock(); d.avatar = { chatting: 820, game: 454, ...(d.avatar || {}) }; return d; };
    s.dock = fixDock(s.dock);
    const save = () => { write(storeKey, s); onChange(s, env.links); refresh(); };
    const set = (path, value) => { const ks = path.split('.'); let o = s; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = value; save(); };

    // ---------------------------------------------------------------- live state
    let tab = read('tgl-panel-tab') || 'live';
    const env = { state: 'off', links: {}, text: '' };                 // Netlify: what the key unlocks
    const obs = { state: dock ? 'connecting' : 'off', client: null, collection: '', scan: null, busy: false, error: '' };
    const veado = { state: 'off', ws: null, states: [], current: null, pending: null, pendingTimer: 0 };
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

    // ---------------------------------------------------------------- colour and veadotube
    const formFor = (name) => { const m = s.veado.map[String(name || '').toLowerCase()]; return TGL.FORMS[m] ? m : TGL.formForState(name); };
    const broadcast = (form) => {
      TGL.set(form); onForm(form); refresh();
      if (obs.client && obs.client.ready) obs.client.call('BroadcastCustomEvent', { eventData: { tgl: 'form', form } }).catch(() => {});
    };
    const stateFor = (form, name) => {
      if (name) return veado.states.find((x) => x.name.toLowerCase() === name) || null;
      const fits = veado.states.filter((x) => formFor(x.name) === form), want = form === 'cyan' ? (s.veado.tron || 'cyan') : form;
      return fits.find((x) => x.name.toLowerCase() === want) || fits[0] || null;
    };
    function choose(form, stateName) {
      const st = dock && s.veado.switch && veado.ws && veado.ws.readyState === 1 && stateFor(form, stateName);
      if (!st) return broadcast(form);
      veado.pending = form; clearTimeout(veado.pendingTimer);
      veado.pendingTimer = setTimeout(() => { if (veado.pending) { veado.pending = null; broadcast(form); } }, 3000);
      veado.ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload: { event: 'set', state: st.id } }));
    }
    function connectVeado() {
      const addr = s.veado.addr || params.get('veado') || M.VEADO_DEFAULT;
      let ws;
      try { ws = veado.ws = new WebSocket(`ws://${addr}?n=${encodeURIComponent('Trongates dock')}`); } catch { veado.state = 'bad'; refresh(); return; }
      const send = (payload) => ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload }));
      ws.onopen = () => { veado.state = 'ok'; send({ event: 'listen', token: 'tgl-dock' }); send({ event: 'list' }); send({ event: 'peek' }); refresh(); };
      ws.onmessage = (e) => {
        const t = String(e.data), i = t.indexOf(':');
        if (t.slice(0, i).trim() !== 'nodes') return;
        let m; try { m = JSON.parse(t.slice(i + 1)); } catch { return; }
        if (m.type !== 'stateEvents' || !m.payload) return;
        if (Array.isArray(m.payload.states)) veado.states = m.payload.states.map((x) => ({ id: x.id || x.name, name: x.name || x.id }));
        if (m.payload.state) {
          veado.current = (veado.states.find((x) => x.id === m.payload.state) || { name: m.payload.state }).name;
          const f = formFor(veado.current);
          if (veado.pending && f === veado.pending) { veado.pending = null; clearTimeout(veado.pendingTimer); broadcast(f); }
          else { TGL.set(f); onForm(f); }
        }
        refresh();
      };
      ws.onclose = () => { veado.state = 'bad'; refresh(); setTimeout(() => { if (veado.ws === ws) connectVeado(); }, 5000); };
    }
    const reconnectVeado = () => { const old = veado.ws; veado.ws = null; if (old) try { old.close(); } catch {} connectVeado(); };

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

    // ---------------------------------------------------------------- OBS: connect and scan
    function connectObs() {
      obs.client = TGLObs.connect({ port: +conn.port || 4455, password: conn.pw,
        onStatus: ({ state }) => { obs.state = state; if (state === 'connected') rescan(); refresh(); },
        onEvent: (type) => {
          if (/^(SceneItemCreated|SceneItemRemoved|SceneCreated|SceneRemoved|SceneNameChanged|InputCreated|InputRemoved|InputNameChanged|CurrentSceneCollectionChanged|SceneItemListReindexed|InputSettingsChanged)$/.test(type)) {
            clearTimeout(obs.rescanTimer); obs.rescanTimer = setTimeout(rescan, 800);
          }
        } });
    }
    const call = (t, d) => obs.client.call(t, d);
    const reconnectObs = () => { if (obs.client) obs.client.close(); obs.client = null; obs.scan = null; obs.state = 'connecting'; connectObs(); refresh(); };
    async function rescan() {
      if (!obs.client || !obs.client.ready || obs.busy) return;
      try {
        const { currentSceneCollectionName: col } = await call('GetSceneCollectionList');
        if (col !== obs.collection) switchCollection(col);
        const { scenes: list } = await call('GetSceneList');
        const scenes = [...list].sort((a, b) => b.sceneIndex - a.sceneIndex).map((x) => ({ uuid: x.sceneUuid, name: x.sceneName }));
        const containers = [], inputs = new Map(), sceneOf = new Map(scenes.map((x) => [x.name, x]));
        // every scene, and every group inside one, with its items (bottom → top)
        for (const sc of scenes) {
          const { sceneItems } = await call('GetSceneItemList', { sceneUuid: sc.uuid });
          containers.push({ uuid: sc.uuid, name: sc.name, scene: sc.name, group: false, items: sceneItems });
          for (const it of sceneItems) if (it.isGroup) {
            const { sceneItems: gi } = await call('GetGroupSceneItemList', { sceneName: it.sourceName });
            containers.push({ uuid: it.sourceUuid, name: it.sourceName, scene: sc.name, group: true, items: gi });
          }
        }
        for (const c of containers) for (const it of c.items) if (it.inputKind === 'browser_source' && !inputs.has(it.sourceUuid)) {
          const { inputSettings } = await call('GetInputSettings', { inputUuid: it.sourceUuid });
          inputs.set(it.sourceUuid, { uuid: it.sourceUuid, name: it.sourceName, settings: inputSettings, url: inputSettings.url || '', tag: inputSettings[TAG] || '' });
        }
        // which top-level scenes show a nested scene (for "shown in …")
        const shownIn = (name) => scenes.filter((sc) => containers.some((c) => c.scene === sc.name && !c.group && c.items.some((i) => i.sourceName === name && i.sourceType === 'OBS_SOURCE_TYPE_SCENE'))).map((x) => x.name);
        const rows = [], widgets = new Map();
        for (const c of containers) for (const it of c.items) {
          const inp = inputs.get(it.sourceUuid); if (!inp) continue;
          const r = M.recognise(inp.url);
          if (r && M.TYPES[r.kind] && !inp.tag) {
            rows.push({ id: `${c.uuid}:${it.sceneItemId}`, container: c, item: it, input: inp, kind: r.kind, layout: r.layout,
              sceneName: c.group ? c.scene : c.name, via: c.group ? `group ${c.name}` : '', shown: c.group ? [] : shownIn(c.name) });
          } else if (inp.tag || (r && !M.TYPES[r.kind])) {
            const w = widgets.get(inp.uuid) || { input: inp, kind: inp.tag === 'shared-chat' ? 'shared' : inp.tag ? inp.tag.replace('widget:', '') : r.kind, places: [] };
            w.places.push({ container: c, item: it });
            widgets.set(inp.uuid, w);
          }
        }
        obs.scan = { scenes, containers, inputs, rows, widgets: [...widgets.values()], at: Date.now() };
        // a collection with no saved settings: start from what its overlays already say (or an imported link)
        if (!read(storeKey)) {
          const pending = read('tgl-panel-pending');
          s = M.normalise(pending || M.fromUrls(rows.map((r) => r.input.url)));
          s.dock = newDock();
          try { localStorage.removeItem('tgl-panel-pending'); } catch {}
          write(storeKey, s); checkKey();
        }
        obs.error = '';
        placeSharedLive().catch(() => {});        // the crop for whatever's playing now (the first poll may beat the scan)
      } catch (e) { obs.error = e.message; }
      refresh();
    }
    function switchCollection(col) {
      obs.collection = col; storeKey = 'tgl-panel:' + col;
      const saved = read(storeKey), pending = read('tgl-panel-pending');
      if (saved && pending) {                     // a new settings link in the dock's address: it wins, once
        s = M.normalise(pending); s.dock = fixDock(saved.dock);
        try { localStorage.removeItem('tgl-panel-pending'); } catch {}
        write(storeKey, s); checkKey();
      } else if (saved) { s = M.normalise(saved); s.dock = fixDock(saved.dock); checkKey(); }
    }

    // ---------------------------------------------------------------- what Apply would change
    const managedRows = () => (obs.scan ? obs.scan.rows.filter((r) => (s.dock.map[r.container.uuid + ':' + r.item.sceneItemId] || 'manage') === 'manage') : []);
    const layoutOf = (r) => (r.kind === 'game' ? s.scenes.game.layout : 'full');
    const partOn = (r, p) => M.partsOf(r.kind, layoutOf(r)).includes(p) && !s.scenes[r.kind].off.includes(p);
    const optsFor = (kind, layout) => M.options(kind, s, { layout, env: env.links, obs: obsCfg() });
    const baseDir = () => { const r = managedRows()[0]; return r ? r.input.url.split('?')[0].replace(/[^/]*$/, '') : new URL('./', location.href).href; };
    const widgetUrl = (kind) => M.withOptions(baseDir() + M.WIDGETS[kind].file + (/\.html$/.test(managedRows()[0]?.input.url.split('?')[0] || '') ? '.html' : ''), optsFor(kind));
    const shared = () => obs.scan && obs.scan.widgets.find((w) => w.kind === 'shared');
    // scenes with a chat frame (plain scenes before groups, so the shared chat is created in a scene)
    const chatRows = () => managedRows().filter((r) => partOn(r, 'chat') && (r.kind !== 'game' || layoutOf(r) === 'window')).sort((a, b) => a.container.group - b.container.group);
    // where the shared chat goes in a row's scene: the frame's inner box, the top cropped (or scaled, on Game (window))
    function sharedTransform(r) {
      const b = M.chatBox(r.kind, s, music.visible !== false);
      if (b.w === M.SHARED_W) return { positionX: b.x, positionY: b.y, scaleX: 1, scaleY: 1, cropTop: M.SHARED_H - b.h, cropBottom: 0, cropLeft: 0, cropRight: 0, boundsType: 'OBS_BOUNDS_NONE', alignment: 5, rotation: 0 };
      const visH = Math.round(b.h * M.SHARED_W / b.w);
      return { positionX: b.x, positionY: b.y, cropTop: M.SHARED_H - visH, cropBottom: 0, cropLeft: 0, cropRight: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: b.w, boundsHeight: b.h, boundsAlignment: 5, alignment: 5, rotation: 0 };
    }
    const sameTransform = (t, want) => Object.entries(want).every(([k, v]) => (typeof v === 'number' ? Math.abs((t[k] ?? 0) - v) < (/^scale/.test(k) ? 0.005 : 0.6) : t[k] === v));
    const changes = (from, to) => {
      const q = (u) => new URLSearchParams((u.split('?')[1] || '').split('#')[0]);
      const a = q(from), b = q(to), out = [];
      const show = (k, v) => (['key', 'obspw'].includes(k) ? k : ['chat', 'goal'].includes(k) && v !== '0' ? k + ' link' : `${k}=${v}`);
      for (const [k, v] of b) if (a.get(k) !== v) out.push(show(k, v));
      for (const [k] of a) if (!b.has(k)) out.push('no ' + k);
      return out.join(', ');
    };
    // the shared chat's own browser settings
    const sharedSettings = (link) => ({ url: link, width: M.SHARED_W, height: M.SHARED_H, fps_custom: true, fps: 30, shutdown: false, [TAG]: 'shared-chat' });
    async function aboveOverlay(r, itemId) {
      const req = r.container.group ? 'GetGroupSceneItemList' : 'GetSceneItemList';
      const { sceneItems } = await call(req, r.container.group ? { sceneName: r.container.name } : { sceneUuid: r.container.uuid });
      const ov = sceneItems.find((i) => i.sceneItemId === r.item.sceneItemId), me = sceneItems.find((i) => i.sceneItemId === itemId);
      if (ov && me) await call('SetSceneItemIndex', { sceneName: r.container.name, sceneItemId: itemId, sceneItemIndex: ov.sceneItemIndex + (me.sceneItemIndex > ov.sceneItemIndex ? 1 : 0) });
    }
    function plan() {
      const acts = [];
      if (!obs.scan) return acts;
      // 1. the overlays' options
      const seen = new Set();
      for (const r of managedRows()) {
        if (seen.has(r.input.uuid)) continue; seen.add(r.input.uuid);
        const want = M.withOptions(r.input.url, optsFor(r.kind, layoutOf(r)));
        if (!M.sameUrl(want, r.input.url)) acts.push({ k: 'update', label: `${r.sceneName} overlay (${r.input.name}): ${changes(r.input.url, want)}`, reload: r.input.name,
          run: () => call('SetInputSettings', { inputUuid: r.input.uuid, inputSettings: { url: want } }) });
      }
      // 2. the shared chat
      const link = M.linkFor(s, 'chat', env.links), sh = shared();
      if (s.shared && link) {
        const rows = chatRows();
        if (!sh && rows.length) {
          let made = null;                          // the new source, for the adds that follow in the same Apply
          acts.push({ k: 'create', label: `Browser source "${SHARED_NAME}" (your Botrix chat link, ${M.SHARED_W} × ${M.SHARED_H}, 30 fps) in ${rows[0].sceneName}, just above the overlay, in the chat frame`,
            run: async () => {
              const { sceneItemId, inputUuid } = await call('CreateInput', { sceneName: rows[0].container.name, inputName: SHARED_NAME, inputKind: 'browser_source', inputSettings: sharedSettings(link) });
              made = inputUuid;
              await aboveOverlay(rows[0], sceneItemId);
              await call('SetSceneItemTransform', { sceneName: rows[0].container.name, sceneItemId, sceneItemTransform: sharedTransform(rows[0]) });
              if (s.dock.lock) await call('SetSceneItemLocked', { sceneName: rows[0].container.name, sceneItemId, sceneItemLocked: true });
            } });
          for (const r of rows.slice(1)) acts.push({ k: 'add', label: `${SHARED_NAME} to ${r.sceneName}${r.via ? ' (' + r.via + ')' : ''}: just above the overlay, in the chat frame`,
            run: async () => {
              if (!made) throw new Error('the shared chat was not created');
              const { sceneItemId } = await call('CreateSceneItem', { sceneName: r.container.name, sourceUuid: made });
              await aboveOverlay(r, sceneItemId);
              await call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId, sceneItemTransform: sharedTransform(r) });
              if (s.dock.lock) await call('SetSceneItemLocked', { sceneName: r.container.name, sceneItemId, sceneItemLocked: true });
            } });
        } else if (sh) {
          const cur = sh.input.settings;
          if (cur.url !== link || cur.width !== M.SHARED_W || cur.height !== M.SHARED_H || !cur.fps_custom) acts.push({ k: 'update', label: `${sh.input.name}: ${cur.url !== link ? 'new Botrix link' : ''}${cur.width !== M.SHARED_W || cur.height !== M.SHARED_H ? ' size ' + M.SHARED_W + ' × ' + M.SHARED_H : ''}${!cur.fps_custom ? ' custom frame rate 30' : ''}`.replace(': ', ': ').trim(), reload: sh.input.name,
            run: () => call('SetInputSettings', { inputUuid: sh.input.uuid, inputSettings: sharedSettings(link) }) });
        }
        for (const r of rows) {
          const place = sh && sh.places.find((p) => p.container.uuid === r.container.uuid);
          if (sh && !place) acts.push({ k: 'add', label: `${sh.input.name} to ${r.sceneName}${r.via ? ' (' + r.via + ')' : ''}: just above the overlay, in the chat frame`,
            run: async () => {
              const { sceneItemId } = await call('CreateSceneItem', { sceneName: r.container.name, sourceUuid: sh.input.uuid });
              await aboveOverlay(r, sceneItemId);
              await call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId, sceneItemTransform: sharedTransform(r) });
              if (s.dock.lock) await call('SetSceneItemLocked', { sceneName: r.container.name, sceneItemId, sceneItemLocked: true });
            } });
          else if (place && !sameTransform(place.item.sceneItemTransform, sharedTransform(r))) acts.push({ k: 'place', label: `${sh.input.name} in ${r.sceneName}: fit the chat frame`,
            run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: place.item.sceneItemId, sceneItemTransform: sharedTransform(r) }) });
        }
      } else if (!s.shared && sh) {
        acts.push({ k: 'remove', label: `${sh.input.name}, from every scene`, run: () => call('RemoveInput', { inputUuid: sh.input.uuid }) });
      } else if (s.shared && !link) acts.push({ k: 'skip', label: 'Shared chat is on, but there is no Botrix chat link yet (Widgets: your key, or paste the link)' });
      // 3. widget sources the dock added or adopted: keep their options current
      if (obs.scan) for (const w of obs.scan.widgets) {
        if (!['chatbox', 'goal', 'music', 'bare'].includes(w.kind) || !w.input.tag) continue;
        const want = M.withOptions(w.input.url, optsFor(w.kind));
        if (!M.sameUrl(want, w.input.url)) acts.push({ k: 'update', label: `${w.input.name}: ${changes(w.input.url, want)}`, reload: w.input.name,
          run: () => call('SetInputSettings', { inputUuid: w.input.uuid, inputSettings: { url: want } }) });
      }
      // 4. lock or unlock the dock's own items
      // (only where the dock put them: in Trongates scenes, or added from the Sources tab; not your own scenes)
      const ours = new Set(managedRows().map((r) => r.container.uuid));
      if (obs.scan) for (const w of obs.scan.widgets) if (w.input.tag) for (const p of w.places) if ((ours.has(p.container.uuid) || w.kind !== 'shared') && !!p.item.sceneItemLocked !== !!s.dock.lock)
        acts.push({ k: 'lock', label: `${s.dock.lock ? 'Lock' : 'Unlock'} ${w.input.name} in ${p.container.name}`, run: () => call('SetSceneItemLocked', { sceneName: p.container.name, sceneItemId: p.item.sceneItemId, sceneItemLocked: !!s.dock.lock }) });
      return acts;
    }
    const pendingCount = () => plan().filter((a) => a.k !== 'skip').length;
    // the shared chat follows the music straight away (it's live behaviour, not a setting)
    async function placeSharedLive() {
      const sh = shared(); if (!sh || !s.shared || !obs.client?.ready) return;
      for (const r of chatRows()) {
        if (r.kind === 'game' || !partOn(r, 'music')) continue;
        const place = sh.places.find((p) => p.container.uuid === r.container.uuid); if (!place) continue;
        const want = sharedTransform(r);
        if (!sameTransform(place.item.sceneItemTransform, want)) {
          await call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: place.item.sceneItemId, sceneItemTransform: want });
          place.item.sceneItemTransform = { ...place.item.sceneItemTransform, ...want };
        }
      }
    }

    // ---------------------------------------------------------------- layout (tidy)
    const CAPTURE = { positionX: 45, positionY: 92, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: 1408, boundsHeight: 792, boundsAlignment: 0, alignment: 5, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0, rotation: 0 };
    const VEADO_BOX = { chatting: [760, 174, 980, 880], game: [1487, 610, 406, 454] };
    const veadoTransform = (kind) => { const [x, y, w, h] = VEADO_BOX[kind]; return { positionX: x, positionY: y, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: w, boundsHeight: h, boundsAlignment: 0, alignment: 5, rotation: 0 }; };
    // Measured (Layout → Measure avatar): crop veadotube's canvas to the avatar's resting outline, scale it to the
    // chosen height and stand it on the veadotube space's bottom line, centred; above that it may overlap the chat.
    // Not measured: the whole canvas fitted into the box (small, as veadotube's canvas is mostly empty).
    function avatarFit(kind, it) {
      const av = s.dock.avatar || {}; const [bx, by, bw, bh] = VEADO_BOX[kind];
      if (!av.bounds) return veadoTransform(kind);
      const t = it.sceneItemTransform, sw = t.sourceWidth || av.canvas.w, sh = t.sourceHeight || av.canvas.h;
      const [l, top, r, b] = av.bounds, H = +av[kind] || (kind === 'game' ? 454 : 820);
      const vw = (r - l) * sw, vh = (b - top) * sh, k = H / vh;
      return { boundsType: 'OBS_BOUNDS_NONE', alignment: 5, rotation: 0, scaleX: +k.toFixed(4), scaleY: +k.toFixed(4),
        cropLeft: Math.round(l * sw), cropTop: Math.round(top * sh), cropRight: Math.round((1 - r) * sw), cropBottom: Math.round((1 - b) * sh),
        positionX: Math.round(bx + bw / 2 - (vw * k) / 2), positionY: Math.round(by + bh - H) };
    }
    const measure = { running: false, note: '' };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // the visible (non-transparent) box of a screenshot, as fractions of it: [left, top, right, bottom]
    const alphaBox = (dataUrl) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let l = c.width, t = c.height, r = -1, b = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
        ok(r < 0 ? null : [l / c.width, t / c.height, (r + 1) / c.width, (b + 1) / c.height]);
      };
      img.onerror = () => ok(null); img.src = dataUrl;
    });
    const median = (xs) => { const a = [...xs].sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
    // Step veadotube through every state, a few small screenshots each, and keep each state's resting outline
    // (the median of the frames, so talking / blinking / bounce frames don't count); the avatar's outline is all of
    // those together. Only runs when asked: nothing is sampled during a stream.
    async function measureAvatar() {
      const row = managedRows().find((r) => s.dock.pick.veado[r.container.uuid]);
      const src = row && s.dock.pick.veado[row.container.uuid], item = row && row.container.items.find((i) => i.sourceName === src);
      if (!item) throw new Error('Pick your veadotube source first (above).');
      if (!veado.ws || veado.ws.readyState !== 1 || !veado.states.length) throw new Error('veadotube isn\'t connected.');
      const sw = item.sceneItemTransform.sourceWidth, sh = item.sceneItemTransform.sourceHeight;
      if (!sw || !sh) throw new Error(`${src} has no picture (is veadotube sending to Spout?)`);
      const W = 240, H = Math.max(1, Math.round((W * sh) / sw)), back = veado.states.find((x) => x.name === veado.current);
      const setState = (st) => veado.ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload: { event: 'set', state: st.id } }));
      const per = [];
      measure.running = true;
      try {
        for (const [i, st] of veado.states.entries()) {
          measure.note = `Measuring ${st.name} (${i + 1} of ${veado.states.length})…`; refresh();
          setState(st); await sleep(1100);
          const boxes = [];
          for (let n = 0; n < 5; n++) {
            const { imageData } = await call('GetSourceScreenshot', { sourceName: src, imageFormat: 'png', imageWidth: W, imageHeight: H });
            const bx = await alphaBox(imageData); if (bx) boxes.push(bx);
            await sleep(180);
          }
          if (boxes.length) per.push({ name: st.name, box: [0, 1, 2, 3].map((k) => median(boxes.map((x) => x[k]))) });
        }
      } finally {
        if (back) setState(back);
        measure.running = false;
      }
      if (!per.length) throw new Error(`${src} looked empty in every state (is veadotube sending to Spout?)`);
      const u = [Math.min(...per.map((p) => p.box[0])), Math.min(...per.map((p) => p.box[1])), Math.max(...per.map((p) => p.box[2])), Math.max(...per.map((p) => p.box[3]))];
      s.dock.avatar = { ...s.dock.avatar, bounds: u.map((v) => +v.toFixed(4)), canvas: { w: sw, h: sh }, at: new Date().toISOString(), states: per.map((p) => p.name) };
      measure.note = `Measured ${per.length} state${per.length === 1 ? '' : 's'}: the avatar takes ${Math.round((u[2] - u[0]) * 100)}% × ${Math.round((u[3] - u[1]) * 100)}% of the ${sw} × ${sh} canvas.`;
      save();
    }
    const FULL = { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0, alignment: 5 };
    function checks() {
      const out = [];
      for (const r of managedRows()) {
        const st = r.input.settings, where = r.sceneName;
        if (!st.fps_custom || +st.fps !== 30) out.push({ where, what: `${r.input.name}: frame rate`, state: 'custom frame rate off', fix: { k: 'update', label: `${r.input.name}: custom frame rate 30, 1920 × 1080`, run: () => call('SetInputSettings', { inputUuid: r.input.uuid, inputSettings: { fps_custom: true, fps: 30, width: 1920, height: 1080 } }) } });
        else if (+st.width !== 1920 || +st.height !== 1080) out.push({ where, what: `${r.input.name}: size`, state: `${st.width} × ${st.height}`, fix: { k: 'update', label: `${r.input.name}: 1920 × 1080`, run: () => call('SetInputSettings', { inputUuid: r.input.uuid, inputSettings: { width: 1920, height: 1080 } }) } });
        const t = r.item.sceneItemTransform;
        if (t && !(t.boundsType === 'OBS_BOUNDS_NONE' ? sameTransform(t, FULL) : Math.abs(t.positionX) < 1 && Math.abs(t.positionY) < 1 && Math.abs(t.boundsWidth - 1920) < 1))
          out.push({ where, what: `${r.input.name}: position`, state: 'not filling the canvas', fix: { k: 'place', label: `${r.input.name} in ${where}: fill the canvas`, run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: r.item.sceneItemId, sceneItemTransform: { ...FULL, boundsType: 'OBS_BOUNDS_NONE' } }) } });
        // your own sources, only if picked
        const pickC = s.dock.pick.capture[r.container.uuid], pickV = s.dock.pick.veado[r.container.uuid];
        if (r.kind === 'game' && layoutOf(r) === 'window' && pickC) {
          const it = r.container.items.find((i) => i.sourceName === pickC);
          if (!it) out.push({ where, what: pickC, state: 'not found (renamed or removed?): pick again', bad: true });
          else if (!sameTransform(it.sceneItemTransform, CAPTURE)) out.push({ where, what: pickC, state: 'not in the game window', fix: { k: 'place', label: `${pickC} in ${where}: the 1408 × 792 window (X 45, Y 92)`, run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: it.sceneItemId, sceneItemTransform: CAPTURE }) } });
          else out.push({ where, what: pickC, state: 'in place', good: true });
        }
        if ((r.kind === 'chatting' || (r.kind === 'game' && layoutOf(r) === 'window')) && pickV) {
          const it = r.container.items.find((i) => i.sourceName === pickV);
          const av = s.dock.avatar || {}, t = it && it.sceneItemTransform;
          if (!it) out.push({ where, what: pickV, state: 'not found: pick again', bad: true });
          else if (av.bounds && av.canvas && (t.sourceWidth !== av.canvas.w || t.sourceHeight !== av.canvas.h))
            out.push({ where, what: pickV, state: `veadotube's window size changed (${t.sourceWidth} × ${t.sourceHeight}): measure again`, bad: true });
          else {
            const want = avatarFit(r.kind, it), size = av.bounds ? `${av[r.kind === 'game' ? 'game' : 'chatting']}px tall, feet on the bottom line` : 'the whole canvas in the box (measure the avatar for a better fit)';
            if (!sameTransform(t, want)) out.push({ where, what: pickV, state: av.bounds ? 'not at the measured size' : 'not in the veadotube space', fix: { k: 'place', label: `${pickV} in ${where}: ${size}`, run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: it.sceneItemId, sceneItemTransform: want }) } });
            else out.push({ where, what: pickV, state: 'in place', good: true });
          }
        }
      }
      const sh = shared();
      if (sh && s.shared) for (const r of chatRows()) {
        const p = sh.places.find((x) => x.container.uuid === r.container.uuid);
        out.push({ where: r.sceneName, what: sh.input.name, state: !p ? 'not added yet (Review & apply)' : sameTransform(p.item.sceneItemTransform, sharedTransform(r)) ? 'in place' : 'will be fitted on apply', good: p && sameTransform(p.item.sceneItemTransform, sharedTransform(r)) });
      }
      return out;
    }

    // ---------------------------------------------------------------- review & apply
    function review(title, acts) { reviewing = { title, acts }; refresh(); }
    async function runReview() {
      const acts = reviewing.acts.filter((a) => a.run);
      obs.busy = true; refresh();
      for (const [i, a] of acts.entries()) {
        const li = el.querySelector(`.review li[data-i="${reviewing.acts.indexOf(a)}"]`);
        try { await a.run(); li && li.classList.add('done'); }
        catch (e) { li && (li.classList.add('err'), li.append(' ✗ ' + e.message)); }
        if (i === acts.length - 1) break;
      }
      obs.busy = false; reviewing = null;
      await rescan();
    }

    // ---------------------------------------------------------------- Sources tab actions (immediate)
    async function currentScene() {
      try { const { studioModeEnabled } = await call('GetStudioModeEnabled'); if (studioModeEnabled) return (await call('GetCurrentPreviewScene')).sceneName; } catch {}
      return (await call('GetCurrentProgramScene')).sceneName;
    }
    async function addWidget(kind, sceneName, copy) {
      const w = M.WIDGETS[kind], existing = !copy && obs.scan.widgets.find((x) => x.kind === (kind === 'bare' ? 'shared' : kind) && x.input.tag);
      const container = obs.scan.containers.find((c) => c.name === sceneName && !c.group);
      const ov = managedRows().find((r) => r.container.name === sceneName);
      let itemId;
      if (kind === 'bare' && !copy) { s.shared = true; save(); return review('Shared chat', plan()); }
      if (existing) ({ sceneItemId: itemId } = await call('CreateSceneItem', { sceneName, sourceUuid: existing.input.uuid }));
      else {
        const names = new Set([...obs.scan.inputs.values()].map((i) => i.name).concat(obs.scan.scenes.map((x) => x.name)));
        let name = `Trongates · ${w.title}`, n = 2; while (names.has(name)) name = `Trongates · ${w.title} ${n++}`;
        ({ sceneItemId: itemId } = await call('CreateInput', { sceneName, inputName: name, inputKind: 'browser_source',
          inputSettings: { url: widgetUrl(kind), width: w.w, height: w.h, fps_custom: true, fps: 30, shutdown: false, [TAG]: 'widget:' + kind } }));
        await call('SetSceneItemTransform', { sceneName, sceneItemId: itemId, sceneItemTransform: { positionX: Math.round((1920 - w.w) / 2), positionY: Math.round((1080 - w.h) / 2), alignment: 5 } });
      }
      if (ov && container) await aboveOverlay(ov, itemId);
      await rescan();
    }
    async function tagInput(inp, tag) { await call('SetInputSettings', { inputUuid: inp.uuid, inputSettings: { [TAG]: tag } }); await rescan(); }

    // ---------------------------------------------------------------- rendering
    const dot = (st) => `<i class="dot ${st === 'ok' || st === 'connected' ? 'ok' : st === 'warn' || st === 'connecting' ? 'warn' : st === 'off' ? '' : 'bad'}"></i>`;
    const tog = (path, on, extra = '') => `<input type="checkbox" class="tog" data-set="${path}" ${on ? 'checked' : ''} ${extra}>`;
    const TABS = dock ? ['live', 'scenes', 'sources', 'widgets', 'layout'] : ['live', 'scenes', 'widgets'];
    function head() {
      const pc = dock ? pendingCount() : 0;
      return `<div class="hd"><b>${dock ? 'Trongates' : 'Settings'}</b>${dock ? `<div class="pills"><span class="pill">${dot(obs.state)}OBS</span><span class="pill">${dot(veado.state)}veado</span><span class="pill">${dot(music.state)}music</span></div>` : ''}</div>
        <div class="tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" data-tab="${t}" aria-selected="${t === tab}">${t}${t === 'scenes' && pc ? `<i>${pc}</i>` : ''}${t === 'layout' && dock && unmeasured().length ? '<i>!</i>' : ''}</button>`).join('')}</div>`;
    }
    function formButtons() {
      const form = TGL.form, onAnim = String(veado.current || '').toLowerCase() === 'animated';
      const showAnim = dock && s.veado.switch && veado.states.some((x) => x.name.toLowerCase() === 'animated');
      const b = (f, label, state) => `<button type="button" style="--c:${TGL.FORMS[f].accent}" data-form="${f}" ${state ? `data-state="${state}"` : ''} aria-pressed="${form === f && (!showAnim || f !== 'cyan' || (state === 'animated') === onAnim)}">${label}</button>`;
      return `<div class="forms">${b('cyan', 'Tron')}${showAnim ? b('cyan', 'Tron<br>animated', 'animated') : ''}${FORM_KEYS.slice(1).map((f) => b(f, SHORT[f])).join('')}</div>`;
    }
    // veadotube states the avatar measurement doesn't know yet (only matters once it's measured and in use)
    const unmeasured = () => {
      const av = s.dock.avatar || {};
      if (!dock || !av.bounds || !veado.states.length || !managedRows().some((r) => s.dock.pick.veado[r.container.uuid])) return [];
      return veado.states.map((x) => x.name).filter((n) => !(av.states || []).includes(n));
    };
    const measurePrompt = () => {
      const u = unmeasured();
      return u.length ? `<div class="card" style="border-color:var(--warn)"><span class="warn">${u.length === 1 ? 'A veadotube state isn\'t' : `${u.length} veadotube states aren't`} measured yet: ${esc(u.join(', '))}.</span><span class="hint">Measure the avatar again (before going live) so switching to ${u.length === 1 ? 'it' : 'them'} can't make it the wrong size.</span><button type="button" class="btn" data-act="measure" ${measure.running || veado.state !== 'ok' ? 'disabled' : ''}>${measure.running ? 'Measuring…' : 'Measure avatar'}</button></div>` : '';
    };
    function tabLive() {
      if (!dock) return `<h3>Colour</h3>${formButtons()}<p class="hint">Sets the colour the previews are shown in. In OBS, the dock's buttons switch veadotube too.</p>`;
      const t = music.track;
      return `${measurePrompt()}<h3>Avatar &amp; colour</h3>${formButtons()}
        <p class="hint">${s.veado.switch && veado.state === 'ok' ? 'Switches veadotube; every scene follows once it has switched.' : 'Recolours every scene.'}</p>
        ${veado.states.length ? `<h3>veadotube states</h3><div class="states">${veado.states.map((x) => {
          const f = formFor(x.name), pinned = s.veado.map[x.name.toLowerCase()] || '';
          return `<div class="st ${x.name === veado.current ? 'on' : ''}" style="--c:${TGL.FORMS[f].accent}"><span>${esc(x.name)}</span><select data-map="${esc(x.name.toLowerCase())}" aria-label="Colour for ${esc(x.name)}"><option value="">auto (${SHORT[TGL.formForState(x.name)]})</option>${FORM_KEYS.map((k) => `<option value="${k}" ${pinned === k ? 'selected' : ''}>${SHORT[k]}</option>`).join('')}</select></div>`;
        }).join('')}</div>` : ''}
        <h3>Now playing</h3>
        <div class="card">${t ? `<div class="np">${t.art ? `<img src="${esc(t.art)}" alt="">` : '<span class="art"></span>'}<div class="grow"><b>${esc(t.title)}</b><small>${esc(t.artist || '')} · ${esc((t.app || '').split(/[_!.]/)[0])}</small></div><small class="${t.playing ? 'ok' : 'muted'}">${t.playing ? 'playing' : 'paused'}</small></div>` : `<span class="muted">${music.state === 'ok' ? 'Nothing playing.' : 'SMTC Bridge not reachable (Windows only).'}</span>`}</div>
        <h3>Connections</h3>
        <div class="card" style="gap:4px">
          <div class="row">${dot(obs.state)}<span class="grow">OBS WebSocket</span><span class="muted">${esc(obs.state === 'connected' ? '127.0.0.1:' + (conn.port || 4455) : obs.state)}</span></div>
          <div class="row">${dot(veado.state)}<span class="grow">veadotube mini</span><span class="muted">${esc(s.veado.addr || M.VEADO_DEFAULT)}</span></div>
          <div class="row">${dot(music.state)}<span class="grow">SMTC Bridge</span><span class="muted">${esc(s.music.host || M.BRIDGE_DEFAULT)}</span></div>
          <div class="row">${dot(M.pasted(s, 'chat') ? 'ok' : env.state)}<span class="grow">Botrix links</span><span class="muted">${esc(M.pasted(s, 'chat') || M.pasted(s, 'goal') ? 'pasted' : env.text || 'no key')}</span></div>
        </div>
        ${obs.state === 'wrong password' ? '<p class="hint bad">OBS rejected the password: check it on Widgets → OBS WebSocket.</p>' : ''}`;
    }
    function chips(kind, layout) {
      const sc = s.scenes[kind], parts = M.partsOf(kind, layout || (kind === 'game' ? (dock ? s.scenes.game.layout : 'window') : 'full'));
      const out = parts.map((p) => `<button type="button" class="chip ${p === 'chat' && s.shared ? 'shared' : ''}" data-part="${kind}:${p}" aria-pressed="${!sc.off.includes(p)}">${M.PARTS[p]}${p === 'chat' && s.shared ? ' (shared)' : ''}</button>`);
      if (M.TYPES[kind].cycling) out.push(`<button type="button" class="chip" data-flag="${kind}:cycle" aria-pressed="${sc.cycle}">Cycles forms</button>`);
      if (M.TYPES[kind].follows) out.push(`<button type="button" class="chip" data-flag="${kind}:follow" aria-pressed="${sc.follow}">Follows veadotube</button>`);
      if (kind === 'game' && (layout || (dock ? s.scenes.game.layout : 'window')) === 'window') out.push(`<button type="button" class="chip" data-flag="game:rings" aria-pressed="${!!sc.rings}" title="The stage's animated rings behind veadotube">Rings</button>`);
      return `<div class="chips">${out.join('')}</div>`;
    }
    const grows = (kind) => {
      const sc = s.scenes[kind]; if (!M.TYPES[kind].column) return '';
      const g = [sc.off.includes('goal') && 'goal', sc.off.includes('music') && 'now playing'].filter(Boolean);
      return g.length ? `<p class="hint warn">${g.join(' and ')} off: the chat grows into the room.</p>` : '';
    };
    function tabScenes() {
      if (!dock) return `<p class="hint">Tap a part to turn it off in the previews and the copied addresses.</p>${Object.keys(M.TYPES).map((k) => `<div class="scene"><div class="t"><b>${M.TYPES[k].title}</b>${k === 'game' ? '<span class="muted">(chat, goal, now playing and rings: the window layout)</span>' : ''}</div>${chips(k)}${grows(k)}</div>`).join('')}`;
      if (obs.state !== 'connected') return `<p class="hint">Not connected to OBS (${esc(obs.state)}). Turn on Tools → WebSocket Server Settings, and give this dock's URL <code>?obs=4455&amp;obspw=…</code>.</p>`;
      if (!obs.scan) return '<p class="hint">Looking through your scenes…</p>';
      const rows = obs.scan.rows, ignored = obs.scan.scenes.filter((x) => !rows.some((r) => r.sceneName === x.name) && !obs.scan.containers.some((c) => c.group && c.name === x.name));
      return `<div class="row"><span class="grow hint">Found by each scene's Trongates overlay. Tap a part to turn it off; nothing changes in OBS before Review &amp; apply.</span><button type="button" class="btn small" data-act="rescan">Rescan</button></div>
        ${rows.length ? rows.map((r) => {
          const key = r.container.uuid + ':' + r.item.sceneItemId, managed = (s.dock.map[key] || 'manage') === 'manage';
          return `<div class="scene"><div class="t"><b>${esc(r.sceneName)}</b><span class="muted">→</span>
            <select data-row="${key}"><option value="manage" ${managed ? 'selected' : ''}>${M.TYPES[r.kind].title}</option><option value="none" ${managed ? '' : 'selected'}>Don't manage</option></select>
            ${r.kind === 'game' && managed ? `<select data-set="scenes.game.layout"><option value="full" ${layoutOf(r) === 'full' ? 'selected' : ''}>full screen</option><option value="window" ${layoutOf(r) === 'window' ? 'selected' : ''}>window</option></select>` : ''}
            <button type="button" class="btn small" data-refresh="${r.input.uuid}" title="Reload this overlay">↻</button></div>
            ${r.via || r.shown.length ? `<span class="hint">${esc([r.via && 'in ' + r.via, r.shown.length && 'shown in ' + r.shown.join(', ')].filter(Boolean).join(' · '))}</span>` : ''}
            ${managed ? chips(r.kind, layoutOf(r)) + grows(r.kind) : ''}</div>`;
        }).join('') : '<p class="hint warn">No Trongates overlays found. Add a browser source with a …/obs/ address (the index\'s Copy buttons), then Rescan.</p>'}
        ${ignored.length ? `<p class="hint">Not Trongates (left alone): ${esc(ignored.map((x) => x.name).join(', '))}</p>` : ''}
        <div class="row"><button type="button" class="btn small grow" data-act="refresh-all">Reload all Trongates sources</button></div>`;
    }
    function tabSources() {
      if (obs.state !== 'connected' || !obs.scan) return '<p class="hint">Connect to OBS first (Live → Connections).</p>';
      const sceneOpts = obs.scan.scenes.map((x) => `<option ${x.name === obs.target ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
      const card = (kind) => {
        const w = M.WIDGETS[kind], mine = obs.scan.widgets.filter((x) => (kind === 'bare' ? x.kind === 'shared' : x.kind === kind) && x.input.tag);
        const places = [...new Set(mine.flatMap((x) => x.places.map((p) => p.container.name)))];
        const size = kind === 'bare' ? `${M.SHARED_W} × ${M.SHARED_H}` : `${w.w} × ${w.h}`;
        const title = kind === 'bare' ? 'Shared chat' : w.title;
        return `<div class="scene"><div class="t"><b class="grow">${title}</b><span class="muted">${kind === 'bare' ? 'raw Botrix · ' : kind === 'music' ? '' : 'framed · '}${size}</span></div>
          <span class="hint">${places.length ? 'In ' + esc(places.join(', ')) : 'Not in any scene'}</span>
          <div class="row">${mine.length ? `<button type="button" class="btn grow" data-add="${kind}">Add existing</button><button type="button" class="btn" data-add="${kind}" data-copy="1" ${kind === 'bare' ? 'disabled' : ''}>New copy</button>` : `<button type="button" class="btn solid grow" data-add="${kind}">${kind === 'bare' ? 'Set up shared chat…' : 'Add to scene'}</button>`}</div></div>`;
      };
      const found = obs.scan.widgets.filter((x) => !x.input.tag && !(s.dock.ignore || []).includes(x.input.uuid) && ['botrix-chat', 'chatbox', 'goal', 'music', 'bare'].includes(x.kind));
      return `<div class="row"><span class="grow">Add to</span><select data-target>${sceneOpts}</select></div>
        ${['bare', 'chatbox', 'goal', 'music'].map(card).join('')}
        ${found.length ? `<h3>Found, not managed</h3>${found.map((x) => `<div class="scene"><div class="t"><b class="grow">${esc(x.input.name)}</b><span class="muted">${x.kind === 'botrix-chat' ? 'raw Botrix chat' : esc(M.WIDGETS[x.kind] ? M.WIDGETS[x.kind].title : x.kind)} · ${esc([...new Set(x.places.map((p) => p.container.name))].join(', '))}</span></div>
          <div class="row">${['botrix-chat', 'bare'].includes(x.kind) && !shared() ? `<button type="button" class="btn grow" data-tag="${x.input.uuid}" data-tagv="shared-chat">Use as shared chat</button>` : ''}${x.kind !== 'botrix-chat' ? `<button type="button" class="btn grow" data-tag="${x.input.uuid}" data-tagv="widget:${x.kind}">Adopt</button>` : ''}<button type="button" class="btn red" data-ignore="${x.input.uuid}">Ignore</button></div></div>`).join('')}` : ''}
        <p class="hint">Adding happens straight away, just above the scene's overlay (or at the top of a scene without one), centred. After that it's yours to move; settings changes reach it through Review &amp; apply.</p>`;
    }
    function tabWidgets() {
      const pasted = (s.linksMode || (M.isLink(s.links.chat) || M.isLink(s.links.goal) ? 'paste' : 'key')) === 'paste';
      const sh = dock && shared();
      return `<h3>OBS WebSocket</h3>
        <div class="row"><label class="field grow">Port<input type="number" min="1" max="65535" data-conn="port" value="${esc(conn.port)}" placeholder="4455"></label>
          <label class="field grow">Password<input type="password" data-conn="pw" value="${esc(conn.pw)}" autocomplete="off" placeholder="${dock ? 'none' : 'optional'}"></label></div>
        <span class="hint ${dock ? (obs.state === 'connected' ? 'ok' : obs.state === 'wrong password' ? 'bad' : '') : ''}">${dock
          ? (obs.state === 'connected' ? 'Connected.' : obs.state === 'wrong password' ? 'Wrong password.' : 'OBS → Tools → WebSocket Server Settings: enable it; the port and password are there.') + ' Kept for every scene collection.'
          : 'From OBS → Tools → WebSocket Server Settings. Goes into the dock address (and the scene addresses you copy).'}</span>
        <h3>Botrix</h3>
        <div class="row"><span class="grow">Links from</span><select data-set="linksMode"><option value="key" ${pasted ? '' : 'selected'}>Netlify key</option><option value="paste" ${pasted ? 'selected' : ''}>Pasted links</option></select></div>
        ${pasted ? `<label class="field">Chat widget link<input type="password" data-set="links.chat" value="${esc(s.links.chat)}" placeholder="https://botrix.live/widgets/chat/?bid=…" autocomplete="off"></label>
          <label class="field">Follower goal link<input type="password" data-set="links.goal" value="${esc(s.links.goal)}" placeholder="https://botrix.live/widgets/…" autocomplete="off"></label>`
        : `<label class="field">Netlify key (OBS_KEY)<input type="password" data-set="key" value="${esc(s.key)}" autocomplete="off"></label>
          <span class="hint ${env.state === 'ok' ? 'ok' : env.state === 'off' ? '' : 'bad'}">${esc(env.text || (s.key ? 'checking…' : 'Links kept in Netlify: BOTRIX_CHAT_URL, BOTRIX_GOAL_URL.'))}</span>`}
        <div class="card"><div class="row"><b class="grow">Shared chat</b>${tog('shared', s.shared)}</div>
          <span class="hint">One chat source in every scene, so they all show the same messages; the scenes stop loading their own.${sh ? ` <span class="ok">In ${sh.places.length} scene${sh.places.length === 1 ? '' : 's'}.</span>` : ''}</span>
          ${dock ? `<div class="row"><button type="button" class="btn grow" data-act="shared-now" ${obs.state === 'connected' ? '' : 'disabled'}>${sh ? 'Update now' : 'Set up now'}</button>${sh ? '<button type="button" class="btn red" data-act="shared-remove">Remove</button>' : ''}</div>` : '<span class="hint">In OBS, the dock creates and places it; by hand see obs/README.md.</span>'}</div>
        <div class="row"><span class="grow">Goal follows the scene colour</span>${tog('goalColor', s.goalColor)}</div>
        <h3>Now playing</h3>
        <label class="field">Music app (blank: whatever Windows has in focus)<input type="text" data-set="music.app" value="${esc(s.music.app)}" placeholder="e.g. cider, applemusic, spotify"></label>
        <div class="row"><span class="grow">Stay up while paused</span>${tog('music.always', s.music.always)}</div>
        <label class="field">SMTC Bridge address<input type="text" data-set="music.host" value="${esc(s.music.host)}" placeholder="${M.BRIDGE_DEFAULT}"></label>
        <label class="field">Cider API token (only if Cider asks for one)<input type="password" data-set="music.ciderToken" value="${esc(s.music.ciderToken)}" autocomplete="off" placeholder="Cider → Settings → Connectivity"></label>
        <h3>veadotube</h3>
        <label class="field">Address (veadotube → program settings → serving at)<input type="text" data-set="veado.addr" value="${esc(s.veado.addr)}" placeholder="${M.VEADO_DEFAULT}"></label>
        <div class="row"><span class="grow">Colour buttons switch the avatar</span>${tog('veado.switch', s.veado.switch)}</div>
        <div class="row"><span class="grow">Tron button uses state</span><input type="text" data-set="veado.tron" value="${esc(s.veado.tron)}" style="width:110px"></div>
        <div class="row"><span class="grow">Wait before recolouring (ms)</span><input type="number" min="0" step="50" data-set="veado.delay" value="${+s.veado.delay || 0}" style="width:80px"></div>
        ${!dock && Object.keys(s.veado.map).length ? `<span class="hint">State colours (set in the dock): ${esc(Object.entries(s.veado.map).map(([k, f]) => k + ' → ' + SHORT[f]).join(', '))}</span>` : ''}
        <h3>Animations</h3>
        <div class="row"><span class="grow">Motion</span><select data-set="motion"><option value="auto" ${s.motion === 'auto' ? 'selected' : ''}>automatic</option><option value="full" ${s.motion === 'full' ? 'selected' : ''}>always animate</option><option value="reduce" ${s.motion === 'reduce' ? 'selected' : ''}>reduced</option></select></div>
        ${!dock ? `<div class="row"><span class="grow">Sample messages and music in the previews</span>${tog('sample', s.sample)}</div>` : ''}
        ${dock ? `<details><summary>Troubleshooting</summary><p class="hint">SMTC Bridge's raw timeline for the followed player (position, start, end, seek range, last update):</p><code>${esc(music.raw || '(not reachable)')}</code>${music.cider ? `<p class="hint">Windows gives no timeline for this player. Cider's own API: <b class="${/^ok/.test(music.cider) ? 'ok' : 'bad'}">${esc(music.cider)}</b></p>` : ''}
          <p class="hint">Scene collection: ${esc(obs.collection || '?')} · settings saved per collection.</p></details>` : ''}
        <h3>Backup</h3>
        <div class="row"><button type="button" class="btn grow" data-act="copy-link">Copy settings link</button><button type="button" class="btn" data-act="import">Import</button></div>
        ${!dock ? '<div class="row"><button type="button" class="btn grow" data-act="copy-dock">Copy dock address</button><button type="button" class="btn red" data-act="clear">Clear</button></div>' : '<div class="row"><button type="button" class="btn grow" data-act="rebuild">Read settings back from OBS</button></div>'}
        ${importNote ? `<p class="hint">${esc(importNote)}</p>` : ''}
        <p class="hint">Settings links carry your key and links: keep them private.</p>`;
    }
    function tabLayout() {
      if (obs.state !== 'connected' || !obs.scan) return '<p class="hint">Connect to OBS first.</p>';
      const rows = managedRows(), pickers = [];
      for (const r of rows) {
        const others = r.container.items.filter((i) => i.sceneItemId !== r.item.sceneItemId && !(obs.scan.inputs.get(i.sourceUuid)?.tag)).map((i) => i.sourceName);
        const opt = (v) => `<option value="">Don't touch</option>${others.map((n) => `<option ${n === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}`;
        if (r.kind === 'game' && layoutOf(r) === 'window') pickers.push(`<div class="row"><span class="grow">Game capture <span class="muted">(${esc(r.sceneName)})</span></span><select data-pick="capture:${r.container.uuid}">${opt(s.dock.pick.capture[r.container.uuid])}</select></div>`);
        if (r.kind === 'chatting' || (r.kind === 'game' && layoutOf(r) === 'window')) pickers.push(`<div class="row"><span class="grow">veadotube <span class="muted">(${esc(r.sceneName)})</span></span><select data-pick="veado:${r.container.uuid}">${opt(s.dock.pick.veado[r.container.uuid])}</select></div>`);
      }
      const cs = checks(), av = s.dock.avatar || {}, pickedV = rows.some((r) => s.dock.pick.veado[r.container.uuid]);
      const kinds = [...new Set(rows.filter((r) => s.dock.pick.veado[r.container.uuid]).map((r) => (r.kind === 'game' ? 'game' : 'chatting')))];
      const avatar = pickedV ? `<h3>Avatar size (veadotube)</h3>
        ${kinds.map((k) => `<div class="row"><span class="grow">Height on ${k === 'game' ? 'Game (window)' : 'Just chatting'} (px)</span><input type="number" min="100" max="1080" step="10" data-set="dock.avatar.${k}" value="${+av[k] || (k === 'game' ? 540 : 820)}" style="width:80px"></div>`).join('')}
        <span class="hint ${measure.running ? 'warn' : ''}">${esc(measure.note || (av.bounds ? `Measured ${av.states?.length || '?'} states on ${new Date(av.at).toLocaleDateString()} (${av.canvas.w} × ${av.canvas.h} canvas).` : 'Not measured yet: Tidy fits the whole veadotube canvas into the box, which leaves the avatar small.'))}</span>
        <button type="button" class="btn" data-act="measure" ${measure.running || veado.state !== 'ok' || obs.busy ? 'disabled' : ''}>${measure.running ? 'Measuring…' : av.bounds ? 'Measure again' : 'Measure avatar'}</button>
        <p class="hint">Before going live: veadotube steps through every state for a few seconds (viewers would see it), so stay quiet while it runs. Nothing is measured during a stream; after this, switching states never moves or resizes the avatar.</p>` : '';
      return `${measurePrompt()}<h3>Your sources (placed only if picked)</h3>${pickers.join('') || '<p class="hint">Nothing to place: no Just chatting or Game (window) scene found.</p>'}${avatar}
        <h3>Checks</h3>
        ${cs.length ? `<table><tr><th>Scene</th><th>Item</th><th>State</th></tr>${cs.map((c) => `<tr><td>${esc(c.where)}</td><td>${esc(c.what)}</td><td class="${c.good ? 'ok' : c.bad ? 'bad' : 'warn'}">${esc(c.state)}</td></tr>`).join('')}</table>` : '<p class="hint ok">Everything checked is in place.</p>'}
        <div class="row"><span class="grow">Lock the dock's own items</span>${tog('dock.lock', s.dock.lock)}</div>
        <button type="button" class="btn solid" data-act="tidy" ${cs.some((c) => c.fix) ? '' : 'disabled'}>Tidy layout…</button>
        <p class="hint">Shows the plan first. It never moves your own sources unless picked above, and never reorders anything.</p>`;
    }
    function foot() {
      if (!dock) return '';
      const n = pendingCount();
      return `<div class="ft"><span class="${n ? 'warn' : 'muted'}">${n ? `${n} change${n === 1 ? '' : 's'} waiting` : obs.state === 'connected' ? 'OBS matches these settings' : 'Not connected to OBS'}</span><button type="button" class="btn ${n ? 'solid' : ''}" data-act="review" ${n && !obs.busy ? '' : 'disabled'}>Review &amp; apply</button></div>`;
    }
    function reviewHtml() {
      const r = reviewing, reloads = [...new Set(r.acts.map((a) => a.reload).filter(Boolean))];
      return `<div class="review"><div class="hd"><b>${esc(r.title)}</b><button type="button" class="btn small" data-act="cancel">✕</button></div>
        ${reloads.length ? `<p class="hint">These will reload: ${esc(reloads.join(', '))} (a scene's own Botrix chat restarts).</p>` : ''}
        <ul>${r.acts.map((a, i) => `<li data-i="${i}" class="k"><b class="k-${a.k}">${a.k.toUpperCase()}</b><span>${esc(a.label)}</span></li>`).join('')}
          <li><b class="k-skip">SKIP</b><span>Your other sources: order, positions and settings untouched.</span></li></ul>
        <div class="row"><button type="button" class="btn grow" data-act="cancel">Cancel</button><button type="button" class="btn solid grow" data-act="apply" ${obs.busy || !r.acts.some((a) => a.run) ? 'disabled' : ''}>${obs.busy ? 'Applying…' : `Apply ${r.acts.filter((a) => a.run).length} change${r.acts.filter((a) => a.run).length === 1 ? '' : 's'}`}</button></div></div>`;
    }
    let raf = 0;
    function refresh() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
    function render() {
      const a = document.activeElement;
      if (a && el.contains(a) && ['text', 'password', 'number'].includes(a.type)) return;   // don't redraw under someone typing
      const bdScroll = el.querySelector('.bd')?.scrollTop || 0;
      // <details> sections stay open across redraws (the Widgets tab redraws every second for the song)
      const open = new Set([...el.querySelectorAll('details[open] summary')].map((x) => x.textContent));
      const body = { live: tabLive, scenes: tabScenes, sources: tabSources, widgets: tabWidgets, layout: tabLayout }[tab]();
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
      const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      const d = b.dataset;
      if (d.tab) { tab = d.tab; write('tgl-panel-tab', tab); refresh(); return; }
      if (d.form) { choose(d.form, d.state); return; }
      if (d.part) { const [k, p] = d.part.split(':'), off = s.scenes[k].off; s.scenes[k].off = off.includes(p) ? off.filter((x) => x !== p) : [...off, p]; save(); return; }
      if (d.flag) { const [k, f] = d.flag.split(':'); s.scenes[k][f] = !s.scenes[k][f]; save(); return; }
      if (d.refresh) { call('PressInputPropertiesButton', { inputUuid: d.refresh, propertyName: 'refreshnocache' }).catch(() => {}); return; }
      if (d.add) {
        const sel = el.querySelector('[data-target]'); const scene = sel ? sel.value : await currentScene();
        b.disabled = true; try { await addWidget(d.add, scene, d.copy === '1'); } catch (err) { alert(err.message); } return;
      }
      if (d.tag) { await tagInput(obs.scan.inputs.get(d.tag), d.tagv); if (d.tagv === 'shared-chat') { s.shared = true; save(); } return; }
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
      const t = e.target, d = t.dataset;
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
      if (d.pick) { const [what, uuid] = d.pick.split(':'); s.dock.pick[what][uuid] = t.value; save(); return; }
      if (d.target !== undefined) { obs.target = t.value; }
    });
    el.addEventListener('focusout', () => setTimeout(() => { if (!el.contains(document.activeElement)) refresh(); }, 0));

    // ---------------------------------------------------------------- start
    TGL.onChange(() => refresh());
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
