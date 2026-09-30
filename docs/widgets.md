# Stream widgets, Chatagram and Chaplinko

Free chat games and overlays for **any streamer**, on Twitch, Kick or both at once, at `/widgets/` (the list) and one
page per widget. The first is **Chatagram** (`/chatagram/`), an anagram game chat plays by typing words, like
wos.gg but reading Twitch and Kick together. The second is **Chaplinko** (`/chaplinko/`), Plinko for chat: `!plinko`
drops balls through pegs into scoring slots, and everyone climbs the leaderboard (see "Chaplinko" below). Everything is static files: no server, no database, no logins, no Netlify
functions. A streamer's settings live in the link they paste into OBS.

**Widgets stay generic.** Nothing in `public/widgets/`, `public/chatagram/` or `public/chaplinko/` knows about Tron's forms, veadotube or
the Lulu Gang. Anything specific to Trongates Legacy's stream lives in `public/obs/` (see "In Trongates Legacy's
scenes" below).

## Files

```
public/widgets/index.html                 the widgets list (the site's own style; linked last in the homepage nav)
public/widgets/lib/settings.js            settings ⇄ link, from a per-widget schema
public/widgets/lib/chat.js                every platform's chat as one reconnecting stream of messages
public/widgets/lib/platforms/twitch.js    Twitch: anonymous IRC over WebSocket; is the channel live (its public web API)
public/widgets/lib/platforms/kick.js      Kick: Pusher, chatroom looked up from the channel name; is the channel live
public/widgets/lib/theme.js, themes.css   the nine themes, the accent, the live theme message, reduced motion
public/widgets/lib/scores.js              the leaderboards: All time, This stream, which stream is on (both games; unit-tested)
public/chatagram/index.html + setup.js    the Chatagram page: hero, how it works, themes, set-up with live preview, FAQ
public/chatagram/play.html/.css/.js       the overlay OBS loads (noindex)
public/chatagram/game.js                  the rules only: no drawing, no timers (unit-tested)
public/chatagram/settings.js              every setting, its default and range
public/chatagram/words.js                 word logic shared by the overlay and the builder
public/chatagram/words/                   words.txt, seeds.txt (built), LICENSE.txt (the sources' notices)
public/chatagram/demo.js                  a pretend chat (the preview, screenshots, still pictures)
public/chatagram/assets/                  icon.svg (logo mark, favicon), og.jpg (link preview)
public/obs/chatagram.html                 Chatagram in Trongates Legacy's form colours (OBS)
public/chaplinko/                         Chaplinko: see "Chaplinko" below for its files
public/obs/chaplinko.html                 Chaplinko (board, or part=leaderboard) in the form colours (OBS)
scripts/build-words.mjs, scripts/words/   builds the word lists; the LDNOOBW list and our blocklist
artwork/chatagram/                        the link-preview image's design and render script
```

## Reading chat

`chat.js` connects each platform the streamer filled in and turns every message into one shape:
`{ platform, user, name, text, mod, owner, color, emotes }` (`color`: the chatter's chat colour, `#rrggbb` or `''`;
`emotes`: `[{ id, name, url }]`, the emotes the platform itself found in the text, in order. Twitch: its `emotes` tag,
positions counted in characters, pictures from `static-cdn.jtvnw.net/emoticons/v2/<id>/default/dark/2.0` (the GIF for an animated emote); Kick:
`[emote:<id>:<name>]` in the text, pictures from `files.kick.com/emotes/<id>/fullsize`. Only these are ever used, never
an address someone typed; added 2026-09-30, fields only added, so Chatagram is unchanged). It reconnects after a drop, waiting 1, 2, 5, 10, then 30 s (never more
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

Nine themes in the library, each only CSS variables in `themes.css` (backgrounds, panels, tiles, text, fonts, radius, edges):
**chatagram** (Chatagram's default, its brand's colours), **chaplinko** (Chaplinko's default, its brand's: added
2026-09-30, with Bungee and Space Grotesk), neutral, light, neon, candy, royal, deep, cozy. Each widget offers eight: its
own brand's and the six shared ones, never the other game's brand (the owner, 2026-09-30; each widget's `settings.js`
`THEMES` is its list). Any accent colour
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
- **Hidden letters** from level 3: one letter shows as `?` until half time; from level 6 (3 levels on), two, shown at 40%
  and 70% of the round. (A fake letter, as in WOS, was dropped on 2026-09-29 for the second hidden letter: WOS only counts
  its own answer list, but here any real word counts, so a fake letter made real words that were turned down, e.g. a fake
  G beside UNLEASH: *hang, glue, angle*. A save with one resumes without it.)
- **Padlocks** (off by default: people don't know them): 2–4 checkpoints on the countdown; a player who finds a word
  can't score again until the timer passes the next one. Stops one fast typer taking every word.
- **Commands** `!cg start`, `!cg next`, `!cg skip`, `!cg reset`, `!cg top` (or just `!cg`), `!cg clearscores`
  (any capitals; who: only the owner, owner and mods, or everyone, except clearscores: the owner only). **One setting**,
  the command (`cmd=`, default `!cg`): the words after it are fixed (the owner, 2026-09-30). Before that each command had
  its own names (`cstart=` … `cclear=`): a link carrying them still works in OBS, and the set-up page drops them when the
  link is next copied. They were `!start`, `!next`, `!skip`, `!reset` until 2026-09-28.
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

`scores.js` (`public/widgets/lib/`, shared with Chaplinko since 2026-09-30; it was `public/chatagram/scores.js`) keeps two lists, both from every point scored (board words and bonus words, as they're scored):

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
  "Show wrong guesses" is on (off by default); the hidden letter turns over; the last 10 s
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
- **Planned, unplanned and bonus words.** Boxes are only ever *planned* for everyday words (medium ones too on Hard),
  minus two hand-made lists:
  - **Unplanned** (`scripts/words/unplanned.txt`, about 5,800): everyday words most people wouldn't think of: odd
    plurals, verb forms and comparatives (*bickered, gargled, acuter, loyaler*), old forms. Never planned for a box, never
    in "missed", never the scrambled word; but typed in chat they **fill the next open box** of their length like any word
    (a bonus word if none is open), since they're real (the owner, 2026-09-29: turning down a real word feels broken).
  - **Bonus only** (`scripts/words/bonus-only.txt`, 270 short words: *eke, lye, col, sic*; names and old forms: *hart,
    lee, doth, unto*): only ever bonus words, because chat types short letter strings all the time and odd short ones
    would fill boxes by accident. The owner ticks any that are fine; they move to unplanned.
  - **One-country spellings** (*colour / color*): never planned (nobody is stuck on the other country's spelling); the
    everyday ones fill a box when typed, but only one of a pair each round (`words.js` `spellingKey`); rarer ones are bonus
    words.
  - **Checked** (`scripts/words/checked.txt`, about 4,600): rare in everyday speech but well known (*raccoons, hashtags,
    logins, edamame*): looked at and kept as planned box words.
  All lists are exact words (each form judged on its own); a word is on one list at most (a test). In `words.txt` the
  unplanned words have their own tiers above all others (80 everyday, 81 medium: Hard only; 82, 83 the one-country
  spellings), so an older overlay reads them as bonus words.
- **How they were made (2026-09-28), and reviewing after a rebuild**: every word that can get a box was ranked by how often
  it's said in film and TV subtitles (FrequencyWords' OpenSubtitles list, `en_full.txt` from
  https://github.com/hermitdave/FrequencyWords, CC BY-SA 4.0, so it's never committed): everyday words beyond rank 40,000
  (short ones beyond 20,000) and medium words beyond 80,000 were each sorted by hand onto a list. Moving words
  changes the seeds, which brings new words onto boards, so it was repeated until none were left. To check after a
  rebuild: `node scripts/build-words.mjs --scowl /tmp/scowl --freq /tmp/en_full.txt` writes the rare words on none of the
  lists to `rare-words.txt` in the temp folder; put each on one, rebuild, repeat until it reports 0. The ranking only
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
- **Hero chat**: the hero game (`play.html?demo=1`) posts each pretend-chat message to the page (`chatagram-chat`: name,
  colour, platform, text, the word found and its points); `setup.js` shows the last three as speech bubbles off the
  game's bottom-left corner, like the logo's: a find sun-yellow with the word as tiles and a mint `+N`, older ones
  dimmed (not see-through: the board showed through). Only the hero's frame is listened to, never the set-up preview's.
  The pretend chatters' colours (demo.js) are dark enough to read on cream and yellow. Hidden on phones (≤720 px).
  Motion, its own (not Chaplinko's slide): the ones above glide up (measured before and after, then animated back); the
  oldest floats off and fades (it stays in place meanwhile, and the stack hangs from the bottom, so nothing jumps); once
  the slot has cleared the new one pops out of its tail corner and swings into its tilt, settling like a card set down,
  as its letter tiles flip in one by one. The tilt and shrink use `rotate`/`scale`, never `transform`, so the animations
  and the resting CSS can't fight (the first version snapped to its tilt at the end). Reduced motion: none of it.
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

## Chaplinko

Plinko for chat (planned in `docs/plans/chaplinko/`, built 2026-09-30). Viewers type `!plinko` (or `!plinko <emote>`),
balls bounce down a triangle of pegs into slots worth points, and the points go to This stream and All time. **Spam is
the point** (the owner): there's no number to type and no cooldown by default, so climbing the leaderboard means
dropping the most; the board limits itself instead of the viewers.

```
public/chaplinko/index.html + setup.js    the page: hero (the board with a pretend chat), how it works, looks, set up, FAQ
public/chaplinko/play.html/.css/.js       the board, OBS source 1 (640 × 540; 960 × 540 combined with the leaderboard)
public/chaplinko/leaderboard.html         the leaderboard, OBS source 2 (lbsource.js reads the board's saved scores)
public/chaplinko/leaderboard.js           the leaderboard itself: panel and strip, and all its animation (both pages use it)
public/chaplinko/physics.js               the physics: balls, pegs, slots; seeded, a fixed 120 steps a second (unit-tested)
public/chaplinko/odds.js                  where 100,000 real drops landed per row count (made by scripts/chaplinko-odds.mjs)
public/chaplinko/game.js                  the rules only: commands, the queue, scoring, big wins, activity levels (unit-tested)
public/chaplinko/settings.js              every setting, its default and range; the default slot values
public/chaplinko/demo.js                  a pretend chat (the preview, the hero, pictures)
public/chaplinko/check.html               a check for OBS: can two browser sources share data? (add it twice, ?n=1 and ?n=2)
public/chaplinko/assets/                  icon.svg (the mark), og.jpg, themes/*.webp (render-previews.mjs)
artwork/chaplinko/                        the link-preview image and the pictures (see its README)
```

### The board

- **Rows** 8–12 (default 10), each row one more peg; the slots sit under the gaps of the bottom row. Fewer rows are
  simply bigger (the rows stay near equilateral at every count). More than 12 made the edge slots all but impossible
  (none in 50,000 drops at 14), so 12 is the limit.
- **Slot values**: one list per row count (`settings.js` `SLOTS`, 10 rows: `100 25 10 5 2 1 2 5 10 25 100`), the rarer
  slots scoring more. There's no setting for them (the owner removed it, 2026-09-30; an old link's `slots=` is ignored).
- **The board fills its source**: the slots sit at the bottom (476–520), the credit centred just under them, and the pegs
  spread as wide as the rows allow (2026-09-30: it used to leave a wide margin and a big gap under the slots).
- **Odds are real**: `scripts/chaplinko-odds.mjs` drops 100,000 balls per row count through the real physics (each seed
  twice, once mirrored, so it's exactly fair) into `odds.js`; the set-up page shows each slot's chance and the jackpot
  card says "1 in 273". Each edge slot (the jackpot): about 1 in 70 balls at 8 rows, 1 in 270 at 10, 1 in 400 at 12. It
  was 1 in 1,200 at 10 rows until the owner found the jackpot too rare to ever see (2026-09-30); the wider board made it
  likelier (smaller balls widen it further but tip into balls escaping the triangle, where the edges become the most
  common slots, so the ball and peg sizes stayed). The page shows each value once (the board is symmetric) with its
  chance per ball, both sides together.
  **Re-run the script after any change to physics.js**: a test replays the table's first 60 drops exactly and fails
  until you do.
- **Physics** (`physics.js`): our own, no library. Balls and pegs are circles; the only randomness is where a ball starts
  (from its seed), so drops replay exactly; plain IEEE maths only, so a drop lands in the same slot in every browser. The
  ball is big next to the gap (like a real chip) so it meets a peg on nearly every row: that's what makes the bell.
  Things tried and dropped (2026-09-30): walls along the triangle (balls rode them into the edge slots), smaller balls
  (they slipped past the edge pegs), **balls bumping each other** (in a busy board it made the edge slots 35 times
  likelier, so the odds shown would have been false: balls now pass through each other, and a test checks a crowd lands
  exactly as each ball would alone), and a gravity setting (it changed where balls land; **Speed** plays the same steps
  slower or faster instead, so the odds hold).
- A ball resting on a peg gets a small push towards the middle; after 30 s one is put in the nearest slot.
- **Transparent with a dark-text theme** (Light, Cozy): their dark text would vanish over a game, so what sits straight on
  the game turns light (the pegs, the numbers, the chute's text on a dark pill, the credit, the whole transparent
  leaderboard), while the theme's own surfaces keep their dark text (the slots, the tallies, the big win card). CSS
  `--ontop` is that "over the game" colour; the canvas reads it for the pegs and numbers.

### Chat

- **The command** is one setting (`cmd=`, default `!plinko`; it was `!drop` until the owner changed it, 2026-09-30); the
  words after it are fixed. `!plinko` drops **Balls per drop** (default 5, 1–10). `!plinko <emote>` drops that emote (one
  the platform marked), or an emoji (`!plinko 🔥`). Anything else after it is ignored, so `!plinko 5` is a plain drop.
- **No cooldown** by default (Advanced: 0–300 s per viewer). The board takes up to **Most balls on the board** (default
  100, 20–200); beyond that drops queue and leave the chute one at a time (faster in Frenzy, up to 20 a second). The
  queue holds 600 balls (about 30 s); drops beyond it are ignored until it drains.
- **The chute** at the top of the board shows the commands only when Advanced → Show the commands is on (off by default,
  the owner, 2026-09-30); otherwise it shows who's leading This stream (All time's #1 when not live, the name before
  anyone has scored). It also says what's happening: ×N more coming, FRENZY · +N waiting, PAUSED, GO!.
- The other commands follow it: `!plinko pause` / `resume` / `clear` (owner and mods by default), `!plinko clearscores`
  (the owner only), `!plinko top` (always on, who follows the setting: both lists' top 5 over the board for 8 s, 600 wide, with the **exact**
  scores, e.g. 4,288,123,456, where the leaderboard shows 4.28B: a long name shortens, a score never; viewers share one a
  minute).
- Bots are ignored (the same list as Chatagram's).
- **Ball colour**: the chatter's chat colour (default; lightened if too dark to see), the accent, the platform's, or
  rainbow. An emote whose picture can't load falls as a plain ball. **Animated emotes play** while they fall: a canvas only
  draws a GIF's first frame, so the board fetches the file (Twitch's and Kick's image servers both allow it) and decodes
  its frames with `ImageDecoder` (up to 100); without it, the first frame (checked 2026-09-30 with real xqc emotes).

### Scoring and big wins

A landing scores the slot's value for whoever dropped it (`scores.js`, "balls" counted beside the points). Tiers:
**jackpot** (the top value: the big win card), **big** (the second-highest: a BIG WIN toast with Big win card → top
two), **high** (the upper half of the values), **low**. A **near miss** ("so close!") is a ball that lands next to a
top slot, within most of a ball of its edge (on by default, Advanced). Jackpots are counted per day for the card's "the
first today". Nothing is money: nobody stakes anything (the FAQ says so).

### Activity levels and animation

Everything on the board is drawn on one canvas by one loop that runs only while something moves or fades (an idle board
costs nothing); the chute, cards and the leaderboard are HTML, animated on transform and opacity. The reaction scales
with the moment, and with how busy the board is (`game.js`: up at once, down only after 3 s below the line):

| | Quiet (under 15 balls) | Busy (15–50) | Frenzy (over 50, or a queue) |
|---|---|---|---|
| Trails | 6 positions | 3 | none |
| Peg hit | flash, ring, a small squash | flash | the hot pegs carry it |
| Landing | the slot dips and flashes, `+N` for every ball | `+N` for the upper half | a tally per slot (`×12`) |
| Near miss, big win toast | yes | toast only | no |
| Jackpot | slow motion, beam, ripple, card, confetti, shake | the same | no slow motion, 2 s card |

Frenzy also makes the chute read "FRENZY · +230 waiting" and the board's edge glow (not when the board is transparent:
no border then). The jackpot: 0.4 s at a third of the
speed, a beam up from the slot and a ripple through the pegs, the card springing in with the points counting up,
confetti from both corners at 0.7 s; at 4 s the card swells, flashes and **explodes** into shards and sparks with a
shockwave across the board (the owner, 2026-09-30: more exciting than floating away; calm or reduced motion: it fades).
**Jackpots in quick succession are a streak, not a queue** (2026-09-30): a jackpot while the card is up joins it: the
count punches up (JACKPOT! ×2, ×3…), the new name slides in (the same person again: "PixelPanda ×2"; up to three names,
then "+N more"), the points count on to the streak's total, more confetti, and each jackpot still fires its own beam and
ripple (slow motion and the shake only on the first). The card goes 2 s after the last jackpot (at least 4 s after it
opened; 2 s in Frenzy), so it's always about what just happened. Other moments: the pegs pop in row by row when
the board loads; the commands shine every 30 s after a minute idle; PAUSED / GO! in the chute; `!plinko clear` pops every
ball. **Motion** (`motion=` in the link, Advanced): auto/full, **calm** (no shake, slow motion, beam, confetti, trails
or hot pegs), **reduce** (nothing falls: each ball's landing is worked out at once and the `+N` shows; the leaderboard
changes instantly). As everywhere, OBS ignores the PC's own setting unless the link says so. Outside OBS a device asking for
less motion gets **reduce**, which looks broken on the page (a board where nothing falls: the owner hit this on a PC with
Windows' animation effects off, 2026-09-30), so the page's hero and live preview say why over the board ("the balls are invisible here"), with **Show them
falling**: the page's frames then get `animate=1` (`theme.js`: the device's setting is set aside, a link's
`motion=reduce`/`calm` still counts), remembered in `chaplinko:animate` (then only a small "Keep the balls still" in the corner). The OBS links never carry it.

### The leaderboard

- **Separate** (the default layout): its own OBS source, a **panel** (300 wide, as tall as its players: 3–10, default 5)
  or a **strip** (720 × 72, the top 3), with **its own background** always (`lbbgo`, transparent by default, apart from
  the board's) and its own theme if the streamer wants. **Combined**: beside the board in one 960 × 540 source (left or
  right, or off for the board alone), still with its own background and, if picked, its own theme (it carries a theme on
  its own wrapper, because a theme's `--bg` is worked out where the theme is set; with its own theme it doesn't follow
  live theme messages, so in /obs/chaplinko only the board follows the form).
- **Show**: This stream, All time, or both (default), switching every 15 s (5–300) with a bar filling to the next switch;
  a switch waits until 3 s after the last score change on the list showing, so an overtake is never cut off. Not live,
  This stream is the last stream's (and says drops count for All time).
- Scores show in full up to 99,999, then in three figures (250K, 48.2M, 4.29B), so All time's years of points never push
  the names out.
- Scores count up, rows slide past each other (FLIP) with the places climbed (▲2), a `+N` badge adds up over a burst, a
  new #1 gets a ball dropped on their name, a jackpot's winner glows pink for 3 s. When busy it batches: rows reorder at
  most once a second.
- **How the separate one gets the scores**: both sources run in OBS's one browser, so they share storage. The board is
  the only one that writes (`chaplinko:scores:v1:<twitch>|<kick>`, the same record shape as Chatagram's, throttled to
  4 a second) and announces each change on a `BroadcastChannel` named after the channels (`scores`, `jackpot`); the
  leaderboard reads on each message, on the storage event, and every 5 s. `check.html` proves it in a given OBS.
  If the board isn't running, the last saved scores still show.

### Saved data

| Key | What |
|---|---|
| `chaplinko:scores:v1:<twitch>\|<kick>` | the leaderboards (`scores.js`'s record; "words" is balls dropped) |
| `chaplinko:v1:<twitch>\|<kick>` | `{ day, jackpots }`: today's jackpots, for the card |
| `chaplinko:scores:demo` | the set-up preview's pretend board, shared with the pretend leaderboard beside it (only a board with `share=1` writes it) |
| `chaplinko:setup` | the set-up page's last settings |

### Settings in the links

`settings.js` describes every setting; the set-up page writes two links from it: the board's (every setting that differs
from its default) and the leaderboard's (`LB_KEYS`: channels, its look, shape, how many, show, switch every, All time,
credit, motion). The leaderboard's own look is written into its link as `theme=`/`accent=`/`bgo=`. Other modes: `demo=1`
(the pretend chat; `share=1` also feeds the pretend leaderboard), `still=1&screen=play|jackpot` (a frozen, seeded moment,
for pictures). No channel: "Add your channel".

## The Chaplinko page

Its own brand, deliberately unlike Chatagram's (docs/plans/chaplinko/plan.md, "Brand"): a **late-night arcade**.
Midnight `#0a1233`, deep `#121d4d`, slot `#1b2a66`, cobalt `#2f5bff` (the tile, rims, glow), ice `#eef3ff`, mist
`#9fb0e0`, tangerine `#ff7a1a` (the ball, buttons), jackpot pink `#ff3d8b`. **Bungee** capitals for the wordmark,
headings and numbers, **Space Grotesk** for text (both SIL OFL, self-hosted, latin only). The wordmark is `CHAPLINKO`
with the **O drawn as the ball**; the mark (`assets/icon.svg`) is a cobalt tile with a peg triangle, the ball falling
in and the jackpot slot lit. Tagline "Let chat drop." Credit as Chatagram: "made by TrongatesLegacy" in the header,
`Made by TrongatesLegacy.com` on the board (on by default). Keep away from Charlie Chaplin's look and The Price Is Right's
(the name is the only nod to either; the footer says it's not connected to any game show).

- Header: the mark, the wordmark with "made by TrongatesLegacy" under it, the section menu, More widgets ↗, Set it up.
- The pretend chat drops Chaplinko's own animated emotes (`assets/emotes/`, `artwork/chaplinko/emotes.mjs`), so the hero
  and the preview show animated emotes falling; the hero's chat bubbles show them as they'd appear in chat.
- Advanced settings has **Reset to defaults** (top right): every setting back to its default except the channels (the
  owner: all settings, not just the advanced ones).
- The Look card has the leaderboard's look too: its background, and (switched on) its own theme and accent, in either
  layout.
- Sections: hero (the board transparent over the page's glow with a pretend chat beside it), how it works, the looks
  (every theme as a picture, click to use; transparent is the default), set up, FAQ ("Is this gambling?" first).
- **Set up**: channels (checked as typed, as Chatagram), layout (separate / combined, the leaderboard's side), look
  (the board's background, the leaderboard's background, theme, accent), the board (rows, with an ⓘ tooltip of each value's
  points and real chance per ball; balls per drop, ball colour), the leaderboard (show, switch every, how many, shape,
  its own theme), Advanced. The **live preview** shows the board and
  the leaderboard over a pretend game, playing with a pretend chat; **Copy board link** and **Copy leaderboard link**
  (one **Copy OBS link** for combined). The preview is re-themed by message, so theme and accent never reload it.
- Pictures before live boards, as Chatagram (`artwork/chaplinko/render-previews.mjs`; a test checks they're all there).
- Indexed (sitemap), with its own title, description, canonical, share image and JSON-LD; the board and leaderboard
  pages aren't.

## In Trongates Legacy's scenes

`/obs/chatagram` (see obs/README.md, "Chatagram") is Chatagram in the stream's colours: it runs the scenes' form
engine (`shared/theme.js`: veadotube, the dock, `form=`, `looks=`) and sends each change to the game as a live theme
message: Tron (any armour) → **neon** in the armour's colour, Princess Trina → **royal**, the Blobfish → **deep**,
following the dock's Form looks. It's the only Chatagram file that knows the forms. `/obs/chaplinko` does the same for
Chaplinko's board and (`part=leaderboard`) its leaderboard (obs/README.md, "Chaplinko").

## Tests

`tests/unit/chatagram-words.test.mjs` (the lists as shipped, blocking, every difficulty's seeds make good puzzles),
`tests/unit/chatagram-game.test.mjs` (the rules, with the real word lists; commands, holding),
`tests/unit/chatagram-scores.test.mjs` (the leaderboards: streams, crashes, offline, no answer, saved data across versions), `tests/unit/widgets-lib.test.mjs` (settings,
Twitch and Kick parsing from real captured messages, emotes and colours, themes), `tests/loops/widgets-chat.test.mjs` (reconnecting, on the
virtual clock), `tests/loops/chatagram-flow.test.mjs` (hours of play: no runaway, always moves on),
`tests/browser/chatagram.test.mjs` (the pages, a whole game from fake Twitch and Kick sockets, every layout and theme
fits, theme messages, the OBS wrapper, the set-up link, reduced motion, the leaderboard in each layout with stubbed
"is it live" answers, saved data from before the leaderboards). See testing.md.

Chaplinko: `tests/unit/chaplinko-physics.test.mjs` (the odds table replays exactly, fairness, every ball lands, crowds
don't change landings, the layout), `tests/unit/chaplinko-game.test.mjs` (what a `!plinko` drops, spam and the optional
cooldown, the queue, commands, scoring and big wins, near misses, activity levels), `tests/unit/chaplinko-assets.test.mjs`
(the pictures), `tests/loops/chaplinko-flow.test.mjs` (spam and raids on the virtual clock: every ball lands and scores
once, the queue drains, the board calms), `tests/browser/chaplinko.test.mjs` (real chat, the separate leaderboard
following the board from another tab, sizes and themes, the OBS wrapper, the set-up links, reduced motion, Frenzy,
emotes), and the dock's `tests/unit/model.test.mjs`.
