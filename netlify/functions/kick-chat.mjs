// GET /api/kick-chat — the Pusher app key and cluster Kick serves its chat on right now: { key, cluster }.
// The widgets read Kick chat over Pusher with a key built into public/widgets/lib/platforms/kick.js; Kick changes it now
// and then, and the old one is refused ("App key … not in this cluster"). Then the widget asks here and reconnects.
// Kick's site is handed the key by web.kick.com's realtime endpoint, which doesn't allow browsers on other sites to
// ask, so this asks for them. Netlify's CDN keeps the answer for 10 minutes: Kick is asked a few times an hour at most,
// however many overlays need it. scripts/check-kick.mjs (daily, GitHub Actions) uses realtime() too.
// docs/widgets.md, "Reading chat".

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
export const REALTIME_URL = "https://web.kick.com/api/v1/realtime/connection";

/**
 * What Kick offers a client that accepts these providers, in Kick's order of preference:
 * [{ provider: 'pusher', key, cluster } | { provider: 'centrifugo', url } | { provider }]. Throws if Kick can't be asked
 * or answers an error (e.status 400: it supports none of them).
 * @param {string[]} providers
 */
export async function realtime(providers, fetch_ = fetch) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch_(REALTIME_URL, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
      body: JSON.stringify({ client: { id: "trongateslegacy-widgets", type: "web" }, capabilities: { accepted_providers: providers.map((provider) => ({ provider })) } }),
    });
    // 400: Kick supports none of these providers
    if (!r.ok) throw Object.assign(new Error(`Kick answered ${r.status}`), { status: r.status });
    const j = await r.json();
    const conns = j && j.data && Array.isArray(j.data.connections) ? j.data.connections : null;
    if (!conns) throw new Error("Kick's answer has no connections");
    return conns.map((c) => {
      const cr = (c && c.credentials) || {};
      if (c && c.provider === "pusher") return { provider: "pusher", key: String(cr.app_key || ""), cluster: String(cr.cluster || "") };
      if (c && c.provider === "centrifugo") return { provider: "centrifugo", url: String(cr.url || "") };
      return { provider: String((c && c.provider) || "") };
    });
  } finally { clearTimeout(timer); }
}

/** the Pusher key and cluster from realtime()'s answer, or null if Kick didn't offer a usable one */
export const pusherFrom = (offers) => {
  const p = offers.find((o) => o.provider === "pusher");
  return p && /^[0-9a-f]{16,40}$/.test(p.key) && /^[a-z]{2}[0-9]{1,2}$/.test(p.cluster) ? { key: p.key, cluster: p.cluster } : null;
};

const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex" };

export default async () => {
  try {
    const p = pusherFrom(await realtime(["pusher"]));
    if (p) return new Response(JSON.stringify(p), { headers: { ...HEADERS, "Cache-Control": "public, max-age=60", "Netlify-CDN-Cache-Control": "public, max-age=600" } });
    return new Response(JSON.stringify({ error: "Kick no longer offers Pusher" }), { status: 502, headers: { ...HEADERS, "Cache-Control": "public, max-age=60", "Netlify-CDN-Cache-Control": "public, max-age=600" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 502, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }
};

export const config = { path: "/api/kick-chat" };
