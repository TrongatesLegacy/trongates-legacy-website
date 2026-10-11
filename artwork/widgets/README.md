# Widgets page link-preview image

`og.html` → `public/widgets/assets/og.jpg` (1200 × 630), the image shown when `/widgets/` is shared. It uses the
widgets page's own look (docs/widgets.md, "The widgets page": the warm room, Lilita One, the deck logo) and has both
real games inside, in their seeded "still" modes (`/chatagram/play.html?still=1`, `/chaplinko/play.html?still=1`), so
it always matches them. Until 2026-10-11 `/widgets/` shared Chatagram's image, from when it was the only game; a new
game earns a place on this image too.

```
node --experimental-websocket artwork/widgets/render.mjs
```

The script serves `og.html` next to `public/` with the test server, waits for both games to be ready, screenshots it in
headless Chrome and writes the JPG. Re-render it when the page's look or either game's look changes, and look at the
result before committing.
