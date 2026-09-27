// The control panel's drawing (part of panel.js): the header, each tab, the footer and the review sheet, as HTML.
// P is the panel (panel.js): its settings (P.s), connections and the other parts.
(() => {
  window.TGLPanelParts = window.TGLPanelParts || {};
  window.TGLPanelParts.tabs = (P) => {
    const { M, TGL, dock, conn, obs, env, music, veado, esc, SHORT, FORM_KEYS } = P;
    const formFor = (n) => veado.formFor(n), pendingCount = () => P.pendingCount(), unmeasured = () => P.unmeasured(), measure = P.measure;
    const managedRows = () => P.managedRows(), layoutOf = (r) => P.layoutOf(r), shared = () => P.shared(), checks = () => P.checks();

    // ---------------------------------------------------------------- rendering
    const dot = (st) => `<i class="dot ${st === 'ok' || st === 'connected' ? 'ok' : st === 'warn' || st === 'connecting' ? 'warn' : st === 'off' ? '' : 'bad'}"></i>`;
    const tog = (path, on, extra = '') => `<input type="checkbox" class="tog" data-set="${path}" ${on ? 'checked' : ''} ${extra}>`;
    const TABS = dock ? ['live', 'scenes', 'sources', 'widgets', 'layout'] : ['live', 'scenes', 'widgets'];
    function head() {
      const pc = dock ? pendingCount() : 0;
      return `<div class="hd"><b>${dock ? 'Trongates' : 'Settings'}</b>${dock ? `<div class="pills"><span class="pill">${dot(obs.state)}OBS</span><span class="pill">${dot(veado.state)}veado</span><span class="pill">${dot(music.state)}music</span></div>` : ''}</div>
        <div class="tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" data-tab="${t}" aria-selected="${t === P.tab}">${t}${t === 'scenes' && pc ? `<i>${pc}</i>` : ''}${t === 'layout' && dock && unmeasured().length ? '<i>!</i>' : ''}</button>`).join('')}</div>`;
    }
    function formButtons() {
      const form = TGL.form, onAnim = String(veado.current || '').toLowerCase() === 'animated';
      const showAnim = dock && P.s.veado.switch && veado.states.some((x) => x.name.toLowerCase() === 'animated');
      const b = (f, label, state) => `<button type="button" style="--c:${TGL.FORMS[f].accent}" data-form="${f}" ${state ? `data-state="${state}"` : ''} aria-pressed="${form === f && (!showAnim || f !== 'cyan' || (state === 'animated') === onAnim)}">${label}</button>`;
      return `<div class="forms">${b('cyan', 'Tron')}${showAnim ? b('cyan', 'Tron<br>animated', 'animated') : ''}${FORM_KEYS.slice(1).map((f) => b(f, SHORT[f])).join('')}</div>`;
    }
    // veadotube states the avatar measurement doesn't know yet (only matters once it's measured and in use)
    const measurePrompt = () => {
      const u = unmeasured();
      return u.length ? `<div class="card" style="border-color:var(--warn)"><span class="warn">${u.length === 1 ? 'A veadotube state isn\'t' : `${u.length} veadotube states aren't`} measured yet: ${esc(u.join(', '))}.</span><span class="hint">Measure the avatar again (before going live) so switching to ${u.length === 1 ? 'it' : 'them'} can't make it the wrong size.</span><button type="button" class="btn" data-act="measure" ${measure.running || veado.state !== 'ok' ? 'disabled' : ''}>${measure.running ? 'Measuring…' : 'Measure avatar'}</button></div>` : '';
    };
    function tabLive() {
      if (!dock) return `<h3>Colour</h3>${formButtons()}<p class="hint">Sets the colour the previews are shown in. In OBS, the dock's buttons switch veadotube too.</p>`;
      const t = music.track;
      const paused = TGL.breaker.tripped ? '<p class="hint warn">Colours came in too fast (over 10 in 2 s), so this dock is ignoring colours from the scenes for a moment; your buttons and veadotube still work. If it keeps happening, use the rescue dock (obs/README.md) and tell Claude.</p>' : '';
      return `${measurePrompt()}${paused}<h3>Avatar &amp; colour</h3>${formButtons()}
        <p class="hint">${P.s.veado.switch && veado.state === 'ok' ? 'Switches veadotube; every scene follows once it has switched.' : 'Recolours every scene.'}</p>
        ${veado.states.length ? `<h3>veadotube states</h3><div class="states">${veado.states.map((x) => {
          const f = formFor(x.name), pinned = P.s.veado.map[x.name.toLowerCase()] || '';
          return `<div class="st ${x.name === veado.current ? 'on' : ''}" style="--c:${TGL.FORMS[f].accent}"><span>${esc(x.name)}</span><select data-map="${esc(x.name.toLowerCase())}" aria-label="Colour for ${esc(x.name)}"><option value="">auto (${SHORT[TGL.formForState(x.name)]})</option>${FORM_KEYS.map((k) => `<option value="${k}" ${pinned === k ? 'selected' : ''}>${SHORT[k]}</option>`).join('')}</select></div>`;
        }).join('')}</div>` : ''}
        <h3>Now playing</h3>
        <div class="card">${t ? `<div class="np">${t.art ? `<img src="${esc(t.art)}" alt="">` : '<span class="art"></span>'}<div class="grow"><b>${esc(t.title)}</b><small>${esc(t.artist || '')} · ${esc((t.app || '').split(/[_!.]/)[0])}</small></div><small class="${t.playing ? 'ok' : 'muted'}">${t.playing ? 'playing' : 'paused'}</small></div>` : `<span class="muted">${music.state === 'ok' ? 'Nothing playing.' : 'SMTC Bridge not reachable (Windows only).'}</span>`}</div>
        <h3>Connections</h3>
        <div class="card" style="gap:4px">
          <div class="row">${dot(obs.state)}<span class="grow">OBS WebSocket</span><span class="muted">${esc(obs.state === 'connected' ? '127.0.0.1:' + (conn.port || 4455) : obs.state)}</span></div>
          <div class="row">${dot(veado.state)}<span class="grow">veadotube mini</span><span class="muted">${esc(P.s.veado.addr || M.VEADO_DEFAULT)}</span></div>
          <div class="row">${dot(music.state)}<span class="grow">SMTC Bridge</span><span class="muted">${esc(P.s.music.host || M.BRIDGE_DEFAULT)}</span></div>
          <div class="row">${dot(M.pasted(P.s, 'chat') ? 'ok' : env.state)}<span class="grow">Botrix links</span><span class="muted">${esc(M.pasted(P.s, 'chat') || M.pasted(P.s, 'goal') ? 'pasted' : env.text || 'no key')}</span></div>
        </div>
        ${obs.state === 'wrong password' ? '<p class="hint bad">OBS rejected the password: check it on Widgets → OBS WebSocket.</p>' : ''}`;
    }
    function chips(kind, layout) {
      const sc = P.s.scenes[kind], parts = M.partsOf(kind, layout || (kind === 'game' ? (dock ? P.s.scenes.game.layout : 'window') : 'full'));
      const out = parts.map((p) => `<button type="button" class="chip ${p === 'chat' && P.s.shared ? 'shared' : ''}" data-part="${kind}:${p}" aria-pressed="${!sc.off.includes(p)}">${M.PARTS[p]}${p === 'chat' && P.s.shared ? ' (shared)' : ''}</button>`);
      if (M.TYPES[kind].cycling) out.push(`<button type="button" class="chip" data-flag="${kind}:cycle" aria-pressed="${sc.cycle}">Cycles forms</button>`);
      if (M.TYPES[kind].follows) out.push(`<button type="button" class="chip" data-flag="${kind}:follow" aria-pressed="${sc.follow}">Follows veadotube</button>`);
      if (kind === 'game' && (layout || (dock ? P.s.scenes.game.layout : 'window')) === 'window') out.push(`<button type="button" class="chip" data-flag="game:rings" aria-pressed="${!!sc.rings}" title="The stage's animated rings behind veadotube">Rings</button>`);
      return `<div class="chips">${out.join('')}</div>`;
    }
    const grows = (kind) => {
      const sc = P.s.scenes[kind]; if (!M.TYPES[kind].column) return '';
      const g = [sc.off.includes('goal') && 'goal', sc.off.includes('music') && 'now playing'].filter(Boolean);
      return g.length ? `<p class="hint warn">${g.join(' and ')} off: the chat grows into the room.</p>` : '';
    };
    function tabScenes() {
      if (!dock) return `<p class="hint">Tap a part to turn it off in the previews and the copied addresses.</p>${Object.keys(M.TYPES).map((k) => `<div class="scene"><div class="t"><b>${M.TYPES[k].title}</b>${k === 'game' ? '<span class="muted">(chat, goal, now playing and rings: the window layout)</span>' : ''}</div>${chips(k)}${grows(k)}</div>`).join('')}`;
      if (obs.state !== 'connected') return `<p class="hint">Not connected to OBS (${esc(obs.state)}). Turn on Tools → WebSocket Server Settings, and give this dock's URL <code>?obs=4455&amp;obspw=…</code>.</p>`;
      if (!obs.scan) return '<p class="hint">Looking through your scenes…</p>';
      const rows = obs.scan.rows, ignored = obs.scan.scenes.filter((x) => !rows.some((r) => r.sceneName === x.name) && !obs.scan.containers.some((c) => c.group && c.name === x.name));
      return `<div class="row"><span class="grow hint">Found by each scene's Trongates overlay. Tap a part to turn it off; nothing changes in OBS before Review &amp; apply.</span><button type="button" class="btn small" data-act="rescan">Rescan</button></div>
        ${rows.length ? rows.map((r) => {
          const key = r.container.uuid + ':' + r.item.sceneItemId, managed = (P.s.dock.map[key] || 'manage') === 'manage';
          return `<div class="scene"><div class="t"><b>${esc(r.sceneName)}</b><span class="muted">→</span>
            <select data-row="${key}"><option value="manage" ${managed ? 'selected' : ''}>${M.TYPES[r.kind].title}</option><option value="none" ${managed ? '' : 'selected'}>Don't manage</option></select>
            ${r.kind === 'game' && managed ? `<select data-set="scenes.game.layout"><option value="full" ${layoutOf(r) === 'full' ? 'selected' : ''}>full screen</option><option value="window" ${layoutOf(r) === 'window' ? 'selected' : ''}>window</option></select>` : ''}
            <button type="button" class="btn small" data-refresh="${r.input.uuid}" title="Reload this overlay">↻</button></div>
            ${r.via || r.shown.length ? `<span class="hint">${esc([r.via && 'in ' + r.via, r.shown.length && 'shown in ' + r.shown.join(', ')].filter(Boolean).join(' · '))}</span>` : ''}
            ${managed ? chips(r.kind, layoutOf(r)) + grows(r.kind) : ''}</div>`;
        }).join('') : '<p class="hint warn">No Trongates overlays found. Add a browser source with a …/obs/ address (the index\'s Copy buttons), then Rescan.</p>'}
        ${ignored.length ? `<p class="hint">Not Trongates (left alone): ${esc(ignored.map((x) => x.name).join(', '))}</p>` : ''}
        <div class="row"><button type="button" class="btn small grow" data-act="refresh-all">Reload all Trongates sources</button></div>`;
    }
    function tabSources() {
      if (obs.state !== 'connected' || !obs.scan) return '<p class="hint">Connect to OBS first (Live → Connections).</p>';
      const sceneOpts = obs.scan.scenes.map((x) => `<option ${x.name === obs.target ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
      const card = (kind) => {
        const w = M.WIDGETS[kind], mine = obs.scan.widgets.filter((x) => (kind === 'bare' ? x.kind === 'shared' : x.kind === kind) && x.input.tag);
        const places = [...new Set(mine.flatMap((x) => x.places.map((p) => p.container.name)))];
        const size = kind === 'bare' ? `${M.SHARED_W} × ${M.SHARED_H}` : `${w.w} × ${w.h}`;
        const title = kind === 'bare' ? 'Shared chat' : w.title;
        return `<div class="scene"><div class="t"><b class="grow">${title}</b><span class="muted">${kind === 'bare' ? 'raw Botrix · ' : kind === 'music' ? '' : 'framed · '}${size}</span></div>
          <span class="hint">${places.length ? 'In ' + esc(places.join(', ')) : 'Not in any scene'}</span>
          <div class="row">${mine.length ? `<button type="button" class="btn grow" data-add="${kind}">Add existing</button><button type="button" class="btn" data-add="${kind}" data-copy="1" ${kind === 'bare' ? 'disabled' : ''}>New copy</button>` : `<button type="button" class="btn solid grow" data-add="${kind}">${kind === 'bare' ? 'Set up shared chat…' : 'Add to scene'}</button>`}</div></div>`;
      };
      const found = obs.scan.widgets.filter((x) => !x.input.tag && !(P.s.dock.ignore || []).includes(x.input.uuid) && ['botrix-chat', 'chatbox', 'goal', 'music', 'bare'].includes(x.kind));
      return `<div class="row"><span class="grow">Add to</span><select data-target>${sceneOpts}</select></div>
        ${['bare', 'chatbox', 'goal', 'music'].map(card).join('')}
        ${found.length ? `<h3>Found, not managed</h3>${found.map((x) => `<div class="scene"><div class="t"><b class="grow">${esc(x.input.name)}</b><span class="muted">${x.kind === 'botrix-chat' ? 'raw Botrix chat' : esc(M.WIDGETS[x.kind] ? M.WIDGETS[x.kind].title : x.kind)} · ${esc([...new Set(x.places.map((p) => p.container.name))].join(', '))}</span></div>
          <div class="row">${['botrix-chat', 'bare'].includes(x.kind) && !shared() ? `<button type="button" class="btn grow" data-tag="${x.input.uuid}" data-tagv="shared-chat">Use as shared chat</button>` : ''}${x.kind !== 'botrix-chat' ? `<button type="button" class="btn grow" data-tag="${x.input.uuid}" data-tagv="widget:${x.kind}">Adopt</button>` : ''}<button type="button" class="btn red" data-ignore="${x.input.uuid}">Ignore</button></div></div>`).join('')}` : ''}
        <p class="hint">Adding happens straight away, just above the scene's overlay (or at the top of a scene without one), centred. After that it's yours to move; settings changes reach it through Review &amp; apply.</p>`;
    }
    function tabWidgets() {
      const pasted = (P.s.linksMode || (M.isLink(P.s.links.chat) || M.isLink(P.s.links.goal) ? 'paste' : 'key')) === 'paste';
      const sh = dock && shared();
      return `<h3>OBS WebSocket</h3>
        <div class="row"><label class="field grow">Port<input type="number" min="1" max="65535" data-conn="port" value="${esc(conn.port)}" placeholder="4455"></label>
          <label class="field grow">Password<input type="password" data-conn="pw" value="${esc(conn.pw)}" autocomplete="off" placeholder="${dock ? 'none' : 'optional'}"></label></div>
        <span class="hint ${dock ? (obs.state === 'connected' ? 'ok' : obs.state === 'wrong password' ? 'bad' : '') : ''}">${dock
          ? (obs.state === 'connected' ? 'Connected.' : obs.state === 'wrong password' ? 'Wrong password.' : 'OBS → Tools → WebSocket Server Settings: enable it; the port and password are there.') + ' Kept for every scene collection.'
          : 'From OBS → Tools → WebSocket Server Settings. Goes into the dock address (and the scene addresses you copy).'}</span>
        <h3>Botrix</h3>
        <div class="row"><span class="grow">Links from</span><select data-set="linksMode"><option value="key" ${pasted ? '' : 'selected'}>Netlify key</option><option value="paste" ${pasted ? 'selected' : ''}>Pasted links</option></select></div>
        ${pasted ? `<label class="field">Chat widget link<input type="password" data-set="links.chat" value="${esc(P.s.links.chat)}" placeholder="https://botrix.live/widgets/chat/?bid=…" autocomplete="off"></label>
          <label class="field">Follower goal link<input type="password" data-set="links.goal" value="${esc(P.s.links.goal)}" placeholder="https://botrix.live/widgets/…" autocomplete="off"></label>`
        : `<label class="field">Netlify key (OBS_KEY)<input type="password" data-set="key" value="${esc(P.s.key)}" autocomplete="off"></label>
          <span class="hint ${env.state === 'ok' ? 'ok' : env.state === 'off' ? '' : 'bad'}">${esc(env.text || (P.s.key ? 'checking…' : 'Links kept in Netlify: BOTRIX_CHAT_URL, BOTRIX_GOAL_URL.'))}</span>`}
        <div class="card"><div class="row"><b class="grow">Shared chat</b>${tog('shared', P.s.shared)}</div>
          <span class="hint">One chat source in every scene, so they all show the same messages; the scenes stop loading their own.${sh ? ` <span class="ok">In ${sh.places.length} scene${sh.places.length === 1 ? '' : 's'}.</span>` : ''}</span>
          ${dock ? `<div class="row"><button type="button" class="btn grow" data-act="shared-now" ${obs.state === 'connected' ? '' : 'disabled'}>${sh ? 'Update now' : 'Set up now'}</button>${sh ? '<button type="button" class="btn red" data-act="shared-remove">Remove</button>' : ''}</div>` : '<span class="hint">In OBS, the dock creates and places it; by hand see obs/README.md.</span>'}</div>
        <div class="row"><span class="grow">Goal follows the scene colour</span>${tog('goalColor', P.s.goalColor)}</div>
        <h3>Now playing</h3>
        <label class="field">Music app (blank: whatever Windows has in focus)<input type="text" data-set="music.app" value="${esc(P.s.music.app)}" placeholder="e.g. cider, applemusic, spotify"></label>
        <div class="row"><span class="grow">Stay up while paused</span>${tog('music.always', P.s.music.always)}</div>
        <label class="field">SMTC Bridge address<input type="text" data-set="music.host" value="${esc(P.s.music.host)}" placeholder="${M.BRIDGE_DEFAULT}"></label>
        <label class="field">Cider API token (only if Cider asks for one)<input type="password" data-set="music.ciderToken" value="${esc(P.s.music.ciderToken)}" autocomplete="off" placeholder="Cider → Settings → Connectivity"></label>
        <h3>veadotube</h3>
        <label class="field">Address (veadotube → program settings → serving at)<input type="text" data-set="veado.addr" value="${esc(P.s.veado.addr)}" placeholder="${M.VEADO_DEFAULT}"></label>
        <div class="row"><span class="grow">Colour buttons switch the avatar</span>${tog('veado.switch', P.s.veado.switch)}</div>
        <div class="row"><span class="grow">Tron button uses state</span><input type="text" data-set="veado.tron" value="${esc(P.s.veado.tron)}" style="width:110px"></div>
        <div class="row"><span class="grow">Wait before recolouring (ms)</span><input type="number" min="0" step="50" data-set="veado.delay" value="${+P.s.veado.delay || 0}" style="width:80px"></div>
        ${!dock && Object.keys(P.s.veado.map).length ? `<span class="hint">State colours (set in the dock): ${esc(Object.entries(P.s.veado.map).map(([k, f]) => k + ' → ' + SHORT[f]).join(', '))}</span>` : ''}
        <h3>Animations</h3>
        <div class="row"><span class="grow">Motion</span><select data-set="motion"><option value="auto" ${P.s.motion === 'auto' ? 'selected' : ''}>automatic</option><option value="full" ${P.s.motion === 'full' ? 'selected' : ''}>always animate</option><option value="reduce" ${P.s.motion === 'reduce' ? 'selected' : ''}>reduced</option></select></div>
        ${!dock ? `<div class="row"><span class="grow">Sample messages and music in the previews</span>${tog('sample', P.s.sample)}</div>` : ''}
        ${dock ? `<details><summary>Troubleshooting</summary><p class="hint">SMTC Bridge's raw timeline for the followed player (position, start, end, seek range, last update):</p><code>${esc(music.raw || '(not reachable)')}</code>${music.cider ? `<p class="hint">Windows gives no timeline for this player. Cider's own API: <b class="${/^ok/.test(music.cider) ? 'ok' : 'bad'}">${esc(music.cider)}</b></p>` : ''}
          <p class="hint">Scene collection: ${esc(obs.collection || '?')} · settings saved per collection.</p></details>` : ''}
        <h3>Backup</h3>
        <div class="row"><button type="button" class="btn grow" data-act="copy-link">Copy settings link</button><button type="button" class="btn" data-act="import">Import</button></div>
        ${!dock ? '<div class="row"><button type="button" class="btn grow" data-act="copy-dock">Copy dock address</button><button type="button" class="btn red" data-act="clear">Clear</button></div>' : '<div class="row"><button type="button" class="btn grow" data-act="rebuild">Read settings back from OBS</button></div>'}
        ${P.importNote ? `<p class="hint">${esc(P.importNote)}</p>` : ''}
        <p class="hint">Settings links carry your key and links: keep them private.</p>`;
    }
    function tabLayout() {
      if (obs.state !== 'connected' || !obs.scan) return '<p class="hint">Connect to OBS first.</p>';
      const rows = managedRows(), pickers = [];
      for (const r of rows) {
        const others = r.container.items.filter((i) => i.sceneItemId !== r.item.sceneItemId && !(obs.scan.inputs.get(i.sourceUuid)?.tag)).map((i) => i.sourceName);
        const opt = (v) => `<option value="">Don't touch</option>${others.map((n) => `<option ${n === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}`;
        if (r.kind === 'game' && layoutOf(r) === 'window') pickers.push(`<div class="row"><span class="grow">Game capture <span class="muted">(${esc(r.sceneName)})</span></span><select data-pick="capture:${r.container.uuid}">${opt(P.s.dock.pick.capture[r.container.uuid])}</select></div>`);
        if (r.kind === 'chatting' || (r.kind === 'game' && layoutOf(r) === 'window')) pickers.push(`<div class="row"><span class="grow">veadotube <span class="muted">(${esc(r.sceneName)})</span></span><select data-pick="veado:${r.container.uuid}">${opt(P.s.dock.pick.veado[r.container.uuid])}</select></div>`);
      }
      const cs = checks(), av = P.s.dock.avatar || {}, pickedV = rows.some((r) => P.s.dock.pick.veado[r.container.uuid]);
      const kinds = [...new Set(rows.filter((r) => P.s.dock.pick.veado[r.container.uuid]).map((r) => (r.kind === 'game' ? 'game' : 'chatting')))];
      const avatar = pickedV ? `<h3>Avatar size (veadotube)</h3>
        ${kinds.map((k) => `<div class="row"><span class="grow">Height on ${k === 'game' ? 'Game (window)' : 'Just chatting'} (px)</span><input type="number" min="100" max="1080" step="10" data-set="dock.avatar.${k}" value="${+av[k] || (k === 'game' ? 540 : 820)}" style="width:80px"></div>`).join('')}
        <span class="hint ${measure.running ? 'warn' : ''}">${esc(measure.note || (av.bounds ? `Measured ${av.states?.length || '?'} states on ${new Date(av.at).toLocaleDateString()} (${av.canvas.w} × ${av.canvas.h} canvas).` : 'Not measured yet: Tidy fits the whole veadotube canvas into the box, which leaves the avatar small.'))}</span>
        <button type="button" class="btn" data-act="measure" ${measure.running || veado.state !== 'ok' || obs.busy ? 'disabled' : ''}>${measure.running ? 'Measuring…' : av.bounds ? 'Measure again' : 'Measure avatar'}</button>
        <p class="hint">Before going live: veadotube steps through every state for a few seconds (viewers would see it), so stay quiet while it runs. Nothing is measured during a stream; after this, switching states never moves or resizes the avatar.</p>` : '';
      return `${measurePrompt()}<h3>Your sources (placed only if picked)</h3>${pickers.join('') || '<p class="hint">Nothing to place: no Just chatting or Game (window) scene found.</p>'}${avatar}
        <h3>Checks</h3>
        ${cs.length ? `<table><tr><th>Scene</th><th>Item</th><th>State</th></tr>${cs.map((c) => `<tr><td>${esc(c.where)}</td><td>${esc(c.what)}</td><td class="${c.good ? 'ok' : c.bad ? 'bad' : 'warn'}">${esc(c.state)}</td></tr>`).join('')}</table>` : '<p class="hint ok">Everything checked is in place.</p>'}
        <div class="row"><span class="grow">Lock the dock's own items</span>${tog('dock.lock', P.s.dock.lock)}</div>
        <button type="button" class="btn solid" data-act="tidy" ${cs.some((c) => c.fix) ? '' : 'disabled'}>Tidy layout…</button>
        <p class="hint">Shows the plan first. It never moves your own sources unless picked above, and never reorders anything.</p>`;
    }
    function foot() {
      if (!dock) return '';
      const n = pendingCount();
      return `<div class="ft"><span class="${n ? 'warn' : 'muted'}">${n ? `${n} change${n === 1 ? '' : 's'} waiting` : obs.state === 'connected' ? 'OBS matches these settings' : 'Not connected to OBS'}</span><button type="button" class="btn ${n ? 'solid' : ''}" data-act="review" ${n && !obs.busy ? '' : 'disabled'}>Review &amp; apply</button></div>`;
    }
    function reviewHtml() {
      const r = P.reviewing, reloads = [...new Set(r.acts.map((a) => a.reload).filter(Boolean))];
      return `<div class="review"><div class="hd"><b>${esc(r.title)}</b><button type="button" class="btn small" data-act="cancel">✕</button></div>
        ${reloads.length ? `<p class="hint">These will reload: ${esc(reloads.join(', '))} (a scene's own Botrix chat restarts).</p>` : ''}
        <ul>${r.acts.map((a, i) => `<li data-i="${i}" class="k"><b class="k-${a.k}">${a.k.toUpperCase()}</b><span>${esc(a.label)}</span></li>`).join('')}
          <li><b class="k-skip">SKIP</b><span>Your other sources: order, positions and settings untouched.</span></li></ul>
        <div class="row"><button type="button" class="btn grow" data-act="cancel">Cancel</button><button type="button" class="btn solid grow" data-act="apply" ${obs.busy || !r.acts.some((a) => a.run) ? 'disabled' : ''}>${obs.busy ? 'Applying…' : `Apply ${r.acts.filter((a) => a.run).length} change${r.acts.filter((a) => a.run).length === 1 ? '' : 's'}`}</button></div></div>`;
    }

    const bodies = { live: tabLive, scenes: tabScenes, sources: tabSources, widgets: tabWidgets, layout: tabLayout };
    return { head, foot, reviewHtml, bodies };
  };
})();
