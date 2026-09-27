// The rescue dock (public/obs/rescue.html) against a fake OBS: it refreshes every Trongates source and nothing else,
// and it keeps working when the control dock's code is broken (it doesn't load it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { RealNet } from '../helpers/real-net.mjs';
import { obsModel } from '../helpers/obs-model.mjs';

let chrome, site, net, obs, port;
const browser = (name, url, extra = {}) => ({ name, settings: { url, ...extra } });
test.before(async () => {
  chrome = await launch(); net = new RealNet(3);
  // the control dock's code broken on purpose: the rescue dock must not care
  site = await siteServer({ files: { '/obs/shared/panel.js': 'throw new Error("control dock broken");', '/obs/shared/theme.js': 'throw new Error("theme broken");' } });
  obs = obsModel(net, '127.0.0.1:0', {
    'Just chatting': [browser('Chatting overlay', 'https://www.trongateslegacy.com/obs/chatting?obs=4455'), browser('Trongates · Shared chat', 'https://botrix.live/widgets/chat/?bid=x', { tgl_managed: 'shared-chat' }),
      { name: 'Game capture', kind: 'game_capture', settings: {} }],
    'Be right back': [browser('BRB overlay', 'file:///C:/obs/brb.html?form=princess'), browser('Some other site', 'https://example.com/alerts')],
    'Transition layer': [browser('Trongates · Transition', 'https://www.trongateslegacy.com/obs/transition?obs=4455')],
  });
  port = (await obs.listening).split(':')[1];
});
test.after(async () => { await chrome?.close(); await site?.close(); net?.close(); });

test('refreshes every Trongates source (overlays hosted or local, the dock\'s own sources) and nothing else', async () => {
  const tab = await chrome.open(`${site.origin}/obs/rescue?obs=${port}`, { width: 320, height: 300 });
  await tab.until(`!document.getElementById('refresh').disabled`, 8000, 'connected');
  await tab.click('#refresh');
  await tab.until(`/Refreshed/.test(document.getElementById('state').textContent)`, 8000, 'refreshed');
  const pressed = obs.calls.filter((c) => c[1] === 'PressInputPropertiesButton').map((c) => [...obs.inputs.values()].find((i) => i.uuid === c[2].inputUuid).name).sort();
  assert.deepEqual(pressed, ['BRB overlay', 'Chatting overlay', 'Trongates · Shared chat', 'Trongates · Transition']);
  assert.match(await tab.eval(`document.getElementById('state').textContent`), /Refreshed 4 Trongates sources/);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('"Every scene back to Tron" sends the dock\'s colour message over OBS', async () => {
  const tab = await chrome.open(`${site.origin}/obs/rescue?obs=${port}`, { width: 320, height: 300 });
  await tab.until(`!document.getElementById('tron').disabled`, 8000, 'connected');
  const before = obs.count('BroadcastCustomEvent');
  await tab.click('#tron');
  await tab.until(`/Tron/.test(document.getElementById('state').textContent)`, 5000);
  const sent = obs.calls.filter((c) => c[1] === 'BroadcastCustomEvent').slice(before);
  assert.equal(sent.length, 1); assert.equal(sent[0][2].eventData.form, 'cyan'); assert.equal(sent[0][2].eventData.tgl, 'form');
  await tab.close();
});

test('the rescue dock loads nothing of the control dock or the scenes\' colour code', async () => {
  const tab = await chrome.open(`${site.origin}/obs/rescue?obs=${port}`, { width: 320, height: 300 });
  const scripts = await tab.eval(`[...document.scripts].map((s) => s.getAttribute('src')).filter(Boolean)`);
  assert.deepEqual(scripts, ['shared/obsws.js']);
  await tab.close();
});
