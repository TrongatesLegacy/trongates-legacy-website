// The widget's eight themes. Seven are the shared widget themes (public/widgets/lib/themes.css draws the frame and
// panel); the preset art is recoloured from each one's three key colours (edge = darkest, key = middle, hi = lightest)
// and its accent (what a pressed key turns). Zojie is this widget's own: Zojie Raine's pastel storm-kitsune palette.
(() => {
  const THEMES = {
    zojie:   { label: 'Zojie',   edge: '5b3fb0', key: 'c9b2ff', hi: 'fdfaff', accent: 'ff7fdc', frame: 'none', font: 'Fredoka', weight: 700, radius: 16, glow: 0.6 },
    neutral: { label: 'Neutral', edge: '15171d', key: '6b7385', hi: 'f6f7fa', accent: '4f8cff', frame: 'none', font: 'system-ui', weight: 800, radius: 10 },
    light:   { label: 'Light',   edge: '16181d', key: 'a3a9b4', hi: 'ffffff', accent: 'ff5a36', frame: 'none', lightBg: true, font: 'system-ui', weight: 800, radius: 10, glow: 0.4 },
    neon:    { label: 'Neon',    edge: '061019', key: '24506f', hi: 'c4eaff', accent: '22e5ff', frame: 'none', font: 'Orbitron', weight: 700, radius: 2, ring: 'accent', glow: 0.95 },
    candy:   { label: 'Candy',   edge: '3b1590', key: 'a57cff', hi: 'ffffff', accent: 'ffd23f', frame: 'none', font: '"Lilita One"', weight: 400, radius: 14 },
    royal:   { label: 'Royal',   edge: '1a0f24', key: 'b8924a', hi: 'fff4fb', accent: 'ff63b8', frame: 'none', font: '"Cinzel Decorative"', weight: 900, radius: 4, ring: 'ffd98a' },
    deep:    { label: 'Deep',    edge: '02111a', key: '1d6e78', hi: 'eafcff', accent: 'ffb36b', frame: 'none', font: '"Lilita One"', weight: 400, radius: 16 },
    cozy:    { label: 'Cozy',    edge: '4a3222', key: 'c9a878', hi: 'fffaf0', accent: 'd9653b', frame: 'none', lightBg: true, font: 'Georgia', weight: 700, radius: 12, ring: 'e2cda8', glow: 0.35 },
  };
  const hex = (c) => (/^#?[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).replace('#', '').toLowerCase() : '');

  // every setting with its default; a link only carries the ones that differ
  const DEFAULTS = {
    p: 'game-keys', v: 1, a: 0,            // the layout: preset, its style (variant), its art
    p2: 'game-mouse', v2: 0, a2: 0,        // an optional second layout beside it ('' = none)
    theme: 'zojie', accent: '', key: '', edge: '', hi: '',
    orig: 0,                          // 1 = the art's own colours (theme still draws the frame)
    frame: '',                        // none | panel | window ('' = the theme's own)
    title: 'my inputs', bgo: 90, fx: '', outline: 1, port: 16899, demo: 0,
  };
  function read(q = new URLSearchParams(location.search)) {
    const s = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (!q.has(k)) continue;
      s[k] = typeof DEFAULTS[k] === 'number' ? +q.get(k) || 0 : q.get(k);
    }
    if (!THEMES[s.theme]) s.theme = DEFAULTS.theme;
    if (q.has('port')) s.port = Math.min(65535, Math.max(1, +q.get('port') || 16899));
    if (q.has('bgo')) s.bgo = Math.min(100, Math.max(0, +q.get('bgo')));
    return s;
  }
  function query(s) {
    const q = new URLSearchParams();
    for (const [k, d] of Object.entries(DEFAULTS)) if (s[k] !== undefined && String(s[k]) !== String(d)) q.set(k, s[k]);
    return q.toString();
  }
  /** the colours a view is recoloured with, or null for the art's own */
  function look(s) {
    if (+s.orig) return null;
    const t = THEMES[s.theme];
    // lightBg: the art sits on something light (the theme's panel or window), so light line art is drawn dark
    const framed = (s.frame || t.frame) !== 'none';
    return { edge: hex(s.edge) || t.edge, key: hex(s.key) || t.key, hi: hex(s.hi) || t.hi, accent: hex(s.accent) || t.accent, lightBg: !!t.lightBg && framed };
  }
  const frameOf = (s) => s.frame || THEMES[s.theme].frame;
  const fxOf = (s) => (s.fx === '' ? !!THEMES[s.theme].fx : s.fx === '1');

  window.IOLooks = { THEMES, DEFAULTS, read, query, look, frameOf, fxOf, hex };
})();
