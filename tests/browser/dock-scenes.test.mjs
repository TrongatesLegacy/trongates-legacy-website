// The dock's Scenes tab: collapsing scene rows, sub-tabs, and naming the Trongates overlays "Trongates · <type>".
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { RealNet } from '../helpers/real-net.mjs';
import { obsModel } from '../helpers/obs-model.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site, net;
test.before(async () => { chrome = await launch(); site = await siteServer(); net = new RealNet(8); });
test.after(async () => { await chrome?.close(); await site?.close(); net?.close(); });
const src = (name, path) => ({ name, settings: { url: `https://www.trongateslegacy.com/obs/${path}`, width: 1920, height: 1080, fps_custom: true, fps: 30 } });
const footer = `document.querySelector('.tgl-panel .ft span')?.textContent || ''`;
async function dock(obs, collection) {
  const port = (await obs.listening).split(':')[1];
  const tab = await chrome.open(`${site.origin}/obs/control?obs=${port}&veado=127.0.0.1:1`, { width: 380, height: 900 });
  await tab.until(`document.querySelector('[data-tab="scenes"]')`);
  await tab.click('[data-tab="scenes"]');
  await tab.until(`document.querySelector('.tgl-panel .acc')`, 8000, 'the scene rows');
  return tab;
}
async function apply(tab) {
  await tab.click('[data-act="review"]');
  await tab.until(`document.querySelector('[data-act="apply"]:not([disabled])')`);
  await tab.click('[data-act="apply"]');
  await tab.until(`!document.querySelector('.review')`, 8000);
  await new Promise((r) => setTimeout(r, 900));
}

test('scene rows: one line each until opened, one open at a time; the pick survives a reload', async () => {
  const obs = obsModel(net, '127.0.0.1:0', { 'Just chatting': [src('JC', 'chatting')], 'Be right back': [src('BRB', 'brb')] }, { collection: 'Rows' });
  const tab = await dock(obs);
  const openRows = `[...document.querySelectorAll('.tgl-panel .acc.open b')].map((b) => b.textContent)`;
  assert.deepEqual(await tab.eval(openRows), []);
  assert.match(await tab.eval(`document.querySelector('.tgl-panel .acc .sum').textContent`), /Just chatting.*of \d parts · follows veadotube/);
  await tab.click('.tgl-panel .acc .sum');
  await tab.until(`${openRows}.length === 1`);
  await tab.eval(`document.querySelectorAll('.tgl-panel .acc .sum')[1].click(); 1`);
  await tab.until(`${openRows}[0] === 'Be right back'`);
  assert.deepEqual(await tab.eval(openRows), ['Be right back']);
  await tab.eval('location.reload(); 1').catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  await tab.until(`document.querySelector('.tgl-panel .acc.open')`, 8000, 'the open row, after a reload');
  assert.deepEqual(await tab.eval(openRows), ['Be right back']);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('naming: numbered when there are two of a type, never taking a name OBS already has, a right name kept', async () => {
  const obs = obsModel(net, '127.0.0.1:0', {
    'Just chatting': [src('Browser', 'chatting'), src('Browser 2', 'chatting?hide=goal')],
    'Be right back': [src('Trongates · Be right back', 'brb'), { name: 'Trongates · Ending', kind: 'image_source', settings: {} }],
    'Ending': [src('end', 'ending')],
  }, { collection: 'Names' });
  const tab = await dock(obs);
  await tab.until(`/waiting/.test(${footer})`, 5000);
  await tab.click('[data-act="review"]');
  await tab.until(`document.querySelector('.review')`);
  const review = await tab.eval(`document.querySelector('.review').textContent`);
  assert.doesNotMatch(review, /"Trongates · Be right back" →/, 'a right name is kept');
  await tab.click('[data-act="apply"]');
  await tab.until(`!document.querySelector('.review')`, 8000);
  const names = [...obs.inputs.values()].filter((i) => i.kind === 'browser_source').map((i) => i.name).sort();
  assert.deepEqual(names, ['Trongates · Be right back', 'Trongates · Ending 2', 'Trongates · Just chatting', 'Trongates · Just chatting 2']);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('naming off: nothing is renamed', async () => {
  const obs = obsModel(net, '127.0.0.1:0', { 'Be right back': [src('My BRB', 'brb')] }, { collection: 'Off' });
  const tab = await dock(obs);
  await tab.click('.tgl-panel [data-set="dock.names"]');
  await new Promise((r) => setTimeout(r, 300));
  if (/waiting/.test(await tab.eval(footer))) await apply(tab);
  assert.equal([...obs.inputs.values()][0].name, 'My BRB');
  assert.equal(obs.count('SetInputName'), 0);
  await tab.close();
});

test('Widgets sub-tabs: each group on its own, the pick remembered', async () => {
  const obs = obsModel(net, '127.0.0.1:0', { 'Be right back': [src('BRB', 'brb')] }, { collection: 'Widgets' });
  const tab = await dock(obs);
  await tab.click('[data-tab="widgets"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:music"]')`);
  for (const [sub, field] of [['obs', 'data-conn="port"'], ['botrix', 'data-set="linksMode"'], ['music', 'data-set="music.app"'], ['veado', 'data-set="veado.addr"'], ['more', 'data-act="copy-rescue"']]) {
    await tab.click(`.tgl-panel [data-sub="widgets:${sub}"]`);
    await tab.until(`document.querySelector('.tgl-panel [${field}]') && document.querySelectorAll('.tgl-panel .bd [data-set="veado.addr"], .tgl-panel .bd [data-set="music.app"]').length <= 1`, 3000, sub);
  }
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('Form looks (Widgets → More): turning Princess Trina\'s look off reaches every scene\'s address through Review & apply', async () => {
  const obs = obsModel(net, '127.0.0.1:0', { 'Be right back': [src('BRB', 'brb')], 'Just chatting': [src('JC', 'chatting')] }, { collection: 'Looks' });
  const tab = await dock(obs);
  for (let i = 0; i < 3 && /waiting/.test(await tab.eval(footer)); i++) await apply(tab);   // whatever the dock tidies first
  await tab.click('[data-tab="widgets"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:more"]')`);
  await tab.click('.tgl-panel [data-sub="widgets:more"]');
  await tab.until(`document.querySelector('.tgl-panel select[data-set="looks.princess"]')`, 3000, 'the Form looks');
  assert.equal(await tab.eval(`document.querySelectorAll('.tgl-panel select[data-set^="looks."]').length`), 5, 'one per form');
  assert.equal(await tab.eval(`document.querySelector('.tgl-panel select[data-set="looks.princess"]').value`), 'princess');
  await tab.eval(`(() => { const s = document.querySelector('.tgl-panel select[data-set="looks.princess"]'); s.value = 'tron'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await tab.until(`/waiting/.test(${footer})`, 3000, 'the change waiting');
  await apply(tab);
  const urls = [...obs.inputs.values()].filter((i) => /\/obs\/(brb|chatting)/.test(i.settings.url || '')).map((i) => i.settings.url);
  assert.equal(urls.length, 2);
  for (const u of urls) assert.match(u, /[?&]looks=princess:tron(&|$)/, u);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// The dock redraws itself on every status change (and each second on the Widgets tab, for the song). A redraw under an
// open dropdown replaced it, so a select closed by itself before anything could be picked (OBS: the Form looks and Motion).
test('a dropdown stays open while the dock redraws around it, and the dock catches up once it\'s picked', async () => {
  const obs = obsModel(net, '127.0.0.1:0', { 'Be right back': [src('BRB', 'brb')] }, { collection: 'Selects' });
  const tab = await dock(obs);
  for (let i = 0; i < 3 && /waiting/.test(await tab.eval(footer)); i++) await apply(tab);
  await tab.click('[data-tab="widgets"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:more"]')`);
  await tab.click('.tgl-panel [data-sub="widgets:more"]');
  await tab.until(`document.querySelector('.tgl-panel select[data-set="looks.princess"]')`);
  await tab.eval(`window.__sel = document.querySelector('.tgl-panel select[data-set="looks.princess"]'); __sel.focus(); 1`);
  for (const f of ['red', 'princess', 'cyan']) { await tab.eval(`TGL.set('${f}'); 1`); await sleep(120); }   // three redraws' worth
  assert.ok(await tab.eval(`__sel.isConnected && document.activeElement === __sel`), 'the open dropdown was replaced by a redraw');
  await tab.eval(`__sel.value = 'tron'; __sel.dispatchEvent(new Event('change', { bubbles: true })); 1`);
  await tab.until(`/waiting/.test(${footer})`, 3000, 'the dock to redraw with the change waiting');
  assert.equal(await tab.eval(`document.querySelector('.tgl-panel select[data-set="looks.princess"]').value`), 'tron');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// The dock rebuilt itself on every status change and each second on the Live and Widgets tabs (the song), even when nothing
// on show had changed. Now it only rebuilds when what it shows is different.
test('the dock doesn\'t rebuild itself while nothing it shows changes', async () => {
  const obs = obsModel(net, '127.0.0.1:0', { 'Be right back': [src('BRB', 'brb')] }, { collection: 'Idle' });
  const tab = await dock(obs);
  await tab.click('[data-tab="live"]');
  await sleep(1500);
  await tab.eval(`window.__rebuilds = 0; new MutationObserver((m) => { if (m.some((r) => r.target.classList?.contains('tgl-panel'))) __rebuilds++; }).observe(document.querySelector('.tgl-panel'), { childList: true }); 1`);
  await sleep(3500);                                // the song is asked for every second
  assert.equal(await tab.eval('__rebuilds'), 0, 'rebuilt with nothing changed');
  await tab.eval(`TGL.set('red'); 1`);             // something on show changes: it redraws
  await tab.until('__rebuilds > 0', 2000, 'a redraw for the new colour');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
