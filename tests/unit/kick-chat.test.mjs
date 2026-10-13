// Keeping Kick chat working when Kick changes things: netlify/functions/kick-chat.mjs (GET /api/kick-chat, the key the
// widgets ask for when Pusher refuses theirs) and scripts/check-kick.mjs (the daily check). Kick and Pusher are fakes:
// no test here touches the network. Answers are the shapes Kick gave on 2026-10-13.
import test from 'node:test';
import assert from 'node:assert/strict';
import fn, { realtime, pusherFrom, REALTIME_URL } from '../../netlify/functions/kick-chat.mjs';
import { check, keyIn, withKey } from '../../scripts/check-kick.mjs';

const PUSHER = { credentials: { app_key: '34bf7a0ff419a2a775b9', cluster: 'us2' }, provider: 'pusher' };
const CENTRIFUGO = { credentials: { url: 'wss://realtime.us-west-2.platform.kick.com/connection/websocket' }, provider: 'centrifugo' };
const answer = (...connections) => new Response(JSON.stringify({ data: { connections, mode: 'websocket' }, message: 'success' }));

// Kick's realtime endpoint, like the real one: it answers with the first provider it supports from the client's list,
// in its own order of preference (Centrifugo first), and 400 if it supports none
function kick({ offers = ['centrifugo', 'pusher'], pusher = PUSHER, status = 200 } = {}) {
  const seen = [];
  const f = async (url, init = {}) => {
    if (String(url).startsWith('https://kick.com/api/v2/channels/')) return new Response(JSON.stringify({ chatroom: { id: 715 } }));
    assert.equal(url, REALTIME_URL); assert.equal(init.method, 'POST');
    const asked = JSON.parse(init.body).capabilities.accepted_providers.map((p) => p.provider);
    seen.push(asked);
    if (status !== 200) return new Response('{}', { status });
    const pick = offers.find((p) => asked.includes(p));
    if (!pick) return new Response('{"data":{"type":"Bad Request"}}', { status: 400 });
    return answer(pick === 'pusher' ? pusher : CENTRIFUGO);
  };
  f.seen = seen;
  return f;
}
// Pusher: takes `key`, lets anyone subscribe
const pusherServer = (key) => class {
  constructor(url) {
    this.url = url;
    setTimeout(() => {
      if (!url.includes(`/app/${key}?`)) { this.onmessage({ data: JSON.stringify({ event: 'pusher:error', data: { code: 4001, message: 'App key not in this cluster' } }) }); return this.onclose({ code: 4001 }); }
      this.onmessage({ data: '{"event":"pusher:connection_established","data":"{}"}' });
    }, 1);
  }
  send(d) { if (d.includes('pusher:subscribe') && d.includes('chatrooms.715.v2')) setTimeout(() => this.onmessage({ data: '{"event":"pusher_internal:subscription_succeeded","data":"{}"}' }), 1); }
  close() {}
};

test('realtime(): asks Kick like its own site does, and reads each offer', async () => {
  const f = kick();
  assert.deepEqual(await realtime(['pusher'], f), [{ provider: 'pusher', key: '34bf7a0ff419a2a775b9', cluster: 'us2' }]);
  assert.deepEqual(await realtime(['pusher', 'centrifugo'], f), [{ provider: 'centrifugo', url: CENTRIFUGO.credentials.url }]);
  assert.deepEqual(f.seen, [['pusher'], ['pusher', 'centrifugo']]);
  await assert.rejects(realtime(['pusher'], kick({ offers: ['centrifugo'] })), (e) => e.status === 400, 'none supported: 400');
  await assert.rejects(realtime(['pusher'], kick({ status: 403 })), /403/);
  await assert.rejects(realtime(['pusher'], async () => new Response('{"data":{}}')), /no connections/);
});

test('pusherFrom(): only a real-looking key and cluster', () => {
  assert.deepEqual(pusherFrom([{ provider: 'pusher', key: '34bf7a0ff419a2a775b9', cluster: 'us2' }]), { key: '34bf7a0ff419a2a775b9', cluster: 'us2' });
  assert.equal(pusherFrom([{ provider: 'centrifugo', url: 'wss://x' }]), null);
  assert.equal(pusherFrom([{ provider: 'pusher', key: '"><script>', cluster: 'us2' }]), null);
  assert.equal(pusherFrom([{ provider: 'pusher', key: '34bf7a0ff419a2a775b9', cluster: 'evil.example/x' }]), null);
});

test('GET /api/kick-chat: the key for any site to read, cached at the CDN; an error when Kick has none or fails', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = kick();
    let r = await fn();
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { key: '34bf7a0ff419a2a775b9', cluster: 'us2' });
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    assert.match(r.headers.get('netlify-cdn-cache-control'), /max-age=600/);
    globalThis.fetch = kick({ offers: ['centrifugo'] });
    r = await fn(); assert.equal(r.status, 502);
    globalThis.fetch = async () => { throw new Error('offline'); };
    r = await fn(); assert.equal(r.status, 502); assert.equal(r.headers.get('cache-control'), 'no-store', 'a failure is not cached');
  } finally { globalThis.fetch = real; }
});

const FILE = "  const KEY = '32cbd69e4b950bf97679', CLUSTER = 'us2';\n";
const files = (text = FILE) => { const box = { text, writes: 0 }; return { box, read: () => box.text, write: (t) => { box.text = t; box.writes++; } }; };

test('the check reads and rewrites the KEY line in kick.js', () => {
  assert.deepEqual(keyIn(FILE), { key: '32cbd69e4b950bf97679', cluster: 'us2' });
  assert.equal(withKey(FILE, { key: '34bf7a0ff419a2a775b9', cluster: 'eu1' }), "  const KEY = '34bf7a0ff419a2a775b9', CLUSTER = 'eu1';\n");
  assert.throws(() => keyIn('nothing here'), /KEY line/);
  assert.doesNotThrow(() => keyIn(require_('public/widgets/lib/platforms/kick.js')), 'the real kick.js has the line the check rewrites');
});
import { readFileSync } from 'node:fs';
function require_(p) { return readFileSync(new URL('../../' + p, import.meta.url), 'utf8'); }

test('daily check: same key and it subscribes → ok, nothing written', async () => {
  const fs = files(withKey(FILE, { key: '34bf7a0ff419a2a775b9', cluster: 'us2' }));
  const r = await check({ fetch_: kick(), WS: pusherServer('34bf7a0ff419a2a775b9'), ...fs });
  assert.equal(r.status, 'ok', r.summary); assert.equal(fs.box.writes, 0);
  assert.match(r.summary, /own site uses centrifugo/);
});

test('daily check: Kick has a new key that works → key-changed, kick.js updated', async () => {
  const fs = files();
  const r = await check({ fetch_: kick(), WS: pusherServer('34bf7a0ff419a2a775b9'), ...fs });
  assert.equal(r.status, 'key-changed', r.summary);
  assert.deepEqual(keyIn(fs.box.text), { key: '34bf7a0ff419a2a775b9', cluster: 'us2' });
});

test('daily check: Kick stops offering Pusher → no-pusher (a person is needed), nothing written', async () => {
  const fs = files();
  const r = await check({ fetch_: kick({ offers: ['centrifugo'] }), WS: pusherServer('x'), ...fs });
  assert.equal(r.status, 'no-pusher'); assert.match(r.summary, /Centrifugo/); assert.equal(fs.box.writes, 0);
});

test('daily check: the offered key is refused → broken; Kick unreachable → unreachable', async () => {
  const fs = files();
  let r = await check({ fetch_: kick(), WS: pusherServer('someotherkey00000000'), ...fs });
  assert.equal(r.status, 'broken'); assert.match(r.summary, /4001/); assert.equal(fs.box.writes, 0);
  r = await check({ fetch_: kick({ status: 403 }), WS: pusherServer('x'), ...fs });
  assert.equal(r.status, 'unreachable'); assert.match(r.summary, /403/);
});
