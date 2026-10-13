// Daily check that the widgets can still read Kick chat (.github/workflows/check-kick.yml; docs/widgets.md, "Reading
// chat"). The widgets read it over Pusher with the key in public/widgets/lib/platforms/kick.js. This asks Kick which
// key it serves now, updates the file if it changed, and really connects to a chatroom with it. It prints one status
// line and writes `status` and `summary` for the workflow:
//
//   ok            Pusher works with our key
//   key-changed   Kick serves a new key: kick.js updated (the workflow tests, commits and pushes it)
//   no-pusher     Kick no longer offers Pusher at all: the widgets need moving to Centrifugo (needs a person)
//   broken        Kick offers a key, but subscribing to a chatroom with it fails (needs a person)
//   unreachable   Kick's realtime endpoint couldn't be asked (blocked, down, or its answer changed shape)
//
// The workflow opens a GitHub issue for the last three, and closes it once a later check is ok.
// Run by hand: node --experimental-websocket scripts/check-kick.mjs [--dry] (--dry: don't write kick.js)
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { realtime, pusherFrom } from "../netlify/functions/kick-chat.mjs";

const KICK_JS = fileURLToPath(new URL("../public/widgets/lib/platforms/kick.js", import.meta.url));
const KEY_LINE = /const KEY = '([0-9a-f]+)', CLUSTER = '([a-z0-9]+)';/;
const CHANNEL = "trongateslegacy", CHATROOM = 67706967;   // any public chatroom will do; ours, looked up, else this

/** kick.js's text → its { key, cluster } */
export function keyIn(text) {
  const m = text.match(KEY_LINE);
  if (!m) throw new Error("KEY line not found in kick.js");
  return { key: m[1], cluster: m[2] };
}
/** kick.js's text with a new key and cluster */
export const withKey = (text, { key, cluster }) => text.replace(KEY_LINE, `const KEY = '${key}', CLUSTER = '${cluster}';`);

/** does Pusher let this key subscribe to a chatroom? resolves true, or a reason it didn't */
export function subscribes({ key, cluster }, chatroom, WS = globalThis.WebSocket, ms = 15000) {
  return new Promise((resolve) => {
    let ws, done = false;
    const end = (v) => { if (done) return; done = true; clearTimeout(timer); try { ws.close(); } catch {} resolve(v); };
    const timer = setTimeout(() => end("no answer from Pusher"), ms);
    try { ws = new WS(`wss://ws-${cluster}.pusher.com/app/${key}?protocol=7&client=js&version=8.4.0&flag=true`); }
    catch (e) { return end(`couldn't open the socket: ${e.message}`); }
    ws.onmessage = (e) => {
      let f; try { f = JSON.parse(String(e.data)); } catch { return; }
      if (f.event === "pusher:connection_established") ws.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${chatroom}.v2` } }));
      else if (f.event === "pusher_internal:subscription_succeeded") end(true);
      else if (f.event === "pusher:error") { let d = f.data; try { if (typeof d === "string") d = JSON.parse(d); } catch {} end(`Pusher error ${d && d.code}: ${d && d.message}`); }
    };
    ws.onclose = (e) => end(`Pusher closed the connection (${e && e.code})`);
    ws.onerror = () => {};
  });
}

async function chatroomId(fetch_) {
  try {
    const r = await fetch_(`https://kick.com/api/v2/channels/${CHANNEL}`, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 Chrome/140.0" } });
    const j = r.ok ? await r.json() : null;
    return (j && j.chatroom && j.chatroom.id) || CHATROOM;
  } catch { return CHATROOM; }
}

/** the whole check → { status, summary, key? } (writes kick.js on key-changed unless dry) */
export async function check({ fetch_ = fetch, WS = globalThis.WebSocket, read = () => readFileSync(KICK_JS, "utf8"), write = (t) => writeFileSync(KICK_JS, t), dry = false } = {}) {
  const ours = keyIn(read());
  const unreachable = (e) => ({ status: "unreachable", summary: `Couldn't ask Kick which chat service to use (${e.message}). Kick may be blocking the check, or have changed its realtime endpoint (netlify/functions/kick-chat.mjs). Widgets keep working while the built-in key does.` });
  // first what Kick offers a client that takes either (what its own site uses): this also shows Kick can be asked
  let preferred, offers;
  try { preferred = (await realtime(["pusher", "centrifugo"], fetch_))[0]; } catch (e) { return unreachable(e); }
  // then Pusher alone, as the widgets ask: a 400 means Kick no longer supports it
  try { offers = await realtime(["pusher"], fetch_); } catch (e) { if (e.status === 400) offers = []; else return unreachable(e); }
  const site = preferred ? ` Kick's own site uses ${preferred.provider}.` : "";
  const theirs = pusherFrom(offers);
  if (!theirs) {
    return { status: "no-pusher", summary: `Kick no longer offers Pusher for chat (it offered: ${offers.map((o) => o.provider).join(", ") || "nothing"}). Kick chat in the widgets will stop once the current key is switched off. They need moving to Kick's other service, Centrifugo, which only accepts kick.com's own pages, so that means a relay server or Kick's official API (docs/widgets.md, "Reading chat").${site}` };
  }
  const changed = theirs.key !== ours.key || theirs.cluster !== ours.cluster;
  const ok = await subscribes(theirs, await chatroomId(fetch_), WS);
  if (ok !== true) {
    return { status: "broken", summary: `Kick offers Pusher key ${theirs.key} (${theirs.cluster}), but subscribing to a chatroom with it failed: ${ok}. Kick chat in the widgets is probably not working.${site}` };
  }
  if (changed) {
    if (!dry) write(withKey(read(), theirs));
    return { status: "key-changed", key: theirs, summary: `Kick changed its Pusher key: ${ours.key} (${ours.cluster}) → ${theirs.key} (${theirs.cluster}). kick.js updated. Widgets that were already running recovered by themselves through /api/kick-chat.${site}` };
  }
  return { status: "ok", summary: `Kick chat over Pusher works with key ${ours.key} (${ours.cluster}).${site}` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await check({ dry: process.argv.includes("--dry") });
  console.log(`${r.status}: ${r.summary}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${r.status}\nsummary=${r.summary.replace(/\n/g, " ")}\n`);
  process.exit(0);
}
