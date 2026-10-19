// Inputty (docs/widgets.md, "Inputty"): the set-up page (the steps appear once a device is picked, clicking a step
// forgets the ones after it, the link carries the look, the practice run acts out adding the source), the overlay with
// a pretend input-overlay websocket, the colour mode, and its scene on the widgets page taking the visitor's keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { launch } from '../helpers/chrome.mjs';
import { siteServer } from '../helpers/server.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, site;
test.before(async () => { chrome = await launch(); site = await siteServer(); });
test.after(async () => { await chrome?.close(); await site?.close(); });

// a pretend input-overlay: a websocket on a free local port that sends what input-overlay sends
async function fakeInputOverlay() {
  const clients = new Set();
  const server = createServer((_, res) => res.end('fake input-overlay'));
  server.on('upgrade', (req, socket) => {
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    clients.add(socket); socket.on('close', () => clients.delete(socket)); socket.on('error', () => clients.delete(socket));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const send = (m) => { const b = Buffer.from(JSON.stringify(m)); for (const c of clients) c.write(Buffer.concat([Buffer.from([0x81, b.length]), b])); };
  return { port: server.address().port, send, connected: () => clients.size, close: () => { for (const c of clients) c.destroy(); server.close(); } };
}

const visible = `[...document.querySelectorAll('.step')].filter((s) => s.offsetParent).map((s) => s.id).join(',')`;
const done = `[...document.querySelectorAll('.step.done')].map((s) => s.id).join(',')`;

test('the set-up: only the first question until a device is picked, then every step; clicking a step forgets the later ones', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960 });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  assert.equal(await tab.eval(visible), 's1', 'only "What do you play with?" at first');
  await tab.click('.g-device[data-d="kbm"]');
  await tab.until(`${visible} === 's1,s2,s3,s4,s5,s6'`, 4000, 'every step after picking');
  await tab.until(`document.querySelector('.scenebox').classList.contains('flat')`, 4000, 'the screen turns to face you');
  await tab.click('[data-next="2"]');
  await tab.click('[data-next="3"]');
  assert.equal(await tab.eval(done), 's1,s2,s3');
  await tab.click('#s2 .g-theme[data-t="neon"]');
  assert.equal(await tab.eval(done), 's1,s2', 'a click in step 2 forgets step 3');
  // the link carries the look, and goes to the overlay
  const url = await tab.eval(`document.querySelector('.g-url').textContent`);
  assert.match(url, /\/inputty\/play\.html\?.*theme=neon/);
  assert.equal(await tab.eval(`document.documentElement.scrollWidth - innerWidth`), 0);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('the practice run of adding the source types the name, pastes the link and sets the size', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960, reducedMotion: true });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  await tab.click('.g-device[data-d="kbm"]');
  await tab.until(`document.querySelector('#mk-source .mk-screen')`, 4000, 'the practice run');
  const go = (n) => tab.eval(`(() => { const t = document.querySelector('#mk-source [data-go="${n}"]') || document.querySelector('#mk-source [data-go]'); t.click(); return 1; })()`);
  await go(); await go(); await go();   // + in Sources, Browser, then the name box
  await tab.until(`/Input display/.test(document.querySelector('#mk-source .mk-input')?.textContent || '')`, 3000, 'the name typed');
  await go(2);                          // OK
  await tab.until(`document.querySelector('#mk-source [data-go="1"]')?.textContent.includes('obsproject')`, 3000, 'the properties window');
  await go(1);
  await tab.until(`/inputty\\/play\\.html/.test(document.querySelector('#mk-source [data-go="1"]').textContent)`, 3000, 'the link pasted');
  await go(2);
  await tab.until(`document.querySelector('#mk-source [data-go="2"]').textContent !== '800'`, 3000, 'the width set');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('the overlay reads input-overlay\'s websocket: a held key lights up, a quick tap never sticks', async () => {
  const io = await fakeInputOverlay();
  try {
    const tab = await chrome.open(`${site.origin}/inputty/play.html?port=${io.port}`, { width: 900, height: 500 });
    await tab.until(`document.documentElement.dataset.ready === '1'`, 8000, 'the overlay drawn');
    for (let i = 0; i < 50 && !io.connected(); i++) await sleep(100);
    assert.ok(io.connected(), 'the overlay connected to the pretend input-overlay');
    io.send({ event_type: 'key_pressed', keycode: 0x11, rawcode: 0x57, time: 10 });
    await tab.until(`[...IOInput.state.keys].includes(0x11)`, 2000, 'W down');
    io.send({ event_type: 'key_released', keycode: 0x11, rawcode: 0x57, time: 20 });
    await tab.until(`IOInput.state.keys.size === 0`, 2000, 'W up');
    io.send({ event_type: 'mouse_pressed', button: 1, clicks: 1, x: 5, y: 5, time: 30 });
    await tab.until(`IOInput.state.mouse.has(1)`, 2000, 'the left button down');
    assert.deepEqual(tab.errors, []);
    await tab.close();
  } finally { io.close(); }
});

test('the colour mode: auto by default, a choice is remembered', async () => {
  let tab = await chrome.open(site.origin + '/inputty/', { width: 1280, height: 800 });
  await tab.until(`document.querySelector('.mode .kc[aria-pressed="true"]')`, 8000, 'the mode keys');
  assert.equal(await tab.eval(`document.querySelector('.mode .kc[aria-pressed="true"]').dataset.mode`), 'auto');
  await tab.click('.mode .kc[data-mode="dark"]');
  assert.equal(await tab.eval(`document.documentElement.dataset.mode`), 'dark');
  await tab.close();
  tab = await chrome.open(site.origin + '/inputty/', { width: 1280, height: 800 });
  await tab.until(`document.documentElement.dataset.mode`, 4000, 'the mode');
  assert.equal(await tab.eval(`document.documentElement.dataset.mode`), 'dark', 'set before the page draws');
  await tab.eval(`localStorage.removeItem('inputty-mode'); 1`);
  await tab.close();
});

test('the widgets page: Inputty\'s scene shows the live overlay, and the visitor\'s keys light it up (numbers still switch)', async () => {
  const tab = await chrome.open(site.origin + '/widgets/', { width: 1536, height: 960 });
  await tab.until(`document.querySelector('.key[data-scene="inputty"]')`, 8000, 'the deck');
  await tab.click('.key[data-scene="inputty"]');
  await tab.until(`document.querySelector('.sc[data-scene="inputty"] iframe.ready')`, 10000, 'Inputty live');
  await tab.eval(`dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); 1`);
  await tab.until(`[...document.querySelector('.sc[data-scene="inputty"] iframe').contentWindow.IOInput.state.keys].includes(0x11)`, 2000, 'W lit on stream');
  await tab.eval(`dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); 1`);
  assert.equal(await tab.eval(`document.querySelector('#info-name').getAttribute('href')`), '/inputty/');
  await tab.eval(`dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' })); 1`);
  await tab.until(`document.querySelector('.key[aria-pressed="true"]').dataset.scene === 'chatagram'`, 3000, '1 still switches scenes');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

// Owner (2026-10-19): the Switch Pro's Neon art showed a box behind the controller (a faint white panel baked into the
// picture), and it stayed after switching to theme colours. The build cuts it out (scripts/inputty-presets.mjs, CLEAN).
test('preset pictures: the Switch Pro\'s Neon art has no panel behind the controller', async () => {
  const tab = await chrome.open(site.origin + '/inputty/play.html', { width: 400, height: 300 });
  const alpha = await tab.eval(`(async () => {
    const img = new Image(); img.src = '/inputty/presets/switch-pro-controller/switch-pro-controller-splatoon2.webp'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const k = img.width / 1280;   // measured on the 1280-wide original: the gap between the grips, and a top corner
    return [[640, 840], [40, 40]].map(([x, y]) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data[3]);
  })()`);
  assert.deepEqual(alpha, [0, 0], 'see-through between the grips and outside the controller');
  await tab.close();
});
