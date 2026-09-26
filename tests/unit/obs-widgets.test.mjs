// netlify/functions/obs-widgets.mjs (GET /api/obs-widgets): the Botrix links, only for the right key.
// The values here are made up; the real ones live only in Netlify.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../netlify/functions/obs-widgets.mjs';

const ENV = ['OBS_KEY', 'BOTRIX_CHAT_URL', 'BOTRIX_GOAL_URL'];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
const ask = (key, method = 'GET') => handler(new Request('https://x/api/obs-widgets', { method, headers: key === undefined ? {} : { 'X-OBS-Key': key } }));
test.beforeEach(() => { for (const k of ENV) delete process.env[k]; });
test.after(() => { for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });

test('not set up in Netlify: 404 with what to add', async () => {
  const r = await ask('anything');
  assert.equal(r.status, 404);
  assert.match((await r.json()).error, /OBS_KEY/);
});

test('wrong or missing key: 401 and no links', async () => {
  process.env.OBS_KEY = 'right-key'; process.env.BOTRIX_CHAT_URL = 'https://botrix.live/widgets/chat/?bid=test';
  for (const key of ['wrong', '', undefined, 'right-keyx', 'RIGHT-KEY']) {
    const r = await ask(key);
    assert.equal(r.status, 401, `key ${JSON.stringify(key)}`);
    assert.doesNotMatch(await r.text(), /botrix/);
  }
});

test('right key: the https links only', async () => {
  process.env.OBS_KEY = 'right-key';
  process.env.BOTRIX_CHAT_URL = ' https://botrix.live/widgets/chat/?bid=test ';
  process.env.BOTRIX_GOAL_URL = 'javascript:alert(1)';
  const r = await ask('right-key');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { chat: 'https://botrix.live/widgets/chat/?bid=test' });
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex');
});

test('CORS: any origin may ask (local-file scenes are origin "null"); the key is the guard', async () => {
  const r = await ask(undefined, 'OPTIONS');
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(r.headers.get('Access-Control-Allow-Headers'), 'X-OBS-Key');
});
