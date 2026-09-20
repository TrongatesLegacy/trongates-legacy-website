// Renders banner.html to an animated PNG: frames via headless Chrome, assembled with ffmpeg.
// Usage: node --experimental-websocket kick-panels/banner/render.mjs [frames=48] [fps=12] [scale=1]
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { encodeApng } from "./apng.mjs";

const FRAMES = +process.argv[2] || 48, FPS = +process.argv[3] || 12, SCALE = +process.argv[4] || 1;
const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(tmpdir(), "kick-banner-frames");
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9336", `--user-data-dir=${join(tmpdir(), "kick-banner-chrome")}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const tabs = await (await fetch("http://127.0.0.1:9336/json")).json();
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 160, deviceScaleFactor: SCALE, mobile: false });
await send("Page.navigate", { url: pathToFileURL(join(here, "banner.html")).href });
await sleep(2500);
for (let i = 0; i < FRAMES; i++) {
  await send("Runtime.evaluate", { expression: `setT(${i / FRAMES})` });
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1440, height: 160, scale: 1 } });
  writeFileSync(join(tmp, `f${String(i).padStart(3, "0")}.png`), Buffer.from(data, "base64"));
}
ws.close(); chrome.kill();
writeFileSync(join(here, "kick-banner-static.png"), execFileSync("cat", [join(tmp, "f000.png")]));
// decode the PNG frames to raw RGBA with ffmpeg, then write the APNG ourselves (changed pixels only)
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(tmp, "f%03d.png"), "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
const W = 1440 * SCALE, H = 160 * SCALE, size = W * H * 4;
const frames = Array.from({ length: FRAMES }, (_, i) => raw.subarray(i * size, (i + 1) * size));
const out = join(here, "kick-banner-animated.png");
writeFileSync(out, encodeApng(frames, W, H, FPS));
console.log(`${out}  ${(statSync(out).size / 1048576).toFixed(2)} MB  (${FRAMES} frames @ ${FPS}fps, ${W}x${H})`);
