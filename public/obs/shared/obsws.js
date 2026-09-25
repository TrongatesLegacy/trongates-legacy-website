// A small OBS WebSocket (v5) client for the control dock: connect with the password, send requests and get their
// replies, hear about changes. https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
//
//   const obs = TGLObs.connect({ port: 4455, password: '…', onStatus(s) {}, onEvent(type, data) {} });
//   const { scenes } = await obs.call('GetSceneList');
(() => {
  // event subscriptions: General, Config (scene collections), Scenes, Inputs, SceneItems
  const EVENTS = 1 | 2 | 4 | 8 | 128;
  const sha = async (s) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))));

  function connect({ host = '127.0.0.1', port = 4455, password = '', onStatus = () => {}, onEvent = () => {} }) {
    let ws = null, ready = false, id = 0, retry;
    const waiting = new Map();
    const status = (s, detail) => onStatus({ state: s, detail });
    function open() {
      clearTimeout(retry);
      try { ws = new WebSocket(`ws://${host}:${port}`); } catch { status('error'); retry = setTimeout(open, 5000); return; }
      status('connecting');
      ws.onmessage = async (e) => {
        const m = JSON.parse(e.data);
        if (m.op === 0) {                                  // Hello → Identify
          const d = { rpcVersion: 1, eventSubscriptions: EVENTS };
          if (m.d.authentication) d.authentication = await sha((await sha(password + m.d.authentication.salt)) + m.d.authentication.challenge);
          ws.send(JSON.stringify({ op: 1, d }));
        } else if (m.op === 2) { ready = true; status('connected', m.d); }
        else if (m.op === 7) {                             // RequestResponse
          const w = waiting.get(m.d.requestId); if (!w) return;
          waiting.delete(m.d.requestId);
          if (m.d.requestStatus.result) w.ok(m.d.responseData || {});
          else w.fail(new Error(`${m.d.requestType}: ${m.d.requestStatus.comment || m.d.requestStatus.code}`));
        } else if (m.op === 5) onEvent(m.d.eventType, m.d.eventData || {});
      };
      ws.onclose = (e) => {
        ready = false;
        for (const w of waiting.values()) w.fail(new Error('connection closed'));
        waiting.clear();
        status(e.code === 4009 ? 'wrong password' : 'retrying');
        retry = setTimeout(open, e.code === 4009 ? 15000 : 5000);
      };
    }
    function call(requestType, requestData = {}) {
      if (!ready) return Promise.reject(new Error('not connected to OBS'));
      const requestId = 'tgl-' + (++id);
      return new Promise((ok, fail) => {
        waiting.set(requestId, { ok, fail });
        ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
        setTimeout(() => { if (waiting.has(requestId)) { waiting.delete(requestId); fail(new Error(requestType + ': no reply')); } }, 10000);
      });
    }
    open();
    return { call, get ready() { return ready; }, close() { clearTimeout(retry); ws && ws.close(); } };
  }
  window.TGLObs = { connect };
})();
