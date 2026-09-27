// The OBS scenes (public/obs/) in headless Chrome at 1920 × 1080. Nothing here reaches a real OBS, veadotube or
// Botrix: the scenes run with noveado=1, the dock is pointed at closed ports, and outside requests are blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { read, readAt } from '../helpers/sim.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HD = { width: 1920, height: 1080 };
const ctx = vm.createContext({ URLSearchParams, URL, btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent }); ctx.window = ctx;
vm.runInContext(read('public/obs/shared/model.js'), ctx);
const M = ctx.TGLModel;
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });
const noErrors = (tab, what) => assert.deepEqual(tab.errors, [], `${what}: errors in the page`);
// the scene has drawn: fonts loaded (scene.js starts its trails and labels then), the art decoded, two frames painted
const settled = (tab) => tab.eval(`document.fonts.ready.then(() => { const i = document.querySelector('.art-stage img[data-form-art]'); return i && !i.complete ? i.decode().catch(() => {}) : null; }).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => true)`);
// the character art's glitch runs (each time .art starts glitching) and art swaps, with when they happened. (The scene's
// colour itself changes the moment a pick arrives, by design; it's the art's glitches that must not pile up.)
const WATCH = `window.__glitches = []; window.__arts = [];
  const art = document.querySelector('.art-stage .art'), img = art.querySelector('img[data-form-art]');
  let was = art.classList.contains('glitching');
  new MutationObserver(() => { const on = art.classList.contains('glitching'); if (on && !was) __glitches.push(performance.now()); was = on; }).observe(art, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => __arts.push(img.getAttribute('src'))).observe(img, { attributes: true, attributeFilter: ['src'] }); 1`;
const artNow = `document.querySelector('.art-stage img[data-form-art]').getAttribute('src')`;

test('every OBS page loads without errors', async () => {
  const pages = ['starting', 'brb?demo=1', 'chatting?demo=1', 'game', 'game?layout=window&demo=1', 'ending', 'chat?demo=1', 'goal?demo=1', 'music?music=demo', 'chat?bare=1&demo=1', '', 'control?obs=1&veado=127.0.0.1:1'];
  // four at a time (one Chrome, four tabs)
  for (let i = 0; i < pages.length; i += 4) {
    await Promise.all(pages.slice(i, i + 4).map(async (p) => {
      const sep = p.includes('?') ? '&' : '?';
      const tab = await chrome.open(`${site.origin}/obs/${p}${p && !p.startsWith('control') ? sep + 'noveado=1' : ''}`, HD);
      await settled(tab); await sleep(150);
      noErrors(tab, `/obs/${p}`);
      await tab.close();
    }));
  }
});

test('hide= removes every part it names, and only those', async () => {
  for (const kind of ['brb', 'chatting', 'starting', 'ending']) {
    const parts = M.TYPES[kind].parts;
    const tab = await chrome.open(`${site.origin}/obs/${kind}?noveado=1&hide=${parts.join(',')}`, HD);
    assert.deepEqual(await tab.eval(`[...document.querySelectorAll('[data-part]')].map((e) => e.dataset.part)`), [], `${kind}: parts left`);
    await tab.close();
    const one = parts[0], t2 = await chrome.open(`${site.origin}/obs/${kind}?noveado=1&hide=${one}`, HD);
    const left = await t2.eval(`[...document.querySelectorAll('[data-part]')].map((e) => e.dataset.part)`);
    assert.ok(!left.includes(one) && left.length === parts.length - 1, `${kind} hide=${one}: left ${left}`);
    await t2.close();
  }
});

// picks made while OBS isn't showing the scene, then the scene shown: returns how many glitches played afterwards
async function hiddenPicks(tab) {
  await settled(tab);
  await tab.eval(`dispatchEvent(new CustomEvent('obsSourceVisibleChanged', { detail: { visible: false } })); 1`);
  await tab.eval(`(async () => { for (const f of ['princess', 'blobfish', 'red', 'yellow', 'princess', 'blobfish', 'cyan', 'princess']) { TGL.set(f); await new Promise((r) => setTimeout(r, 40)); } })()`);
  await tab.eval(WATCH);
  await tab.eval(`dispatchEvent(new CustomEvent('obsSourceVisibleChanged', { detail: { visible: true } })); 1`);
  await sleep(1200);                               // replayed picks start glitching at once (the old code: within ~100 ms)
  return tab.eval('__glitches.length');
}

test('a cycling scene picked while hidden in OBS shows up on the current form, with no fast run through the forms', async () => {
  const tab = await chrome.open(`${site.origin}/obs/brb?demo=1`, HD);
  const glitches = await hiddenPicks(tab);
  assert.equal(glitches, 0, `${glitches} glitches played in the 2.5 s after showing (the picks made while hidden, replayed)`);
  assert.equal(await tab.eval('document.documentElement.dataset.form'), 'princess');
  assert.match(await tab.eval(artNow), /princess/);
  noErrors(tab, 'hidden picks');
  await tab.close();
});

test('a cycling scene picked 10 times in a row: nothing piles up (at most one glitch after the last pick), ending on it', async () => {
  const tab = await chrome.open(`${site.origin}/obs/brb?demo=1&motion=full`, HD);
  await settled(tab);
  await tab.eval(WATCH);
  const picks = ['princess', 'blobfish', 'red', 'princess', 'yellow', 'blobfish', 'cyan', 'red', 'princess', 'blobfish'];
  await tab.eval(`(async () => { for (const f of ${JSON.stringify(picks)}) { TGL.set(f); await new Promise((r) => setTimeout(r, 10)); } window.__lastPick = performance.now(); })()`);
  await tab.until(`!document.querySelector('.art-stage .art').classList.contains('glitching')`, 4000, 'the glitches to finish');
  await sleep(300);                                // a glitch still queued would have started by now
  // while the picks arrive a glitch may finish and the next start (a slow machine); after the last pick, at most one
  // more: the one waiting, straight to the last pick. A pile-up would replay the picks one by one.
  const [total, after] = await tab.eval('[__glitches.length, __glitches.filter((t) => t > __lastPick).length]');
  assert.ok(total >= 1 && after <= 1, `${total} glitches, ${after} of them after the last pick`);
  assert.equal(await tab.eval('document.documentElement.dataset.form'), 'blobfish');
  assert.match(await tab.eval(artNow), /blobfish/);
  assert.equal(await tab.eval(`document.querySelector('.art-stage .art').classList.contains('glitching')`), false, 'the glitch finished');
  noErrors(tab, 'quick picks');
  await tab.close();
});

test('the goal widget follows the colour with one copy per form, however often the colour changes', async () => {
  const goal = encodeURIComponent('https://botrix.live/widgets/goal/?bid=test');
  const tab = await chrome.open(`${site.origin}/obs/chatting?noveado=1&goal=${goal}`, HD);
  await tab.eval(`(async () => { for (let i = 0; i < 30; i++) { TGL.set(['princess', 'blobfish', 'red', 'yellow', 'cyan'][i % 5]); await new Promise((r) => setTimeout(r, 15)); } })()`);
  await sleep(100);
  const n = await tab.eval(`document.querySelectorAll('.widget.goal').length`);
  assert.ok(n >= 1 && n <= 5, `${n} goal widgets`);
  const tab2 = await chrome.open(`${site.origin}/obs/brb?goal=${goal}`, HD);
  assert.equal(await tab2.eval(`document.querySelectorAll('.widget.goal').length`), 5, 'a cycling scene loads all five up front');
  await tab.close(); await tab2.close();
});

test('the dock\'s shared chat fits the chat frame the scenes draw (model.js chatBox = the measured slot)', async () => {
  const cases = [
    ['brb', 'music=demo', {}, true], ['brb', '', {}, false], ['brb', 'music=demo&hide=goal', { off: ['goal'] }, true],
    ['chatting', 'music=demo', {}, true], ['chatting', 'hide=goal,music', { off: ['goal', 'music'] }, false],
    ['game', 'layout=window&music=demo', {}, true],
  ];
  for (const [kind, q, sc, music] of cases) {
    const tab = await chrome.open(`${site.origin}/obs/${kind}?noveado=1&${q}`, HD);
    // the column may glide into place: wait until the slot stops moving
    const rect = `(() => { const b = document.querySelector('[data-slot="Botrix chat"]').getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; })()`;
    await settled(tab);
    let got = await tab.eval(rect), prev;
    for (let i = 0; i < 20 && JSON.stringify(got) !== JSON.stringify(prev); i++) { prev = got; await sleep(100); got = await tab.eval(rect); }
    const s = M.defaults(); Object.assign(s.scenes[kind], sc); if (kind === 'game') s.scenes.game.layout = 'window';
    const want = JSON.parse(JSON.stringify(M.chatBox(kind, s, music)));
    assert.deepEqual(got, want, `${kind}?${q}: the drawn chat slot vs chatBox()`);
    await tab.close();
  }
});

test('proof: the cycling from before the fix (7f5f65e~1) replays hidden picks, so the test above catches it', async (t) => {
  const old = readAt('7f5f65e~1', 'public/obs/shared/scene.js');
  if (!old) return t.skip('git history not available');
  site.files['/obs/shared/scene.js'] = old;
  try {
    const tab = await chrome.open(`${site.origin}/obs/brb?demo=1`, HD);
    const glitches = await hiddenPicks(tab);
    assert.ok(glitches > 0, 'the old code played no glitches after showing: the test above would not have caught the bug');
    await tab.close();
  } finally { delete site.files['/obs/shared/scene.js']; }
});

// Game (window): the window is exactly the game capture's box, where the dock's Tidy puts it (panel-layout.js CAPTURE),
// so once the game is up only the window's thin border shows: the tag and "Loading the game" sit inside the box (the
// game covers them), the border lies just outside it, and nothing else of the scene reaches into it.
test('Game (window): the window is exactly where the game capture goes, and only its border shows around the game', async () => {
  const [, x, y, w, h] = read('public/obs/shared/panel-layout.js').match(/CAPTURE = \{ positionX: (\d+), positionY: (\d+), boundsType: '[A-Z_]+', boundsWidth: (\d+), boundsHeight: (\d+)/).map(Number);
  assert.equal(w / h, 16 / 9, 'a 16:9 window, so a 16:9 game fills it exactly');
  const tab = await chrome.open(`${site.origin}/obs/game?layout=window&noveado=1`, HD);
  await settled(tab);
  const got = await tab.eval(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const win = document.querySelector('.gamewin'), slot = win.querySelector('[data-slot^="Game capture"]');
    const inside = (el) => { const [a, b] = [el.getBoundingClientRect(), slot.getBoundingClientRect()]; return a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom; };
    const s = slot.getBoundingClientRect();
    // everything else drawn on the scene (frames, now playing, stage slots) must stay clear of the window and its border
    const others = [...document.querySelectorAll('.frame, .np, [data-slot]')].filter((el) => !win.contains(el)).filter((el) => {
      const b = el.getBoundingClientRect(); return b.width && b.left < s.right + 2 && b.right > s.left - 2 && b.top < s.bottom + 2 && b.bottom > s.top - 2;
    }).map((el) => el.className || el.dataset.slot);
    // the goal and now playing: centred between the window's 2px border and the bottom of the canvas (their layout boxes:
    // now playing slides in from 8px above when a track starts)
    const below = [document.querySelector('.frame[data-part="goal"]'), document.querySelector('.np')].map((el) => {
      const top = el.offsetParent.getBoundingClientRect().top + el.offsetTop; return [Math.round(top - (s.bottom + 2)), Math.round(innerHeight - top - el.offsetHeight)]; });
    return { slot: box(slot), frame: box(win), shadow: getComputedStyle(win).boxShadow, tag: inside(win.querySelector('.tag')), loading: inside(win.querySelector('.copy')), others, below };
  })()`);
  assert.deepEqual(got.slot, [x, y, w, h], 'the drawn window is the capture box');
  assert.deepEqual(got.frame, got.slot, 'no padding band: the window is the game');
  assert.match(got.shadow, /0px 0px 0px 2px/, 'a 2px border drawn outside the box');
  assert.ok(got.tag && got.loading, 'the tag and the loading text sit where the game covers them');
  assert.deepEqual(got.others, [], 'nothing else overlaps the window or its border');
  for (const [above, under] of got.below) assert.equal(above, under, `the goal and now playing are centred below the window (${above}px above, ${under}px below)`);
  noErrors(tab, 'game window');
  await tab.close();
});

// The switch-in draws the character in its own layer, then hands back to the art image. The image used to fade back in
// (0.25 s) after the layer had already been cleared, so for a few frames there was no character at all: a flicker at every
// turn of the cycle (visible in any recording). Sampled every frame through switches to every form.
test('a cycling scene\'s character never disappears while it switches, for a single frame', async () => {
  const tab = await chrome.open(`${site.origin}/obs/starting?noveado=1&motion=full&form=cyan`, HD);
  await settled(tab);
  await tab.eval(`(() => {
    const art = document.querySelector('.art-stage .art'), img = art.querySelector('img[data-form-art]'), layer = art.querySelector('.art-glitch');
    window.__gaps = 0; window.__frames = 0;
    const look = () => { __frames++; const drawn = art.classList.contains('glitching') ? layer.children.length > 0 : +getComputedStyle(img).opacity > .95;
      if (!drawn) __gaps++; requestAnimationFrame(look); };
    requestAnimationFrame(look); return 1; })()`);
  for (const f of ['princess', 'blobfish', 'red', 'cyan']) {
    await tab.eval(`TGL.set('${f}'); 1`);
    await tab.until(`!document.querySelector('.art-stage .art').classList.contains('glitching')`, 4000, `${f}: the switch-in`);
    await sleep(500);
  }
  const [gaps, frames] = await tab.eval('[__gaps, __frames]');
  assert.ok(frames > 60, `sampled ${frames} frames`);
  assert.equal(gaps, 0, `the character was missing in ${gaps} of ${frames} frames`);
  noErrors(tab, 'switching');
  await tab.close();
});
