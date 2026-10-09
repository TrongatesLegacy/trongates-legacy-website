// The widgets' mark (2026-10-09): one little deck, drawn inline on /widgets/ (the logo) and on the homepage (its nav,
// phone menu and footer link), kept identical so the two copies can't drift; the favicon draws the same shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = (p) => readFileSync(new URL(`../../public/${p}`, import.meta.url), 'utf8');
const marks = (html) => html.match(/<svg class="wmark"[\s\S]*?<\/svg>/g) || [];
const shapes = (svg) => (svg.match(/<(rect|circle)\b[^>]*>/g) || []).map((t) => t.replace(/\s(class|fill|stroke)="[^"]*"/g, '').replace(/\s*\/?>$/, ''));

test('the widgets mark is the same everywhere it appears', () => {
  const w = marks(page('widgets/index.html')), h = marks(page('index.html'));
  assert.equal(w.length, 1, 'the widgets page logo');
  assert.equal(h.length, 3, 'the homepage: nav, phone menu, footer');
  for (const m of h) assert.equal(m, w[0]);
  assert.deepEqual(shapes(page('widgets/icon.svg')), shapes(w[0]), 'the favicon draws the same shapes');
});

test('the widgets page logo says who made it and links home; the page uses its own favicon', () => {
  const html = page('widgets/index.html');
  assert.match(html, /<a class="by" href="\/">by <b>Trongates <span>Legacy<\/span><\/b><\/a>/);
  assert.match(html, /<link rel="icon" href="\/widgets\/icon.svg"/);
});
