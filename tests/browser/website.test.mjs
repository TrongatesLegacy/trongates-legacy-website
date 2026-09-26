// The website (public/index.html) in headless Chrome, against the test server (no YouTube or Kick).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch, TIMERS } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { ROOT } from '../helpers/sim.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FEED = JSON.parse(readFileSync(ROOT + 'public/feed.json', 'utf8'));
const API = (over = {}) => ({ videos: [{ id: 'apiVideo001', title: 'From the API', published: '2026-09-20T00:00:00Z' }], shorts: [], source: 'playlists', kick: { live: false, title: '', viewers: 0, category: '', followers: 123 }, errors: [], ...over });
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer({ api: { '/api/feed': { body: API() } } }); });
test.after(async () => { await chrome?.close(); await site?.close(); });
const noErrors = (tab, what) => assert.deepEqual(tab.errors, [], `${what}: errors in the page`);
// the page's script starts just after the first paint (boot); until then its buttons do nothing. On localhost (the
// test server) it adds its development "mock live" button, which says it has started.
const booted = (tab) => tab.until(`[...document.querySelectorAll('body > button')].some((b) => b.textContent.startsWith('DEV'))`, 5000, 'the page script to start');

for (const [label, opts] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844, mobile: true }]]) {
  test(`loads cleanly on ${label}: no errors, the character drawn, nothing wider than the screen`, async () => {
    const tab = await chrome.open(site.origin + '/', opts);
    await tab.until(`document.getElementById('hero-img').complete && document.getElementById('hero-img').naturalWidth > 0`, 5000, 'the hero art');
    await tab.until(`document.querySelector('#feat .yt')`, 5000, 'the video list');
    const overflow = await tab.eval('document.documentElement.scrollWidth - innerWidth');
    assert.ok(overflow <= 0, `the page is ${overflow}px wider than the screen`);
    noErrors(tab, label);
    await tab.close();
  });
}

test('picking a form switches the site and is remembered', async () => {
  const tab = await chrome.open(site.origin + '/');
  await booted(tab);
  await tab.click('[data-theme-btn="princess"]');
  await tab.until(`document.documentElement.dataset.theme === 'princess'`);
  await tab.until(`[...document.querySelectorAll('#tuber img')].some((i) => i.currentSrc.includes('princess'))`, 5000, 'the princess art');
  assert.equal(await tab.eval(`localStorage.getItem('tgl-form')`), 'princess');
  await tab.eval('window.__before = 1; setTimeout(() => location.reload()); 1');
  await tab.until(`!window.__before && document.readyState === 'complete' && document.documentElement.dataset.theme === 'princess'`, 5000, 'still princess after a reload');
  noErrors(tab, 'switching');
  await tab.close();
});

test('clicking through the forms fast settles on the last one, with no timers left piling up', async () => {
  const tab = await chrome.open(site.origin + '/', { init: TIMERS });
  await booted(tab);
  const order = ['princess', 'blobfish', 'red', 'yellow', 'cyan', 'blobfish', 'princess', 'red', 'blobfish', 'cyan', 'princess', 'yellow', 'blobfish', 'red', 'princess'];
  await tab.eval(`(async () => { for (const f of ${JSON.stringify(order)}) { document.querySelector('[data-theme-btn="' + f + '"]').click(); await new Promise((r) => setTimeout(r, 25)); } })()`);
  await tab.until(`!document.getElementById('tuber').classList.contains('glitching') && document.getElementById('glitch').innerHTML === ''`, 5000, 'the last switch to finish');
  assert.equal(await tab.eval('document.documentElement.dataset.theme'), order.at(-1));
  assert.equal(await tab.eval(`document.getElementById('tuber').classList.contains('glitching') || document.getElementById('glitch').innerHTML !== ''`), false, 'the glitch finished');
  // settled: only the blink cycle (and a speech bubble's two) should still be scheduling; a runaway makes hundreds
  const made = await tab.eval('window.__timers.made');
  await sleep(1500);
  const [live, more] = await tab.eval('[window.__timers.live.size, window.__timers.made - ' + made + ']');
  assert.ok(more <= 6, `${more} timers created in 1.5 s after settling: something keeps scheduling itself`);
  assert.ok(live <= 6, `${live} timers pending after settling`);
  noErrors(tab, 'fast switching');
  await tab.close();
});

test('live on Kick: the on-air state (?live=1 in development)', async () => {
  const tab = await chrome.open(site.origin + '/?live=1');
  await tab.until(`document.documentElement.dataset.live === 'true'`);
  assert.equal(await tab.eval(`document.querySelector('[data-status]').textContent`), 'Live now');
  noErrors(tab, 'live');
  await tab.close();
});

test('videos: the static feed.json when /api/feed fails, the live list when it works (whichever answers first)', async () => {
  site.api['/api/feed'] = { status: 500, body: { error: 'down' } };
  let tab = await chrome.open(site.origin + '/');
  await tab.until(`document.querySelector('#feat [data-yt]')`);
  assert.equal(await tab.eval(`document.querySelector('#feat [data-yt]').dataset.yt`), FEED.videos[0].id);
  assert.equal(await tab.eval(`document.querySelector('[data-status]').textContent`), 'Standing by');
  await tab.close();
  // the API answers first and feed.json late: the static list must not overwrite the live one
  site.api['/api/feed'] = { body: API() }; site.delays['/feed.json'] = 800;
  tab = await chrome.open(site.origin + '/');
  // wait for the late feed.json to have arrived (its resource entry appears once it has), then check it lost
  await tab.until(`performance.getEntriesByType('resource').some((e) => e.name.endsWith('/feed.json'))`, 5000, 'feed.json to arrive');
  await sleep(50);
  assert.equal(await tab.eval(`document.querySelector('#feat [data-yt]').dataset.yt`), 'apiVideo001');
  assert.equal(await tab.eval(`document.querySelector('[data-followers]').textContent`), '123');
  delete site.delays['/feed.json'];
  noErrors(tab, 'feed');
  await tab.close();
});

test('reduced motion: switching still works, with no glitch', async () => {
  const tab = await chrome.open(site.origin + '/', { reducedMotion: true });
  await booted(tab);
  await tab.eval(`window.__sawGlitch = false; new MutationObserver(() => { if (document.getElementById('glitch').innerHTML) window.__sawGlitch = true; }).observe(document.getElementById('glitch'), { childList: true }); 1`);
  await tab.click('[data-theme-btn="blobfish"]');
  await tab.until(`[...document.querySelectorAll('#tuber img')].some((i) => i.currentSrc.includes('blobfish'))`);
  assert.equal(await tab.eval('window.__sawGlitch'), false);
  noErrors(tab, 'reduced motion');
  await tab.close();
});
