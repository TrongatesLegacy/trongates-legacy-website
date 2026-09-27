// Princess Trina's and the Blobfish's themes (public/index.html, "form themes"): picking them changes the titles' font,
// the buttons' and cards' shapes and the whole page's colours, and none of it may move anything up or down. Measured on
// desktop and phone against Tron: every section, title and button stays at the same place and the page keeps its height.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer({ api: { '/api/feed': { status: 500, body: {} } } }); });
test.after(async () => { await chrome?.close(); await site?.close(); });

// every test starts as a returning Tron visitor: the tabs share one browser, so a pick would otherwise carry over, and a
// first visit shows the "try another form" hint, which goes (and moves things) on the first pick whatever the form
const FRESH = `localStorage.setItem('tgl-form', 'cyan')`;
const booted = (tab) => tab.until(`[...document.querySelectorAll('body > button')].some((b) => b.textContent.startsWith('DEV'))`, 5000, 'the page script to start');
// layout positions (offsetTop ignores transforms, so the reveal and tilt animations don't count)
const MEASURE = `(() => {
  const top = (el) => { let y = 0; for (; el; el = el.offsetParent) y += el.offsetTop; return y; };
  const out = {};
  for (const q of ['.eyebrow', 'h1', '.lede', '.cta', '.gang', '.stage', '.armour', '.ticker', '#stream h2', '.stream', '#roster h2', '.roster', '.card h3', '.card p', '#videos h2', '.shorts-head', '#socials h2', '.bento', '.end .huge', '.end .btn', 'footer'])
    out[q] = top(document.querySelector(q));
  out['page height'] = document.documentElement.scrollHeight;
  return out;
})()`;
const LOOKS = { cyan: ['tron', 'Orbitron'], princess: ['princess', 'Cinzel Decorative'], blobfish: ['blobfish', 'Lilita One'], red: ['tron', 'Orbitron'], yellow: ['tron', 'Orbitron'] };

async function pick(tab, form) {
  await tab.click(`[data-theme-btn="${form}"]`);
  const [look, font] = LOOKS[form];
  await tab.until(`document.documentElement.dataset.look === ${JSON.stringify(look)} && !document.getElementById('tuber').classList.contains('glitching')`, 6000, `${form}: the switch to finish`);
  await tab.until(`document.fonts.check('900 20px "${font}"') && getComputedStyle(document.querySelector('h1')).fontFamily.startsWith(${JSON.stringify(font === 'Orbitron' ? 'Orbitron' : `"${font}"`)})`, 4000, `${form}: titles in ${font}`);
  // the blur-out/in animations the swap adds are gone again (a leftover would leave something invisible)
  await tab.until(`document.getAnimations().every((a) => a instanceof CSSAnimation || a instanceof CSSTransition)`, 3000, `${form}: the swap's blur to clear`);
}

for (const [label, opts] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844, mobile: true }]]) {
  test(`${label}: switching between Tron, Princess Trina and the Blobfish moves nothing up or down`, async () => {
    const tab = await chrome.open(site.origin + '/', { ...opts, init: FRESH });
    await booted(tab);
    await tab.until(`document.querySelector('#feat .yt')`, 5000, 'the video list');
    await tab.eval(`document.fonts.ready.then(() => 1)`);
    const base = await tab.eval(MEASURE);
    for (const form of ['princess', 'blobfish', 'red', 'princess', 'cyan']) {
      await pick(tab, form);
      assert.deepEqual(await tab.eval(MEASURE), base, `${label}, ${form}: something moved`);
    }
    assert.deepEqual(tab.errors, []);
    await tab.close();
  });
}

test('each form switches in its own way: Tron glitches, Princess Trina sparkles in, the Blobfish ripples in', async () => {
  const tab = await chrome.open(site.origin + '/', { init: FRESH });
  await booted(tab);
  // watch the switch-in layer: its style, and the most sparkles and bands it showed at once
  await tab.eval(`(() => {
    const g = document.getElementById('glitch');
    window.__seen = { soft: false, sparkles: 0, bands: 0 };
    new MutationObserver(() => {
      window.__seen.soft ||= g.classList.contains('soft');
      window.__seen.sparkles = Math.max(window.__seen.sparkles, g.querySelectorAll('s').length);
      window.__seen.bands = Math.max(window.__seen.bands, g.querySelectorAll('i').length);
    }).observe(g, { childList: true, attributes: true });
    return 1;
  })()`);
  const reset = () => tab.eval(`window.__seen = { soft: false, sparkles: 0, bands: 0 }; 1`);
  await pick(tab, 'princess');
  const princess = await tab.eval('window.__seen');
  assert.ok(princess.soft && princess.sparkles > 0, `Princess sparkles in (${JSON.stringify(princess)})`);
  await reset(); await pick(tab, 'blobfish');
  const blobfish = await tab.eval('window.__seen');
  assert.ok(blobfish.soft && blobfish.sparkles === 0 && blobfish.bands >= 28, `the Blobfish ripples in: two layers of 14 bands (${JSON.stringify(blobfish)})`);
  await reset(); await pick(tab, 'yellow');
  const tron = await tab.eval('window.__seen');
  assert.ok(!tron.soft && tron.sparkles === 0 && tron.bands > 0, `Tron glitches in (${JSON.stringify(tron)})`);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('a returning Blobfish visitor gets the look before first paint: titles in Lilita One, with no swap', async () => {
  const tab = await chrome.open(site.origin + '/', { init: `localStorage.setItem('tgl-form', 'blobfish')` });
  assert.equal(await tab.eval(`document.documentElement.dataset.look`), 'blobfish');
  assert.ok(await tab.eval(`[...document.querySelectorAll('link[rel=preload][as=font]')].some((l) => l.href.endsWith('/lilita-one.woff2'))`), 'its font is preloaded');
  await tab.until(`document.fonts.check('400 20px "Lilita One"')`, 4000, 'the title font');
  assert.equal(await tab.eval(`document.querySelectorAll('h1 .ch').length`), 'TrongatesLegacy'.length, 'the title is split into letters for the swell');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
