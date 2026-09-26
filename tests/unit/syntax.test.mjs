// Every script the site and the OBS pages run parses: the inline <script>s in each page and the shared .js files.
// (A syntax error in one inline script silently kills that whole script in the browser.)
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readdirSync } from 'node:fs';
import { ROOT, read } from '../helpers/sim.mjs';

const pages = ['public/index.html', ...readdirSync(ROOT + 'public/obs').filter((f) => f.endsWith('.html')).map((f) => 'public/obs/' + f)];
const shared = readdirSync(ROOT + 'public/obs/shared').filter((f) => f.endsWith('.js')).map((f) => 'public/obs/shared/' + f);

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

test('every script a page loads exists', () => {
  for (const page of pages) {
    const dir = page.replace(/[^/]+$/, '');
    for (const m of read(page).matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      assert.doesNotThrow(() => read(m[1].startsWith('/') ? 'public' + m[1] : dir + m[1]), `${page} loads ${m[1]}`);
    }
  }
});
