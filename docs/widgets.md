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
public/widgets/lib/platforms/twitch.js    Twitch: anonymous IRC over WebSocket; is the channel live (its public web API)
public/widgets/lib/platforms/kick.js      Kick: Pusher, chatroom looked up from the channel name; is the channel live
public/widgets/lib/theme.js, themes.css   the eight themes, the accent, the live theme message, reduced motion
public/chatagram/index.html + setup.js    the Chatagram page: hero, how it works, themes, set-up with live preview, FAQ
public/chatagram/play.html/.css/.js       the overlay OBS loads (noindex)
public/chatagram/game.js                  the rules only: no drawing, no timers (unit-tested)
public/chatagram/scores.js                the leaderboards: All time, This stream, which stream is on (unit-tested)
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

**Backgrounds**: each theme's `--bg` is solid on its own (they used to be 93–97% opaque, differing by theme) and carries
`/ var(--bgo, 1)`, so a widget sets how see-through it is by setting `--bgo` on the same element. Chatagram's Advanced →
Background (`bgo=`, 50–100%) defaults to **95%**, a hint of the game behind, the same for every theme (the owner,
2026-09-28); Solid is 100. Frames and edges stay as they are. A new theme's `--bg` must do the same (a browser test checks
every theme follows the setting: 95% by default, solid at 100).

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
- **Commands** `!cg start`, `!cg next`, `!cg skip`, `!cg reset`, `!cg top` (or just `!cg`), `!cg clearscores`
  (renamable, several names each, any capitals; who: only the owner, owner and mods, or everyone, except clearscores:
  the owner only). They were `!start`, `!next`, `!skip`, `!reset` until 2026-09-28; a link that named its own keeps them.
  Reset restarts the game; the leaderboards stay.
- **Flow**: after a level, the next one starts in 10 s (or waits for the next command); after game over, a new game in
  15 s (or waits for start). "Keep playing by itself" on the set-up page sets both.
- **Saved**: the game is saved in the OBS source's browser storage as it goes, so a refresh carries on. A save older
  than 10 minutes starts a new game. The leaderboards are saved beside it (see "Saved data").
- **Hold** (`hold(true|false)`): every timer stops (the round's end, padlocks, the half-time reveal, shuffles, the
  countdown to the next level or game) and carries on from where it stopped; guesses still count, timed at the moment the
  hold began. The leaderboard uses it; a refresh while held carries on (giving back at most 12 s).
- Bots are ignored as players (Botrix, Nightbot, StreamElements… editable), and streamers can block words of their own.

## Chatagram: leaderboards

`scores.js` keeps two lists, both from every point scored (board words and bonus words, as they're scored):

- **All time**: everyone ever, kept for good (only `!cg clearscores` wipes it). Always recorded; the "Show all-time
  leaderboard" switch (`remember`, the name it had when it decided whether scores were kept) only decides if it's shown.
- **This stream**: since the current stream started. **Which stream is on comes from the platforms**: Twitch's public
  web API (`gql.twitch.tv`, the one twitch.tv uses: the stream's id and start time) and Kick's channel API
  (`livestream`: id and start time), both without a login and both allowing other sites to ask (checked 2026-09-28).
  Unofficial, like reading Kick's chat: if one stops answering, the answer is "unknown", which never resets anything.
  - A **new stream id** is the same stream when it started within **40 minutes** of the last time the old one was seen
    live (a crash, OBS closing, a dropped connection: both platforms give a restarted stream a new id; 40 = 30 minutes
    of outage + one 10-minute check interval), otherwise This stream starts again.
  - **When it asks** (play.js): when the overlay starts; before the leaderboard shows, unless a live answer is under 2
    minutes old; when a round starts, if the last answer is over 5 minutes old; as a round ends, for the card; every 10
    minutes while live. Offline or idle: never on its own. With both platforms set up, the one that last said "live"
    is asked first and the other only when it isn't live (a streamer set up for both but on one today costs one
    request after the first).
  - **Points go where they belong by their time**: they're logged until an answer places them. Live: into the stream
    (from its start). A new stream found late (OBS left open, a game started before the check): the points after its
    start go in, earlier ones don't. Offline: the stream's final minutes count (up to one check interval after it was last
    seen live), anything later is All time only.
- **What shows**: This stream only once an answer confirms it: live → This stream; offline → **Last stream** (its date,
  an Offline tag, its final scores); no answer within 3 s → **This game** (the game's own players, always right);
  checking → nothing for 300 ms, then a placeholder (at least 400 ms, never a flash). All time hidden: This stream's
  **podium** (2nd, 1st with a crown, 3rd) on the left and its list on the right.
- **`!cg top`** follows "who can use commands"; with everyone allowed, viewers share a 60-second cooldown (mods and the
  owner never wait). Shown for 8 s (counted from when the lists fill in).
  - Full layout while a round is on: a panel exactly over the word board (the letters, timer and banner stay; nothing
    pauses, guesses keep landing).
  - Full layout on a card or while waiting to start: a bigger popup over the dimmed card; the countdown is held.
  - Compact: it covers the whole widget and the game is held (every timer), so nobody loses time.
- **On the cards**: the cleared and game-over cards show the standing top 5 (both lists, or This stream only); compact
  cards a This stream top 3 line. Left off when there's no answer (the MVPs already show this game).
- The set-up page's preview has **Show leaderboard** (a made-up leaderboard in the pretend game).

## Saved data

Everything is in the OBS browser source's `localStorage`, per channel pair (`<twitch>|<kick>`, as typed in the link).
**Rule: new versions only add fields.** Anything saved by an older version must always load, and what a newer one saves
must still work for an older copy (OBS can have a cached one). Tests: `tests/unit/chatagram-scores.test.mjs` with a real
save from before the leaderboards (`tests/fixtures/chatagram-save-v1.json`, written by the game at commit 6d8e97d),
and the browser test "saved data".

| Key | What | Fields |
|---|---|---|
| `chatagram:v1:<twitch>\|<kick>` | the game, as it goes (a refresh resumes it; over 10 minutes old starts a new game) | the game's state (`game.js` `fresh()`): phase, level, round, this game's players, … `allTime` (a copy of the leaderboards' All time, written back for older overlays), `heldAt` (added 2026-09-28: the leaderboard holding the game), `lbAt` (added 2026-09-28: the last viewer `!cg top`, for the cooldown) |
| `chatagram:scores:v1:<twitch>\|<kick>` | the leaderboards (added 2026-09-28) | `allTime` {`platform:user`: name, platform, score, words}, `stream` (ids per platform, started, lastSeen, players), `log` (points not yet placed), `status` (live, offline, unknown), `checkedAt`, `primary` (the platform asked first) |
| `chatagram:setup` | the set-up page's last settings (the page, not OBS) | the settings, as `settings.js` |

**The move to separate leaderboards (2026-09-28):** the first load with no leaderboards record takes All time from the
game's save (`allTime`, whatever it held, whatever "remember" was set to), and This stream starts with the first live
answer. Points scored earlier that day aren't in This stream (the old version didn't record when they were scored). A
game in progress resumes as before. An older overlay reading the new game save sees the same `allTime` and ignores the
new fields.

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
  go red; the longest word gets confetti. **Round end**: 1.6 s after the last find (so its highlight is seen), an end card ("Cleared!", "Time's up!", with the count) springs
  in letter by letter over the dimmed board (inside the theme's frame, `--frame` in themes.css, so a framed theme keeps its
  border round it), then the summary fades in (it never flips the widget: too jarring on stream).
- **Countdowns** to the next level or game: the ring drains smoothly (one linear animation to the moment it starts); only
  the number inside changes each second. Reduced motion: the ring steps once a second.
- **Boxes, not every answer**: the board shows 12 word boxes at level 1, 3 more each level up to 40 (Advanced → Most
  word boxes, 16–50), spread over the lengths in proportion, the longest word always among them. A box belongs to a
  length, not a word: any real word of that length fills the next open box, and once a length's boxes are full, more words
  of that length don't count ("full"). The goal is 65% of the boxes. Unfilled boxes' words are the "missed" ones.
- **Columns**: one per length, but the longest lengths share one "N+" column (e.g. "5+ LETTERS") when together they
  have 6 boxes or fewer and at least three columns remain; 3- and 4-letter words always keep their own column.
- **The banner** runs one scramble at a time; a new find cancels the last, so it always ends on the newest word (test).
- **Empty slots** have a clear outline in every theme, so they read on any background and when the source is small.
- **Performance**: one timer drives the game (set for `nextWake()`), one updates the clock once a second; animations
  are Web Animations on `transform` and `opacity` only. **Reduced motion** (`.rm`): everything changes at once. As in
  the OBS scenes, inside OBS the streaming PC's system setting is ignored unless the link says `motion=reduce`.
- **Other modes**: `seed=word` makes the first puzzle that word, if it's a real seed (the trailer uses it), `demo=1` (the pretend chat plays; the set-up preview, the hero), `still=1&screen=play|cleared|over`
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
  `scripts/words/blocklist.txt` (plus each word's s/es/d/ed/ing forms; other forms, like *cockily* or *bitchier*, are listed
  on their own). To block a word: add it there and rebuild.
- **Bonus only** (`scripts/words/bonus-only.txt`, about 6,100 words): everyday words most people wouldn't think of: odd
  plurals, verb forms and comparatives (*acuter, loyaler, timider, drys, geed*), rare short words (*eke, lye, mete, vise*),
  words that only look common because they're names (*hart, lee, eddy, glen*) and old forms (*doth, hath, unto*). They
  stay real words: typed in chat they score as bonus words; they never get a box and are never the scrambled word. On
  Hard, which also uses SCOWL's medium words, only the really rare ones are moved. **Checked** (`scripts/words/checked.txt`,
  about 4,600): words that are rare in everyday speech but well known (*raccoons, hashtags, logins, edamame*), looked at
  and kept. Both lists are exact words (each form is judged on its own) and a word is never in both (a test).
- **How they were made (2026-09-28), and reviewing after a rebuild**: every word that can get a box was ranked by how often
  it's said in film and TV subtitles (FrequencyWords' OpenSubtitles list, `en_full.txt` from
  https://github.com/hermitdave/FrequencyWords, CC BY-SA 4.0, so it's never committed): everyday words beyond rank 40,000
  (short ones beyond 20,000) and medium words beyond 80,000 were each put in one list or the other by hand. Moving words
  changes the seeds, which brings new words onto boards, so it was repeated until none were left. To check after a
  rebuild: `node scripts/build-words.mjs --scowl /tmp/scowl --freq /tmp/en_full.txt` writes the rare words in neither
  list to `rare-words.txt` in the temp folder; put each in a list, rebuild, repeat until it reports 0. The ranking only
  finds candidates: it misses names (*hart*) and flags words everyone knows (*raccoons*), so the lists are hand-made.
- **Seeds**: for each difficulty and length, well-known words whose puzzle has 12–50 slots (at least 6 of 4+ letters),
  at most 1,200 per list, spread through the alphabet, plus the still pictures' words (*heart, garden, clovers*: play.js
  `STILL_SEEDS`), always kept. `words.txt` only keeps words that fit inside some seed.
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
  length up to 5 min, difficulty, keep playing). **Copy OBS link** stays disabled, and Show link / Open in new tab hidden,
  until a channel is in. Ignored users and blocked words are **tag fields** (type, Enter or comma adds, × removes, Backspace removes the
  last). The Kick chatroom ID box only appears when Kick couldn't confirm the channel. The
  rest under **Advanced settings** (closed; a badge counts what's changed; opens itself when a link with advanced
  settings is opened). The **live preview** stays in view beside the settings with tabs for playing / level cleared /
  game over; **Copy OBS link** sits under it; the full link hides behind "Show link". On phones the preview goes first (no
  sticky Copy bar: the owner removed it). The preview is re-themed by message, so changing theme or accent never reloads it.
- Indexed (in `sitemap.xml`) with its own title, description, canonical, share image and JSON-LD. The overlay isn't.
- **Pictures before live games**: the hero and the set-up preview show a picture at once (sized exactly like the live
  board, no backdrop or frame around it) and the live game fades in over it when it has drawn, while the picture fades out (both showing at once looked
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
`tests/unit/chatagram-game.test.mjs` (the rules, with the real word lists; commands, holding),
`tests/unit/chatagram-scores.test.mjs` (the leaderboards: streams, crashes, offline, no answer, saved data across versions), `tests/unit/widgets-lib.test.mjs` (settings,
Twitch and Kick parsing from real captured messages, themes), `tests/loops/widgets-chat.test.mjs` (reconnecting, on the
virtual clock), `tests/loops/chatagram-flow.test.mjs` (hours of play: no runaway, always moves on),
`tests/browser/chatagram.test.mjs` (the pages, a whole game from fake Twitch and Kick sockets, every layout and theme
fits, theme messages, the OBS wrapper, the set-up link, reduced motion, the leaderboard in each layout with stubbed
"is it live" answers, saved data from before the leaderboards). See testing.md.
