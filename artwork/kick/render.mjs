// Renders every .panel in panels.html to images/<id>.png at 2x (640px wide; Kick displays them at 320px).
// Usage: node --experimental-websocket artwork/kick/render.mjs   (needs Google Chrome installed)
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9335", `--user-data-dir=${join(tmpdir(), "kick-panels-chrome")}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const tabs = await (await fetch("http://127.0.0.1:9335/json")).json();
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

await send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 900, deviceScaleFactor: 2, mobile: false });
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
await send("Page.navigate", { url: pathToFileURL(join(here, "panels.html")).href });
await sleep(2500);
const { result } = await send("Runtime.evaluate", { returnByValue: true, expression: `document.body.style.background='transparent'; [...document.querySelectorAll('.panel')].map(p => { const b = p.getBoundingClientRect(); return { id: p.id, x: b.x, y: b.y, width: b.width, height: b.height }; })` });
mkdirSync(join(here, "images"), { recursive: true });
for (const p of result.value) {
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: p.x, y: p.y, width: p.width, height: p.height, scale: 1 } });
  writeFileSync(join(here, "images", `${p.id}.png`), Buffer.from(data, "base64"));
  console.log(`${p.id}.png  ${p.width * 2}x${p.height * 2}`);
}
ws.close(); chrome.kill();
