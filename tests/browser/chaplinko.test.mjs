// Chaplinko in headless Chrome: the pages load clean, the board plays from (fake) Twitch and Kick chat and scores the
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

test('with no channel the board asks to be set up, and connects to nothing', async () => {
  const tab = await chrome.open(site.origin + '/chaplinko/play.html', { width: 640, height: 540, init: FAKE_CHAT });
  await ready(tab);
  assert.match(await tab.eval('document.getElementById("msg").textContent'), /Add your channel/);
  assert.equal(await tab.eval('window.chaplinko.running'), false, 'nothing animates');
  await tab.close();
});

test('drops from Twitch and Kick land and score the right people; the loop stops once the board is idle', async () => {
  const tab = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab);
  await sleep(300);
  await tab.eval(`__chat.twitch('PixelPanda', '!plinko', { color: '#FF4F9A' }); __chat.kick('NeonNacho', '!plinko 🔥', { color: '#1E90FF' }); __chat.twitch('Nightbot', '!plinko'); 1`);
  assert.equal(await tab.eval('chaplinko.game.queued + chaplinko.world.balls.length'), 10, 'two drops of five; the bot is ignored');
  await tab.until('chaplinko.game.queued === 0 && chaplinko.world.balls.length === 0', 15000, 'every ball to land');
  const all = await tab.eval('JSON.stringify(Object.fromEntries(Object.entries(chaplinko.scores.allTime).map(([k, p]) => [k, p.words])))');
  assert.deepEqual(JSON.parse(all), { 'twitch:pixelpanda': 5, 'kick:neonnacho': 5 }, 'five balls each, to whoever dropped them');
  assert.equal(await tab.eval('chaplinko.scores.record.status'), 'live');
  await tab.until('chaplinko.running === false', 5000, 'the animation loop to stop when nothing moves');
  const saved = await tab.eval(`JSON.parse(localStorage.getItem('chaplinko:scores:v1:gridrunner|gridrunner')).allTime['twitch:pixelpanda'].words`);
  assert.equal(saved, 5, 'the scores are saved for the leaderboard source');
  noErrors(tab, 'the board');
  await tab.close();
});

test('the separate leaderboard follows the board from another tab (as two OBS sources): new players, climbing, a jackpot glow', async () => {
  const board = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(board);
  const lb = await chrome.open(site.origin + '/chaplinko/leaderboard.html?twitch=gridrunner&kick=gridrunner&lbshow=stream', { width: 300, height: 270 });
  await ready(lb);
  assert.match(await lb.eval('document.querySelector(".lb").textContent'), /No drops yet/);
  await board.eval(`chaplinko.land({ platform: 'twitch', user: 'pixelpanda', name: 'PixelPanda' }, 5); chaplinko.land({ platform: 'kick', user: 'neonnacho', name: 'NeonNacho' }, 4); 1`);
  await lb.until(`[...document.querySelectorAll('.lb .row .n')].map((n) => n.textContent).join() === 'NeonNacho,PixelPanda'`, 4000, 'both players, highest first');
  // a jackpot: the winner climbs to the top and their row glows
  await board.eval(`chaplinko.land({ platform: 'twitch', user: 'pixelpanda', name: 'PixelPanda' }, 0); 1`);
  await lb.until(`document.querySelector('.lb .row .n').textContent === 'PixelPanda'`, 4000, 'the jackpot winner at the top');
  await lb.until(`document.querySelector('.lb .row.jp')?.dataset.key === 'twitch:pixelpanda'`, 3000, 'their row glowing');
  noErrors(lb, 'the leaderboard'); noErrors(board, 'the board');
  await lb.close(); await board.close();
});

test('every size fits in every theme: the board, combined, the panel (as tall as its players) and the strip', async () => {
  const cases = [['/chaplinko/play.html?demo=1', 640, 540, '.board'], ['/chaplinko/play.html?demo=1&layout=combined', 960, 540, '.w'],
    ['/chaplinko/leaderboard.html?demo=1&lbn=8', 300, 372, '.lb'], ['/chaplinko/leaderboard.html?demo=1&lbshape=strip', 720, 72, '.lb']];
  for (const [p, w, h, sel] of cases) for (const theme of ['chaplinko', 'royal', 'light']) {
    const tab = await chrome.open(site.origin + `${p}&theme=${theme}&bgo=100`, { width: w, height: h });
    await ready(tab); await sleep(200);
    const box = JSON.parse(await tab.eval(`JSON.stringify((() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), sw: document.documentElement.scrollWidth }; })())`));
    assert.ok(box.w <= w && box.h <= h + 1, `${p} ${theme}: ${box.w} × ${box.h} fits ${w} × ${h}`);
    assert.ok(box.sw <= w, `${p} ${theme}: nothing wider than the source`);
    await tab.close();
  }
});

test('a live theme message restyles the board without restarting it; a bad one is ignored', async () => {
  const tab = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab); await sleep(200);
  await tab.eval(`__chat.twitch('PixelPanda', '!plinko'); 1`);
  const before = await tab.eval('chaplinko.game.queued + chaplinko.world.balls.length');
  await tab.eval(`postMessage({ type: 'widget-theme', theme: 'neon', accent: 'ff4155' }, '*'); postMessage({ type: 'widget-theme', theme: 'nope' }, '*'); 1`);
  await tab.until(`document.getElementById('w').dataset.theme === 'neon'`, 2000, 'the new theme');
  assert.equal(await tab.eval(`getComputedStyle(document.getElementById('w')).getPropertyValue('--accent').trim()`), '#ff4155');
  assert.equal(await tab.eval('chaplinko.game.queued + chaplinko.world.balls.length'), before, 'the balls kept falling (no reload)');
  await tab.close();
});

test('the OBS wrapper follows the form, for the board and the leaderboard: Tron neon in his armour colour, Princess Trina royal, the Blobfish deep', async () => {
  for (const part of ['', '&part=leaderboard']) {
    const tab = await chrome.open(site.origin + `/obs/chaplinko?noveado=1&demo=1&form=red${part}`, { width: 640, height: 540 });
    await tab.until('window.chaplinkoWrapper && chaplinkoWrapper.frame.contentDocument?.documentElement.dataset.ready === "1"', 8000, 'the game inside');
    const look = () => tab.eval(`(() => { const w = chaplinkoWrapper.frame.contentDocument.getElementById('w'); return w.dataset.theme + ' ' + w.style.getPropertyValue('--accent'); })()`);
    assert.equal(await tab.eval('chaplinkoWrapper.page'), part ? 'leaderboard' : 'play');
    assert.match(await look(), /^neon #/);
    await tab.eval(`TGL.set('princess'); 1`);
    await tab.until(`chaplinkoWrapper.frame.contentDocument.getElementById('w').dataset.theme === 'royal'`, 3000, 'royal for Princess Trina');
    await tab.eval(`TGL.set('blobfish'); 1`);
    await tab.until(`chaplinkoWrapper.frame.contentDocument.getElementById('w').dataset.theme === 'deep'`, 3000, 'deep for the Blobfish');
    await tab.close();
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

test('reduced motion: nothing falls, the points still land and score; the leaderboard just changes', async () => {
  const tab = await chrome.open(site.origin + BOARD + '&motion=reduce&layout=combined', { width: 960, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab); await sleep(200);
  await tab.eval(`__chat.twitch('PixelPanda', '!plinko'); 1`);
  await tab.until('chaplinko.game.queued === 0', 5000, 'the queue to empty');
  assert.equal(await tab.eval('chaplinko.world.balls.length'), 0, 'no ball ever on the board');
  assert.equal(await tab.eval(`chaplinko.scores.allTime['twitch:pixelpanda'].words`), 5);
  assert.equal(await tab.eval('document.getAnimations().length'), 0, 'nothing animating');
  await tab.close();
});

test('Frenzy: a flood of drops pours through, the chute counts the queue down, and it all drains and calms', async () => {
  const tab = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab); await sleep(200);
  await tab.eval(`for (let i = 0; i < 40; i++) __chat.twitch('P' + i, '!plinko'); 1`);
  await tab.until(`chaplinko.game.level === 'frenzy'`, 3000, 'Frenzy');
  assert.match(await tab.eval('document.getElementById("chute").textContent'), /FRENZY/);
  assert.ok(await tab.eval('document.getElementById("w").classList.contains("frenzy")'));
  await tab.until('chaplinko.game.queued === 0 && chaplinko.world.balls.length === 0', 30000, 'the flood to drain');
  assert.equal(await tab.eval('Object.values(chaplinko.scores.allTime).reduce((n, p) => n + p.words, 0)'), 200, 'every ball scored');
  await tab.until(`chaplinko.game.level === 'quiet' || !chaplinko.running`, 6000, 'it calms down');
  noErrors(tab, 'Frenzy');
  await tab.close();
});

test('an emote the platform marked drops as that emote; when its picture can\'t load, a plain ball falls instead', async () => {
  const tab = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab); await sleep(200);
  await tab.eval(`__chat.twitch('PixelPanda', '!plinko Kappa', { emotes: '25:8-12' }); 1`);
  await tab.until('chaplinko.world.balls.length > 0', 3000, 'the first ball');
  const item = JSON.parse(await tab.eval('JSON.stringify(chaplinko.world.balls[0].data.item)'));
  assert.deepEqual(item, { kind: 'emote', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0', name: 'Kappa' });
  // outside requests are blocked here, like an emote that fails to load: the ball still falls and scores
  await tab.until('chaplinko.world.balls.length === 0 && chaplinko.game.queued === 0', 15000, 'the emotes to land');
  assert.equal(await tab.eval(`chaplinko.scores.allTime['twitch:pixelpanda'].words`), 5);
  noErrors(tab, 'emotes');
  await tab.close();
});

test('an animated emote plays while it falls: its frames are decoded (a canvas would only draw the first)', async () => {
  const tab = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab); await sleep(200);
  await tab.eval(`chaplinko.hear({ platform: 'kick', user: 'b', name: 'B', text: '!plinko [emote:1:anim]', emotes: [{ id: '1', name: 'anim', url: location.origin + '/test/anim.gif' }] }); 1`);
  await tab.until('chaplinko.world.balls.length > 0', 3000, 'the first ball');
  await tab.until('(chaplinko.world.balls[0]?.data.img.frames || []).length === 4', 5000, 'the GIF\'s four frames decoded');
  assert.ok(await tab.eval('chaplinko.world.balls[0].data.img.total') > 300, 'with their timing');
  noErrors(tab, 'animated emotes');
  await tab.close();
});

test('jackpots in quick succession grow one live card (a streak, never a queue of cards), which then explodes', async () => {
  const tab = await chrome.open(site.origin + BOARD, { width: 640, height: 540, init: FAKE_CHAT + CLEAN + LIVE });
  await ready(tab); await sleep(200);
  const land = (user, name, slot) => tab.eval(`chaplinko.land({ platform: 'twitch', user: '${user}', name: '${name}' }, ${slot}); 1`);
  await land('pixelpanda', 'PixelPanda', 0); await sleep(600);
  await land('neonnacho', 'NeonNacho', 10); await sleep(400);
  await land('pixelpanda', 'PixelPanda', 10); await sleep(300);
  assert.equal(await tab.eval('document.querySelectorAll(".card").length'), 1, 'one card, however many jackpots');
  const text = await tab.eval('document.querySelector(".card").innerText');
  assert.match(text, /×3/, 'the count'); assert.match(text, /PixelPanda\s*×2/, 'the same person twice'); assert.match(text, /NeonNacho/);
  assert.match(text, /3 jackpots in a row/);
  await tab.until('document.querySelector(".card .pts").textContent === "+300"', 3000, 'the points counted on to the streak\'s total');
  // it ends 2 s after the last jackpot (at least 4 s after it opened), exploding: no card left, the board still animating
  await tab.until('!document.querySelector(".card") && !document.querySelector(".dim")', 8000, 'the card to go');
  await land('pixelpanda', 'PixelPanda', 0); await sleep(300);
  assert.doesNotMatch(await tab.eval('document.querySelector(".card").innerText'), /×/, 'a later jackpot starts a fresh card');
  noErrors(tab, 'the jackpot streak');
  await tab.close();
});

test('combined: the leaderboard beside the board can have its own theme and its own background', async () => {
  const tab = await chrome.open(site.origin + '/chaplinko/play.html?demo=1&layout=combined&theme=chaplinko&bgo=0&lbtheme=royal&lbbgo=100', { width: 960, height: 540 });
  await ready(tab);
  assert.equal(await tab.eval('document.querySelector(".lbw").dataset.theme'), 'royal');
  assert.equal(await tab.eval('document.querySelector(".lbw").classList.contains("clear")'), false, 'solid');
  assert.equal(await tab.eval('document.getElementById("board").classList.contains("clear")'), true, 'while the board is transparent');
  await tab.eval(`postMessage({ type: 'widget-theme', theme: 'neon' }, '*'); 1`);
  await tab.until(`document.getElementById('w').dataset.theme === 'neon'`, 2000, 'the board restyled');
  assert.equal(await tab.eval('document.querySelector(".lbw").dataset.theme'), 'royal', 'the leaderboard keeps its own');
  await tab.close();
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
  assert.doesNotMatch(await tab.eval('document.getElementById("hero-frame").src'), /animate=1/);
  await click('#hero-rm button');
  await tab.until('/animate=1/.test(document.getElementById("hero-frame").src) && /animate=1/.test(document.getElementById("pv").src)', 3000, 'both boards to animate');
  await tab.until('document.getElementById("hero-frame").contentWindow.chaplinko?.world.balls.length > 0', 10000, 'balls falling in the hero');
  assert.equal(await tab.eval('chaplinkoSetup.boardLink()'), site.origin + '/chaplinko/play?kick=gridrunner', 'the OBS link never carries it');
  assert.equal(await tab.eval('localStorage.getItem("chaplinko:animate")'), '1', 'remembered');
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
