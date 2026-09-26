// The dock's avatar and colour: its buttons, and its own connection to veadotube mini. Used by panel.js; on its own
// so the loop tests (tests/loops/) run this exact code against a simulated veadotube, OBS and scenes.
//
//   const veado = TGLDockColour.create({ TGL, dock, settings: () => s, addr: () => '127.0.0.1:54765',
//     obs: () => obsClient, onForm(form) {}, refresh() {} });
//   veado.connect(); veado.choose('princess');
//
// A button with veadotube connected (and "Colour buttons switch the avatar" on) asks veadotube to switch; the colour
// follows once veadotube confirms (or after 3s if it never does). Without veadotube a button just recolours. Every
// recolour reaches the scenes through theme.js (same browser profile) and the OBS WebSocket (CustomEvent).
(() => {
  function create({ TGL, dock, settings, addr, obs = () => null, onForm = () => {}, refresh = () => {} }) {
    // pending: the form the last press asked for; waiting: presses veadotube hasn't confirmed yet (it confirms in order)
    const v = { state: 'off', ws: null, states: [], current: null, pending: null, waiting: 0, pendingTimer: 0 };
    const s = () => settings();
    const formFor = (name) => { const m = s().veado.map[String(name || '').toLowerCase()]; return TGL.FORMS[m] ? m : TGL.formForState(name); };
    const broadcast = (form) => {
      const at = TGL.set(form); onForm(form); refresh();
      const c = obs(); if (c && c.ready) c.call('BroadcastCustomEvent', { eventData: { tgl: 'form', form, at } }).catch(() => {});
    };
    const stateFor = (form, name) => {
      if (name) return v.states.find((x) => x.name.toLowerCase() === name) || null;
      const fits = v.states.filter((x) => formFor(x.name) === form), want = form === 'cyan' ? (s().veado.tron || 'cyan') : form;
      return fits.find((x) => x.name.toLowerCase() === want) || fits[0] || null;
    };
    const send = (payload) => v.ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload }));
    // a button: switch veadotube if we can (the colour follows its confirmation), else just recolour
    function choose(form, stateName) {
      const st = dock && s().veado.switch && v.ws && v.ws.readyState === 1 && stateFor(form, stateName);
      if (!st) return broadcast(form);
      v.pending = form; v.waiting++; clearTimeout(v.pendingTimer);
      v.pendingTimer = setTimeout(() => { v.waiting = 0; if (v.pending) { v.pending = null; broadcast(form); } }, 3000);
      send({ event: 'set', state: st.id });
    }
    function connect() {
      let ws;
      try { ws = v.ws = new WebSocket(`ws://${addr()}?n=${encodeURIComponent('Trongates dock')}`); } catch { v.state = 'bad'; refresh(); return; }
      ws.onopen = () => { v.state = 'ok'; send({ event: 'listen', token: 'tgl-dock' }); send({ event: 'list' }); send({ event: 'peek' }); refresh(); };
      ws.onmessage = (e) => {
        const t = String(e.data), i = t.indexOf(':');
        if (t.slice(0, i).trim() !== 'nodes') return;
        let m; try { m = JSON.parse(t.slice(i + 1)); } catch { return; }
        if (m.type !== 'stateEvents' || !m.payload) return;
        if (Array.isArray(m.payload.states)) v.states = m.payload.states.map((x) => ({ id: x.id || x.name, name: x.name || x.id }));
        if (m.payload.state) {
          v.current = (v.states.find((x) => x.id === m.payload.state) || { name: m.payload.state }).name;
          const f = formFor(v.current);
          // only the last press's confirmation settles it: an earlier press can ask for the same form (Blobfish, Gold,
          // Blobfish), and announcing that one would flash the scenes back to it in the middle
          if (v.waiting > 0) v.waiting--;
          if (v.pending && !v.waiting) { const want = v.pending; v.pending = null; clearTimeout(v.pendingTimer); if (f === want) broadcast(f); else { TGL.set(f); onForm(f); } }
          else { TGL.set(f); onForm(f); }
        }
        refresh();
      };
      ws.onclose = () => { v.state = 'bad'; refresh(); setTimeout(() => { if (v.ws === ws) connect(); }, 5000); };
    }
    const reconnect = () => { const old = v.ws; v.ws = null; if (old) try { old.close(); } catch {} connect(); };
    // for Measure avatar: switch veadotube to a state (by id) without recolouring anything
    const setState = (id) => send({ event: 'set', state: id });
    Object.defineProperty(v, 'ready', { get: () => !!v.ws && v.ws.readyState === 1 });
    return Object.assign(v, { formFor, choose, connect, reconnect, setState });
  }
  window.TGLDockColour = { create };
})();
