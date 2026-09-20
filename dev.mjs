// Local preview: serves public/ and the /api/feed function. Run with `node dev.mjs`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import feed from "./netlify/functions/feed.mjs";

const PORT = process.env.PORT || 8888;
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/api/feed") {
    const r = await feed();
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  try {
    const file = join("public", normalize(path === "/" ? "/index.html" : path));
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
