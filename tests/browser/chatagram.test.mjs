// Chatagram and the widgets pages in headless Chrome: the pages load clean, the overlay plays a whole game from (fake)
// Twitch and Kick chat, both layouts fit in every theme, a live theme message never restarts the game, the OBS wrapper
// follows a form switch, the set-up page writes the right link, and reduced motion. Nothing reaches Twitch or Kick:
// outside requests are blocked and the chat sockets are faked in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, TIMERS } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';
import { readAt } from '../helpers/sim.mjs';
import { readFileSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });
const noErrors = (tab, what) => assert.deepEqual(tab.errors, [], `${what}: errors in the page`);
const ready = (tab) => tab.until('document.documentElement.dataset.ready === "1"', 8000, 'the overlay to start');

// fake chat sockets: Twitch answers the JOIN, Kick subscribes; window.__chat.twitch/kick(name, text) sends a message
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
    twitch: (name, text, mod) => by('twitch').recv('@badges=' + (mod ? 'moderator/1' : '') + ';display-name=' + name + ';mod=' + (mod ? 1 : 0) + ' :' + name.toLowerCase() + '!x@x PRIVMSG #gridrunner :' + text),
    kick: (name, text) => by('pusher').recv(JSON.stringify({ event: 'App\\\\Events\\\\ChatMessageEvent', data: JSON.stringify({ content: text, sender: { username: name, slug: name.toLowerCase(), identity: { badges: [] } } }) })),
  };
})();`;

test('the widgets pages and the overlay load without errors', async () => {
  const pages = ['/widgets/', '/chatagram/', '/chatagram/play.html?demo=1', '/chatagram/play.html?still=1&screen=over&layout=compact', '/chatagram/play.html', '/obs/chatagram?noveado=1&demo=1'];
  for (let i = 0; i < pages.length; i += 3) {
    await Promise.all(pages.slice(i, i + 3).map(async (p) => {
      const tab = await chrome.open(site.origin + p, { width: 1280, height: 800 });
      await sleep(1500);
      noErrors(tab, p);
      await tab.close();
    }));
  }
});

test('with no channel the overlay asks to be set up, and connects to nothing', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html', { width: 960, height: 540, init: FAKE_CHAT });
  await ready(tab);
  assert.match(await tab.eval('document.getElementById("msg").textContent'), /Add your channel/);
  assert.equal(await tab.eval('window.chatagram.game.state.phase'), 'idle');
  await tab.close();
});

test('a whole game from Twitch and Kick chat: finds score, the round ends, the end card then the summary, crediting both chats', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?twitch=gridrunner&kick=gridrunner&kickid=715&next=5', { width: 960, height: 540, init: FAKE_CHAT });
  await ready(tab);
  await tab.until('document.querySelectorAll("#conn .dot.live").length === 2', 5000, 'both chats live');
  const words = await tab.eval('window.chatagram.game.state.round.answers.map((a) => a.word)');
  for (const [i, w] of words.entries()) await tab.eval(`__chat.${i % 2 ? 'kick' : 'twitch'}(${JSON.stringify(i % 3 ? 'PixelPanda' : 'NeonNacho')}, ${JSON.stringify(w.toUpperCase())}); 1`);
  await tab.until('window.chatagram.game.state.phase === "cleared"', 3000);
  // the end card first ("Cleared!" over the board), then the summary fades in; the board never flips
  // the last find gets its moment first: no end card straight away (owner, 2026-09-28)
  await sleep(700);
  assert.equal(await tab.eval('document.getElementById("endcard").classList.contains("on")'), false, 'the end card waited for the last find');
  await tab.until('/Cleared!/i.test(document.getElementById("endcard").textContent)', 3000, 'the end card');
  assert.equal(await tab.eval('document.getElementById("board").classList.contains("summary")'), false, 'no summary under the end card');
  await tab.until('document.getElementById("board").classList.contains("summary")', 6000, 'the summary to fade in');
  assert.equal(await tab.eval('document.getElementById("endcard").classList.contains("on")'), false);
  // nothing turns over: every transform is 'none' or a plain scale (no rotation terms)
  const transforms = await tab.eval('[...document.querySelectorAll(".card, .face")].map((el) => getComputedStyle(el).transform)');
  for (const t of transforms) assert.ok(t === 'none' || /^matrix\([\d.]+, 0, 0, [\d.]+, /.test(t), `rotated: ${t}`);
  const back = await tab.eval('document.querySelector(".back").textContent');
  assert.match(back, /Cleared!/); assert.match(back, /TWITCH VS KICK/); assert.match(back, /PixelPanda/);
  // moves on by itself
  await tab.eval('window.chatagram.advance(5000); 1');
  await tab.until('window.chatagram.game.state.level === 2 && !document.getElementById("board").classList.contains("summary")', 3000);
  // a regular viewer's !cg reset does nothing; a mod's works
  await tab.eval('__chat.twitch("PixelPanda", "!cg reset"); 1');
  assert.equal(await tab.eval('window.chatagram.game.state.level'), 2);
  await tab.eval('__chat.twitch("GridMod", "!cg reset", true); 1');
  assert.equal(await tab.eval('window.chatagram.game.state.level'), 1);
  noErrors(tab, 'game');
  await tab.close();
});

test('a right guess lights up its slot on the board (no bubble); wrong guesses show only when switched on', async () => {
  for (const wrong of [0, 1]) {
    const tab = await chrome.open(site.origin + `/chatagram/play.html?twitch=gridrunner${wrong ? '&wrong=1' : ''}`, { width: 960, height: 540, init: FAKE_CHAT });
    await ready(tab);
    await tab.until('document.querySelectorAll("#conn .dot.live").length === 1', 5000);
    const w = await tab.eval('chatagram.game.state.round.answers[0].word');
    await tab.eval(`__chat.twitch("PixelPanda", "${w}"); 1`);
    assert.ok(await tab.eval('!!document.querySelector("#words .w.new.got")'), 'the found word is highlighted on the board');
    assert.equal(await tab.eval('document.querySelectorAll(".bubble").length'), 0, 'no bubble for a right guess');
    await tab.eval(`__chat.twitch("NeonNacho", "${w}"); 1`);                // already found: a wrong guess
    assert.equal(await tab.eval('document.querySelectorAll(".bubble").length'), wrong, wrong ? 'wrong guesses shown' : 'wrong guesses hidden');
    await tab.eval('localStorage.clear(); 1');
    await tab.close();
  }
});

test('game over, then a new game after the restart delay; the round survives a refresh', async () => {
  const url = site.origin + '/chatagram/play.html?twitch=gridrunner';
  const tab = await chrome.open(url, { width: 960, height: 540, init: FAKE_CHAT });
  await ready(tab);
  const first = await tab.eval('window.chatagram.game.state.round.answers[0].word');
  await tab.eval(`__chat.twitch("PixelPanda", "${first}"); 1`);
  await sleep(1000);                                                   // the save is throttled
  const seed = await tab.eval('window.chatagram.game.state.round.seed');
  await tab.send('Page.reload'); await sleep(300); await ready(tab);
  assert.equal(await tab.eval('window.chatagram.game.state.round.seed'), seed, 'same puzzle after a refresh');
  assert.equal(await tab.eval(`window.chatagram.game.state.round.answers[0].by.name`), 'PixelPanda');
  await tab.eval('window.chatagram.advance(90000); 1');
  await tab.until('window.chatagram.game.state.phase === "over"', 3000);
  await tab.until('/Game over/.test(document.querySelector(".back").textContent)', 5000);
  // the countdown ring drains smoothly (it moves within a second, not once a second)
  const ring = 'parseFloat(getComputedStyle(document.querySelector(".back .ring .fg")).strokeDashoffset)';
  const r1 = await tab.eval(ring); await sleep(300); const r2 = await tab.eval(ring);
  assert.ok(r2 > r1, `the ring didn't move in 300 ms (${r1} → ${r2})`);
  await tab.eval('window.chatagram.advance(15000); 1');
  await tab.until('window.chatagram.game.state.phase === "playing"', 3000);
  await tab.eval('localStorage.clear(); 1');
  await tab.close();
});

test('both layouts fit their size in every theme, with one platform or two', async () => {
  const themes = ['chatagram', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy'];
  for (const [layout, w, h] of [['full', 960, 540], ['compact', 560, 230]]) {
    const tab = await chrome.open(`${site.origin}/chatagram/play.html?still=1&layout=${layout}`, { width: w, height: h });
    await ready(tab);
    for (const theme of themes) {
      await tab.eval(`window.postMessage({ type: 'widget-theme', theme: '${theme}' }, '*'); new Promise((r) => setTimeout(r, 60))`);
      await tab.eval('document.fonts.ready.then(() => 1)');
      const bad = await tab.eval(`(() => {
        const out = [], board = document.getElementById('board').getBoundingClientRect();
        for (const face of document.querySelectorAll('.face')) if (face.scrollHeight > face.clientHeight + 1 || face.scrollWidth > face.clientWidth + 1) out.push(face.className + ' overflows');
        for (const el of document.querySelectorAll('.front header, .front .tiles, .front .timer, .front footer, .front .recent')) {
          const b = el.getBoundingClientRect();
          if (b.width && (b.left < board.left - 1 || b.right > board.right + 1 || b.bottom > board.bottom + 1)) out.push(el.className || el.tagName);
        }
        const banner = document.querySelector('.banner'); if (banner.scrollWidth > banner.clientWidth + 1) out.push('banner text');
        return out;
      })()`);
      assert.deepEqual(bad, [], `${layout} ${theme}`);
    }
    noErrors(tab, layout);
    await tab.close();
  }
  // summaries in both layouts
  for (const [layout, w, h] of [['full', 960, 540], ['compact', 560, 230]]) for (const screen of ['cleared', 'over']) for (const one of ['', '&kick=a']) {
    const tab = await chrome.open(`${site.origin}/chatagram/play.html?still=1&layout=${layout}&screen=${screen}${one}`, { width: w, height: h });
    await ready(tab); await tab.eval('document.fonts.ready.then(() => 1)');
    const over = await tab.eval(`(() => { const b = document.querySelector('.back'); return [b.scrollHeight - b.clientHeight, b.scrollWidth - b.clientWidth]; })()`);
    assert.ok(over[0] <= 1 && over[1] <= 1, `${layout} ${screen}${one}: summary overflows by ${over}`);
    if (one) assert.ok(!(await tab.eval('document.querySelector(".back").textContent')).includes('TWITCH VS KICK'), 'one platform: no platform split');
    await tab.close();
  }
});

test('a live theme message restyles the board without restarting the game; bad ones are ignored', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?demo=1', { width: 960, height: 540 });
  await ready(tab);
  const before = await tab.eval('[window.chatagram.game.state.round.id, window.chatagram.game.state.round.seed]');
  await tab.eval(`window.postMessage({ type: 'widget-theme', theme: 'neon', accent: 'ff4155' }, '*'); new Promise((r) => setTimeout(r, 50))`);
  assert.deepEqual(await tab.eval('[document.getElementById("board").dataset.theme, getComputedStyle(document.getElementById("board")).getPropertyValue("--accent").trim()]'), ['neon', '#ff4155']);
  await tab.eval(`window.postMessage({ type: 'widget-theme', theme: 'rainbow', accent: 'nope' }, '*'); window.postMessage({ type: 'something-else', theme: 'light' }, '*'); new Promise((r) => setTimeout(r, 50))`);
  assert.equal(await tab.eval('document.getElementById("board").dataset.theme'), 'neon');
  await tab.eval(`window.postMessage({ type: 'widget-theme', accent: '' }, '*'); new Promise((r) => setTimeout(r, 50))`);
  assert.equal(await tab.eval('document.getElementById("board").style.getPropertyValue("--accent")'), '', 'accent back to the theme\'s own');
  // a flood of messages: still the same game
  await tab.eval(`for (let i = 0; i < 300; i++) window.postMessage({ type: 'widget-theme', theme: ['neon', 'royal', 'deep'][i % 3] }, '*'); new Promise((r) => setTimeout(r, 300))`);
  assert.deepEqual(await tab.eval('[window.chatagram.game.state.round.id, window.chatagram.game.state.round.seed]'), before);
  noErrors(tab, 'theme messages');
  await tab.close();
});

test('the OBS wrapper follows the form: Tron in his armour colour, Princess Trina royal, the Blobfish deep, the Form looks too', async () => {
  const tab = await chrome.open(site.origin + '/obs/chatagram?noveado=1&demo=1&form=red&layout=compact', { width: 560, height: 230 });
  const inner = (js) => tab.eval(`(() => { const d = document.getElementById('game').contentDocument; const w = document.getElementById('game').contentWindow; return ${js}; })()`);
  await tab.until(`document.getElementById('game').contentDocument?.documentElement?.dataset.ready === '1'`, 8000);
  const theme = () => inner(`[d.getElementById('board').dataset.theme, getComputedStyle(d.getElementById('board')).getPropertyValue('--accent').trim()]`);
  assert.deepEqual(await theme(), ['neon', '#ff4155']);
  const round = await inner('w.chatagram.game.state.round.id');
  for (const [form, want] of [['princess', ['royal', '#ff63b8']], ['blobfish', ['deep', '#ffb36b']], ['yellow', ['neon', '#ffd23f']]]) {
    await tab.eval(`TGL.set('${form}'); new Promise((r) => setTimeout(r, 150))`);
    assert.deepEqual(await theme(), want, form);
  }
  assert.equal(await inner('w.chatagram.game.state.round.id'), round, 'switching form never restarts the game');
  assert.equal(await inner('w.chatagram.cfg.layout'), 'compact', 'the game\'s own options pass through');
  await tab.close();
  const looks = await chrome.open(site.origin + '/obs/chatagram?noveado=1&demo=1&form=princess&looks=princess:tron', { width: 960, height: 540 });
  await looks.until(`document.getElementById('game').contentDocument?.documentElement?.dataset.ready === '1'`, 8000);
  assert.equal(await looks.eval(`document.getElementById('game').contentDocument.getElementById('board').dataset.theme`), 'neon', 'Form looks: Princess Trina in Tron\'s look');
  await looks.close();
});

test('the set-up page: defaults make a short link, changes are written, the advanced badge counts them', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 1440, height: 900 });
  await tab.until('window.chatagramSetup', 5000);
  await tab.eval('localStorage.clear(); 1');
  await tab.send('Page.reload'); await sleep(400); await tab.until('window.chatagramSetup', 5000);
  assert.equal(await tab.eval('chatagramSetup.query()'), '');
  assert.deepEqual(await tab.eval('[document.getElementById("copy").disabled, getComputedStyle(document.getElementById("links")).display, document.getElementById("need").hidden]'), [true, 'none', false], 'nothing to copy without a channel: the links are hidden');
  assert.equal(await tab.eval('getComputedStyle(document.getElementById("kickid-field")).display'), 'none', 'the chatroom ID box only shows when Kick can\'t confirm');
  const type = (name, value) => tab.eval(`(() => { const el = document.querySelector('[name="${name}"]'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await type('twitch', 'https://www.twitch.tv/PixelPanda');
  await type('kick', 'kick.com/Grid_Runner');
  assert.deepEqual(await tab.eval('[document.getElementById("copy").disabled, document.getElementById("need").hidden, getComputedStyle(document.getElementById("links")).display !== "none"]'), [false, true, true], 'a channel: copy and the links are ready');
  await tab.click('input[name=layout][value=compact]');
  await tab.click('input[name=theme][value=cozy]');
  await tab.click('input[name=time][value="300"]');
  let q = await tab.eval('chatagramSetup.query()');
  assert.equal(q, 'twitch=pixelpanda&kick=grid_runner&layout=compact&theme=cozy&time=300');
  assert.equal(await tab.eval('document.querySelector("#size").textContent'), '560 × 230');
  assert.equal(await tab.eval('document.getElementById("chg").hidden'), true);
  // advanced: padlocks, a renamed command with two names, everyone can use them
  await tab.eval('document.getElementById("adv").open = true; 1');
  await tab.click('input[name=locks][value="3"]');
  await type('cstart', '!cg start, !newgame');
  await tab.click('input[name=perm][value=all]');
  q = await tab.eval('chatagramSetup.query()');
  assert.match(q, /locks=3/); assert.match(q, /cstart=!cg\+start,!newgame|cstart=!cg%20start,!newgame/); assert.match(q, /perm=all/);
  assert.equal(await tab.eval('document.getElementById("chg").textContent'), '3 changed');
  // tag fields: Enter adds, × removes, straight into the link
  const tagInput = (k) => `document.querySelector('[data-tags=${k}] input')`;
  await tab.eval(`(() => { const i = ${tagInput('block')}; i.value = 'Moist'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
  assert.match(await tab.eval('chatagramSetup.query()'), /block=moist/);
  await tab.eval(`document.querySelector('[data-tags=ignore] [data-remove=nightbot]').click(); 1`);
  assert.ok(!(await tab.eval('chatagramSetup.settings.ignore.includes("nightbot")')));
  await tab.eval(`(() => { const i = ${tagInput('ignore')}; i.value = '@MyBot'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
  assert.ok(await tab.eval('chatagramSetup.settings.ignore.includes("mybot")'));
  // keep playing off: both flow settings wait for commands
  await tab.click('#auto');
  assert.match(await tab.eval('chatagramSetup.query()'), /next=0&restart=0/);
  // the link opens an overlay with exactly these settings
  const link = await tab.eval('chatagramSetup.link()');
  assert.ok(link.startsWith(site.origin + '/chatagram/play?'));
  const o = await chrome.open(link.replace('/chatagram/play?', '/chatagram/play.html?'), { width: 560, height: 230, init: FAKE_CHAT });
  await ready(o);
  assert.deepEqual(await o.eval('[chatagram.cfg.theme, chatagram.cfg.time, chatagram.cfg.locks, [...chatagram.cfg.cstart].join("|"), chatagram.cfg.perm, chatagram.game.state.phase]'), ['cozy', 300, 3, '!cg start|!newgame', 'all', 'idle']);
  await o.close();
  noErrors(tab, 'set-up page');
  await tab.eval('localStorage.clear(); 1');
  await tab.close();
});

test('reduced motion: no animations run, the letters still change', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?demo=1', { width: 960, height: 540, reducedMotion: true });
  await ready(tab);
  assert.ok(await tab.eval('document.documentElement.classList.contains("rm")'));
  const before = await tab.eval('[...document.querySelectorAll("#tiles .reel b")].map((b) => b.textContent).join("")');
  await tab.eval('window.chatagram.advance(10000); 1');
  assert.equal(await tab.eval('document.getAnimations().filter((a) => a.playState === "running").length'), 0);
  assert.notEqual(await tab.eval('[...document.querySelectorAll("#tiles .reel b")].map((b) => b.textContent).join("")'), before);
  // in OBS the streaming PC's setting is ignored unless motion=reduce says so
  const obs = await chrome.open(site.origin + '/chatagram/play.html?demo=1', { width: 960, height: 540, reducedMotion: true, init: 'window.obsstudio = {};' });
  await ready(obs);
  assert.ok(!(await obs.eval('document.documentElement.classList.contains("rm")')));
  await obs.close(); await tab.close();
});

// Bug (2026-09-28): the picture shown until the live game loads stayed behind it, at a slightly different size, so both
// showed at once (it looked like a new game stacked on top of the old one). Once the game has drawn, the picture goes.
async function pictureGoneOnceLive(server) {
  const tab = await chrome.open(server.origin + '/chatagram/', { width: 1354, height: 860 });
  await tab.until('document.getElementById("hero-frame").contentDocument?.documentElement?.dataset.ready === "1"', 10000, 'the hero game');
  await sleep(900);
  const shown = await tab.eval('[...document.querySelectorAll("#hero-screen .poster, #pv-screen .poster")].map((p) => +getComputedStyle(p).opacity)');
  await tab.close();
  return shown;
}
test('the placeholder picture fades out once the live game has drawn (no two boards at once)', async () => {
  assert.deepEqual(await pictureGoneOnceLive(site), [0, 0]);
  // proof: on the code before the fix the picture stays up
  const old = readAt('d7bb30b', 'public/chatagram/setup.js');
  if (!old) return;
  // the page and its script as they were then (today's page has changed around the old script)
  const before = await siteServer({ files: { '/chatagram/setup.js': old, '/chatagram/': readAt('d7bb30b', 'public/chatagram/index.html') } });
  try { assert.notDeepEqual(await pictureGoneOnceLive(before), [0, 0], 'the test should fail on the old code'); } finally { await before.close(); }
});

// Bug (2026-09-28): on every page load the set-up preview first showed the default theme's compact picture (the built-in
// src) and only switched to the visitor's saved theme and layout a moment later, so the wrong board flashed up.
test('the set-up preview shows the saved theme and layout\'s picture from the first frame', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 1354, height: 860, wait: 'dom',
    init: `localStorage.setItem('chatagram:setup', JSON.stringify({ theme: 'candy', layout: 'full' }));` });
  // straight after the page's own scripts have run, before any preview has loaded
  assert.match(await tab.eval('document.getElementById("pv-poster").getAttribute("src")'), /themes\/candy-full\.webp$/);
  await tab.eval('localStorage.clear(); 1');
  await tab.close();
  const fresh = await chrome.open(site.origin + '/chatagram/', { width: 1354, height: 860, wait: 'dom' });
  assert.match(await fresh.eval('document.getElementById("pv-poster").getAttribute("src")'), /themes\/chatagram-full\.webp$/, 'the default (full layout) picture');
  await fresh.close();
});

// Bug (2026-09-28): the banner's letter-scramble ran on its own timer per find, so with finds close together an older,
// longer word could finish last and overwrite the newest one ("found an extra word: RUNWAY" for someone else's word).
test('the banner always ends on the newest find, however close together finds are', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?twitch=x', { width: 960, height: 540, init: FAKE_CHAT });
  await ready(tab);
  const words = await tab.eval('chatagram.game.state.round.answers.map((a) => a.word).sort((a, b) => b.length - a.length)');
  // the longest first (its scramble runs longest), then a short one straight after
  await tab.eval(`chatagram.hear({ platform: 'twitch', user: 'a', name: 'NeonNacho', text: '${words[0]}' }); chatagram.hear({ platform: 'twitch', user: 'b', name: 'LunaLlama', text: '${words.at(-1)}' }); 1`);
  await sleep(900);
  assert.match(await tab.eval('document.getElementById("what").textContent'), new RegExp('^' + words.at(-1), 'i'));
  assert.match(await tab.eval('document.getElementById("who").textContent'), /LunaLlama/);
  await tab.eval('localStorage.clear(); 1');
  await tab.close();
});

// Bug (2026-09-28): the placeholder picture sat 8–18 px off the live game (its position was set, then reset), so the
// board jumped when the game took over. They must cover exactly the same pixels.
test('the placeholder picture sits exactly where the live game appears', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 1354, height: 860 });
  await tab.until('document.getElementById("pv").contentDocument?.documentElement?.dataset.ready === "1" && document.getElementById("hero-frame").contentDocument?.documentElement?.dataset.ready === "1"', 10000);
  const off = await tab.eval(`['hero', 'pv'].map((id) => {
    const box = document.getElementById(id + '-screen'), f = box.querySelector('iframe'), p = box.querySelector('.poster').getBoundingClientRect(), fr = f.getBoundingClientRect();
    return Math.max(Math.abs(p.left - fr.left), Math.abs(p.top - fr.top), Math.abs(p.width - fr.width), Math.abs(p.height - fr.height));
  })`);
  for (const o of off) assert.ok(o < 1, `picture and game differ by ${o} px`);
  await tab.close();
});

// The longest lengths share one "N+" column when they only have a few boxes (owner, 2026-09-28): fewer, roomier columns.
test('a board of mostly short words groups its few long-word boxes into one "N+" column', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?demo=1', { width: 960, height: 540 });
  await ready(tab);
  let seen = null;
  for (let i = 0; i < 60 && !seen; i++) {
    const heads = await tab.eval('[...document.querySelectorAll("#words h4 span:first-child")].map((s) => s.textContent)');
    const lens = await tab.eval('[...new Set(chatagram.game.state.round.answers.map((a) => a.word.length))].length');
    if (lens >= 4 && heads.length < lens) seen = heads;
    else await tab.eval('chatagram.hear({ platform: "twitch", user: "o", name: "O", owner: true, mod: true, text: "!cg skip" }); 1');
  }
  assert.ok(seen, 'a board with merged columns came up');
  assert.ok(seen.some((h) => /^\d\+/.test(h)), `an N+ heading: ${seen}`);
  assert.ok(seen.length >= 3, 'never fewer than three columns');
  // every box is still on the board, and the N+ count covers all its lengths
  assert.equal(await tab.eval('document.querySelectorAll("#words .w").length'), await tab.eval('chatagram.game.state.round.answers.length'));
  await tab.close();
});

// A very busy chat (owner, 2026-09-28): many viewers sending the same words in the same instant, over both platforms.
// Each word goes to whoever's message arrived first, once; the page keeps up; timers don't churn per message; the banner
// ends on the newest find.
test('a flood of the same words from many viewers at once: first message wins each word, once; nothing piles up', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?twitch=gridrunner&kick=gridrunner&kickid=715', { width: 960, height: 540, init: TIMERS + FAKE_CHAT });
  await ready(tab);
  await tab.until('document.querySelectorAll("#conn .dot.live").length === 2', 5000);
  const r = await tab.eval(`(async () => {
    const words = chatagram.game.state.round.answers.map((a) => a.word).slice(0, 6), first = {};
    const made = __timers.made, t0 = performance.now();
    // 400 messages in one go: every word from 60 viewers, alternating platforms, plus junk
    let n = 0;
    for (let v = 0; v < 60; v++) for (const w of words) {
      const who = 'Viewer' + v, kick = (v + n) % 2;
      if (!(w in first)) first[w] = who;
      if (kick) __chat.kick(who, w); else __chat.twitch(who, w);
      n++;
    }
    for (let j = 0; j < 40; j++) __chat.twitch('Chatter' + j, 'lol');
    const ms = performance.now() - t0;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const a = chatagram.game.state.round.answers;
    return { ms, timers: __timers.made - made, n: n + 40,
      credited: words.map((w) => { const x = a.find((y) => y.word === w); return [w, x && x.by && x.by.name, first[w]]; }),
      scores: Object.values(chatagram.game.state.players).map((p) => p.words).reduce((s, x) => s + x, 0),
      banner: document.getElementById('who').textContent };
  })()`);
  for (const [w, got, want] of r.credited) assert.equal(got, want, `${w} went to the first sender`);
  assert.equal(r.scores, 6, 'six words found, six credited: no double scoring');
  assert.ok(r.ms < 500, `handled ${r.n} messages in ${Math.round(r.ms)} ms`);
  assert.ok(r.timers < 60, `${r.timers} timers made for ${r.n} messages (should not churn per message)`);
  assert.match(r.banner, new RegExp(r.credited.at(-1)[2]), 'the banner ends on the newest find');
  noErrors(tab, 'flood');
  await tab.eval('localStorage.clear(); 1');
  await tab.close();
});

// The hero's pretend chat (owner, 2026-09-30, mockup A): the hero game's chat shows as speech bubbles off its left edge,
// the last three; a find turns sun-yellow with the word as tiles and its points. The set-up preview's chat never shows there.
test('the hero shows its game\'s pretend chat as bubbles: the last three, finds with tiles and points', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 1354, height: 860 });
  await tab.until('document.getElementById("hero-frame").contentDocument?.documentElement?.dataset.ready === "1" && document.getElementById("pv").contentDocument?.documentElement?.dataset.ready === "1"', 10000, 'both games');
  await tab.until('document.querySelectorAll("#chat .b").length > 0', 8000, 'the pretend chat to talk');
  const say = (frame, name, text) => tab.eval(`document.getElementById('${frame}').contentWindow.chatagram.hear({ platform: 'twitch', user: '${name}'.toLowerCase(), name: '${name}', text: '${text}', color: '#1971c2' }); 1`);
  const word = await tab.eval('document.getElementById("hero-frame").contentWindow.chatagram.game.state.round.answers.find((a) => !a.by).word');
  await say('pv', 'PreviewPerson', 'hello');
  await say('hero-frame', 'HeroPerson', word);
  await sleep(100);
  const last = await tab.eval(`(() => { const b = [...document.querySelectorAll('#chat .b')].at(-1); return { hit: b.classList.contains('hit'), name: b.querySelector('b').textContent, tiles: [...b.querySelectorAll('.tiles i')].map((i) => i.textContent).join(''), pts: b.querySelector('.pts')?.textContent }; })()`);
  assert.deepEqual(last, { hit: true, name: 'HeroPerson', tiles: word.toUpperCase(), pts: last.pts });
  assert.match(last.pts, /^\+\d+$/);
  assert.ok(!(await tab.eval('document.getElementById("chat").textContent.includes("PreviewPerson")')), 'the preview\'s chat stays out of the hero');
  await say('hero-frame', 'HeroPerson', 'lol');
  assert.ok(await tab.eval('document.querySelectorAll("#chat .b:not(.out)").length <= 3'));
  assert.ok(!(await tab.eval('[...document.querySelectorAll("#chat .b")].at(-1).classList.contains("hit")')), 'a miss is a plain bubble');
  noErrors(tab, 'hero chat');
  await tab.close();
  // on phones the game is too small for it
  const phone = await chrome.open(site.origin + '/chatagram/', { width: 390, height: 844, mobile: true });
  assert.equal(await phone.eval('getComputedStyle(document.getElementById("chat")).display'), 'none');
  await phone.close();
});

// Bug (owner, 2026-09-30, a screen recording): a new bubble felt stiff. The stack jumped up a row at once, the oldest
// vanished, and the newest finished its pop flat and then snapped to its tilt (the animation and the CSS both set
// transform). Now the ones above glide up, the oldest fades out, and the pop ends exactly where the bubble rests.
test('a new hero chat bubble: the ones above glide up, the oldest fades out, the pop ends where it rests', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 1354, height: 860 });
  await tab.until('document.querySelectorAll("#chat .b:not(.out)").length === 3', 15000, 'three bubbles');
  // the pretend chat keeps talking: stop it hearing the hero game so only this test's message arrives
  await tab.eval(`document.getElementById('hero-frame').contentWindow.postMessage = () => {}; 1`);
  await sleep(700);
  const r = await tab.eval(`(async () => {
    const chat = document.getElementById('chat'), before = [...chat.querySelectorAll('.b:not(.out)')];
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'chatagram-chat', name: 'Glide', color: '#1971c2', platform: 'twitch', text: 'hello', found: '', pts: 0 }, source: document.getElementById('hero-frame').contentWindow }));
    const now = [...chat.querySelectorAll('.b')], newest = now.at(-1), oldest = before[0];
    const moves = before.slice(1).map((b) => b.getAnimations().some((a) => a.effect.getKeyframes().some((k) => k.translate && k.translate !== '0px' && k.translate !== 'none')));
    const pop = newest.getAnimations()[0]?.effect.getKeyframes().at(-1);
    return { moves, oldestStays: oldest.isConnected, oldestFades: oldest.classList.contains('out') && oldest.getAnimations().some((a) => a.effect.getKeyframes().at(-1).opacity === '0'),
      popEnd: pop && pop.rotate };
  })()`);
  assert.deepEqual(r.moves, [true, true], 'the bubbles above glide up');
  assert.ok(r.oldestStays && r.oldestFades, 'the oldest fades out rather than vanishing');
  await sleep(900);
  assert.equal(r.popEnd, await tab.eval('getComputedStyle([...document.querySelectorAll("#chat .b")].at(-1)).rotate'), 'the pop ends at the tilt the bubble rests at');
  assert.equal(await tab.eval('document.querySelectorAll("#chat .b").length'), 3, 'the faded one is gone after');
  noErrors(tab, 'hero chat motion');
  await tab.close();
});

test('phones have no sticky Copy bar (the owner removed it)', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 390, height: 844, mobile: true });
  assert.equal(await tab.eval('document.querySelectorAll(".copybar, #copy2").length'), 0);
  noErrors(tab, 'phone');
  await tab.close();
});

// Bug (2026-09-28): the footer's platform icons sat against the left of their coloured badge: the footer's
// ".conn span" rule also matched the badge (a span), overriding its centring. Every badge's icon must be centred.
test('every platform badge\'s icon is centred in its badge (footer, banner, summary)', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?still=1', { width: 960, height: 540 });
  await ready(tab);
  const off = await tab.eval(`[...document.querySelectorAll('.pf')].filter((p) => p.offsetParent).map((p) => {
    const b = p.getBoundingClientRect(), s = p.querySelector('svg').getBoundingClientRect();
    return [p.parentElement.className || p.parentElement.id, Math.abs((s.left - b.left) - (b.right - s.right)), Math.abs((s.top - b.top) - (b.bottom - s.bottom))];
  })`);
  assert.ok(off.length >= 4, 'found the badges');
  for (const [where, dx, dy] of off) assert.ok(dx < 0.5 && dy < 0.5, `${where}: icon off-centre by ${dx} × ${dy} px`);
  await tab.close();
});

test('seed= in the link sets the first puzzle (the trailer uses it); anything else is ignored', async () => {
  for (const [q, want] of [['seed=garden', 'garden'], ['seed=zzzqqq', null], ['seed=<b>', null]]) {
    const tab = await chrome.open(site.origin + '/chatagram/play.html?demo=1&' + q, { width: 960, height: 540 });
    await ready(tab);
    const seed = await tab.eval('chatagram.game.state.round.seed');
    if (want) assert.equal(seed, want); else assert.match(seed, /^[a-z]{6}$/, `${q}: a normal random puzzle`);
    await tab.close();
  }
});

// ---- the leaderboard (!cg top) -------------------------------------------------------------------------------------------
// Twitch's and Kick's "is it live" answers are stubbed in the page: live / offline / unknown, or 'hang' (answers only when
// window.__release() is called). window.__asked lists which platforms were asked.
const STUB = (answers) => `(() => { window.__asked = []; for (const [p, a] of Object.entries(${JSON.stringify(answers)})) Widgets.platforms[p].stream = async () => {
  __asked.push(p);
  const live = { state: 'live', id: 's1', started: Date.now() - 60000 };
  if (a === 'hang') return new Promise((r) => { window.__release = () => r(live); });
  return a === 'live' ? live : { state: a }; }; return 1; })()`;
const LB = (q) => `/chatagram/play.html?twitch=gridrunner&${q || ''}`;
// every leaderboard test starts with nothing saved (the tabs share the site's storage)
const CLEAN = `for (const k of Object.keys(localStorage)) if (k.startsWith('chatagram:v1:') || k.startsWith('chatagram:scores:')) localStorage.removeItem(k);`;
async function lbTab(q, answers, size = { width: 960, height: 540 }) {
  const tab = await chrome.open(site.origin + LB(q), { ...size, init: FAKE_CHAT + CLEAN });
  await ready(tab);
  await tab.until('document.querySelector("#conn .dot.live")', 5000, 'chat live');
  if (answers) { await tab.eval(STUB(answers)); await tab.eval('chatagram.checkStream(); 1'); }
  return tab;
}
const text = (tab, sel) => tab.eval(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);

test('leaderboard, full layout while playing: covers the word board exactly, never the letters or timer; nothing pauses', async () => {
  const tab = await lbTab('', { twitch: 'live' });
  await tab.until('chatagram.scores.fresh()', 3000, 'a live answer');
  const w = await tab.eval('chatagram.game.state.round.answers[0].word');
  await tab.eval(`__chat.twitch("PixelPanda", ${JSON.stringify(w)}); 1`);
  await tab.eval('__chat.twitch("PixelPanda", "!cg top"); 1');
  assert.equal(await tab.eval('!!document.querySelector(".lb")'), false, 'a viewer can\'t (who can use commands: me and mods)');
  await tab.eval('__chat.twitch("GridMod", "!cg top", true); 1');
  await tab.until('document.querySelector(".lb.play")', 3000, 'the panel');
  await sleep(400);                                                  // its entrance (a short slide) has finished
  const g = await tab.eval(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const lb = r('.lb.play'), w = r('#words'); return { lb: [lb.left, lb.top, lb.width, lb.height].map(Math.round), w: [w.left, w.top, w.width, w.height].map(Math.round), timer: r('.timer').bottom, tiles: r('#tiles').bottom }; })()`);
  assert.deepEqual(g.lb, g.w, 'the panel is exactly the word board');
  assert.ok(g.lb[1] >= g.timer && g.lb[1] >= g.tiles, 'below the letters and the timer');
  const t = await text(tab, '.lb');
  assert.match(t, /THIS STREAM/); assert.match(t, /ALL TIME/); assert.match(t, /PixelPanda/); assert.match(t, /!cg top · asked by GridMod/);
  assert.equal(await tab.eval('chatagram.game.held'), false, 'nothing pauses');
  const c1 = await text(tab, '#clock'); await sleep(1300);
  assert.notEqual(await text(tab, '#clock'), c1, 'the clock keeps running');
  await tab.eval('chatagram.leaderboard.hide(); 1');
  await tab.until('!document.querySelector(".lb")', 2000, 'gone');
  noErrors(tab, 'full leaderboard');
  await tab.close();
});

test('leaderboard, compact: covers the whole widget and every timer stops until it goes', async () => {
  const tab = await lbTab('layout=compact', { twitch: 'live' }, { width: 560, height: 230 });
  await tab.until('chatagram.scores.fresh()', 3000);
  const ends = await tab.eval('chatagram.game.state.round.endsAt');
  await tab.eval('__chat.twitch("GridMod", "!cg", true); 1');
  await tab.until('document.querySelector(".lb.cmp")', 3000, 'the cover');
  await sleep(400);
  const cover = await tab.eval(`(() => { const a = document.querySelector('.lb.cmp').getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(); return [a.width / b.width, a.height / b.height]; })()`);
  assert.ok(cover[0] > 0.97 && cover[1] > 0.95, `covers the widget: ${cover}`);
  assert.match(await text(tab, '.lb'), /Timer paused/);
  assert.equal(await tab.eval('chatagram.game.held'), true);
  const c1 = await text(tab, '#clock'); await sleep(1500);
  assert.equal(await text(tab, '#clock'), c1, 'the clock stands still');
  const before = Date.now();
  await tab.eval('chatagram.leaderboard.hide(); 1');
  assert.equal(await tab.eval('chatagram.game.held'), false);
  const moved = await tab.eval('chatagram.game.state.round.endsAt') - ends;
  assert.ok(moved >= 1500 && moved <= Date.now() - before + 4000, `the round's end moved on by the time shown: ${moved} ms`);
  noErrors(tab, 'compact leaderboard');
  await tab.close();
});

test('leaderboard on a card: the standing list, then !cg top opens a popup over a dimmed card and pauses the countdown', async () => {
  const tab = await lbTab('next=10', { twitch: 'live' });
  await tab.until('chatagram.scores.fresh()', 3000);
  const words = await tab.eval('chatagram.game.state.round.answers.map((a) => a.word)');
  for (const w of words) await tab.eval(`__chat.twitch("PixelPanda", ${JSON.stringify(w)}); 1`);
  await tab.until('document.getElementById("board").classList.contains("summary")', 8000, 'the summary');
  await tab.until('!document.querySelector(".lbsec").hidden', 3000, 'the standing list');
  assert.match(await text(tab, '.lbsec'), /THIS STREAM[\s\S]*PixelPanda[\s\S]*ALL TIME/);
  const next = await tab.eval('chatagram.game.state.nextAt');
  await tab.eval('__chat.twitch("GridMod", "!cg top", true); 1');
  await tab.until('document.querySelector(".lbwrap .lbdim") && document.querySelector(".lb.big")', 3000, 'the popup');
  assert.match(await text(tab, '.lb'), /Next level countdown paused/);
  await sleep(1200);
  await tab.eval('chatagram.leaderboard.hide(); 1');
  assert.ok(await tab.eval('chatagram.game.state.nextAt') - next >= 1200, 'the countdown was paused');
  noErrors(tab, 'card leaderboard');
  await tab.close();
});

test('This stream is never shown before a check confirms it: nothing for 300 ms, then a placeholder, then This game if no answer', async () => {
  const tab = await lbTab('', { twitch: 'unknown' });
  const w = await tab.eval('chatagram.game.state.round.answers[0].word');
  await tab.eval(`__chat.twitch("PixelPanda", ${JSON.stringify(w)}); 1`);
  await tab.eval(STUB({ twitch: 'hang' }));
  await tab.eval('__chat.twitch("GridMod", "!cg top", true); 1');
  await sleep(120);
  assert.equal(await tab.eval('!!document.querySelector(".lb")'), false, 'nothing yet');
  await tab.until('document.querySelector(".lb .rank.sk")', 1500, 'the placeholder');
  const t = await text(tab, '.lb');
  assert.match(t, /Checking stream…/); assert.doesNotMatch(t, /PixelPanda[\s\S]*ALL TIME/, 'no names in This stream while checking');
  await tab.until('/THIS GAME/.test(document.querySelector(".lb").textContent)', 5000, 'This game after no answer');
  assert.match(await text(tab, '.lb'), /PixelPanda/);
  await tab.eval('__release(); 1');
  await tab.until('/THIS STREAM/.test(document.querySelector(".lb").textContent) && !/THIS GAME/.test(document.querySelector(".lb").textContent)', 3000, 'catches up when the answer comes');
  await tab.eval('chatagram.leaderboard.hide(); 1');
  noErrors(tab, 'confirmation');
  await tab.close();
});

test('confirmed offline: Last stream with its date and the Offline tag; All time hidden → the podium', async () => {
  const tab = await lbTab('remember=0', { twitch: 'live' });
  await tab.until('chatagram.scores.fresh()', 3000);
  for (const [i, a] of (await tab.eval('chatagram.game.state.round.answers.slice(0, 3).map((a) => a.word)')).entries()) await tab.eval(`__chat.twitch(${JSON.stringify(['PixelPanda', 'NeonNacho', 'LunaLlama'][i])}, ${JSON.stringify(a)}); 1`);
  await tab.eval(STUB({ twitch: 'offline' }));
  await tab.eval('chatagram.checkStream(); 1');
  await tab.until('chatagram.scores.record.status === "offline"', 3000);
  await tab.eval('chatagram.leaderboard.show("GridMod"); 1');
  await tab.until('document.querySelector(".lb .pod")', 3000, 'the podium');
  const t = await text(tab, '.lb');
  assert.match(t, /LAST STREAM’S PODIUM · [A-Z]{3} \d+ [A-Z]{3}/); assert.match(t, /OFFLINE/);
  assert.doesNotMatch(t, /ALL TIME/, 'All time hidden');
  assert.equal(await tab.eval('document.querySelectorAll(".lb .pod .step").length'), 3);
  assert.equal(await tab.eval('!!document.querySelector(".lb .pod .p1 .crown")'), true);
  await tab.eval('chatagram.leaderboard.hide(); 1');
  noErrors(tab, 'offline');
  await tab.close();
});

test('both platforms set up: the one that said live is asked first; the other only when it isn\'t live', async () => {
  const tab = await lbTab('kick=gridrunner&kickid=715', { twitch: 'offline', kick: 'live' });
  await tab.until('chatagram.scores.fresh()', 3000);
  assert.deepEqual(await tab.eval('__asked'), ['twitch', 'kick']);
  await tab.eval('__asked.length = 0; chatagram.checkStream(); 1');
  await tab.until('__asked.length', 3000);
  await sleep(200);
  assert.deepEqual(await tab.eval('__asked'), ['kick'], 'Kick answered live last time: only Kick');
  await tab.close();
});

test('saved data: a save from before the leaderboards resumes, and its All time scores carry into the leaderboards', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/chatagram-save-v1.json', import.meta.url), 'utf8'));
  const init = FAKE_CHAT + CLEAN + `\nlocalStorage.setItem('chatagram:v1:gridrunner|', JSON.stringify(Object.assign(${JSON.stringify(fixture)}, { savedAt: Date.now() - 3000 })));`;
  const tab = await chrome.open(site.origin + LB(''), { width: 960, height: 540, init });
  await ready(tab);
  assert.equal(await tab.eval('chatagram.game.state.round.seed'), fixture.round.seed, 'the game resumed');
  const names = await tab.eval('chatagram.scores.allTimeTop().map((p) => p.name).sort()');
  assert.deepEqual(names, Object.values(fixture.allTime).map((p) => p.name).sort());
  const open = await tab.eval('chatagram.game.state.round.answers.find((a) => !a.by).word');
  await tab.eval(`__chat.twitch("PixelPanda", ${JSON.stringify(open)}); 1`);
  await tab.until('localStorage.getItem("chatagram:scores:v1:gridrunner|")', 3000, 'the leaderboards saved');
  const both = await tab.eval('(() => { const g = JSON.parse(localStorage.getItem("chatagram:v1:gridrunner|")), s = JSON.parse(localStorage.getItem("chatagram:scores:v1:gridrunner|")); return [JSON.stringify(g.allTime), JSON.stringify(s.allTime)]; })()');
  assert.equal(both[0], both[1], 'All time also written back into the game\'s save (for an older overlay)');
  noErrors(tab, 'migration');
  await tab.close();
});

test('reduced motion: the leaderboard just appears and goes, with nothing animating', async () => {
  const tab = await lbTab('motion=reduce&layout=compact', { twitch: 'live' }, { width: 560, height: 230 });
  await tab.until('chatagram.scores.fresh()', 3000);
  await tab.eval('chatagram.leaderboard.show("GridMod"); 1');
  await tab.until('document.querySelector(".lb.cmp")', 2000);
  assert.equal(await tab.eval('document.getAnimations().filter((a) => a.playState === "running").length'), 0);
  await tab.eval('chatagram.leaderboard.hide(); 1');
  assert.equal(await tab.eval('!!document.querySelector(".lb")'), false, 'gone at once');
  await tab.close();
});

test('backgrounds: every theme 95% opaque by default, solid at bgo=100, see-through as set (the owner, 2026-09-28)', async () => {
  const alpha = (tab) => tab.eval(`(() => { const cs = getComputedStyle(document.querySelector('.front')); const all = (cs.backgroundColor + ' ' + cs.backgroundImage).match(/rgba?\\([^)]*\\)/g) || []; return all.filter((c) => c !== 'rgba(0, 0, 0, 0)').map((c) => { const p = c.match(/[\\d.]+/g).map(Number); return p.length > 3 ? p[3] : 1; }); })()`);
  for (const theme of ['chatagram', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy']) {
    for (const [q, want] of [['', 0.95], ['&bgo=100', 1]]) {
      const tab = await chrome.open(site.origin + `/chatagram/play.html?still=1&theme=${theme}${q}`, { width: 960, height: 540 });
      await ready(tab);
      const a = await alpha(tab);
      assert.ok(a.length && a.every((x) => Math.abs(x - want) < 0.01), `${theme}${q}: ${a}, want ${want}`);
      await tab.close();
    }
  }
  for (const theme of ['chatagram', 'candy']) {
    const tab = await chrome.open(site.origin + `/chatagram/play.html?still=1&theme=${theme}&bgo=70`, { width: 960, height: 540 });
    await ready(tab);
    const a = await alpha(tab);
    assert.ok(a.length && a.every((x) => Math.abs(x - 0.7) < 0.01), `${theme} at 70%: ${a}`);
    await tab.close();
  }
});

test('a find never lights up a hidden ? tile (that would give the letter away)', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/play.html?twitch=gridrunner&tricky=1&shuffle=0', { width: 960, height: 540, init: FAKE_CHAT + CLEAN });
  await ready(tab);
  await tab.until('document.querySelector("#conn .dot.live")', 5000);
  // a word that uses the hidden letter
  const w = await tab.eval(`(() => { const r = chatagram.game.state.round, ch = r.letters.find((l) => l.id === r.hidden[0]).ch; return r.answers.map((a) => a.word).find((x) => x.includes(ch)); })()`);
  await tab.eval(`__chat.twitch("PixelPanda", ${JSON.stringify(w)}); 1`);
  await sleep(250);
  assert.equal(await tab.eval('document.querySelectorAll("#tiles .tile.lit").length > 0'), true, 'its other letters light up');
  assert.equal(await tab.eval('document.querySelectorAll("#tiles .tile.hidden.lit").length'), 0, 'the ? stays dark');
  await tab.close();
});
