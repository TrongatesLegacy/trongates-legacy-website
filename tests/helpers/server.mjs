// The site for the browser tests: public/ as Netlify serves it (/obs/brb → brb.html), with /api/feed and
// /api/obs-widgets answered by whatever the test sets, so nothing reaches YouTube, Kick or Netlify. Port: any free one.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { ROOT } from './sim.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.txt': 'text/plain', '.xml': 'application/xml' };

// api: { '/api/feed': { status, body, delay } }, delays: { '/feed.json': ms }, files: { '/obs/shared/scene.js': source }
// (serve this instead of the file: e.g. an older version, to prove a test fails on it). All can change while it runs.
export async function siteServer({ api = {}, delays = {}, files = {} } = {}) {
  const state = { api, delays, files, hits: [] };
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    state.hits.push(path);
    const wait = state.delays[path]; if (wait) await new Promise((r) => setTimeout(r, wait));
    const fake = state.api[path];
    if (fake || path.startsWith('/api/')) {
      const f = fake || { status: 404, body: { error: 'not faked in this test' } };
      if (f.delay) await new Promise((r) => setTimeout(r, f.delay));
      res.writeHead(f.status || 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'X-OBS-Key' });
      return res.end(JSON.stringify(f.body ?? {}));
    }
    if (state.files[path] !== undefined) {
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || (extname(path) ? 'text/plain' : TYPES['.html']), 'Cache-Control': 'no-store' });
      return res.end(state.files[path]);
    }
    try {
      let file = join(ROOT, 'public', normalize(path.endsWith('/') ? path + 'index.html' : path));
      if (!file.startsWith(join(ROOT, 'public'))) throw 0;
      const body = await readFile(file).catch(() => readFile((file += '.html')));
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404).end('Not found'); }
  });
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return Object.assign(state, { origin, close: () => new Promise((ok) => { server.close(ok); for (const s of sockets) s.destroy(); }) });
}
