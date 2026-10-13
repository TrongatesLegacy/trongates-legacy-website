// Kick chat, read the way Kick's own site reads it: Pusher (a hosted WebSocket service), channel
// "chatrooms.<id>.v2" (docs/widgets.md, "Reading chat"). Unofficial but public: no account or key. The chatroom id comes
// from Kick's channel API (it allows browsers on other sites to ask), or from the link (kickid=) when the set-up page
// already looked it up. Kick changes its Pusher app key now and then: KEY below is the one we know, and if Pusher
// refuses it, connect() asks our /api/kick-chat for the one Kick uses now and reconnects with that (a daily check,
// scripts/check-kick.mjs, also updates KEY here). A key that worked is remembered (localStorage), so a refreshed
// overlay starts with it, until a deploy changes KEY.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const KEY = '34bf7a0ff419a2a775b9', CLUSTER = 'us2';
  const socketUrl = (key, cluster) => `wss://ws-${cluster}.pusher.com/app/${key}?protocol=7&client=js&version=8.4.0&flag=true`;
  // absolute, so the overlay finds it wherever it's opened from (a local file in OBS, the dev server)
  const LOOKUP = 'https://www.trongateslegacy.com/api/kick-chat';

  const SAVED = 'widgets:kick-pusher';
  const valid = (j) => !!j && /^[0-9a-f]{16,40}$/.test(j.key) && /^[a-z]{2}[0-9]{1,2}$/.test(j.cluster);
  /** the key learned last time ({ key, cluster } or null): only while KEY is still the one it replaced */
  function saved(store) {
    try {
      const j = JSON.parse(store.getItem(SAVED) || 'null');
      if (valid(j) && j.replaced === KEY) return { key: j.key, cluster: j.cluster };
      if (j) store.removeItem(SAVED);
    } catch { try { store.removeItem(SAVED); } catch {} }
    return null;
  }
  /** remember a key that worked (or forget, when it's the built-in one again) */
  function save(store, key, cluster) {
    try {
      if (key === KEY && cluster === CLUSTER) store.removeItem(SAVED);
      else store.setItem(SAVED, JSON.stringify({ key, cluster, replaced: KEY }));
    } catch {}
  }

  /** the Pusher key and cluster Kick uses now, from /api/kick-chat ({ key, cluster } or null if it can't say) */
  async function currentKey(fetch_ = fetch) {
    try {
      const r = await fetch_(LOOKUP);
      if (!r.ok) return null;
      const j = await r.json();
      return valid(j) ? { key: j.key, cluster: j.cluster } : null;
    } catch { return null; }
  }

  /** whatever someone typed (kick.com/Name, @Name, Name) → the channel's slug */
  const channel = (input) => String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^(www\.)?kick\.com\//, '').replace(/^@/, '').split(/[/?#\s]/)[0].replace(/[^a-z0-9_-]/g, '').slice(0, 40);

  /** the channel's chatroom id (null if Kick doesn't know the channel or can't be reached) */
  async function chatroom(slug, fetch_ = fetch) {
    try {
      const r = await fetch_(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const j = await r.json();
      return (j && j.chatroom && j.chatroom.id) || null;
    } catch { return null; }
  }

  /** Kick's channel answer → { state: 'live', id, started } | { state: 'offline' } | { state: 'unknown' } (times are UTC, "2026-09-28 19:30:28") */
  function streamFrom(j) {
    if (!j || typeof j !== 'object' || !('livestream' in j)) return { state: 'unknown' };
    const l = j.livestream;
    if (!l) return { state: 'offline' };
    if (l.id == null) return { state: 'unknown' };
    const started = Date.parse(String(l.start_time || l.created_at || '').replace(' ', 'T') + 'Z');
    return { state: 'live', id: String(l.id), started: Number.isFinite(started) ? started : undefined };
  }
  /** is the channel live? (the same channel API as chatroom()) */
  async function stream(slug, fetch_ = fetch) {
    try {
      const r = await fetch_(`https://kick.com/api/v2/channels/${encodeURIComponent(channel(slug))}`, { headers: { Accept: 'application/json' } });
      return r.ok ? streamFrom(await r.json()) : { state: 'unknown' };
    } catch { return { state: 'unknown' }; }
  }

  // Kick puts emotes in the text itself: [emote:37226:KEKW]. Only that form, with Kick's own numeric id, becomes an emote.
  const EMOTE_URL = (id) => `https://files.kick.com/emotes/${id}/fullsize`;
  const emotesFrom = (text) => [...text.matchAll(/\[emote:(\d{1,12}):(\w{1,64})\]/g)].map((m) => ({ id: m[1], name: m[2], url: EMOTE_URL(m[1]) }));
  const colorOf = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : '');

  /** one Pusher frame → a message, a ping, subscribed, a Pusher error ({ type: 'error', code }), or null */
  function parse(raw, chan) {
    let f; try { f = JSON.parse(raw); } catch { return null; }
    if (!f || typeof f !== 'object') return null;
    if (f.event === 'pusher:ping') return { type: 'ping' };
    if (f.event === 'pusher:connection_established') return { type: 'connected' };
    if (f.event === 'pusher_internal:subscription_succeeded') return { type: 'subscribed' };
    if (f.event === 'pusher:error') {
      let d = f.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch {}
      return { type: 'error', code: Number(d && d.code) || 0 };
    }
    if (f.event !== 'App\\Events\\ChatMessageEvent') return null;
    let d; try { d = typeof f.data === 'string' ? JSON.parse(f.data) : f.data; } catch { return null; }
    if (!d || !d.sender || typeof d.content !== 'string') return null;
    const id = d.sender.identity || {};
    const badges = [...(id.badges || []).map((b) => b && b.type), ...(id.badges_v2 || []).map((b) => b && b.name)];
    const user = String(d.sender.slug || d.sender.username || '').toLowerCase();
    const owner = badges.includes('broadcaster') || (!!chan && user === chan);
    return { type: 'message', platform: 'kick', user, name: d.sender.username || user, text: d.content, owner, mod: owner || badges.includes('moderator'), color: colorOf(id.color), emotes: emotesFrom(d.content) };
  }

  /** @param {{ channel: string, chatroomId?: number|string, socket: Function, fetch?: Function, storage?: Storage | null }} o */
  function connect(o, onMessage, onStatus) {
    const chan = channel(o.channel);
    let id = o.chatroomId ? String(o.chatroomId) : null;
    const store = o.storage || { getItem: () => null, setItem() {}, removeItem() {} };
    let { key, cluster } = saved(store) || { key: KEY, cluster: CLUSTER }, refused = false, learned = false;
    return o.socket({
      get url() { return socketUrl(key, cluster); }, name: 'kick', keepalive: 60000,
      async before() {                                             // runs before each connection attempt
        if (refused) {                                             // Pusher refused the key: ask which one Kick uses now
          refused = false;
          const now = await currentKey(o.fetch);
          if (now) { ({ key, cluster } = now); learned = true; }
        }
        if (!id) id = String((await chatroom(chan, o.fetch)) || '');
        if (!id) throw new Error('channel not found');
      },
      open() {},
      message(data, send, live, restart) {
        const p = parse(data, chan);
        if (!p) return;
        if (p.type === 'connected') send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${id}.v2` } }));
        else if (p.type === 'subscribed') { if (learned) { learned = false; save(store, key, cluster); } live(); }
        else if (p.type === 'ping') send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        else if (p.type === 'message') onMessage(p);
        // 4000–4099: Pusher won't take this connection as it is (4001: the app key isn't on this cluster any more)
        else if (p.type === 'error' && p.code >= 4000 && p.code < 4100) { refused = true; restart(); }
      },
      ping: () => JSON.stringify({ event: 'pusher:ping', data: {} }),
    }, onStatus);
  }

  (W.platforms = W.platforms || {}).kick = { channel, chatroom, stream, streamFrom, parse, connect, currentKey, KEY, CLUSTER, LOOKUP, EMOTE_URL, label: 'Kick', color: '#53fc18' };
})();
