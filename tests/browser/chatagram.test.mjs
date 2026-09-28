// Chatagram and the widgets pages in headless Chrome: the pages load clean, the overlay plays a whole game from (fake)
// Twitch and Kick chat, both layouts fit in every theme, a live theme message never restarts the game, the OBS wrapper
// follows a form switch, the set-up page writes the right link, and reduced motion. Nothing reaches Twitch or Kick:
// outside requests are blocked and the chat sockets are faked in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

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
  await tab.until('/Cleared!/i.test(document.getElementById("endcard").textContent)', 2000, 'the end card');
  assert.equal(await tab.eval('document.getElementById("board").classList.contains("summary")'), false, 'no summary under the end card');
  await tab.until('document.getElementById("board").classList.contains("summary")', 5000, 'the summary to fade in');
  assert.equal(await tab.eval('document.getElementById("endcard").classList.contains("on")'), false);
  // nothing turns over: every transform is 'none' or a plain scale (no rotation terms)
  const transforms = await tab.eval('[...document.querySelectorAll(".card, .face")].map((el) => getComputedStyle(el).transform)');
  for (const t of transforms) assert.ok(t === 'none' || /^matrix\([\d.]+, 0, 0, [\d.]+, /.test(t), `rotated: ${t}`);
  const back = await tab.eval('document.querySelector(".back").textContent');
  assert.match(back, /Cleared!/); assert.match(back, /TWITCH VS KICK/); assert.match(back, /PixelPanda/);
  // moves on by itself
  await tab.eval('window.chatagram.advance(5000); 1');
  await tab.until('window.chatagram.game.state.level === 2 && !document.getElementById("board").classList.contains("summary")', 3000);
  // a regular viewer's !reset does nothing; a mod's works
  await tab.eval('__chat.twitch("PixelPanda", "!reset"); 1');
  assert.equal(await tab.eval('window.chatagram.game.state.level'), 2);
  await tab.eval('__chat.twitch("GridMod", "!reset", true); 1');
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
  await tab.until(`document.getElementById('game').contentDocument?.documentElement.dataset.ready === '1'`, 8000);
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
  await looks.until(`document.getElementById('game').contentDocument?.documentElement.dataset.ready === '1'`, 8000);
  assert.equal(await looks.eval(`document.getElementById('game').contentDocument.getElementById('board').dataset.theme`), 'neon', 'Form looks: Princess Trina in Tron\'s look');
  await looks.close();
});

test('the set-up page: defaults make a short link, changes are written, the advanced badge counts them', async () => {
  const tab = await chrome.open(site.origin + '/chatagram/', { width: 1440, height: 900 });
  await tab.until('window.chatagramSetup', 5000);
  await tab.eval('localStorage.clear(); 1');
  await tab.send('Page.reload'); await sleep(400); await tab.until('window.chatagramSetup', 5000);
  assert.equal(await tab.eval('chatagramSetup.query()'), '');
  assert.deepEqual(await tab.eval('[document.getElementById("copy").disabled, document.getElementById("copy2").disabled, document.getElementById("open").getAttribute("aria-disabled"), document.getElementById("need").hidden]'), [true, true, 'true', false], 'nothing to copy without a channel');
  assert.equal(await tab.eval('document.getElementById("kickid-field").hidden'), true, 'the chatroom ID box only shows when Kick can\'t confirm');
  const type = (name, value) => tab.eval(`(() => { const el = document.querySelector('[name="${name}"]'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await type('twitch', 'https://www.twitch.tv/PixelPanda');
  await type('kick', 'kick.com/Grid_Runner');
  assert.deepEqual(await tab.eval('[document.getElementById("copy").disabled, document.getElementById("need").hidden]'), [false, true], 'a channel: copy is ready');
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
