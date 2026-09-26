// One headless Chrome for the browser tests, driven over the DevTools protocol (no dependencies).
//
//   const chrome = await launch();                    // one per test file; always chrome.close() (after() does it)
//   const tab = await chrome.open(url, { width, height, mobile, reducedMotion });
//   await tab.eval('document.title');                // throws if the page doesn't answer in time (a hung page)
//   tab.errors                                        // uncaught exceptions and console.error calls, as text
//   await tab.close();
//
// Guards: every call into a page has a time limit (a page stuck in a loop can't answer, so the test fails instead of
// waiting); Chrome is killed on close, on process exit and on Ctrl-C; at most MAX_TABS tabs at once; requests to
// anywhere but the test server are blocked (no YouTube, Kick, Botrix or fonts from the internet).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_TABS = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CANDIDATES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
export const chromePath = () => CANDIDATES.find((p) => existsSync(p));

export async function launch({ allow = ['http://127.0.0.1'] } = {}) {
  const bin = chromePath();
  if (!bin) throw new Error('Chrome not found (set CHROME_PATH)');
  const profile = mkdtempSync(join(tmpdir(), 'tgl-test-chrome-'));
  const port = 9500 + Math.floor(Math.random() * 400);
  const flags = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--mute-audio', '--hide-scrollbars',
    ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'];
  const proc = spawn(bin, flags, { stdio: 'ignore' });
  let dead = false;
  const kill = () => { if (dead) return; dead = true; try { proc.kill('SIGKILL'); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  process.once('exit', kill);
  const onSignal = () => { kill(); process.exit(130); };
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);

  const http = (path, method = 'GET') => fetch(`http://127.0.0.1:${port}${path}`, { method }).then((r) => r.json());
  let version;
  for (let i = 0; i < 50 && !version; i++) { await sleep(100); version = await http('/json/version').catch(() => null); }
  if (!version) { kill(); throw new Error('Chrome did not start'); }
  const tabs = new Set();

  async function open(url, { width = 1280, height = 800, mobile = false, reducedMotion = false, init = '', timeout = 15000, wait = 'load' } = {}) {
    if (tabs.size >= MAX_TABS) throw new Error(`more than ${MAX_TABS} tabs open: close some first`);
    const target = await http('/json/new?about:blank', 'PUT');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('DevTools connection failed')); });
    let id = 0; const waiting = new Map(), listeners = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && waiting.has(d.id)) { const w = waiting.get(d.id); waiting.delete(d.id); clearTimeout(w.timer); d.error ? w.fail(new Error(d.error.message)) : w.ok(d.result); }
      else if (d.method) for (const fn of listeners.get(d.method) || []) fn(d.params);
    };
    const send = (method, params = {}, ms = timeout) => new Promise((ok, fail) => {
      const n = ++id;
      const timer = setTimeout(() => { if (waiting.has(n)) { waiting.delete(n); fail(new Error(`${method}: no answer in ${ms} ms (the page is hung or looping)`)); } }, ms);
      waiting.set(n, { ok, fail, timer }); ws.send(JSON.stringify({ id: n, method, params }));
    });
    const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, new Set()); listeners.get(method).add(fn); };
    const tab = {
      errors: [], requests: [], send, on,
      // run an expression in the page (awaits promises); returns its value
      async eval(expression, ms = timeout) {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
        if (r.exceptionDetails) throw new Error('in page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
        return r.result.value;
      },
      // poll until the expression is truthy
      async until(expression, ms = 5000, what = expression) {
        const end = Date.now() + ms;
        while (Date.now() < end) { if (await tab.eval(expression)) return true; await sleep(50); }
        throw new Error(`timed out after ${ms} ms waiting for: ${what}`);
      },
      async click(selector) { const ok = await tab.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); if (!ok) throw new Error('nothing to click: ' + selector); },
      async close() { tabs.delete(tab); try { await send('Page.close', {}, 2000); } catch {} try { ws.close(); } catch {} await http(`/json/close/${target.id}`).catch(() => {}); },
    };
    tabs.add(tab);
    on('Runtime.exceptionThrown', (p) => tab.errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
    on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'assert') tab.errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description ?? '').join(' ')); });
    on('Fetch.requestPaused', (p) => {
      tab.requests.push(p.request.url);
      const ok = /^(data|blob):/.test(p.request.url) || allow.some((a) => p.request.url.startsWith(a));
      send(ok ? 'Fetch.continueRequest' : 'Fetch.failRequest', ok ? { requestId: p.requestId } : { requestId: p.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    if (reducedMotion) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
    const loaded = new Promise((ok) => on(wait === 'load' ? 'Page.loadEventFired' : 'Page.domContentEventFired', ok));
    await send('Page.navigate', { url });
    let loadTimer;
    await Promise.race([loaded, new Promise((_, fail) => { loadTimer = setTimeout(() => fail(new Error(`${url} did not load in ${timeout} ms`)), timeout); })]).finally(() => clearTimeout(loadTimer));
    return tab;
  }

  const chrome = {
    open,
    async close() {
      for (const t of [...tabs]) await t.close().catch(() => {});
      kill();
      process.off('exit', kill); process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    },
  };
  return chrome;
}

// Instrumentation for runaway timers: counts the page's pending setTimeout/setInterval calls. Pass as open({ init }).
export const TIMERS = `(() => {
  const live = new Set(), st = setTimeout, ct = clearTimeout, si = setInterval, ci = clearInterval;
  window.__timers = { live, made: 0 };
  window.setTimeout = function (fn, ms, ...a) { const id = st(function () { live.delete(id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...a); live.add(id); window.__timers.made++; return id; };
  window.clearTimeout = (id) => { live.delete(id); ct(id); };
  window.setInterval = function (fn, ms, ...a) { const id = si(fn, ms, ...a); live.add(id); window.__timers.made++; return id; };
  window.clearInterval = (id) => { live.delete(id); ci(id); };
})();`;
