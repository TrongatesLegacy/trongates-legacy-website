// The control panel: manual form buttons, veadotube / OBS WebSocket status, and the list of veadotube states
// with the colour each maps to. Used by control.html (the OBS custom dock) and embedded in index.html.
// Needs theme.js loaded first (with window.TGL_NO_AUTOCONNECT = true, so this panel owns the connections).
//
//   TGLControl.mount(element, { onForm(form) {}, veado: true })
//
// veado: false leaves veadotube out (the hosted index: a website talking to a local app makes Chrome call the page
// "Not Secure"). The scenes and the OBS dock still follow veadotube.
//
// URL options on the page that mounts it: obs=4455 (+ obspw=…) to broadcast switches to the scenes through the
// OBS WebSocket server; veado=127.0.0.1:54765 if veadotube uses another address; tron=animated to have the
// Tron (cyan) button pick that veadotube state instead of "cyan".
//
// With veadotube connected, a colour button switches veadotube's avatar state (the first state whose name maps
// to that colour; see TGL.formForState), and the colour follows veadotube's report of the switch, so it doesn't
// run ahead of the model. Once veadotube confirms, the switch is broadcast to every scene (the cycling ones
// too). Without veadotube, or with no state for that colour, the button just recolours, as before.
(() => {
  const CSS = `
.tgl-control { color: #e8f4ff; font: 600 14px/1.4 "Chakra Petch", system-ui, sans-serif; }
.tgl-control h1 { font: 900 15px/1 Orbitron, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin: 0 0 12px; }
.tgl-control h2 { font: 700 11px/1 Orbitron, sans-serif; letter-spacing: .18em; text-transform: uppercase; color: #8ba3bd; margin: 16px 0 8px; }
.tgl-control .forms { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.tgl-control .forms button { padding: 10px 6px; border: 2px solid var(--c); border-radius: 8px; background: color-mix(in srgb, var(--c) 12%, #070d18); color: #e8f4ff; font: 700 12px/1.2 Orbitron, sans-serif; letter-spacing: .06em; cursor: pointer; }
.tgl-control .forms button[aria-pressed="true"] { background: var(--c); color: #03060d; box-shadow: 0 0 14px var(--c); }
.tgl-control .row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
.tgl-control .dot { width: 10px; height: 10px; border-radius: 50%; background: #4a5b70; flex: none; }
.tgl-control .dot.ok { background: #53fc18; box-shadow: 0 0 8px #53fc18; } .tgl-control .dot.bad { background: #ff4155; }
.tgl-control .states { display: grid; gap: 4px; }
.tgl-control .states div { display: flex; justify-content: space-between; gap: 10px; padding: 5px 8px; border-radius: 6px; background: #0b1424; }
.tgl-control .states .on { outline: 1px solid var(--accent); }
.tgl-control .states b { color: var(--c); }
.tgl-control .hint { color: #8ba3bd; font-weight: 400; font-size: 12.5px; margin: 6px 0 0; }
.tgl-control code { font-family: ui-monospace, monospace; font-size: 12px; color: #cfe3f5; }`;

  const HTML = `
<h1>Trongates · scenes</h1>
<h2>Colour theme</h2>
<div class="forms" data-forms></div>
<p class="hint">With veadotube connected, the buttons switch its avatar state and every scene follows once it has
switched; without it they recolour every scene straight away. Switching state in veadotube itself works too.</p>
<h2>Connections</h2>
<div class="row"><i class="dot" data-dot="veado"></i><span>veadotube: <span data-status="veado">…</span></span></div>
<div class="row"><i class="dot" data-dot="obs"></i><span>OBS WebSocket: <span data-status="obs">…</span></span></div>
<h2>veadotube states → form</h2>
<div class="states" data-states><p class="hint">Waiting for veadotube…</p></div>
<p class="hint">If a state gets the wrong colour, add <code>map=state name:form</code> to each scene's URL
(e.g. <code>&amp;map=fishing:blobfish</code>). Forms: cyan, yellow, red, princess, blobfish.</p>`;

  function mount(el, { onForm, veado = true } = {}) {
    if (!document.getElementById('tgl-control-css')) {
      const st = document.createElement('style'); st.id = 'tgl-control-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    el.classList.add('tgl-control');
    el.innerHTML = HTML;
    if (!veado) {   // drop the veadotube status row, the states list and its heading and hint
      el.querySelector('[data-dot="veado"]').closest('.row').remove();
      [...el.querySelectorAll('h2, .hint, [data-states]')].filter((n) => n.matches('[data-states]') || /veadotube states|map=state/.test(n.textContent)).forEach((n) => n.remove());
    }
    const params = new URLSearchParams(location.search);
    const F = TGL.FORMS, q = (s) => el.querySelector(s), formsEl = q('[data-forms]');
    let obsWs = null, veadoWs = null, pending = null, pendingTimer;

    for (const [key, f] of Object.entries(F)) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = f.label; b.style.setProperty('--c', f.accent); b.dataset.form = key;
      b.onclick = () => choose(key);
      formsEl.appendChild(b);
    }
    const mark = () => formsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.form === TGL.form));
    function broadcast(form) {
      TGL.set(form); mark(); onForm && onForm(form);
      if (obsWs && obsWs.readyState === 1)
        obsWs.send(JSON.stringify({ op: 6, d: { requestType: 'BroadcastCustomEvent', requestId: 'tgl-' + Date.now(), requestData: { eventData: { tgl: 'form', form } } } }));
    }
    // a button: through veadotube when it's connected and has a state for the colour, else straight to the scenes
    function choose(form) {
      const state = veadoWs && veadoWs.readyState === 1 && stateFor(form);
      if (!state) return broadcast(form);
      pending = form; clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { if (pending) { pending = null; broadcast(form); } }, 3000);   // no reply: recolour anyway
      veadoWs.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload: { event: 'set', state: state.id } }));
    }
    const setStatus = (id, ok, text) => {
      q(`[data-dot="${id}"]`).className = 'dot ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
      q(`[data-status="${id}"]`).textContent = text;
    };

    // OBS WebSocket (for the buttons to reach the scenes)
    if (params.get('obs')) {
      TGL.onStatus((s) => setStatus('obs', s.obs === 'connected' ? true : s.obs === 'off' ? null : false, s.obs === 'connected' ? 'connected, buttons reach every scene' : s.obs));
      obsWs = TGL.connectObs((ws) => { obsWs = ws; });
    } else {
      setStatus('obs', null, "not set up: add ?obs=4455 to this page's URL (and &obspw=… if you set a password)");
    }

    // veadotube: connection, states and what each maps to
    const addr = params.get('veado') || '127.0.0.1:54765', statesEl = q('[data-states]');
    let states = [], current = null;              // states: [{ id, name }] from veadotube
    const tronPick = (params.get('tron') || 'cyan').toLowerCase();
    // the veadotube state for a colour: for Tron (cyan) the ?tron= one (default "cyan"), else one named after the
    // colour, else the first whose name maps to it
    const stateFor = (form) => {
      const fits = states.filter((s) => TGL.formForState(s.name) === form);
      const want = form === 'cyan' ? tronPick : form;
      return fits.find((s) => s.name.toLowerCase() === want) || fits[0] || null;
    };
    function drawStates() {
      if (!states.length) return;
      statesEl.innerHTML = '';
      for (const { name } of states) {
        const form = TGL.formForState(name), row = document.createElement('div');
        row.className = name === current ? 'on' : '';
        row.style.setProperty('--c', F[form].accent);
        row.innerHTML = '<span></span><b></b>';
        row.firstChild.textContent = name; row.lastChild.textContent = F[form].label;
        statesEl.appendChild(row);
      }
    }
    function connectVeado() {
      let ws;
      try { ws = veadoWs = new WebSocket(`ws://${addr}?n=${encodeURIComponent('Trongates control')}`); }
      catch { setStatus('veado', false, `can't connect to ${addr}`); return; }
      const send = (payload) => ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload }));
      ws.onopen = () => { setStatus('veado', true, `connected (${addr})`); send({ event: 'listen', token: 'tgl-control' }); send({ event: 'list' }); send({ event: 'peek' }); };
      ws.onmessage = (e) => {
        const t = String(e.data), i = t.indexOf(':');
        if (t.slice(0, i).trim() !== 'nodes') return;
        let m; try { m = JSON.parse(t.slice(i + 1)); } catch { return; }
        if (m.type !== 'stateEvents' || !m.payload) return;
        if (Array.isArray(m.payload.states)) states = m.payload.states.map((s) => ({ id: s.id || s.name, name: s.name || s.id }));
        if (m.payload.state) {
          current = (states.find((s) => s.id === m.payload.state) || { name: m.payload.state }).name;
          const f = TGL.formForState(current);
          // a switch asked for from the buttons: now that veadotube has it, tell every scene (the cycling ones too)
          if (pending && f === pending) { pending = null; clearTimeout(pendingTimer); broadcast(f); }
          else { TGL.set(f); mark(); onForm && onForm(f); }
        }
        drawStates();
      };
      ws.onclose = () => {
        const hosted = location.protocol === 'https:';
        setStatus('veado', false, hosted
          ? `not reachable from this web page (browsers block websites from local apps); open this page as a local file, or check the OBS dock (retrying…)`
          : `not reachable at ${addr} (is veadotube mini open? retrying…)`);
        setTimeout(connectVeado, 5000);
      };
    }
    if (veado) connectVeado();
    TGL.onChange(mark); mark();
    return { broadcast };
  }

  window.TGLControl = { mount };
})();
