# Chaplinko link-preview image and pictures

`og.html` → `public/chaplinko/assets/og.jpg` (1200 × 630), the image shown when `/chaplinko/` is shared. It uses
Chaplinko's own brand (docs/widgets.md, "The Chaplinko page": midnight, cobalt, the tangerine ball, Bungee) and has the
real board inside, in its seeded "still" mode (`play.html?still=1`), so it always matches the game.

```
node --experimental-websocket artwork/chaplinko/render.mjs
node --experimental-websocket artwork/chaplinko/render-previews.mjs [name…]
```

`render.mjs` serves `og.html` next to `public/` with the test server, screenshots it in headless Chrome and writes the
JPG. `render-previews.mjs` renders the pictures the pages show before a live board starts: every theme with its
background (the Looks gallery, the widgets page), `clear` (transparent, the default: the hero and the set-up preview)
and `combined` (the board with the leaderboard beside it), into `public/chaplinko/assets/themes/`. Re-run both after any
change to the board's look, and look at the results before committing.

The mark (`public/chaplinko/assets/icon.svg`) is hand-drawn SVG: a cobalt tile, a 1-2-3 triangle of pegs, the tangerine
ball falling in, and the slots with the third lit jackpot pink.
