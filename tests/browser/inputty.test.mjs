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
  await tab.until(`${visible} === 's1,s2,s3,s4,s5,s6,s7'`, 4000, 'every step after picking');
  await tab.until(`document.querySelector('.scenebox').classList.contains('flat')`, 4000, 'the screen turns to face you');
  // the layouts (step 2), then the look (step 3: the owner wanted the colours offered for the layouts chosen)
  assert.ok(await tab.eval(`!!document.querySelector('#s2 .g-layout') && !!document.querySelector('#s3 .g-theme')`));
  await tab.click('[data-next="2"]');
  await tab.click('[data-next="3"]');
  await tab.click('[data-next="4"]');
  assert.equal(await tab.eval(done), 's1,s2,s3,s4');
  await tab.click('#s3 .g-theme[data-t="neon"]');
  assert.equal(await tab.eval(done), 's1,s2,s3', 'a click in step 3 forgets step 4');
  // the link carries the look, and goes to the overlay
  const url = await tab.eval(`document.querySelector('.g-url').textContent`);
  assert.match(url, /\/inputty\/play\.html\?.*theme=neon/);
  assert.match(url, /[?&]p=wasd&.*p2=mouse/, 'WASD and Mouse by default (the owner), written into the link');
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
  assert.match(await tab.eval(`document.querySelector('.sc[data-scene="inputty"] iframe').src`), /[?&]p=wasd&.*p2=mouse/, 'WASD and Mouse, as the set-up starts (the owner)');
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

// Owner (2026-10-19): one row of colours under the theme, showing only the ones that change the chosen layouts (WASD and
// the outline mouse: just Keys and Pressed). Our own drawn layouts take Letters, Edges and Shine too.
test('the colours: only the ones that change the chosen layouts, on one row; a theme starts them over', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960 });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  await tab.click('.g-device[data-d="kbm"]');
  const chips = `[...document.querySelectorAll('#s3 .g-chip')].map((c) => c.dataset.k).join()`;
  await tab.until(`${chips} === 'key,accent'`, 5000, 'WASD and Mouse: Keys and Pressed');
  await tab.click('#s2 .g-layout[data-id="keyboard"]');
  await tab.click('#s2 .g-layout[data-id="game-mouse"]');
  await tab.until(`${chips} === 'key,accent,ink,edge,hi'`, 5000, 'our keyboard and mouse: all five');
  const tops = await tab.eval(`new Set([...document.querySelectorAll('#s3 .g-chip')].map((c) => Math.round(c.getBoundingClientRect().top))).size`);
  assert.equal(tops, 1, 'all on one row');
  // pick a key colour: it goes in the link; a theme starts the colours over
  await tab.click('#s3 .g-chip[data-k="key"]');
  await tab.click('#s3 .g-pal .g-sw[data-c="ff7fdc"]');
  assert.match(await tab.eval(`document.querySelector('.g-url').textContent`), /key=ff7fdc/);
  assert.equal(await tab.eval(`!!document.querySelector('#s3 .g-warn-row')`), false, "pink keys, Zojie's lilac presses: no warning");
  await tab.click('#s3 .g-chip[data-k="accent"]');
  await tab.click('#s3 .g-pal .g-sw[data-c="ff9fc6"]');
  await tab.until(`!!document.querySelector('#s3 .g-warn-row')`, 2000, 'light pink on pink: too alike, warned');
  await tab.click('#s3 .g-fix');
  await tab.until(`!document.querySelector('#s3 .g-warn-row')`, 2000, 'fixed');
  await tab.click('#s3 .g-theme[data-t="deep"]');
  assert.doesNotMatch(await tab.eval(`document.querySelector('.g-url').textContent`), /key=|accent=/);
  assert.equal(await tab.eval(`document.documentElement.scrollWidth - innerWidth`), 0);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test("the colours: the theme's own pair never warns, even when close (Zojie's lilac keys and presses)", async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960 });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  await tab.click('.g-device[data-d="kbm"]');
  await tab.until(`document.querySelector('#s3 .g-chip')`, 5000, 'the chips');
  assert.equal(await tab.eval(`!!document.querySelector('#s3 .g-warn-row')`), false);
  await tab.close();
});

test("the overlay: a chosen key colour is exactly the colour of WASD's lines", async () => {
  const tab = await chrome.open(site.origin + '/inputty/play.html?demo=1&bgo=0&p=wasd&v=0&p2=mouse&key=ff3366', { width: 900, height: 420 });
  await tab.until(`document.documentElement.dataset.ready === '1'`, 8000, 'the overlay drawn');
  await sleep(600);
  const top = await tab.eval(`(() => {
    const m = new Map();
    for (const c of document.querySelectorAll('canvas')) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) { const k = d[i] * 65536 + d[i + 1] * 256 + d[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
    }
    return [...m].sort((a, b) => b[1] - a[1])[0][0].toString(16).padStart(6, '0');
  })()`);
  assert.equal(top, 'ff3366');
  await tab.close();
});

test('keyboard and mouse: just the keyboard or just the mouse leaves the other out of the link and off the desk; switching back brings it back', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960, reducedMotion: true });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  assert.equal(await tab.eval(`document.getElementById('which').hidden`), true, 'nothing to choose before a device');
  await tab.click('.g-device[data-d="kbm"]');
  await tab.until(`!!document.querySelector('#which [data-w="keyboard"]')`, 4000, 'the choice');
  const url = () => tab.eval(`document.querySelector('.g-url').textContent`);
  const out = (part) => tab.eval(`document.querySelector('[data-part="${part}"]').classList.contains('out')`);
  const pressed = `document.querySelector('#which [aria-pressed=true]').dataset.w`;
  assert.equal(await tab.eval(pressed), 'both');
  await tab.click('#layouts2 .g-layout[data-id="game-mouse"]');
  await tab.click('#which [data-w="keyboard"]');
  assert.match(await url(), /[?&]p2=(&|$)/, 'no mouse in the link');
  assert.match(await url(), /[?&]p=wasd/);
  assert.equal(await tab.eval(`document.getElementById('layouts2wrap').hidden`), true);
  assert.equal(await out('mouse'), true, 'the mouse leaves the desk');
  assert.equal(await out('kb'), false);
  await tab.click('#which [data-w="mouse"]');
  assert.match(await url(), /[?&]p=(&|$)/, 'no keyboard in the link');
  // the mouse picked before comes back (Gaming mouse is the link's default second layout, so the link leaves it out)
  assert.doesNotMatch(await url(), /[?&]p2=/);
  assert.equal(await tab.eval(`document.querySelector('#layouts2 .g-layout[aria-pressed=true]').dataset.id`), 'game-mouse');
  assert.equal(await tab.eval(`document.getElementById('layouts1wrap').hidden`), true);
  assert.equal(await tab.eval(`document.getElementById('layouts2wrap').hidden`), false);
  assert.equal(await out('kb'), true);
  assert.equal(await out('mouse'), false);
  assert.equal(await tab.eval(pressed), 'mouse');
  await tab.click('#which [data-w="both"]');
  assert.match(await url(), /[?&]p=wasd/, 'both back as they were');
  assert.doesNotMatch(await url(), /[?&]p2=/);
  // a controller has no such choice
  await tab.click('.g-device[data-d="pad"]');
  assert.equal(await tab.eval(`document.getElementById('which').hidden`), true);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('the overlay draws just the keyboard or just the mouse when the other is left out of the link', async () => {
  for (const q of ['p=wasd&v=0&p2=', 'p=&p2=mouse']) {
    const tab = await chrome.open(site.origin + '/inputty/play.html?demo=1&' + q, { width: 900, height: 420 });
    await tab.until(`document.documentElement.dataset.ready === '1'`, 8000, 'the overlay drawn');
    assert.equal(await tab.eval(`document.querySelectorAll('.views .view').length`), 1, q);
    assert.deepEqual(tab.errors, []);
    await tab.close();
  }
});

test('on a phone the layouts are a grid, never one long column, and every card in a grid is the same width', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 390, height: 844, mobile: true, reducedMotion: true });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  const grids = `[...document.querySelectorAll('#s2 .g-layouts, #s2 .g-tiles')].filter((g) => g.offsetParent).map((g) => {
    const items = [...g.children].filter((c) => !c.classList.contains('g-detail'));
    return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, widths: [...new Set(items.map((c) => Math.round(c.getBoundingClientRect().width)))] };
  })`;
  for (const d of ['pad', 'kbm']) {
    await tab.click(`.g-device[data-d="${d}"]`);
    await tab.until(`!!document.querySelector('#s2 .g-tiles')`, 4000, 'the styles');
    await sleep(300);
    for (const g of await tab.eval(grids)) {
      assert.ok(g.cols >= 2, `${d}: two or more columns`);
      assert.equal(g.widths.length, 1, `${d}: one width (${g.widths})`);
    }
  }
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test("a pressed key is the theme's pressed colour, even where the picture draws presses as a dark fill (WASD + number pad)", async () => {
  const tab = await chrome.open(site.origin + '/inputty/play.html?demo=1&p=wasd-numpad&p2=', { width: 900, height: 420 });
  await tab.until(`document.documentElement.dataset.ready === '1'`, 8000, 'the overlay drawn');
  // the pressed parts of the recoloured picture, by colour: Candy's pressed colour, not mixed with its deep violet
  const top = await tab.eval(`(async () => {
    const p = IO_PRESETS.find((x) => x.id === 'wasd-numpad'), v = p.variants[0], art = v.arts[0];
    const view = new IORender.PresetView(v.layout, art.src, { pixel: v.pixel, aw: art.aw });
    await view.load();
    view.setLook(IOLooks.look({ ...IOLooks.DEFAULTS, theme: 'candy' }));
    const { mask, W, H } = view.pressedMask();
    const d = view.atlas.getContext('2d').getImageData(0, 0, W, H).data, m = new Map();
    for (let q = 0; q < W * H; q++) if (mask[q] && d[q * 4 + 3] > 200) { const k = ((d[q * 4] << 16) | (d[q * 4 + 1] << 8) | d[q * 4 + 2]).toString(16).padStart(6, '0'); m.set(k, (m.get(k) || 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1])[0][0];
  })()`);
  const near = (a, b) => [0, 2, 4].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 3);
  assert.ok(near(top, 'ffd23f'), `Candy's pressed colour, not ${top}`);
  await tab.close();
});

test('Two big keys: click a key, press the one you use; it goes in the link (and the preview), taking the other\'s place swaps them', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960, reducedMotion: true });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  await tab.click('.g-device[data-d="kbm"]');
  await tab.until(`!!document.querySelector('#layouts1 .g-layout[data-id="game-keys"]')`, 4000, 'Game keys');
  await tab.click('#layouts1 .g-layout[data-id="game-keys"]');
  await tab.until(`!!document.querySelector('#layouts1 .g-tile[data-v="5"]')`, 4000, 'its styles');
  assert.equal(await tab.eval(`!!document.querySelector('#layouts1 .g-key')`), false, 'only Two big keys has keys to pick');
  await tab.click('#layouts1 .g-tile[data-v="5"]');
  const keys = `[...document.querySelectorAll('#layouts1 .g-key')].map((b) => b.textContent).join(' ')`;
  assert.equal(await tab.eval(keys), 'Z X');
  const press = async (code, key) => { await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key }); await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key }); };
  const url = () => tab.eval(`document.querySelector('.g-url').textContent`);
  await tab.click('#layouts1 .g-key[data-ki="0"]');
  assert.equal(await tab.eval(`document.querySelector('#layouts1 .g-key[data-ki="0"]').textContent`), 'Press a key…');
  await press('KeyA', 'a');
  assert.equal(await tab.eval(keys), 'A X');
  assert.match(await url(), /[?&]keys=KeyA%2CKeyX/);
  assert.match(await tab.eval(`document.getElementById('preview').src`), /keys=KeyA%2CKeyX/, 'the preview shows them');
  await tab.click('#layouts1 .g-key[data-ki="1"]');
  await press('KeyA', 'a');
  assert.equal(await tab.eval(keys), 'X A', 'the same key twice swaps them');
  await tab.click('#layouts1 .g-key[data-ki="0"]');
  await press('Escape', 'Escape');
  assert.equal(await tab.eval(keys), 'X A', 'Escape keeps what was there');
  // Space, which would click the focused button, is just a key here
  await tab.eval(`document.querySelector('#layouts1 .g-key[data-ki="1"]').focus()`);
  await tab.click('#layouts1 .g-key[data-ki="1"]');
  await press('Space', ' ');
  await sleep(100);
  assert.equal(await tab.eval(keys), 'X Space');
  // back to Z and X leaves keys out of the link; another style leaves them out too
  await tab.click('#layouts1 .g-tile[data-v="4"]');
  assert.doesNotMatch(await url(), /keys=/);
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('the overlay draws Two big keys with the keys from the link, and they light up', async () => {
  const tab = await chrome.open(site.origin + '/inputty/play.html?p=game-keys&v=5&p2=&keys=KeyA,KeyS', { width: 900, height: 420 });
  await tab.until(`document.documentElement.dataset.ready === '1'`, 8000, 'the overlay drawn');
  const lit = () => tab.eval(`(() => { const c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - 0xb1) < 12 && Math.abs(d[i + 1] - 0x8c) < 12 && Math.abs(d[i + 2] - 0xff) < 12) n++; return n; })()`);
  const before = await lit();
  await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyA', key: 'a' });
  await sleep(250);
  assert.ok(await lit() > before + 500, 'A lights up');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});

test('Theme colours after picking one of a layout\'s own pictures (DualSense, Black) recolours the picture its tile shows, the first', async () => {
  const tab = await chrome.open(site.origin + '/inputty/?os=windows', { width: 1536, height: 960, reducedMotion: true });
  await tab.until(`document.querySelector('.g-device')`, 8000, 'the device choices');
  await tab.click('.g-device[data-d="pad"]');
  await tab.until(`!!document.querySelector('#layouts1 .g-layout[data-id="dualsense"]')`, 4000, 'the DualSense');
  await tab.click('#layouts1 .g-layout[data-id="dualsense"]');
  await tab.until(`!!document.querySelector('#layouts1 .g-tile[data-a="1"]')`, 4000, 'its pictures');
  const url = () => tab.eval(`document.querySelector('.g-url').textContent`);
  await tab.click('#layouts1 .g-tile[data-a="1"]');
  assert.match(await url(), /[?&]a=1&.*orig=1/, 'Black, its own colours');
  await tab.click('#layouts1 .g-tile[data-orig="0"]');
  assert.doesNotMatch(await url(), /[?&](a|orig)=/, 'the first picture, in the theme');
  assert.deepEqual(tab.errors, []);
  await tab.close();
});
