// Games on the stream's scenes (obs/README.md, "Games on your scenes"): spot=chatagram|chaplinko on a scene makes room for
// the game in the place model.js (GAME_BOX) gives it, and without spot= the scene is exactly as before. In the index page's
// previews (demo=1) the spot plays the game itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { read } from '../helpers/sim.mjs';

let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });
const ctx = vm.createContext({ URLSearchParams, URL }); ctx.window = ctx;
vm.runInContext(read('public/obs/shared/model.js'), ctx);
const M = ctx.TGLModel;

const SCENES = [['starting', 'starting'], ['brb', 'brb'], ['chatting', 'chatting'], ['game?layout=window', 'window'], ['game', 'full']];
const open = async (path, extra = '') => {
  const tab = await chrome.open(`${site.origin}/obs/${path}${path.includes('?') ? '&' : '?'}noveado=1&form=cyan&cycle=0${extra}`, { width: 1920, height: 1080, reducedMotion: true });
  await tab.until('document.fonts.status === "loaded"', 5000);
  await new Promise((r) => setTimeout(r, 250));
  return tab;
};
const rect = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })()`;
const overlaps = (a, b) => a && b && a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1;

test('a game\'s spot sits where model.js puts it; the goal makes way, the chat ends above it, nothing overlaps it', async () => {
  for (const g of ['chatagram', 'chaplinko']) for (const [path, spot] of SCENES) {
    const tab = await open(path, `&spot=${g}`);
    const where = `${g} on ${path}`;
    const box = await tab.eval(rect('[data-spot]'));
    assert.deepEqual(box, [...M.GAME_BOX[g][spot]], `${where}: the spot`);
    assert.equal(await tab.eval(rect('[data-part="goal"]')), null, `${where}: no goal`);
    const chat = await tab.eval(rect('.frame.col-chat'));
    if (chat) assert.equal(chat[1] + chat[3], 716, `${where}: the chat ends 16px above the spot`);
    // (on Game the loading text and the window's tag sit under the game capture, which the spot goes over)
    const game = spot === 'window' || spot === 'full';
    for (const sel of ['.frame.col-chat', '.copy', '[data-part="discord"]', '[data-part="socials"]', '.np', '.stage', '.gamewin .tag'])
      if (!(game && ['.copy', '.gamewin .tag'].includes(sel))) assert.ok(!overlaps(box, await tab.eval(rect(sel))), `${where}: ${sel} overlaps the spot`);
    if (spot === 'starting') {
      assert.equal(await tab.eval(rect('[data-part="discord"]')), null, `${where}: the Discord block is off`);
      assert.equal(await tab.eval(rect('[data-part="socials"]')), null, `${where}: the socials are off`);
      assert.ok(await tab.eval(`[...document.querySelectorAll('.ticker .item.discord')].some((e) => e.offsetWidth > 0)`), `${where}: the strip says !discord instead`);
    }
    assert.deepEqual(tab.errors, [], where);
    await tab.close();
  }
});

test('without spot= every scene is as it was; Ending never takes one', async () => {
  for (const [path] of SCENES) {
    const tab = await open(path);
    assert.equal(await tab.eval('!!document.querySelector("[data-spot]") || document.documentElement.classList.contains("spot")'), false, path);
    if (path !== 'game') assert.ok(await tab.eval(rect('[data-part="goal"]')) || path === 'starting', `${path}: the goal is there`);
    assert.equal(await tab.eval(`[...document.querySelectorAll('.ticker .item.discord')].filter((e) => e.offsetWidth > 0).length > 0`), !['starting'].includes(path) && path !== 'brb', `${path}: !discord in the strip only where the scene has no Discord block`);
    if (path === 'starting') assert.equal(await tab.eval(`getComputedStyle(document.querySelector('.copy')).transform`), 'none');
    await tab.close();
  }
  const end = await open('ending', '&spot=chatagram');
  assert.equal(await end.eval('!!document.querySelector("[data-spot]")'), false, 'Ending ignores spot=');
  await end.close();
});

test('in the previews (demo=1) the spot plays the game itself, the board alone for Chaplinko', async () => {
  for (const [g, page] of [['chatagram', '/obs/chatagram'], ['chaplinko', '/obs/chaplinko']]) {
    const tab = await open('brb', `&spot=${g}&demo=1`);
    const src = await tab.eval(`document.querySelector('[data-spot] iframe')?.getAttribute('src') || ''`);
    assert.ok(src.includes(page.split('/').pop()) && /demo=1/.test(src), `${g}: ${src}`);
    if (g === 'chaplinko') assert.ok(!/layout=combined/.test(src), 'the board on its own');
    await tab.close();
  }
});

// the owner: on Starting soon and Be right back the forms take turns, and the game in the spot changes with them
test('a game in a cycling scene\'s spot changes theme with the scene\'s form (the preview: straight in)', async () => {
  const tab = await chrome.open(`${site.origin}/obs/brb?noveado=1&form=cyan&spot=chatagram&demo=1`, { width: 1920, height: 1080, reducedMotion: true });
  const theme = `(() => { try { return document.querySelector('[data-spot] iframe').contentDocument.getElementById('game').contentDocument.getElementById('board').dataset.theme; } catch { return ''; } })()`;
  await tab.until(`${theme} === 'neon'`, 10000, 'the game on Tron\'s neon');
  // the scene's own turns (every 6 s), which no other page hears of: Princess Trina, then the Blobfish
  await tab.until(`${theme} === 'royal'`, 9000, 'Princess Trina\'s royal with the scene\'s turn');
  await tab.until(`${theme} === 'deep'`, 9000, 'the Blobfish\'s deep');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
