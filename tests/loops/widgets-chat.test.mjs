// Reading chat keeps itself connected (public/widgets/lib/chat.js), on the virtual clock with fake Twitch and Kick
// servers: it reconnects after drops without hammering a server that's down, reports each platform's state, retries
// an unknown Kick channel slowly, and leaves nothing running once closed.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, Clock } from '../helpers/sim.mjs';

function world() {
  const clock = new Clock(), servers = { twitch: true, kick: true }, opened = [], sockets = new Set();
  let chatroomLookups = 0, chatroomOk = true;
  class FakeWebSocket {
    constructor(url) {
      this.url = url; this.readyState = 0; this.sent = []; sockets.add(this);
      const which = url.includes('twitch') ? 'twitch' : 'kick';
      this.which = which; opened.push([clock.now, which]);
      clock.at(5, () => {
        if (!servers[which]) { this.readyState = 3; sockets.delete(this); this.onclose && this.onclose({}); return; }
        this.readyState = 1; this.onopen && this.onopen({});
        if (which === 'kick') this.recv({ event: 'pusher:connection_established', data: '{}' });
      });
    }
    send(d) {
      this.sent.push(d);
      if (this.which === 'twitch' && /^JOIN/.test(d)) clock.at(5, () => this.recv(':justinfan1.tmi.twitch.tv 366 justinfan1 #gridrunner :End of /NAMES list'));
      if (this.which === 'kick' && d.includes('pusher:subscribe')) clock.at(5, () => this.recv({ event: 'pusher_internal:subscription_succeeded', data: '{}' }));
      // like the real servers, they answer pings (unless the test has made this connection go silent)
      if (!this.silent && this.which === 'twitch' && /^PING/.test(d)) clock.at(5, () => this.recv(':tmi.twitch.tv PONG tmi.twitch.tv :tmi.twitch.tv'));
      if (!this.silent && this.which === 'kick' && d.includes('pusher:ping')) clock.at(5, () => this.recv({ event: 'pusher:pong', data: {} }));
    }
    recv(m) { if (this.readyState === 1 && !this.silent) this.onmessage && this.onmessage({ data: typeof m === 'string' ? m : JSON.stringify(m) }); }
    drop() { if (this.readyState !== 1) return; this.readyState = 3; sockets.delete(this); this.onclose && this.onclose({}); }
    close() { this.readyState = 3; sockets.delete(this); }
  }
  const env = {
    WebSocket: FakeWebSocket, now: () => clock.now,
    setTimeout: (fn, ms) => clock.at(ms, fn, 'timeout'), clearTimeout: (id) => clock.cancel(id),
    setInterval: (fn, ms) => { const box = {}; const tick = () => { box.id = clock.at(ms, tick, 'interval'); fn(); }; box.id = clock.at(ms, tick, 'interval'); return box; },
    clearInterval: (box) => box && clock.cancel(box.id),
    fetch: async () => { chatroomLookups++; return { ok: chatroomOk, json: async () => ({ chatroom: { id: 715 } }) }; },
  };
  const ctx = vm.createContext({ URLSearchParams, JSON, Math, String, Promise }); ctx.window = ctx;
  for (const f of ['platforms/twitch.js', 'platforms/kick.js', 'chat.js']) vm.runInContext(read('public/widgets/lib/' + f), ctx);
  return { clock, servers, opened, sockets, env, W: ctx.Widgets, lookups: () => chatroomLookups, setChatroomOk: (v) => { chatroomOk = v; } };
}
// let pending promises (the Kick lookup) settle between clock steps
async function runFor(w, ms) { const end = w.clock.now + ms; while (w.clock.now < end) { await new Promise((r) => setImmediate(r)); const next = w.clock.q[0]; w.clock.run({ until: Math.min(end, next ? next.when : end) }); } await new Promise((r) => setImmediate(r)); }

test('both platforms connect, go live, and deliver messages as one stream', async () => {
  const w = world(), got = [], states = [];
  const chat = w.W.chat({ twitch: 'GridRunner', kick: 'gridrunner', env: w.env }, (m) => got.push(m), (s) => states.push(JSON.parse(JSON.stringify(s))));
  await runFor(w, 1000);
  assert.deepEqual(states.at(-1), { twitch: { state: 'live' }, kick: { state: 'live' } });
  const [tw, ki] = [...w.sockets].sort((a) => (a.which === 'twitch' ? -1 : 1));
  assert.ok(tw.sent.includes('JOIN #gridrunner'), 'joined the channel by its plain name');
  assert.ok(ki.sent.some((d) => d.includes('chatrooms.715.v2')), 'subscribed to the looked-up chatroom');
  tw.recv('@badges=;display-name=PixelPanda;mod=0 :pixelpanda!pixelpanda@x PRIVMSG #gridrunner :manic');
  ki.recv({ event: 'App\\Events\\ChatMessageEvent', data: JSON.stringify({ content: 'candy', sender: { username: 'NeonNacho', slug: 'neonnacho', identity: { badges: [] } } }) });
  assert.deepEqual(got.map((m) => `${m.platform}:${m.name}:${m.text}`), ['twitch:PixelPanda:manic', 'kick:NeonNacho:candy']);
  tw.recv('PING :tmi.twitch.tv'); assert.equal(tw.sent.at(-1), 'PONG :tmi.twitch.tv');
  ki.recv({ event: 'pusher:ping', data: {} }); assert.match(ki.sent.at(-1), /pusher:pong/);
  chat.close();
});

test('a server that stays down is retried with growing waits: a handful of attempts a minute, not a storm', async () => {
  const w = world(); w.servers.twitch = false;
  const chat = w.W.chat({ twitch: 'gridrunner', env: w.env }, () => {});
  await runFor(w, 10 * 60000);
  const attempts = w.opened.filter(([, x]) => x === 'twitch');
  const lastMinute = attempts.filter(([t]) => t > w.clock.now - 60000).length;
  assert.ok(attempts.length < 30, `${attempts.length} attempts in 10 minutes`);
  assert.ok(lastMinute <= 3, `${lastMinute} attempts in the last minute`);
  // back up: it reconnects on the next attempt, within the longest wait
  w.servers.twitch = true;
  const before = w.clock.now; await runFor(w, 31000);
  assert.equal(chat.status.twitch.state, 'live');
  assert.ok(w.opened.filter(([t, x]) => x === 'twitch' && t > before).length <= 2);
  chat.close();
});

test('a dropped connection comes back, and after a steady spell drops are retried quickly again', async () => {
  const w = world();
  const chat = w.W.chat({ kick: 'gridrunner', env: w.env }, () => {});
  await runFor(w, 1000);
  for (let i = 0; i < 3; i++) { [...w.sockets][0].drop(); await runFor(w, 40000); assert.equal(chat.status.kick.state, 'live', `drop ${i + 1}`); }
  const t = w.clock.now; [...w.sockets][0].drop(); await runFor(w, 1500);
  assert.equal(chat.status.kick.state, 'live', 'after a steady spell the first retry is quick again');
  assert.ok(w.clock.now - t < 2000);
  chat.close();
});

test('an unknown Kick channel shows an error and is looked up again once a minute, not in a loop', async () => {
  const w = world(); w.setChatroomOk(false);
  const chat = w.W.chat({ kick: 'nobody', env: w.env }, () => {});
  await runFor(w, 5 * 60000 + 1000);
  assert.equal(chat.status.kick.state, 'error');
  assert.ok(w.lookups() >= 5 && w.lookups() <= 7, `${w.lookups()} lookups in 5 minutes`);
  assert.equal(w.opened.length, 0, 'no socket without a chatroom');
  w.setChatroomOk(true); await runFor(w, 61000);
  assert.equal(chat.status.kick.state, 'live');
  chat.close();
});

test('a chatroom id in the link skips the lookup', async () => {
  const w = world();
  const chat = w.W.chat({ kick: 'gridrunner', kickId: 67706967, env: w.env }, () => {});
  await runFor(w, 1000);
  assert.equal(w.lookups(), 0);
  assert.ok([...w.sockets][0].sent.some((d) => d.includes('chatrooms.67706967.v2')));
  chat.close();
});

test('closing stops everything: no sockets, no timers left', async () => {
  const w = world(); w.servers.kick = false;
  const chat = w.W.chat({ twitch: 'gridrunner', kick: 'gridrunner', env: w.env }, () => {});
  await runFor(w, 20000);
  chat.close();
  const r = w.clock.run({ maxSteps: 1000 });
  assert.ok(r.drained && !r.runaway, 'timers still running after close');
  assert.equal(w.sockets.size, 0);
});

test('no channels, no connections', () => {
  const w = world();
  const chat = w.W.chat({ twitch: '', kick: '  ', env: w.env }, () => {});
  assert.deepEqual([...chat.platforms], []);
  assert.equal(w.clock.pending, 0);
});

test('a connection that goes silent without closing (Wi-Fi drop, laptop sleep) is noticed and replaced', async () => {
  const w = world();
  const chat = w.W.chat({ twitch: 'gridrunner', kick: 'gridrunner', env: w.env }, () => {});
  await runFor(w, 5 * 60000);
  assert.equal(w.opened.length, 2, 'a healthy connection is left alone for minutes (pings keep it alive)');
  for (const sock of w.sockets) sock.silent = true;                     // both go dead, but never close
  await runFor(w, w.W.chat.SILENT + 30000);
  assert.equal(w.opened.length, 4, 'each dead connection was replaced once');
  assert.deepEqual(JSON.parse(JSON.stringify(chat.status)), { twitch: { state: 'live' }, kick: { state: 'live' } });
  chat.close();
});

test('Twitch saying it is about to restart (RECONNECT) reconnects straight away', async () => {
  const w = world();
  const chat = w.W.chat({ twitch: 'gridrunner', env: w.env }, () => {});
  await runFor(w, 1000);
  const [sock] = [...w.sockets];
  sock.recv(':tmi.twitch.tv RECONNECT');
  await runFor(w, 3000);
  assert.equal(w.opened.length, 2);
  assert.equal(chat.status.twitch.state, 'live');
  chat.close();
});
