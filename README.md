# Trongate's Legacy

Single-page site for [Trongate's Legacy](https://kick.com/trongateslegacy) — live on Kick.

- `public/index.html` — the whole site (HTML, CSS and JS inline, no build step)
- `public/assets/img/` — optimised WebP character art (four mouth/eye states per form)
- `netlify/functions/feed.mjs` — `/api/feed`: latest YouTube videos + shorts and Kick live status
  (needs `YOUTUBE_API_KEY`, `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` set in Netlify)
- `public/feed.json` — static fallback video list, refreshed daily by `.github/workflows/update-feed.yml`
- `dev.mjs` — local preview: `node dev.mjs` → http://localhost:8888

## Deploying to Netlify

Import the repo in Netlify; `netlify.toml` already sets the publish directory (`public`) and the
functions directory. No build command is needed.

### Reliable video updates (recommended)

YouTube's RSS feeds often reject datacentre IPs, including GitHub Actions. For dependable updates,
create a YouTube Data API v3 key in Google Cloud Console (free) and add it as a repository secret
named `YOUTUBE_API_KEY` (GitHub → Settings → Secrets and variables → Actions). Without it the
workflow still tries the RSS feeds every hour and keeps the last good list when they fail.

### Previewing the live state

Running locally (`node dev.mjs`), a **DEV · mock live** button appears bottom-left — click it or press
`L` to toggle the on-air state. It only exists on localhost. On any host, adding `?live=1` to the URL
forces the live look for that page load.

### Live status (optional)

Kick's website API usually blocks server-side requests, so for a reliable LIVE badge and auto-loading
player, create an app at <https://kick.com/settings/developer> and set `KICK_CLIENT_ID` and
`KICK_CLIENT_SECRET` as Netlify environment variables. Without them the site still works; it just
shows a neutral status.
