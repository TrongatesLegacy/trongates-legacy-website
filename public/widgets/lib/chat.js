// Reads every platform's chat as one stream of messages: { platform, user, name, text, mod, owner, color, emotes }
// (docs/widgets.md, "Reading chat"). Each platform (platforms/*.js) describes its WebSocket; this file keeps it
// connected (color: the chatter's chat colour, '#rrggbb' or ''; emotes: [{ id, name, url }] the platform itself found in
// the text, in order). It reconnects after a drop, waiting longer each time (1, 2, 5, 10, then 30 s: never more than a few
// attempts a minute), keeps the connection alive, and reports each platform's status: connecting, live, retrying, or
// error (e.g. a Kick channel that doesn't exist, retried every minute).
//
//   const chat = Widgets.chat({ twitch: 'name', kick: 'name', kickId: 123 }, onMessage, onStatus);   chat.close();
//
// env (tests): { WebSocket, setTimeout, clearTimeout, setInterval, clearInterval, fetch } instead of the browser's.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const DELAYS = [1000, 2000, 5000, 10000, 30000], ERROR_DELAY = 60000, STEADY = 30000;
  // Watchdog: a connection can die without closing (Wi-Fi drop, laptop sleep). Each platform pings every minute and the
  // server answers, so hearing nothing at all for SILENT means it's dead: drop it and reconnect.
  const SILENT = 150000, CHECK = 15000;

  function socketMaker(env) {
    /** keeps one platform's socket connected @returns {{ close(): void }} */
    return function socket(spec, onStatus) {
      let ws = null, tries = 0, closed = false, timer = null, keep = null, steady = null, watch = null, heard = 0;
      const now = env.now || Date.now;
      const status = (s, detail) => onStatus(spec.name, s, detail);
      const retry = (delay) => {
        if (closed) return;
        env.clearInterval(keep); keep = null; env.clearTimeout(steady); steady = null; env.clearInterval(watch); watch = null;
        timer = env.setTimeout(attempt, delay);
      };
      async function attempt() {
        timer = null;
        if (closed) return;
        status('connecting');
        try { if (spec.before) await spec.before(); }
        catch (e) { status('error', String(e && e.message || e)); return retry(ERROR_DELAY); }
        if (closed) return;
        let sock;
        try { sock = new env.WebSocket(spec.url); } catch { status('retrying'); return retry(DELAYS[Math.min(tries++, DELAYS.length - 1)]); }
        ws = sock;
        const send = (d) => { try { if (sock.readyState === 1) sock.send(d); } catch {} };
        const live = () => {
          status('live');
          env.clearTimeout(steady); steady = env.setTimeout(() => { tries = 0; }, STEADY);   // live for a while: back to quick retries
        };
        // give up on this socket and reconnect (a dead connection, or the server asked us to)
        const restart = () => {
          if (ws !== sock) return;
          ws = null; try { sock.close(); } catch {}
          if (closed) return;
          status('retrying');
          retry(DELAYS[Math.min(tries++, DELAYS.length - 1)]);
        };
        sock.onopen = () => {
          heard = now();
          spec.open(send);
          if (spec.keepalive && spec.ping) keep = env.setInterval(() => send(spec.ping()), spec.keepalive);
          watch = env.setInterval(() => { if (now() - heard > SILENT) restart(); }, CHECK);
        };
        sock.onmessage = (e) => { heard = now(); try { spec.message(e.data, send, live, restart); } catch {} };
        sock.onclose = () => {
          if (ws !== sock) return;
          ws = null;
          if (closed) return;
          status('retrying');
          retry(DELAYS[Math.min(tries++, DELAYS.length - 1)]);
        };
        sock.onerror = () => {};
      }
      attempt();
      return {
        close() {
          closed = true; env.clearTimeout(timer); env.clearInterval(keep); env.clearTimeout(steady); env.clearInterval(watch);
          if (ws) { const s = ws; ws = null; try { s.close(); } catch {} }
        },
      };
    };
  }

  /**
   * @param {{ twitch?: string, kick?: string, kickId?: number|string, env?: any }} o
   * @param {(m: any) => void} onMessage @param {(all: Record<string, { state: string, detail?: string }>) => void} [onStatus]
   */
  function chat(o, onMessage, onStatus = () => {}) {
    const env = o.env || { WebSocket, setTimeout: setTimeout.bind(window), clearTimeout: clearTimeout.bind(window), setInterval: setInterval.bind(window), clearInterval: clearInterval.bind(window), fetch: window.fetch && window.fetch.bind(window) };
    const socket = socketMaker(env), P = W.platforms, all = {}, conns = [];
    const report = (name, state, detail) => { all[name] = { state, detail }; onStatus({ ...all }); };
    if (o.twitch && P.twitch.channel(o.twitch)) { all.twitch = { state: 'connecting' }; conns.push(P.twitch.connect({ channel: o.twitch, socket }, onMessage, report)); }
    if (o.kick && P.kick.channel(o.kick)) { all.kick = { state: 'connecting' }; conns.push(P.kick.connect({ channel: o.kick, chatroomId: o.kickId, socket, fetch: env.fetch }, onMessage, report)); }
    return { close() { conns.forEach((c) => c.close()); }, get status() { return { ...all }; }, platforms: Object.keys(all) };
  }

  W.chat = chat;
  W.chat.DELAYS = DELAYS;
  W.chat.SILENT = SILENT;
})();
