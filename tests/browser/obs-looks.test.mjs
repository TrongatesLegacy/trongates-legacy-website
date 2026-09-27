// Princess Trina's and the Blobfish's looks in the OBS scenes (public/obs/shared/overlay.css, "Form looks"): the titles'
// font, the frames, the background and floor, the switch-in. Every OBS source is placed on a scene by its pixels, so a look
// change may move nothing: measured against Tron in every scene and widget page, while the look swaps behind a blur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

const HD = { width: 1920, height: 1080 };
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });
const FONTS = { tron: 'Orbitron', princess: 'Cinzel Decorative', blobfish: 'Lilita One' };

// layout boxes (offset*, so the now playing slide-in and the floating letters don't count) of everything a source is placed
// on or next to, and of the text blocks the titles sit in
const MEASURE = `(() => {
  const box = (el) => { let x = 0, y = 0; for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y, el.offsetWidth, el.offsetHeight].join(); };
  const out = {};
  document.querySelectorAll('[data-slot], .frame, .np, .gamewin, .stage, .title, .copy > *, .ticker .item').forEach((el, i) => { out[i + ' ' + (el.dataset.slot || el.classList[0])] = box(el); });
  return out;
})()`;
// a pick has fully landed: the look is on, its font is drawing the titles and the swap's blur is gone
async function pick(tab, form, look) {
  await tab.eval(`TGL.set(${JSON.stringify(form)}); 1`);
  await tab.until(`document.documentElement.dataset.look === ${JSON.stringify(look)}`, 4000, `${form}: the ${look} look`);
  await tab.until(`document.fonts.check('900 20px "${FONTS[look]}"')`, 4000, `${form}: the ${FONTS[look]} font`);
  await tab.until(`document.getAnimations().every((a) => a instanceof CSSAnimation || a instanceof CSSTransition)`, 3000, `${form}: the swap's blur to clear`);
}

test('switching looks moves nothing in any scene or widget page: every source lands on the same pixels', async () => {
  const pages = ['starting', 'brb?demo=1', 'chatting?demo=1', 'game', 'game?layout=window&demo=1', 'ending', 'chat?demo=1', 'goal?demo=1', 'music'];
  for (const p of pages) {
    const tab = await chrome.open(`${site.origin}/obs/${p}${p.includes('?') ? '&' : '?'}noveado=1&cycle=0&music=demo&form=cyan`, HD);
    await tab.eval('document.fonts.ready.then(() => 1)');
    const base = await tab.eval(MEASURE);
    assert.ok(Object.keys(base).length > 0, `${p}: something to measure`);
    for (const [form, look] of [['princess', 'princess'], ['blobfish', 'blobfish'], ['red', 'tron'], ['princess', 'princess'], ['cyan', 'tron']]) {
      await pick(tab, form, look);
      assert.deepEqual(await tab.eval(MEASURE), base, `${p}, ${form}: something moved`);
    }
    assert.deepEqual(tab.errors, [], `${p}: errors`);
    await tab.close();
  }
});

test('the titles draw in the look\'s font, and every line stays inside its column', async () => {
  for (const scene of ['starting', 'brb', 'game', 'ending']) for (const form of ['princess', 'blobfish']) {
    const tab = await chrome.open(`${site.origin}/obs/${scene}?noveado=1&cycle=0&form=${form}`, HD);
    await tab.eval('document.fonts.ready.then(() => 1)');
    assert.ok(await tab.eval(`getComputedStyle(document.querySelector('.title .twin')).fontFamily.startsWith('"${FONTS[form]}"')`), `${scene}, ${form}: the title's font`);
    const over = await tab.eval(`(() => { const col = document.querySelector('.copy').getBoundingClientRect();
      return [...document.querySelectorAll('.title .twin > span')].map((l) => l.getBoundingClientRect()).filter((b) => b.left < col.left - 1 || b.right > col.right + 1).length; })()`);
    assert.equal(over, 0, `${scene}, ${form}: a title line reaches outside its column`);
    await tab.close();
  }
});

test('the look is there from the first frame (?form=), and looks= (the dock\'s Form looks) can change it', async () => {
  const cases = [['form=blobfish', 'blobfish'], ['form=princess', 'princess'], ['form=red', 'tron'],
    ['form=princess&looks=princess:tron', 'tron'], ['form=red&looks=red:blobfish', 'blobfish'], ['form=blobfish&looks=0', 'tron'], ['form=princess&looks=nonsense:x', 'princess']];
  for (const [q, look] of cases) {
    const tab = await chrome.open(`${site.origin}/obs/starting?noveado=1&cycle=0&${q}`, HD);
    assert.equal(await tab.eval('document.documentElement.dataset.look'), look, q);
    await tab.close();
  }
  // a form picked later follows the map too: Princess with her look turned off stays on Tron's
  const tab = await chrome.open(`${site.origin}/obs/chatting?noveado=1&form=cyan&looks=princess:tron`, HD);
  await tab.eval(`TGL.set('princess'); 1`);
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(await tab.eval('document.documentElement.dataset.look + " " + document.documentElement.dataset.form'), 'tron princess');
  await pick(tab, 'blobfish', 'blobfish');
  await tab.close();
});

test('a cycling scene: the look follows the form on show, and each form switches in its own way', async () => {
  const tab = await chrome.open(`${site.origin}/obs/starting?noveado=1&motion=full&form=cyan`, HD);
  await tab.eval('document.fonts.ready.then(() => 1)');
  await tab.eval(`(() => {
    const g = document.querySelector('.art-glitch');
    window.__seen = { soft: false, sparkles: 0, bands: 0 };
    new MutationObserver(() => {
      __seen.soft ||= g.classList.contains('soft');
      __seen.sparkles = Math.max(__seen.sparkles, g.querySelectorAll('s').length);
      __seen.bands = Math.max(__seen.bands, g.querySelectorAll('i').length);
    }).observe(g, { childList: true, attributes: true });
    return 1;
  })()`);
  const reset = () => tab.eval(`window.__seen = { soft: false, sparkles: 0, bands: 0 }; 1`);
  const done = () => tab.until(`!document.querySelector('.art-stage .art').classList.contains('glitching')`, 4000, 'the switch-in to finish');
  await pick(tab, 'princess', 'princess'); await done();
  const princess = await tab.eval('__seen');
  assert.ok(princess.soft && princess.sparkles > 0, `Princess sparkles in (${JSON.stringify(princess)})`);
  await reset(); await pick(tab, 'blobfish', 'blobfish'); await done();
  const blobfish = await tab.eval('__seen');
  assert.ok(blobfish.soft && blobfish.sparkles === 0 && blobfish.bands >= 28, `the Blobfish ripples in: two layers of 14 bands (${JSON.stringify(blobfish)})`);
  await reset(); await pick(tab, 'yellow', 'tron'); await done();
  const tron = await tab.eval('__seen');
  assert.ok(!tron.soft && tron.sparkles === 0 && tron.bands > 0, `Tron glitches in (${JSON.stringify(tron)})`);
  // and the cycle itself carries the look along (6 s a form): wait for the next turn
  const before = await tab.eval('document.documentElement.dataset.form');
  await tab.until(`document.documentElement.dataset.form !== ${JSON.stringify(before)}`, 8000, 'the next turn of the cycle');
  await tab.until(`document.documentElement.dataset.look === TGL.lookOf(document.documentElement.dataset.form)`, 3000, 'the look to follow the cycle');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// The floors slide forward and jump back once a loop; the jump is invisible only if a loop is a whole number of the
// pattern's repeats (Princess's checker repeats every two cells). Compared: the floor just before the jump and just after.
test('every look\'s floor loops seamlessly: the frame before each jump matches the frame after it', async () => {
  for (const [form, cls] of [['cyan', 'f-grid'], ['princess', 'f-ball'], ['blobfish', 'f-sand']]) {
    const tab = await chrome.open(`${site.origin}/obs/chatting?noveado=1&form=${form}`, HD);
    await tab.eval('document.fonts.ready.then(() => 1)');
    const box = await tab.eval(`(() => {
      document.getElementById('trails').style.display = 'none';
      document.querySelectorAll('.content, .ticker').forEach((e) => (e.style.visibility = 'hidden'));
      document.getAnimations().forEach((a) => a.pause());
      const b = document.querySelector('.floor.${cls}').getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height, scale: .5 };
    })()`);
    const at = async (edge) => {
      await tab.eval(`(() => { const a = document.getAnimations().find((a) => a.effect.target?.classList?.contains('${cls}') && a.effect.pseudoElement === '::before');
        const d = a.effect.getComputedTiming().duration; a.currentTime = ${edge === 'end' ? 'd - 1' : '0'}; return 1; })()`);
      await tab.eval('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
      return (await tab.send('Page.captureScreenshot', { format: 'png', clip: box })).data;
    };
    const [start, end] = [await at('start'), await at('end')];
    const differ = await tab.eval(`(async () => {
      const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
      const [a, b] = await Promise.all([load(${JSON.stringify(start)}), load(${JSON.stringify(end)})]);
      const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const p = px(a), q = px(b); let n = 0;
      for (let k = 0; k < p.length; k += 4) if (Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 24) n++;
      return n / (p.length / 4);
    })()`);
    assert.ok(differ < .002, `${form}: ${(differ * 100).toFixed(2)}% of the floor changes at the loop's jump`);
    await tab.close();
  }
});

// OBS renders every scene all the time, on the streaming PC: the looks' endless animations may never animate anything
// that makes the browser lay the page out again
test('no endless animation in any look changes a size or a position in the layout', async () => {
  const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|font|line-height|letter-spacing|border-width|gap)/;
  for (const form of ['cyan', 'princess', 'blobfish']) {
    const tab = await chrome.open(`${site.origin}/obs/starting?noveado=1&cycle=0&music=demo&form=${form}`, HD);
    await tab.eval('document.fonts.ready.then(() => 1)');
    const props = await tab.eval(`[...new Set(document.getAnimations().filter((a) => a instanceof CSSAnimation && a.effect.getTiming().iterations === Infinity)
      .flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)))))]`);
    const bad = props.filter((p) => LAYOUT.test(p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())));
    assert.deepEqual(bad, [], `${form}: animates ${bad}`);
    assert.ok(props.length > 3, `${form}: found its animations (${props})`);
    await tab.close();
  }
});
