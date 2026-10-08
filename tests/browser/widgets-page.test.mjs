// The /widgets/ page (2026-10-08, the streamer's desk): a stream on a monitor plays the real widget, a Stream Deck-style
// pad switches scenes, and the lineup below holds the text. Switching never stacks live widgets, the lineup and the
// announcement follow the scene, keyboard works (1-4 anywhere, arrows on the deck, never with Cmd/Ctrl), it fits a phone,
// and with reduced motion it cuts and never starts a live widget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });

const state = `({
  keys: [...document.querySelectorAll('.key[aria-pressed="true"]')].map((k) => k.dataset.scene),
  now: [...document.querySelectorAll('.slot.now')].map((s) => s.dataset.scene),
  on: [...document.querySelectorAll('.sc.on')].map((s) => s.dataset.scene),
  frames: document.querySelectorAll('#vid iframe').length,
  frame: document.querySelector('#vid iframe')?.getAttribute('src') || '',
  said: document.getElementById('announce').textContent,
  overflow: document.documentElement.scrollWidth - innerWidth,
})`;

test('the deck switches scenes: the stream, the keys, the lineup and the announcement agree; one live widget at most', async () => {
  const tab = await chrome.open(site.origin + '/widgets/', { width: 1440, height: 900 });
  await tab.until(`document.querySelectorAll('.key').length === 4`, 8000, 'the deck');
  let s = await tab.eval(state);
  assert.deepEqual([s.keys, s.now, s.on], [['chatagram'], ['chatagram'], ['chatagram']]);
  await tab.until(`/chatagram\\/play\\.html\\?demo=1/.test(document.querySelector('#vid iframe')?.getAttribute('src') || '')`, 8000, 'Chatagram live on the stream');
  // the script starts after the first frame; the other scenes' pictures still arrive once the page has loaded
  await tab.until(`!document.querySelector('.sc img[data-src]')`, 8000, 'the other scenes\' pictures');

  await tab.click('.key[data-scene="chaplinko"]');
  await tab.until(`document.querySelector('.sc.on')?.dataset.scene === 'chaplinko' && /chaplinko\\/play/.test(document.querySelector('#vid iframe')?.getAttribute('src') || '')`, 5000, 'Chaplinko live');
  s = await tab.eval(state);
  assert.deepEqual([s.keys, s.now, s.frames], [['chaplinko'], ['chaplinko'], 1]);
  assert.match(s.said, /Chaplinko, the Plinko chat game/);

  // quick presses: it settles on the last one, still one live widget at most
  for (const k of ['both', 'chatagram', 'soon', 'chaplinko', 'chatagram']) await tab.click(`.key[data-scene="${k}"]`);
  await tab.until(`document.querySelector('.sc.on')?.dataset.scene === 'chatagram' && document.querySelectorAll('#vid iframe').length === 1`, 6000, 'settled on Chatagram');
  await sleep(1500);
  s = await tab.eval(state);
  assert.deepEqual([s.keys, s.now, s.on, s.frames], [['chatagram'], ['chatagram'], ['chatagram'], 1]);

  // keyboard: a number anywhere; never with Cmd or Ctrl (the browser's own tab shortcuts)
  const key = (k, mods = 0) => tab.eval(`dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', metaKey: ${!!(mods & 1)}, ctrlKey: ${!!(mods & 2)}, bubbles: true })); 1`);
  await key('3');
  await tab.until(`document.querySelector('.key[aria-pressed="true"]').dataset.scene === 'both'`, 3000, 'key 3: both chats');
  await key('2', 1); await key('2', 2); await sleep(900);
  assert.deepEqual((await tab.eval(state)).keys, ['both'], 'Cmd/Ctrl+2 left alone');

  // the lineup's "Show on stream"
  await tab.click('.slot[data-scene="soon"] .show');
  await tab.until(`document.querySelector('.slot.now')?.dataset.scene === 'soon'`, 3000, 'coming soon from the lineup');
  assert.equal((await tab.eval(state)).overflow, 0);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// Bug (owner, 2026-10-09): Chaplinko's board is transparent, so its still picture stayed visible behind the live board.
test('a live widget replaces its picture: the picture fades out once the widget is ready, and comes back without it', async () => {
  const tab = await chrome.open(site.origin + '/widgets/', { width: 1440, height: 900 });
  await tab.until(`document.querySelectorAll('.key').length === 4`, 8000, 'the deck');
  const pic = (k) => `+getComputedStyle(document.querySelector('.sc[data-scene="${k}"] .pic')).opacity`;
  for (const k of ['chaplinko', 'chatagram']) {
    await tab.click(`.key[data-scene="${k}"]`);
    await tab.until(`document.querySelector('.sc[data-scene="${k}"] iframe.ready')`, 10000, `${k} live`);
    await tab.until(`${pic(k)} === 0`, 3000, `${k}'s picture gone once it's live`);
  }
  assert.equal(await tab.eval(pic('chaplinko')), 1, 'Chaplinko\'s picture back once it isn\'t live');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// Bug (owner, 2026-10-09): Down on the last key went back to the first, and the deck kept Up and Down from scrolling.
test('the deck\'s arrows: left and right step between keys and stop at the ends; up and down scroll the page', async () => {
  const tab = await chrome.open(site.origin + '/widgets/', { width: 1440, height: 900 });
  await tab.until(`document.querySelectorAll('.key').length === 4`, 8000, 'the deck');
  const press = (key) => tab.eval(`(() => { const e = new KeyboardEvent('keydown', { key: '${key}', bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(e); return e.defaultPrevented; })()`);
  const on = `document.querySelector('.key[aria-pressed="true"]').dataset.scene`;
  await tab.eval(`document.querySelector('.key[data-scene="soon"]').focus(); 1`);
  await press('End'); await sleep(900);
  assert.equal(await press('ArrowRight'), false, 'Right on the last key does nothing');
  await sleep(900);
  assert.equal(await tab.eval(on), 'soon', 'no wrapping back to the first');
  assert.equal(await press('ArrowDown'), false, 'Down is left to the page (scrolls)');
  assert.equal(await press('ArrowUp'), false, 'Up is left to the page');
  assert.equal(await tab.eval(on), 'soon');
  assert.equal(await press('ArrowLeft'), true);
  await tab.until(`${on} === 'both' && document.activeElement.dataset.scene === 'both'`, 3000, 'Left steps back one');
  await tab.eval(`document.querySelector('.key[data-scene="chatagram"]').focus(); 1`);
  await press('Home'); await sleep(900);
  assert.equal(await press('ArrowLeft'), false, 'Left on the first key does nothing');
  assert.equal(await tab.eval(on), 'chatagram');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('on a phone it fits, the deck works and the text is all there', async () => {
  const tab = await chrome.open(site.origin + '/widgets/', { width: 390, height: 844, mobile: true });
  await tab.until(`document.querySelectorAll('.key').length === 4`, 8000, 'the deck');
  const s = await tab.eval(state);
  assert.equal(s.overflow, 0, 'no sideways scroll');
  const text = await tab.eval(`document.body.innerText`);
  for (const t of ['Chatagram, the anagram chat game', 'Chaplinko, the Plinko chat game', 'Set up Chatagram, free', 'Set up Chaplinko, free']) assert.ok(text.includes(t), t);
  await tab.click('.key[data-scene="chaplinko"]');
  await tab.until(`document.querySelector('.sc.on')?.dataset.scene === 'chaplinko'`, 4000, 'Chaplinko on a phone');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('with reduced motion: cuts straight away and never starts a live widget', async () => {
  const tab = await chrome.open(site.origin + '/widgets/', { width: 1440, height: 900, reducedMotion: true });
  await tab.until(`document.querySelectorAll('.key').length === 4`, 8000, 'the deck');
  await tab.click('.key[data-scene="chaplinko"]');
  assert.equal(await tab.eval(`document.querySelector('.sc.on')?.dataset.scene`), 'chaplinko', 'a cut, at once');
  await sleep(2500);
  assert.equal((await tab.eval(state)).frames, 0, 'pictures stand in for the live widgets');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
