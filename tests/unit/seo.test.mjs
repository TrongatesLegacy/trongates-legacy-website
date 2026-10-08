// What search engines read on the widget pages (2026-10-08, to get Chatagram found for searches like "kick chat word
// game" and "anagram game for twitch and kick"): titles and descriptions short enough not to be cut off and carrying
// the words people search with, structured data that parses, and plain links to the games from the rest of the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = (p) => readFileSync(new URL(`../../public/${p}`, import.meta.url), 'utf8');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const head = (html) => ({
  title: html.match(/<title>([^<]*)<\/title>/)[1],
  description: html.match(/<meta name="description" content="([^"]*)"/)[1],
  ld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1])].flat()),
  h1: text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]),
});

for (const p of ['chatagram/index.html', 'chaplinko/index.html', 'widgets/index.html', 'index.html']) {
  test(`${p}: a title and description that fit in a search result, and structured data that parses`, () => {
    const h = head(page(p));
    assert.ok(h.title.length <= 65, `title is ${h.title.length} characters: ${h.title}`);
    assert.ok(h.description.length >= 70 && h.description.length <= 160, `description is ${h.description.length} characters`);
    for (const d of h.ld) assert.equal(d['@context'], 'https://schema.org');
  });
}

test('Chatagram: the words people search with, a breadcrumb, and the comparison people look for', () => {
  const html = page('chatagram/index.html'), h = head(html);
  for (const w of [/anagram/i, /Twitch/, /Kick/]) { assert.match(h.title, w); assert.match(h.description, w); }
  assert.match(h.h1, /anagram/i);
  const app = h.ld.find((d) => d['@type'] === 'WebApplication');
  assert.equal(app.isAccessibleForFree, true);
  assert.ok(app.featureList.length >= 3 && app.screenshot && app.image);
  const crumbs = h.ld.find((d) => d['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.item);
  assert.deepEqual(crumbs, ['https://www.trongateslegacy.com/', 'https://www.trongateslegacy.com/widgets/', 'https://www.trongateslegacy.com/chatagram/']);
  assert.match(html, /<summary>How is it different from Words on Stream\?<\/summary>/);
  assert.match(html, /Words on Stream\?<\/summary><p>Chatagram plays <b>both chats at once<\/b>/, 'the main difference comes first (the owner)');
  assert.match(html, /<summary>Is there a chat word game for Kick\?<\/summary>/);
});

test('the games are linked from the homepage, the widgets page and each other, with words that say what they are', () => {
  assert.match(page('index.html'), /<a href="\/chatagram\/">Chatagram, the anagram chat game<\/a>/);
  assert.match(page('index.html'), /<a href="\/chaplinko\/">Chaplinko<\/a>/);
  assert.match(page('widgets/index.html'), /<h2><a href="\/chatagram\/">Chatagram<\/a><\/h2><p>The anagram word game/);
  assert.match(page('chaplinko/index.html'), /<a href="\/chatagram\/">Chatagram, the anagram chat game<\/a>/);
});
