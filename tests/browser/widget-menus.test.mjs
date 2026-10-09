// The section menu on the Chatagram and Chaplinko pages: the link you click is the one lit, and scrolling lights the
// section at the top of the view (the last one at the very bottom). "How it works" is short, so a click on it used to
// light the next section (Themes, Looks), which was then the one crossing the middle of the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });

const lit = `[...document.querySelectorAll('.menu a.on')].map((a) => a.getAttribute('href')).join(',')`;
for (const [page, ids] of [['/chatagram/', ['how', 'themes', 'setup', 'faq']], ['/chaplinko/', ['how', 'looks', 'setup', 'faq']]]) {
  test(`${page}: a menu click lights that link; scrolling lights the section at the top`, async () => {
    const tab = await chrome.open(site.origin + page, { width: 1440, height: 1300 });
    await tab.until(`document.querySelector('.menu a') && document.getElementById('faq')`, 8000, 'the page');
    for (const id of ids) {
      await tab.click(`.menu a[href="#${id}"]`);
      await tab.until(`${lit} === '#${id}'`, 4000, `${id} lit after its click`);
      await sleep(1200);                                                     // the smooth scroll has finished
      assert.equal(await tab.eval(lit), `#${id}`, `${id} still lit once the scroll settles`);
      // and the heading sits just under the menu bar (owner, 2026-10-09: a big empty band showed above it)
      const gap = await tab.eval(`Math.round(document.getElementById('${id}').querySelector('h2').getBoundingClientRect().top - document.querySelector('.nav').getBoundingClientRect().bottom)`);
      if (id !== 'faq') assert.ok(gap >= 8 && gap <= 32, `${id}: ${gap}px between the menu bar and its heading`);   // FAQ is last: the page may end first
    }
    // scrolling by hand: the section whose top has passed under the menu bar
    await tab.eval(`document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById('${ids[1]}').offsetTop + 40); 1`);
    await tab.until(`${lit} === '#${ids[1]}'`, 3000, `${ids[1]} lit after scrolling into it`);
    await tab.eval(`scrollTo(0, 0); 1`);
    await tab.until(`${lit} === ''`, 3000, 'nothing lit back at the top');
    await tab.eval(`scrollTo(0, document.documentElement.scrollHeight); 1`);
    await tab.until(`${lit} === '#faq'`, 3000, 'FAQ lit at the bottom');
    assert.deepEqual(tab.errors, []);
    await tab.close();
  });
}
