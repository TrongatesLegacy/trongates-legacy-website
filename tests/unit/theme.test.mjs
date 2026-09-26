// theme.js on its own: which form a veadotube state means, where a scene starts, what hide= removes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Clock, Profile, Network, Page, rng, THEME } from '../helpers/sim.mjs';

// one page, nothing connected (noveado, no obs=)
function page(query = '', { stored, html = {} } = {}) {
  const clock = new Clock(), rand = rng(1), profile = new Profile(clock, rand), net = new Network(clock, rand);
  if (stored !== undefined) profile.store.set('tgl-obs-form', stored);
  return new Page({ name: 'p', url: `https://x/obs/chatting?noveado=1&${query}`, profile, net, clock, html, scripts: [THEME()] });
}

test('the avatar\'s own veadotube states map exactly', () => {
  const T = page().TGL;
  const want = { cyan: 'cyan', red: 'red', yellow: 'yellow', pink: 'princess', animated: 'cyan', princess: 'princess', blobfish: 'blobfish' };
  for (const [state, form] of Object.entries(want)) assert.equal(T.formForState(state), form, state);
  assert.equal(T.formForState('Blobfish'), 'blobfish', 'case doesn\'t matter');
});

test('other state names: matched by word, anything else is Tron', () => {
  const T = page().TGL;
  assert.equal(T.formForState('tiara-mode'), 'princess');
  assert.equal(T.formForState('big fish'), 'blobfish');
  assert.equal(T.formForState('rage'), 'red');
  assert.equal(T.formForState('happy'), 'yellow');
  assert.equal(T.formForState('sleepy'), 'cyan');
  assert.equal(T.formForState(''), null);
});

test('map= pins a state to a form and beats the automatic matching', () => {
  const T = page('map=fishing:princess,red:blobfish').TGL;
  assert.equal(T.formForState('fishing'), 'princess');
  assert.equal(T.formForState('red'), 'blobfish');
  assert.equal(T.formForState('yellow'), 'yellow');
});

test('where a scene starts: form=, else the last form picked (old and new saves), else Tron', () => {
  assert.equal(page('form=red', { stored: 'princess@5' }).TGL.form, 'red');
  assert.equal(page('', { stored: 'princess@5' }).TGL.form, 'princess');
  assert.equal(page('', { stored: 'blobfish' }).TGL.form, 'blobfish');        // saved before pick times existed
  assert.equal(page('', { stored: 'nonsense@1' }).TGL.form, 'cyan');
  assert.equal(page('form=nonsense').TGL.form, 'cyan');
});

test('the page shows its form: data-form and the accent colour', () => {
  const p = page('form=princess');
  assert.equal(p.root.dataset.form, 'princess');
  assert.equal(p.root.style.props['--accent'], '#ff63b8');
  p.TGL.set('blobfish');
  assert.equal(p.root.dataset.form, 'blobfish');
  assert.equal(p.root.style.props['--accent'], '#ffb36b');
});

test('a pick is saved with its time, for the other pages', () => {
  const p = page();
  p.clock.now = 1234;
  p.TGL.set('red');
  assert.equal(p.cache.get('tgl-obs-form'), 'red@1234');
});

test('hide= (and the older art=0, music=0) turn parts off', () => {
  const T = page('hide=chat,goal&art=0&music=0').TGL;
  for (const part of ['chat', 'goal', 'art', 'music']) assert.ok(T.hidden(part), part);
  assert.ok(!T.hidden('ticker'));
});

test('cycling scenes (<html data-cycle>) cycle unless cycle=0', () => {
  assert.equal(page('', { html: { 'data-cycle': '' } }).TGL.cycling, true);
  assert.equal(page('cycle=0', { html: { 'data-cycle': '' } }).TGL.cycling, false);
  assert.equal(page().TGL.cycling, false);
});

test('an unknown form is ignored', () => {
  const p = page('form=red');
  p.TGL.set('purple');
  assert.equal(p.TGL.form, 'red');
  assert.equal(p.stats.changes, 0);
});
