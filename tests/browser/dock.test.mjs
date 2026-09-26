// The control dock (public/obs/control.html) in headless Chrome, against a fake OBS with scenes (obs-model.mjs) and a
// fake veadotube, both on free local ports: the dock never sees a real OBS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { RealNet } from '../helpers/real-net.mjs';
import { obsModel } from '../helpers/obs-model.mjs';
import { fakeVeado } from '../helpers/sim.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site, net, obs, veado, obsAddr, veadoAddr;
const overlay = (path) => ({ name: path.split('?')[0] + ' overlay', settings: { url: `https://www.trongateslegacy.com/obs/${path}`, width: 1920, height: 1080, fps_custom: true, fps: 30 } });

test.before(async () => {
  chrome = await launch(); site = await siteServer(); net = new RealNet(5);
  obs = obsModel(net, '127.0.0.1:0', {
    'Just chatting': [overlay('chatting'), { name: 'veadotube', kind: 'spout_capture', settings: {}, transform: { sourceWidth: 1000, sourceHeight: 1000 } }],
    'Be right back': [overlay('brb')],
    'Game': [{ name: 'Game capture', kind: 'game_capture', settings: {}, transform: { positionX: 300, positionY: 200, sourceWidth: 2560, sourceHeight: 1440 } },
      { ...overlay('game?layout=window'), settings: { ...overlay('game?layout=window').settings, fps_custom: false }, transform: { positionX: 40 } }],
  });
  veado = fakeVeado(net, '127.0.0.1:0', { confirm: [80, 160] });
  [obsAddr, veadoAddr] = await Promise.all([obs.listening, veado.listening]);
});
test.after(async () => { await chrome?.close(); await site?.close(); net?.close(); });

const openDock = async () => {
  const tab = await chrome.open(`${site.origin}/obs/control?obs=${obsAddr.split(':')[1]}&veado=${veadoAddr}`, { width: 380, height: 900 });
  await tab.until(`document.querySelector('.tgl-panel .pill') && [...document.querySelectorAll('.tgl-panel .pill')].every((p) => p.querySelector('.dot.ok') || /music/.test(p.textContent))`, 8000, 'OBS and veadotube connected');
  return tab;
};
const footer = (tab) => tab.eval(`document.querySelector('.tgl-panel .ft span').textContent`);

test('connects to OBS and veadotube, and finds the three Trongates overlays', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="scenes"]');
  await tab.until(`document.querySelectorAll('.tgl-panel select[data-row]').length === 3`, 5000, 'three overlay rows');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('a flood of OBS events (60 in a second) causes a couple of rescans, not 60', async () => {
  const tab = await openDock();
  await sleep(1500);
  const before = obs.count('GetSceneList');
  for (let i = 0; i < 60; i++) { obs.broadcast('SceneItemCreated', {}); await sleep(16); }
  await sleep(2500);
  const rescans = obs.count('GetSceneList') - before;
  assert.ok(rescans >= 1 && rescans <= 3, `${rescans} rescans`);
  await tab.close();
});

test('Review & apply: the overlays get their options once, then OBS matches and nothing more is sent', async () => {
  const tab = await openDock();
  await tab.until(`/waiting/.test(document.querySelector('.tgl-panel .ft span').textContent)`, 5000, 'changes waiting (the overlays have no obs= yet)');
  await tab.click('[data-act="review"]');
  await tab.until(`document.querySelector('[data-act="apply"]:not([disabled])')`);
  await tab.click('[data-act="apply"]');
  await tab.until(`/OBS matches/.test(document.querySelector('.tgl-panel .ft span')?.textContent || '')`, 8000, 'OBS matches these settings');
  const sets = obs.count('SetInputSettings');
  for (const inp of obs.inputs.values()) if (inp.kind === 'browser_source') assert.match(inp.settings.url, new RegExp(`obs=${obsAddr.split(':')[1]}`), inp.name);
  await sleep(2500);                               // its own InputSettingsChanged events must not set off more changes
  assert.equal(obs.count('SetInputSettings'), sets, 'the dock kept changing OBS after applying');
  assert.match(await footer(tab), /OBS matches/);
  await tab.close();
});

test('Tidy layout fixes what the checks find, and afterwards finds nothing', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="layout"]');
  await tab.until(`document.querySelector('[data-act="tidy"]:not([disabled])')`, 5000, 'Tidy has something to fix');
  await tab.click('[data-act="tidy"]');
  await tab.until(`document.querySelector('[data-act="apply"]:not([disabled])')`);
  await tab.click('[data-act="apply"]');
  await tab.until(`!document.querySelector('.review') && document.querySelector('[data-act="tidy"][disabled]')`, 8000, 'nothing left to tidy');
  const game = obs.scenes.find((s) => s.name === 'Game').items.find((i) => /overlay/.test(i.input.name));
  assert.equal(game.transform.positionX, 0); assert.equal(game.input.settings.fps_custom, true);
  await tab.close();
});

test('colour buttons: one veadotube switch per press; the scenes are told once, when the last press is confirmed', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="live"]');
  await tab.until(`document.querySelector('.tgl-panel button[data-form="princess"]')`);
  const sets = veado.sets.length, events = obs.count('BroadcastCustomEvent');
  for (const f of ['princess', 'blobfish', 'yellow', 'blobfish']) { await tab.click(`.tgl-panel button[data-form="${f}"]`); await sleep(20); }
  await tab.until(`document.querySelector('.tgl-panel button[data-form="blobfish"]').getAttribute('aria-pressed') === 'true'`, 5000, 'Blobfish pressed');
  await sleep(600);
  assert.equal(veado.sets.length - sets, 4, 'veadotube switches');
  assert.equal(veado.current, 'blobfish');
  const told = obs.calls.filter((c) => c[1] === 'BroadcastCustomEvent').slice(events);
  assert.equal(told.length, 1, `the scenes were told ${told.length} times`);
  assert.equal(told[0][2].eventData.form, 'blobfish');
  assert.equal(typeof told[0][2].eventData.at, 'number');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
