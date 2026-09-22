# Artwork

Images made for places other than the website itself. Every piece is built the same way:

1. **A design file** (`*.html`) that uses the site's own fonts, colours and character art straight from
   `public/assets/`, so the brand stays identical everywhere.
2. **A render script** (`render*.mjs`) that opens it in headless Chrome, screenshots it at 2× the size it's
   displayed at (or at the platform's exact size), and writes PNG / JPG / GIF output next to it
   (or, for the link-preview image, into `public/`).
3. **A README** with the file sizes, upload steps and the **measured display geometry**: what each platform
   crops, covers or compresses in each view. Most of this isn't documented by the platforms; it was measured
   from screenshots of the live pages, and it's what the layouts are built around.

| Folder | What | Render |
|---|---|---|
| `kick/` | 12 about panels, channel banner, offline banner | `node --experimental-websocket artwork/kick/render.mjs`, `…/kick/banner/render.mjs 1 15 2`, `…/kick/banner/render-offline.mjs` |
| `discord/` | animated profile banner | `node --experimental-websocket artwork/discord/render.mjs 90 15` |
| `x/` | X (Twitter) profile header | `node --experimental-websocket artwork/x/render.mjs` |
| `facebook/` | Facebook Page cover photo | `node --experimental-websocket artwork/facebook/render.mjs` |
| `og/` | link-preview image (`public/assets/img/og.jpg`) | `node --experimental-websocket artwork/og/render.mjs` |

Needs Google Chrome and ffmpeg. Changes here don't trigger a website deploy, except the OG render, which writes
into `public/`. The `channel-art` project skill has the step-by-step process for new or changed artwork.
