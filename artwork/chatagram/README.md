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

## Trailer

`trailer/` makes a 30-second 1080p trailer: `trailer.html` (the scenes, cut to the music's bars), `music.mjs` (an
original 128 BPM track synthesised in Node, nothing licensed) and `record.mjs` (records the page with headless Chrome's
screencast and muxes the music with ffmpeg). The gameplay is the real overlay with a scripted, made-up chat.

```
node --experimental-websocket artwork/chatagram/trailer/record.mjs ~/Downloads/chatagram-trailer.mp4
```

`--vertical` records the 1080 × 1920 cut for Shorts, Reels and TikTok (the same scenes, re-laid out for a phone, key content
kept clear of the bottom where the platforms put their buttons and captions).

`thumbnail.mjs` renders the YouTube thumbnails from `thumbnail.html` at YouTube's recommended sizes
(support.google.com/youtube/answer/72431): 3840 × 2160 for the video and 2160 × 3840 for the Short, JPG under 2 MB.
Shorts thumbnails can only be set in YouTube Studio on a computer, on a verified account.

```
node --experimental-websocket artwork/chatagram/trailer/record.mjs ~/Downloads/chatagram-trailer-short.mp4 --vertical
node --experimental-websocket artwork/chatagram/trailer/thumbnail.mjs          # both thumbnails into ~/Downloads
```

Re-record after the overlay's look changes, and watch the result before sharing it.
