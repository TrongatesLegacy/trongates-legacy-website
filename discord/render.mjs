// Renders banner.html to discord-banner.png (static) and discord-banner.gif (animated), both 1360x480.
// Usage: node --experimental-websocket discord/render.mjs [frames=60] [fps=15]   (needs Chrome + ffmpeg)
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const FRAMES = +process.argv[2] || 60, FPS = +process.argv[3] || 15;
const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(tmpdir(), "discord-banner-frames");
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9341", `--user-data-dir=${join(tmpdir(), "discord-banner-chrome")}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const tabs = await (await fetch("http://127.0.0.1:9341/json")).json();
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 680, height: 240, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: pathToFileURL(join(here, "banner.html")).href });
await sleep(2500);
for (let i = 0; i < FRAMES; i++) {
  await send("Runtime.evaluate", { expression: `setT(${i / FRAMES})` });
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 680, height: 240, scale: 1 } });
  writeFileSync(join(tmp, `f${String(i).padStart(3, "0")}.png`), Buffer.from(data, "base64"));
}
ws.close(); chrome.kill();
copyFileSync(join(tmp, "f000.png"), join(here, "discord-banner.png"));
// GIF has a 256-colour limit: build one palette for the whole loop, dither lightly, store only changed regions
const gif = join(here, "discord-banner.gif");
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(tmp, "f%03d.png"),
  "-filter_complex", "[0]split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
  "-loop", "0", gif]);
console.log(`discord-banner.png + discord-banner.gif (${(statSync(gif).size / 1048576).toFixed(2)} MB, ${FRAMES} frames @ ${FPS}fps)`);
