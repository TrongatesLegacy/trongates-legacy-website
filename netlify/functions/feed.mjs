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

function parseFeed(xml) {
  return xml
    .split("<entry>")
    .slice(1)
    .map((entry) => {
      const pick = (re) => (entry.match(re) || [])[1] || "";
      return {
        id: pick(/<yt:videoId>([^<]+)</),
        title: decode(pick(/<title>([^<]*)</)),
        published: pick(/<published>([^<]+)</),
        short: /youtube\.com\/shorts\//.test(entry),
      };
    })
    .filter((v) => /^[\w-]{11}$/.test(v.id))
    // each stream VOD is uploaded twice (with and without "| Music |"); keep one per stream
    .filter((v) => !/\|\s*Music\s*\|/i.test(v.title));
}

// YouTube's RSS endpoints randomly answer 404/500 for feeds that exist, so retry before giving up.
async function fetchFeed(url, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    if (i) await new Promise((r) => setTimeout(r, 250 * i));
    try {
      const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } }, 4000);
      if (res.ok) return parseFeed(await res.text());
      lastError = new Error(`${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// A short answers 200 at /shorts/<id>; a regular video redirects to /watch.
async function isShort(id) {
  const res = await fetchWithTimeout(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual", headers: { "User-Agent": UA } }, 4000);
  return res.status === 200;
}

// The per-type playlist feeds are the cleanest source but YouTube intermittently 404s them
// (especially from cloud IPs), so fall back to the channel feed and sort entries ourselves.
export async function youtube() {
  const strip = (list, n) => list.slice(0, n).map(({ short, ...v }) => v);
  const [videos, shorts] = await Promise.allSettled([fetchFeed(playlistFeed("UULF")), fetchFeed(playlistFeed("UUSH"))]);
  if (videos.status === "fulfilled" && shorts.status === "fulfilled") {
    return { videos: strip(videos.value, 6), shorts: strip(shorts.value, 10), source: "playlists" };
  }
  const all = await fetchFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`);
  const flags = await Promise.all(all.map((v) => (v.short ? true : isShort(v.id).catch(() => false))));
  return {
    videos: strip(all.filter((_, i) => !flags[i]), 6),
    shorts: strip(all.filter((_, i) => flags[i]), 10),
    source: "channel",
  };
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

let lastGood = null;

export default async () => {
  const [yt, kickStatus] = await Promise.allSettled([youtube(), kick()]);
  // a warm function instance remembers its last good answer, which covers most YouTube blips
  if (yt.status === "fulfilled" && yt.value.videos.length) lastGood = yt.value;
  const feed = yt.status === "fulfilled" ? yt.value : lastGood ? { ...lastGood, source: "memory" } : { videos: [], shorts: [], source: "none" };

  return new Response(
    JSON.stringify({
      ...feed,
      kick: kickStatus.status === "fulfilled" ? kickStatus.value : null,
      // upstream failures, so a broken source is visible at /api/feed instead of silently empty
      errors: [["youtube", yt], ["kick", kickStatus]]
        .filter(([, r]) => r.status === "rejected")
        .map(([name, r]) => `${name}: ${r.reason?.message || r.reason}`),
      generated: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": feed.videos.length ? "public, max-age=60" : "no-store",
        // a failed YouTube fetch is only cached briefly so the next visitor retries it
        "Netlify-CDN-Cache-Control": feed.videos.length || feed.shorts.length
          ? "public, s-maxage=180, stale-while-revalidate=3600"
          : "public, s-maxage=15",
      },
    },
  );
};

export const config = { path: "/api/feed" };
