// Chaplinko's trailer: records trailer.html to an MP4 with the music (music.mjs): headless Chrome's screencast frames, with their timestamps,
// become a constant 30 fps video. The page is served next to public/ (the test server), so the game in it is real.
// Usage: node --experimental-websocket artwork/chaplinko/trailer/record.mjs ~/Downloads/chaplinko-trailer.mp4 [--vertical]
//   --vertical: 1080 × 1920 for Shorts / Reels / TikTok (the same scenes, laid out for a phone)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../../../tests/helpers/chrome.mjs';
import { siteServer } from '../../../tests/helpers/server.mjs';

const here = new URL('.', import.meta.url).pathname;
// Inside the game's frame only: pretend Twitch and Kick connections, so the trailer's chat panel can send each message to
// the game exactly as a real chat would arrive (window.__chat.twitch/kick(name, text)); the connection lights show live.
const FAKE_CHAT = `if (location.pathname.endsWith('/play.html')) (() => {
  const socks = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; socks.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); if (url.includes('pusher')) this.recv('{"event":"pusher:connection_established","data":"{}"}'); }, 5); }
    send(d) { if (/^JOIN/.test(d)) setTimeout(() => this.recv(':x 366 x #c :End'), 5); if (d.includes('pusher:subscribe')) setTimeout(() => this.recv('{"event":"pusher_internal:subscription_succeeded","data":"{}"}'), 5);
      if (/^PING/.test(d)) setTimeout(() => this.recv(':tmi.twitch.tv PONG'), 5); if (d.includes('pusher:ping')) setTimeout(() => this.recv('{"event":"pusher:pong","data":{}}'), 5); }
    recv(d) { this.onmessage && this.onmessage({ data: d }); }
    close() { this.readyState = 3; }
  }
  window.WebSocket = FakeWS;
  const by = (k) => socks.find((s) => s.url.includes(k));
  window.__chat = {
    twitch: (name, text) => by('twitch').recv('@badges=;display-name=' + name + ';mod=0 :' + name.toLowerCase() + '!x@x PRIVMSG #streamer :' + text),
    kick: (name, text) => by('pusher').recv(JSON.stringify({ event: 'App\\\\Events\\\\ChatMessageEvent', data: JSON.stringify({ content: text, sender: { username: name, slug: name.toLowerCase(), identity: { badges: [] } } }) })),
  };
})();`;
const V = process.argv.includes('--vertical'), [W, H] = V ? [1080, 1920] : [1920, 1080];
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) || join(homedir(), 'Downloads', V ? 'chaplinko-trailer-short.mp4' : 'chaplinko-trailer.mp4'), LEN = 30;
const dir = mkdtempSync(join(tmpdir(), 'chaplinko-trailer-'));
const music = join(dir, 'music.m4a');
execFileSync('node', [join(here, 'music.mjs'), music]);
const site = await siteServer({ files: { '/trailer.html': readFileSync(join(here, 'trailer.html'), 'utf8') } });
const chrome = await launch();
try {
  const tab = await chrome.open(site.origin + '/trailer.html' + (V ? '?v=1' : ''), { width: W, height: H, init: FAKE_CHAT });
  await tab.until('window.ready()', 10000);
  const frames = [];
  tab.on('Page.screencastFrame', (p) => {
    frames.push({ t: p.metadata.timestamp, data: p.data });
    tab.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
  });
  await tab.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await new Promise((r) => setTimeout(r, 300));
  const t0 = Date.now() / 1000;
  await tab.eval('start(), 1');
  await new Promise((r) => setTimeout(r, (LEN + 0.6) * 1000));
  await tab.send('Page.stopScreencast');
  // frames → a list with each frame's duration, starting at start()
  const kept = frames.filter((f) => f.t >= t0 - 0.05);
  let list = '';
  kept.forEach((f, i) => {
    const file = join(dir, `f${String(i).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = i + 1 < kept.length ? kept[i + 1].t : t0 + LEN;
    list += `file '${file}'\nduration ${Math.max(0.001, Math.min(next, t0 + LEN) - f.t).toFixed(4)}\n`;
  });
  list += `file '${join(dir, `f${String(kept.length - 1).padStart(5, '0')}.jpg`)}'\n`;
  writeFileSync(join(dir, 'list.txt'), list);
  console.log(`${kept.length} frames captured over ${LEN} s (${(kept.length / LEN).toFixed(1)} fps before resampling)`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-i', music,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'copy', '-t', String(LEN), '-movflags', '+faststart', OUT]);
  console.log(OUT);
} finally { await chrome.close(); await site.close(); rmSync(dir, { recursive: true, force: true }); }
