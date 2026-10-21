// The control panel's Inputty controls (part of panel.js; the dock does them, the index page only previews): Inputty's
// two sources, keyboard and controller, on the Game scenes. Which one shows, shown or hidden, and where: a spot and a
// size, inside the game (model.js, inputtyBox). Straight away, like the colour buttons: nothing waits for Review & apply.
// Once a spot is picked both sources go into every Game scene (the hidden one switched off), so switching is instant.
// P is the panel (panel.js): its settings (P.s), connections and the other parts.
(() => {
  window.TGLPanelParts = window.TGLPanelParts || {};
  window.TGLPanelParts.inputty = (P) => {
    const { M, obs, TAG } = P;
    const KIND = { kbm: 'inputty', pad: 'inputtypad' };
    // what a game capture can be (the one picked on the Layout tab first)
    const CAPTURES = ['game_capture', 'window_capture', 'monitor_capture', 'display_capture', 'screen_capture', 'macos_screen_capture', 'xcomposite_input', 'pipewire-screen-capture-source'];
    const state = () => P.s.dock.inputty;
    const gameRows = () => P.managedRows().filter((r) => r.kind === 'game' && !r.container.group);
    const widget = (kind) => obs.scan && obs.scan.widgets.find((w) => w.kind === kind && w.input.tag);
    const live = { running: false, note: '' };
    let again = false;

    /** what's on Game now, for the tab: each Game scene with the Inputty source showing there (or none) */
    function onGame() {
      return gameRows().map((r) => {
        const shown = Object.values(KIND).find((kind) => widget(kind)?.places.some((p) => p.container.uuid === r.container.uuid && p.item.sceneItemEnabled !== false));
        return { scene: r.sceneName, layout: P.layoutOf(r), shown: shown || '' };
      });
    }

    async function create(kind, r) {
      const w = M.WIDGETS[kind], [sw, sh] = M.sizeOf(kind, P.s);
      const names = new Set([...obs.scan.inputs.values()].map((i) => i.name).concat(obs.scan.scenes.map((x) => x.name)));
      let name = `Trongates · ${w.title}`, n = 2; while (names.has(name)) name = `Trongates · ${w.title} ${n++}`;
      await P.call('CreateInput', { sceneName: r.container.name, inputName: name, inputKind: 'browser_source', sceneItemEnabled: false,
        inputSettings: { url: P.widgetUrl(kind), width: sw, height: sh, fps_custom: true, fps: 30, shutdown: false, [TAG]: 'widget:' + kind } });
    }

    async function once() {
      const st = state(), rows = gameRows();
      if (!rows.length) { live.note = 'No Game scene with a Trongates overlay yet.'; return; }
      // 1. both sources in every Game scene, once a spot is picked
      if (st.at) for (const kind of Object.values(KIND)) for (const r of rows) {
        const w = widget(kind);
        if (w && w.places.some((p) => p.container.uuid === r.container.uuid)) continue;
        if (w) await P.call('CreateSceneItem', { sceneName: r.container.name, sourceUuid: w.input.uuid, sceneItemEnabled: false });
        else await create(kind, r);
        await P.rescan();
      }
      // 2. each: its size (what its link measured), its place, above the game, shown or not
      for (const kind of Object.values(KIND)) {
        const w = widget(kind); if (!w) continue;
        const [sw, sh] = M.sizeOf(kind, P.s);
        if (+w.input.settings.width !== sw || +w.input.settings.height !== sh) await P.call('SetInputSettings', { inputUuid: w.input.uuid, inputSettings: { width: sw, height: sh } });
        for (const r of rows) {
          const fresh = () => widget(kind)?.places.find((p) => p.container.uuid === r.container.uuid);
          let p = fresh(); if (!p) continue;
          const sceneName = r.container.name, sceneItemId = p.item.sceneItemId;
          if (st.at) {
            const want = M.inputtyBox(P.layoutOf(r), [sw, sh], st.at, st.size);
            if (!P.sameTransform(p.item.sceneItemTransform, want)) await P.call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: want });
          }
          // above the game capture (the picked one, else the top one), or the overlay in a scene without one
          const items = r.container.items, pick = P.s.dock.pick.capture[r.container.uuid];
          const under = items.find((i) => i.sourceName === pick) || items.filter((i) => CAPTURES.includes(i.inputKind)).pop() || r.item;
          const me = items.find((i) => i.sceneItemId === sceneItemId);
          if (me && under && me.sceneItemIndex < under.sceneItemIndex) {
            await P.call('SetSceneItemIndex', { sceneName, sceneItemId, sceneItemIndex: under.sceneItemIndex });
            await P.rescan(); p = fresh() || p;
          }
          const on = st.show && KIND[st.which] === kind;
          if ((p.item.sceneItemEnabled !== false) !== on) await P.call('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: on });
        }
      }
      live.note = '';
    }
    /** put OBS in step with the Inputty controls (one run at a time; a change during a run runs again after it) */
    async function apply() {
      if (!P.dock || obs.state !== 'connected' || !obs.scan) return;
      if (live.running) { again = true; return; }
      live.running = true; P.refresh();
      try { do { again = false; await once(); await P.rescan(); } while (again); }
      catch (e) { live.note = e.message; }
      finally { live.running = false; P.refresh(); }
    }
    /** a control pressed: which, show, at or size */
    function control(key, value) {
      const st = state();
      if (key === 'show') st.show = !st.show; else st[key] = value;
      P.save();
      apply();
    }

    return { inputtyLive: live, inputtyOnGame: onGame, inputtyApply: apply, inputtyControl: control, INPUTTY_KIND: KIND };
  };
})();
