# Trongate's Legacy

Single-page site for [Trongate's Legacy](https://kick.com/trongateslegacy) — live on Kick.

- `public/index.html` — the whole site (HTML, CSS and JS inline, no build step)
- `public/assets/img/` — optimised WebP character art (four mouth/eye states per form)
- `netlify/functions/feed.mjs` — `/api/feed`: latest YouTube videos + shorts and Kick live status
- `dev.mjs` — local preview: `node dev.mjs` → http://localhost:8888

## Deploying to Netlify

Import the repo in Netlify; `netlify.toml` already sets the publish directory (`public`) and the
functions directory. No build command is needed.

### Live status (optional)

Kick's website API usually blocks server-side requests, so for a reliable LIVE badge and auto-loading
player, create an app at <https://kick.com/settings/developer> and set `KICK_CLIENT_ID` and
`KICK_CLIENT_SECRET` as Netlify environment variables. Without them the site still works; it just
shows a neutral status.

After the first deploy, change the `og:image` URL in `public/index.html` to an absolute URL on the
final domain so link previews work everywhere.
