// Inputty's page (docs/widgets.md, "Inputty"): the steps, the desk, the practice runs, the colour mode. Loaded
// deferred after the shared library, so the first screen draws before any of it runs.
(() => {
  const $ = (id) => document.getElementById(id);
  const g = Guide.create({ theme: 'zojie' });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done = new Set(), marked = new Set();
  let copied = false;

  // ---- a tiny isometric drawing kit: boxes and cylinders, painted back to front ----
  const C = 0.866, S = 0.5, INK = '#2b2a4a';
  const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const tri = (c) => (Array.isArray(c) ? c : [c, mix(c, INK, 0.12), mix(c, INK, 0.26)]);
  const f = (n) => n.toFixed(1);
  function Iso(U) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (X, Y) => { if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; };
    const P = (x, y, z) => { const X = (x - y) * C * U, Y = (x + y) * S * U - z * U; grow(X, Y); return [X, Y]; };
    const pts = (a) => a.map((p) => P(...p).map(f).join(',')).join(' ');
    const poly = (a, fill, cls) => `<polygon${cls ? ` class="${cls}"` : ''} points="${pts(a)}" fill="${fill}"/>`;
    // the three faces we can see: front-left (+y), front-right (+x), top
    function box(x, y, z, w, d, h, c, topCls) {
      const [t, l, r] = tri(c), X = x + w, Y = y + d, Z = z + h;
      return poly([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]], l) + poly([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]], r) + poly([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]], t, topCls ? `t ${topCls}` : 't');
    }
    function cyl(cx, cy, r, z, h, c) {
      const [t, l] = tri(c), [X, Yb] = P(cx, cy, z), [, Yt] = P(cx, cy, z + h), rx = r * U * 1.2247, ry = r * U * 0.7071;
      grow(X - rx, Yt - ry); grow(X + rx, Yb + ry);
      return `<path class="solid" d="M${f(X - rx)},${f(Yt)} L${f(X - rx)},${f(Yb)} A${f(rx)},${f(ry)} 0 0 0 ${f(X + rx)},${f(Yb)} L${f(X + rx)},${f(Yt)} Z" fill="${l}"/><ellipse class="solid" cx="${f(X)}" cy="${f(Yt)}" rx="${f(rx)}" ry="${f(ry)}" fill="${t}"/>`;
    }
    // text lying flat on a top face, or standing on a front-left face
    const topText = (x, y, z, str, size, fill) => { const [X, Y] = P(x, y, z); return `<text transform="matrix(${f(C * U)},${f(S * U)},${f(-C * U)},${f(S * U)},${f(X)},${f(Y)})" font-size="${size}" fill="${fill}" font-family="Outfit, sans-serif" font-weight="800">${str}</text>`; };
    const faceText = (x, y, z, str, size, fill) => { const [X, Y] = P(x, y, z); return `<text transform="matrix(${f(C * U)},${f(S * U)},0,${f(U)},${f(X)},${f(Y)})" font-size="${size}" fill="${fill}" font-family="Outfit, sans-serif" font-weight="800">${str}</text>`; };
    const bounds = () => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    return { P, pts, poly, box, cyl, topText, faceText, grow, bounds, U };
  }
  const mini = (svg, build, pad = 4) => {
    const I = Iso(14), html = build(I), b = I.bounds();
    svg.setAttribute('viewBox', `${f(b.x - pad)} ${f(b.y - pad)} ${f(b.w + pad * 2)} ${f(b.h + pad * 2)}`);
    svg.innerHTML = html;
  };

  // ---- Fig. A: the desk ----
  const KEYROWS = [
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
    ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
    ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
    ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight', 'ArrowUp'],
    ['ControlLeft', 'MetaLeft', 'AltLeft', ['Space', 6], 'AltRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
  ];
  function buildScene() {
    const I = Iso(40), Z0 = 0.8, out = [];
    const part = (name, html, extra = '') => out.push(`<g class="part out ${extra}" data-part="${name}">${html}</g>`);
    // a soft shadow, then the desk itself (a chunky toy slab)
    out.push(`<polygon points="${I.pts([[0.6, 0.6, -0.5], [13.6, 0.6, -0.5], [13.6, 7.6, -0.5], [0.6, 7.6, -0.5]])}" fill="#5b4bb0" opacity=".12" style="filter: blur(10px)"/>`);
    out.push(I.box(0, 0, 0, 13, 7, Z0, ['#f8ead8', '#ecd5bb', '#dcc0a0']));
    out.push(`<path d="M${I.P(0.5, 6.4, Z0).map(f).join(',')} L${I.P(12.5, 6.4, Z0).map(f).join(',')}" stroke="#e7cfb2" stroke-width="2" stroke-linecap="round"/>`);
    // the monitor: base, neck, panel, and the dark screen the live preview sits on
    out.push(I.box(4.0, 0.4, Z0, 2.8, 1.5, 0.15, '#dcd6f2') + I.box(5.1, 0.5, Z0 + 0.15, 0.6, 0.45, 1.1, '#cfc8ee') + I.box(0.9, 0.95, Z0 + 1.0, 9.0, 0.4, 5.2, ['#55537e', '#3b3a5e', '#302f50']));
    out.push(I.poly([[1.2, 1.35, Z0 + 5.95], [9.6, 1.35, Z0 + 5.95], [9.6, 1.35, Z0 + 1.25], [1.2, 1.35, Z0 + 1.25]], '#1d1c35'));
    const anchor = I.P(1.2, 1.35, Z0 + 5.95);
    // the PC (arrives with the helper), its light (on once input-overlay is switched on)
    const [lx, ly] = I.P(10.95, 2.2, Z0 + 2.6);
    part('tower', I.box(10.6, 0.2, Z0, 1.7, 2.0, 3.2, '#cdc1f8') + I.poly([[10.85, 2.2, Z0 + 2.2], [12.0, 2.2, Z0 + 2.2], [12.0, 2.2, Z0 + 2.05], [10.85, 2.2, Z0 + 2.05]], '#a798e6') + I.poly([[10.85, 2.2, Z0 + 1.8], [12.0, 2.2, Z0 + 1.8], [12.0, 2.2, Z0 + 1.65], [10.85, 2.2, Z0 + 1.65]], '#a798e6') + `<ellipse class="led" id="led" cx="${f(lx)}" cy="${f(ly)}" rx="5" ry="4"/>`, 'tower-g');
    // the cable, plugged in at step 4
    const cab = [[11.3, 2.2, Z0 + 0.45], [11.3, 2.75, Z0 + 0.03], [8.6, 2.75, Z0 + 0.03], [6.5, 2.0, Z0 + 0.03], [6.5, 1.9, Z0 + 0.1]].map((p) => I.P(...p).map(f).join(','));
    out.push(`<path class="cable" id="cable" d="M${cab.join(' L')}"/>`);
    // mug and plant: the finishing touches (step 2)
    const [hx, hy] = I.P(1.05, 2.3, Z0 + 0.45);
    part('finish', I.cyl(0.6, 2.4, 0.42, Z0, 0.8, '#ffb38a') + `<path d="M${f(hx)},${f(hy - 8)} q12,2 9,13 q-3,8 -9,6" fill="none" stroke="#e98f62" stroke-width="4" stroke-linecap="round"/>`, '');
    const leaf = (x, y, z, rx, ry, rot, fill) => { const [X, Y] = I.P(x, y, z); I.grow(X - rx, Y - rx); I.grow(X + rx, Y + rx); return `<ellipse class="solid" cx="${f(X)}" cy="${f(Y)}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${rot} ${f(X)} ${f(Y)})"/>`; };
    part('finish', I.cyl(11.4, 3.4, 0.42, Z0, 0.6, '#ff9fc6') + leaf(11.4, 3.4, Z0 + 1.15, 9, 22, -32, '#78c99a') + leaf(11.4, 3.4, Z0 + 1.2, 9, 22, 30, '#5db383') + leaf(11.4, 3.4, Z0 + 1.55, 8, 20, 4, '#8fd9a8'), '');
    // the keyboard: every key is its own little block, so typing here presses them
    let kb = I.box(1.6, 2.9, Z0, 5.6, 2.1, 0.3, '#efebfa');
    KEYROWS.forEach((row, r) => {
      let col = 0;
      row.forEach((k) => {
        const [code, span] = Array.isArray(k) ? k : [k, 1];
        kb += `<g class="key" data-code="${code}">${I.box(1.8 + col * 0.4, 3.0 + r * 0.37, Z0 + 0.3, span * 0.4 - 0.06, 0.3, 0.1, '#ffffff')}</g>`;
        col += span;
      });
    });
    part('kb', kb);
    // the mouse, with its two buttons
    part('mouse', I.box(8.2, 3.2, Z0, 0.9, 1.7, 0.3, '#efebfa') + `<g class="key" data-code="m0">${I.box(8.2, 3.2, Z0 + 0.3, 0.43, 0.7, 0.06, '#ffffff')}</g><g class="key" data-code="m2">${I.box(8.67, 3.2, Z0 + 0.3, 0.43, 0.7, 0.06, '#ffffff')}</g>` + I.box(8.6, 3.45, Z0 + 0.36, 0.1, 0.32, 0.08, '#b9a8f5'));
    // a controller: centre stage for controller only, front and right when you've got both
    const pad = (x, y) => I.box(x, y, Z0, 3.0, 1.2, 0.35, '#d9d1f8') + I.box(x, y + 1.2, Z0, 0.8, 0.55, 0.32, '#d9d1f8') + I.box(x + 2.2, y + 1.2, Z0, 0.8, 0.55, 0.32, '#d9d1f8')
      + I.box(x + 0.4, y + 0.5, Z0 + 0.35, 0.56, 0.16, 0.06, '#2b2a4a') + I.box(x + 0.6, y + 0.3, Z0 + 0.35, 0.16, 0.56, 0.06, '#2b2a4a')
      + I.cyl(x + 1.1, y + 0.85, 0.17, Z0 + 0.35, 0.15, '#56547a') + I.cyl(x + 1.9, y + 0.85, 0.17, Z0 + 0.35, 0.15, '#56547a')
      + I.cyl(x + 2.45, y + 0.3, 0.1, Z0 + 0.35, 0.06, '#ffe28a') + I.cyl(x + 2.7, y + 0.55, 0.1, Z0 + 0.35, 0.06, '#ff9fc6') + I.cyl(x + 2.2, y + 0.55, 0.1, Z0 + 0.35, 0.06, '#9cc8f5') + I.cyl(x + 2.45, y + 0.8, 0.1, Z0 + 0.35, 0.06, '#8fd9c0');
    part('pad-a', pad(3.2, 3.1));
    part('pad-b', pad(6.9, 5.0));
    // the parts box: open, with bits peeking out, until it folds itself flat at the end
    const Zt = Z0 + 1.6;
    let bx = I.poly([[10, 4.6, Zt], [12.8, 4.6, Zt], [12.8, 4.05, Zt + 0.9], [10, 4.05, Zt + 0.9]], '#f0c99b') + I.poly([[10, 4.6, Zt], [10, 6.8, Zt], [9.45, 6.8, Zt + 0.9], [9.45, 4.6, Zt + 0.9]], '#e6b886');
    bx += I.poly([[10, 4.6, Z0 + 0.1], [12.8, 4.6, Z0 + 0.1], [12.8, 6.8, Z0 + 0.1], [10, 6.8, Z0 + 0.1]], '#b88a5d') + I.poly([[10, 4.6, Z0 + 0.1], [10, 6.8, Z0 + 0.1], [10, 6.8, Zt], [10, 4.6, Zt]], '#c99a6a') + I.poly([[10, 4.6, Z0 + 0.1], [12.8, 4.6, Z0 + 0.1], [12.8, 4.6, Zt], [10, 4.6, Zt]], '#d6a874');
    bx += `<g class="peek" id="peek">${I.box(10.5, 5.0, Z0 + 0.1, 0.55, 0.55, 1.75, '#ffffff') + I.box(11.3, 5.1, Z0 + 0.1, 0.8, 1.2, 1.6, '#d9d1f8') + I.box(10.6, 5.9, Z0 + 0.1, 0.5, 0.5, 1.95, '#ffe28a')}</g>`;
    bx += I.poly([[10, 6.8, Z0], [12.8, 6.8, Z0], [12.8, 6.8, Zt], [10, 6.8, Zt]], '#e9ba88') + I.poly([[12.8, 4.6, Z0], [12.8, 6.8, Z0], [12.8, 6.8, Zt], [12.8, 4.6, Zt]], '#d8a571');
    bx += I.faceText(10.35, 6.8, Z0 + 0.95, 'INPUTTY', 0.42, '#8a5a2e');
    bx += I.poly([[10, 6.8, Zt], [12.8, 6.8, Zt], [12.8, 7.3, Zt - 0.7], [10, 7.3, Zt - 0.7]], '#f3cfa3') + I.poly([[12.8, 4.6, Zt], [12.8, 6.8, Zt], [13.3, 6.8, Zt - 0.7], [13.3, 4.6, Zt - 0.7]], '#e2b07c');
    out.push(`<g class="part down" data-part="box-open">${bx}</g>`);
    part('box-flat', I.box(10, 4.6, Z0, 3.0, 2.2, 0.35, ['#f3cfa3', '#e9ba88', '#d8a571']) + I.topText(10.35, 5.45, Z0 + 0.36, 'INPUTTY', 0.5, '#8a5a2e') + I.topText(10.35, 6.15, Z0 + 0.36, 'assembled ✓', 0.38, '#22805a'));
    // the ON AIR lamp (step 5)
    part('lamp', `<g class="lamp" id="lamp">${I.box(0.6, 5.7, Z0, 1.6, 0.9, 0.35, '#ffd6e4') + I.box(0.75, 5.85, Z0 + 0.35, 1.3, 0.6, 0.08, '#ffb3c9', 'lamp-top') + I.topText(0.85, 6.32, Z0 + 0.44, 'ON AIR', 0.3, '#ffffff')}</g>`);
    const b = I.bounds(), pad2 = 22;
    return { html: out.join(''), x: b.x - pad2, y: b.y - pad2, w: b.w + pad2 * 2, h: b.h + pad2 * 2, anchor, scr: { w: 8.4 * I.U, h: 4.7 * I.U } };
  }
  const SC = buildScene();
  const stage = $('stage'), scenebox = $('scenebox'), scr = $('scr');
  stage.style.width = SC.w + 'px'; stage.style.height = SC.h + 'px';
  stage.insertAdjacentHTML('afterbegin', `<svg class="scene" width="${f(SC.w)}" height="${f(SC.h)}" viewBox="${f(SC.x)} ${f(SC.y)} ${f(SC.w)} ${f(SC.h)}" aria-hidden="true">${SC.html}</svg>`);
  const cable = $('cable'), clen = cable.getTotalLength();
  cable.style.strokeDasharray = clen; cable.style.strokeDashoffset = clen;
  stage.querySelectorAll('[data-part="finish"]')[1]?.style.setProperty('--d', '160ms');

  // the screen: drawn onto the monitor's face, or held up straight to look at
  let flat = innerWidth < 760, userFlat = false, faceT = 0;
  function placeScreen() {
    if (flat) {
      const w = SC.w - 44, h = Math.round(w * 0.58);
      Object.assign(scr.style, { left: '22px', top: Math.round((SC.h - h) / 2) + 'px', width: w + 'px', height: h + 'px', transform: 'none' });
    } else {
      Object.assign(scr.style, { left: f(SC.anchor[0] - SC.x) + 'px', top: f(SC.anchor[1] - SC.y) + 'px', width: SC.scr.w + 'px', height: SC.scr.h + 'px', transform: `matrix(${C}, ${S}, 0, 1, 0, 0)` });
    }
    scenebox.classList.toggle('flat', flat);
    $('flatBtn').textContent = flat ? 'Back to the desk' : 'Look straight at it';
  }
  function fit() { const k = scenebox.clientWidth / SC.w; stage.style.transform = `scale(${k})`; scenebox.style.height = SC.h * k + 'px'; }
  new ResizeObserver(fit).observe(scenebox);
  fit(); placeScreen();
  $('flatBtn').onclick = () => { flat = !flat; userFlat = true; placeScreen(); };
  g.preview($('preview'));

  // typing and clicking anywhere presses the little keyboard and mouse too
  const keyEl = (code) => stage.querySelector(`.key[data-code="${code}"]`);
  addEventListener('keydown', (e) => keyEl(e.code)?.classList.add('lit'));
  addEventListener('keyup', (e) => keyEl(e.code)?.classList.remove('lit'));
  addEventListener('mousedown', (e) => keyEl('m' + e.button)?.classList.add('lit'));
  addEventListener('mouseup', (e) => keyEl('m' + e.button)?.classList.remove('lit'));
  addEventListener('blur', () => stage.querySelectorAll('.key.lit').forEach((k) => k.classList.remove('lit')));
  const keyAccent = () => scenebox.style.setProperty('--key-acc', '#' + g.L.look({ ...g.s, orig: 0 }).accent);
  keyAccent();

  // ---- the step blocks ----
  g.ui.device($('device'));
  const advice = { mac: "You're on a Mac. Controllers work great here. The keys and mouse helper is Windows-only, so pick Controller if you stream from this Mac.", phone: "You're on a phone. Open this page on the PC you stream from: that's where OBS and your keys are.", linux: 'On Linux the helper comes as a .deb. Same steps, slightly different screens.' };
  if (advice[g.OS]) { $('advice').textContent = advice[g.OS]; $('advice').hidden = false; }
  g.ui.look($('look'));
  function buildLayouts() {
    const d = g.s.device || 'kbm';
    $('lay1').textContent = d === 'pad' ? 'Controller' : 'Keyboard';
    g.ui.layouts($('layouts1'), d === 'pad' ? 'controller' : 'keyboard', 'p');
    $('layouts2wrap').hidden = d === 'pad';
    if (d !== 'pad') { $('lay2').textContent = d === 'both' ? 'And your controller' : 'And your mouse'; g.ui.layouts($('layouts2'), d === 'both' ? 'controller' : 'mouse', 'p2'); }
  }
  // built when a device is picked (step 2 is hidden until then): its pictures are drawn off the page's load
  if (g.s.device) buildLayouts();
  g.ui.download($('dl'));
  Mock.mount($('mk-install'), 'install', g);
  Mock.mount($('mk-obs'), 'obs', g);
  g.ui.helperStatus($('status4'));
  g.ui.link($('link'), { label: 'Copy my link' });
  Mock.mount($('mk-source'), 'source', g);
  g.ui.helperStatus($('status6a'));
  g.ui.padStatus($('status6b'));

  // step numbers as little blocks, and a small isometric picture on each page
  document.querySelectorAll('.num').forEach((el) => { el.innerHTML = `<svg viewBox="0 0 64 64"><polygon class="top" points="32,5 59,19.5 32,34 5,19.5"/><polygon class="l" points="5,19.5 32,34 32,60 5,45.5"/><polygon class="r" points="59,19.5 32,34 32,60 59,45.5"/><text x="32" y="24.5" text-anchor="middle">${el.dataset.n}</text><path class="tick" d="M24 19l6 5 11-9"/></svg>`; });
  const ARTS = {
    1: (I) => I.box(0, 0, 0, 5, 2, 0.35, '#efebfa') + [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => I.box(0.2 + c * 0.46, 0.2 + r * 0.42, 0.35, 0.36, 0.32, 0.1, r === 1 && c === 1 ? '#ff9fc6' : '#ffffff')).join('')).join('') + I.box(6, 0.4, 0, 2.6, 1.1, 0.4, '#d9d1f8') + I.cyl(7.9, 0.75, 0.13, 0.4, 0.08, '#ffe28a'),
    2: (I) => I.box(0, 0, 0, 1.4, 1.4, 1.4, '#b9a8f5') + I.box(2.1, 0, 0, 1.4, 1.4, 1.4, '#ffb38a') + I.box(1.05, 1.9, 0, 1.4, 1.4, 1.4, '#8fd9c0') + I.box(3.15, 1.9, 0, 1.4, 1.4, 1.4, '#ffe28a'),
    3: (I) => I.box(0, 0, 0, 2.6, 2.6, 2, '#ecc08f') + I.poly([[1.3, 0.3, 2], [2.2, 1.2, 2], [1.65, 1.2, 2], [1.65, 2.3, 2], [0.95, 2.3, 2], [0.95, 1.2, 2], [0.4, 1.2, 2]], '#6c55dd'),
    4: (I) => I.box(0, 0, 0, 1.6, 2.4, 3.4, '#cdc1f8') + I.poly([[0.3, 2.4, 2.9], [0.6, 2.4, 2.9], [0.6, 2.4, 2.65], [0.3, 2.4, 2.65]], '#6ef0b2') + I.box(2.3, 0, 0, 3.2, 0.4, 2.2, ['#55537e', '#3b3a5e', '#302f50']) + I.box(3.6, 0.4, 0, 0.6, 0.6, 0.2, '#dcd6f2'),
    5: (I) => { const a = I.P(1.6, 0.8, 0.05), b = I.P(4.2, 0.8, 0.05); return I.box(0, 0, 0, 1.6, 1.6, 1.6, '#b9a8f5') + `<path d="M${a.map(f).join(',')} q30,18 ${f(b[0] - a[0])},${f(b[1] - a[1])}" fill="none" stroke="#6c55dd" stroke-width="3" stroke-linecap="round"/>` + I.box(4.2, 0, 0, 1.6, 1.6, 1.6, '#8fd9c0'); },
    6: (I) => { const top = I.P(1.6, 1.6, 4.4), base = I.P(1.6, 1.6, 2); return I.box(0, 0, 0, 3.2, 3.2, 1, '#ffe28a') + I.box(0.8, 0.8, 1, 1.6, 1.6, 1, '#ff9fc6') + `<path d="M${base.map(f).join(',')} L${top.map(f).join(',')}" stroke="#2b2a4a" stroke-width="2"/><path d="M${top.map(f).join(',')} l16,5 l-16,6z" fill="#6c55dd"/>`; },
  };
  ARTS.how1 = ARTS[2]; ARTS.how2 = ARTS[5]; ARTS.how3 = ARTS[4];
  // the three choices in step 1, drawn in the desk's own toy style instead of emoji
  const keyboardArt = (I, x, y, cols, rows) => I.box(x, y, 0, cols * 0.46 + 0.3, rows * 0.42 + 0.3, 0.35, '#efebfa')
    + Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => I.box(x + 0.2 + c * 0.46, y + 0.2 + r * 0.42, 0.35, 0.36, 0.32, 0.1, r === 1 && c === 1 ? '#ff9fc6' : '#ffffff')).join('')).join('');
  const mouseArt = (I, x, y) => I.box(x, y, 0, 0.9, 1.7, 0.3, '#efebfa') + I.box(x, y, 0.3, 0.43, 0.7, 0.06, '#ffffff') + I.box(x + 0.47, y, 0.3, 0.43, 0.7, 0.06, '#ffffff') + I.box(x + 0.4, y + 0.25, 0.36, 0.1, 0.32, 0.08, '#b9a8f5');
  const padArt = (I, x, y) => I.box(x, y, 0, 3.0, 1.2, 0.35, '#d9d1f8') + I.box(x, y + 1.2, 0, 0.8, 0.55, 0.32, '#d9d1f8') + I.box(x + 2.2, y + 1.2, 0, 0.8, 0.55, 0.32, '#d9d1f8')
    + I.box(x + 0.4, y + 0.5, 0.35, 0.56, 0.16, 0.06, '#2b2a4a') + I.box(x + 0.6, y + 0.3, 0.35, 0.16, 0.56, 0.06, '#2b2a4a')
    + I.cyl(x + 1.1, y + 0.85, 0.17, 0.35, 0.15, '#56547a') + I.cyl(x + 1.9, y + 0.85, 0.17, 0.35, 0.15, '#56547a')
    + I.cyl(x + 2.45, y + 0.3, 0.1, 0.35, 0.06, '#ffe28a') + I.cyl(x + 2.7, y + 0.55, 0.1, 0.35, 0.06, '#ff9fc6') + I.cyl(x + 2.2, y + 0.55, 0.1, 0.35, 0.06, '#9cc8f5') + I.cyl(x + 2.45, y + 0.8, 0.1, 0.35, 0.06, '#8fd9c0');
  ARTS.kbm = (I) => keyboardArt(I, 0, 0, 8, 3) + mouseArt(I, 4.6, 0.1);
  ARTS.pad = (I) => padArt(I, 0, 0);
  ARTS.both = (I) => keyboardArt(I, 0, 0, 6, 3) + padArt(I, 3.6, 0.3);
  document.querySelectorAll('#device .g-device').forEach((b) => { b.querySelector('.g-ico').innerHTML = `<svg data-art="${b.dataset.d}" aria-hidden="true"></svg>`; });
  document.querySelectorAll('svg[data-art]').forEach((svg) => mini(svg, ARTS[svg.dataset.art]));

  // ---- progress: parts list, steps, the desk filling up, what the little person says ----
  function parts() {
    const d = g.s.device;
    const on = { keyboard: d === 'kbm' || d === 'both', mouse: d === 'kbm', controller: d === 'pad' || d === 'both', helper: g.needsHelper() || !d, obs: true, link: true };
    const got = { keyboard: on.keyboard && !!d, mouse: on.mouse && !!d, controller: on.controller && !!d, helper: g.ws.status === 'found', obs: g.ws.status === 'found' || copied, link: copied };
    document.querySelectorAll('#parts li[data-part]').forEach((li) => { const k = li.dataset.part; li.classList.toggle('off', !!d && !on[k]); li.classList.toggle('got', !!got[k]); });
  }
  function desk() {
    const d = g.s.device, pad = d === 'pad';
    const on = { kb: d === 'kbm' || d === 'both', mouse: d === 'kbm', 'pad-a': pad, 'pad-b': d === 'both', finish: done.has(3), tower: done.has(4) || (pad && done.has(1)), lamp: done.has(6), 'box-open': !done.has(7), 'box-flat': done.has(7) };
    const cableOn = done.has(5) || (pad && done.has(3));
    stage.querySelectorAll('.part').forEach((p) => p.classList.toggle('out', !on[p.dataset.part]));
    $('peek').classList.toggle('gone', !!d);
    cable.style.strokeDashoffset = cableOn ? 0 : clen;
    $('led').classList.toggle('on', cableOn);
    $('lamp').classList.toggle('glow', on.lamp);
    const list = [d ? ['kb', 'mouse', 'pad-a', 'pad-b'].filter((k) => on[k]).length : 0, on.finish, on.tower, cableOn, on.lamp];
    const total = (d ? ['kb', 'mouse', 'pad-a', 'pad-b'].filter((k) => on[k]).length : 1) + 4;
    const fitted = list.reduce((a, v) => a + +v, 0);
    $('fitted').textContent = done.has(7) ? `All ${total} parts fitted. Box folded flat.` : fitted ? `${fitted} of ${total} parts fitted` : 'Nothing fitted yet';
  }
  const TIPS = {
    1: ['guy-point', "Start with step 1. Pick what you play with and it drops onto the desk."],
    2: ['guy-point', 'Pick your keyboard and mouse. Try your own keys and watch the desk screen.'],
    3: ['guy-point', 'Now the fun part: make it yours. One set of colours for both.'],
    4: ['guy-point', 'Close OBS, grab the helper, click Next a few times. Have a practice run first if you like.'],
    5: ['guy-point', "Tools → input-overlay settings. Tick the box. Restart OBS. I'll spot it."],
    6: ['guy-point', 'Copy the link, then Sources ＋ → Browser. Paste, set the size, OK.'],
    7: ['guy-point', 'Press something in your game. Go on.'],
    end: ['guy-nod', 'Assembled. Chat can now see every button you press. Sorry in advance.'],
  };
  function sync() {
    const pad = g.s.device === 'pad';
    const skip = (n) => pad && (n === 4 || n === 5);
    if (g.s.device) done.add(1);
    $('setup').classList.toggle('unpicked', !g.s.device);
    marked.forEach((n) => done.add(n));
    let next = 0;
    for (let n = 1; n <= 7; n++) {
      const el = $('s' + n);
      el.classList.toggle('skip', skip(n));
      el.classList.toggle('done', done.has(n) && !skip(n));
      if (!(done.has(n) || skip(n)) && !next) next = n;
    }
    for (let n = 1; n <= 7; n++) $('s' + n).classList.toggle('now', n === next);
    document.querySelectorAll('#progress i').forEach((i, k) => { const n = k + 1; i.className = done.has(n) || skip(n) ? 'on' : n === next ? 'now' : ''; });
    $('testintro').textContent = pad ? "Press any button on your controller. When it lights up, you're done." : "Press a key in your game. When it lights up in OBS, you're done.";
    $('status6a').hidden = pad; $('status6b').hidden = !pad && g.s.device !== 'both';
    const [guy, tip] = TIPS[next || 'end'];
    const use = $('guy').querySelector('use');
    if (use.getAttribute('href') !== '#' + guy) use.setAttribute('href', '#' + guy);
    $('tip').textContent = tip;
    parts(); desk();
  }

  let celebrated = false;
  function celebrate() {
    if (celebrated) return;
    celebrated = true;
    $('guy').classList.add('nod');
    if (flat) { flat = false; placeScreen(); }
    if (reduced) return;
    const cols = [['#ffe28a', '#f7d36b', '#e9bf4a'], ['#b9a8f5', '#a493ef', '#8d7ae4'], ['#8fd9c0', '#6fc7a8', '#56b392'], ['#ff9fc6', '#f281b1', '#e0679a']];
    for (let i = 0; i < 28; i++) {
      const [t, l, r] = cols[i % cols.length];
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('class', 'confetti'); s.setAttribute('viewBox', '0 0 20 20'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = `<polygon points="10,2 18,6 10,10 2,6" fill="${t}"/><polygon points="2,6 10,10 10,18 2,14" fill="${l}"/><polygon points="18,6 10,10 10,18 18,14" fill="${r}"/>`;
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      s.style.animationDelay = Math.random() * 0.6 + 's';
      document.body.append(s);
      setTimeout(() => s.remove(), 4400);
    }
  }

  const LOOK = ['layout', 'theme', 'accent', 'frame', 'fx', 'title'];
  g.on((why) => {
    if (why === 'device') {
      buildLayouts();
      const rest = document.querySelector('.rest');
      if (!rest.classList.contains('seen')) { rest.classList.add('seen', 'reveal'); setTimeout(() => rest.classList.remove('reveal'), 900); }
      clearTimeout(faceT);
      faceT = setTimeout(() => { if (!flat) { flat = true; placeScreen(); } }, reduced ? 0 : 950);
    }
    if (why === 'layout') marked.add(2);
    else if (LOOK.includes(why)) marked.add(3);
    if (why === 'theme' || why === 'accent') keyAccent();
    if (why === 'copied') { copied = true; marked.add(6); }
    // the live checks tick their steps when they happen
    if (why === 'ws' && g.ws.status === 'found') { marked.add(4); marked.add(5); }
    if (why === 'ws' && g.ws.gotKey && g.s.device !== 'pad') marked.add(7);
    if (why === 'pad' && g.pad && (g.s.device === 'pad' || g.s.device === 'both')) marked.add(7);
    if (why === 'size' && g.size) $('size').textContent = `${g.size.w} × ${g.size.h}`;
    sync();
    if (done.has(7)) celebrate();
  });

  // clicking inside a step forgets every step after it (they untick, the desk takes those parts back), and anything
  // clicked in "Pick the finish" holds the screen up straight so the change is easy to see
  document.addEventListener('click', (e) => {
    const step = e.target.closest('.step');
    if (!step) return;
    const n = +step.id.slice(1);
    const ahead = [...marked, ...done].filter((k) => k > n);
    if (ahead.length) {
      ahead.forEach((k) => { marked.delete(k); done.delete(k); });
      if (n < 6) copied = false;
      if (n < 7) celebrated = false;
      sync();
    }
    if ((n === 2 || n === 3) && !flat) { flat = true; placeScreen(); }
  }, true);

  // "next page" buttons mark the step and move you along
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-next]');
    if (!b) return;
    const n = +b.dataset.next;
    marked.add(n); sync();
    let to = n + 1;
    while (to < 7 && $('s' + to).classList.contains('skip')) to++;
    $('s' + to).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
  $('device').addEventListener('click', (e) => {
    if (!e.target.closest('.g-device')) return;
    setTimeout(() => $('s2').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 650);
  });

  // the colour mode switch in the header
  const modeBtns = document.querySelectorAll('.mode button');
  const drawMode = () => modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === InputtyMode.pick())));
  modeBtns.forEach((b) => (b.onclick = () => { InputtyMode.set(b.dataset.mode); drawMode(); }));
  drawMode();

  sync();
})();
