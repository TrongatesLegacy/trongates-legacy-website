// Refreshes public/feed.json with the latest YouTube videos and shorts.
// Run by .github/workflows/update-feed.yml on a schedule: YouTube's RSS feeds reject requests
// from Netlify's servers, so the list is fetched here and served as a static file instead.
import { readFile, writeFile } from "node:fs/promises";
import { youtube } from "../netlify/functions/feed.mjs";

const FILE = new URL("../public/feed.json", import.meta.url);

let feed;
try {
  feed = await youtube();
} catch (err) {
  console.log(`YouTube unavailable (${err.message}); keeping the existing feed.json`);
  process.exit(0);
}
if (!feed.videos.length && !feed.shorts.length) {
  console.log("YouTube returned nothing; keeping the existing feed.json");
  process.exit(0);
}

const previous = await readFile(FILE, "utf8").then(JSON.parse).catch(() => ({}));
// the channel-feed fallback only sees the 15 newest uploads, so never let it shrink a fuller list
const next = {
  videos: feed.videos.length >= (previous.videos?.length ?? 0) || feed.source === "playlists" ? feed.videos : previous.videos,
  shorts: feed.shorts.length >= (previous.shorts?.length ?? 0) || feed.source === "playlists" ? feed.shorts : previous.shorts,
};
const same = JSON.stringify(next) === JSON.stringify({ videos: previous.videos, shorts: previous.shorts });
if (same) {
  console.log("feed.json is already up to date");
} else {
  await writeFile(FILE, JSON.stringify(next, null, 2) + "\n");
  console.log(`feed.json updated from ${feed.source}: ${next.videos.length} videos, ${next.shorts.length} shorts`);
}
