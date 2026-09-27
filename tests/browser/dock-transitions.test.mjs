// The dock's Transitions section (Scenes tab) against a fake OBS with scenes, a Fade and the two Trongates Stingers:
// Review & apply puts the overlay on top of the scenes picked, sets the default and per-scene transitions and the
// Stinger's cut point, and afterwards has nothing left to change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { RealNet } from '../helpers/real-net.mjs';
import { obsModel } from '../helpers/obs-model.mjs';

let chrome, site, net, obs, port;
const overlay = (path) => ({ name: path.split('?')[0] + ' overlay', settings: { url: `https://www.trongateslegacy.com/obs/${path}`, width: 1920, height: 1080, fps_custom: true, fps: 30 } });
test.before(async () => {
  chrome = await launch(); site = await siteServer(); net = new RealNet(4);
  obs = obsModel(net, '127.0.0.1:0', {
    'Just chatting': [overlay('chatting'), { name: 'veadotube', kind: 'spout_capture', settings: {} }],
    'Be right back': [overlay('brb')],
    'Game Captures': [{ name: 'Game capture', kind: 'game_capture', settings: {} }],
  }, { transitions: [{ name: 'Fade', kind: 'fade_transition', settings: {} },
    { name: 'Trongates · Derez', kind: 'obs_stinger_transition', settings: { path: 'C:/Users/x/Documents/trongates-hold.webm', transition_point: 300 } },
    { name: 'Trongates · Shutters', kind: 'obs_stinger_transition', settings: { path: 'C:/Users/x/Documents/trongates-hold.webm', transition_point: 600 } }] });
  port = (await obs.listening).split(':')[1];
});
test.after(async () => { await chrome?.close(); await site?.close(); net?.close(); });

const footer = `document.querySelector('.tgl-panel .ft span')?.textContent || ''`;
const select = (tab, sel, value) => tab.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
async function applyAll(tab) {
  for (let round = 0; round < 3 && /waiting/.test(await tab.eval(footer)); round++) {
    await tab.click('[data-act="review"]');
    await tab.until(`document.querySelector('[data-act="apply"]:not([disabled])')`);
    await tab.click('[data-act="apply"]');
    await tab.until(`!document.querySelector('.review')`, 8000, 'applied');
    await tab.until(`/matches|waiting/.test(${footer})`, 5000);
    await new Promise((r) => setTimeout(r, 900));         // OBS's change events → the dock rescans
  }
}

test('turn transitions on, pick them, apply: OBS gets the overlay on top, the default, the override and the cut point', async () => {
  const tab = await chrome.open(`${site.origin}/obs/control?obs=${port}&veado=127.0.0.1:1`, { width: 380, height: 1400 });
  await tab.until(`document.querySelector('[data-tab="scenes"]')`);
  await tab.click('[data-tab="scenes"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="scenes:tx"]')`, 8000, 'the Transitions sub-tab');
  await tab.click('.tgl-panel [data-sub="scenes:tx"]');
  await tab.until(`document.querySelector('.tgl-panel [data-set="dock.tx.on"]')`, 3000, 'the Transitions section');
  await tab.click('.tgl-panel [data-set="dock.tx.on"]');
  await tab.until(`document.querySelector('.tgl-panel select[data-tx-scene]')`, 3000, 'the transition settings');
  assert.match(await tab.eval(`document.querySelector('.tgl-panel').textContent`), /✓ Trongates · Derez[\s\S]*✓ Trongates · Shutters/);
  // per scene: only the scenes with a Trongates overlay (not Game Captures)
  assert.deepEqual(await tab.eval(`[...document.querySelectorAll('.tgl-panel select[data-tx-scene]')].map((s) => s.dataset.txScene)`), ['Just chatting', 'Be right back']);
  await select(tab, '.tgl-panel select[data-set="dock.tx.default"]', 'derez');
  await tab.until(`document.querySelector('.tgl-panel select[data-tx-scene="Be right back"]')`);
  await select(tab, '.tgl-panel select[data-tx-scene="Be right back"]', 'shutters');
  // the overlay: in the Trongates scenes by default; add Game Captures too
  assert.deepEqual(await tab.eval(`[...document.querySelectorAll('.tgl-panel [data-tx-overlay]')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed'))`),
    ['Just chatting:true', 'Be right back:true', 'Game Captures:false']);
  await tab.eval(`[...document.querySelectorAll('.tgl-panel [data-tx-overlay]')].find((b) => b.textContent === 'Game Captures').click(); 1`);
  await tab.until(`/waiting/.test(${footer})`, 3000);
  await applyAll(tab);
  assert.match(await tab.eval(footer), /matches/, 'nothing left waiting');

  assert.equal(obs.transition, 'Trongates · Derez');
  assert.equal(obs.overrides[obs.sceneNamed('Be right back').uuid], 'Trongates · Shutters');
  assert.equal(obs.overrides[obs.sceneNamed('Just chatting').uuid] ?? null, null, 'left as it was');
  assert.equal(obs.transitions.find((t) => t.name === 'Trongates · Derez').settings.transition_point, 600);
  const ov = [...obs.inputs.values()].filter((i) => i.settings.tgl_managed === 'widget:transition');
  assert.equal(ov.length, 1, 'one overlay source, shared by the scenes');
  assert.match(ov[0].settings.url, new RegExp(`/obs/transition\\?.*obs=${port}`));
  for (const name of ['Just chatting', 'Be right back', 'Game Captures']) {
    const items = obs.sceneNamed(name).items;
    assert.equal(items.at(-1).input, ov[0], `${name}: the overlay is on top`);
  }
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('taking a scene off the list removes the overlay from it; a source added above it later gets it moved back on top', async () => {
  const tab = await chrome.open(`${site.origin}/obs/control?obs=${port}&veado=127.0.0.1:1`, { width: 380, height: 1400 });
  await tab.click('[data-tab="scenes"]');
  await tab.until(`document.querySelector('.tgl-panel [data-tx-overlay]')`, 8000, 'the Transitions sub-tab, remembered');
  await tab.eval(`[...document.querySelectorAll('.tgl-panel [data-tx-overlay]')].find((b) => b.textContent === 'Game Captures').click(); 1`);
  // meanwhile a new source lands on top of Be right back
  const brb = obs.sceneNamed('Be right back');
  brb.items.push({ sceneItemId: 999, input: { uuid: 'in-new', name: 'Alert', kind: 'image_source', settings: {} }, transform: {}, locked: false });
  obs.broadcast('SceneItemCreated', {});
  await tab.until(`/waiting/.test(${footer})`, 5000);
  await applyAll(tab);
  const ov = [...obs.inputs.values()].find((i) => i.settings.tgl_managed === 'widget:transition');
  assert.ok(!obs.sceneNamed('Game Captures').items.some((i) => i.input === ov), 'removed from Game Captures');
  assert.equal(brb.items.at(-1).input, ov, 'back on top of Be right back');
  assert.match(await tab.eval(footer), /matches/);
  await tab.close();
});

test('an OBS that can\'t set per-scene transitions over its WebSocket: the dock says so and applies the rest', async () => {
  const old = obsModel(net, '127.0.0.1:0', { 'Be right back': [overlay('brb')] }, { overrides: false,
    transitions: [{ name: 'Fade', kind: 'fade_transition', settings: {} }, { name: 'Trongates · Shutters', kind: 'obs_stinger_transition', settings: { transition_point: 600 } }] });
  const p = (await old.listening).split(':')[1];
  const tab = await chrome.open(`${site.origin}/obs/control?obs=${p}&veado=127.0.0.1:1`, { width: 380, height: 1400 });
  await tab.click('[data-tab="scenes"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="scenes:tx"]')`, 8000);
  await tab.click('.tgl-panel [data-sub="scenes:tx"]');
  await tab.until(`document.querySelector('.tgl-panel [data-set="dock.tx.on"]')`, 3000);
  if (!(await tab.eval(`document.querySelector('.tgl-panel [data-set="dock.tx.on"]').checked`))) await tab.click('.tgl-panel [data-set="dock.tx.on"]');
  await tab.until(`document.querySelector('.tgl-panel select[data-tx-scene="Be right back"]')`, 3000);
  await select(tab, '.tgl-panel select[data-tx-scene="Be right back"]', 'shutters');
  await select(tab, '.tgl-panel select[data-set="dock.tx.default"]', 'shutters');
  await tab.until(`/waiting/.test(${footer})`, 3000);
  await tab.click('[data-act="review"]');
  await tab.until(`document.querySelector('.review')`);
  assert.match(await tab.eval(`document.querySelector('.review').textContent`), /Be right back: this OBS can't set a scene's transition/);
  await tab.click('[data-act="apply"]');
  await tab.until(`!document.querySelector('.review')`, 8000);
  assert.equal(old.transition, 'Trongates · Shutters');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
