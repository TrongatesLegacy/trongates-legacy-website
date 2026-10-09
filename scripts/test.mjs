// Runs the tests (docs/testing.md). No dependencies: Node's own test runner.
//
//   node scripts/test.mjs            everything: unit, loops, browser
//   node scripts/test.mjs --fast     unit + loops only (a few seconds, no browser)
//   node scripts/test.mjs --browser  browser tests only (one headless Chrome)
//   node scripts/test.mjs --changed=<git range>   what the pre-push hook runs: fast always, browser too when the
//                                    range touches public/, netlify/ or netlify.toml
//   node scripts/test.mjs tests/loops/colour-sync.test.mjs   just these files
//
// Every test has a time limit, and each tier has one too: a test that runs away (a loop, a hung page) fails and
// is killed instead of spinning. The browser tier uses one Chrome at a time and always closes it.
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
const files = (dir) => (existsSync(ROOT + dir) ? readdirSync(ROOT + dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `${dir}/${f}`) : []);
// Node 21 needs a flag for WebSocket (the browser tests' Chrome connection); 22+ has it built in
const ws = typeof WebSocket === 'undefined' ? ['--experimental-websocket', '--no-warnings=ExperimentalWarning'] : [];

const TIERS = {
  fast: { files: [...files('tests/unit'), ...files('tests/loops')], testTimeout: 30000, tierTimeout: 120000, concurrency: [] },
  browser: { files: files('tests/browser'), testTimeout: 90000, tierTimeout: 600000,   // 10 min: the tier takes ~5 min locally and longer on GitHub (2026-10-09); each test's 90 s still catches a loop concurrency: ['--test-concurrency=1'] },
};

let run = [];
const explicit = args.filter((a) => !a.startsWith('--'));
if (explicit.length) {
  const browser = explicit.filter((f) => f.includes('tests/browser/')), fast = explicit.filter((f) => !f.includes('tests/browser/'));
  if (fast.length) run.push({ name: 'fast', ...TIERS.fast, files: fast });
  if (browser.length) run.push({ name: 'browser', ...TIERS.browser, files: browser });
} else if (flag('fast')) run = [{ name: 'fast', ...TIERS.fast }];
else if (flag('browser')) run = [{ name: 'browser', ...TIERS.browser }];
else if (flag('changed')) {
  const range = flag('changed').split('=')[1];
  let touched = true;
  try { touched = execFileSync('git', ['diff', '--name-only', range], { cwd: ROOT, encoding: 'utf8' }).split('\n').some((f) => /^(public\/|netlify\/|netlify\.toml$|tests\/browser\/|tests\/helpers\/)/.test(f)); } catch {}
  run = [{ name: 'fast', ...TIERS.fast }];
  if (touched) run.push({ name: 'browser', ...TIERS.browser });
  else console.log('No site files changed: skipping the browser tests.');
} else run = [{ name: 'fast', ...TIERS.fast }, { name: 'browser', ...TIERS.browser }];

function tier(t) {
  if (!t.files.length) return Promise.resolve(0);
  console.log(`\n── ${t.name}: ${t.files.length} file${t.files.length === 1 ? '' : 's'} ──`);
  return new Promise((done) => {
    const child = spawn(process.execPath, [...ws, '--test', '--test-reporter=spec', `--test-timeout=${t.testTimeout}`, ...t.concurrency, ...t.files],
      { cwd: ROOT, stdio: 'inherit', detached: true });
    // the whole tier's limit: kill its process group (test files and any Chrome they started)
    const limit = setTimeout(() => {
      console.error(`\n✖ ${t.name} tests still running after ${t.tierTimeout / 1000}s: killed (something is looping or hung)`);
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, t.tierTimeout);
    const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} process.exit(130); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    child.on('exit', (code, signal) => { clearTimeout(limit); process.off('SIGINT', stop); process.off('SIGTERM', stop); done(signal ? 1 : code); });
  });
}

const started = Date.now();
let failed = 0;
for (const t of run) failed += (await tier(t)) ? 1 : 0;
console.log(`\n${failed ? '✖ tests failed' : '✔ all tests passed'} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
process.exit(failed ? 1 : 0);
