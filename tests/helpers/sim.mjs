// A simulated browser for the OBS scripts, in Node, on a virtual clock: several pages sharing one browser profile
// (localStorage, BroadcastChannel), fake WebSockets, and fake veadotube / OBS servers. Deterministic (seeded), and
// fast: minutes of virtual time run in milliseconds.
//
// Why simulate: OBS runs every browser source and the dock in one Chromium profile, and the timing between pages
// (a storage event arriving while the page's own write is still in flight) decides whether switches settle or
// bounce. A real browser rarely hits those orderings on demand; this model hits them on purpose.
//
// localStorage follows Chromium's CachedStorageArea (third_party/blink/renderer/modules/storage/cached_storage_area.cc):
// each page keeps its own copy of the values; a write changes that copy at once and goes to the storage service;
// the service tells every page (the writer's own copy is an acknowledgement). A change from another page arriving
// while this page's own write to that key is unacknowledged does NOT change the page's copy, but the page still gets
// the storage event. Messages on one pipe arrive in order (FIFO); only the delays are random.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const read = (rel) => readFileSync(ROOT + rel, 'utf8');
// a file as it was at a commit (for proving a test fails on the code before a fix); null if git can't say
export const readAt = (rev, rel) => { try { return execFileSync('git', ['show', `${rev}:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };

// ---- seeded randomness (mulberry32) --------------------------------------------------------------------
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = (xs) => xs[Math.floor(next() * xs.length)];
  return next;
}

// ---- virtual clock ---------------------------------------------------------------------------------------
export class Clock {
  constructor() { this.now = 0; this.q = []; this.seq = 0; this.steps = 0; this.ids = 0; this.live = new Map(); }
  at(delay, fn, label = '') {
    const t = { when: this.now + Math.max(0, delay || 0), seq: this.seq++, fn, label, id: ++this.ids };
    let i = this.q.length; while (i > 0 && (this.q[i - 1].when > t.when || (this.q[i - 1].when === t.when && this.q[i - 1].seq > t.seq))) i--;
    this.q.splice(i, 0, t); this.live.set(t.id, t); return t.id;
  }
  cancel(id) { const t = this.live.get(id); if (!t) return; this.live.delete(id); const i = this.q.indexOf(t); if (i >= 0) this.q.splice(i, 1); }
  get pending() { return this.q.length; }
  // Run until nothing is left, virtual time passes `until`, or `maxSteps` events have run (a runaway: returns
  // { drained: false, runaway: true } instead of spinning for ever).
  run({ until = Infinity, maxSteps = 50000 } = {}) {
    let n = 0;
    while (this.q.length && this.q[0].when <= until) {
      if (n++ >= maxSteps) return { drained: false, runaway: true, steps: n, now: this.now };
      const t = this.q.shift(); this.live.delete(t.id); this.now = t.when; this.steps++; t.fn();
    }
    if (until !== Infinity && until > this.now) this.now = until;
    return { drained: !this.q.length, runaway: false, steps: n, now: this.now };
  }
  // a FIFO pipe: each message arrives after a random delay, never before the one sent ahead of it
  pipe(rand, [lo, hi]) { let last = 0; return (fn, label) => { const when = Math.max(last, this.now + lo + rand() * (hi - lo)); last = when; return this.at(when - this.now, fn, label); }; }
}

// ---- one browser profile: shared localStorage and BroadcastChannel ------------------------------------------
export class Profile {
  constructor(clock, rand, { delay = [0, 12] } = {}) {
    this.clock = clock; this.rand = rand; this.delay = delay; this.store = new Map(); this.pages = []; this.channels = [];
    this.toService = new Map(); this.log = [];
  }
  addPage(page) {
    page.cache = new Map(this.store); page.inflight = new Map();
    page.fromService = this.clock.pipe(this.rand, this.delay); this.toService.set(page, this.clock.pipe(this.rand, this.delay));
    this.pages.push(page);
  }
  setItem(page, k, v) {
    v = String(v);
    if (page.cache.get(k) === v) return;                        // unchanged: no write, no event
    const old = page.cache.has(k) ? page.cache.get(k) : null;
    page.cache.set(k, v); page.inflight.set(k, (page.inflight.get(k) || 0) + 1); page.stats.writes++;
    this.log.push([this.clock.now, page.name, k, v]);
    this.toService.get(page)(() => {
      this.store.set(k, v);
      for (const p of this.pages) {
        if (p.closed) continue;
        p.fromService(() => {
          if (p === page) { p.inflight.set(k, p.inflight.get(k) - 1); return; }   // the writer's acknowledgement
          if (!(p.inflight.get(k) > 0)) p.cache.set(k, v);        // own write in flight: keep own value...
          p.fire('storage', { key: k, oldValue: old, newValue: v }); // ...but the event still arrives
        }, `storage ${k}=${v} → ${p.name}`);
      }
    }, `write ${k}=${v} from ${page.name}`);
  }
  channel(page, name) {
    const prof = this, pipes = new Map();
    const ch = {
      name, page, onmessage: null, closed: false,
      postMessage(data) {
        page.stats.posts++;
        for (const other of prof.channels) {
          if (other === ch || other.name !== name || other.closed || other.page.closed) continue;
          if (!pipes.has(other)) pipes.set(other, prof.clock.pipe(prof.rand, prof.delay));
          pipes.get(other)(() => other.onmessage && other.onmessage({ data }), `channel ${name}:${data} → ${other.page.name}`);
        }
      },
      close() { ch.closed = true; },
    };
    this.channels.push(ch);
    return ch;
  }
}

// ---- fake network: WebSocket servers by host:port ------------------------------------------------------------
export class Network {
  constructor(clock, rand, { delay = [1, 8] } = {}) { this.clock = clock; this.rand = rand; this.delay = delay; this.servers = new Map(); }
  listen(addr, onConnection) { this.servers.set(addr, onConnection); }
  down(addr) { this.servers.delete(addr); }
  // the WebSocket class a page sees
  socketClass(page) {
    const net = this;
    return class FakeWebSocket {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      constructor(url) {
        this.url = url; this.readyState = 0; this.onopen = this.onmessage = this.onclose = this.onerror = null;
        const addr = /^wss?:\/\/([^/?#]+)/.exec(url)[1];
        const up = net.clock.pipe(net.rand, net.delay), down = net.clock.pipe(net.rand, net.delay);
        page.stats.sockets++; page.sockets.add(this);
        this._send = null;
        net.clock.at(net.delay[0], () => {
          const onConnection = net.servers.get(addr);
          if (!onConnection || page.closed) { this.readyState = 3; this.onerror && this.onerror({}); this._closed(1006); return; }
          const peer = { url, page, closed: false, onmessage: null, onclose: null,
            send: (text) => { if (!peer.closed) down(() => { if (this.readyState === 1) this.onmessage && this.onmessage({ data: text }); }, `ws → ${page.name}`); },
            close: (code = 1000) => { if (peer.closed) return; peer.closed = true; down(() => this._closed(code)); } };
          this._peer = peer;
          this._send = (text) => up(() => { if (!peer.closed) peer.onmessage && peer.onmessage(text); }, `ws ← ${page.name}`);
          this.readyState = 1; this.onopen && this.onopen({});
          onConnection(peer);
        }, `connect ${url}`);
      }
      send(text) { if (this.readyState !== 1) throw new Error('InvalidStateError: not open'); page.stats.sends++; page.sent.push(text); this._send(text); }
      close() { if (this.readyState >= 2) return; this.readyState = 2; const p = this._peer; if (p && !p.closed) { p.closed = true; p.onclose && p.onclose(); } this._closed(1000); }
      _closed(code) { if (this.readyState === 3 && this._didClose) return; this._didClose = true; this.readyState = 3; page.sockets.delete(this); this.onclose && this.onclose({ code }); }
    };
  }
}

// ---- fake veadotube mini (its stateEvents API: list, peek, listen, set) ---------------------------------------
// opts: confirm = [lo, hi] ms before a set is announced (null: never; in order, like veadotube, unless
// outOfOrder), duplicate = announce twice
export function fakeVeado(net, addr = '127.0.0.1:54765', { states = ['cyan', 'animated', 'yellow', 'red', 'princess', 'blobfish'], confirm = [150, 400], duplicate = false, outOfOrder = false, start = 'cyan' } = {}) {
  const v = { current: start, sets: [], peers: new Set(), states: states.map((n) => ({ id: n, name: n })) };
  const later = confirm && (outOfOrder ? (fn, label) => net.clock.at(confirm[0] + net.rand() * (confirm[1] - confirm[0]), fn, label) : net.clock.pipe(net.rand, confirm));
  const say = (peer, payload) => peer.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload }));
  v.change = (state) => { v.current = state; for (const p of v.peers) if (!p.closed) say(p, { event: 'change', state }); };
  // (on the real network, listening is a promise of the address it got: '127.0.0.1:0' picks a free port)
  v.listening = net.listen(addr, (peer) => {
    v.peers.add(peer);
    peer.onclose = () => v.peers.delete(peer);
    peer.onmessage = (text) => {
      const m = JSON.parse(text.slice(text.indexOf(':') + 1)).payload;
      if (m.event === 'list') say(peer, { event: 'list', states: v.states });
      if (m.event === 'peek') say(peer, { event: 'peek', state: v.current });
      if (m.event === 'set') {
        v.sets.push([net.clock.now, m.state]);
        if (later) later(() => { v.change(m.state); if (duplicate) v.change(m.state); }, 'veado confirms ' + m.state);
      }
    };
  });
  v.dropAll = () => { for (const p of v.peers) p.close(1006); v.peers.clear(); };
  return v;
}

// ---- fake OBS WebSocket (v5): hello/identify without a password, requests, CustomEvent broadcast --------------
export function fakeObs(net, addr = '127.0.0.1:4455', { handlers = {} } = {}) {
  const o = { calls: [], peers: new Set() };
  o.broadcast = (eventType, eventData) => { for (const p of o.peers) if (p.identified && !p.closed) p.send(JSON.stringify({ op: 5, d: { eventType, eventIntent: 1, eventData } })); };
  o.listening = net.listen(addr, (peer) => {
    o.peers.add(peer); peer.onclose = () => o.peers.delete(peer);
    peer.send(JSON.stringify({ op: 0, d: { obsWebSocketVersion: '5.5.0', rpcVersion: 1 } }));
    peer.onmessage = (text) => {
      const m = JSON.parse(text);
      if (m.op === 1) { peer.identified = true; peer.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } })); return; }
      if (m.op !== 6) return;
      const { requestType, requestId, requestData } = m.d;
      o.calls.push([net.clock.now, requestType, requestData]);
      let responseData = {};
      if (requestType === 'BroadcastCustomEvent') o.broadcast('CustomEvent', requestData.eventData);
      else if (handlers[requestType]) responseData = handlers[requestType](requestData) || {};
      peer.send(JSON.stringify({ op: 7, d: { requestType, requestId, requestStatus: { result: true, code: 100 }, responseData } }));
    };
  });
  return o;
}

// ---- a page: a vm context with just enough browser for the shared OBS scripts ---------------------------------
// scripts: [[filename, source], …] run in order. html: attributes for <html> (e.g. { 'data-cycle': '' }).
export class Page {
  constructor({ name, url, profile, net, clock, scripts = [], html = {}, globals = {} }) {
    Object.assign(this, { name, profile, clock, closed: false });
    this.stats = { writes: 0, posts: 0, sockets: 0, sends: 0, changes: 0, applied: [] };
    this.sent = []; this.sockets = new Set(); this.listeners = new Map(); this.timers = new Set();
    profile.addPage(this);
    const page = this, loc = new URL(url);
    const attrs = new Map(Object.entries(html));
    const root = {
      dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } },
      hasAttribute: (n) => attrs.has(n), getAttribute: (n) => (attrs.has(n) ? attrs.get(n) : null),
      classList: { set: new Set(), add(...c) { c.forEach((x) => this.set.add(x)); }, remove(...c) { c.forEach((x) => this.set.delete(x)); }, contains(c) { return this.set.has(c); }, toggle(c, on) { on = on ?? !this.set.has(c); on ? this.set.add(c) : this.set.delete(c); return on; } },
    };
    this.root = root;
    const timer = (repeat) => (fn, ms = 0, ...args) => {
      let id;
      const tick = () => { if (page.closed) return; if (repeat) { id = clock.at(ms, tick, `${page.name} interval`); page.timers.add(id); } else page.timers.delete(id); fn(...args); };
      id = clock.at(ms, tick, `${page.name} timer ${ms}ms`); page.timers.add(id);
      const handle = { id: () => id }; return handle;
    };
    const clear = (h) => { if (!h || !h.id) return; const id = h.id(); clock.cancel(id); page.timers.delete(id); };
    const storage = {
      getItem: (k) => (page.cache.has(k) ? page.cache.get(k) : null),
      setItem: (k, v) => profile.setItem(page, k, v),
      removeItem: (k) => { page.cache.delete(k); },
    };
    const ctx = {
      console, URL, URLSearchParams, TextEncoder, btoa, atob, JSON, Math, Date: class extends Date { static now() { return clock.now; } },
      crypto: globalThis.crypto,
      location: { href: loc.href, search: loc.search, hash: loc.hash, protocol: loc.protocol, pathname: loc.pathname },
      document: { documentElement: root, querySelector: () => null, querySelectorAll: () => [], hidden: false, addEventListener() {} },
      localStorage: storage,
      BroadcastChannel: function (name) { return profile.channel(page, name); },
      WebSocket: net.socketClass(page),
      setTimeout: timer(false), setInterval: timer(true), clearTimeout: clear, clearInterval: clear,
      requestAnimationFrame: (fn) => timer(false)(() => fn(clock.now), 16), cancelAnimationFrame: clear,
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      addEventListener: (type, fn) => { if (!page.listeners.has(type)) page.listeners.set(type, new Set()); page.listeners.get(type).add(fn); },
      removeEventListener: (type, fn) => page.listeners.get(type)?.delete(fn),
      ...globals,
    };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    this.window = vm.createContext(ctx);
    for (const [file, src] of scripts) vm.runInContext(src, this.window, { filename: file });
    // every form this page applies (theme.js onChange), in order
    if (this.window.TGL) this.window.TGL.onChange((f) => { page.stats.changes++; page.stats.applied.push(f); });
  }
  fire(type, event) { if (this.closed) return; for (const fn of this.listeners.get(type) || []) fn(event); }
  close() { this.closed = true; for (const id of this.timers) this.clock.cancel(id); for (const s of [...this.sockets]) s.close(); }
  get TGL() { return this.window.TGL; }
}

// the shared OBS scripts, read once
export const src = (rel) => [rel, read(rel)];
export const THEME = () => src('public/obs/shared/theme.js');
