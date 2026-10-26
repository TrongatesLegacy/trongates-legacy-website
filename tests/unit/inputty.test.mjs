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

// Owner (2026-10-19): WASD and Mouse are the set-up's defaults, and our own layouts come after input-overlay's. A link
// names its layouts by preset and style number, and leaves out what matches looks.js's DEFAULTS, so neither may shift
// under a link someone already has in OBS.
test('links made before stay the same: no layout in the link is still Game keys (Hero shooter) and the Gaming mouse', () => {
  const { IOLooks: L } = lib(['looks.js']);
  const s = L.read(new URLSearchParams(''));
  assert.deepEqual([s.p, s.v, s.p2, s.v2], ['game-keys', 1, 'game-mouse', 0]);
});

test('our layouts come last, and their styles keep their numbers (new ones are added at the end)', () => {
  const { IO_PRESETS: P } = lib(['presets.js', 'ours.js']);
  const firstOurs = P.findIndex((p) => p.ours);
  assert.ok(firstOurs > 0 && P.slice(firstOurs).every((p) => p.ours), 'ours after every input-overlay preset');
  const names = (id) => Array.from(P.find((p) => p.id === id).variants, (v) => v.name);
  assert.deepEqual(names('game-keys'), ['FPS', 'Hero shooter', 'WASD', 'MOBA', 'Arrows + Z X C', 'Two big keys']);
  assert.deepEqual(names('keyboard').slice(0, 4), ['No number pad', 'Compact (60%)', 'With number pad', 'Number pad']);
  // the compact clusters, like input-overlay's WASD styles (the owner)
  for (const n of ['Just W A S D', '+ Q, E', '+ arrows', 'French (Z Q S D)']) assert.ok(names('keyboard').includes(n), n);
});

test('colours: a chosen key colour is line art\'s line colour exactly; the named themes\' own line colours otherwise', () => {
  const { IOLooks: L } = lib(['looks.js']);
  assert.equal(L.look({ ...L.DEFAULTS, key: 'ff3366' }).lines, 'ff3366');
  assert.equal(L.look({ ...L.DEFAULTS, theme: 'neutral' }).lines, L.THEMES.neutral.lines);
  assert.equal(L.look({ ...L.DEFAULTS, ink: '123456' }).ink, '123456', 'Letters ride in the link');
});

// Owner (2026-10-21): on WASD and the like (input-overlay's outline WASD and mouse, and the keyboards and mouse we draw), Neon,
// Royal and Deep's keys came out dark and muddy; they get bright lines and keycaps of their own.
// input-overlay's pictures and the controllers keep the theme's colours as they were
test('Neon, Royal and Deep draw WASD and the like bright (lines and drawn keys); pictures and controllers keep the theme\'s colours', () => {
  const { IOLooks: L } = lib(['looks.js']);
  const lum = (h) => { const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const was = { neon: '24506f', royal: 'b8924a', deep: '1d6e78' };
  for (const [theme, key] of Object.entries(was)) {
    const look = L.look({ ...L.DEFAULTS, theme });
    assert.equal(look.key, key, `${theme}: pictures and controllers keep their key colour`);
    assert.ok(lum(look.kbm.key) >= 0.5, `${theme}: drawn keys are bright (${look.kbm.key})`);
    assert.ok(lum(look.kbm.key) / lum(look.kbm.edge) >= 4.5, `${theme}: the letters (edge colour) read on them`);
    // and line art (input-overlay's WASD and outline mouse, where the set-up starts) is drawn in bright lines
    assert.ok(lum(look.kbm.lines) >= 0.5, `${theme}: line art's lines are bright (${look.kbm.lines})`);
    const mix = (a, b, t) => [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
    assert.equal(look.lines, mix(L.THEMES[theme].key, L.THEMES[theme].hi, 0.3), `${theme}: a controller's line art keeps its lines as they were`);
    // a key colour picked in the link still wins
    assert.equal(L.look({ ...L.DEFAULTS, theme, key: 'ff3366' }).kbm.key, 'ff3366');
  }
  // the others draw with their own colours, as before
  for (const theme of ['zojie', 'neutral', 'light', 'candy', 'cozy']) {
    const look = L.look({ ...L.DEFAULTS, theme });
    assert.deepEqual([look.kbm.key, look.kbm.edge, look.kbm.hi], [look.key, look.edge, look.hi], theme);
  }
});

// Owner (2026-10-19): Two big keys (made for osu!) keeps Z and X, but you can pick your own two
test('Two big keys take any two keys from the link (keys=KeyA,KeyS), with their own letters; an unknown key keeps the default', () => {
  const { IO_PRESETS: P, IOOurs: O, IOLooks: L } = lib(['presets.js', 'ours.js', 'looks.js']);
  const v = P.find((p) => p.id === 'game-keys').variants.find((x) => x.name === 'Two big keys');
  assert.equal(v.pick, 2);
  const keys = (s) => Array.from(O.withKeys(v.drawn, s).keys, (k) => k[0] + ':' + k[1]).join(' ');
  assert.equal(keys(''), 'KeyZ:Z KeyX:X');
  assert.equal(keys('KeyA,KeyS'), 'KeyA:A KeyS:S');
  assert.equal(keys('Space,Digit1'), 'Space:Space Digit1:1');
  assert.equal(keys('Nope,KeyS'), 'KeyZ:Z KeyS:S');
  assert.equal(L.read(new URLSearchParams('keys=KeyA,KeyS')).keys, 'KeyA,KeyS');
  assert.equal(L.query(L.DEFAULTS), '', 'no keys in a link that keeps Z and X');
});

test('the helper download: every link is the one version, the size and OBS shown come from it, older OBS has its own link', async () => {
  const { installerIn, withInstaller } = await import('../../scripts/check-input-overlay.mjs');
  const src = read('public/inputty/lib/guide.js'), ins = installerIn(src);
  assert.equal(withInstaller(src, ins), src, 'INSTALLER is exactly what the daily check writes');
  assert.match(ins.size, /^\d+\.\d MB$/);
  assert.match(ins.old, /\/releases\/tag\/5\.0\.6$/);
  assert.match(src, /Needs OBS \$\{INSTALLER\.obs\} or newer \(older OBS\? <a href="\$\{INSTALLER\.old\}"/);
});

test('daily input-overlay check: same version → ok; a newer one → updated, guide.js rewritten; risky or odd ones → review, nothing written', async () => {
  const { check, installerIn, obsIn } = await import('../../scripts/check-input-overlay.mjs');
  const src = read('public/inputty/lib/guide.js'), ours = installerIn(src).version;
  const exe = (v, size = 5123456) => ({ name: `input-overlay-${v}-windows-x64-Installer.exe`, size });
  const deb = (v) => ({ name: `input-overlay-${v}-x86_64-linux-gnu.deb`, size: 1 });
  const run = async (rel, ok = true) => {
    let written = null;
    const r = await check({ fetch_: async () => ({ ok, status: ok ? 200 : 503, json: async () => rel }), read: () => src, write: (t) => { written = t; }, token: '' });
    return { ...r, written };
  };
  assert.equal((await run({ tag_name: ours, assets: [exe(ours), deb(ours)], body: '' })).status, 'ok');

  const up = await run({ tag_name: '9.9.9', assets: [exe('9.9.9'), deb('9.9.9')], body: 'Fixes.\n### This version is only compatible with OBS versions 33 and newer.' });
  assert.equal(up.status, 'updated');
  const now = installerIn(up.written);
  assert.deepEqual([now.version, now.size, now.obs, now.old], ['9.9.9', '5.1 MB', '33', installerIn(src).old]);
  assert.match(up.written, /releases\/download\/9\.9\.9\/input-overlay-9\.9\.9-windows-x64-Installer\.exe/);
  assert.ok(!up.written.includes(`/${ours}/`), 'no link left on the old version');

  for (const [rel, why] of [
    [{ tag_name: '9.9.9', assets: [deb('9.9.9')], body: '' }, /no Windows installer/],
    [{ tag_name: '9.9.9', assets: [exe('9.9.9'), deb('9.9.9')], body: 'This release uses new keyboard key codes' }, /websocket or key codes/],
    [{ tag_name: '9.9.9', assets: [exe('9.9.9'), deb('9.9.9')], body: 'Changed the web socket messages' }, /websocket or key codes/],
    [{ tag_name: '9.9.9', assets: [exe('9.9.9'), deb('9.9.9')], body: 'only compatible with OBS versions 34 and newer' }, /needs OBS 34/],
  ]) {
    const r = await run(rel);
    assert.equal(r.status, 'review'); assert.match(r.summary, why); assert.equal(r.written, null);
  }
  assert.equal((await run(null, false)).status, 'unreachable');
  assert.equal(obsIn('### This version is only compatible with OBS versions 33 and newer.'), '33');
  assert.equal(obsIn('Requires OBS 31.0 or later'), '31');
});
