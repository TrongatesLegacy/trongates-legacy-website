// Screenshot the site in headless Chrome, for checking visual changes. Needs `node dev.mjs` running and
// Google Chrome installed. Node 21+ needs --experimental-websocket (built in from Node 22).
//
//   node --experimental-websocket scripts/shot.mjs [options]
//
//   --url=http://localhost:8888/   page to load
//   --width=1280 --height=800      viewport (use 390x844 --mobile for a phone, 375x667 for iPhone SE)
//   --mobile                       phone emulation: 2x pixels + touch
//   --form=cyan|yellow|red|princess|blobfish   pick a form (as if the visitor chose it)
//   --fresh                        clear localStorage first (first-visit state, shows the form hint)
//   --live                         force the on-air state (same as ?live=1)
//   --reduced-motion               emulate prefers-reduced-motion
//   --selector=#videos             scroll this element into view before the shot
//   --full                         capture the whole page as numbered viewport-sized shots
//   --eval="js"                    run this in the page before capturing (can return a value, which is printed)
//   --out=/tmp/shot                output path prefix (default /tmp/tgl-shot)
//
// Prints the files written. Always look at them: layout bugs rarely show up in code review.
import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (k, d) => {
  const hit = process.argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
  if (!hit) return d;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const W = +arg("width", 1280), H = +arg("height", 800), MOBILE = !!arg("mobile", false);
const OUT = arg("out", "/tmp/tgl-shot");
let url = arg("url", "http://localhost:8888/");
if (arg("live", false)) url += (url.includes("?") ? "&" : "?") + "live=1";

const profile = join(tmpdir(), "tgl-shot-chrome");
rmSync(profile, { recursive: true, force: true });
const port = 9300 + Math.floor(Math.random() * 90);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let tabs;
  for (let i = 0; i < 30 && !tabs; i++) { await sleep(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
  const load = async () => { await send("Page.navigate", { url }); await sleep(4000); };

  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE });
  if (MOBILE) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  if (arg("reduced-motion", false)) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await load();
  const form = arg("form", null);
  if (arg("fresh", false) || form) {
    await ev(form ? `localStorage.setItem('tgl-form', ${JSON.stringify(form)})` : "localStorage.clear()");
    await load();
  }
  const sel = arg("selector", null);
  if (sel) { await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'start', behavior: 'instant' }); scrollBy({ top: -80, behavior: 'instant' })`); await sleep(1500); }
  const js = arg("eval", null);
  if (js) { const v = await ev(js); if (v !== undefined) console.log("eval:", typeof v === "string" ? v : JSON.stringify(v)); await sleep(800); }

  const capture = async (path) => { const { data } = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(data, "base64")); console.log(path); };
  if (arg("full", false)) {
    const total = await ev("document.documentElement.scrollHeight");
    for (let y = 0, n = 0; y < total; y += H - 80, n++) {
      await ev(`scrollTo({ top: ${y}, behavior: 'instant' })`); await sleep(1200);
      await capture(`${OUT}-${String(n).padStart(2, "0")}.png`);
    }
  } else {
    await capture(`${OUT}.png`);
  }
  console.log("horizontal overflow:", (await ev("document.documentElement.scrollWidth")) > W ? "YES (something is wider than the viewport)" : "none");
  ws.close();
} finally {
  chrome.kill();
}
