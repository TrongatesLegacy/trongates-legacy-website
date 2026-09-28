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
    return { type: 'message', platform: 'kick', user, name: d.sender.username || user, text: d.content, owner, mod: owner || badges.includes('moderator') };
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

  (W.platforms = W.platforms || {}).kick = { channel, chatroom, parse, connect, KEY, label: 'Kick', color: '#53fc18' };
})();
