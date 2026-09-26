// Refreshes public/feed.json with the latest YouTube videos and shorts.
// Run by .github/workflows/update-feed.yml on a schedule: YouTube's RSS feeds reject requests
// from Netlify's servers, so the list is fetched here and served as a static file instead.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { youtube } from "../netlify/functions/feed.mjs";

const FILE = new URL("../public/feed.json", import.meta.url);

// What feed.json should hold next. The channel-feed fallback only sees the 15 newest uploads, so it never shrinks a
// fuller list; the playlists (or the API) always win.
export function nextFeed(previous, feed) {
  return {
    videos: feed.videos.length >= (previous.videos?.length ?? 0) || feed.source === "playlists" ? feed.videos : previous.videos,
    shorts: feed.shorts.length >= (previous.shorts?.length ?? 0) || feed.source === "playlists" ? feed.shorts : previous.shorts,
  };
}

async function main() {
  let feed;
  try {
    feed = await youtube();
  } catch (err) {
    console.log(`YouTube unavailable (${err.message}); keeping the existing feed.json`);
    return;
  }
  if (!feed.videos.length && !feed.shorts.length) {
    console.log("YouTube returned nothing; keeping the existing feed.json");
    return;
  }
  const previous = await readFile(FILE, "utf8").then(JSON.parse).catch(() => ({}));
  const next = nextFeed(previous, feed);
  const same = JSON.stringify(next) === JSON.stringify({ videos: previous.videos, shorts: previous.shorts });
  if (same) {
    console.log("feed.json is already up to date");
  } else {
    await writeFile(FILE, JSON.stringify(next, null, 2) + "\n");
    console.log(`feed.json updated from ${feed.source}: ${next.videos.length} videos, ${next.shorts.length} shorts`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
