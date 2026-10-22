// The games on the stream's scenes (obs/chatagram.html, obs/chaplinko.html; obs/README.md, "Games on your scenes"). The
// scene OBS is showing decides the game's look there (scenelook=, from the dock's Widgets → Chatagram / Chaplinko) and whether
// it pauses on Game (keep=0), sent to the game as live messages ({ type: 'widget-look', bgo, gbo }, { type: 'widget-pause',
// paused }). A scene is recognised by its Trongates overlay's address, as the dock does, so renamed scenes, scenes inside
// scenes and groups all work. The dock's changes arrive live (a CustomEvent, tgl: 'game-look'). Needs theme.js connected to
// OBS (obs=); without it the game keeps its link's own look.
(() => {
  const SCENE_URL = /\/obs\/(starting|brb|chatting|game|ending)(?:\.html)?(?:[?#]|$)/;
  /** a scene's spot from its overlay's address: starting, brb, chatting, window, full (Game's layouts) or ending; '' if not ours */
  function kindOfUrl(url) {
    const m = SCENE_URL.exec(url || '');
    if (!m) return '';
    return m[1] !== 'game' ? m[1] : /[?&]layout=window(?:[&#]|$)/.test(url) ? 'window' : 'full';
  }
  /** the spot of the scene called name, from the first Trongates overlay in it (or in a scene or group inside it) */
  async function kindOfScene(name, depth = 0, group = false) {
    const { sceneItems = [] } = await TGL.obsRequest(group ? 'GetGroupSceneItemList' : 'GetSceneItemList', { sceneName: name });
    for (const it of sceneItems) if (it.inputKind === 'browser_source') {
      const { inputSettings = {} } = await TGL.obsRequest('GetInputSettings', { inputUuid: it.sourceUuid }).catch(() => ({}));
      const k = kindOfUrl(inputSettings.url);
      if (k) return k;
    }
    if (depth < 2) for (const it of sceneItems) if (it.isGroup || it.sourceType === 'OBS_SOURCE_TYPE_SCENE') {
      const k = await kindOfScene(it.sourceName, depth + 1, !!it.isGroup).catch(() => '');
      if (k) return k;
    }
    return '';
  }
  /**
   * follow the scenes for one game: send(message) passes a message to the game; onForm(form | null) is the form a cycling
   * scene on show is on (Starting soon, Be right back take the forms in turn), null for the stream's own. Returns { apply() }
   * to send the current look again (the game reloaded).
   */
  /** @param {string} game @param {(message: any) => void} send @param {(form: string | null) => void} [onForm] */
  function follow(game, send, onForm = (form) => {}) {
    const q = new URLSearchParams(location.search), look = {};
    // the cycling scenes' forms: the latest each said (the scene may say it before OBS says it's on show), and the one in use
    const CYCLE_FRESH = 9000, said = {};
    let cycleForm = null;
    const useCycle = () => {
      const c = said[kind], f = c && Date.now() - c.at < CYCLE_FRESH ? c.form : null;
      if (f !== cycleForm) { cycleForm = f; onForm(f); }
    };
    const heard = (d) => {
      if (!d || !d.scene || !TGL.FORMS[d.form]) return;
      said[d.scene] = { form: d.form, at: Date.now() };
      if (d.scene === kind) useCycle();
    };
    // the index page's preview: the scene around it is the one on show
    if (parent !== window) addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'tgl-cycle' || !TGL.FORMS[e.data.form]) return;
      if (e.data.form !== cycleForm) { cycleForm = e.data.form; onForm(cycleForm); }
    });
    for (const p of (q.get('scenelook') || '').split(',')) { const [k, v] = p.split(':'); if (k && v) look[k] = v.split('.').map(Number); }
    let keep = q.get('keep') !== '0', kind = '', asked = 0;
    const apply = () => {
      if (!kind) return;
      const l = look[kind];
      if (l) send({ type: 'widget-look', bgo: l[0], ...(l.length > 1 ? { gbo: l[1] } : {}) });
      send({ type: 'widget-pause', paused: !keep && (kind === 'window' || kind === 'full') });
    };
    const me = { apply, get kind() { return kind; }, get keep() { return keep; } };
    if (!q.has('scenelook')) return me;          // not on the stream's scenes: the link's own look, never paused
    try { new BroadcastChannel('tgl-cycle').onmessage = (e) => heard(e.data); } catch {}
    TGL.onScene(async (name) => {
      const n = ++asked;
      const k = await kindOfScene(name).catch(() => '');
      if (n !== asked || !k) return;              // another switch since, or not a Trongates scene: keep the last look
      kind = k; apply(); useCycle();
    });
    TGL.onCustom((d) => {
      if (d.tgl === 'cycle') return heard(d);
      if (d.tgl !== 'game-look' || d.game !== game) return;
      if (d.look) for (const [k, v] of Object.entries(d.look)) if (Array.isArray(v)) look[k] = v.map(Number);
      if (d.keep !== undefined) keep = !!d.keep;
      apply();
    });
    return me;
  }
  window.TGLGames = { follow, kindOfUrl, kindOfScene };
})();
