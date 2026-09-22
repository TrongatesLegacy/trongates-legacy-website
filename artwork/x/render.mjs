// Renders artwork/artwork/x/header.html to public/assets/img/og.jpg (1200x630) and bumps the ?v= date on the og:image /
// twitter:image URLs in public/index.html, so platforms that cache link previews by URL fetch the new one.
// Usage: node --experimental-websocket artwork/artwork/x/render.mjs   (needs Google Chrome + ffmpeg)
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9349", `--user-data-dir=${join(tmpdir(), "x-chrome")}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const tabs = await (await fetch("http://127.0.0.1:9349/json")).json();
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 500, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: pathToFileURL(join(here, "header.html")).href });
await sleep(2000);
await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1500, height: 500, scale: 1 } });
ws.close(); chrome.kill();
const png = join(tmpdir(), "x-header.png"), jpg = join(here, "x-header.jpg");
writeFileSync(png, Buffer.from(data, "base64"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-q:v", "2", jpg]);
console.log(`artwork/x/x-header.jpg (${Math.round(statSync(jpg).size / 1024)} KB). X's limit is 2MB. Look at it before committing.`);
