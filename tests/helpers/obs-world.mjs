// A simulated OBS setup for the loop tests: one browser profile holding the dock and the Trongates scenes, a fake
// veadotube and a fake OBS WebSocket, all on one virtual clock. Runs the real theme.js and dock-colour.js.
import { Clock, Profile, Network, Page, fakeVeado, fakeObs, rng, src, THEME } from './sim.mjs';

const BASE = 'https://www.trongateslegacy.com/obs/';
// the scenes as OBS has them: the ones that follow veadotube connect to it (and to OBS for the dock's buttons);
// the cycling ones don't, but still hear the other pages through the shared profile
export const SCENES = {
  chatting: { q: 'obs=4455' }, game: { q: 'layout=window&obs=4455' }, chatbox: { q: 'obs=4455' }, goal: { q: 'obs=4455' },
  music: { q: 'obs=4455' }, brb: { q: 'obs=4455', cycle: true }, starting: { q: 'obs=4455', cycle: true }, ending: { q: 'obs=4455', cycle: true },
};

export function obsWorld({ seed = 1, theme = THEME(), scenes = Object.keys(SCENES), dock = true, storageDelay = [0, 12], netDelay = [1, 8],
  veado: veadoOpts = {}, settings = {}, sceneQuery = '' } = {}) {
  const clock = new Clock(), rand = rng(seed);
  const profile = new Profile(clock, rand, { delay: storageDelay });
  const net = new Network(clock, rand, { delay: netDelay });
  const veado = fakeVeado(net, '127.0.0.1:54765', veadoOpts);
  const obs = fakeObs(net);
  const pages = {};
  for (const name of scenes) {
    const sc = SCENES[name];
    pages[name] = new Page({ name, url: `${BASE}${name}?${[sc.q, sceneQuery].filter(Boolean).join('&')}`, profile, net, clock,
      html: sc.cycle ? { 'data-cycle': '' } : {}, scripts: [theme] });
  }
  let dockApi = null, dockPage = null;
  if (dock) {
    dockPage = new Page({ name: 'dock', url: `${BASE}control?obs=4455`, profile, net, clock, globals: { TGL_NO_AUTOCONNECT: true },
      scripts: [theme, src('public/obs/shared/dock-colour.js')] });
    const s = { veado: { addr: '', switch: true, tron: 'cyan', map: {}, delay: 0, ...(settings.veado || {}) } };
    // the dock's OBS client, as far as colour goes: BroadcastCustomEvent over its own socket
    const W = dockPage.window, obsSock = new W.WebSocket('ws://127.0.0.1:4455');
    let id = 0; const obsClient = { ready: false, call: (requestType, requestData) => { obsSock.send(JSON.stringify({ op: 6, d: { requestType, requestId: 'd' + ++id, requestData } })); return Promise.resolve({}); } };
    obsSock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.op === 0) obsSock.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } })); if (m.op === 2) obsClient.ready = true; };
    dockApi = W.TGLDockColour.create({ TGL: W.TGL, dock: true, settings: () => s, addr: () => '127.0.0.1:54765', obs: () => obsClient });
    dockApi.connect();
    pages.dock = dockPage;
  }
  const all = () => Object.values(pages);
  return {
    clock, rand, profile, net, veado, obs, pages, dock: dockApi,
    // let everything connect and settle
    boot(ms = 500) { return clock.run({ until: clock.now + ms }); },
    forms: () => Object.fromEntries(all().map((p) => [p.name, p.TGL.form])),
    changes: () => Object.fromEntries(all().map((p) => [p.name, p.stats.changes])),
    // what each page applied, as a string of initials (p = princess, b = blobfish, c = cyan…)
    trace: () => all().map((p) => `${p.name}: ${p.stats.applied.map((f) => f[0]).join('')}`).join('\n'),
    close() { all().forEach((p) => p.close()); },
  };
}
