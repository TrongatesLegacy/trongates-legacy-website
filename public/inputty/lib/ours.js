// Our own presets: drawn from scratch (no texture), so each theme's font, corners, colours and glow apply properly.
// Keys are placed in key units (1u = one letter key) on a real ANSI keyboard, so the stagger is right; a preset is a
// set of those keys (some trimmed, like a shorter space bar), or its own arrangement.
(() => {
  // the ANSI tenkeyless keyboard: [code, label, x, y, w, h]
  const K = [];
  const row = (y, x, keys) => { for (const k of keys) { if (typeof k === 'number') { x += k; continue; } const [code, label, w = 1, h = 1] = k; K.push([code, label, x, y, w, h]); x += w; } };
  row(0, 0, [['Escape', 'Esc'], 1, ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], 0.5, ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], 0.5, ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12'], 0.25, ['PrintScreen', 'PrtSc'], ['ScrollLock', 'ScrLk'], ['Pause', 'Pause']]);
  row(1.25, 0, [['Backquote', '`'], ...'1234567890'.split('').map((d) => ['Digit' + d, d]), ['Minus', '-'], ['Equal', '='], ['Backspace', '⌫', 2], 0.25, ['Insert', 'Ins'], ['Home', 'Home'], ['PageUp', 'PgUp']]);
  row(2.25, 0, [['Tab', 'Tab', 1.5], ...'QWERTYUIOP'.split('').map((c) => ['Key' + c, c]), ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5], 0.25, ['Delete', 'Del'], ['End', 'End'], ['PageDown', 'PgDn']]);
  row(3.25, 0, [['CapsLock', 'Caps', 1.75], ...'ASDFGHJKL'.split('').map((c) => ['Key' + c, c]), ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'Enter', 2.25]]);
  row(4.25, 0, [['ShiftLeft', 'Shift', 2.25], ...'ZXCVBNM'.split('').map((c) => ['Key' + c, c]), ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'Shift', 2.75], 1.25, ['ArrowUp', '↑']]);
  row(5.25, 0, [['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', 'Win', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 6.25], ['AltRight', 'Alt', 1.25], ['Fn', 'Fn', 1.25], ['ContextMenu', 'Menu', 1.25], ['ControlRight', 'Ctrl', 1.25], 0.25, ['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']]);
  // the number pad, for the full-size keyboard
  const NUMPAD = [];
  const np = (y, x, keys) => { for (const [code, label, w = 1, h = 1] of keys) { NUMPAD.push([code, label, x, y, w, h]); x += w; } };
  np(1.25, 18.5, [['NumLock', 'Num'], ['NumpadDivide', '/'], ['NumpadMultiply', '*'], ['NumpadSubtract', '-']]);
  np(2.25, 18.5, [['Numpad7', '7'], ['Numpad8', '8'], ['Numpad9', '9'], ['NumpadAdd', '+', 1, 2]]);
  np(3.25, 18.5, [['Numpad4', '4'], ['Numpad5', '5'], ['Numpad6', '6']]);
  np(4.25, 18.5, [['Numpad1', '1'], ['Numpad2', '2'], ['Numpad3', '3'], ['NumpadEnter', '⏎', 1, 2]]);
  np(5.25, 18.5, [['Numpad0', '0', 2], ['NumpadDecimal', '.']]);

  const byCode = new Map(K.map((k) => [k[0], k]));
  /** pick keys off the keyboard by code; { Space: 4 } trims a key's width */
  const pick = (codes, widths = {}) => codes.split(' ').map((c) => { const k = [...byCode.get(c)]; if (widths[c]) k[4] = widths[c]; return k; });
  const own = (keys) => keys.map(([code, label, x, y, w = 1, h = 1]) => [code, label, x, y, w, h]);
  const keyboard = (keys) => ({ kind: 'keys', keys });

  const OURS = [
    { id: 'game-keys', group: 'Keyboard', name: 'Game keys', licence: 'ours', ours: true, variants: [
      { name: 'FPS', drawn: keyboard(pick('Digit1 Digit2 Digit3 Digit4 Digit5 Tab KeyQ KeyW KeyE KeyR KeyT CapsLock KeyA KeyS KeyD KeyF KeyG ShiftLeft KeyZ KeyX KeyC KeyV KeyB ControlLeft AltLeft Space', { Space: 3.5 })) },
      { name: 'Hero shooter', drawn: keyboard(pick('Digit1 Digit2 Digit3 Tab KeyQ KeyW KeyE KeyR KeyA KeyS KeyD KeyF ShiftLeft KeyZ KeyX KeyC KeyV ControlLeft Space', { Space: 3.5, ControlLeft: 2.5 }).map((k) => (k[0] === 'Space' ? [k[0], k[1], 2.5, k[3], k[4], k[5]] : k))) },
      { name: 'WASD', drawn: keyboard(pick('KeyQ KeyW KeyE KeyA KeyS KeyD ShiftLeft ControlLeft Space', { Space: 2.75, ControlLeft: 1.25 }).map((k) => (k[0] === 'Space' ? [k[0], k[1], 1.25, k[3], 3.25, k[5]] : k))) },
      { name: 'MOBA', drawn: keyboard(pick('Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 KeyQ KeyW KeyE KeyR KeyA KeyS KeyD KeyF KeyB Space', { Space: 4 })) },
      { name: 'Arrows + Z X C', drawn: keyboard(own([['ShiftLeft', 'Shift', 0, 1, 1.5], ['KeyZ', 'Z', 1.5, 1], ['KeyX', 'X', 2.5, 1], ['KeyC', 'C', 3.5, 1], ['ArrowUp', '↑', 6, 0], ['ArrowLeft', '←', 5, 1], ['ArrowDown', '↓', 6, 1], ['ArrowRight', '→', 7, 1]])) },
      // pick: how many of its keys you can choose (the link's keys=, withKeys below)
      { name: 'Two big keys', pick: 2, drawn: keyboard(own([['KeyZ', 'Z', 0, 0, 1.75, 1.75], ['KeyX', 'X', 2, 0, 1.75, 1.75]])) },
    ] },
    { id: 'keyboard', group: 'Keyboard', name: 'Keyboard', licence: 'ours', ours: true, variants: [
      { name: 'No number pad', drawn: keyboard(K.map((k) => [...k])) },
      { name: 'Compact (60%)', drawn: keyboard(K.filter((k) => k[3] >= 1 && k[2] < 15).map((k) => (k[0] === 'ShiftRight' ? [k[0], k[1], k[2], k[3], 2.75, 1] : [...k]))) },
      { name: 'With number pad', drawn: keyboard(K.map((k) => [...k]).concat(NUMPAD)) },
      { name: 'Number pad', drawn: keyboard(NUMPAD.map((k) => [...k])) },
      // compact clusters, like input-overlay's WASD styles, drawn so every theme applies (letters too); after the
      // shipped four, as a link names a style by its number
      { name: 'Just W A S D', drawn: keyboard(pick('KeyW KeyA KeyS KeyD')) },
      { name: '+ Shift, Ctrl, Space', drawn: keyboard(pick('KeyQ KeyW KeyE KeyA KeyS KeyD ShiftLeft ControlLeft Space', { Space: 2.75, ControlLeft: 1.25 }).map((k) => (k[0] === 'Space' ? [k[0], k[1], 1.25, k[3], 3.25, k[5]] : k))) },
      { name: '+ Q, E', drawn: keyboard(pick('KeyQ KeyW KeyE KeyA KeyS KeyD')) },
      { name: '+ extras', drawn: keyboard(pick('Tab KeyQ KeyW KeyE KeyR KeyA KeyS KeyD KeyF ShiftLeft ControlLeft Space', { Space: 3.75, ControlLeft: 1.25 }).map((k) => (k[0] === 'Space' ? [k[0], k[1], 1.25, k[3], 3.75, k[5]] : k))) },
      { name: '+ arrows', drawn: keyboard(own([['KeyQ', 'Q', 0, 0], ['KeyW', 'W', 1, 0], ['KeyE', 'E', 2, 0], ['KeyA', 'A', 0.25, 1], ['KeyS', 'S', 1.25, 1], ['KeyD', 'D', 2.25, 1],
        ['ArrowUp', '↑', 5.5, 0], ['ArrowLeft', '←', 4.5, 1], ['ArrowDown', '↓', 5.5, 1], ['ArrowRight', '→', 6.5, 1]])) },
      { name: 'French (Z Q S D)', drawn: keyboard(own([['KeyQ', 'A', 0, 0], ['KeyW', 'Z', 1, 0], ['KeyE', 'E', 2, 0], ['KeyA', 'Q', 0.25, 1], ['KeyS', 'S', 1.25, 1], ['KeyD', 'D', 2.25, 1],
        ['ShiftLeft', 'Shift', -1.5, 2, 1.5], ['ControlLeft', 'Ctrl', -1.5, 3, 1.5], ['Space', '', 0.25, 3, 3]])) },
      { name: 'One key right (Y G H J)', drawn: keyboard(pick('KeyT KeyY KeyU KeyG KeyH KeyJ Space', { Space: 3 }).map((k) => (k[0] === 'Space' ? [k[0], k[1], 5, k[3], 3, k[5]] : k))) },
    ] },
    { id: 'game-mouse', group: 'Mouse', name: 'Gaming mouse', licence: 'ours', ours: true, variants: [
      { name: 'Just the buttons', drawn: { kind: 'mouse', move: false } },
      { name: 'With movement', drawn: { kind: 'mouse', move: true } },
    ] },
  ];
  /** a key's letter as our keyboards print it ('' when it isn't one of their keys) */
  const known = new Map([...K, ...NUMPAD].map((k) => [k[0], k[1] || 'Space']));
  const label = (code) => known.get(code) || '';
  /** a layout with its keys swapped for the chosen ones ('KeyA,KeyS'), in order; an unknown one keeps its own */
  const withKeys = (spec, keys) => {
    const codes = String(keys || '').split(',');
    return { ...spec, keys: spec.keys.map((k, i) => (label(codes[i]) ? [codes[i], label(codes[i]), ...k.slice(2)] : [...k])) };
  };
  window.IOOurs = { label, withKeys };
  window.IO_PRESETS.push(...OURS);   // after input-overlay's presets (the owner: WASD and Mouse are the defaults)
})();
