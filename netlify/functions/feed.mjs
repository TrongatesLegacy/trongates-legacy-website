// GET /api/feed — latest YouTube videos + shorts and Kick live status as JSON.
// YouTube's RSS feeds and Kick's API don't send CORS headers, so the page can't
// read them directly; this proxies them and lets Netlify's CDN cache the result.

const YT_CHANNEL = "UCA5UbiXATWSsqgLNofZoIyg";
const KICK_SLUG = "trongateslegacy";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// "UULF" + channel id (minus "UC") is the auto playlist of long-form uploads, "UUSH" is shorts.
const playlistFeed = (prefix) =>
  `https://www.youtube.com/feeds/videos.xml?playlist_id=${prefix}${YT_CHANNEL.slice(2)}`;

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

async function fetchWithTimeout(url, init = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function youtube(prefix, limit) {
  const res = await fetchWithTimeout(playlistFeed(prefix), { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`youtube ${prefix} ${res.status}`);
  const xml = await res.text();
  return xml
    .split("<entry>")
    .slice(1)
    .map((entry) => {
      const pick = (re) => (entry.match(re) || [])[1] || "";
      return {
        id: pick(/<yt:videoId>([^<]+)</),
        title: decode(pick(/<title>([^<]*)</)),
        published: pick(/<published>([^<]+)</),
      };
    })
    .filter((v) => /^[\w-]{11}$/.test(v.id))
    // each stream VOD is uploaded twice (with and without "| Music |"); keep one per stream
    .filter((v) => !/\|\s*Music\s*\|/i.test(v.title))
    .slice(0, limit);
}

// Official Kick API — used when KICK_CLIENT_ID / KICK_CLIENT_SECRET are set in Netlify
// (create an app at https://kick.com/settings/developer). Reliable, but has no follower count.
async function kickOfficial() {
  const tokenRes = await fetchWithTimeout("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.KICK_CLIENT_ID,
      client_secret: process.env.KICK_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) throw new Error(`kick token ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  const res = await fetchWithTimeout(`https://api.kick.com/public/v1/channels?slug=${KICK_SLUG}`, {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`kick api ${res.status}`);
  const channel = (await res.json()).data?.[0];
  if (!channel) throw new Error("kick channel missing");
  return {
    live: Boolean(channel.stream?.is_live),
    title: channel.stream_title || "",
    viewers: channel.stream?.viewer_count ?? 0,
    category: channel.category?.name || "",
    followers: null,
  };
}

// Kick's website API needs no credentials but sits behind bot protection that often
// rejects server-side requests, so treat it as best effort.
async function kickSite() {
  const res = await fetchWithTimeout(`https://kick.com/api/v2/channels/${KICK_SLUG}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`kick ${res.status}`);
  const data = await res.json();
  const stream = data.livestream;
  return {
    live: Boolean(stream && stream.is_live !== false),
    title: stream?.session_title || "",
    viewers: stream?.viewer_count ?? 0,
    category: stream?.categories?.[0]?.name || "",
    followers: data.followers_count ?? null,
  };
}

const kick = () => (process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET ? kickOfficial() : kickSite());

export default async () => {
  const [videos, shorts, kickStatus] = await Promise.allSettled([
    youtube("UULF", 6),
    youtube("UUSH", 10),
    kick(),
  ]);
  const value = (r, fallback) => (r.status === "fulfilled" ? r.value : fallback);

  return new Response(
    JSON.stringify({
      videos: value(videos, []),
      shorts: value(shorts, []),
      kick: value(kickStatus, null),
      generated: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "Netlify-CDN-Cache-Control": "public, s-maxage=180, stale-while-revalidate=3600",
      },
    },
  );
};

export const config = { path: "/api/feed" };
