// Twitch chat, read anonymously (docs/widgets.md, "Reading chat"). Twitch lets anyone read a channel's chat over its
// IRC WebSocket without logging in (a "justinfan" nickname), so nothing here needs an account or a key. Turns each
// line into the widgets' one message shape: { platform, user, name, text, mod, owner, color, emotes }.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const URL_ = 'wss://irc-ws.chat.twitch.tv:443';

  /** whatever someone typed (twitch.tv/Name, @Name, Name) → the channel's login */
  const channel = (input) => String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^(www\.|m\.)?twitch\.tv\//, '').replace(/^@/, '').split(/[/?#\s]/)[0].replace(/[^a-z0-9_]/g, '').slice(0, 25);

  // the emotes Twitch itself found in the message (its "emotes" tag: id:start-end,start-end/id:…, positions in characters),
  // in the order they appear. Only ids Twitch sent are used, never an address someone typed.
  // "default": the animated GIF for an animated emote, the still PNG otherwise
  const EMOTE_URL = (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
  function emotesFrom(tag, text) {
    if (!tag) return [];
    const chars = Array.from(text), out = [];
    for (const part of tag.split('/')) {
      const [id, ranges] = part.split(':');
      if (!/^[\w-]{1,64}$/.test(id || '') || !ranges) continue;
      for (const r of ranges.split(',')) {
        const [a, b] = r.split('-').map(Number);
        if (Number.isInteger(a) && Number.isInteger(b) && b >= a && b < chars.length) out.push({ id, name: chars.slice(a, b + 1).join(''), url: EMOTE_URL(id), at: a });
      }
    }
    return out.sort((x, y) => x.at - y.at).map(({ at, ...e }) => e);
  }
  const colorOf = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : '');
  const unescapeTag = (v) => v.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '').replace(/\\n/g, '');
  /** one IRC line → a message, a ping, or null */
  function parse(line, chan) {
    line = String(line).replace(/\r$/, '');
    if (line.startsWith('PING')) return { type: 'ping', payload: line.slice(5) };
    if (/^:\S+ RECONNECT\b/.test(line) || line === 'RECONNECT') return { type: 'reconnect' };   // Twitch is about to restart this server
    let tags = {}, rest = line;
    if (rest[0] === '@') {
      const sp = rest.indexOf(' ');
      for (const kv of rest.slice(1, sp).split(';')) { const i = kv.indexOf('='); tags[kv.slice(0, i)] = unescapeTag(kv.slice(i + 1)); }
      rest = rest.slice(sp + 1);
    }
    const m = /^:([^!\s]+)![^\s]+ PRIVMSG #(\S+) :(.*)$/.exec(rest);
    if (!m) return null;
    const user = m[1].toLowerCase(), badges = tags.badges || '';
    const owner = /(^|,)broadcaster\//.test(badges) || user === (chan || m[2]).toLowerCase();
    return {
      type: 'message', platform: 'twitch', user, name: tags['display-name'] || m[1], text: m[3],
      owner, mod: owner || tags.mod === '1' || /(^|,)moderator\//.test(badges),
      color: colorOf(tags.color), emotes: emotesFrom(tags.emotes, m[3]),
    };
  }

  // Is the channel live? Twitch's public web API (the one twitch.tv itself uses; no key, and it lets other sites ask)
  // gives the stream's id and when it started. Unofficial, like Kick's: if it ever stops answering, callers get 'unknown'.
  const GQL_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
  /** Twitch's answer → { state: 'live', id, started } | { state: 'offline' } | { state: 'unknown' } (no such channel, or a reply we don't recognise) */
  function streamFrom(j) {
    const u = j && j.data && j.data.user;
    if (!u || typeof u !== 'object') return { state: 'unknown' };
    if (!u.stream) return u.stream === null ? { state: 'offline' } : { state: 'unknown' };
    const started = Date.parse(u.stream.createdAt);
    return u.stream.id ? { state: 'live', id: String(u.stream.id), started: Number.isFinite(started) ? started : undefined } : { state: 'unknown' };
  }
  async function stream(login, fetch_ = fetch) {
    try {
      const r = await fetch_('https://gql.twitch.tv/gql', { method: 'POST', headers: { 'Client-Id': GQL_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query{user(login:${JSON.stringify(channel(login))}){stream{id createdAt}}}` }) });
      return r.ok ? streamFrom(await r.json()) : { state: 'unknown' };
    } catch { return { state: 'unknown' }; }
  }

  /** @param {{ channel: string, socket: Function }} o  socket: chat.js's reconnecting socket */
  function connect(o, onMessage, onStatus) {
    const chan = channel(o.channel);
    return o.socket({
      url: URL_, name: 'twitch', keepalive: 60000, ping: () => 'PING :tmi.twitch.tv',
      open(send) { send('CAP REQ :twitch.tv/tags'); send('NICK justinfan' + (10000 + Math.floor(Math.random() * 89999))); send('JOIN #' + chan); },
      message(data, send, live, restart) {
        for (const line of String(data).split('\n')) {
          if (!line) continue;
          if (/ 366 /.test(line)) live();                        // end of the channel's name list: joined
          const p = parse(line, chan);
          if (!p) continue;
          if (p.type === 'ping') send('PONG ' + p.payload);
          else if (p.type === 'reconnect') return restart();
          else onMessage(p);
        }
      },
    }, onStatus);
  }

  (W.platforms = W.platforms || {}).twitch = { channel, parse, connect, stream, streamFrom, GQL_ID, EMOTE_URL, label: 'Twitch', color: '#9146ff' };
})();
