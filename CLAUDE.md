# Trongates Legacy

Single-page site for the streamer **Trongates Legacy** (kick.com/trongateslegacy), plus the Kick and Discord
channel artwork. Live at https://www.trongateslegacy.com (Netlify). This project is built and maintained by AI;
this file is the entry point. Read the doc for the area you're touching before changing it:

| Doc | Read before |
|---|---|
| [docs/design-system.md](docs/design-system.md) | any visual change: colours, type, forms/theming, motion, character sizing |
| [docs/website.md](docs/website.md) | changing a section, the live state, video feed, SEO or performance |
| [docs/content-and-voice.md](docs/content-and-voice.md) | writing any copy, speech lines or names |
| [docs/verification.md](docs/verification.md) | finishing any change: how to check it actually works and looks right |
| [kick-panels/README.md](kick-panels/README.md) | Kick about panels, channel banner, offline banner |
| [discord/README.md](discord/README.md) | Discord profile banner |

Project skills in `.claude/skills/` hold the step-by-step procedures: **verify-site-change** (after any
website edit) and **channel-art** (Kick/Discord/other platform artwork).

## Hard rules

- **Git identity is repo-local, never global.** The repo's `.git/config` commits as
  `Trongate's Legacy <273253984+TrongatesLegacy@users.noreply.github.com>` and pushes with the
  TrongatesLegacy account's token. The machine's global git/gh identity is the owner's work account: never
  change it, never `gh auth switch`. For `gh` commands use `GH_TOKEN=$(gh auth token --user TrongatesLegacy) gh …`.
- **Never commit secrets.** `YOUTUBE_API_KEY`, `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` live in Netlify env vars
  (and `YOUTUBE_API_KEY` also as a GitHub Actions secret). Netlify's secret scanner fails the build if a
  secret's *value* appears in the repo.
- **No build step, no framework, no dependencies.** The site is `public/index.html` (HTML, CSS and JS inline)
  plus static assets. Keep it that way unless the owner asks otherwise. See docs/website.md for why.
- **Measure, don't eyeball.** Artwork has transparent margins, so image boxes lie about where a character
  actually is. Alignment and sizing decisions are made from measured visible pixels (docs/verification.md).
- **Verify visually before saying done.** Screenshot desktop and phone with `scripts/shot.mjs` and look at the
  images. Check reduced motion for anything animated.
- **Run Lighthouse twice for every website change** (anything under `public/` or `netlify/`):
  `scripts/lighthouse.sh --local` before pushing (catches accessibility, SEO, best-practice, layout-shift and
  blocking regressions), then `scripts/lighthouse.sh` on the live site once deployed (the only trustworthy
  performance numbers). Report both. Don't leave it below baseline (live: mobile performance ≥95, desktop ≥98;
  both: accessibility and best practices 100, all SEO audits passing).
- **Commit small and push** when a change is verified; the owner reviews on the live site. Pushes that only
  touch files outside `public/`, `netlify/` and `netlify.toml` don't trigger a Netlify build (see netlify.toml).

## Layout

```
public/index.html            the whole site
public/assets/img/           character art (WebP, 400w + 640w), logos, OG image, icons
public/assets/fonts/         self-hosted Orbitron + Chakra Petch (latin woff2)
public/feed.json             static fallback list of YouTube videos/shorts (refreshed daily by CI)
public/robots.txt, sitemap.xml
netlify/functions/feed.mjs   GET /api/feed: live YouTube list + Kick live status
netlify.toml                 publish dir, functions dir, headers, build-skip rule
scripts/update-feed.mjs      refreshes public/feed.json (run by .github/workflows/update-feed.yml)
scripts/shot.mjs             headless-Chrome screenshots for checking changes
dev.mjs                      local server: public/ + /api/feed on http://localhost:8888
kick-panels/                 Kick panel images, banner, offline banner, their renderers and guide
discord/                     Discord profile banner, renderer and guide
```

## Commands

```
node dev.mjs                                                  # local preview on :8888
node --experimental-websocket scripts/shot.mjs                # screenshot; options in the file's header
scripts/lighthouse.sh --local                                  # Lighthouse before pushing (needs dev.mjs running)
scripts/lighthouse.sh                                          # Lighthouse on the live site after deploy
YOUTUBE_API_KEY=… node scripts/update-feed.mjs                 # refresh public/feed.json by hand
node --experimental-websocket kick-panels/render.mjs           # re-render Kick panels
node --experimental-websocket kick-panels/banner/render.mjs 1 15 2
node --experimental-websocket kick-panels/banner/render-offline.mjs
node --experimental-websocket discord/render.mjs 90 15
```

Node here is v21, which needs `--experimental-websocket` for the Chrome DevTools scripts. Tools available on
the owner's Mac: Google Chrome, ffmpeg, cwebp/img2webp, `gh`. No ImageMagick, no Python imaging libraries.
Source artwork lives outside the repo in `~/Dropbox/Kick/png-tuber/` and `~/Dropbox/Kick/lulu-gang/`.
