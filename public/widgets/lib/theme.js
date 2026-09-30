// A widget's theme and accent (docs/widgets.md, "Themes" and "Live theme message"). The link sets the starting look
// (theme=, accent=); the page the widget is embedded in can change it live, without a reload (a reload would restart
// the game), by posting a message to the widget's frame:
//
//   frame.contentWindow.postMessage({ type: 'widget-theme', theme: 'neon', accent: 'ff4155' }, '*')
//
// Either field can be left out; accent: '' goes back to the theme's own colour. Anything invalid is ignored.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const THEMES = ['chatagram', 'chaplinko', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy'];
  // each theme's own accent, for the set-up page's "theme default" swatch (themes.css has the same values)
  const ACCENTS = { chatagram: 'ffc93c', chaplinko: 'ff7a1a', neutral: '4f8cff', light: 'ff5a36', neon: '22e5ff', candy: 'ffd23f', royal: 'ff63b8', deep: 'ffb36b', cozy: 'd9653b' };
  const hex = (c) => (/^#?[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).replace('#', '').toLowerCase() : '');

  /** @param {HTMLElement} el @param {{ theme?: string, accent?: string }} t */
  function apply(el, t) {
    if (t.theme && THEMES.includes(t.theme)) el.dataset.theme = t.theme;
    if (t.accent !== undefined) {
      const c = hex(t.accent);
      if (c) el.style.setProperty('--accent', '#' + c); else if (t.accent === '') el.style.removeProperty('--accent');
    }
  }
  /** follow live theme messages; onChange runs after each one that changed something */
  function listen(el, onChange = () => {}) {
    addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.type !== 'widget-theme') return;
      const before = el.dataset.theme + el.style.getPropertyValue('--accent');
      apply(el, { theme: d.theme, accent: d.accent });
      if (el.dataset.theme + el.style.getPropertyValue('--accent') !== before) onChange();
    });
  }
  // Reduced motion: the viewer's system setting, except inside OBS, where it's the streaming PC's setting (Windows'
  // "Animation effects" off would otherwise freeze the widget for every viewer). motion=reduce|full in the link forces it.
  const reducedMotion = (q = new URLSearchParams(location.search)) =>
    q.get('motion') === 'reduce' || (q.get('motion') !== 'full' && q.get('animate') !== '1' && !window.obsstudio && matchMedia('(prefers-reduced-motion: reduce)').matches);

  W.theme = { THEMES, ACCENTS, apply, listen, hex, reducedMotion };
})();
