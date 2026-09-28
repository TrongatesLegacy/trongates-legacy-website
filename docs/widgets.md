# Stream widgets and Chatagram

Free chat games and overlays for **any streamer**, on Twitch, Kick or both at once, at `/widgets/` (the list) and one
page per widget. The first is **Chatagram** (`/chatagram/`), an anagram game chat plays by typing words, like
wos.gg but reading Twitch and Kick together. Everything is static files: no server, no database, no logins, no Netlify
functions. A streamer's settings live in the link they paste into OBS.

**Widgets stay generic.** Nothing in `public/widgets/` or `public/chatagram/` knows about Tron's forms, veadotube or
the Lulu Gang. Anything specific to Trongates Legacy's stream lives in `public/obs/` (see "In Trongates Legacy's
scenes" below).

## Files

```
public/widgets/index.html                 the widgets list (the site's own style; linked last in the homepage nav)
public/widgets/lib/settings.js            settings ⇄ link, from a per-widget schema
public/widgets/lib/chat.js                every platform's chat as one reconnecting stream of messages
public/widgets/lib/platforms/twitch.js    Twitch: anonymous IRC over WebSocket
public/widgets/lib/platforms/kick.js      Kick: Pusher, chatroom looked up from the channel name
public/widgets/lib/theme.js, themes.css   the eight themes, the accent, the live theme message, reduced motion
public/chatagram/index.html + setup.js    the Chatagram page: hero, how it works, themes, set-up with live preview, FAQ
public/chatagram/play.html/.css/.js       the overlay OBS loads (noindex)
public/chatagram/game.js                  the rules only: no drawing, no timers (unit-tested)
public/chatagram/settings.js              every setting, its default and range
public/chatagram/words.js                 word logic shared by the overlay and the builder
public/chatagram/words/                   words.txt, seeds.txt (built), LICENSE.txt (the sources' notices)
public/chatagram/demo.js                  a pretend chat (the preview, screenshots, still pictures)
public/chatagram/assets/                  icon.svg (logo mark, favicon), og.jpg (link preview)
public/obs/chatagram.html                 Chatagram in Trongates Legacy's form colours (OBS)
scripts/build-words.mjs, scripts/words/   builds the word lists; the LDNOOBW list and our blocklist
artwork/chatagram/                        the link-preview image's design and render script
```

## Reading chat

`chat.js` connects each platform the streamer filled in and turns every message into one shape:
`{ platform, user, name, text, mod, owner }`. It reconnects after a drop, waiting 1, 2, 5, 10, then 30 s (never more
than a few attempts a minute), goes back to quick retries after 30 s connected, and reports each platform's state
(connecting, live, retrying, error), which the overlay shows as a light in its footer.

- **Twitch** allows anonymous reading: connect to `wss://irc-ws.chat.twitch.tv`, `NICK justinfan<number>`,
  `JOIN #channel`, answer `PING`. Tags give the display name and the moderator/broadcaster badges. Official and stable.
- **Kick** is read the way Kick's own site reads it: Pusher (`wss://ws-us2.pusher.com/app/<key>`), channel
  `chatrooms.<id>.v2`, event `App\Events\ChatMessageEvent`. The chatroom id comes from
  `kick.com/api/v2/channels/<name>` (Kick allows browsers on other sites to ask); the set-up page looks it up and puts
  it in the link (`kickid=`) so the overlay doesn't need to, and it can be typed by hand in Advanced settings.
  Unofficial but public. **If Kick chat stops working**: Kick has changed its Pusher app key before; it's `KEY` at the
  top of `platforms/kick.js`. Find the current one in the Network tab of kick.com (the `ws-us2.pusher.com/app/…`
  socket) and update it. Badges come from both `identity.badges[].type` and `identity.badges_v2[].name`.
- **Adding a platform**: one file in `platforms/` with `channel()` (tidy what was typed), `parse()` (one frame → a
  message) and `connect()` (describe the socket to `chat.js`), its label and brand colour; add it to `chat.js` and a
  schema field in each widget. The games only ever see the one message shape.

## Settings in the link

Each widget describes its settings once (`public/chatagram/settings.js`: type, default, range). The set-up page writes
the link from it and the overlay reads it back (`Widgets.settings.encode/decode`). **Only settings that differ from
their default go in the link**, so links stay short and a default can change later without old links pinning the old
value. Anything missing, unknown or out of range falls back to the default. `!` and `,` stay readable in links.
The set-up page also opens any existing link's settings: `/chatagram/?kick=name&…`.

## Themes and the live theme message

Eight themes, each only CSS variables in `themes.css` (backgrounds, panels, tiles, text, fonts, radius, edges):
**chatagram** (the default, the brand's colours), neutral, light, neon, candy, royal, deep, cozy. Any accent colour
(`accent=`). `theme.js` has the same list and each theme's own accent (a test checks they agree). A new theme is one
block in `themes.css` plus its name and accent in `theme.js`, and every widget gets it.

**Live theme message**: the page a widget is embedded in can change its look without a reload (a reload would
restart the game):

```js
frame.contentWindow.postMessage({ type: 'widget-theme', theme: 'neon', accent: 'ff4155' }, '*');
```

Either field can be left out; `accent: ''` goes back to the theme's own; anything invalid is ignored. This is a public,
documented interface: anyone can use it, and it's how Trongates Legacy's own scenes follow the form.

## Chatagram: the game

`game.js` is the rules and nothing else: it takes chat messages (`handle`) and a clock (`tick` when `nextWake()` says
something is due) and reports everything that happens as events for the overlay to draw. The clock and randomness are
passed in, so the tests replay any game exactly.

- **A round**: a scrambled seed word (6 letters at level 1 on Normal, longer as levels go up; `words.js` DIFFICULTY).
  Every shorter word of 3+ letters from the difficulty's word tier is a slot. The goal is 65% of them. Finding them all
  ends the round at once; otherwise time decides: goal met → cleared (1–3 stars), missed → game over.
- **Scoring**: 2 points per letter minus 4 (3 letters 2, 5 letters 6), +5 for the longest word. **Bonus words** (real
  but rarer, or the other country's spelling) score 1 and never take a slot. Players are `platform:user`, so the same
  name on Twitch and Kick is two players.
- **The shuffle**: every 10 s, whatever chat does (a setting; 0 = never).
- **Hidden and fake letters** from level 3: one letter shows as `?` until half time; one extra letter that isn't in the
  word drops out once half the goal is found.
- **Padlocks** (off by default: people don't know them): 2–4 checkpoints on the countdown; a player who finds a word
  can't score again until the timer passes the next one. Stops one fast typer taking every word.
- **Commands** `!start`, `!next`, `!skip`, `!reset` (renamable, several names each, any capitals; who: only the
  owner, owner and mods, or everyone). Reset also clears the all-time scores.
- **Flow**: after a level, the next one starts in 10 s (or waits for the next command); after game over, a new game in
  15 s (or waits for start). "Keep playing by itself" on the set-up page sets both.
- **Saved**: the game is saved in the OBS source's browser storage as it goes, so a refresh carries on. A save older
  than 10 minutes starts a new game but keeps the all-time scores (unless "remember scores" is off).
- Bots are ignored as players (Botrix, Nightbot, StreamElements… editable), and streamers can block words of their own.

## Chatagram: the overlay

`play.html` is the OBS browser source: **full** 960 × 540 (16:9, exactly half of 1920 × 1080, so a full-screen source
shows it at a clean 2×; every word slot in columns by length; the layout measures what fits the width and picks the biggest
letter boxes it can, with players' names beside the words when they fit, without them for very big puzzles; narrow
columns shorten their heading to the length) or **compact** 560 × 230 (bigger tiles, the last three finds, the count). The board scales to fit if the
source is another size. With one platform the badges beside names go, and the summary's "Twitch vs Kick" box becomes
round highlights (fastest find, longest streak, last-second save).

- **The shuffle, matched to wos.gg frame by frame**: it isn't a 3D cube. Each tile is a fixed window with a strip of
  full-size letters scrolling down behind it, 0–2 letters passing on the way (about 0.1 s each, with motion blur and a
  soft stop), and fixed shading over the window (darker top and bottom) that makes it read as a drum. Letters that
  don't change stay still.
- **Other moments**: tiles drop in at the start of a round; the letters of a find light up in order; the banner
  scrambles into the word; **the find lights up where it lands on the board** (it pops out big and gold, letter by letter,
  and stays gold a few seconds; in compact, the newest "recent" chip pops); wrong guesses only as large bubbles when
  "Show wrong guesses" is on (off by default); the hidden letter turns over; the fake letter tips away; the last 10 s
  go red; the longest word gets confetti. **Round end**: an end card ("Cleared!", "Time's up!", with the count) springs
  in letter by letter over the dimmed board, then the summary fades in (it never flips the widget: too jarring on stream).
- **Countdowns** to the next level or game: the ring drains smoothly (one linear animation to the moment it starts); only
  the number inside changes each second. Reduced motion: the ring steps once a second.
- **Empty slots** have a clear outline in every theme, so they read on any background and when the source is small.
- **Performance**: one timer drives the game (set for `nextWake()`), one updates the clock once a second; animations
  are Web Animations on `transform` and `opacity` only. **Reduced motion** (`.rm`): everything changes at once. As in
  the OBS scenes, inside OBS the streaming PC's system setting is ignored unless the link says `motion=reduce`.
- **Other modes**: `demo=1` (the pretend chat plays; the set-up preview, the hero), `still=1&screen=play|cleared|over`
  (a frozen, seeded moment: the set-up page's summary tabs, the theme gallery, screenshots). No channel in the link:
  it says "Add your channel" and connects to nothing.

## Words

`scripts/build-words.mjs` builds `public/chatagram/words/`, run by hand when the lists should change (the output is
committed; there's still no build step for the site):

```
git clone --depth 1 -b v2 https://github.com/en-wl/wordlist.git /tmp/scowl && (cd /tmp/scowl && make)   # once, ~1 min
node scripts/build-words.mjs --scowl /tmp/scowl
```

- **SCOWL / ESDB** (Kevin Atkinson; MIT-like licence, notice in `words/LICENSE.txt`) rates every word by how common it
  is (35 everyday, 50 medium, 60 the spell-checker default, 70 large) and tags offensive and vulgar words, which are
  left out. Kept: plain lowercase words of 3–9 letters (no names, abbreviations, contractions, hyphens, accents).
  A word spelt the same in the US and UK gets its smallest size; a US-only or UK-only spelling gets 71 (bonus only).
- **Blocked** as well: **LDNOOBW** (CC BY 4.0, `scripts/words/ldnoobw-en.txt`) and our own
  `scripts/words/blocklist.txt` (plus each word's s/es/d/ed/ing forms). To block a word: add it there and rebuild.
- **Seeds**: for each difficulty and length, well-known words whose puzzle has 12–50 slots (at least 6 of 4+ letters),
  at most 1,200 per list, spread through the alphabet. `words.txt` only keeps words that fit inside some seed.
- Sizes: `words.txt` ~72 KB and `seeds.txt` ~29 KB compressed, fetched once after the board appears.
- The builder prints a report; read the seeds for anything that shouldn't be on stream before committing.
- Credits: the Chatagram page's footer and FAQ.

## The Chatagram page

Its own brand, not the site's: lowercase wordmark **chat**agram in Lilita One (Chakra Petch for text, both already
self-hosted), the speech-bubble tile mark (`assets/icon.svg`), ink `#16122b`, coral `#ff5a5f`, sun `#ffc93c`, mint
`#2ee6a8`, paper `#fff7ec`. The header says **made by TrongatesLegacy** (one word, the owner's choice) and links to the homepage; the overlay's footer credit
`Made by TrongatesLegacy.com` (the owner's choice of spelling for the credit) is on by default and can be turned off
(Advanced → Other).

- Sections: hero (the pretend chat playing), how it works, the eight themes live, set up, FAQ. Sticky header with a
  pill menu that shows where you are.
- **Set-up**: channels, each checked as it's typed with a line under the box (Twitch through its public web API,
  `gql.twitch.tv`, no key; Kick through its channel API, which also gives the chatroom id; the overlay itself never asks
  Twitch); look (layout, theme, accent: the first swatch is the theme's own, the rainbow one any colour); game (round
  length up to 5 min, difficulty, keep playing). **Copy OBS link**, Show link and Open stay disabled until a channel is
  in. Ignored users and blocked words are **tag fields** (type, Enter or comma adds, × removes, Backspace removes the
  last). The Kick chatroom ID box only appears when Kick couldn't confirm the channel. The
  rest under **Advanced settings** (closed; a badge counts what's changed; opens itself when a link with advanced
  settings is opened). The **live preview** stays in view beside the settings with tabs for playing / level cleared /
  game over; **Copy OBS link** sits under it; the full link hides behind "Show link". On phones the preview goes first
  and a Copy bar stays at the bottom. The preview is re-themed by message, so changing theme or accent never reloads it.
- Indexed (in `sitemap.xml`) with its own title, description, canonical, share image and JSON-LD. The overlay isn't.
- **Pictures before live games**: the hero and the set-up preview show a picture at once (sized exactly like the live
  board) and the live game fades in over it when it has drawn, while the picture fades out (both showing at once looked
  like two games stacked; a browser test guards it); the theme gallery and the widgets page only ever show pictures (click a theme to use it).
  They're the real overlay, rendered per theme and layout by
  `node --experimental-websocket artwork/chatagram/render-previews.mjs` into `public/chatagram/assets/themes/`; re-run it
  whenever the overlay's look changes (a test checks every theme has both). `/chatagram/words/*` and `/chatagram/assets/*`
  are cached for a day (netlify.toml).
- The link-preview image: `node --experimental-websocket artwork/chatagram/render.mjs` (renders `artwork/chatagram/og.html`
  with the real overlay inside, into `public/chatagram/assets/og.jpg`). Re-render it when the brand or overlay changes.

## In Trongates Legacy's scenes

`/obs/chatagram` (see obs/README.md, "Chatagram") is Chatagram in the stream's colours: it runs the scenes' form
engine (`shared/theme.js`: veadotube, the dock, `form=`, `looks=`) and sends each change to the game as a live theme
message: Tron (any armour) → **neon** in the armour's colour, Princess Trina → **royal**, the Blobfish → **deep**,
following the dock's Form looks. It's the only Chatagram file that knows the forms.

## Tests

`tests/unit/chatagram-words.test.mjs` (the lists as shipped, blocking, every difficulty's seeds make good puzzles),
`tests/unit/chatagram-game.test.mjs` (the rules, with the real word lists), `tests/unit/widgets-lib.test.mjs` (settings,
Twitch and Kick parsing from real captured messages, themes), `tests/loops/widgets-chat.test.mjs` (reconnecting, on the
virtual clock), `tests/loops/chatagram-flow.test.mjs` (hours of play: no runaway, always moves on),
`tests/browser/chatagram.test.mjs` (the pages, a whole game from fake Twitch and Kick sockets, every layout and theme
fits, theme messages, the OBS wrapper, the set-up link, reduced motion). See testing.md.
