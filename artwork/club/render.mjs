// Renders cover.html for the club.com profile cover:
//   club-cover.jpg   static, 3200x1076 (2x the 1600x538 design), frame 0 = Tron
//   club-cover.gif   animated, 1600x538, the three forms taking turns with the glitch swap
// Club displays the whole uploaded image (confirmed live), so the canvas is the displayed 3:1 shape.
// club.com's dialog: "scales to fit any screen. On wide screens, parts may crop", images 10MB or smaller,
// "avoid flashing or fast-moving images" (so animation is allowed; this loop is slow and has no flashes).
// Usage: node --experimental-websocket artwork/club/render.mjs [frames=72] [fps=12]
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const FRAMES = +process.argv[2] || 72, FPS = +process.argv[3] || 12;
const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(tmpdir(), "club-cover-frames");
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9353", `--user-data-dir=${join(tmpdir(), "club-chrome")}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const tabs = await (await fetch("http://127.0.0.1:9353/json")).json();
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const shoot = async (scale) => {
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 538, deviceScaleFactor: scale, mobile: false });
  await send("Page.navigate", { url: pathToFileURL(join(here, "cover.html")).href });
  await sleep(2200);
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
};

// static: frame 0 at 2x
await shoot(2);
const still = (await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1600, height: 538, scale: 1 } })).data;
const stillPng = join(tmp, "still.png"), jpg = join(here, "club-cover.jpg");
writeFileSync(stillPng, Buffer.from(still, "base64"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", stillPng, "-q:v", "3", "-pix_fmt", "yuvj420p", jpg]);

// animated: 1x frames -> GIF
await shoot(1);
for (let i = 0; i < FRAMES; i++) {
  await send("Runtime.evaluate", { expression: `setT(${i / FRAMES})`, awaitPromise: true });
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1600, height: 538, scale: 1 } });
  writeFileSync(join(tmp, `f${String(i).padStart(3, "0")}.png`), Buffer.from(data, "base64"));
}
ws.close(); chrome.kill();
const gif = join(here, "club-cover.gif");
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(tmp, "f%03d.png"),
  "-filter_complex", "[0]split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
  "-loop", "0", gif]);
console.log(`club-cover.jpg (${Math.round(statSync(jpg).size / 1024)} KB) + club-cover.gif (${(statSync(gif).size / 1048576).toFixed(2)} MB, limit 10MB). Look at both before committing.`);
