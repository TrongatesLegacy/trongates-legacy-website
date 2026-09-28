// The stream widgets' shared pieces (public/widgets/lib/): settings in the link, reading Twitch and Kick chat
// messages, and themes. Reconnecting is in tests/loops/widgets-chat.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from '../helpers/sim.mjs';

const ctx = vm.createContext({ URLSearchParams, JSON }); ctx.window = ctx;
for (const f of ['settings.js', 'platforms/twitch.js', 'platforms/kick.js', 'theme.js']) vm.runInContext(read('public/widgets/lib/' + f), ctx);
const { settings: S, platforms: P, theme: T } = ctx.Widgets;
const plain = (o) => JSON.parse(JSON.stringify(o));

const SCHEMA = {
  twitch: { type: 'str', def: '', maxLen: 25 },
  time: { type: 'int', def: 90, min: 30, max: 300 },
  auto: { type: 'bool', def: true },
  theme: { type: 'enum', def: 'neutral', values: ['neutral', 'neon'] },
  ignore: { type: 'list', def: ['botrix', 'nightbot'] },
  accent: { type: 'color', def: '' },
};

test('settings: the defaults make an empty link, and only changes are written', () => {
  assert.equal(S.encode(SCHEMA, S.defaults(SCHEMA)), '');
  assert.equal(S.encode(SCHEMA, { ...S.defaults(SCHEMA), twitch: 'pixelpanda', time: 120, auto: false }), 'twitch=pixelpanda&time=120&auto=0');
  assert.equal(S.encode(SCHEMA, { ...S.defaults(SCHEMA), ignore: ['a', 'b'], accent: 'FF4155' }), 'ignore=a,b&accent=ff4155');
});

test('settings: a link reads back to the same settings', () => {
  const v = { ...S.defaults(SCHEMA), twitch: 'gridrunner', time: 45, auto: false, theme: 'neon', ignore: ['x'], accent: '22e5ff' };
  assert.deepEqual(plain(S.decode(SCHEMA, S.encode(SCHEMA, v))), plain(v));
});

test('settings: missing, unknown, invalid or out-of-range values fall back to the default', () => {
  const v = plain(S.decode(SCHEMA, 'time=9999&auto=maybe&theme=rainbow&accent=zzz&whatever=1&time2=5'));
  assert.deepEqual(v, plain(S.defaults(SCHEMA)));
  assert.equal(S.decode(SCHEMA, 'time=abc').time, 90);
  assert.equal(S.decode(SCHEMA, 'theme=NEON').theme, 'neon');
  assert.equal(S.decode(SCHEMA, 'accent=%23FF4155').accent, 'ff4155');
});

test('settings: changed counts only settings that differ from their default', () => {
  assert.equal(S.changed(SCHEMA, S.defaults(SCHEMA)), 0);
  assert.equal(S.changed(SCHEMA, { ...S.defaults(SCHEMA), time: 60, theme: 'neon' }, ['time', 'auto']), 1);
});

test('channel names: links, @names and capitals all become the plain channel name', () => {
  for (const [input, want] of [['https://www.twitch.tv/PixelPanda', 'pixelpanda'], ['@PixelPanda', 'pixelpanda'], ['twitch.tv/pixel_panda/videos', 'pixel_panda'], [' Pixel Panda ', 'pixel']])
    assert.equal(P.twitch.channel(input), want, input);
  for (const [input, want] of [['https://kick.com/Grid-Runner_TV', 'grid-runner_tv'], ['kick.com/gridrunner?x=1', 'gridrunner'], ['@GridRunner', 'gridrunner']])
    assert.equal(P.kick.channel(input), want, input);
});

// a real Twitch line (captured 2026-09-28), with a made-up name
const TW = '@badge-info=subscriber/19;badges=subscriber/18,gold-pixel-heart/1;color=#8A2BE2;display-name=PixelPanda;emotes=;first-msg=0;flags=;id=f110ff35;mod=0;returning-chatter=0;room-id=71092938;subscriber=1;tmi-sent-ts=1790559471977;turbo=0;user-id=144029627;user-type= :pixelpanda!pixelpanda@pixelpanda.tmi.twitch.tv PRIVMSG #gridrunner :manic';

test('Twitch: a chat line becomes a message with name, text and roles', () => {
  const m = plain(P.twitch.parse(TW, 'gridrunner'));
  assert.deepEqual(m, { type: 'message', platform: 'twitch', user: 'pixelpanda', name: 'PixelPanda', text: 'manic', owner: false, mod: false });
  assert.equal(P.twitch.parse(TW.replace('mod=0', 'mod=1'), 'gridrunner').mod, true);
  assert.equal(P.twitch.parse(TW.replace('badges=subscriber/18', 'badges=moderator/1'), 'gridrunner').mod, true);
  const owner = P.twitch.parse(TW.replace('badges=subscriber/18', 'badges=broadcaster/1'), 'gridrunner');
  assert.ok(owner.owner && owner.mod);
  assert.ok(P.twitch.parse(TW, 'pixelpanda').owner, 'the channel\'s own account is the owner');
  assert.equal(P.twitch.parse(TW.replace(':manic', ':two words here')).text, 'two words here');
});

test('Twitch: PING is answered, other lines are ignored', () => {
  assert.deepEqual(plain(P.twitch.parse('PING :tmi.twitch.tv')), { type: 'ping', payload: ':tmi.twitch.tv' });
  assert.equal(P.twitch.parse(':tmi.twitch.tv 001 justinfan123 :Welcome, GLHF!'), null);
  assert.equal(P.twitch.parse(':tmi.twitch.tv RECONNECT').type, 'reconnect');
  assert.equal(P.twitch.parse(':justinfan1!justinfan1@justinfan1.tmi.twitch.tv JOIN #gridrunner'), null);
});

// a real Kick frame (captured 2026-09-28 from a public channel), with made-up names
const kickFrame = (sender, content = 'manic') => JSON.stringify({ event: 'App\\Events\\ChatMessageEvent', channel: 'chatrooms.715.v2',
  data: JSON.stringify({ id: '88e56cf0', chatroom_id: 715, content, type: 'message', created_at: '2026-09-28T03:40:51+00:00', sender, metadata: { message_ref: '1790566857648' } }) });
const NACHO = { id: 1, username: 'NeonNacho', slug: 'neonnacho', identity: { color: '#E26EFF', badges: [{ type: 'subscriber', text: 'Subscriber', count: 20 }], badges_v2: [{ name: 'level', badge_type: 'global' }] } };

test('Kick: a chat frame becomes a message with name, text and roles', () => {
  assert.deepEqual(plain(P.kick.parse(kickFrame(NACHO), 'gridrunner')), { type: 'message', platform: 'kick', user: 'neonnacho', name: 'NeonNacho', text: 'manic', owner: false, mod: false });
  const mod = { ...NACHO, identity: { badges: [{ type: 'moderator', text: 'Moderator' }] } };
  assert.equal(P.kick.parse(kickFrame(mod), 'gridrunner').mod, true);
  const v2 = { ...NACHO, identity: { badges: [], badges_v2: [{ name: 'moderator' }] } };
  assert.equal(P.kick.parse(kickFrame(v2), 'gridrunner').mod, true);
  const owner = { ...NACHO, identity: { badges: [{ type: 'broadcaster' }] } };
  assert.ok(P.kick.parse(kickFrame(owner), 'gridrunner').owner);
  assert.ok(P.kick.parse(kickFrame(NACHO), 'neonnacho').owner, 'the channel\'s own account is the owner');
});

test('Kick: Pusher housekeeping frames, other events and broken frames', () => {
  assert.equal(P.kick.parse('{"event":"pusher:ping","data":{}}').type, 'ping');
  assert.equal(P.kick.parse('{"event":"pusher:connection_established","data":"{}"}').type, 'connected');
  assert.equal(P.kick.parse('{"event":"pusher_internal:subscription_succeeded","data":"{}"}').type, 'subscribed');
  assert.equal(P.kick.parse('{"event":"App\\\\Events\\\\MessageDeletedEvent","data":"{}"}'), null);
  assert.equal(P.kick.parse('not json'), null);
  assert.equal(P.kick.parse(JSON.stringify({ event: 'App\\Events\\ChatMessageEvent', data: '{broken' })), null);
});

test('Kick: the chatroom id comes from Kick\'s channel API, and a missing channel gives null', async () => {
  const fake = (status, body) => async (url) => { fake.url = url; return { ok: status === 200, json: async () => body }; };
  assert.equal(await P.kick.chatroom('gridrunner', fake(200, { chatroom: { id: 67706967 } })), 67706967);
  assert.equal(fake.url, 'https://kick.com/api/v2/channels/gridrunner');
  assert.equal(await P.kick.chatroom('nobody', fake(404, {})), null);
  assert.equal(await P.kick.chatroom('x', async () => { throw new Error('offline'); }), null);
});

test('is the channel live: Twitch\'s and Kick\'s answers (shapes captured 2026-09-28) become live, offline or unknown', async () => {
  // Twitch (gql.twitch.tv): a live channel, an offline one, a channel that doesn't exist, an error
  assert.deepEqual(plain(P.twitch.streamFrom({ data: { user: { stream: { id: '317546287863', createdAt: '2026-09-28T16:59:52Z' } } } })), { state: 'live', id: '317546287863', started: Date.parse('2026-09-28T16:59:52Z') });
  assert.deepEqual(plain(P.twitch.streamFrom({ data: { user: { stream: null } } })), { state: 'offline' });
  assert.deepEqual(plain(P.twitch.streamFrom({ data: { user: null } })), { state: 'unknown' });
  assert.deepEqual(plain(P.twitch.streamFrom({ errors: [{ message: 'nope' }] })), { state: 'unknown' });
  // Kick (kick.com/api/v2/channels/…): times are UTC without a zone
  assert.deepEqual(plain(P.kick.streamFrom({ livestream: { id: 129599997, created_at: '2026-09-28 19:30:28', start_time: '2026-09-28 19:30:24', is_live: true } })), { state: 'live', id: '129599997', started: Date.parse('2026-09-28T19:30:24Z') });
  assert.deepEqual(plain(P.kick.streamFrom({ livestream: null, chatroom: { id: 1 } })), { state: 'offline' });
  assert.deepEqual(plain(P.kick.streamFrom({ message: 'Not found' })), { state: 'unknown' });
  // the requests themselves: a failed or thrown fetch is unknown, never offline
  const ok = (j) => async () => ({ ok: true, json: async () => j });
  assert.equal((await P.twitch.stream('GridRunner', ok({ data: { user: { stream: null } } }))).state, 'offline');
  assert.equal((await P.kick.stream('gridrunner', async () => ({ ok: false }))).state, 'unknown');
  assert.equal((await P.kick.stream('gridrunner', async () => { throw new Error('blocked'); })).state, 'unknown');
  let asked = ''; await P.kick.stream('kick.com/GridRunner', async (u) => { asked = u; return { ok: false }; });
  assert.equal(asked, 'https://kick.com/api/v2/channels/gridrunner');
});

test('themes: eight themes, each with its own accent; bad colours are ignored', () => {
  assert.deepEqual([...T.THEMES], ['chatagram', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy']);
  for (const t of T.THEMES) assert.match(T.ACCENTS[t], /^[0-9a-f]{6}$/, t);
  const css = read('public/widgets/lib/themes.css');
  for (const t of T.THEMES) {
    const block = new RegExp(`\\[data-theme=${t}\\] \\{([^}]*)\\}`).exec(css);
    assert.ok(block, `themes.css has no ${t}`);
    assert.ok(block[1].includes(`--accent: #${T.ACCENTS[t]}`), `${t}: themes.css and theme.js disagree on the accent`);
  }
  assert.equal(T.hex('#FF4155'), 'ff4155');
  assert.equal(T.hex('red'), '');
});
