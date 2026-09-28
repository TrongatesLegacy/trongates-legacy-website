// Twitch chat, read anonymously (docs/widgets.md, "Reading chat"). Twitch lets anyone read a channel's chat over its
// IRC WebSocket without logging in (a "justinfan" nickname), so nothing here needs an account or a key. Turns each
// line into the widgets' one message shape: { platform, user, name, text, mod, owner }.
(() => {
  const W = (window.Widgets = window.Widgets || {});
  const URL_ = 'wss://irc-ws.chat.twitch.tv:443';

  /** whatever someone typed (twitch.tv/Name, @Name, Name) → the channel's login */
  const channel = (input) => String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^(www\.|m\.)?twitch\.tv\//, '').replace(/^@/, '').split(/[/?#\s]/)[0].replace(/[^a-z0-9_]/g, '').slice(0, 25);

  const unescapeTag = (v) => v.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '').replace(/\\n/g, '');
  /** one IRC line → a message, a ping, or null */
  function parse(line, chan) {
    line = String(line).replace(/\r$/, '');
    if (line.startsWith('PING')) return { type: 'ping', payload: line.slice(5) };
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
    };
  }

  /** @param {{ channel: string, socket: Function }} o  socket: chat.js's reconnecting socket */
  function connect(o, onMessage, onStatus) {
    const chan = channel(o.channel);
    return o.socket({
      url: URL_, name: 'twitch',
      open(send) { send('CAP REQ :twitch.tv/tags'); send('NICK justinfan' + (10000 + Math.floor(Math.random() * 89999))); send('JOIN #' + chan); },
      message(data, send, live) {
        for (const line of String(data).split('\n')) {
          if (!line) continue;
          if (/ 366 /.test(line)) live();                        // end of the channel's name list: joined
          const p = parse(line, chan);
          if (!p) continue;
          if (p.type === 'ping') send('PONG ' + p.payload); else onMessage(p);
        }
      },
    }, onStatus);
  }

  (W.platforms = W.platforms || {}).twitch = { channel, parse, connect, label: 'Twitch', color: '#9146ff' };
})();
