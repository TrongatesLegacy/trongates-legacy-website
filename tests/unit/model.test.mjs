// model.js: the OBS settings and how they become each scene's address (shared by the dock and the OBS index).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams, URL, btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent });
ctx.window = ctx;
vm.runInContext(read('public/obs/shared/model.js'), ctx, { filename: 'model.js' });
const M = ctx.TGLModel;
const HOST = 'https://www.trongateslegacy.com/obs/';
const opts = (pairs) => Object.fromEntries(pairs);
const url = (kind, s, ctx2 = {}, base = HOST + (M.TYPES[kind]?.file || M.WIDGETS[kind].file)) => M.withOptions(base, M.options(kind, s, ctx2));
// vm objects come from another realm: compare as plain data
const plain = (x) => JSON.parse(JSON.stringify(x));

test('defaults: every scene has its settings, and normalise fills in whatever an old save is missing', () => {
  const d = M.defaults();
  assert.deepEqual(Object.keys(d.scenes).sort(), ['brb', 'chatting', 'ending', 'game', 'starting']);
  const old = M.normalise({ key: 'k', scenes: { brb: { off: ['goal'] } }, veado: { addr: 'x:1' } });
  assert.equal(old.key, 'k');
  assert.deepEqual(plain(old.scenes.brb.off), ['goal']);
  assert.equal(old.scenes.brb.cycle, true);
  assert.equal(old.veado.addr, 'x:1');
  assert.deepEqual(plain(old.veado.map), {});
  assert.deepEqual(plain(M.normalise(null)), plain(M.defaults()));
});

test('a default scene address carries nothing it does not need', () => {
  const s = M.defaults();
  assert.equal(url('brb', s), HOST + 'brb');
  assert.equal(url('chatting', s), HOST + 'chatting');
  assert.equal(url('game', s), HOST + 'game');
});

test('Game (window): layout=window, rings=1 only when on, and hide= lists only the window layout parts', () => {
  const s = M.defaults();
  s.scenes.game.layout = 'window';
  assert.equal(url('game', s), HOST + 'game?layout=window');
  s.scenes.game.rings = true;
  assert.equal(url('game', s), HOST + 'game?layout=window&rings=1');
  s.scenes.game.off = ['goal', 'art'];                  // art isn't a window part: never in the address
  assert.equal(opts(M.options('game', s)).hide, 'goal');
  s.scenes.game.layout = 'full';
  assert.equal(opts(M.options('game', s, { layout: 'full' })).rings, undefined);
});

test('hide= keeps the parts in the scene\'s own order', () => {
  const s = M.defaults();
  s.scenes.brb.off = ['ticker', 'chat', 'rings'];
  assert.equal(opts(M.options('brb', s)).hide, 'chat,ticker,rings');
});

test('colour: cycling scenes can stop cycling (cycle=0), following scenes can stop following (noveado=1)', () => {
  const s = M.defaults();
  s.scenes.starting.cycle = false; s.scenes.chatting.follow = false;
  assert.equal(opts(M.options('starting', s)).cycle, '0');
  assert.equal(opts(M.options('chatting', s)).noveado, '1');
  // a cycling scene that still cycles never gets veadotube options
  s.veado.addr = '192.168.1.5:54765'; s.veado.map = { fishing: 'blobfish' }; s.veado.delay = 300;
  const brb = opts(M.options('brb', s));
  assert.equal(brb.veado, undefined); assert.equal(brb.map, undefined);
});

test('veadotube options reach the scenes that follow it: address (unless default), pinned states, delay', () => {
  const s = M.defaults();
  s.veado.addr = M.VEADO_DEFAULT;
  assert.equal(opts(M.options('chatting', s)).veado, undefined);
  s.veado.addr = '192.168.1.5:54765'; s.veado.map = { fishing: 'blobfish', tiara: 'princess', blank: '' }; s.veado.delay = 300;
  const o = opts(M.options('chatting', s));
  assert.equal(o.veado, '192.168.1.5:54765');
  assert.equal(o.map, 'fishing:blobfish,tiara:princess');
  assert.equal(o.veadodelay, '300');
  assert.match(url('chatting', s), /map=fishing:blobfish,tiara:princess/);   // readable in OBS: , and : unescaped
});

test('Botrix: pasted links go in whole, the Netlify key otherwise; a shared chat means the scene loads no chat', () => {
  const s = M.defaults();
  s.key = 'secret-key';
  assert.equal(opts(M.options('brb', s)).key, 'secret-key');
  s.links = { chat: 'https://botrix.live/widgets/chat/?bid=abc', goal: '' }; s.linksMode = 'paste';
  const o = opts(M.options('brb', s));
  assert.equal(o.chat, 'https://botrix.live/widgets/chat/?bid=abc');
  assert.equal(o.key, 'secret-key');                   // the goal still comes through the key
  s.shared = true;
  assert.equal(opts(M.options('brb', s)).chat, '0');
  // Starting soon has no chat or goal: no Botrix options at all
  assert.equal(M.options('starting', s).filter(([k]) => ['chat', 'goal', 'key'].includes(k)).length, 0);
});

test('previews never connect to veadotube or OBS and show the sample chat, not the shared one', () => {
  const s = M.defaults();
  s.shared = true; s.key = 'k';
  const o = opts(M.options('brb', s, { preview: { form: 'princess', guide: true, sample: true }, obs: { port: '4455', pw: 'pw' } }));
  assert.equal(o.noveado, '1'); assert.equal(o.obs, undefined); assert.equal(o.obspw, undefined);
  assert.equal(o.chat, undefined); assert.equal(o.form, 'princess'); assert.equal(o.guide, '1'); assert.equal(o.demo, '1');
  assert.equal(o.music, 'demo');
});

test('the OBS WebSocket reaches real scene addresses (the dock\'s colour buttons need it)', () => {
  const o = opts(M.options('chatting', M.defaults(), { obs: { port: '4455', pw: 'p w' } }));
  assert.equal(o.obs, '4455'); assert.equal(o.obspw, 'p w');
});

test('withOptions replaces the options the panel owns and keeps everything else', () => {
  const base = HOST + 'brb?hide=goal&custom=1&motion=full#frag';
  const out = M.withOptions(base, [['hide', 'chat']]);
  assert.equal(out, HOST + 'brb?custom=1&hide=chat');
  assert.equal(M.withOptions(HOST + 'brb?obs=1', []), HOST + 'brb');
});

test('sameUrl ignores option order and encoding', () => {
  assert.ok(M.sameUrl(HOST + 'brb?a=1&b=x%2Cy', HOST + 'brb?b=x,y&a=1'));
  assert.ok(!M.sameUrl(HOST + 'brb?a=1', HOST + 'brb?a=2'));
  assert.ok(!M.sameUrl(HOST + 'brb?a=1', HOST + 'ending?a=1'));
});

test('recognise: every Trongates page, hosted or local, and raw Botrix widgets', () => {
  const k = (u) => M.recognise(u)?.kind ?? null;
  assert.equal(k(HOST + 'brb'), 'brb');
  assert.equal(k('file:///C:/Users/x/public/obs/chatting.html?form=princess'), 'chatting');
  assert.equal(k(HOST + 'chat?bare=1'), 'bare');
  assert.equal(k(HOST + 'chat'), 'chatbox');
  assert.equal(M.recognise(HOST + 'game?layout=window').layout, 'window');
  assert.equal(M.recognise(HOST + 'game').layout, 'full');
  assert.equal(k('https://botrix.live/widgets/chat/?bid=1'), 'botrix-chat');
  assert.equal(k('https://botrix.live/widgets/goal/?bid=1'), 'botrix-goal');
  assert.equal(k('https://example.com/obs/brbx'), null);
  assert.equal(k(''), null);
});

test('fromUrls reads the settings back out of the scenes\' addresses (a wiped dock rebuilds from OBS)', () => {
  const s = M.defaults();
  s.key = 'k'; s.goalColor = false; s.music = { app: 'cider', always: true, host: '10.0.0.2:5000', ciderToken: 'tok' };
  s.veado = { addr: '10.0.0.3:54765', switch: true, tron: 'cyan', map: { fishing: 'blobfish' }, delay: 250 };
  s.scenes.brb.off = ['goal', 'rings']; s.scenes.ending.cycle = false; s.scenes.chatting.follow = false;
  s.scenes.game.layout = 'window'; s.scenes.game.rings = true; s.scenes.game.off = ['music'];
  s.motion = 'full';
  const urls = Object.keys(M.TYPES).map((k) => url(k, s));
  const back = M.fromUrls(urls);
  for (const k of ['key', 'goalColor', 'motion']) assert.deepEqual(back[k], s[k], k);
  assert.deepEqual(plain(back.music), plain(s.music));
  assert.equal(back.veado.addr, s.veado.addr); assert.equal(back.veado.delay, 250); assert.deepEqual(plain(back.veado.map), { fishing: 'blobfish' });
  assert.deepEqual(plain(back.scenes.brb.off), ['goal', 'rings']);
  assert.equal(back.scenes.ending.cycle, false);
  assert.equal(back.scenes.game.layout, 'window'); assert.equal(back.scenes.game.rings, true); assert.deepEqual(plain(back.scenes.game.off), ['music']);
  // chatting stops following veadotube: its address says noveado=1, so the rebuilt settings say so too
  assert.equal(back.scenes.chatting.follow, false);
});

test('settings links survive the round trip, including non-ASCII text', () => {
  const s = M.defaults();
  s.music.app = 'Música · 音楽'; s.key = 'k/+=';
  assert.deepEqual(plain(M.unpack(M.pack(s))), plain(M.normalise(s)));
  assert.doesNotMatch(M.pack(s), /[+/=]/);                   // safe in a URL
  assert.throws(() => M.unpack('not-a-link'));
});

test('chatBox: the shared chat always fits the chat frame, and the frame grows when now playing or the goal is off', () => {
  const s = M.defaults();
  for (const kind of ['brb', 'chatting']) {
    const both = M.chatBox(kind, s, true), noMusic = M.chatBox(kind, s, false);
    s.scenes[kind].off = ['goal'];
    const noGoal = M.chatBox(kind, s, true);
    s.scenes[kind].off = [];
    for (const b of [both, noMusic, noGoal]) {
      assert.equal(b.w, M.SHARED_W, `${kind}: width`);
      assert.ok(b.h > 0 && b.h <= M.SHARED_H, `${kind}: height ${b.h} fits the ${M.SHARED_H} source`);
    }
    assert.ok(noMusic.h > both.h && noMusic.y < both.y, `${kind}: grows up into now playing's room`);
    assert.ok(noGoal.h > both.h && noGoal.y === both.y, `${kind}: grows down into the goal's room`);
  }
  const g = M.chatBox('game', s, true);
  assert.ok(g.w < M.SHARED_W && g.h > 0);
});

test('Form looks: only a look changed from its default goes on the addresses (every page, the transition too), and reads back', () => {
  const s = M.defaults();
  assert.deepEqual(plain(s.looks), { cyan: 'tron', yellow: 'tron', red: 'tron', princess: 'princess', blobfish: 'blobfish' });
  assert.equal(url('brb', s), HOST + 'brb', 'the defaults add nothing');
  s.looks.princess = 'tron'; s.looks.red = 'blobfish';
  for (const kind of ['starting', 'brb', 'chatting', 'game', 'ending', 'goal', 'transition']) assert.equal(opts(M.options(kind, s)).looks, 'red:blobfish,princess:tron', kind);
  const back = M.fromUrls([url('chatting', s)]);
  assert.deepEqual(plain(back.looks), plain(s.looks));
  assert.deepEqual(plain(M.fromUrls([HOST + 'brb?looks=0']).looks), { cyan: 'tron', yellow: 'tron', red: 'tron', princess: 'tron', blobfish: 'tron' });
  // a save with a look that doesn't exist falls back to that form's own
  assert.equal(M.normalise({ looks: { princess: 'disco' } }).looks.princess, 'princess');
  assert.ok(M.withOptions(HOST + 'brb?looks=princess:tron&x=1', []).endsWith('brb?x=1'), 'the panel owns looks=');
});

// Chatagram (obs/chatagram.html): its game settings come from the link pasted in Widgets → Chatagram; the colours come
// from the form, so the pasted link's theme and accent are left out. layout and goal are the game's own on this page.
test('Chatagram: the pasted link\'s game settings go into the source; theme and accent are left to the form', () => {
  const s = M.normalise(null);
  s.chatagram = 'https://www.trongateslegacy.com/chatagram/play?kick=gridrunner&kickid=715&layout=compact&goal=80&theme=candy&accent=ff0000&cstart=!cg+start';
  const out = url('chatagram', s);
  const q = new URL(out).searchParams;
  assert.equal(q.get('kick'), 'gridrunner'); assert.equal(q.get('kickid'), '715'); assert.equal(q.get('layout'), 'compact'); assert.equal(q.get('goal'), '80');
  assert.equal(q.get('cstart'), '!cg start');
  assert.equal(q.get('theme'), null, 'the form sets the theme'); assert.equal(q.get('accent'), null);
  // just the part after the ? works too
  s.chatagram = 'twitch=pixelpanda&time=120';
  assert.deepEqual(plain(M.chatagramPairs(s.chatagram)), [['twitch', 'pixelpanda'], ['time', '120']]);
  // previews play with a pretend chat
  assert.ok(M.options('chatagram', s, { preview: { form: 'red' } }).some(([k, v]) => k === 'demo' && v === '1'));
});

test('Chatagram: rewriting an existing source keeps hand-set game settings unless a link is pasted, then replaces them', () => {
  const base = HOST + 'chatagram?kick=old&layout=compact&goal=90&noveado=1';
  const none = M.normalise(null);
  const kept = new URL(M.withOptions(base, M.options('chatagram', none))).searchParams;
  assert.equal(kept.get('kick'), 'old'); assert.equal(kept.get('layout'), 'compact'); assert.equal(kept.get('goal'), '90');
  const pasted = M.normalise(null); pasted.chatagram = 'kick=new&time=60';
  const out = new URL(M.withOptions(base, M.options('chatagram', pasted))).searchParams;
  assert.equal(out.get('kick'), 'new'); assert.equal(out.get('time'), '60');
  assert.equal(out.get('layout'), null, 'replaced by the pasted link (which has no layout)'); assert.equal(out.get('goal'), null);
  // the scenes' own layout and goal are untouched by all this
  assert.match(url('game', M.normalise(null), { layout: 'window' }), /layout=window/);
});

test('Chatagram: its address is recognised, and settings can be read back out of it', () => {
  const r = M.recognise(HOST + 'chatagram?twitch=pixelpanda&kick=gridrunner&form=red');
  assert.equal(r.kind, 'chatagram');
  const s = M.fromUrls([HOST + 'chatagram?twitch=pixelpanda&kick=gridrunner&noveado=1']);
  assert.deepEqual(plain(M.chatagramPairs(s.chatagram)), [['twitch', 'pixelpanda'], ['kick', 'gridrunner']]);
});

test('every Chatagram setting a link can carry passes through /obs/chatagram (theme and accent come from the form)', () => {
  const cg = vm.createContext({ URLSearchParams }); cg.window = cg;
  vm.runInContext(read('public/chatagram/settings.js'), cg);
  const want = Object.keys(cg.Chatagram.settings.SCHEMA).filter((k) => k !== 'theme' && k !== 'accent').sort();
  assert.deepEqual([...M.CHATAGRAM_KEYS].filter((k) => k !== 'seed').sort(), want);
});

// Chaplinko (obs/chaplinko.html): the board and its leaderboard as two sources, both from the one link pasted in
// Widgets → Chaplinko; the colours come from the form. Their sizes follow the link (combined, the strip, how many).
test('Chaplinko: the pasted link\'s settings go into both sources; theme and accent are left to the form; sizes follow the link', () => {
  const s = M.normalise(null);
  s.chaplinko = 'https://www.trongateslegacy.com/chaplinko/play?kick=gridrunner&kickid=715&rows=12&theme=candy&accent=ff0000&lbn=8&cdrop=!plinko&motion=calm';
  const board = new URL(url('chaplinko', s)).searchParams, lb = new URL(url('chaplinkolb', s)).searchParams;
  for (const q of [board, lb]) {
    assert.equal(q.get('kick'), 'gridrunner'); assert.equal(q.get('rows'), '12'); assert.equal(q.get('cdrop'), '!plinko'); assert.equal(q.get('motion'), 'calm');
    assert.equal(q.get('theme'), null, 'the form sets the theme'); assert.equal(q.get('accent'), null);
  }
  assert.equal(board.get('part'), null); assert.equal(lb.get('part'), 'leaderboard');
  assert.deepEqual(plain(M.sizeOf('chaplinko', s)), [640, 540]);
  assert.deepEqual(plain(M.sizeOf('chaplinkolb', s)), [300, 372], 'eight players');
  s.chaplinko = 'kick=gridrunner&layout=combined&lbshape=strip';
  assert.deepEqual(plain(M.sizeOf('chaplinko', s)), [960, 540]);
  assert.deepEqual(plain(M.sizeOf('chaplinkolb', s)), [720, 72]);
  s.chaplinko = 'kick=gridrunner&layout=combined&side=off';
  assert.deepEqual(plain(M.sizeOf('chaplinko', s)), [640, 540], 'combined with the leaderboard off: the board alone');
  // the dock's motion setting doesn't override the link's own
  s.motion = 'full'; s.chaplinko = 'kick=x&motion=calm';
  assert.equal(new URL(url('chaplinko', s)).searchParams.getAll('motion').join(), 'calm');
  assert.ok(M.options('chaplinkolb', s, { preview: { form: 'red' } }).some(([k, v]) => k === 'demo' && v === '1'), 'previews play with a pretend chat');
});

test('Chaplinko: rewriting a source keeps hand-set settings unless a link is pasted; the address is recognised and read back', () => {
  const base = HOST + 'chaplinko?part=leaderboard&kick=old&layout=combined&noveado=1';
  const kept = new URL(M.withOptions(base, M.options('chaplinkolb', M.normalise(null)))).searchParams;
  assert.equal(kept.get('kick'), 'old'); assert.equal(kept.get('layout'), 'combined'); assert.equal(kept.get('part'), 'leaderboard');
  const pasted = M.normalise(null); pasted.chaplinko = 'kick=new&rows=9';
  const out = new URL(M.withOptions(base, M.options('chaplinkolb', pasted))).searchParams;
  assert.equal(out.get('kick'), 'new'); assert.equal(out.get('rows'), '9'); assert.equal(out.get('layout'), null); assert.equal(out.getAll('part').join(), 'leaderboard');
  assert.equal(M.recognise(HOST + 'chaplinko?kick=x').kind, 'chaplinko');
  assert.equal(M.recognise(HOST + 'chaplinko.html?part=leaderboard&kick=x').kind, 'chaplinkolb');
  const s = M.fromUrls([HOST + 'chaplinko?part=leaderboard&kick=gridrunner&lbshape=strip', HOST + 'chaplinko?kick=gridrunner&rows=11&noveado=1']);
  assert.deepEqual(plain(M.chaplinkoPairs(s.chaplinko)), [['kick', 'gridrunner'], ['rows', '11']], 'the board\'s address wins');
});

test('every Chaplinko setting a link can carry passes through /obs/chaplinko (its look comes from the form)', () => {
  const cp = vm.createContext({ URLSearchParams }); cp.window = cp;
  vm.runInContext(read('public/chaplinko/settings.js'), cp);
  const want = Object.keys(cp.Chaplinko.settings.SCHEMA).filter((k) => !['theme', 'accent', 'lbtheme', 'lbaccent', 'lbbgo'].includes(k)).sort();
  assert.deepEqual([...M.CHAPLINKO_KEYS].sort(), want);
});
