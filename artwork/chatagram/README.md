# Chatagram link-preview image

`og.html` → `public/chatagram/assets/og.jpg` (1200 × 630), the image shown when `/chatagram/` (or `/widgets/`) is
shared. It uses Chatagram's own brand (docs/widgets.md, "The Chatagram page") and has the real overlay inside, in its
seeded "still" mode (`play.html?still=1`), so it always matches the game.

```
node --experimental-websocket artwork/chatagram/render.mjs
```

The script serves `og.html` next to `public/` with the test server, screenshots it in headless Chrome and writes the
JPG. Re-render it when the brand or the overlay's look changes, and look at the result before committing.

`render-previews.mjs` renders the theme pictures the pages show before a live game starts (every theme, compact and
full) into `public/chatagram/assets/themes/`. Re-run it after any change to the overlay's look.
