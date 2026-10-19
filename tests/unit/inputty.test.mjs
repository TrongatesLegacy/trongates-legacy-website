// Inputty (docs/widgets.md, "Inputty"): the preset library and its pictures, the settings in the link, and how input
// from input-overlay's websocket is read (its key codes changed in 5.1; bursts arrive newest-first). The page and the
// overlay themselves are in tests/browser/inputty.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { read } from '../helpers/sim.mjs';

const pub = (p) => new URL(`../../public/inputty/${p}`, import.meta.url);
const lib = (files, extra = {}) => {
  const ctx = vm.createContext({ URLSearchParams, JSON, Math, setTimeout, clearTimeout, performance, ...extra }); ctx.window = ctx;
  for (const f of files) vm.runInContext(read('public/inputty/lib/' + f), ctx);
  return ctx;
};

test('presets: only art that is the contributor\'s to share ships, with input-overlay\'s licence beside it', () => {
  const { IO_PRESETS: P } = lib(['presets.js']);
  assert.ok(P.length >= 20, `${P.length} presets`);
  for (const p of P) assert.ok(!['brand', 'ask', 'unclear'].includes(p.licence), `${p.id} (${p.licence}) must not ship`);
  for (const id of ['g502x', 'f710', 'inphic', 'g602', 'sc6', 'nes-pixel', 'gameboy-pixel', 'workman']) assert.ok(!P.some((p) => p.id === id), `${id} is left out`);
  assert.match(readFileSync(pub('presets/LICENSE.txt'), 'utf8'), /GNU GENERAL PUBLIC LICENSE\s+Version 2/);
});

test('presets: every picture is there in both sizes, the set-up\'s copy is the smaller, and the original size is known', () => {
  const { IO_PRESETS: P } = lib(['presets.js']);
  let full = 0;
  for (const p of P) for (const v of p.variants) for (const a of v.arts || []) {
    assert.ok(existsSync(pub(a.src)), `${a.src} is missing`);
    assert.ok(existsSync(pub(a.thumb)), `${a.thumb} is missing`);
    assert.ok(statSync(pub(a.thumb)).size <= statSync(pub(a.src)).size, `${a.thumb} is bigger than ${a.src}`);
    assert.ok(a.aw > 0 && a.ah > 0, `${a.src}: the original size (the layout's numbers are measured on it)`);
    full = Math.max(full, statSync(pub(a.src)).size);
  }
  assert.ok(full < 250_000, `the biggest picture OBS loads is ${Math.round(full / 1024)} KB`);
});

test('the outline mouse: every side-button and movement combination exists, with the right buttons mirrored', () => {
  const { IO_PRESETS: P } = lib(['presets.js']);
  const m = P.find((p) => p.id === 'mouse');
  assert.deepEqual([...m.axes.map((a) => a.key)], ['side', 'move']);
  for (const [side] of m.axes[0].values) for (const [move] of m.axes[1].values) {
    const v = m.variants.find((x) => x.opts.side === side && x.opts.move === move);
    assert.ok(v, `${side} + ${move}`);
    const sideButtons = v.layout.els.filter((e) => e.t === 3 && (e.c === 4 || e.c === 5));
    assert.equal(sideButtons.length, { left: 2, right: 2, both: 4, none: 0 }[side], `${side}: side buttons`);
    assert.equal(sideButtons.filter((e) => e.f).length, { left: 0, right: 2, both: 2, none: 0 }[side], `${side}: mirrored ones`);
  }
  assert.ok(!m.variants.some((v) => /pixel/i.test(v.name)), 'no pixel style');
});

test('settings: the defaults make an empty link, a link reads back, the port is clamped', () => {
  const { IOLooks: L } = lib(['looks.js']);
  assert.equal(L.query(L.DEFAULTS), '');
  const q = L.query({ ...L.DEFAULTS, theme: 'neon', accent: 'ff7fdc', p: 'xboxone', port: 17000 });
  assert.equal(q, 'p=xboxone&theme=neon&accent=ff7fdc&port=17000');
  const back = L.read(new URLSearchParams(q));
  assert.equal(back.theme, 'neon'); assert.equal(back.p, 'xboxone'); assert.equal(back.port, 17000);
  assert.equal(L.read(new URLSearchParams('port=999999')).port, 65535);
  assert.equal(L.read(new URLSearchParams('theme=nope')).theme, L.DEFAULTS.theme, 'an unknown theme falls back');
  for (const t of Object.values(L.THEMES)) assert.equal(t.frame, 'none', `${t.label}: no frame by default (the owner)`);
  assert.equal(L.fxOf(L.DEFAULTS), false, 'no sparkles by default (the owner)');
});

// a pretend input-overlay socket: the page's WebSocket is replaced, and the test sends what input-overlay sends
function withSocket() {
  const sockets = [];
  class FakeSocket { constructor(url) { this.url = url; sockets.push(this); setTimeout(() => this.onopen?.(), 0); } close() {} send() {} }
  const ctx = lib(['codes.js', 'input.js'], { WebSocket: FakeSocket, navigator: {}, addEventListener() {} });
  const say = (msgs) => { for (const m of msgs) sockets.at(-1).onmessage({ data: JSON.stringify(m) }); };
  return { ctx, sockets, say, I: ctx.IOInput };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('websocket: it connects to this PC on the chosen port', async () => {
  const { I, sockets } = withSocket();
  I.connect(17000);
  assert.equal(sockets.at(-1).url, 'ws://127.0.0.1:17000/');
});

test('websocket: a quick tap that arrives newest-first (as input-overlay sends a burst) never leaves a key stuck down', async () => {
  const { I, say } = withSocket();
  I.connect(16899);
  await wait(5);
  say([{ event_type: 'key_released', keycode: 0x11, rawcode: 0x57, time: 20 }, { event_type: 'key_pressed', keycode: 0x11, rawcode: 0x57, time: 10 }]);
  await wait(30);
  assert.equal(I.state.keys.size, 0, 'W is up again');
  say([{ event_type: 'key_pressed', keycode: 0x11, rawcode: 0x57, time: 30 }]);
  await wait(30);
  assert.deepEqual(Array.from(I.state.keys), [0x11], 'and a held key stays down');
});

test('websocket: keys are read by their Windows code, so input-overlay 5.0 and 5.1 (new key codes) both work', async () => {
  const { I, say, ctx } = withSocket();
  I.connect(16899);
  await wait(5);
  // 5.1 sends its own new code for A (0x30, 5.0's B), with Windows' code for A (0x41) as rawcode
  say([{ event_type: 'key_pressed', keycode: 0x30, rawcode: 0x41, time: 1 }]);
  await wait(30);
  assert.deepEqual(Array.from(I.state.keys), [ctx.IOCodes.KEYS.KeyA], 'A, not B');
});
