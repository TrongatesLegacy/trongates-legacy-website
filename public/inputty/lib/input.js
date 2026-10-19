// The live input state every view draws from, and the three ways input gets in:
//  1. input-overlay's websocket (ws://127.0.0.1:<port>): keys and mouse from anywhere on the PC, and controllers
//  2. the browser's own events, while this page (or the set-up page around it) has focus: for trying it out
//  3. the Gamepad API: controllers with nothing installed
(() => {
  const { KEYS, VK, MOUSE, PAD } = window.IOCodes;

  const state = {
    keys: new Set(), mouse: new Set(),
    wheel: { rot: 0, t: 0 },
    move: { x: null, y: null, accX: 0, accY: 0, vx: 0, vy: 0, angle: 0 },
    pad: { connected: false, index: 0, name: '', buttons: new Array(21).fill(false), axes: [0, 0, 0, 0, 0, 0], source: '' },
    ws: { status: 'off', port: 16899, events: 0, keyEvents: 0 },
    last: 0,
  };
  const listeners = new Set();
  const emit = (e) => { state.last = performance.now(); listeners.forEach((f) => f(e)); };
  const on = (f) => (listeners.add(f), () => listeners.delete(f));

  function key(vc, down, src) {
    if (!vc) return;
    if (down === state.keys.has(vc)) return;
    down ? state.keys.add(vc) : state.keys.delete(vc);
    emit({ kind: 'key', code: vc, down, src });
  }
  function mouse(b, down, src) {
    if (!b || down === state.mouse.has(b)) return;
    down ? state.mouse.add(b) : state.mouse.delete(b);
    emit({ kind: 'mouse', code: b, down, src });
  }
  function wheel(rot) { state.wheel = { rot: Math.sign(rot), t: performance.now() }; emit({ kind: 'wheel', rot }); }
  function moveBy(dx, dy) { state.move.accX += dx; state.move.accY += dy; emit({ kind: 'move' }); }
  function moveTo(x, y) {
    const m = state.move;
    if (m.x !== null) moveBy(x - m.x, y - m.y);
    m.x = x; m.y = y;
  }
  function padButton(b, down, src) {
    if (b < 0 || b > 20 || state.pad.buttons[b] === down) return;
    state.pad.buttons[b] = down;
    emit({ kind: 'pad', code: b, down, src });
  }

  // once a frame: smooth the mouse movement so the dot/arrow move steadily
  function tick() {
    const m = state.move;
    m.vx += (m.accX - m.vx) * 0.35; m.vy += (m.accY - m.vy) * 0.35;
    m.accX = 0; m.accY = 0;
    if (Math.hypot(m.vx, m.vy) > 1.5) m.angle = Math.atan2(m.vy, m.vx) + Math.PI / 2;
    pollGamepads();
  }

  // ---- 1. input-overlay's websocket -------------------------------------------------------------------------------
  let ws = null, retry = null, batch = [], flushing = false;
  function connect(port) {
    state.ws.port = port;
    clearTimeout(retry);
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    state.ws.status = 'connecting';
    emit({ kind: 'ws' });
    try { ws = new WebSocket(`ws://127.0.0.1:${port}/`); } catch { return scheduleRetry(port); }
    ws.onopen = () => { state.ws.status = 'open'; emit({ kind: 'ws' }); };
    ws.onclose = () => { ws = null; state.ws.status = 'closed'; emit({ kind: 'ws' }); scheduleRetry(port); };
    ws.onerror = () => {};
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      batch.push(m);
      // input-overlay sends each burst newest-first: gather what arrives together, then play it back in time order
      if (!flushing) { flushing = true; setTimeout(flush, 8); }
    };
  }
  // the Windows key code when there is one (same in every input-overlay version), else input-overlay 5.0's own code
  const wsKey = (m) => VK[m.rawcode] ?? m.keycode;
  function scheduleRetry(port) { retry = setTimeout(() => connect(port), 2000); }
  // newest event time seen per key/button: a burst can still be split across flushes, so an older event that turns up
  // after a newer one for the same key is stale (a quick tap's release arriving before its press would stick it down)
  const seen = new Map();
  const stale = (m) => {
    const id = m.event_type.replace(/_(pressed|released|down|up)$/, '') + ':' + (m.keycode ?? m.button ?? m.virtual_code);
    if (m.time !== undefined && m.time < (seen.get(id) ?? -Infinity)) return true;
    seen.set(id, m.time ?? 0);
    return false;
  };
  function flush() {
    flushing = false;
    const list = batch.sort((a, b) => (a.time || 0) - (b.time || 0)); batch = [];
    for (const m of list) {
      state.ws.events++;
      if (/_(pressed|released|down|up)$/.test(m.event_type || '') && stale(m)) continue;
      switch (m.event_type) {
        case 'key_pressed': state.ws.keyEvents++; key(wsKey(m), true, 'ws'); break;
        case 'key_released': key(wsKey(m), false, 'ws'); break;
        case 'mouse_pressed': mouse(m.button, true, 'ws'); break;
        case 'mouse_released': mouse(m.button, false, 'ws'); break;
        case 'mouse_moved': case 'mouse_dragged': moveTo(m.x, m.y); break;
        case 'mouse_wheel': wheel(m.rotation || m.delta || 0); break;
        case 'controller_device_added': state.pad.connected = true; state.pad.name = m.device_name || ''; state.pad.source = 'ws'; emit({ kind: 'padinfo' }); break;
        case 'controller_device_removed': if (state.pad.source === 'ws') state.pad.connected = false; emit({ kind: 'padinfo' }); break;
        case 'controller_button_down': state.pad.connected = true; state.pad.source ||= 'ws'; padButton(m.virtual_code, true, 'ws'); break;
        case 'controller_button_up': padButton(m.virtual_code, false, 'ws'); break;
        case 'controller_axis_motion': state.pad.connected = true; state.pad.axes[m.virtual_code] = m.virtual_value; break;
      }
    }
  }

  // ---- 2. the browser's own events -----------------------------------------------------------------------------------
  function local(msg) {
    switch (msg.kind) {
      case 'key': key(KEYS[msg.code], msg.down, 'local'); break;
      case 'mouse': mouse(MOUSE[msg.button], msg.down, 'local'); break;
      case 'wheel': wheel(Math.sign(msg.deltaY)); break;
      case 'move': moveBy(msg.dx, msg.dy); break;
      case 'blur': [...state.keys].forEach((k) => key(k, false, 'local')); [...state.mouse].forEach((b) => mouse(b, false, 'local')); break;
    }
  }
  function listenLocal(target = window) {
    target.addEventListener('keydown', (e) => { if (!e.repeat) local({ kind: 'key', code: e.code, down: true }); });
    target.addEventListener('keyup', (e) => local({ kind: 'key', code: e.code, down: false }));
    target.addEventListener('mousedown', (e) => local({ kind: 'mouse', button: e.button, down: true }));
    target.addEventListener('mouseup', (e) => local({ kind: 'mouse', button: e.button, down: false }));
    target.addEventListener('wheel', (e) => local({ kind: 'wheel', deltaY: e.deltaY }), { passive: true });
    target.addEventListener('mousemove', (e) => local({ kind: 'move', dx: e.movementX, dy: e.movementY }));
    target.addEventListener('blur', () => local({ kind: 'blur' }));
  }

  // ---- 3. the Gamepad API --------------------------------------------------------------------------------------------
  function pollGamepads() {
    if (!navigator.getGamepads) return;
    const pads = [...navigator.getGamepads()].filter(Boolean);
    const gp = pads.find((p) => p.mapping === 'standard') || pads[0];
    if (!gp) { if (state.pad.source === 'api') { state.pad.connected = false; state.pad.source = ''; emit({ kind: 'padinfo' }); } return; }
    if (state.pad.source !== 'api') { state.pad.source = 'api'; state.pad.connected = true; state.pad.name = gp.id; state.pad.index = gp.index; emit({ kind: 'padinfo' }); }
    gp.buttons.forEach((b, i) => { if (PAD[i] !== undefined) padButton(PAD[i], b.pressed, 'api'); });
    const a = state.pad.axes;
    for (let i = 0; i < 4; i++) a[i] = Math.abs(gp.axes[i] || 0) < 0.06 ? 0 : gp.axes[i] || 0;
    a[4] = gp.buttons[6]?.value || 0; a[5] = gp.buttons[7]?.value || 0;
  }

  window.IOInput = { state, on, tick, connect, local, listenLocal, key, mouse, wheel, moveBy, padButton };
})();
