// GET /api/obs-widgets — the Botrix widget links for the OBS scenes, kept in Netlify env vars instead of in
// each browser: BOTRIX_CHAT_URL, BOTRIX_GOAL_URL. The links carry the account's widget id, which Botrix says
// never to share, so they're only returned with the right key (env OBS_KEY), sent as the X-OBS-Key header.
// The scenes (?key=…) and the OBS index call this; see obs/README.md.
import { createHash, timingSafeEqual } from "node:crypto";

const env = (k) => (globalThis.Netlify?.env.get(k) ?? process.env[k] ?? "").trim();
// comparing hashes keeps the check constant-time whatever the lengths
const same = (a, b) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

// the scenes can also run as local files in OBS (origin "null"), so any origin may ask; the key is the guard
const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "X-OBS-Key",
  "X-Robots-Tag": "noindex",
};
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const key = env("OBS_KEY");
  if (!key) return reply(404, { error: "not set up: add OBS_KEY, BOTRIX_CHAT_URL and BOTRIX_GOAL_URL in Netlify" });
  if (!same(req.headers.get("x-obs-key") || "", key)) return reply(401, { error: "wrong key" });
  const links = {};
  for (const [k, name] of [["chat", "BOTRIX_CHAT_URL"], ["goal", "BOTRIX_GOAL_URL"]]) {
    const v = env(name);
    if (/^https:\/\//.test(v)) links[k] = v;
  }
  return reply(200, links);
};

export const config = { path: "/api/obs-widgets" };
