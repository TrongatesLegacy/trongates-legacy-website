// Chaplinko's pages in headless Chrome (split from chaplinko.test.mjs, 2026-10-09, so the two run side by side): every
// page loads clean; the set-up page writes the links the board reads, its previews, reduced motion, Reset. The old summary:
// the pages load clean, the board plays from (fake) Twitch and Kick chat and scores the
// right people, the separate leaderboard follows the board from another tab (shared storage + BroadcastChannel, as two
// OBS sources), every size fits in every theme, a theme message never restarts it, the OBS wrapper follows the form, the
// set-up page writes both links, reduced motion drops nothing, Frenzy drains and the loop stops when the board is idle.
// Nothing reaches Twitch or Kick: outside requests are blocked, the chat sockets are faked, "is it live" is stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { readFileSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site;
// an animated GIF served like an emote (the real image servers are blocked here)
test.before(async () => { chrome = await launch(); site = await siteServer({ files: { '/test/anim.gif': readFileSync(new URL('../fixtures/anim.gif', import.meta.url)) } }); });
test.after(async () => { await chrome?.close(); await site?.close(); });
const noErrors = (tab, what) => assert.deepEqual(tab.errors, [], `${what}: errors in the page`);
const ready = (tab) => tab.until('document.documentElement.dataset.ready === "1"', 8000, 'the page to start');

// fake chat sockets; __chat.twitch(name, text, { color, emotes }) and __chat.kick(name, text, { color })
const FAKE_CHAT = `(() => {
  const socks = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; socks.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); if (url.includes('pusher')) this.recv('{"event":"pusher:connection_established","data":"{}"}'); }, 5); }
    send(d) { if (/^JOIN/.test(d)) setTimeout(() => this.recv(':x 366 x #c :End'), 5); if (d.includes('pusher:subscribe')) setTimeout(() => this.recv('{"event":"pusher_internal:subscription_succeeded","data":"{}"}'), 5); }
    recv(d) { this.onmessage && this.onmessage({ data: d }); }
    close() { this.readyState = 3; }
  }
  window.WebSocket = FakeWS;
  const by = (k) => socks.find((s) => s.url.includes(k));
  window.__chat = {
    twitch: (name, text, o = {}) => by('twitch').recv('@badges=' + (o.mod ? 'moderator/1' : '') + ';color=' + (o.color || '') + ';display-name=' + name + ';emotes=' + (o.emotes || '') + ';mod=' + (o.mod ? 1 : 0) + ' :' + name.toLowerCase() + '!x@x PRIVMSG #gridrunner :' + text),
    kick: (name, text, o = {}) => by('pusher').recv(JSON.stringify({ event: 'App\\\\Events\\\\ChatMessageEvent', data: JSON.stringify({ content: text, sender: { username: name, slug: name.toLowerCase(), identity: { color: o.color || '', badges: [] } } }) })),
  };
})();`;
// "is it live": stubbed before the board starts asking (the platforms' scripts are loaded by then)
const LIVE = `addEventListener('DOMContentLoaded', () => { for (const p of ['twitch', 'kick']) Widgets.platforms[p].stream = async () => ({ state: 'live', id: 's1', started: Date.now() - 60000 }); });`;
const CLEAN = `for (const k of Object.keys(localStorage)) if (k.startsWith('chaplinko:')) localStorage.removeItem(k);`;
const BOARD = '/chaplinko/play.html?twitch=gridrunner&kick=gridrunner&kickid=715&speed=fast';

test('the Chaplinko pages load without errors', async () => {
  const pages = ['/chaplinko/', '/chaplinko/play.html?demo=1', '/chaplinko/play.html?still=1&screen=jackpot', '/chaplinko/play.html',
    '/chaplinko/leaderboard.html?demo=1', '/chaplinko/leaderboard.html?demo=1&lbshape=strip', '/obs/chaplinko?noveado=1&demo=1', '/obs/chaplinko?part=leaderboard&noveado=1&demo=1',
    '/chaplinko/play.html?demo=1&layout=combined', '/chaplinko/check.html?n=2', '/widgets/'];
  for (let i = 0; i < pages.length; i += 3) {
    await Promise.all(pages.slice(i, i + 3).map(async (p) => {
      const tab = await chrome.open(site.origin + p, { width: 1280, height: 800 });
      await sleep(1500);
      noErrors(tab, p);
      await tab.close();
    }));
  }
});

test('the set-up page: defaults make short links, the leaderboard link carries its own look, combined makes one link', async () => {
  const tab = await chrome.open(site.origin + '/chaplinko/', { width: 1280, height: 900, init: `localStorage.removeItem('chaplinko:setup');` });
  await tab.until('window.chaplinkoSetup', 5000, 'the set-up');
  assert.equal(await tab.eval('document.getElementById("copy").disabled'), true, 'no channel yet');
  const type = (name, v) => tab.eval(`(() => { const el = document.querySelector('[name=${name}]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);   // typed, then left (the name is tidied)
  const click = (sel) => tab.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.click(); return 1; })()`);
  await type('kick', 'GridRunner');
  assert.equal(await tab.eval('chaplinkoSetup.boardLink()'), site.origin + '/chaplinko/play?kick=gridrunner');
  assert.equal(await tab.eval('chaplinkoSetup.lbLink()'), site.origin + '/chaplinko/leaderboard?kick=gridrunner');
  await click('input[name=rows][value="12"]'); await click('input[name=bgo][value="100"]');
  await click('#own'); await click('input[name=lbtheme][value="neon"]'); await click('input[name=lbshape][value="strip"]');
  const board = new URL(await tab.eval('chaplinkoSetup.boardLink()')).searchParams, lb = new URL(await tab.eval('chaplinkoSetup.lbLink()')).searchParams;
  assert.equal(board.get('rows'), '12'); assert.equal(board.get('bgo'), '100'); assert.equal(board.get('theme'), null);
  assert.equal(lb.get('theme'), 'neon', 'its own look'); assert.equal(lb.get('lbshape'), 'strip'); assert.equal(lb.get('rows'), null, 'only what the leaderboard uses');
  assert.equal(await tab.eval('document.getElementById("odds").children.length'), 7, 'the odds for 12 rows: 13 slots, each value once');
  await click('#odds-info button');
  assert.equal(await tab.eval('getComputedStyle(document.getElementById("odds-pop")).display'), 'block', 'where the odds come from opens on a tap');
  await click('input[name=layout][value="combined"]');
  assert.equal(await tab.eval('document.getElementById("copy-lb").hidden'), true, 'one link for combined');
  assert.equal(new URL(await tab.eval('chaplinkoSetup.boardLink()')).searchParams.get('layout'), 'combined');
  noErrors(tab, 'the set-up page');
  await tab.close();
});

test('the set-up page: the command is up to 6 characters after the ! (the idle prompt shows it big); an old longer link still plays', async () => {
  const tab = await chrome.open(site.origin + '/chaplinko/?kick=gridrunner&cmd=!dropballs', { width: 1280, height: 900, init: `localStorage.removeItem('chaplinko:setup');` });
  await tab.until('window.chaplinkoSetup', 5000, 'the set-up');
  const cmdOf = async () => new URL(await tab.eval('chaplinkoSetup.boardLink()')).searchParams.get('cmd');
  assert.equal(await cmdOf(), '!dropba', 'an old link opened here is shortened');
  const type = (v) => tab.eval(`(() => { const el = document.querySelector('[name=cmd]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return el.value; })()`);
  assert.equal(await type('!Drop'), '!drop');
  assert.equal(await type('!sixsix'), '!sixsix', 'six after the ! fits');
  assert.equal(await type('!sevense'), '!sevens');
  assert.equal(await type('dropper'), 'droppe', 'without a ! too');
  assert.equal(await tab.eval('document.querySelector("[name=cmd]").maxLength'), 7);
  noErrors(tab, 'command limit');
  await tab.close();
  const board = await chrome.open(site.origin + BOARD + '&cmd=!dropballs', { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(board); await sleep(200);
  await board.eval(`__chat.twitch('PixelPanda', '!dropballs'); 1`);
  await board.until(`chaplinko.game.queued > 0 || chaplinko.world.balls.length > 0`, 3000, 'an old OBS link keeps its command');
  await board.close();
});

test('the set-up page under reduced motion: the hero and the preview say why nothing falls, and can show it falling anyway', async () => {
  const init = `if (window === top) { localStorage.removeItem('chaplinko:setup'); localStorage.removeItem('chaplinko:animate'); }`;   // not in its frames
  const plain = await chrome.open(site.origin + '/chaplinko/?kick=gridrunner', { width: 1280, height: 900, init });
  await plain.until('window.chaplinkoSetup', 5000, 'the set-up');
  assert.equal(await plain.eval('document.getElementById("hero-rm").hidden && document.getElementById("pv-rm").hidden'), true, 'no note when motion is allowed');
  await plain.close();
  const tab = await chrome.open(site.origin + '/chaplinko/?kick=gridrunner', { width: 1280, height: 900, init, reducedMotion: true });
  await tab.until('window.chaplinkoSetup', 5000, 'the set-up');
  const click = (sel) => tab.eval(`(() => { document.querySelector(${JSON.stringify(sel)}).click(); return 1; })()`);
  await tab.until('document.getElementById("hero-frame").src && document.getElementById("pv").src', 5000, 'the boards to start');
  assert.equal(await tab.eval('document.getElementById("hero-rm").hidden || document.getElementById("pv-rm").hidden'), false, 'both say why');
  const over = (id, screen) => tab.eval(`(() => { const n = document.getElementById('${id}').getBoundingClientRect(), b = document.getElementById('${screen}').getBoundingClientRect(); return n.left <= b.left + 1 && n.right >= b.right - 1 && n.top <= b.top + 1 && n.bottom >= b.bottom - 1; })()`);
  assert.equal(await over('hero-rm', 'hero-screen'), true, 'over the whole hero board');
  assert.equal(await over('pv-rm', 'pv-screen'), true, 'over the whole preview');
  assert.doesNotMatch(await tab.eval('document.getElementById("hero-frame").src'), /animate=1/);
  await click('#hero-rm button');
  await tab.until('/animate=1/.test(document.getElementById("hero-frame").src) && /animate=1/.test(document.getElementById("pv").src)', 3000, 'both boards to animate');
  await tab.until('document.getElementById("hero-frame").contentWindow.chaplinko?.world.balls.length > 0', 10000, 'balls falling in the hero');
  assert.equal(await tab.eval('chaplinkoSetup.boardLink()'), site.origin + '/chaplinko/play?kick=gridrunner', 'the OBS link never carries it');
  assert.equal(await tab.eval('localStorage.getItem("chaplinko:animate")'), '1', 'remembered');
  assert.equal(await over('hero-rm', 'hero-screen'), false, 'then only a small way back, out of the way');
  await click('#pv-rm button');
  await tab.until('!/animate=1/.test(document.getElementById("hero-frame").src) && !/animate=1/.test(document.getElementById("pv").src)', 3000, 'back to reduced motion');
  await tab.eval(`(() => { const el = document.querySelector('[name=motion]'); el.value = 'reduce'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  assert.equal(await tab.eval('document.getElementById("pv-rm").hidden'), true, 'Minimal chosen: the preview is meant to drop nothing');
  noErrors(tab, 'reduced motion set-up');
  await tab.close();
});

test('the set-up page: the leaderboard\'s own accent; Reset to defaults resets every setting but the channels', async () => {
  const tab = await chrome.open(site.origin + '/chaplinko/?kick=gridrunner&rows=12&lbshow=all&bgo=100&cool=10', { width: 1280, height: 900, init: `localStorage.removeItem('chaplinko:setup');` });
  await tab.until('window.chaplinkoSetup', 5000, 'the set-up');
  const click = (sel) => tab.eval(`(() => { document.querySelector(${JSON.stringify(sel)}).click(); return 1; })()`);
  await click('#own'); await click('input[name=lbtheme][value="neon"]'); await click('input[name=lbaccentpick][value="ff3d8b"]');
  const lb = new URL(await tab.eval('chaplinkoSetup.lbLink()')).searchParams;
  assert.equal(lb.get('theme'), 'neon'); assert.equal(lb.get('accent'), 'ff3d8b', 'its own accent');
  assert.equal(await tab.eval('document.getElementById("reset").disabled'), false);
  await click('#reset');
  assert.equal(await tab.eval('chaplinkoSetup.boardLink()'), site.origin + '/chaplinko/play?kick=gridrunner', 'everything back to default but the channel');
  assert.equal(await tab.eval('chaplinkoSetup.lbLink()'), site.origin + '/chaplinko/leaderboard?kick=gridrunner');
  assert.equal(await tab.eval('document.getElementById("reset").disabled'), true, 'nothing left to reset');
  noErrors(tab, 'reset');
  await tab.close();
});
