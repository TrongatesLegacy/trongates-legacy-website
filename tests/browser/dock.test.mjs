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
  await tab.until(`/matches|waiting/.test(document.querySelector('.tgl-panel .ft span')?.textContent || '')`, 5000, 'the first scan');
  const before = obs.count('GetSceneList');
  for (let i = 0; i < 60; i++) { obs.broadcast('SceneItemCreated', {}); await sleep(16); }
  await sleep(1200);                               // the dock waits 800 ms after the last event, then scans
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
  // and named after their scene type, like the dock's own sources
  const names = [...obs.inputs.values()].filter((i) => i.kind === 'browser_source').map((i) => i.name).sort();
  assert.deepEqual(names, ['Trongates · Be right back', 'Trongates · Game (window)', 'Trongates · Just chatting']);
  await sleep(1200);                               // its own InputSettingsChanged events must not set off more changes
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
  const game = obs.scenes.find((s) => s.name === 'Game').items.find((i) => /\/obs\/game/.test(i.input.settings.url || ''));
  assert.equal(game.transform.positionX, 0); assert.equal(game.input.settings.fps_custom, true);
  await tab.close();
});

// Changing Game from window to full screen used to leave a picked game capture in the window: Apply only touched
// the overlay, and the Layout tab only knew the window.
test('Game\'s layout: Review & apply moves a picked game capture with it, and says so when none is picked', async () => {
  const tab = await openDock();
  const capture = () => obs.scenes.find((s) => s.name === 'Game').items.find((i) => i.input.name === 'Game capture').transform;
  const setLayout = async (v) => {
    await tab.click('[data-tab="scenes"]');
    await tab.until(`[...document.querySelectorAll('.tgl-panel .acc .sum')].some((x) => /Game/.test(x.textContent))`, 5000, 'the Game row');
    if (!await tab.eval(`!!document.querySelector('select[data-set="scenes.game.layout"]')`)) await tab.eval(`[...document.querySelectorAll('.tgl-panel .acc .sum')].find((x) => /Game/.test(x.textContent)).click(); 1`);
    await tab.until(`document.querySelector('select[data-set="scenes.game.layout"]')`);
    await tab.eval(`(() => { const s = document.querySelector('select[data-set="scenes.game.layout"]'); s.value = '${v}'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  };
  const reviewText = async () => {
    await tab.until(`/waiting/.test(document.querySelector('.tgl-panel .ft span').textContent)`, 5000, 'changes waiting');
    await tab.click('[data-act="review"]');
    await tab.until(`document.querySelector('[data-act="apply"]:not([disabled])')`);
    return tab.eval(`document.querySelector('.review').textContent`);
  };
  const applyNow = async () => { await tab.click('[data-act="apply"]'); await tab.until(`!document.querySelector('.review')`, 8000); await sleep(900); };

  // nothing picked: the review says the capture stays, and it does
  const before = { ...capture() };
  await setLayout('full');
  assert.match(await reviewText(), /game capture won't move/);
  await applyNow();
  assert.equal(capture().positionX, before.positionX);

  // picked on Layout (offered in full screen too): Checks wants it full screen, and a switch back moves it on Apply
  await tab.click('[data-tab="layout"]');
  await tab.until(`document.querySelector('select[data-pick^="capture:"]')`, 5000, 'the game capture picker in full screen');
  await tab.eval(`(() => { const s = document.querySelector('select[data-pick^="capture:"]'); s.value = 'Game capture'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await tab.until(`/not full screen/.test(document.querySelector('.tgl-panel').textContent)`, 5000, 'the check: not full screen');
  await setLayout('window');
  assert.match(await reviewText(), /Game capture in Game: the 1440 × 810 window/);
  await applyNow();
  assert.deepEqual([capture().positionX, capture().positionY, capture().boundsWidth, capture().boundsHeight], [12, 76, 1440, 810]);
  await setLayout('full');
  assert.match(await reviewText(), /Game capture in Game: full screen/);
  await applyNow();
  assert.deepEqual([capture().positionX, capture().positionY, capture().boundsWidth, capture().boundsHeight], [0, 0, 1920, 1080]);
  assert.match(await footer(tab), /OBS matches/);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('colour buttons: one veadotube switch per press; the scenes are told once, when the last press is confirmed', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="live"]');
  await tab.until(`document.querySelector('.tgl-panel button[data-form="princess"]')`);
  const sets = veado.sets.length, events = obs.count('BroadcastCustomEvent');
  for (const f of ['princess', 'blobfish', 'yellow', 'blobfish']) { await tab.click(`.tgl-panel button[data-form="${f}"]`); await sleep(20); }
  await tab.until(`document.querySelector('.tgl-panel button[data-form="blobfish"]').getAttribute('aria-pressed') === 'true'`, 5000, 'Blobfish pressed');
  await sleep(300);
  assert.equal(veado.sets.length - sets, 4, 'veadotube switches');
  assert.equal(veado.current, 'blobfish');
  const told = obs.calls.filter((c) => c[1] === 'BroadcastCustomEvent').slice(events);
  assert.equal(told.length, 1, `the scenes were told ${told.length} times`);
  assert.equal(told[0][2].eventData.form, 'blobfish');
  assert.equal(typeof told[0][2].eventData.at, 'number');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('every tab of the dock and the OBS index draws without errors', async () => {
  const tab = await openDock();
  for (const name of ['live', 'scenes', 'sources', 'widgets', 'layout', 'live']) {
    await tab.click(`[data-tab="${name}"]`);
    await tab.until(`document.querySelector('[data-tab="${name}"]').getAttribute('aria-selected') === 'true' && document.querySelector('.tgl-panel .bd').children.length > 0`, 3000, `the ${name} tab`);
  }
  // a part chip, a flag chip and a setting: the settings change and the footer counts what's waiting
  await tab.click('[data-tab="scenes"]');
  await tab.until(`document.querySelector('.tgl-panel [data-part]')`);
  await tab.click('.tgl-panel [data-part]');
  await tab.until(`/waiting/.test(document.querySelector('.tgl-panel .ft span').textContent)`, 3000, 'a change waiting');
  await tab.click('.tgl-panel [data-part]');
  assert.deepEqual(tab.errors, []);
  await tab.close();
  const index = await chrome.open(`${site.origin}/obs/`, { width: 1400, height: 900 });
  for (const name of ['live', 'scenes', 'widgets']) {
    await index.click(`.tgl-panel [data-tab="${name}"]`);
    await index.until(`document.querySelector('.tgl-panel [data-tab="${name}"]').getAttribute('aria-selected') === 'true'`, 3000, `index ${name} tab`);
  }
  await index.click('.tgl-panel [data-tab="live"]');
  await index.until(`document.querySelector('.tgl-panel button[data-form="princess"]')`);
  await index.click('.tgl-panel button[data-form="princess"]');
  // (recoloured where they are, or loaded on Princess if they hadn't loaded yet)
  await index.until(`[...document.querySelectorAll('#grid iframe')].some((f) => f.contentWindow?.TGL?.form === 'princess' || /form=princess/.test(f.getAttribute('src') || ''))`, 5000, 'the previews recoloured');
  assert.deepEqual(index.errors, []);
  await index.close();
});

test('Chatagram: a link pasted in Widgets → Chatagram goes into the source the Sources tab adds', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="widgets"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:chatagram"]')`);
  await tab.click('.tgl-panel [data-sub="widgets:chatagram"]');
  await tab.until(`document.querySelector('.tgl-panel [data-set="chatagram"]')`);
  await tab.eval(`(() => { const f = document.querySelector('.tgl-panel [data-set="chatagram"]'); f.value = 'https://www.trongateslegacy.com/chatagram/play?twitch=someone&kick=someone&time=120&theme=pop'; f.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await tab.click('[data-tab="sources"]');
  await tab.until(`document.querySelector('.tgl-panel [data-add="chatagram"]')`);
  await tab.click('.tgl-panel [data-add="chatagram"]');
  await tab.until(`[...document.querySelectorAll('.tgl-panel')].some((p) => /Chatagram[\\s\\S]*In /.test(p.textContent))`, 5000, 'Chatagram listed as added');
  const made = [...obs.inputs.values()].filter((i) => i.settings.tgl_managed === 'widget:chatagram');
  assert.equal(made.length, 1);
  const url = new URL(made[0].settings.url);
  assert.equal(url.pathname, '/obs/chatagram');
  assert.equal(url.searchParams.get('twitch'), 'someone');
  assert.equal(url.searchParams.get('kick'), 'someone');
  assert.equal(url.searchParams.get('time'), '120');
  assert.equal(url.searchParams.get('theme'), null, 'the form picks the theme, not the link');
  assert.deepEqual([made[0].settings.width, made[0].settings.height], [960, 540]);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('Sources: "Add to scene" creates the widget once, in the chosen scene, tagged as the dock\'s', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="sources"]');
  await tab.until(`document.querySelector('.tgl-panel [data-add="goal"]')`);
  await tab.eval(`(() => { const s = document.querySelector('.tgl-panel select[data-target]'); s.value = 'Be right back'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await tab.click('.tgl-panel [data-add="goal"]');
  await tab.until(`/In Be right back/.test(document.querySelector('.tgl-panel').textContent)`, 5000, 'the goal listed in Be right back');
  const made = [...obs.inputs.values()].filter((i) => i.settings.tgl_managed === 'widget:goal');
  assert.equal(made.length, 1);
  assert.match(made[0].settings.url, /\/obs\/goal/);
  assert.ok(obs.scenes.find((s) => s.name === 'Be right back').items.some((i) => i.input === made[0]));
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('Inputty: a link pasted in Widgets → Inputty is measured, and goes into the source the Sources tab adds at that size', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="widgets"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:inputty"]')`);
  await tab.click('.tgl-panel [data-sub="widgets:inputty"]');
  await tab.until(`document.querySelector('.tgl-panel [data-set="inputty"]')`);
  // keyboard only (an empty p2): narrower than WASD and the mouse's 1018 × 400
  await tab.eval(`(() => { const f = document.querySelector('.tgl-panel [data-set="inputty"]'); f.value = 'https://www.trongateslegacy.com/inputty/play.html?p=game-keys&v=2&p2=&theme=candy'; f.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  // the keyboard link's own hint (the controller link has one too)
  const hint = `document.querySelector('.tgl-panel [data-set="inputty"]').closest('label').nextElementSibling.textContent`;
  await tab.until(`/^\\s*Using p, v, p2\\./.test(${hint}) && /Size in OBS: \\d+ × \\d+\\s*$/.test(${hint})`, 10000, 'the pasted link measured');
  const [w, h] = (await tab.eval(`/Size in OBS: (\\d+) × (\\d+)/.exec(${hint}).slice(1).join()`)).split(',').map(Number);
  assert.ok(w > 200 && w < 1018 && h > 100 && h <= 420, `measured ${w} × ${h}`);
  await tab.click('[data-tab="sources"]');
  await tab.until(`document.querySelector('.tgl-panel [data-add="inputty"]')`);
  await tab.click('.tgl-panel [data-add="inputty"]');
  await tab.until(`/Inputty[\\s\\S]*In /.test(document.querySelector('.tgl-panel').textContent)`, 5000, 'Inputty listed as added');
  const made = [...obs.inputs.values()].filter((i) => i.settings.tgl_managed === 'widget:inputty');
  assert.equal(made.length, 1);
  const url = new URL(made[0].settings.url);
  assert.equal(url.pathname, '/obs/inputty');
  assert.equal(url.searchParams.get('p'), 'game-keys'); assert.equal(url.searchParams.get('p2'), '');
  assert.equal(url.searchParams.get('theme'), null, 'the form picks the theme, not the link');
  assert.deepEqual([made[0].settings.width, made[0].settings.height], [w, h]);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// the owner: the sub-tabs scrolled sideways (Widgets had seven in a row). They wrap into even rows instead
test('every tab and sub-tab fits the dock, even a narrow one: nothing scrolls sideways', async () => {
  for (const width of [380, 300]) {
    const tab = await chrome.open(`${site.origin}/obs/control?obs=${obsAddr.split(':')[1]}&veado=${veadoAddr}`, { width, height: 900 });
    await tab.until(`document.querySelector('.tgl-panel .tabs')`, 5000);
    for (const t of ['live', 'scenes', 'sources', 'widgets', 'layout']) {
      await tab.click(`[data-tab="${t}"]`);
      await sleep(60);
      const over = await tab.eval(`[...document.querySelectorAll('.tgl-panel .tabs, .tgl-panel .seg, .tgl-panel .seg button, .tgl-panel .tabs button, .tgl-panel .bd')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className + ':' + e.textContent.trim()).join(' | ')`);
      assert.equal(over, '', `${t} at ${width}px`);
      // every label inside its button (a button's text can spill out without it scrolling), and the header inside the dock
      const spill = await tab.eval(`[...document.querySelectorAll('.tgl-panel .tabs button, .tgl-panel .seg button')].filter((b) => { const r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect(), o = b.getBoundingClientRect(); return t.left < o.left - 1 || t.right > o.right + 1; }).map((b) => b.textContent).concat([...document.querySelectorAll('.tgl-panel .hd > *, .tgl-panel .pill')].filter((x) => x.getBoundingClientRect().right > document.querySelector('.tgl-panel').getBoundingClientRect().right + 1).map((x) => x.textContent)).join(' | ')`);
      assert.equal(spill, '', `${t} at ${width}px: labels spill out`);
    }
    // Widgets' sub-tabs: every one on show, in even rows
    await tab.click('[data-tab="widgets"]');
    await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:inputty"]')`);
    const rows = await tab.eval(`(() => { const b = [...document.querySelector('.tgl-panel .seg').querySelectorAll('button')]; const tops = [...new Set(b.map((x) => Math.round(x.getBoundingClientRect().top)))]; return tops.map((t) => b.filter((x) => Math.round(x.getBoundingClientRect().top) === t).length); })()`);
    assert.ok(rows.length <= 3 && Math.max(...rows) - Math.min(...rows) <= 1, `${width}px: rows of ${rows.join(', ')}`);
    assert.ok(await tab.eval(`!!document.querySelector('.tgl-panel [data-sub="widgets:inputty"]')`), 'Inputty has its own sub-tab');
    await tab.close();
  }
  // the same panel on the OBS index page, a narrow column of a wide window: its sub-tabs wrap by the panel's width
  const index = await chrome.open(`${site.origin}/obs/`, { width: 1440, height: 900 });
  await index.until(`document.querySelector('.tgl-panel [data-tab="widgets"]')`, 5000);
  await index.click('.tgl-panel [data-tab="widgets"]');
  await index.until(`document.querySelector('.tgl-panel [data-sub="widgets:inputty"]')`);
  assert.equal(await index.eval(`[...document.querySelectorAll('.tgl-panel .seg button')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent).join()`), '', 'no sub-tab cut short on the index page');
  await index.close();
});

// the owner: Inputty on the game screens, in a corner, a side's middle or the bottom middle, from the dock; two links
// (keyboard, controller), switched and shown or hidden from the Inputty tab, straight away like the colour buttons
test('Inputty on Game: a spot places whichever is showing inside the game (Game (window): its window); switching and hiding are instant', async () => {
  const tab = await openDock();
  await tab.click('[data-tab="widgets"]');
  await tab.until(`document.querySelector('.tgl-panel [data-sub="widgets:inputty"]')`);
  await tab.click('.tgl-panel [data-sub="widgets:inputty"]');
  await tab.until(`document.querySelectorAll('.tgl-panel [data-io-at]').length === 7`, 5000, 'seven spots');
  // nothing in the tab sits on top of anything else (the little screen once had no height, and the size buttons slid under it)
  const overlaps = await tab.eval(`(() => { const k = [...document.querySelector('.tgl-panel .bd').children].map((c) => c.getBoundingClientRect()); return k.slice(1).filter((r, i) => r.top < k[i].bottom - 1).length; })()`);
  assert.equal(overlaps, 0, 'the Inputty tab\'s parts overlap');
  const game = () => obs.sceneNamed('Game');
  const mine = (kind) => game().items.find((i) => i.input.settings.tgl_managed === 'widget:' + kind);
  await tab.click('.tgl-panel [data-io-at="br"]');
  const until = async (fn, what, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(50); } throw new Error('timed out: ' + what); };
  await until(() => mine('inputty') && mine('inputtypad') && mine('inputty').transform.scaleX, 'both Inputty sources in Game, placed');
  // the Game layout the dock is set to (the tab draws it): inside the window, or the whole canvas
  const lay = await tab.eval(`document.querySelector('.tgl-panel .io-screen').classList.contains('window') ? 'window' : 'full'`);
  const [ax, ay, aw, ah] = lay === 'window' ? [12, 76, 1440, 810] : [0, 0, 1920, 1080];
  const want = async (kind, size = 'm') => tab.eval(`TGLModel.inputtyBox('${lay}', [${mine(kind).input.settings.width}, ${mine(kind).input.settings.height}], 'br', '${size}')`);
  await until(() => mine('inputty').enabled !== false && mine('inputtypad').enabled === false, 'keyboard showing, controller hidden');
  // (its size may still be being measured: placed again at the measured size once it is)
  let t;
  for (let i = 0; i < 100; i++) { t = await want('inputty'); if (['positionX', 'positionY', 'scaleX'].every((k) => Math.abs(mine('inputty').transform[k] - t[k]) < 0.01)) break; await sleep(80); }
  for (const k of ['positionX', 'positionY', 'scaleX']) assert.ok(Math.abs(mine('inputty').transform[k] - t[k]) < 0.01, `keyboard ${k}: ${mine('inputty').transform[k]} vs ${t[k]}`);
  // inside the game (the 1440 × 810 window on Game (window)), and above the game capture so it shows
  const w = mine('inputty').input.settings.width * t.scaleX, h = mine('inputty').input.settings.height * t.scaleY;
  assert.ok(t.positionX >= ax && t.positionY >= ay && t.positionX + w <= ax + aw && t.positionY + h <= ay + ah, `inside the game (${lay})`);
  const idx = (it) => game().items.indexOf(it);
  assert.ok(idx(mine('inputty')) > idx(game().items.find((i) => i.input.name === 'Game capture')), 'above the game capture');
  // switch to the controller: it shows, the keyboard hides
  await tab.click('.tgl-panel [data-io-which="pad"]');
  await until(() => mine('inputtypad').enabled !== false && mine('inputty').enabled === false, 'controller showing');
  let tp;
  for (let i = 0; i < 100; i++) { tp = await want('inputtypad'); if (Math.abs(mine('inputtypad').transform.positionX - tp.positionX) < 1) break; await sleep(80); }
  assert.ok(Math.abs(mine('inputtypad').transform.positionX - tp.positionX) < 1, 'the controller in the same spot, at its own size');
  // hide: neither shows; show again: the controller's back
  await tab.click('.tgl-panel [data-io-show]');
  await until(() => mine('inputtypad').enabled === false && mine('inputty').enabled === false, 'both hidden');
  await tab.click('.tgl-panel [data-io-show]');
  await until(() => mine('inputtypad').enabled !== false, 'shown again');
  // bigger
  const before = mine('inputtypad').transform.scaleX;
  await tab.click('.tgl-panel [data-io-size="l"]');
  await until(() => mine('inputtypad').transform.scaleX > before + 0.01, 'bigger');
  assert.equal([...obs.inputs.values()].filter((i) => i.settings.tgl_managed === 'widget:inputtypad').length, 1, 'one controller source');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
