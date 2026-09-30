// Kick chat, read the way Kick's own site reads it: Pusher (a hosted WebSocket service), channel
// "chatrooms.<id>.v2" (docs/widgets.md, "Reading chat"). Unofficial but public: no account or key. The chatroom id comes
// from Kick's channel API (it allows browsers on other sites to ask), or from the link (kickid=) when the set-up page
// already looked it up. Kick has changed its Pusher app key before: it's KEY below, the one thing to update if it does.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const KEY = '32cbd69e4b950bf97679', CLUSTER = 'us2';
  const URL_ = `wss://ws-${CLUSTER}.pusher.com/app/${KEY}?protocol=7&client=js&version=8.4.0&flag=true`;

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

  /** one Pusher frame → a message, a ping, subscribed, or null */
  function parse(raw, chan) {
    let f; try { f = JSON.parse(raw); } catch { return null; }
    if (!f || typeof f !== 'object') return null;
    if (f.event === 'pusher:ping') return { type: 'ping' };
    if (f.event === 'pusher:connection_established') return { type: 'connected' };
    if (f.event === 'pusher_internal:subscription_succeeded') return { type: 'subscribed' };
    if (f.event !== 'App\\Events\\ChatMessageEvent') return null;
    let d; try { d = typeof f.data === 'string' ? JSON.parse(f.data) : f.data; } catch { return null; }
    if (!d || !d.sender || typeof d.content !== 'string') return null;
    const id = d.sender.identity || {};
    const badges = [...(id.badges || []).map((b) => b && b.type), ...(id.badges_v2 || []).map((b) => b && b.name)];
    const user = String(d.sender.slug || d.sender.username || '').toLowerCase();
    const owner = badges.includes('broadcaster') || (!!chan && user === chan);
    return { type: 'message', platform: 'kick', user, name: d.sender.username || user, text: d.content, owner, mod: owner || badges.includes('moderator'), color: colorOf(id.color), emotes: emotesFrom(d.content) };
  }

  /** @param {{ channel: string, chatroomId?: number|string, socket: Function, fetch?: Function }} o */
  function connect(o, onMessage, onStatus) {
    const chan = channel(o.channel);
    let id = o.chatroomId ? String(o.chatroomId) : null;
    return o.socket({
      url: URL_, name: 'kick', keepalive: 60000,
      async before() {                                             // runs before each connection attempt
        if (!id) id = String((await chatroom(chan, o.fetch)) || '');
        if (!id) throw new Error('channel not found');
      },
      open() {},
      message(data, send, live) {
        const p = parse(data, chan);
        if (!p) return;
        if (p.type === 'connected') send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${id}.v2` } }));
        else if (p.type === 'subscribed') live();
        else if (p.type === 'ping') send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        else if (p.type === 'message') onMessage(p);
      },
      ping: () => JSON.stringify({ event: 'pusher:ping', data: {} }),
    }, onStatus);
  }

  (W.platforms = W.platforms || {}).kick = { channel, chatroom, stream, streamFrom, parse, connect, KEY, EMOTE_URL, label: 'Kick', color: '#53fc18' };
})();
