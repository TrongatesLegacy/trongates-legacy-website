// Chaplinko's rules (public/chaplinko/game.js) on a hand-driven clock: what a !drop drops (balls, an emote the platform
// marked, an emoji), spam allowed (no cooldown unless the streamer sets one), the queue and its limit, commands and who
// can use them, scoring and big wins, near misses, and how busy the board is (Quiet / Busy / Frenzy, without flicker).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams, JSON, Math, Date }); ctx.window = ctx;
for (const f of ['public/widgets/lib/settings.js', 'public/chaplinko/settings.js', 'public/chaplinko/physics.js', 'public/chaplinko/odds.js', 'public/chaplinko/game.js']) vm.runInContext(read(f), ctx);
const K = ctx.Chaplinko, S = ctx.Widgets.settings;
const plain = (o) => JSON.parse(JSON.stringify(o));

function setup(link = '') {
  const t = { at: 1_790_000_000_000, awarded: [] };
  t.cfg = S.decode(K.settings.SCHEMA, link);
  t.L = K.physics.layout(t.cfg.rows);
  t.g = K.game(t.cfg, { now: () => t.at, layout: t.L, award: (m, pts, n) => t.awarded.push([m.name, pts, n]) });
  t.say = (text, who = {}) => t.g.handle({ platform: 'twitch', user: (who.name || 'PixelPanda').toLowerCase(), name: who.name || 'PixelPanda', text, mod: !!who.mod, owner: !!who.owner, color: who.color || '#ff4f9a', emotes: who.emotes || [] });
  // drain the queue as the overlay would: time passes, balls leave the chute (board: how many are already on it)
  t.drain = (board = 0, ms = 20000) => { const out = []; for (let i = 0; i < ms / 10; i++) { t.at += 10; const got = t.g.take(board + (board ? out.length : 0)); out.push(...got); } return out; };
  return t;
}

test('!drop drops the streamer\'s balls per drop (5 by default); any number typed is ignored', () => {
  const t = setup();
  assert.equal(t.say('!drop').kind, 'drop');
  assert.equal(t.g.queued, 5);
  assert.equal(t.say('!drop 50').n, 5, '!drop 5 from habit is a plain !drop');
  assert.equal(t.say('!DROP').kind, 'drop', 'any capitals');
  assert.equal(t.say('!dropped').kind, 'none', 'another word');
  assert.equal(t.say('hello !drop').kind, 'none');
  assert.equal(setup('balls=2').say('!drop').n, 2);
  const out = t.drain();
  assert.equal(out.length, 15);
  assert.deepEqual(plain(out[0].by), { platform: 'twitch', user: 'pixelpanda', name: 'PixelPanda', color: '#ff4f9a' });
});

test('!drop <emote>: an emote the platform marked, else an emoji, else balls', () => {
  const t = setup();
  const e = { id: '25', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/static/dark/2.0' };
  assert.deepEqual(plain(t.say('!drop Kappa', { emotes: [e] }).item), { kind: 'emote', url: e.url, name: 'Kappa' });
  assert.deepEqual(plain(t.say('!drop 🔥').item), { kind: 'emoji', text: '🔥' });
  assert.deepEqual(plain(t.say('!drop 5 👍🏽 extra').item), { kind: 'emoji', text: '👍🏽' }, 'skin tones stay with their emoji');
  assert.deepEqual(plain(t.say('!drop ❤️').item), { kind: 'emoji', text: '❤️' });
  assert.equal(t.say('!drop https://example.com/x.png').item, null, 'a typed address is never an image');
  assert.equal(t.say('!drop Kappa').item, null, 'a word the platform didn\'t mark is just balls');
});

test('spam is the point: no cooldown by default; the streamer can set one', () => {
  const t = setup();
  for (let i = 0; i < 20; i++) assert.equal(t.say('!drop').kind, 'drop');
  const c = setup('cool=30');
  assert.equal(c.say('!drop').kind, 'drop');
  c.at += 29000; assert.equal(c.say('!drop').kind, 'cooldown');
  assert.equal(c.say('!drop', { name: 'NeonNacho' }).kind, 'drop', 'per person');
  c.at += 1000; assert.equal(c.say('!drop').kind, 'drop');
});

test('the queue: past about 30 s of balls, drops are ignored until it drains; the board never holds more than the most on screen', () => {
  const t = setup();
  let n = 0; while (t.say('!drop', { name: 'P' + n }).kind === 'drop') n++;
  assert.equal(n * 5, K.game.QUEUE_MAX);
  assert.equal(t.say('!drop', { name: 'Late' }).kind, 'full');
  assert.equal(t.drain(95, 5000).length, 5, 'only up to the most on screen (100)');
  assert.equal(t.drain(100, 5000).length, 0, 'a full board takes nothing');
  t.drain(0, 60000);
  assert.equal(t.g.queued, 0);
  assert.equal(t.say('!drop', { name: 'Late' }).kind, 'drop');
});

test('balls leave the chute one at a time, faster in Frenzy', () => {
  const quiet = setup(); quiet.say('!drop');
  let times = []; for (let i = 0; i < 200; i++) { quiet.at += 10; if (quiet.g.take(0).length) times.push(quiet.at); }
  assert.equal(times.length, 5);
  assert.ok(times[1] - times[0] >= K.game.SPACING.quiet, 'spaced out when quiet');
  const busy = setup(); for (let i = 0; i < 30; i++) busy.say('!drop', { name: 'P' + i });
  const t0 = busy.at; let got = 0; for (let i = 0; i < 100; i++) { busy.at += 10; got += busy.g.take(60).length; }
  assert.equal(busy.g.level, 'frenzy');
  assert.ok(got >= (busy.at - t0) / K.game.SPACING.frenzy - 1, `about 20 a second in Frenzy (${got} in 1 s)`);
});

test('activity levels: up at once, down only after 3 s below the line', () => {
  const t = setup();
  t.g.take(3); assert.equal(t.g.level, 'quiet');
  t.g.take(20); assert.equal(t.g.level, 'busy');
  t.g.take(60); assert.equal(t.g.level, 'frenzy');
  t.at += 1000; t.g.take(10); assert.equal(t.g.level, 'frenzy', 'still frenzy a moment later');
  t.at += 2000; t.g.take(10); assert.equal(t.g.level, 'frenzy', '2 s below the line');
  t.at += 1000; t.g.take(10); assert.equal(t.g.level, 'quiet', 'after 3 s below the line it calms');
});

test('commands and who can use them; clearscores is the owner\'s only; !drop top is off by default', () => {
  const t = setup();
  assert.equal(t.say('!drop pause').kind, 'ignored', 'a viewer can\'t pause');
  assert.equal(t.say('!drop pause', { mod: true }).cmd, 'pause');
  assert.equal(t.say('!drop').kind, 'paused');
  assert.equal(t.say('!drop resume', { owner: true }).cmd, 'resume');
  t.say('!drop');
  assert.equal(t.say('!drop clear', { mod: true }).cmd, 'clear');
  assert.equal(t.g.queued, 0);
  assert.equal(t.say('!drop clearscores', { mod: true }).kind, 'ignored');
  assert.equal(t.say('!drop clearscores', { owner: true }).cmd, 'clearscores');
  assert.equal(t.say('!drop top', { owner: true }).kind, 'ignored', 'off by default');
  const on = setup('lb=1&perm=all');
  assert.equal(on.say('!drop top').cmd, 'top');
  assert.equal(on.say('!drop top', { name: 'Other' }).kind, 'cooldown', 'viewers share one a minute');
  assert.equal(on.say('!drop top', { mod: true }).cmd, 'top', 'mods never wait');
  const me = setup('perm=me');
  assert.equal(me.say('!drop pause', { mod: true }).kind, 'ignored');
  const named = setup('cdrop=!plinko,!p&cpause=!stop');
  assert.equal(named.say('!p 🔥').kind, 'drop');
  assert.equal(named.say('!drop').kind, 'none');
  assert.equal(named.say('!stop', { owner: true }).cmd, 'pause');
});

test('bots are ignored', () => {
  const t = setup();
  assert.equal(t.say('!drop', { name: 'Nightbot' }).kind, 'ignored');
  assert.equal(setup('ignore=gridrunner').say('!drop', { name: 'GridRunner' }).kind, 'ignored');
});

test('scoring: the slot\'s value goes to whoever dropped it; the top slot is a jackpot with the card, counted per day', () => {
  const t = setup();
  const by = { platform: 'kick', user: 'neonnacho', name: 'NeonNacho' };
  assert.deepEqual(plain(t.g.values), [100, 25, 10, 5, 2, 1, 2, 5, 10, 25, 100]);
  const j = t.g.land(by, 0, t.L.slots.x0 + 10);
  assert.equal(j.tier, 'jackpot'); assert.equal(j.card, true); assert.equal(j.nth, 1); assert.equal(j.pts, 100);
  assert.equal(t.g.land(by, 10).nth, 2, 'the second today');
  assert.equal(t.g.land(by, 1).tier, 'big');
  assert.equal(t.g.land(by, 1).card, false, 'no card for the second-highest unless top two');
  assert.equal(setup('bigwin=top2').g.land(by, 1).card, true);
  assert.equal(setup('bigwin=off').g.land(by, 0).card, false);
  assert.equal(t.g.land(by, 2).tier, 'high');
  assert.equal(t.g.land(by, 5).tier, 'low');
  assert.deepEqual(t.awarded.slice(0, 3), [['NeonNacho', 100, 1], ['NeonNacho', 100, 1], ['NeonNacho', 25, 1]]);
  t.at += 86400000; assert.equal(t.g.land(by, 0).nth, 1, 'a new day starts again');
  assert.ok(t.g.oneIn(0) > 500 && t.g.oneIn(0) < 3000, `the top slot is rare at 10 rows (1 in ${t.g.oneIn(0)})`);
});

test('slot values: the streamer\'s own list if it fits the rows, otherwise the default', () => {
  assert.deepEqual(plain(setup('rows=8&slots=9,8,7,6,5,6,7,8,9').g.values), [9, 8, 7, 6, 5, 6, 7, 8, 9]);
  assert.deepEqual(plain(setup('rows=8&slots=1,2,3').g.values), plain(K.settings.SLOTS[8]), 'wrong count');
  assert.deepEqual(plain(setup('rows=8&slots=1,2,3,4,x,4,3,2,1').g.values), plain(K.settings.SLOTS[8]), 'not numbers');
  const flat = setup('rows=8&slots=5,5,5,5,5,5,5,5,5');
  assert.equal(flat.g.land({ name: 'x' }, 0).tier === 'jackpot', false, 'every slot the same: no jackpot on every landing');
});

test('near miss: touching the top slot\'s edge and falling the other way (only when it\'s on)', () => {
  const t = setup(), edge = t.L.slots.x0 + t.L.slots.w;
  assert.equal(t.g.land({ name: 'x' }, 1, edge + 2).near, true);
  assert.equal(t.g.land({ name: 'x' }, 1, edge + t.L.slots.w / 2).near, false, 'in the middle of its slot');
  assert.equal(t.g.land({ name: 'x' }, 4, t.L.slots.x0 + 4 * t.L.slots.w + 1).near, false, 'not next to the top slot');
  assert.equal(setup('nearmiss=0').g.land({ name: 'x' }, 1, edge + 2).near, false);
});
