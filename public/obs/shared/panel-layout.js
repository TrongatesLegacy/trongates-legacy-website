// The control panel's Layout tab logic (part of panel.js, dock only): where Tidy puts the game capture and veadotube,
// measuring the avatar, and the checks that list what isn't in place.
// P is the panel (panel.js): its settings (P.s), connections and the other parts.
(() => {
  window.TGLPanelParts = window.TGLPanelParts || {};
  window.TGLPanelParts.layout = (P) => {
    const { dock, veado } = P;
    const refresh = () => P.refresh(), save = () => P.save();
    const call = (t, d) => P.call(t, d), managedRows = () => P.managedRows(), layoutOf = (r) => P.layoutOf(r), sameTransform = (t, w) => P.sameTransform(t, w);
    const shared = () => P.shared(), chatRows = () => P.chatRows(), sharedTransform = (r) => P.sharedTransform(r);

    // ---------------------------------------------------------------- layout (tidy)
    const CAPTURE = { positionX: 28, positionY: 92, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: 1408, boundsHeight: 792, boundsAlignment: 0, alignment: 5, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0, rotation: 0 };
    const VEADO_BOX = { chatting: [760, 174, 980, 880], game: [1470, 530, 440, 534] };
    const veadoTransform = (kind) => { const [x, y, w, h] = VEADO_BOX[kind]; return { positionX: x, positionY: y, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: w, boundsHeight: h, boundsAlignment: 0, alignment: 5, rotation: 0 }; };
    // Measured (Layout → Measure avatar): scale veadotube's canvas so the avatar's resting outline is the chosen
    // height and stand that outline on the veadotube space's bottom line, centred; above that it may overlap the chat.
    // Nothing is cropped: the canvas is transparent round the avatar, and anything that moves beyond the resting
    // outline (a swinging rod, a bounce) has to stay visible.
    // Not measured: the whole canvas fitted into the box (small, as veadotube's canvas is mostly empty).
    function avatarFit(kind, it) {
      const av = P.s.dock.avatar || {}; const [bx, by, bw, bh] = VEADO_BOX[kind];
      if (!av.bounds) return veadoTransform(kind);
      const t = it.sceneItemTransform, sw = t.sourceWidth || av.canvas.w, sh = t.sourceHeight || av.canvas.h;
      const [l, top, r, b] = av.bounds, H = +av[kind] || (kind === 'game' ? 580 : 880);
      const vw = (r - l) * sw, vh = (b - top) * sh, k = H / vh;
      return { boundsType: 'OBS_BOUNDS_NONE', alignment: 5, rotation: 0, scaleX: +k.toFixed(4), scaleY: +k.toFixed(4),
        cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0,
        positionX: Math.round(bx + bw / 2 - (l * sw + vw / 2) * k), positionY: Math.round(by + bh - b * sh * k) };
    }
    const measure = { running: false, note: '' };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // the visible (non-transparent) box of a screenshot, as fractions of it: [left, top, right, bottom]
    const alphaBox = (dataUrl) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let l = c.width, t = c.height, r = -1, b = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
        ok(r < 0 ? null : [l / c.width, t / c.height, (r + 1) / c.width, (b + 1) / c.height]);
      };
      img.onerror = () => ok(null); img.src = dataUrl;
    });
    const median = (xs) => { const a = [...xs].sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
    // Step veadotube through every state, a few small screenshots each, and keep each state's resting outline
    // (the median of the frames, so talking / blinking / bounce frames don't count); the avatar's outline is all of
    // those together. Only runs when asked: nothing is sampled during a stream.
    async function measureAvatar() {
      const row = managedRows().find((r) => P.s.dock.pick.veado[r.container.uuid]);
      const src = row && P.s.dock.pick.veado[row.container.uuid], item = row && row.container.items.find((i) => i.sourceName === src);
      if (!item) throw new Error('Pick your veadotube source first (above).');
      if (!veado.ready || !veado.states.length) throw new Error('veadotube isn\'t connected.');
      const sw = item.sceneItemTransform.sourceWidth, sh = item.sceneItemTransform.sourceHeight;
      if (!sw || !sh) throw new Error(`${src} has no picture (is veadotube sending to Spout?)`);
      const W = 240, H = Math.max(1, Math.round((W * sh) / sw)), back = veado.states.find((x) => x.name === veado.current);
      const setState = (st) => veado.setState(st.id);
      const per = [];
      measure.running = true;
      try {
        for (const [i, st] of veado.states.entries()) {
          measure.note = `Measuring ${st.name} (${i + 1} of ${veado.states.length})…`; refresh();
          setState(st); await sleep(1100);
          const boxes = [];
          for (let n = 0; n < 5; n++) {
            const { imageData } = await call('GetSourceScreenshot', { sourceName: src, imageFormat: 'png', imageWidth: W, imageHeight: H });
            const bx = await alphaBox(imageData); if (bx) boxes.push(bx);
            await sleep(180);
          }
          if (boxes.length) per.push({ name: st.name, box: [0, 1, 2, 3].map((k) => median(boxes.map((x) => x[k]))) });
        }
      } finally {
        if (back) setState(back);
        measure.running = false;
      }
      if (!per.length) throw new Error(`${src} looked empty in every state (is veadotube sending to Spout?)`);
      const u = [Math.min(...per.map((p) => p.box[0])), Math.min(...per.map((p) => p.box[1])), Math.max(...per.map((p) => p.box[2])), Math.max(...per.map((p) => p.box[3]))];
      P.s.dock.avatar = { ...P.s.dock.avatar, bounds: u.map((v) => +v.toFixed(4)), canvas: { w: sw, h: sh }, at: new Date().toISOString(), states: per.map((p) => p.name) };
      measure.note = `Measured ${per.length} state${per.length === 1 ? '' : 's'}: the avatar takes ${Math.round((u[2] - u[0]) * 100)}% × ${Math.round((u[3] - u[1]) * 100)}% of the ${sw} × ${sh} canvas.`;
      save();
    }
    const FULL = { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0, alignment: 5 };
    function checks() {
      const out = [];
      for (const r of managedRows()) {
        const st = r.input.settings, where = r.sceneName;
        if (!st.fps_custom || +st.fps !== 30) out.push({ where, what: `${r.input.name}: frame rate`, state: 'custom frame rate off', fix: { k: 'update', label: `${r.input.name}: custom frame rate 30, 1920 × 1080`, run: () => call('SetInputSettings', { inputUuid: r.input.uuid, inputSettings: { fps_custom: true, fps: 30, width: 1920, height: 1080 } }) } });
        else if (+st.width !== 1920 || +st.height !== 1080) out.push({ where, what: `${r.input.name}: size`, state: `${st.width} × ${st.height}`, fix: { k: 'update', label: `${r.input.name}: 1920 × 1080`, run: () => call('SetInputSettings', { inputUuid: r.input.uuid, inputSettings: { width: 1920, height: 1080 } }) } });
        const t = r.item.sceneItemTransform;
        if (t && !(t.boundsType === 'OBS_BOUNDS_NONE' ? sameTransform(t, FULL) : Math.abs(t.positionX) < 1 && Math.abs(t.positionY) < 1 && Math.abs(t.boundsWidth - 1920) < 1))
          out.push({ where, what: `${r.input.name}: position`, state: 'not filling the canvas', fix: { k: 'place', label: `${r.input.name} in ${where}: fill the canvas`, run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: r.item.sceneItemId, sceneItemTransform: { ...FULL, boundsType: 'OBS_BOUNDS_NONE' } }) } });
        // your own sources, only if picked
        const pickC = P.s.dock.pick.capture[r.container.uuid], pickV = P.s.dock.pick.veado[r.container.uuid];
        if (r.kind === 'game' && layoutOf(r) === 'window' && pickC) {
          const it = r.container.items.find((i) => i.sourceName === pickC);
          if (!it) out.push({ where, what: pickC, state: 'not found (renamed or removed?): pick again', bad: true });
          else if (!sameTransform(it.sceneItemTransform, CAPTURE)) out.push({ where, what: pickC, state: 'not in the game window', fix: { k: 'place', label: `${pickC} in ${where}: the 1408 × 792 window (X 28, Y 92)`, run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: it.sceneItemId, sceneItemTransform: CAPTURE }) } });
          else out.push({ where, what: pickC, state: 'in place', good: true });
        }
        if ((r.kind === 'chatting' || (r.kind === 'game' && layoutOf(r) === 'window')) && pickV) {
          const it = r.container.items.find((i) => i.sourceName === pickV);
          const av = P.s.dock.avatar || {}, t = it && it.sceneItemTransform;
          if (!it) out.push({ where, what: pickV, state: 'not found: pick again', bad: true });
          else if (av.bounds && av.canvas && (t.sourceWidth !== av.canvas.w || t.sourceHeight !== av.canvas.h))
            out.push({ where, what: pickV, state: `veadotube's window size changed (${t.sourceWidth} × ${t.sourceHeight}): measure again`, bad: true });
          else {
            const want = avatarFit(r.kind, it), size = av.bounds ? `${av[r.kind === 'game' ? 'game' : 'chatting']}px tall, feet on the bottom line` : 'the whole canvas in the box (measure the avatar for a better fit)';
            if (!sameTransform(t, want)) out.push({ where, what: pickV, state: av.bounds ? 'not at the measured size' : 'not in the veadotube space', fix: { k: 'place', label: `${pickV} in ${where}: ${size}`, run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: it.sceneItemId, sceneItemTransform: want }) } });
            else out.push({ where, what: pickV, state: 'in place', good: true });
          }
        }
      }
      const sh = shared();
      if (sh && P.s.shared) for (const r of chatRows()) {
        const p = sh.places.find((x) => x.container.uuid === r.container.uuid);
        out.push({ where: r.sceneName, what: sh.input.name, state: !p ? 'not added yet (Review & apply)' : sameTransform(p.item.sceneItemTransform, sharedTransform(r)) ? 'in place' : 'will be fitted on apply', good: p && sameTransform(p.item.sceneItemTransform, sharedTransform(r)) });
      }
      return out;
    }


    const unmeasured = () => {
      const av = P.s.dock.avatar || {};
      if (!dock || !av.bounds || !veado.states.length || !managedRows().some((r) => P.s.dock.pick.veado[r.container.uuid])) return [];
      return veado.states.map((x) => x.name).filter((n) => !(av.states || []).includes(n));
    };

    return { CAPTURE, VEADO_BOX, avatarFit, measure, measureAvatar, checks, unmeasured };
  };
})();
