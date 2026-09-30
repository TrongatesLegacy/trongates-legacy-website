// The control panel's OBS side (part of panel.js, dock only): connecting, finding the Trongates overlays in your
// scenes, what Review & apply would change and doing it, the shared chat, and the Sources tab's add buttons.
// P is the panel (panel.js): its settings (P.s), connections and the other parts.
(() => {
  window.TGLPanelParts = window.TGLPanelParts || {};
  window.TGLPanelParts.obs = (P) => {
    const { M, el, conn, obs, env, music, TAG, SHARED_NAME, read, write, obsCfg, newDock, fixDock } = P;
    const refresh = () => P.refresh(), save = () => P.save(), checkKey = () => P.checkKey();

    // ---------------------------------------------------------------- OBS: connect and scan
    function connectObs() {
      obs.client = TGLObs.connect({ port: +conn.port || 4455, password: conn.pw,
        onStatus: ({ state }) => { obs.state = state; if (state === 'connected') rescan(); refresh(); },
        onEvent: (type) => {
          if (/^(SceneItemCreated|SceneItemRemoved|SceneCreated|SceneRemoved|SceneNameChanged|InputCreated|InputRemoved|InputNameChanged|CurrentSceneCollectionChanged|SceneItemListReindexed|InputSettingsChanged|CurrentSceneTransitionChanged)$/.test(type)) {
            clearTimeout(obs.rescanTimer); obs.rescanTimer = setTimeout(rescan, 800);
          }
        } });
    }
    const call = (t, d) => obs.client.call(t, d);
    const reconnectObs = () => { if (obs.client) obs.client.close(); obs.client = null; obs.scan = null; obs.state = 'connecting'; connectObs(); refresh(); };
    // OBS's transitions: which Stingers are the Trongates ones (by name: …Derez…, …Shutter…), the current one and its
    // settings (OBS only shows the current one's), and each scene's override (undefined: this OBS can't say)
    async function readTransitions(scenes) {
      try {
        const list = await call('GetSceneTransitionList'), cur = await call('GetCurrentSceneTransition');
        const all = (list.transitions || []).map((t) => ({ name: t.transitionName, kind: t.transitionKind }));
        const stinger = (anim) => (all.find((t) => t.kind === 'obs_stinger_transition' && TGLTransition.pick(t.name) === anim) || {}).name || null;
        const overrides = {};
        for (const sc of scenes) {
          try { overrides[sc.uuid] = (await call('GetSceneSceneTransitionOverride', { sceneUuid: sc.uuid })).transitionName || null; }
          catch { overrides[sc.uuid] = undefined; }
        }
        return { current: list.currentSceneTransitionName, all, derez: stinger('derez'), shutters: stinger('shutters'),
          settings: cur.transitionName === list.currentSceneTransitionName ? cur.transitionSettings || {} : {}, overrides };
      } catch { return null; }
    }
    async function rescan() {
      if (!obs.client || !obs.client.ready || obs.busy) return;
      try {
        const { currentSceneCollectionName: col } = await call('GetSceneCollectionList');
        if (col !== obs.collection) switchCollection(col);
        const { scenes: list } = await call('GetSceneList');
        const scenes = [...list].sort((a, b) => b.sceneIndex - a.sceneIndex).map((x) => ({ uuid: x.sceneUuid, name: x.sceneName }));
        const containers = [], inputs = new Map(), sceneOf = new Map(scenes.map((x) => [x.name, x]));
        // every scene, and every group inside one, with its items (bottom → top)
        for (const sc of scenes) {
          const { sceneItems } = await call('GetSceneItemList', { sceneUuid: sc.uuid });
          containers.push({ uuid: sc.uuid, name: sc.name, scene: sc.name, group: false, items: sceneItems });
          for (const it of sceneItems) if (it.isGroup) {
            const { sceneItems: gi } = await call('GetGroupSceneItemList', { sceneName: it.sourceName });
            containers.push({ uuid: it.sourceUuid, name: it.sourceName, scene: sc.name, group: true, items: gi });
          }
        }
        for (const c of containers) for (const it of c.items) if (it.inputKind === 'browser_source' && !inputs.has(it.sourceUuid)) {
          const { inputSettings } = await call('GetInputSettings', { inputUuid: it.sourceUuid });
          inputs.set(it.sourceUuid, { uuid: it.sourceUuid, name: it.sourceName, settings: inputSettings, url: inputSettings.url || '', tag: inputSettings[TAG] || '' });
        }
        // which top-level scenes show a nested scene (for "shown in …")
        const shownIn = (name) => scenes.filter((sc) => containers.some((c) => c.scene === sc.name && !c.group && c.items.some((i) => i.sourceName === name && i.sourceType === 'OBS_SOURCE_TYPE_SCENE'))).map((x) => x.name);
        const rows = [], widgets = new Map();
        for (const c of containers) for (const it of c.items) {
          const inp = inputs.get(it.sourceUuid); if (!inp) continue;
          const r = M.recognise(inp.url);
          if (r && M.TYPES[r.kind] && !inp.tag) {
            rows.push({ id: `${c.uuid}:${it.sceneItemId}`, container: c, item: it, input: inp, kind: r.kind, layout: r.layout,
              sceneName: c.group ? c.scene : c.name, via: c.group ? `group ${c.name}` : '', shown: c.group ? [] : shownIn(c.name) });
          } else if (inp.tag || (r && !M.TYPES[r.kind])) {
            const w = widgets.get(inp.uuid) || { input: inp, kind: inp.tag === 'shared-chat' ? 'shared' : inp.tag ? inp.tag.replace('widget:', '') : r.kind, places: [] };
            w.places.push({ container: c, item: it });
            widgets.set(inp.uuid, w);
          }
        }
        const tx = await readTransitions(scenes);
        obs.scan = { scenes, containers, inputs, rows, widgets: [...widgets.values()], tx, at: Date.now() };
        // a collection with no saved settings: start from what its overlays already say (or an imported link)
        if (!read(P.storeKey)) {
          const pending = read('tgl-panel-pending');
          P.s = M.normalise(pending || M.fromUrls(rows.map((r) => r.input.url)));
          P.s.dock = newDock();
          try { localStorage.removeItem('tgl-panel-pending'); } catch {}
          write(P.storeKey, P.s); checkKey();
        }
        obs.error = '';
        placeSharedLive().catch(() => {});        // the crop for whatever's playing now (the first poll may beat the scan)
      } catch (e) { obs.error = e.message; }
      refresh();
    }
    function switchCollection(col) {
      obs.collection = col; P.storeKey = 'tgl-panel:' + col;
      const saved = read(P.storeKey), pending = read('tgl-panel-pending');
      if (saved && pending) {                     // a new settings link in the dock's address: it wins, once
        P.s = M.normalise(pending); P.s.dock = fixDock(saved.dock);
        try { localStorage.removeItem('tgl-panel-pending'); } catch {}
        write(P.storeKey, P.s); checkKey();
      } else if (saved) { P.s = M.normalise(saved); P.s.dock = fixDock(saved.dock); checkKey(); }
    }

    // ---------------------------------------------------------------- what Apply would change
    const managedRows = () => (obs.scan ? obs.scan.rows.filter((r) => (P.s.dock.map[r.container.uuid + ':' + r.item.sceneItemId] || 'manage') === 'manage') : []);
    const layoutOf = (r) => (r.kind === 'game' ? P.s.scenes.game.layout : 'full');
    const partOn = (r, p) => M.partsOf(r.kind, layoutOf(r)).includes(p) && !P.s.scenes[r.kind].off.includes(p);
    const optsFor = (kind, layout) => M.options(kind, P.s, { layout, env: env.links, obs: obsCfg() });
    const baseDir = () => { const r = managedRows()[0]; return r ? r.input.url.split('?')[0].replace(/[^/]*$/, '') : new URL('./', location.href).href; };
    const widgetUrl = (kind) => M.withOptions(baseDir() + M.WIDGETS[kind].file + (/\.html$/.test(managedRows()[0]?.input.url.split('?')[0] || '') ? '.html' : ''), optsFor(kind));
    const shared = () => obs.scan && obs.scan.widgets.find((w) => w.kind === 'shared');
    // the transition overlay: top-level scenes, and whether it goes in one (your pick; else yes in Trongates scenes)
    const TRANSITION_NAME = 'Trongates · Transition';
    const transitionScenes = () => (obs.scan ? obs.scan.scenes.map((sc) => obs.scan.containers.find((c) => c.uuid === sc.uuid && !c.group)).filter(Boolean) : []);
    const overlayIn = (c) => P.s.dock.tx.overlay[c.uuid] ?? managedRows().some((r) => r.sceneName === c.name);
    // scenes with a chat frame (plain scenes before groups, so the shared chat is created in a scene)
    const chatRows = () => managedRows().filter((r) => partOn(r, 'chat') && (r.kind !== 'game' || layoutOf(r) === 'window')).sort((a, b) => a.container.group - b.container.group);
    // where the shared chat goes in a row's scene: the frame's inner box, the top cropped (or scaled, on Game (window))
    function sharedTransform(r) {
      const b = M.chatBox(r.kind, P.s, music.visible !== false);
      if (b.w === M.SHARED_W) return { positionX: b.x, positionY: b.y, scaleX: 1, scaleY: 1, cropTop: M.SHARED_H - b.h, cropBottom: 0, cropLeft: 0, cropRight: 0, boundsType: 'OBS_BOUNDS_NONE', alignment: 5, rotation: 0 };
      const visH = Math.round(b.h * M.SHARED_W / b.w);
      return { positionX: b.x, positionY: b.y, cropTop: M.SHARED_H - visH, cropBottom: 0, cropLeft: 0, cropRight: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: b.w, boundsHeight: b.h, boundsAlignment: 5, alignment: 5, rotation: 0 };
    }
    const sameTransform = (t, want) => Object.entries(want).every(([k, v]) => (typeof v === 'number' ? Math.abs((t[k] ?? 0) - v) < (/^scale/.test(k) ? 0.005 : 0.6) : t[k] === v));
    const changes = (from, to) => {
      const q = (u) => new URLSearchParams((u.split('?')[1] || '').split('#')[0]);
      const a = q(from), b = q(to), out = [];
      const show = (k, v) => (['key', 'obspw'].includes(k) ? k : ['chat', 'goal'].includes(k) && v !== '0' ? k + ' link' : `${k}=${v}`);
      for (const [k, v] of b) if (a.get(k) !== v) out.push(show(k, v));
      for (const [k] of a) if (!b.has(k)) out.push('no ' + k);
      return out.join(', ');
    };
    // the shared chat's own browser settings
    const sharedSettings = (link) => ({ url: link, width: M.SHARED_W, height: M.SHARED_H, fps_custom: true, fps: 30, shutdown: false, [TAG]: 'shared-chat' });
    async function aboveOverlay(r, itemId) {
      const req = r.container.group ? 'GetGroupSceneItemList' : 'GetSceneItemList';
      const { sceneItems } = await call(req, r.container.group ? { sceneName: r.container.name } : { sceneUuid: r.container.uuid });
      const ov = sceneItems.find((i) => i.sceneItemId === r.item.sceneItemId), me = sceneItems.find((i) => i.sceneItemId === itemId);
      if (ov && me) await call('SetSceneItemIndex', { sceneName: r.container.name, sceneItemId: itemId, sceneItemIndex: ov.sceneItemIndex + (me.sceneItemIndex > ov.sceneItemIndex ? 1 : 0) });
    }
    // Each managed overlay's name: "Trongates · <scene type>" (Game (window) for the window layout), numbered when
    // there's more than one of a type. A name that's already right is kept; nothing takes a name OBS already has.
    const overlayTitle = (r) => (r.kind === 'game' && layoutOf(r) === 'window' ? 'Game (window)' : M.TYPES[r.kind].title);
    function overlayNames() {
      const rows = [], mine = new Set();
      for (const r of managedRows()) if (!mine.has(r.input.uuid)) { mine.add(r.input.uuid); rows.push(r); }
      const taken = new Set(obs.scan.scenes.map((x) => x.name));
      for (const c of obs.scan.containers) for (const it of c.items) if (!mine.has(it.sourceUuid)) taken.add(it.sourceName);
      for (const i of obs.scan.inputs.values()) if (!mine.has(i.uuid)) taken.add(i.name);
      const out = new Map(), base = (r) => `Trongates · ${overlayTitle(r)}`, fits = (r, n) => n === base(r) || new RegExp(`^${base(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`).test(n);
      for (const r of rows) if (fits(r, r.input.name) && !taken.has(r.input.name)) { out.set(r.input.uuid, r.input.name); taken.add(r.input.name); }
      for (const r of rows) {
        if (out.has(r.input.uuid)) continue;
        let name = base(r), n = 2; while (taken.has(name)) name = `${base(r)} ${n++}`;
        taken.add(name); out.set(r.input.uuid, name);
      }
      return out;
    }
    // the scenes with a Trongates scene overlay (for per-scene transitions)
    const txScenes = () => transitionScenes().filter((c) => managedRows().some((r) => r.sceneName === c.name));
    function plan() {
      /** @type {{ k: string, label: string, run?: () => any, reload?: string, input?: string, sec?: string }[]} */
      const acts = [];
      if (!obs.scan) return acts;
      // 1. the overlays' options, and their names (Trongates · <scene type>) unless that's turned off
      const seen = new Set();
      for (const r of managedRows()) {
        if (seen.has(r.input.uuid)) continue; seen.add(r.input.uuid);
        const want = M.withOptions(r.input.url, optsFor(r.kind, layoutOf(r)));
        if (!M.sameUrl(want, r.input.url)) acts.push({ k: 'update', input: r.input.uuid, label: `${r.sceneName} overlay (${r.input.name}): ${changes(r.input.url, want)}`, reload: r.input.name,
          run: () => call('SetInputSettings', { inputUuid: r.input.uuid, inputSettings: { url: want } }) });
      }
      if (P.s.dock.names !== false) for (const [uuid, name] of overlayNames()) {
        const inp = obs.scan.inputs.get(uuid);
        if (inp.name !== name) acts.push({ k: 'rename', input: uuid, label: `"${inp.name}" → "${name}"`, run: () => call('SetInputName', { inputUuid: uuid, newInputName: name }) });
      }
      // 2. the shared chat
      const link = M.linkFor(P.s, 'chat', env.links), sh = shared();
      if (P.s.shared && link) {
        const rows = chatRows();
        if (!sh && rows.length) {
          let made = null;                          // the new source, for the adds that follow in the same Apply
          acts.push({ k: 'create', label: `Browser source "${SHARED_NAME}" (your Botrix chat link, ${M.SHARED_W} × ${M.SHARED_H}, 30 fps) in ${rows[0].sceneName}, just above the overlay, in the chat frame`,
            run: async () => {
              const { sceneItemId, inputUuid } = await call('CreateInput', { sceneName: rows[0].container.name, inputName: SHARED_NAME, inputKind: 'browser_source', inputSettings: sharedSettings(link) });
              made = inputUuid;
              await aboveOverlay(rows[0], sceneItemId);
              await call('SetSceneItemTransform', { sceneName: rows[0].container.name, sceneItemId, sceneItemTransform: sharedTransform(rows[0]) });
              if (P.s.dock.lock) await call('SetSceneItemLocked', { sceneName: rows[0].container.name, sceneItemId, sceneItemLocked: true });
            } });
          for (const r of rows.slice(1)) acts.push({ k: 'add', label: `${SHARED_NAME} to ${r.sceneName}${r.via ? ' (' + r.via + ')' : ''}: just above the overlay, in the chat frame`,
            run: async () => {
              if (!made) throw new Error('the shared chat was not created');
              const { sceneItemId } = await call('CreateSceneItem', { sceneName: r.container.name, sourceUuid: made });
              await aboveOverlay(r, sceneItemId);
              await call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId, sceneItemTransform: sharedTransform(r) });
              if (P.s.dock.lock) await call('SetSceneItemLocked', { sceneName: r.container.name, sceneItemId, sceneItemLocked: true });
            } });
        } else if (sh) {
          const cur = sh.input.settings;
          if (cur.url !== link || cur.width !== M.SHARED_W || cur.height !== M.SHARED_H || !cur.fps_custom) acts.push({ k: 'update', label: `${sh.input.name}: ${cur.url !== link ? 'new Botrix link' : ''}${cur.width !== M.SHARED_W || cur.height !== M.SHARED_H ? ' size ' + M.SHARED_W + ' × ' + M.SHARED_H : ''}${!cur.fps_custom ? ' custom frame rate 30' : ''}`.replace(': ', ': ').trim(), reload: sh.input.name,
            run: () => call('SetInputSettings', { inputUuid: sh.input.uuid, inputSettings: sharedSettings(link) }) });
        }
        for (const r of rows) {
          const place = sh && sh.places.find((p) => p.container.uuid === r.container.uuid);
          if (sh && !place) acts.push({ k: 'add', label: `${sh.input.name} to ${r.sceneName}${r.via ? ' (' + r.via + ')' : ''}: just above the overlay, in the chat frame`,
            run: async () => {
              const { sceneItemId } = await call('CreateSceneItem', { sceneName: r.container.name, sourceUuid: sh.input.uuid });
              await aboveOverlay(r, sceneItemId);
              await call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId, sceneItemTransform: sharedTransform(r) });
              if (P.s.dock.lock) await call('SetSceneItemLocked', { sceneName: r.container.name, sceneItemId, sceneItemLocked: true });
            } });
          else if (place && !sameTransform(place.item.sceneItemTransform, sharedTransform(r))) acts.push({ k: 'place', label: `${sh.input.name} in ${r.sceneName}: fit the chat frame`,
            run: () => call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: place.item.sceneItemId, sceneItemTransform: sharedTransform(r) }) });
        }
      } else if (!P.s.shared && sh) {
        acts.push({ k: 'remove', label: `${sh.input.name}, from every scene`, run: () => call('RemoveInput', { inputUuid: sh.input.uuid }) });
      } else if (P.s.shared && !link) acts.push({ k: 'skip', label: 'Shared chat is on, but there is no Botrix chat link yet (Widgets: your key, or paste the link)' });
      // 3. widget sources the dock added or adopted: keep their options current
      if (obs.scan) for (const w of obs.scan.widgets) {
        if (!['chatbox', 'goal', 'music', 'bare', 'transition'].includes(w.kind) || !w.input.tag) continue;
        const want = M.withOptions(w.input.url, optsFor(w.kind));
        if (!M.sameUrl(want, w.input.url)) acts.push({ k: 'update', label: `${w.input.name}: ${changes(w.input.url, want)}`, reload: w.input.name,
          run: () => call('SetInputSettings', { inputUuid: w.input.uuid, inputSettings: { url: want } }) });
      }
      // 4. transitions (Scenes → Transitions): the overlay on top of the scenes picked, the default transition, each
      // scene's override, and the current Trongates Stinger cutting in the middle
      const T = P.s.dock.tx, tx = obs.scan.tx, txFrom = acts.length;
      if (T.on && tx) {
        const want = transitionScenes().filter((c) => overlayIn(c));
        const ov = obs.scan.widgets.find((w) => w.kind === 'transition' && w.input.tag);
        let made = null;
        if (!ov && want.length) acts.push({ k: 'create', label: `Browser source "${TRANSITION_NAME}" (1920 × 1080, invisible until a Trongates transition) on top of ${want[0].name}`,
          run: async () => {
            ({ inputUuid: made } = await call('CreateInput', { sceneName: want[0].name, inputName: TRANSITION_NAME, inputKind: 'browser_source',
              inputSettings: { url: widgetUrl('transition'), width: 1920, height: 1080, shutdown: false, [TAG]: 'widget:transition' } }));
          } });
        for (const c of want) {
          if (!ov && c === want[0]) continue;
          const place = ov && ov.places.find((p) => p.container.uuid === c.uuid);
          if (!place) acts.push({ k: 'add', label: `${TRANSITION_NAME} to ${c.name}, on top`, run: async () => {
            const uuid = ov ? ov.input.uuid : made; if (!uuid) throw new Error('the transition overlay was not created');
            await call('CreateSceneItem', { sceneName: c.name, sourceUuid: uuid });
          } });
          else if (place.item.sceneItemIndex !== Math.max(...c.items.map((i) => i.sceneItemIndex))) acts.push({ k: 'place', label: `${TRANSITION_NAME} in ${c.name}: back on top`,
            run: () => call('SetSceneItemIndex', { sceneName: c.name, sceneItemId: place.item.sceneItemId, sceneItemIndex: c.items.length - 1 }) });
        }
        if (ov) for (const p of ov.places) if (!p.container.group && !want.includes(p.container)) acts.push({ k: 'remove', label: `${TRANSITION_NAME} from ${p.container.name}`,
          run: () => call('RemoveSceneItem', { sceneName: p.container.name, sceneItemId: p.item.sceneItemId }) });
        const nameFor = (a) => (a === 'derez' ? tx.derez : a === 'shutters' ? tx.shutters : null), LABEL = { derez: 'Derez grid', shutters: 'Logo shutters' };
        if (T.default) {
          const n = nameFor(T.default);
          if (!n) acts.push({ k: 'skip', label: `Default transition ${LABEL[T.default]}: add its Stinger in OBS first (Scenes → Transitions → Set up)` });
          else if (tx.current !== n) acts.push({ k: 'update', label: `Default transition: ${n}`, run: () => call('SetCurrentSceneTransition', { transitionName: n }) });
        }
        for (const sc of txScenes()) {
          const choice = T.scenes[sc.name]; if (!choice) continue;                    // leave it as it is
          const n = choice === 'default' ? null : nameFor(choice);
          if (choice !== 'default' && !n) { acts.push({ k: 'skip', label: `${sc.name}: ${LABEL[choice]} isn't set up in OBS yet` }); continue; }
          if (tx.overrides[sc.uuid] === undefined) { acts.push({ k: 'skip', label: `${sc.name}: this OBS can't set a scene's transition over its WebSocket (right-click the scene → Transition Override)` }); continue; }
          if ((tx.overrides[sc.uuid] || null) !== n) acts.push({ k: 'update', label: `${sc.name}: ${n ? 'transition ' + n : 'the default transition'}`,
            run: () => call('SetSceneSceneTransitionOverride', { sceneUuid: sc.uuid, transitionName: n }) });
        }
        const curAnim = TGLTransition.pick(tx.current);
        if (curAnim && tx.current === nameFor(curAnim) && !(+tx.settings.transition_point === 600 && !+tx.settings.tp_type))
          acts.push({ k: 'update', label: `${tx.current}: cut at 600 ms, the middle of the hold video`,
            run: () => call('SetCurrentSceneTransitionSettings', { transitionSettings: { tp_type: 0, transition_point: 600 } }) });
      }
      for (const a of acts.slice(txFrom)) a.sec = 'tx';
      // 5. lock or unlock the dock's own items
      // (only where the dock put them: in Trongates scenes, or added from the Sources tab; not your own scenes)
      const ours = new Set(managedRows().map((r) => r.container.uuid));
      if (obs.scan) for (const w of obs.scan.widgets) if (w.input.tag) for (const p of w.places) if ((ours.has(p.container.uuid) || w.kind !== 'shared') && !!p.item.sceneItemLocked !== !!P.s.dock.lock)
        acts.push({ k: 'lock', label: `${P.s.dock.lock ? 'Lock' : 'Unlock'} ${w.input.name} in ${p.container.name}`, run: () => call('SetSceneItemLocked', { sceneName: p.container.name, sceneItemId: p.item.sceneItemId, sceneItemLocked: !!P.s.dock.lock }) });
      for (const a of acts) a.sec = a.sec || 'scenes';
      return acts;
    }
    const pendingCount = () => plan().filter((a) => a.k !== 'skip').length;
    // the shared chat follows the music straight away (it's live behaviour, not a setting)
    async function placeSharedLive() {
      const sh = shared(); if (!sh || !P.s.shared || !obs.client?.ready) return;
      for (const r of chatRows()) {
        if (r.kind === 'game' || !partOn(r, 'music')) continue;
        const place = sh.places.find((p) => p.container.uuid === r.container.uuid); if (!place) continue;
        const want = sharedTransform(r);
        if (!sameTransform(place.item.sceneItemTransform, want)) {
          await call('SetSceneItemTransform', { sceneName: r.container.name, sceneItemId: place.item.sceneItemId, sceneItemTransform: want });
          place.item.sceneItemTransform = { ...place.item.sceneItemTransform, ...want };
        }
      }
    }


    // ---------------------------------------------------------------- review & apply
    function review(title, acts) { P.reviewing = { title, acts }; refresh(); }
    async function runReview() {
      const acts = P.reviewing.acts.filter((a) => a.run);
      obs.busy = true; refresh();
      for (const [i, a] of acts.entries()) {
        const li = el.querySelector(`.review li[data-i="${P.reviewing.acts.indexOf(a)}"]`);
        try { await a.run(); li && li.classList.add('done'); }
        catch (e) { li && (li.classList.add('err'), li.append(' ✗ ' + e.message)); }
        if (i === acts.length - 1) break;
      }
      obs.busy = false; P.reviewing = null;
      await rescan();
    }

    // ---------------------------------------------------------------- Sources tab actions (immediate)
    async function currentScene() {
      try { const { studioModeEnabled } = await call('GetStudioModeEnabled'); if (studioModeEnabled) return (await call('GetCurrentPreviewScene')).sceneName; } catch {}
      return (await call('GetCurrentProgramScene')).sceneName;
    }
    async function addWidget(kind, sceneName, copy) {
      const w0 = M.WIDGETS[kind], [ww, wh] = M.sizeOf(kind, P.s), w = { ...w0, w: ww, h: wh }, existing = !copy && obs.scan.widgets.find((x) => x.kind === (kind === 'bare' ? 'shared' : kind) && x.input.tag);
      const container = obs.scan.containers.find((c) => c.name === sceneName && !c.group);
      const ov = managedRows().find((r) => r.container.name === sceneName);
      let itemId;
      if (kind === 'bare' && !copy) { P.s.shared = true; save(); return review('Shared chat', plan()); }
      if (existing) ({ sceneItemId: itemId } = await call('CreateSceneItem', { sceneName, sourceUuid: existing.input.uuid }));
      else {
        const names = new Set([...obs.scan.inputs.values()].map((i) => i.name).concat(obs.scan.scenes.map((x) => x.name)));
        let name = `Trongates · ${w.title}`, n = 2; while (names.has(name)) name = `Trongates · ${w.title} ${n++}`;
        ({ sceneItemId: itemId } = await call('CreateInput', { sceneName, inputName: name, inputKind: 'browser_source',
          inputSettings: { url: widgetUrl(kind), width: w.w, height: w.h, fps_custom: true, fps: 30, shutdown: false, [TAG]: 'widget:' + kind } }));
        await call('SetSceneItemTransform', { sceneName, sceneItemId: itemId, sceneItemTransform: { positionX: Math.round((1920 - w.w) / 2), positionY: Math.round((1080 - w.h) / 2), alignment: 5 } });
      }
      if (ov && container) await aboveOverlay(ov, itemId);
      await rescan();
    }
    async function tagInput(inp, tag) { await call('SetInputSettings', { inputUuid: inp.uuid, inputSettings: { [TAG]: tag } }); await rescan(); }

    return { connectObs, call, reconnectObs, rescan, managedRows, layoutOf, partOn, optsFor, widgetUrl, shared, chatRows, sharedTransform, sameTransform, plan, pendingCount, placeSharedLive, review, runReview, currentScene, addWidget, tagInput, transitionScenes, overlayIn, txScenes };
  };
})();
