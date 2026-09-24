// Local preview: serves public/ and the /api/feed and /api/obs-widgets functions. Run with `node dev.mjs`
// (for the OBS links, with OBS_KEY, BOTRIX_CHAT_URL and BOTRIX_GOAL_URL set in the environment).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import feed from "./netlify/functions/feed.mjs";
import obsWidgets from "./netlify/functions/obs-widgets.mjs";

const PORT = process.env.PORT || 8888;
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".css": "text/css", ".js": "text/javascript", ".gif": "image/gif", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/api/obs-widgets") {
    const r = await obsWidgets(new Request("http://localhost" + req.url, { method: req.method, headers: req.headers }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  if (path === "/api/feed") {
    const r = await feed();
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  try {
    let file = join("public", normalize(path.endsWith("/") ? path + "index.html" : path));
    // like Netlify: /obs/brb serves /obs/brb.html
    const body = await readFile(file).catch(() => readFile((file += ".html")));
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
