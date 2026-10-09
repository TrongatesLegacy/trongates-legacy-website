// The phone menu on the widget pages (owner, 2026-10-09): /widgets/, /chatagram/ and /chaplinko/ hide their section
// links on narrow screens; a ☰ button (widgets/lib/menu.js) opens them under the header, plus the links the page hides.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });

const PAGES = { '/widgets/': ['#lineup', '#why', '#setup', '/chatagram/', '/chaplinko/', '/'],
  '/chatagram/': ['#how', '#themes', '#setup', '#faq', '/widgets/', '/'], '/chaplinko/': ['#how', '#looks', '#setup', '#faq', '/widgets/', '/'] };
for (const [page, want] of Object.entries(PAGES)) {
  test(`${page}: a phone menu with the page's links; closed by a link, Esc or a tap outside; none on a desktop`, async () => {
    const tab = await chrome.open(site.origin + page, { width: 390, height: 844, mobile: true });
    await tab.until(`document.getElementById('mpanel')`, 8000, 'the menu');
    const st = `({ open: document.querySelector('.mbtn').getAttribute('aria-expanded'), hidden: document.getElementById('mpanel').hidden })`;
    assert.equal(await tab.eval(`getComputedStyle(document.querySelector('.mbtn')).display`), 'block');
    assert.deepEqual(await tab.eval(`[...document.querySelectorAll('#mpanel a')].map((a) => a.getAttribute('href'))`), want);
    assert.ok(await tab.eval(`[...document.querySelectorAll('#mpanel a')].every((a) => a.textContent.trim().length > 1)`), 'every link has words');
    await tab.click('.mbtn');
    assert.deepEqual(await tab.eval(st), { open: 'true', hidden: false });
    assert.equal(await tab.eval(`document.activeElement.getAttribute('href')`), want[0], 'from the keyboard, focus goes into the menu');
    assert.equal(await tab.eval(`document.documentElement.scrollWidth - innerWidth`), 0, 'no sideways scroll when open');
    await tab.click(`#mpanel a[href="${want[1]}"]`);
    assert.equal((await tab.eval(st)).hidden, true, 'a link closes it');
    await tab.click('.mbtn');
    await tab.eval(`dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
    assert.equal((await tab.eval(st)).hidden, true, 'Esc closes it');
    assert.equal(await tab.eval(`document.activeElement.className`), 'mbtn', 'and focus goes back to the button');
    await tab.click('.mbtn');
    await tab.eval(`document.querySelector('main').click(); 1`);
    assert.equal((await tab.eval(st)).hidden, true, 'a tap outside closes it');
    assert.deepEqual(tab.errors, []);
    await tab.close();
    const desk = await chrome.open(site.origin + page, { width: 1440, height: 900 });
    await sleep(300);
    assert.equal(await desk.eval(`getComputedStyle(document.querySelector('.mbtn')).display`), 'none', 'none on a desktop');
    await desk.close();
  });
}
