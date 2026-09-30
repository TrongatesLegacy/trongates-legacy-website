# Plan: Chaplinko

A second free widget beside Chatagram (docs/widgets.md): chat types `!drop` and balls fall through a Plinko board into
scoring slots. Status: **planning** (2026-09-29). The first version is **Plinko only**; Pachinko and Pin tower are for
later (see "Later").

Brand mockups (`brand.html`): [logo](brand-logo.png), [colours and type](brand-palette.png), [the website](brand-site.png),
[beside Chatagram](brand-compare.png).

Widget mockups (`mockup.html`, drawn with the real `themes.css` plus the planned `chaplinko` theme; `?v=<name>` shows
one at its real size). Board source:
[board](classic.png), [big win](jackpot.png), [transparent](clear.png), [themes and accents](accents.png). Leaderboard
source: [panel](panel.png), [strip](strip.png), [transparent](lbclear.png). On a stream: [separate](scene.png),
[combined](combined.png). Motion storyboards (see "Animations"): [a ball](sb-drop.png), [the jackpot](sb-jackpot.png),
[the leaderboard](sb-leaderboard.png), [the board's moments](sb-board.png).

## What the owner asked for (2026-09-29)

- **Plinko**: balls fall through pegs, and the **scores are the slots at the bottom**.
- The scores feed an **All time / This stream** leaderboard. Nothing more complex than that.
- **Lots of variety in the design**: themes and accent colours.
- `!drop` drops the balls, `!drop <emote>` drops that emote. **No number** and **no cooldown** (2026-09-30): the point
  is chat spamming `!drop` to climb the leaderboard, so the board takes all of it and scales its animations to how busy
  it is. Following one ball closely matters less than the leaderboard.
- **Balls don't show names.** Names are for the leaderboard, and for a popup when someone hits the top slot ("pixelpriya
  scored 100").
- Set up and configured the way Chatagram is.
- **Separate or combined** (2026-09-30): the board and the leaderboard as two browser sources, or as one source with
  the leaderboard beside the board. The streamer picks.
- The separate leaderboard is **compact**: just the list.
- **Transparent by default** (2026-09-30), for the board and the leaderboard. A background is an option.
- The leaderboard shows **This stream, All time, or both**; with both, it **switches between them every so many
  seconds**, and the streamer sets how many (2026-09-30).
- **Balls are the chatter's chat colour** by default (2026-09-30).
- **The commands are shown on the board**, not on the leaderboard.
- The name is **Chaplinko** (chat + Plinko). The command is `!drop`.
- **Its own brand, logo and website, clearly different from Chatagram** (2026-09-30).

### About the name

Searched 2026-09-29: nothing else is called Chaplinko (the nearest are Chaplinka, a village in Ukraine, and a Plinko
nickname list). "Chatinko" was already taken by a Twitch/Kick chat game, so it was ruled out. Two things to know:

- It contains **Plinko**, a trademark of The Price Is Right. That's a small risk for a free widget, but if it ever grew
  large, a rename could be asked for. The page never uses The Price Is Right's look or says it's connected to the show.
- `!drop` is also used by Coin Pusher Live (a paid Steam game). Streamers who run both can rename our command.

## Brand

Chaplinko is its own brand, as Chatagram is, and the two are meant to look like **siblings from the same maker, not the
same product**. Chatagram is warm and cartoony: purple ink, coral and sun yellow, the rounded Lilita One, a lowercase
wordmark and a speech-bubble tile. Chaplinko is a **late-night arcade**: midnight blue, cobalt glow, a tangerine ball,
hard-edged arcade-sign capitals (mockup: beside Chatagram).

| | Chatagram | Chaplinko |
|---|---|---|
| Feel | a cosy word game, cartoon | an arcade cabinet at night, glow |
| Ground | purple ink `#16122b` | midnight blue `#0a1233` |
| Hero colour | coral `#ff5a5f` + sun `#ffc93c` | tangerine `#ff7a1a` (the ball) |
| Top prize | gold | jackpot pink `#ff3d8b` |
| Display type | Lilita One, lowercase | Bungee, capitals |
| Text type | Chakra Petch (the site's) | Space Grotesk |
| Mark | a speech bubble holding a letter tile | a cobalt tile: pegs, a falling ball, the slots |
| Surfaces | chunky offset shadows | thin cobalt rims and soft glow |

- **Name and wordmark**: `CHAPLINKO` in Bungee capitals, with the **O drawn as the ball** (tangerine, with a shine and a
  thin pink edge underneath, the jackpot slot). One colour, no split like Chatagram's **chat**agram. On dark it's ice,
  on light it's midnight (mockup: logo).
- **The mark** (`chaplinko/assets/icon.svg`, favicon and app tile): a cobalt rounded tile, a 1-2-3 triangle of ice pegs,
  the tangerine ball falling in with a short streak, and four slots with the third lit jackpot pink. It holds up at 32
  px; at 16 px (the favicon) a simpler version keeps only the ball, three pegs and the pink slot.
- **Colours**: night `#0a1233` (backgrounds), deep `#121d4d` (panels), slot `#1b2a66`, cobalt `#2f5bff` (the tile,
  rims, glow), ice `#eef3ff` (text, pegs), mist `#9fb0e0` (quieter text), tangerine `#ff7a1a` (the ball, buttons),
  jackpot pink `#ff3d8b` (the top slot, big wins). No Kick green or Twitch purple in the brand, so the platform dots
  always read as platforms.
- **Type**: **Bungee** for the wordmark, headings, slot numbers and buttons; **Space Grotesk** 400/600 for everything
  else. Both are SIL Open Font License, self-hosted beside the others in `public/assets/fonts/` (latin only, about 30 KB
  and 25 KB). Fonts are files, not a dependency.
- **Tagline**: **"Let chat drop."** In the site's voice (docs/content-and-voice.md): chill and playful.
- **Signature details**: the peg-dot texture behind sections; numbers in balls (the steps on the page); a tangerine
  button with a glow instead of Chatagram's offset shadow.
- **Credit**, as Chatagram: "made by **TrongatesLegacy**" in the page header, and `Made by TrongatesLegacy.com` on the
  widget, on by default, can be turned off.
- **Keep away from**: Charlie Chaplin's look (bowler hat, cane, moustache, silent-film type: the Chaplin estate
  protects them), and The Price Is Right's look (its Plinko board, logo, colours or "$" slots). The name is the only
  nod to either.

### The chaplinko theme

A 9th theme in `widgets/lib/themes.css`, **`chaplinko`**, in the brand's colours and type: it's Chaplinko's default
(the mockups use it) as `chatagram` is Chatagram's. Every widget gets every theme, so Chatagram gains it too, and
Chaplinko keeps all the others (mockup: themes and accents). Its `--gold` is jackpot pink.

A small change for every theme: the slots' heat (from the plain slot colour to the accent) mixes in `oklch`, not
`srgb`, so blue-to-orange goes through purple and pink instead of mud brown.

### Artwork

`artwork/chaplinko/` like `artwork/chatagram/`: the link-preview image (1200 × 630: the lockup, the tagline and a real
board, rendered by `render.mjs` into `public/chaplinko/assets/og.jpg`) and the theme pictures for the page
(`render-previews.mjs`, the real board in every theme, into `public/chaplinko/assets/themes/`). The mark is hand-drawn
SVG, as Chatagram's is.

## The website

`/chaplinko/`, indexed, with its own title, description, canonical, share image and JSON-LD (as Chatagram). The same
**parts** as Chatagram's page, because they work, in a **different look** (mockup: the website):

- **Header**: the mark and wordmark, a pill menu (Play, How it works, Looks, Set up, FAQ) that shows where you are, and
  "made by TrongatesLegacy" linking to the homepage.
- **Hero**: "LET CHAT **DROP.**" (the last word tangerine, glowing); one line on what it does; **Set it up** (tangerine)
  and **See it play** (outline); "No sign-up, no download: one link in OBS." Beside it, **the real board playing
  transparent** over the page's glow, with a pretend chat dropping balls (`demo.js`, as Chatagram). A picture first,
  the live board fading in over it once drawn, as Chatagram does.
- **How it works**: three cards, numbered with balls: type your channel, add it to OBS, chat drops.
- **Looks**: the board in every theme, transparent and with a background, as pictures; click one to use it.
- **Set up**: channels (checked as typed), layout (separate / combined), look, the board (rows, slot values with the
  odds beside them), the leaderboard (show, switch every, how many), Advanced. The live preview stays in view with
  **Copy OBS link** under it: two buttons for separate (board, leaderboard), one for combined.
- **FAQ**: is this gambling? (no: points only, nobody stakes anything); how do I add the leaderboard?; separate or
  combined?; which emotes work?; can I rename `!drop`?; what counts as This stream?
- **Footer**: credits and the other widgets.
- Checks as for every page: Lighthouse at the site's baseline (accessibility and best practices 100), desktop and
  phone screenshots, reduced motion (the hero board shows its picture, nothing falls).
- On `/widgets/`: a Chaplinko card in its own colours beside Chatagram's, and in the sitemap.

## What it reuses from Chatagram

| From | For |
|---|---|
| `widgets/lib/chat.js` + platforms | Twitch and Kick chat as one stream of messages (it gains `emotes`, below) |
| `widgets/lib/settings.js` | settings in the link, only the ones that differ from the default |
| `widgets/lib/themes.css`, `theme.js` | the 8 themes, any accent, background opacity (`bgo`), the live theme message, reduced motion |
| `chatagram/scores.js` | All time and This stream, and the check for which stream is on. **Moves to `widgets/lib/scores.js`** first, with a storage prefix per widget. Chatagram's saved keys don't change, and its tests must pass unchanged. |
| Chatagram's set-up page | the same structure: channels (checked as typed), look, board, Advanced, live preview with a pretend chat, Copy OBS link |
| `/obs/chatagram` | `/obs/chaplinko` follows Tron's forms through the live theme message in the same way |

The leaderboard source is built so it isn't tied to Chaplinko: once the scores are shared, the same page could show
Chatagram's leaderboards too (`game=chatagram|chaplinko`). That's for later, if the owner wants it.

## The board

A Plinko triangle of pegs over a row of slots. Colours, fonts and frame come from the theme.

- **Rows**: 8–16, default 10. More rows means more slots and a rarer top prize.
- **Slots** (default, 10 rows): 11 slots, `100 25 10 5 2 1 2 5 10 25 100`. Each row count has its own default list.
- **Slot values** can be edited as a list of numbers (Advanced), each 0–1000. The list must have one more number than
  there are rows; if it doesn't, the board uses its default.
- **Odds are honest and shown.** The chance of each slot comes from simulating the real physics (100,000 drops for each
  row count, done by a script and committed as a table), not from a formula. The set-up page shows it beside the values
  ("100: 1 in 512"). A test checks the physics still matches the table, so a change to the physics can't quietly make
  the top prize easier or harder.
- **Top prize**: the highest slot value. Hitting it shows the big win card (below). Advanced → "Big win card for": top
  slot / top two / off.

## Separate or combined

The first choice on the set-up page is **Layout**:

- **Separate** (the default): **two OBS browser sources** with two links, the board and the leaderboard, each placed
  and sized on its own (mockup: separate). Both links carry the channels, which is how they find each other's data, and
  each has its own look settings. The leaderboard is optional: the board works on its own.
- **Combined**: **one browser source**, 960 × 540, with the board and the leaderboard panel beside it (mockup:
  combined). The panel can be on the left or the right. One link, one theme. It needs nothing shared between sources,
  so it works even if the step-1 OBS test fails.
- **Board only**: the combined link with the leaderboard turned off, for streamers who don't want one (the big win card
  still names the winner).

Combined isn't separate code: the board page draws the same leaderboard as the leaderboard page, reading its own
scores directly.

### The board source

- **640 × 540.** As in Chatagram, the board scales to fit if the OBS source is another size.
- **The commands are on the board**, in the drop chute at the top: `!drop · !drop :emote:` (using the
  streamer's own command names if they renamed them). This is where viewers look, and it keeps the leaderboard compact.
  It can be turned off (Advanced → Show the commands).
- **Transparent by default**: no background and no frame; pegs, slots, balls, the chute and the `+N` numbers have a
  soft dark shadow so they read over any game (mockup: transparent). **Background** is a setting, 0–100% (Chatagram's
  `bgo`, but going down to 0 and defaulting to 0), for streamers who want the theme's panel and frame (mockup: themes
  and accents). The big win card always keeps its own panel and dims the board only as a soft glow behind the card,
  not the whole source.
- The big win card is drawn here, over the board.

### The leaderboard source

**Compact: only the list.** No commands (they're on the board), so it takes as little of the screen as possible.

- **panel** 300 × 270: the title, the This stream / All time tabs, the top 5 (mockup: panel). **How many** is a
  setting (3–10), and the source's height follows it.
- **strip** 720 × 72: the top 3 in a row, for the top or bottom of the screen, with the list's name at the start
  (mockup: strip).
- Its own theme, accent, background and credit, so it can match the board or not.
- **Transparent by default**, as on the board: no background, frame, panels or pill boxes, only the text and the
  active tab, with a text shadow so it reads over any game. The inactive tab becomes an outline (mockup: transparent
  leaderboard). **Background** 0–100% is a setting, default 0.
- **Show**: This stream / All time / **both** (default).
  - **Both**: it switches between the two every **Switch every** seconds (default 15, range 5–300), with a short fade.
    The tabs show which is on (panel); the strip's name changes.
  - **One list**: the tabs go and the title says which list it is ("This stream").
- The combined layout has the same **Show** and **Switch every** settings.
- **How it gets the scores**: OBS browser sources on the same site share storage, and the board saves its scores there as
  they change. The board also announces each change on a `BroadcastChannel` named after the channels, so the leaderboard
  updates as soon as a ball lands; the leaderboard also re-reads the save every 5 s in case a message is missed. The
  board is the only one that writes; the leaderboard only reads.
  - **To prove in real OBS before building on it**: that two browser sources share `localStorage` and `BroadcastChannel`
    (they run in one browser, so they should), including with "Shutdown source when not visible" on. The first step of
    the build is a two-page test in the owner's OBS. If it fails, the fallback is for the leaderboard to read chat too
    and have the board announce each landing in a form nobody sees, which is worse; so this decides the design.
  - If the board isn't running, the leaderboard still shows the last saved scores (it's just not updating).
  - The stream check (which stream is on) stays in the board, so only one source asks Twitch or Kick.

## Chat commands

- `!drop`: **Balls per drop** balls (default 5, range 1–10, the streamer's setting). `!drop <emote>`: that many of the
  emote instead of balls. An emoji works too (`!drop 🔥`). There's no number to type: everyone's drop is the same size,
  and anything after `!drop` that isn't an emote is ignored, so `!drop 5` from habit (other games use it) is a plain
  `!drop`.
- **Spam is the point.** Every `!drop` counts, as often as a viewer can send them, so climbing the leaderboard is about
  dropping the most. The platforms' own chat limits (and slow mode, if the streamer turns it on) are the only brakes.
  Advanced has a **per-person cooldown**, default **0 (off)**, range 0–300 s, for streamers who want one; a `!drop`
  during it is ignored silently.
- **The board limits itself, not the viewers.** **Most balls on screen**: default 100, range 20–200. Balls enter from
  the chute at up to 20 a second; past that, drops **queue**. The queue holds about 30 s of balls (600); drops beyond it
  are ignored until it drains, so a `!drop` never lands minutes late. How the board looks as it fills is in
  "Animations" (activity levels).
- The leaderboard and moderation commands follow Chatagram's pattern, all starting `!drop` and renamable in Advanced:
  - `!drop top`: **off by default**, since there's usually a leaderboard on screen. For streamers using board only, it
    shows both lists over the board for 8 s. Viewers share a 60 s cooldown.
  - `!drop pause` / `!drop resume`: stop and restart new drops. Balls already falling land and score.
  - `!drop clear`: remove every ball and the queue, scoring nothing.
  - `!drop clearscores`: wipe both leaderboards (the owner only).
  - Who can use them: the owner / owner and mods / everyone, as in Chatagram.
- Bots are ignored (the same editable list as Chatagram). There's no blocked-words list: nothing a viewer types is
  shown, only emotes the platform itself recognised.

## Emotes

Only emotes **the platform itself marked** in the message are used, never an image address a viewer typed. That keeps it
safe and means no lookups.

- **Twitch**: the IRC `emotes` tag gives each emote's id and where it sits in the text. The image is
  `https://static-cdn.jtvnw.net/emoticons/v2/<id>/static/dark/2.0` (the `static` version: drawing an animated one on a
  canvas only shows one frame anyway).
- **Kick**: emotes arrive in the text as `[emote:<id>:<name>]`. The image is `https://files.kick.com/emotes/<id>/fullsize`.
- **Emoji**: any single emoji, drawn as text.
- `chat.js` messages gain `emotes: [{ id, name, url }]` (only added, so Chatagram doesn't change). `parse` tests use real
  captured messages, as the existing platform tests do.
- If an emote's image fails to load, a plain ball falls instead.
- **Later, if asked**: 7TV / BTTV / FFZ emotes. They're plain words in chat, so they need a lookup of the channel's
  emote set (7TV's public API answers other sites). Not in the first version.

## Balls, scoring and the big win

- A ball is drawn in **the chatter's chat colour** (default; Twitch's `color` tag, Kick's `identity.color`) with a
  shine, so a viewer can follow their own balls without names. A chatter with no colour set gets the accent. Colours
  too dark to see on a transparent board are lightened (a contrast check, as the themes do). Advanced → Ball colour:
  chat colour (default) / accent / platform (Twitch purple, Kick green) / rainbow. An emote ball is the emote itself,
  turning as it rolls.
- **No names on balls.** When a ball lands, its value rises from the slot (`+10`), and the points go to the person who
  dropped it.
- **Leaderboards**: points only, per `platform:user`, as in Chatagram.
- **Big win card** (mockup: big win): the board dims, "JACKPOT!" springs in with the name, their platform and the
  points, a line such as "1 in 512 · the first today", and confetti. It shows for 4 s. Several at once queue. Balls keep
  falling behind the card.
- **Nothing is money.** It's points and bragging rights only. The set-up page and FAQ say so, and there's no betting
  (viewers never stake anything). This matters on Twitch.

## Animations

The game is only as good as how it feels to watch, so every moment chat causes gets a reaction, **in proportion to what
happened**: a ball hitting a peg is a flicker, a jackpot stops the show. Housekeeping (pausing, switching lists) is
quiet. **The reactions scale with how busy the board is** (activity levels, below): with three balls on the board each
one gets the full treatment; with a hundred, the board as a whole is the show and the leaderboard is what people
watch. Storyboards: [a ball](sb-drop.png), [the jackpot](sb-jackpot.png), [the leaderboard](sb-leaderboard.png),
[the board's moments](sb-board.png).

### How it's built

- **Board**: everything moving on the board (balls, trails, peg flashes, rings, sparkles, numbers, confetti, the beam)
  is drawn on the one canvas, in the physics loop's frame. The loop runs while anything is moving **or fading**, and
  stops when the last effect ends: an idle board still costs nothing. The chute and the big win card are HTML over the
  canvas (crisp text, the theme's fonts), animated with Web Animations.
- **Leaderboard**: HTML, animated with Web Animations on `transform` and `opacity` only (as Chatagram), so OBS
  composites it without redrawing the page. Rows move with FLIP (measure, move, animate back), so a reorder never
  jumps.
- **Timing**, shared by both: quick 150 ms, base 300 ms, slow 600 ms; **spring** `cubic-bezier(.34, 1.56, .64, 1)`
  for things arriving (a little overshoot), **out** `cubic-bezier(.2, .8, .2, 1)` for things leaving or settling.
- **Caps** as a last line (the activity levels do most of the work): at most 150 particles, 60 rings and 40 trails at
  once, the oldest going first. Target: 60 frames a second with 200 balls and a jackpot on a modest streaming PC,
  checked in the browser tests.

### Activity levels

The board measures how busy it is (balls on screen and the queue) and picks a level. It goes up at once and comes down
only after 3 s below the line, so it doesn't flicker between levels. The change itself is animated (below).

| | **Quiet** (under 15 balls) | **Busy** (15–50) | **Frenzy** (over 50, or a queue) |
|---|---|---|---|
| Drop point | the middle of the chute | the middle | **three spots** across the chute |
| Trails | 6 positions | 3 | none |
| Peg hit | flash, ring, squash | flash only | none per ball: **hot pegs** carry it |
| Hot pegs | faint | clear | **the main effect**: the whole board glows where balls pour |
| Landing | slot dips and flashes, `+N` for every ball | `+N` only for the upper half of values | no `+N`; each slot keeps a **tally** (`×12`) that bumps with each landing and fades 2 s after the last |
| Sparkles | upper half of values | top two values | top value only |
| Near miss | yes | no | no |
| Big win toast (top two) | yes | yes | no: the second-highest slot just flashes |
| Jackpot | the full show | the full show | a short version (below) |
| Balls bump each other | yes | yes | no, so they pour instead of jam |

**Entering Frenzy** is a moment of its own: the chute pulses and reads **FRENZY · +230 waiting** (counting down), the
board's edge glows in the accent and breathes with the landings, and the balls start pouring from three spots. When it
drains back to Busy the glow fades and the chute returns to the commands. Frenzy is the reward for chat spamming
together, so it should feel like the board is overjoyed, not overwhelmed.
- **Every animation ends.** A test with the fake clock runs a jackpot, a raid and a list switch, then checks the loop
  has stopped and no timers are left (the existing loop tests catch anything that keeps running).

### A ball (storyboard: a ball)

As a ball looks when the board is **Quiet**; Busy and Frenzy trim it as in the table above.

| Moment | What happens | Time |
|---|---|---|
| **The drop** | The chute gulps (squash and spring) and pops the ball out slightly big (1.15 → 1). The rest of the drop streams out 120 ms apart and the chute counts them down ("×4 more coming"). | 220 ms |
| **In flight** | A short trail in the ball's colour (the last 6 positions, fading). Emote balls turn with the ball's spin. | always |
| **Peg hit** | The peg flashes the ball's colour and a ring spreads out; the ball squashes a touch against it. | 250 ms |
| **Hot pegs** | Hit pegs keep a glow in the ball's colour that fades over 2 s, so the board shows the paths the balls took. A busy board lights up. | 2 s |
| **Landing** | The slot dips and springs back and flashes the ball's colour; the ball sinks in; `+N` floats up and fades. | 200 ms / 900 ms |
| **Near miss** | A ball that touches the jackpot slot's edge and falls the other way: the jackpot slot wobbles and "so close!" pops up. | 700 ms |

Landings are **tiered by value**, so bigger feels bigger:

- **The bottom half** of the values: a small `+N`, no sparkles.
- **The upper half**: a bigger `+N` in the slot's colour and a burst of 6 sparkles.
- **Second-highest** (with Big win card: top two): a **BIG WIN** toast slides in from the side with the name and
  points for 2.5 s, no slow motion.
- **The top slot**: the jackpot.

### The jackpot (storyboard: the jackpot)

| Time | What happens |
|---|---|
| **0 ms** | **Slow motion**: every ball slows to a third for 0.4 s, and the board dims around the lit slot. |
| **200 ms** | **The beam**: jackpot pink shoots up from the slot; a **ripple** runs out through the pegs, each flashing as the wave passes (500 ms). |
| **450 ms** | **The card** springs in (overshoots, settles tilted): "JACKPOT!" pops in a letter at a time, the name slides up, the points count up from 0. |
| **700 ms** | **Confetti** bursts from both bottom corners (80 pieces in the theme's colours, 2.2 s); the board gives one small shake. Balls keep falling behind. |
| **4 s** | **Away**: the card shrinks off toward the leaderboard (combined: into the winner's row), the board brightens and time runs normally. |

- Several jackpots **queue**: the next card starts as the last leaves, and a second jackpot within 10 s says
  "×2 JACKPOT!".
- **In Frenzy** the jackpot is shorter so the flood doesn't stall: no slow motion, the beam and ripple still fire, the
  card shows for 2 s. If more than 3 are waiting they merge into one card: "JACKPOT ×5: pixelpriya, m0ssy, kevxd and 2
  more".
- Transparent board: no dimming of the whole source, only a soft dark glow behind the card, so the game stays visible.
- The card's line under the points is the proof it's rare: "1 in 512 · the first today".

### The board's moments (storyboard: the board's moments)

- **Appearing** (the source loads or the scene changes): pegs pop in row by row (30 ms apart), the slots rise into
  place. 0.8 s.
- **Idle**: no drops for a minute, and a shine runs along the commands in the chute every 30 s, inviting a `!drop`.
  That's the only thing that runs while idle, and it's CSS.
- **Frenzy**: the chute reads "FRENZY · +230 waiting" and counts down, balls pour from three spots, hot pegs light the
  board and the slots keep tallies (see "Activity levels").
- **Paused**: the chute says PAUSED; balls already falling land. **Resume**: it flashes GO! for a moment.
- **Cleared**: every ball pops into a little puff, 20 ms apart, scoring nothing.

### The leaderboard (storyboard: the leaderboard)

| Moment | What happens | Time |
|---|---|---|
| **Appearing** | The title, then the rows deal in from just below, 60 ms apart. | 0.6 s |
| **A score goes up** | The points count up (fixed-width digits, so nothing jiggles); an accent sweep crosses the row; a `+25` chip fades out beside it. | 600 ms |
| **Overtaking** | Rows slide past each other with a little overshoot; the one going up lifts above the rest; the rank numbers roll like a counter, and a **▲2** shows how many places they climbed (fades after 3 s). | 400 ms |
| **A new #1** | A tangerine ball drops onto the new leader's row and bounces twice; a shine sweeps across it. | 800 ms |
| **Into the top N** | The new row slides in from the side, and the one pushed out slides away and fades. | 400 ms |
| **Switching lists** (both) | The tab pill slides across; the old rows lift away and the new ones deal in from below. A thin bar under the tabs fills until the next switch. | 600 ms |
| **A jackpot on the board** | The winner's row glows jackpot pink for 3 s. | 3 s |
| **Empty** | "No drops yet. Type `!drop`" with a ball that bounces three times every 10 s. | |

- **Climbing is the point**, so the leaderboard's animations matter more than any ball's. When the board is busy the
  leaderboard doesn't calm down with it; it **batches** instead: scores count up continuously, the `+N` chip adds up
  over the burst (`+145`), and the rows reorder at most once a second, so a flood reads as people surging past each
  other rather than a flicker. The ▲ arrows add up the same way.
- **Switching waits for the action**: if a score on the shown list is animating, the switch holds until 3 s after the
  last change, so an overtake is never cut off. A score change on the hidden list waits until that list is shown, then
  plays.
- **The strip** does the same in a row: chips count up and swap places, the list's name flips over, and the chips
  re-deal left to right when it switches.
- **Separate sources**: the board announces `score` and `jackpot` on the BroadcastChannel it already uses, so the
  leaderboard animates the moment a ball lands. Changes it only finds on its 5-second re-read just count up, with no
  fanfare.

### Motion setting

`motion=full|calm|reduce` in the link, as Chatagram's (inside OBS the streaming PC's system setting is ignored unless
the link says so):

- **Full** (default): everything above.
- **Calm**: the balls still fall and the numbers still count, but no shake, slow motion, beam, confetti, hot pegs or
  trails, and Frenzy only pours from three spots (no glow); things fade instead of springing. For streamers who find
  it busy.
- **Reduce**: nothing falls (the ball appears in its slot with the `+N`), leaderboard changes are instant, the big win
  card fades in and out. The website's previews follow the visitor's system setting.

Sound is **not** in the first version (see Later).

## Physics and performance

Our own code, no library (the no-dependencies rule), in `chaplinko/physics.js`, which only handles rules and movement:
nothing is drawn, and no timers run inside it. As with `game.js`, the clock and randomness are passed in, so the tests
replay any drop exactly.

- A fixed 120 steps a second. Balls and pegs are circles, the walls and slot dividers are line segments. Balls bounce
  off each other (a simple grid keeps that cheap), so 5 emotes don't pass through each other. In **Frenzy** (see
  "Animations") balls stop colliding with each other, so a flood pours through instead of jamming; the odds are the
  same either way (the odds test checks both).
- 200 balls at 120 steps a second is a few thousand circle checks per step: well within OBS's budget.
- A little randomness when a ball is dropped (its start position and spin) and none after that, so each drop is exactly
  replayable from its seed.
- One `<canvas>`, scaled for the screen's pixel density. The animation only runs while something is moving: an idle
  board costs nothing in OBS.
- A ball that has been on the board 20 s (stuck on a peg, or wedged) gets a small push; after 30 s it's put in the
  nearest slot. A loop test runs hours of drops to check nothing ever stays on the board.
- **Motion** (see "Animations"): with `motion=reduce` nothing falls. The ball appears in its slot at once with the
  `+N`, and the big win card fades without confetti.

## Settings (Chatagram's model)

Main: Twitch, Kick, **layout** (separate / combined, and for combined: leaderboard left / right / off), rows, theme,
accent, background (default 0, transparent). The leaderboard's own settings sit in a separate part: its shape (panel /
strip, separate only), how many, show (This stream / All time / both), switch every, and for the separate source its
own theme, accent and background. Advanced: motion (full / calm / reduce), near miss on or off, slot
values, big win card, show the commands, ball colour, balls per drop, cooldown (off), most balls on screen, ball size,
gravity (slow / normal / fast), commands and who can use them, ignored users, `!drop top` on or off, show All time, the
credit.

Saved: `chaplinko:scores:v1:<twitch>|<kick>` (the shared scores record). Balls in flight aren't saved: after a refresh,
the queue and balls in the air are gone, and they hadn't scored yet.

## Build order (each step tested and committed on its own)

1. **Prove two sources can talk** in the owner's OBS (a two-page test: shared storage and `BroadcastChannel`). If they
   can't, combined still works, and separate needs the fallback above.
2. **Shared scores**: move `scores.js` and the stream check to `widgets/lib/`, with Chatagram unchanged (all its tests
   still pass).
3. **Emotes in chat.js**: Twitch and Kick parsing, with tests from captured messages.
4. **Physics**: `physics.js` for the Plinko board, unit tests (drops replay exactly, the board is left-right symmetric,
   nothing gets stuck), and the odds table script.
5. **Board source**: `play.html/.css/.js`, transparent, commands, the queue, the big win card, saving the scores, reduced
   motion, and browser tests with fake Twitch and Kick sockets.
6. **Leaderboard**: `leaderboard.js` draws the list (panel and strip, show and switch every); `leaderboard.html` is the
   separate source reading the board's scores live, with a browser test running both pages at once; the combined layout
   uses the same code inside the board.
7. **Brand and website**: the `chaplinko` theme and the two fonts, the mark and favicon, the page (see "The
   website"), the widgets list entry, the theme pictures, the link-preview image.
8. **`/obs/chaplinko`** for Trongates Legacy's scenes.
9. Docs: a "Chaplinko" section in docs/widgets.md (with the brand, as Chatagram's has), plus testing.md, and a row in
   CLAUDE.md's table for `artwork/chaplinko/`.

## Later (not in the first version)

- **Pachinko** (spinners and bumpers over a centre jackpot slot, `2 5 10 25 250 25 10 5 2`) and **Pin tower** (a tall
  360 × 640 staggered wall for the side of the screen, `50 10 3 1 3 10 50`), as a **board** setting. Mockups:
  [pachinko](pachinko.png), [tower](tower.png). The physics is built so these only add shapes (bumpers, spinning arms),
  not a new engine.
- A **tall** size for the Plinko board.
- 7TV / BTTV / FFZ emotes.
- **Sound**: a soft tick per peg (thinned out when busy), a landing note that rises with the value, and a jackpot
  fanfare. Off by default, with a volume; OBS needs "Control audio via OBS" on the source.
- **Channel point redemptions**: a Twitch reward with text shows in chat with a reward id, so "Redeem: drop 10 balls"
  could work without a login. Kick's rewards aren't in its chat feed.

## Open questions for the owner

1. **Balls per drop**: 5 by default? With spam allowed, 3 would make each `!drop` less of a flood; 5 feels generous.
2. **Default layout**: separate or combined? The plan says separate (the most flexible), but combined is one link and
   the easiest to set up.
3. **Near miss** ("so close!"): on by default? It's the most fun small touch, but some might find it teasing.

Decided 2026-09-30: no number and no cooldown (spam is the point; the board scales instead); transparent by default; the leaderboard shows both lists by default, switching every 15 s
(configurable); balls are the chatter's colour.
