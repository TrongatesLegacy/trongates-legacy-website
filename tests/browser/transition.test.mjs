// The transition overlay (public/obs/transition.html) in headless Chrome, driven by a fake OBS's transition events.
// Measured from the canvas: fully covered at the cut, completely clear before and after, in the form's colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { RealNet } from '../helpers/real-net.mjs';
import { fakeObs } from '../helpers/sim.mjs';

let chrome, site, net, obs, port;
test.before(async () => { chrome = await launch(); site = await siteServer(); net = new RealNet(9); obs = fakeObs(net, '127.0.0.1:0'); port = (await obs.listening).split(':')[1]; });
test.after(async () => { await chrome?.close(); await site?.close(); net?.close(); });

// the canvas shrunk to 192 × 108: the share of pixels fully opaque, any opacity, and in the accent colour
const MEASURE = `(() => { const c = document.createElement('canvas'); c.width = 192; c.height = 108; const g = c.getContext('2d');
  g.drawImage(document.getElementById('fx'), 0, 0, 192, 108); const d = g.getImageData(0, 0, 192, 108).data, n = 192 * 108;
  let full = 0, any = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] >= 250) full++; if (d[i] > 0) any++; }
  return { full: full / n, any: any / n }; })()`;
const open = async (q = '') => {
  const tab = await chrome.open(`${site.origin}/obs/transition?noveado=1&obs=${port}${q}`, { width: 1920, height: 1080 });
  await tab.until(`[...document.querySelectorAll('script')].length && window.TGLTransitionPlayer && document.readyState === 'complete'`);
  await new Promise((r) => setTimeout(r, 400));             // its OBS connection
  return tab;
};
// wait (in the page) until the transition is at `p`, then measure
const at = (tab, p) => tab.eval(`new Promise((ok) => { const t = () => { const pr = TGLTransitionPlayer.progress; if (pr !== null && pr >= ${p}) ok(${MEASURE}); else requestAnimationFrame(t); }; t(); })`, 5000);

for (const [name, label] of [['Trongates · Derez', 'Derez grid'], ['Trongates · Shutters', 'Logo shutters']]) {
  test(`${label}: clear when idle, the whole screen covered at the cut, clear again afterwards`, async () => {
    const tab = await open();
    assert.equal((await tab.eval(MEASURE)).any, 0, 'idle: nothing drawn');
    obs.broadcast('SceneTransitionStarted', { transitionName: name });
    for (const p of [.42, .5, .58]) {
      const m = await at(tab, p);
      assert.ok(m.full >= .995, `at ${p * 100}% only ${(m.full * 100).toFixed(1)}% covered`);
    }
    obs.broadcast('SceneTransitionEnded', { transitionName: name });
    await tab.until('TGLTransitionPlayer.playing === null', 3000, 'finished');
    assert.equal((await tab.eval(MEASURE)).any, 0, 'afterwards: nothing left on screen');
    assert.deepEqual(tab.errors, []);
    await tab.close();
  });
}

test('other transitions (Fade, Cut) draw nothing', async () => {
  const tab = await open();
  obs.broadcast('SceneTransitionStarted', { transitionName: 'Fade' });
  await new Promise((r) => setTimeout(r, 700));
  assert.equal((await tab.eval(MEASURE)).any, 0);
  assert.equal(await tab.eval('TGLTransitionPlayer.playing'), null);
  await tab.close();
});

test('drawn in the current form\'s colour, following the dock', async () => {
  const tab = await open('&form=princess');
  obs.broadcast('CustomEvent', { tgl: 'form', form: 'blobfish', at: Date.now() + 1000 });    // the dock picks Blobfish
  await tab.until(`TGL.form === 'blobfish'`, 3000, 'recoloured by the dock');
  obs.broadcast('SceneTransitionStarted', { transitionName: 'Trongates · Shutters' });
  const orange = await tab.eval(`new Promise((ok) => { const t = () => { const pr = TGLTransitionPlayer.progress; if (pr !== null && pr >= .5) {
    const g = document.getElementById('fx').getContext('2d'), d = g.getImageData(0, 0, 1920, 1080).data; let n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i] > 220 && d[i + 1] > 150 && d[i + 1] < 200 && d[i + 2] > 80 && d[i + 2] < 140) n++; ok(n); } else requestAnimationFrame(t); }; t(); })`, 5000);
  assert.ok(orange > 200, `${orange} pixels in Blobfish orange (#ffb36b)`);
  await tab.close();
});
