# Testing

Automated tests for the website and the OBS scenes, run before every push. They're plain Node (`node:test`,
`node:assert`) with no dependencies, and live in `tests/` outside `public/`, so they're never served and never
trigger a Netlify build. They sit alongside the manual checks in [verification.md](verification.md)
(screenshots, Lighthouse), not in place of them: tests catch broken logic, loops and regressions; screenshots and
Lighthouse catch how things look and load.

## Running them

```
node scripts/test.mjs              # everything: unit, loops, browser (~1.5 min)
node scripts/test.mjs --fast       # unit + loops, no browser (~2 s)
node scripts/test.mjs --browser    # browser tests only
node scripts/test.mjs tests/loops/colour-sync.test.mjs    # one file
TGL_SEEDS=400 node scripts/test.mjs tests/loops/colour-sync.test.mjs   # the randomised loop tests, 10× longer
scripts/typecheck.sh               # type-check the OBS scripts from their JSDoc (TypeScript via npx, nothing installed)
```

They run by themselves before every push: `.githooks/pre-push` runs the fast tests, plus the browser tests when
the push touches `public/`, `netlify/` or `netlify.toml`, and **a failure blocks the push**. The hook is switched
on per clone with `git config core.hooksPath .githooks` (a repo-local setting). `git push --no-verify` skips it,
for emergencies only. GitHub Actions (`.github/workflows/test.yml`) runs everything again on every push, and the
daily feed update runs the fast tests before it commits `feed.json`.

**Types:** the OBS scripts are plain JavaScript with JSDoc comments, checked by TypeScript without a build:
`jsconfig.json` (what's checked; VS Code reads it and underlines mistakes as you type) and `types/obs-globals.d.ts`
(what each script puts on `window`). `scripts/typecheck.sh` runs the full check; GitHub Actions runs it on every push.
It isn't in the pre-push hook because TypeScript comes through `npx` (the network, the first time).

## The three tiers

| Tier | Where | What it covers |
|---|---|---|
| Unit | `tests/unit/` | `model.js` (settings → scene addresses, settings links, `chatBox` geometry), `theme.js` (veadotube state → form, `hide=`, where a scene starts), `/api/feed` and `/api/obs-widgets` with YouTube, Kick and Netlify faked, `update-feed.mjs`, `feed.json`'s shape, the character art's sizes (every form 640 × 960 and 400 × 600, read from the files), every script parsing, the generated OBS pages matching `obs/build-scenes.py` |
| Loops | `tests/loops/` | Anything that could loop, pile up or flicker, on a simulated OBS browser (below): the colour sync between the dock, veadotube and every scene; the circuit breaker against a storm between two misbehaving pages; the dock's veadotube switching; reconnecting to veadotube and OBS; the transition overlay's timing (covered at the cut, restarts, never stuck covered) |
| Browser | `tests/browser/` | One headless Chrome against a local test server: the website (loads clean on desktop and phone, form picking, fast switching settles with no runaway timers, live state, the video fallback, reduced motion; `form-themes.test.mjs`: switching between Tron, Princess Trina and the Blobfish moves nothing up or down on desktop or phone, measured element by element, each form's switch-in style, a returning visitor's look before first paint, `?form=`, and every moving floor looping without a visible jump); every OBS page loads clean, `hide=`, the cycling scenes' glitch queue and hidden-scene behaviour, the goal widget's copies, the shared chat's geometry measured against the drawn frame; the dock against a fake OBS (rescans on an event flood, Review & apply and Tidy leaving nothing behind, the colour buttons, every tab drawing, adding a widget from Sources, the Transitions section, Form looks reaching the scenes' addresses); `obs-looks.test.mjs`: the OBS form looks (switching looks moves nothing in any scene or widget page, the titles draw in the look's font inside their column, the look from the first frame and `looks=`, a cycling scene carrying the look and each form's switch-in, every look's floor looping seamlessly, no endless animation touching the layout); the transition overlay measured from its canvas (fully covered at the cut in every look, clear before and after, in the form's colour and look); the rescue dock (refreshes only Trongates sources, works with the control dock's code broken) |

Chatagram and the stream widgets (docs/widgets.md) have their own files in each tier: `chatagram-words`, `chatagram-game`
and `widgets-lib` (unit), `widgets-chat` and `chatagram-flow` (loops: reconnecting on the virtual clock, hours of play
without a runaway), `chatagram` (browser: a whole game from fake Twitch and Kick sockets, every layout and theme fits,
theme messages, the OBS wrapper, the set-up link, reduced motion).

## How a loop gets caught

- **The simulated OBS browser** (`tests/helpers/sim.mjs`, `obs-world.mjs`): the dock and every scene as separate pages in
  one browser profile, with a fake veadotube and a fake OBS WebSocket, on a virtual clock. Minutes of virtual time
  run in milliseconds, and it's seeded, so any failure replays exactly. Shared storage follows Chromium's rule
  (`cached_storage_area.cc`): a change from another page arriving while this page's own write is in flight still
  fires the storage event but doesn't change the page's copy. That ordering is what let two quick switches bounce
  for ever (2026-09-26), and a real browser rarely produces it on demand.
- **Settle:** after the last input the virtual clock must run dry within 20,000 events. A loop never does, and the
  test fails with what each page applied, e.g. `chatting: pbpbpbpb…`.
- **Agree:** every page ends on veadotube's real state (or the last button press, if veadotube never answers).
- **No flicker:** a page changes colour at most once per input, however many routes the input reaches it by.
- **Budgets:** one veadotube switch per button press; a bounded number of rescans for a flood of OBS events;
  timers created per second on a settled website page; connection attempts per minute while something is down.
- **Time limits:** every test has one (30 s fast, 90 s browser), each tier has one (2 and 5 minutes), and every
  call into a browser page has one (15 s). A page stuck in a loop can't answer, so the test fails, and the runner
  kills the whole process group, Chrome included.
- **Proofs:** `colour-sync.test.mjs` and `obs-scenes.test.mjs` each run their test against the code from before the fix
  it guards (read from git: `e181e2d~1`, `7f5f65e~1`) and require it to fail there. A test that passes on buggy code
  is a broken test. (They skip if the git history isn't there.)

## Staying light

One Chrome at a time, at most four tabs, browser files one after another, a fresh temporary profile that's deleted
afterwards, and every request to anywhere but the local test server blocked (no YouTube, Kick, Botrix or fonts
from the internet). The dock is only ever pointed at the fake OBS and veadotube on free local ports, never at a
real OBS on 4455.

## Adding tests

- **Every bug fix starts with a test that fails**, then the fix. If it's a loop, flicker or pile-up, add it to the
  loop tests and, where the old code is in git, a proof that the test fails on it.
- **Every new feature adds its tests** in the tier that fits: pure logic → unit; timing between pages, sockets or
  timers → loops; anything that needs a real page → browser.
- Keep the fast tier fast (a few seconds): no real waiting (the feed tests shrink YouTube's retry pauses), no
  browser. Put a browser test in only when the simulation can't show it.
- Browser tests wait for a state (`tab.until(…)`), never a guessed pause where a state exists to wait for; the
  website's buttons only work once its script has started (`booted()` in `website.test.mjs`).
- Helpers: `sim.mjs` (clock, pages, storage, fake network, fake veadotube and OBS), `obs-world.mjs` (the dock and all
  scenes wired up), `real-net.mjs` (the same fakes on real sockets), `obs-model.mjs` (a fake OBS with scenes and
  sources), `server.mjs` (the site, faked `/api/*`, and `files:` to serve an older file for a proof),
  `chrome.mjs` (`launch`, `open`, `eval`, `until`, `click`, `errors`, and `TIMERS` to count a page's timers).

## What the tests don't cover

How things look (screenshots and measuring, [verification.md](verification.md)); loading performance (Lighthouse);
the real OBS, veadotube, SMTC Bridge, Botrix and Kick (the fakes follow their documented behaviour, and OBS's
built-in Chromium is older than desktop Chrome); the dock's adopt/ignore buttons, Measure avatar (needs veadotube's
Spout picture) and settings import/export buttons; the YouTube player. When something breaks in one of those, the fix
comes with a test that reproduces it.
