// The set-up pages' Preview backdrop picker (/chatagram/, /chaplinko/): what the live preview plays over. Busy,
// hard-edged pretend games drawn in CSS, so the background settings show how see-through they really are; Plain is the
// page's own. Only the preview: it never touches a link. The page has an empty box above its preview, naming the frames
// it paints (the iframes themselves, so a backdrop covers exactly the game and scales with it):
//   <div class="bgs" data-frames="#pv, #lbpv"></div>
// Each page colours it: --bgs-tile, --bgs-fg, --bgs-muted, --bgs-on, --bgs-on-fg on the box or above (docs/widgets.md).
(() => {
  const box = document.querySelector('.bgs'); if (!box) return;
  const frames = [...document.querySelectorAll(box.dataset.frames)];
  const BACKDROPS = {
    none: ['Plain', 'none', 'var(--bgs-tile, #222)'],
    shapes: ['Shapes', `repeating-linear-gradient(45deg, #ffffff2e 0 14px, transparent 14px 28px),
      radial-gradient(circle at 16% 28%, #ff3d6e 0 70px, transparent 71px), radial-gradient(circle at 72% 62%, #2bd9a7 0 110px, transparent 111px),
      radial-gradient(circle at 90% 18%, #ffd23f 0 55px, transparent 56px), radial-gradient(circle at 38% 86%, #4f8cff 0 85px, transparent 86px),
      linear-gradient(135deg, #ff7a1a, #7b3cf0 50%, #12b5e6)`,
    'radial-gradient(circle at 30% 35%, #ff3d6e 0 4px, transparent 5px), radial-gradient(circle at 70% 65%, #2bd9a7 0 5px, transparent 6px), linear-gradient(135deg, #ff7a1a, #7b3cf0 50%, #12b5e6)'],
    checker: ['Checker', 'conic-gradient(#ff3d6e 25%, #ffd23f 0 50%, #2bd9a7 0 75%, #4f8cff 0) 0 0 / 48px 48px',
      'conic-gradient(#ff3d6e 25%, #ffd23f 0 50%, #2bd9a7 0 75%, #4f8cff 0) 0 0 / 9px 9px'],
    scene: ['Scene', `radial-gradient(circle at 80% 22%, #fff6a8 0 34px, #ffd23f 35px 48px, transparent 49px),
      radial-gradient(ellipse 260px 120px at 20% 100%, #2e9e4f 98%, transparent), radial-gradient(ellipse 340px 150px at 70% 100%, #3cc062 98%, transparent),
      repeating-linear-gradient(90deg, #8b4a2b 0 40px, #a85d36 40px 80px) 0 100% / 100% 34px no-repeat,
      radial-gradient(ellipse 70px 26px at 30% 30%, #fff 98%, transparent), radial-gradient(ellipse 90px 30px at 55% 18%, #fff 98%, transparent),
      linear-gradient(#5ec8ff, #bfe9ff)`,
    'radial-gradient(circle at 70% 30%, #ffd23f 0 3px, transparent 4px), linear-gradient(#5ec8ff 60%, #3cc062 60%)'],
    plaid: ['Plaid', `repeating-linear-gradient(0deg, #ff3d6e55 0 6px, transparent 6px 22px), repeating-linear-gradient(90deg, #2bd9a755 0 6px, transparent 6px 26px),
      repeating-linear-gradient(30deg, #ffd23f 0 3px, transparent 3px 17px), linear-gradient(90deg, #1b1f4a, #5a1e6e, #0f5a5a)`,
    'repeating-linear-gradient(30deg, #ffd23f 0 1.5px, transparent 1.5px 5px), linear-gradient(90deg, #1b1f4a, #5a1e6e, #0f5a5a)'],
  };
  const DEFAULT = 'shapes';
  // :not(.bgs *) also lifts the backdrops over a page's own "iframe { background: transparent }"
  const css = document.createElement('style');
  css.textContent = `
.bgs { font-size: 13px; color: var(--bgs-muted, #fff9); display: grid; gap: 6px; }
.bgs p { margin: 0; } .bgs p b { color: var(--bgs-fg, #fff); font-weight: 600; }
.bgs .picks { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }   /* always one row */
.bgs button { font: inherit; font-size: 12px; background: var(--bgs-tile, #222); color: var(--bgs-muted, #fff9); border: 0; padding: 6px 2px 5px; border-radius: 10px;
  cursor: pointer; display: grid; justify-items: center; gap: 4px; white-space: nowrap; }
.bgs button i { width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1px #ffffff33; }
.bgs button[aria-pressed=true] { background: var(--bgs-on, #444); color: var(--bgs-on-fg, #fff); }
.bgs button:focus-visible { outline: 2px solid var(--bgs-on, #fff); outline-offset: 2px; }
${Object.entries(BACKDROPS).filter(([k]) => k !== 'none').map(([k, [, bg]]) => `[data-bg=${k}]:not(.bgs *) { background: ${bg}; }`).join('\n')}
${Object.entries(BACKDROPS).map(([k, [, , sw]]) => `.bgs button[data-pick=${k}] i { background: ${sw}; }`).join('\n')}`;
  document.head.append(css);
  box.innerHTML = '<p id="bgs-l"><b>Preview backdrop</b> · only here, to check how see-through it is</p><div class="picks" role="group" aria-labelledby="bgs-l">' +
    Object.entries(BACKDROPS).map(([k, [name]]) => `<button type="button" data-pick="${k}" aria-pressed="false"><i></i>${name}</button>`).join('') + '</div>';
  const pick = (k) => {
    for (const f of frames) f.dataset.bg = k;
    for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.pick === k));
  };
  for (const b of box.querySelectorAll('button')) b.addEventListener('click', () => pick(b.dataset.pick));
  pick(DEFAULT);
})();
