// obsws.js, the dock's OBS WebSocket client, on the simulated network: reconnecting stays paced and single, and a
// request OBS never answers fails after 10 s instead of waiting for ever.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Clock, Profile, Network, Page, fakeObs, rng, src } from '../helpers/sim.mjs';

function world() {
  const clock = new Clock(), rand = rng(7), profile = new Profile(clock, rand), net = new Network(clock, rand);
  const page = new Page({ name: 'dock', url: 'https://x/obs/control', profile, net, clock, scripts: [src('public/obs/shared/obsws.js')] });
  return { clock, net, page, W: page.window };
}

test('connects, answers requests, and hears events', async () => {
  const { clock, net, page, W } = world();
  const obs = fakeObs(net, '127.0.0.1:4455', { handlers: { GetVersion: () => ({ obsVersion: '31.0.0' }) } });
  const states = [], events = [];
  const c = W.TGLObs.connect({ port: 4455, onStatus: (s) => states.push(s.state), onEvent: (t) => events.push(t) });
  clock.run({ until: 100 });
  assert.equal(states.at(-1), 'connected');
  const p = c.call('GetVersion'); clock.run({ until: 200 });
  assert.equal((await p).obsVersion, '31.0.0');
  obs.broadcast('SceneItemCreated', {}); clock.run({ until: 300 });
  assert.deepEqual(events, ['SceneItemCreated']);
  page.close();
});

test('OBS closed: one retry every 5 s, one socket at a time, and it connects when OBS starts', () => {
  const { clock, net, page, W } = world();
  const states = [];
  W.TGLObs.connect({ port: 4455, onStatus: (s) => states.push(s.state) });
  clock.run({ until: 60000 });
  assert.ok(page.stats.sockets >= 11 && page.stats.sockets <= 13, `${page.stats.sockets} attempts in 60 s`);
  assert.ok(page.sockets.size <= 1);
  fakeObs(net);
  clock.run({ until: 66000 });
  assert.equal(states.at(-1), 'connected');
  page.close();
});

test('wrong password (4009): waits 15 s between tries instead of hammering OBS', () => {
  const { clock, net, page, W } = world();
  net.listen('127.0.0.1:4455', (peer) => { peer.send(JSON.stringify({ op: 0, d: { rpcVersion: 1 } })); peer.onmessage = () => peer.close(4009); });
  const states = [];
  W.TGLObs.connect({ port: 4455, password: 'nope', onStatus: (s) => states.push(s.state) });
  clock.run({ until: 60000 });
  assert.ok(states.includes('wrong password'));
  assert.ok(page.stats.sockets <= 5, `${page.stats.sockets} attempts in 60 s`);
  page.close();
});

test('a request OBS never answers fails after 10 s; one sent while disconnected fails at once', async () => {
  const { clock, net, page, W } = world();
  net.listen('127.0.0.1:4455', (peer) => { peer.send(JSON.stringify({ op: 0, d: { rpcVersion: 1 } })); peer.onmessage = (t) => { if (JSON.parse(t).op === 1) peer.send(JSON.stringify({ op: 2, d: {} })); }; });
  const c = W.TGLObs.connect({ port: 4455 });
  await assert.rejects(() => W.TGLObs.connect({ port: 9 }).call('GetVersion'), /not connected/);
  clock.run({ until: 100 });
  const p = c.call('GetSceneList');
  clock.run({ until: 10200 });
  await assert.rejects(p, /no reply/);
  page.close();
});
