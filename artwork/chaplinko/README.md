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

`emotes.mjs` draws Chaplinko's own animated emotes (a bouncing ball, a beating heart, a spinning star, a wobbling GG, in
the brand's colours) into `public/chaplinko/assets/emotes/*.gif` (64 × 64, 16 frames, transparent). The pretend chat on
the page drops them, so the hero and the preview show animated emotes playing as they fall. They're original drawings:
never use a real streamer's emotes on the page.

```
node --experimental-websocket artwork/chaplinko/emotes.mjs
```

## Trailer

`trailer/` makes a 30-second 1080p trailer, built the same way as Chatagram's but deliberately unlike it (the owner,
2026-09-30): a late-night arcade (a neon cobalt grid rolling toward you, scanlines, glowing titles that flicker on, the
camera pushing on the beat) against Chatagram's cartoon slams and pops, and **synthwave** (96 BPM, F minor: detuned saw
pads, octave bass, big gated snares, plinks when the ball hits pegs) against Chatagram's 128 BPM house. The music is
original, synthesised by `music.mjs`: nothing licensed, no attribution needed (a "royalty-free" download would bring its
own terms to keep).

```
node --experimental-websocket artwork/chaplinko/trailer/record.mjs ~/Downloads/chaplinko-trailer.mp4
node --experimental-websocket artwork/chaplinko/trailer/record.mjs ~/Downloads/chaplinko-trailer-short.mp4 --vertical
node --experimental-websocket artwork/chaplinko/trailer/thumbnail.mjs            # both thumbnails into ~/Downloads
node artwork/chaplinko/trailer/twitter.mjs                                       # the Short for X: the thumbnail as its first frame
```

`--vertical` records the 1080 × 1920 cut for Shorts, Reels and TikTok: the same scenes laid out for a phone (the board
alone with the chat under it, the leaderboard in its own scene), key content kept clear of the bottom. `thumbnail.mjs`
renders `thumbnail.html` at YouTube's recommended sizes (3840 × 2160 and 2160 × 3840, under 2 MB): "CHAT PLAYS PLINKO",
`!plinko`, and the real board mid jackpot streak.

Twelve bars of 2.5 s: your stream as it is, a game with ordinary chat ("YOUR STREAM."), then chat typing `!plinko` and
the board landing on it with balls pouring ("NEEDS MORE PLINKO."; the owner found a one-ball opening didn't make sense),
`!plinko` typed and the ball dropping into the wordmark as its O, the game with chat and emotes, a raid and Frenzy, a jackpot streak and the card exploding, a player
surging up the leaderboard to #1, quick cuts (the looks, Twitch + Kick, over your game, free), the end card (the page
and kick.com/trongateslegacy). The board and
leaderboard are the real pages (`play.html`, `leaderboard.html`) with a scripted, made-up chat; the trailer answers "is it
live" itself, since recording can't reach Twitch.
