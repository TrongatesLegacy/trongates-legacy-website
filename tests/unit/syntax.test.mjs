// Every script the site and the OBS pages run parses: the inline <script>s in each page and the shared .js files.
// (A syntax error in one inline script silently kills that whole script in the browser.)
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readdirSync } from 'node:fs';
import { ROOT, read } from '../helpers/sim.mjs';

const html = (dir) => readdirSync(ROOT + dir).filter((f) => f.endsWith('.html')).map((f) => dir + '/' + f);
const pages = ['public/index.html', ...html('public/obs'), ...html('public/widgets'), ...html('public/chatagram')];
const js = (dir) => readdirSync(ROOT + dir).filter((f) => f.endsWith('.js')).map((f) => dir + '/' + f);
const shared = js('public/obs/shared');
const widgets = [...js('public/widgets/lib'), ...js('public/widgets/lib/platforms'), ...js('public/chatagram')];

test('inline scripts in every page parse', () => {
  for (const page of pages) {
    const html = read(page);
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    scripts.forEach((code, i) => assert.doesNotThrow(() => new vm.Script(code, { filename: `${page} script ${i + 1}` }), `${page}, inline script ${i + 1}`));
  }
});

test('the JSON-LD in the website parses', () => {
  const html = read('public/index.html');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(m[1]));
});

test('the shared OBS scripts parse', () => {
  assert.ok(shared.length >= 6);
  for (const f of shared) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
});

test('the widgets\' and Chatagram\'s scripts parse', () => {
  assert.ok(widgets.length >= 10);
  for (const f of widgets) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
});

test('the JSON-LD in the Chatagram page parses', () => {
  for (const m of read('public/chatagram/index.html').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(m[1]));
});

test('every script a page loads exists', () => {
  for (const page of pages) {
    const dir = page.replace(/[^/]+$/, '');
    for (const m of read(page).matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      assert.doesNotThrow(() => read(m[1].startsWith('/') ? 'public' + m[1] : dir + m[1]), `${page} loads ${m[1]}`);
    }
  }
});
