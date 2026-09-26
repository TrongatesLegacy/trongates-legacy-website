// netlify/functions/feed.mjs (GET /api/feed) and scripts/update-feed.mjs, with YouTube and Kick replaced by fakes:
// no test here touches the network.
import test from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
// the function waits 250–750 ms between YouTube retries: no need to really wait here (its 4–6 s request timeouts,
// which never fire with these fakes, keep their length)
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms < 1000 ? 0 : ms, ...a);
let n = 0;
// a fresh copy of the function (it remembers its last good answer and Kick token between requests)
const load = async () => (await import(`../../netlify/functions/feed.mjs?fresh=${++n}`));
const ENV = ['YOUTUBE_API_KEY', 'KICK_CLIENT_ID', 'KICK_CLIENT_SECRET'];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

// fetch answered by the first matching route; anything unrouted fails the test
function routes(table) {
  const seen = [];
  globalThis.fetch = async (input, init = {}) => {
    const u = String(input);
    seen.push([init.method || 'GET', u]);
    for (const [re, reply] of table) if (re.test(u)) return typeof reply === 'function' ? reply(u, init) : reply.clone();
    throw new Error('unexpected fetch ' + u);
  };
  return seen;
}
const xml = (entries) => new Response(`<?xml version="1.0"?><feed>${entries.map((e) => `<entry><yt:videoId>${e.id}</yt:videoId><title>${e.title}</title><published>${e.published || '2026-09-01T00:00:00+00:00'}</published><link rel="alternate" href="https://www.youtube.com/${e.short ? 'shorts/' : 'watch?v='}${e.id}"/></entry>`).join('')}</feed>`);
const id = (i) => `vid${String(i).padStart(8, '0')}`;          // 11 characters, like a real video id
const VIDEOS = Array.from({ length: 8 }, (_, i) => ({ id: id(i), title: `Stream ${i} &amp; friends` }));
const SHORTS = Array.from({ length: 12 }, (_, i) => ({ id: id(100 + i), title: `Short ${i}`, short: true }));
const kickSite = (live) => new Response(JSON.stringify({ followers_count: 321, livestream: live ? { is_live: true, session_title: 'Ranked', viewer_count: 42, categories: [{ name: 'Rocket League' }] } : null }));

test.beforeEach(() => { for (const k of ENV) delete process.env[k]; });
test.afterEach(() => { globalThis.fetch = realFetch; for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });

test('RSS playlists: videos and shorts, entities decoded, the "| Music |" duplicate uploads and bad ids dropped', async () => {
  routes([
    [/playlist_id=UULF/, xml([...VIDEOS.slice(0, 2), { id: id(50), title: 'Stream 1 | Music | VOD' }, { id: 'short-id', title: 'bad id' }, ...VIDEOS.slice(2)])],
    [/playlist_id=UUSH/, xml(SHORTS)],
    [/kick\.com\/api/, kickSite(false)],
  ]);
  const { youtube } = await load();
  const yt = await youtube();
  assert.equal(yt.source, 'playlists');
  assert.equal(yt.videos.length, 6); assert.equal(yt.shorts.length, 10);
  assert.equal(yt.videos[0].title, 'Stream 0 & friends');
  assert.ok(!yt.videos.some((v) => /Music/.test(v.title) || v.id === 'short-id'));
  assert.ok(!('short' in yt.videos[0]), 'the internal short flag is stripped');
});

test('playlists failing: falls back to the channel feed and sorts shorts from videos', async () => {
  const mixed = [VIDEOS[0], SHORTS[0], VIDEOS[1], { id: id(200), title: 'Short without a shorts link' }];
  const seen = routes([
    [/playlist_id=/, new Response('', { status: 404 })],
    [/channel_id=/, xml(mixed)],
    // /shorts/<id> answers 200 for a short, redirects for a video
    [/youtube\.com\/shorts\//, (u) => new Response('', { status: u.endsWith(id(200)) ? 200 : 303 })],
    [/kick\.com\/api/, kickSite(false)],
  ]);
  const { youtube } = await load();
  const yt = await youtube();
  assert.equal(yt.source, 'channel');
  assert.deepEqual(yt.videos.map((v) => v.id), [VIDEOS[0].id, VIDEOS[1].id]);
  assert.deepEqual(yt.shorts.map((v) => v.id), [SHORTS[0].id, id(200)]);
  assert.equal(seen.filter(([, u]) => /playlist_id=UULF/.test(u)).length, 4, 'retries a flaky playlist 4 times');
});

test('with YOUTUBE_API_KEY: the Data API is used, and the RSS feeds if it fails', async () => {
  process.env.YOUTUBE_API_KEY = 'test-key';
  const item = (v) => ({ snippet: { title: v.title, publishedAt: '2026-09-01T00:00:00Z' }, contentDetails: { videoId: v.id } });
  routes([
    [/googleapis\.com.*UULF/, new Response(JSON.stringify({ items: VIDEOS.map(item) }))],
    [/googleapis\.com.*UUSH/, new Response(JSON.stringify({ items: SHORTS.map(item) }))],
  ]);
  let yt = await (await load()).youtube();
  assert.equal(yt.source, 'playlists'); assert.equal(yt.videos.length, 6); assert.equal(yt.shorts.length, 10);
  routes([[/googleapis/, new Response('quota', { status: 403 })], [/playlist_id=UULF/, xml(VIDEOS)], [/playlist_id=UUSH/, xml(SHORTS)]]);
  yt = await (await load()).youtube();
  assert.equal(yt.source, 'playlists'); assert.equal(yt.videos[0].title, 'Stream 0 & friends');
});

test('GET /api/feed: live status from Kick\'s site, cached briefly by the CDN', async () => {
  routes([[/playlist_id=UULF/, xml(VIDEOS)], [/playlist_id=UUSH/, xml(SHORTS)], [/kick\.com\/api\/v2/, kickSite(true)]]);
  const res = await (await load()).default();
  const body = await res.json();
  assert.equal(body.kick.live, true); assert.equal(body.kick.viewers, 42); assert.equal(body.kick.followers, 321);
  assert.equal(body.kick.category, 'Rocket League');
  assert.deepEqual(body.errors, []);
  assert.match(res.headers.get('Netlify-CDN-Cache-Control'), /s-maxage=180/);
});

test('GET /api/feed: the official Kick API when credentials are set, with its token reused', async () => {
  process.env.KICK_CLIENT_ID = 'id'; process.env.KICK_CLIENT_SECRET = 'secret';
  const seen = routes([
    [/playlist_id=UULF/, xml(VIDEOS)], [/playlist_id=UUSH/, xml(SHORTS)],
    [/id\.kick\.com\/oauth\/token/, new Response(JSON.stringify({ access_token: 'tok', expires_in: 5184000 }))],
    [/api\.kick\.com\/public\/v1\/channels/, (u, init) => new Response(JSON.stringify({ data: [{ stream: { is_live: false, viewer_count: 0 }, stream_title: '', category: { name: 'Just Chatting' } }] }), { status: init.headers.Authorization === 'Bearer tok' ? 200 : 401 })],
  ]);
  const fn = (await load()).default;
  const body = await (await fn()).json();
  assert.equal(body.kick.live, false); assert.equal(body.kick.followers, null);
  await fn();
  assert.equal(seen.filter(([, u]) => /oauth\/token/.test(u)).length, 1, 'one token for two requests');
});

test('GET /api/feed: YouTube and Kick both down → an empty list that says why, never cached long', async () => {
  routes([[/youtube\.com/, new Response('', { status: 500 })], [/kick\.com/, new Response('', { status: 403 })]]);
  const res = await (await load()).default();
  const body = await res.json();
  assert.deepEqual(body.videos, []); assert.equal(body.source, 'none'); assert.equal(body.kick, null);
  assert.equal(body.errors.length, 2);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.match(res.headers.get('Netlify-CDN-Cache-Control'), /s-maxage=15$/);
});

test('GET /api/feed: a warm function remembers its last good list through a YouTube blip', async () => {
  const fn = (await load()).default;
  routes([[/playlist_id=UULF/, xml(VIDEOS)], [/playlist_id=UUSH/, xml(SHORTS)], [/kick\.com/, kickSite(false)]]);
  await fn();
  routes([[/youtube\.com/, new Response('', { status: 500 })], [/kick\.com/, kickSite(false)]]);
  const body = await (await fn()).json();
  assert.equal(body.source, 'memory'); assert.equal(body.videos.length, 6);
});

test('update-feed: the channel fallback never shrinks a fuller list; the playlists always replace it', async () => {
  const { nextFeed } = await import('../../scripts/update-feed.mjs');
  const previous = { videos: VIDEOS.slice(0, 6), shorts: SHORTS.slice(0, 10) };
  const fewer = { videos: VIDEOS.slice(0, 3), shorts: SHORTS.slice(0, 2) };
  assert.deepEqual(nextFeed(previous, { ...fewer, source: 'channel' }), previous);
  assert.deepEqual(nextFeed(previous, { ...fewer, source: 'playlists' }), { videos: fewer.videos, shorts: fewer.shorts });
  assert.deepEqual(nextFeed({}, { ...fewer, source: 'channel' }), { videos: fewer.videos, shorts: fewer.shorts });
});

test('public/feed.json (rewritten daily by the update-feed workflow) has the shape the site reads', async () => {
  const { readFile } = await import('node:fs/promises');
  const feed = JSON.parse(await readFile(new URL('../../public/feed.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(feed.videos) && feed.videos.length > 0, 'videos');
  assert.ok(Array.isArray(feed.shorts), 'shorts');
  for (const v of [...feed.videos, ...feed.shorts]) {
    assert.match(v.id, /^[\w-]{11}$/, `id ${v.id}`);
    assert.equal(typeof v.title, 'string');
    assert.ok(!Number.isNaN(Date.parse(v.published)), `published ${v.published}`);
  }
});
