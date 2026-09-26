// Theme engine shared by every OBS overlay and the control dock.
//
// The current form decides the accent colour of every scene. It can come from, in priority order:
//   1. veadotube mini (automatic): each overlay connects to veadotube's local WebSocket API, listens to the
//      avatar state stack and maps the state name to a form (see FORM_RULES / config.js). Switch form in
//      veadotube as usual and every scene recolours itself. Docs: https://veado.tube/docs/tech/api/
//   2. the control dock (manual): buttons in an OBS custom browser dock broadcast a form over the OBS
//      WebSocket server (Tools → WebSocket Server Settings), as a CustomEvent every overlay listens for.
//   3. ?form=cyan|yellow|red|princess|blobfish on the overlay URL (fixed), otherwise the last form seen.
//
// URL options understood by every overlay (all optional):
//   form=princess        start on this form (still follows veadotube / the dock afterwards)
//   veado=127.0.0.1:54765 veadotube's server address (veadotube mini shows it; default 127.0.0.1:54765)
//   noveado=1            don't connect to veadotube
//   obs=4455             OBS WebSocket port to listen on for dock switches (default: don't connect)
//   obspw=secret         OBS WebSocket password, if authentication is enabled
//   map=fishing:blobfish,tiara:princess   pin veadotube state names to forms (beats the automatic matching)
//   veadodelay=300       wait this many ms after a veadotube switch before recolouring (if the model loads slowly)
//   hide=chat,goal,music,discord,socials,ticker,art,rings   turn parts of a scene off (art=0 and music=0 still work)
//   guide=1              show labelled boxes with the exact position of every source to add in OBS
(() => {
  const FORMS = {
    cyan:     { accent: '#22e5ff', label: 'Tron' },
    yellow:   { accent: '#ffd23f', label: 'Tron (gold)' },
    red:      { accent: '#ff4155', label: 'Tron (red)' },
    princess: { accent: '#ff63b8', label: 'Princess Trina' },
    blobfish: { accent: '#ffb36b', label: 'The Blobfish' },
  };
  // The avatar's actual state names (read from chibi-v1-animated-with-blobfish.veado): pinned exactly.
  // 'pink' is Tron in pink armour; the site dropped that form because Princess Trina owns pink.
  const KNOWN_STATES = { cyan: 'cyan', red: 'red', yellow: 'yellow', pink: 'princess', animated: 'cyan', princess: 'princess', blobfish: 'blobfish' };
  // Any other state name: first matching rule wins, anything unmatched is cyan Tron.
  // Exact names can be pinned with ?map=stateName:form,other:form on the URL, which takes precedence.
  const FORM_RULES = [
    [/princess|trina|tiara|dress|pink/i, 'princess'],
    [/blob|fish/i, 'blobfish'],
    [/red|angry|rage|mad/i, 'red'],
    [/yellow|gold|happy/i, 'yellow'],
  ];
  const params = new URLSearchParams(location.search);
  const cfg = { stateMap: Object.fromEntries((params.get('map') || '').split(',').filter(Boolean).map((p) => p.split(':').map((x) => x.trim().toLowerCase()))) };
  const root = document.documentElement;
  const listeners = new Set();
  const status = { veado: 'off', obs: 'off', state: null, states: [] };
  const hidden = new Set((params.get('hide') || '').split(',').map((p) => p.trim()).filter(Boolean));
  if (params.get('art') === '0') hidden.add('art');
  if (params.get('music') === '0') hidden.add('music');

  const valid = (f) => Object.prototype.hasOwnProperty.call(FORMS, f);
  const stored = () => { try { return localStorage.getItem('tgl-obs-form'); } catch { return null; } };
  let form = [params.get('form'), stored(), 'cyan'].find(valid);

  function formForState(name) {
    if (!name) return null;
    const key = String(name).toLowerCase(), pinned = cfg.stateMap[key] || KNOWN_STATES[key];
    if (valid(pinned)) return pinned;
    const hit = FORM_RULES.find(([re]) => re.test(name));
    return hit ? hit[1] : 'cyan';
  }

  // Starting soon / BRB / Ending cycle through the forms themselves (<html data-cycle>), so they don't follow
  // veadotube unless ?cycle=0.
  const cycling = root.hasAttribute('data-cycle') && params.get('cycle') !== '0';
  function paint(f) { if (!valid(f)) return; root.dataset.form = f; root.style.setProperty('--accent', FORMS[f].accent); }

  function apply(next, source) {
    if (!valid(next)) return;
    const changed = next !== form;
    form = next;
    root.dataset.form = form;
    root.style.setProperty('--accent', FORMS[form].accent);
    try { localStorage.setItem('tgl-obs-form', form); } catch {}
    if (changed) listeners.forEach((fn) => fn(form, source));
  }

  // ---- 1. veadotube mini: follow the avatar state ----------------------------------------------------
  function connectVeado() {
    if (params.get('noveado') === '1') return;
    const addr = params.get('veado') || '127.0.0.1:54765';
    let ws;
    try { ws = new WebSocket(`ws://${addr}?n=${encodeURIComponent('Trongates overlay')}`); }
    catch { status.veado = 'error'; return setTimeout(connectVeado, 5000); }
    const send = (payload) => ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload }));
    ws.onopen = () => {
      status.veado = 'connected'; notifyStatus();
      send({ event: 'listen', token: 'tgl-theme' });
      send({ event: 'list' });
      send({ event: 'peek' });
    };
    ws.onmessage = (e) => {
      const text = String(e.data), i = text.indexOf(':');
      if (i < 0 || text.slice(0, i).trim() !== 'nodes') return;
      let msg; try { msg = JSON.parse(text.slice(i + 1)); } catch { return; }
      if (msg.type !== 'stateEvents' || !msg.payload) return;
      const p = msg.payload;
      if (Array.isArray(p.states)) { status.states = p.states.map((s) => s.name || s.id); notifyStatus(); }
      if (p.state) {
        status.state = p.state; notifyStatus();
        const f = formForState(p.state), wait = +params.get('veadodelay') || 0;
        if (wait > 0) setTimeout(() => apply(f, 'veadotube'), wait); else apply(f, 'veadotube');
      }
    };
    ws.onclose = () => { status.veado = 'retrying'; notifyStatus(); setTimeout(connectVeado, 5000); };
    ws.onerror = () => { status.veado = 'unreachable'; notifyStatus(); };
  }

  // ---- 2. OBS WebSocket: receive switches from the control dock --------------------------------------
  async function obsAuth(password, salt, challenge) {
    const sha = async (s) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))));
    return sha((await sha(password + salt)) + challenge);
  }
  function connectObs(onReady) {
    const port = params.get('obs');
    if (!port) return null;
    const password = params.get('obspw') || '';
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.op === 0) {                                   // Hello -> Identify, subscribed to general events
        const d = { rpcVersion: 1, eventSubscriptions: 1 };
        if (msg.d.authentication) d.authentication = await obsAuth(password, msg.d.authentication.salt, msg.d.authentication.challenge);
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (msg.op === 2) {                            // Identified
        status.obs = 'connected'; notifyStatus(); onReady && onReady(ws);
      } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent' && msg.d.eventData && msg.d.eventData.tgl === 'form') {
        apply(msg.d.eventData.form, 'dock');
      }
    };
    ws.onclose = (e) => { status.obs = e.code === 4009 ? 'wrong password' : 'retrying'; notifyStatus(); setTimeout(() => connectObs(onReady), 5000); };
    return ws;
  }

  // ---- same-profile fallback (dock and sources sharing storage) --------------------------------------
  addEventListener('storage', (e) => { if (e.key === 'tgl-obs-form' && valid(e.newValue)) apply(e.newValue, 'storage'); });
  let channel; try { channel = new BroadcastChannel('tgl-obs'); channel.onmessage = (e) => apply(e.data, 'channel'); } catch {}

  const statusListeners = new Set();
  function notifyStatus() { statusListeners.forEach((fn) => fn({ ...status, form })); }

  window.TGL = {
    FORMS, formForState,
    get form() { return form; },
    set(next) { apply(next, 'local'); try { channel && channel.postMessage(next); } catch {} },
    onChange(fn) { listeners.add(fn); },
    onStatus(fn) { statusListeners.add(fn); fn({ ...status, form }); },
    connectObs, paint, cycling,
    guide: params.get('guide') === '1',
    // Reduced motion: the system setting, except inside OBS, where it's the streaming PC's setting, not the
    // viewers' (Windows' "Animation effects" off would otherwise freeze every scene). ?motion=reduce|full forces it.
    reduced: params.get('motion') === 'reduce' || (params.get('motion') !== 'full' && !window.obsstudio
      && matchMedia('(prefers-reduced-motion: reduce)').matches),
    param: (k, d) => params.get(k) ?? d,
    hidden: (part) => hidden.has(part),
  };

  root.dataset.form = form;
  root.style.setProperty('--accent', FORMS[form].accent);
  if (window.TGL.guide) root.classList.add('guide');
  if (window.TGL.reduced) root.classList.add('reduce-motion');
  if (!window.TGL_NO_AUTOCONNECT && !cycling) { connectVeado(); connectObs(); }
})();
