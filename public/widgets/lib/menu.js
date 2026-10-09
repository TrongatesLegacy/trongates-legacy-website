// The phone menu on the widget pages (/widgets/, /chatagram/, /chaplinko/), like the homepage's: a ☰ button already in
// the header (static, so nothing moves when this runs),
//   <button class="mbtn" type="button" aria-expanded="false" aria-label="Menu" data-at="760" data-links=".menu a, .more"><i></i><i></i><i></i></button>
// opens a panel under the header with copies of the page's own links (data-links: the page's section links plus the ones
// it hides on phones, like More widgets). It shows where the page's own nav hides (max-width data-at px), closes on a
// link, Esc, a tap outside, or the window widening. Each page colours it: --mb-bg, --mb-fg, --mb-muted, --mb-accent,
// --mb-line, --mb-font on the header.
(() => {
  const btn = document.querySelector('.mbtn'); if (!btn) return;
  const header = btn.closest('header'), at = +btn.dataset.at || 760, wide = matchMedia(`(min-width: ${at + 1}px)`);
  const css = document.createElement('style');
  css.textContent = `
.mbtn { display: none; position: relative; width: 42px; height: 42px; flex: none; margin-left: 4px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--mb-line, #ffffff26); background: none; color: var(--mb-fg, #fff); }
.mbtn i { position: absolute; left: 50%; top: 50%; width: 18px; height: 2px; margin: -1px 0 0 -9px; border-radius: 2px; background: currentColor; transition: transform .25s, opacity .2s; }
.mbtn i:nth-child(1) { transform: translateY(-6px); } .mbtn i:nth-child(3) { transform: translateY(6px); }
.mbtn[aria-expanded="true"] { color: var(--mb-accent, #fff); border-color: var(--mb-accent, #fff); }
.mbtn[aria-expanded="true"] i:nth-child(1) { transform: rotate(45deg); } .mbtn[aria-expanded="true"] i:nth-child(2) { opacity: 0; }
.mbtn[aria-expanded="true"] i:nth-child(3) { transform: rotate(-45deg); }
.mbtn:focus-visible { outline: 2px solid var(--mb-accent, #fff); outline-offset: 2px; }
@media (max-width: ${at}px) { .mbtn { display: block; } }
.mpanel { position: absolute; left: 0; right: 0; top: 100%; z-index: 50; padding: 6px 0 14px; background: var(--mb-bg, #111);
  border-bottom: 1px solid var(--mb-line, #ffffff26); box-shadow: 0 18px 40px #0009; animation: mpanel .22s ease-out; }
.mpanel[hidden] { display: none; }
.mpanel a { display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 640px; margin: 0 auto; padding: 15px 20px;
  border-bottom: 1px solid var(--mb-line, #ffffff26); font: 19px/1.1 var(--mb-font, system-ui, sans-serif); color: var(--mb-fg, #fff); text-decoration: none; }
.mpanel a:last-child { border-bottom: 0; }
.mpanel a::after { content: '›'; font: 400 1.25em/1 system-ui, sans-serif; color: var(--mb-muted, #fff8); }
.mpanel a.out::after { content: '↗'; font-size: .85em; }
.mpanel a:hover, .mpanel a:focus-visible { color: var(--mb-accent, #fff); }
@keyframes mpanel { from { opacity: 0; transform: translateY(-6px); } }
@media (prefers-reduced-motion: reduce) { .mpanel { animation: none; } .mbtn i { transition: none; } }`;
  document.head.append(css);
  if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
  // a div with the navigation role, not a <nav>: a page's own "header nav { display: none }" on phones would hide it
  const panel = document.createElement('div');
  panel.className = 'mpanel'; panel.id = 'mpanel'; panel.hidden = true; panel.setAttribute('role', 'navigation'); panel.setAttribute('aria-label', 'Menu');
  const seen = new Set();
  const picked = (btn.dataset.links || 'nav a').split(',').flatMap((sel) => [...document.querySelectorAll(sel)]);   // in the order listed
  for (const a of picked) {
    const href = a.getAttribute('href'); if (!href || seen.has(href)) continue; seen.add(href);
    const c = document.createElement('a'); c.href = href; c.textContent = a.textContent.replace(/[↗›]/g, '').replace(/\s+/g, ' ').trim();
    if (!href.startsWith('#')) c.className = 'out';
    panel.append(c);
  }
  header.append(panel);
  btn.setAttribute('aria-controls', 'mpanel');
  const set = (open, focus) => {
    btn.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
    if (open && focus) panel.querySelector('a')?.focus();
    if (!open && focus) btn.focus();
  };
  btn.addEventListener('click', (e) => set(panel.hidden, e.detail === 0));   // from the keyboard, focus goes into the menu
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) set(false, true); });
  addEventListener('click', (e) => { if (!panel.hidden && !header.contains(e.target)) set(false); });
  wide.addEventListener('change', (m) => { if (m.matches) set(false); });
})();
