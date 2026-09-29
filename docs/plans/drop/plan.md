# Plan: the drop game (Plinko, Pachinko, Pin tower)

A second free widget beside Chatagram (docs/widgets.md): chat types `!drop` and balls fall through pegs into scoring
slots. Status: **planning** (2026-09-29). The working name is "drop"; see "Open questions".

Mockups (`mockup.html`, drawn with the real `themes.css`; `?v=<name>` shows one at its real size). Board source:
[classic](classic.png), [pachinko](pachinko.png), [tower](tower.png), [jackpot](jackpot.png),
[transparent](clear.png), [themes and accents](accents.png). Leaderboard source: [panel](panel.png), [strip](strip.png),
[transparent](lbclear.png).
Both on a stream: [scene](scene.png).

## What the owner asked for (2026-09-29)

- Plinko, Pachinko and Pin tower are **one widget with settings**, not three.
- **Scores at the bottom** feed an **All time / This stream** leaderboard. Nothing more complex than that.
- **Lots of variety in the design**: themes and accent colours.
- `!drop` drops 1 ball, `!drop 5` drops 5, `!drop 5 <emote>` drops 5 of that emote.
- **Balls don't show names.** Names are for the leaderboard, and for a popup when someone hits the top slot ("pixelpriya
  scored 100").
- Set up and configured the way Chatagram is.
- **The leaderboard is a separate browser source**, placed wherever the streamer likes, not part of the board.
- **Fully transparent** is an option for both the board (pegs, slots and balls straight over the game) and the
  leaderboard.

## What it reuses from Chatagram

| From | For |
|---|---|
| `widgets/lib/chat.js` + platforms | Twitch and Kick chat as one stream of messages (it gains `emotes`, below) |
| `widgets/lib/settings.js` | settings in the link, only the ones that differ from the default |
| `widgets/lib/themes.css`, `theme.js` | the 8 themes, any accent, background opacity (`bgo`), the live theme message, reduced motion |
| `chatagram/scores.js` | All time and This stream, and the check for which stream is on. **Moves to `widgets/lib/scores.js`** first, with a storage prefix per widget. Chatagram's saved keys don't change, and its tests must pass unchanged. |
| Chatagram's set-up page | the same structure: channels (checked as typed), look, board, Advanced, live preview with a pretend chat, Copy OBS link |
| `/obs/chatagram` | `/obs/drop` follows Tron's forms through the live theme message in the same way |

The leaderboard source is built so it isn't tied to the drop game: once the scores are shared, the same page could show
Chatagram's leaderboards too (`game=chatagram|drop`). That's for later, if the owner wants it.

## The board

The **board** setting picks the layout of the pegs; everything else (colours, fonts, frame) comes from the theme.

| Board | Pegs | Extras | Default slots (points) |
|---|---|---|---|
| **Classic** (Plinko) | a triangle, `rows` 8–16 (default 10) | none | 11: `100 25 10 5 2 1 2 5 10 25 100` |
| **Pachinko** | a dense staggered field inside a rounded cabinet | 2 spinners, 3 bumpers over a centre "jackpot" slot | 9: `2 5 10 25 250 25 10 5 2` |
| **Tower** | a staggered wall the full width, for the tall layout | none | 7: `50 10 3 1 3 10 50` |

- **Slot values** can be edited as a list of numbers (Advanced), 3–17 slots, each 0–1000. If the list doesn't fit, the
  board falls back to its default.
- **Odds are honest and shown.** The chance of each slot comes from simulating the real physics (100,000 drops per board
  and row count, done by a script and committed as a table), not from a formula. The set-up page shows it beside the
  values ("100: 1 in 512"). A test checks the physics still matches the table, so a change to the physics can't quietly
  make the top prize easier or harder.
- **Top prize**: the highest slot value. Hitting it shows the card (below). Advanced → "Big win card for": top slot /
  top two / off.

## Two browser sources

The streamer adds **two OBS browser sources** with two links from the set-up page. Both links carry the channels, which
is how they find each other's data, and each has its own look settings. The leaderboard is optional: the board works on
its own.

### The board source

- **board** 640 × 540 (Classic and Pachinko) or **tall** 360 × 640 (Tower's natural shape, for the side of the screen;
  any board can use it). As in Chatagram, the board scales to fit if the OBS source is another size.
- **The commands are on the board**, in the drop chute at the top: `!drop · !drop 5 · !drop 5 :emote:` (using the
  streamer's own command names if they renamed them). This is where viewers look, and it keeps the leaderboard compact.
  It can be turned off (Advanced → Show the commands).
- **Background**: 0–100% (Chatagram's `bgo`, but going down to 0), default 95%. **Transparent** (0) also drops the
  theme's frame and gives pegs, slots, balls and the `+N` numbers a soft dark shadow so they read over any game (mockup:
  transparent). The big win card keeps its own panel and dims the board only as a soft glow behind the card, not the
  whole source. Transparent is one click on the set-up page, beside the theme.
- The big win card is drawn here, over the board.

### The leaderboard source

**Compact: only the list.** It has no "biggest drop" and no commands (the commands are on the board), so it takes as
little of the screen as possible (the owner, 2026-09-29).

- **panel** 300 × 270: the title, the This stream / All time tabs, the top 5 (mockup: panel). **How many** is a
  setting (3–10), and the source's height follows it.
- **strip** 720 × 72: This stream's top 3 in a row, for the top or bottom of the screen (mockup: strip).
- Its own theme, accent, background and credit, so it can match the board or not.
- **Background** 0–100%, default 95%, with **Transparent** (0) one click away, as on the board: no background, frame,
  panels or pill boxes, only the text and the active tab, with a text shadow so it reads over any game. The inactive tab
  becomes an outline (mockup: transparent leaderboard).
- **Which list**: This stream / All time / take turns every 15 s (default).
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

- `!drop`: 1 ball. `!drop 5`: 5 balls (capped at **Most balls per command**, default 5, range 1–20). `!drop 5 <emote>`
  or `!drop <emote>`: that emote instead of a ball. An emoji works too (`!drop 3 🔥`).
- **Per-person cooldown**: default 20 s, range 0–300. A `!drop` during the cooldown is ignored silently, so chat isn't
  spammed with replies (the widget has no way to reply anyway).
- **Most balls on screen**: default 40, range 10–100. Beyond that, drops **queue** and fall in turn, spaced out, so a
  raid can't make OBS stutter. The queue has a limit (200) and drops beyond it are ignored.
- The leaderboard and moderation commands follow Chatagram's pattern, all starting `!drop` and renamable in Advanced:
  - `!drop top`: **off by default**, since the leaderboard is its own source. For streamers without one, it shows both
    lists over the board for 8 s. Viewers share a 60 s cooldown.
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

- A ball is drawn in the accent colour with a shine. Advanced → Ball colour: accent (default) / platform (Twitch purple,
  Kick green) / the chatter's chat colour (Twitch's `color` tag, Kick's `identity.color`) / rainbow. An emote ball is
  the emote itself, turning as it rolls.
- **No names on balls.** When a ball lands, its value rises from the slot (`+10`), and the points go to the person who
  dropped it.
- **Leaderboards**: points only, per `platform:user`, as in Chatagram.
- **Big win card** (mockup: jackpot, on the board source): the board dims, "JACKPOT!" springs in with the name, their platform and the points,
  a line such as "1 in 512 · the first today", and confetti. It shows for 4 s. Several at once queue. Balls keep falling
  behind the card.
- **Nothing is money.** It's points and bragging rights only. The set-up page and FAQ say so, and there's no betting
  (viewers never stake anything). This matters on Twitch.

## Physics and performance

Our own code, no library (the no-dependencies rule), in `drop/physics.js`, which only handles rules and movement:
nothing is drawn, and no timers run inside it. As with `game.js`, the clock and randomness are passed in, so the tests
replay any drop exactly.

- A fixed 120 steps a second. Balls are circles. Pegs and bumpers are circles, the walls and spinner arms are line
  segments. Balls bounce off each other (a simple grid keeps that cheap), so 5 emotes don't pass through each other.
- A little randomness when a ball is dropped (its start position and spin) and none after that, so each drop is exactly
  replayable from its seed.
- One `<canvas>`, scaled for the screen's pixel density. The animation only runs while something is moving: an idle
  board costs nothing in OBS.
- A ball that has been on the board 20 s (stuck on a peg, or wedged) gets a small push; after 30 s it's put in the
  nearest slot. A loop test runs hours of drops to check nothing ever stays on the board.
- **Reduced motion**: no falling. The ball appears in its slot at once with the `+N`, and the big win card fades
  without confetti.

## Settings (Chatagram's model)

Main: Twitch, Kick, board, size (board / tall), rows (Classic), theme, accent, background (Transparent is one click).
The leaderboard source's own settings sit in a separate part: its layout (panel / strip), which list, theme, accent,
background. Advanced: slot values, big win card, show the commands, ball colour,
most balls per command, cooldown, most balls on screen, ball size, gravity (slow / normal / fast), commands and who can
use them, ignored users, `!drop top` on or off, show All time, the credit.

Saved: `drop:scores:v1:<twitch>|<kick>` (the shared scores record). Balls in flight aren't saved: after a refresh, the
queue and balls in the air are gone, and they hadn't scored yet.

## The page

`/drop/` (name to be decided), built the same way as Chatagram's: a hero with a pretend chat dropping balls, the three
boards as pictures, the themes, set-up with a live preview of both sources and the odds table, **two Copy OBS link
buttons** (board, leaderboard), and an FAQ ("is this gambling?": no; "how do I add the leaderboard?"). It
goes on `/widgets/` and in the sitemap, with its own link-preview image.

## Build order (each step tested and committed on its own)

1. **Prove two sources can talk** in the owner's OBS (a two-page test: shared storage and `BroadcastChannel`).
2. **Shared scores**: move `scores.js` and the stream check to `widgets/lib/`, with Chatagram unchanged (all its tests
   still pass).
3. **Emotes in chat.js**: Twitch and Kick parsing, with tests from captured messages.
4. **Physics**: `physics.js` for all three boards, unit tests (drops replay exactly, the board is left-right symmetric,
   nothing gets stuck), and the odds table script.
5. **Board source**: `play.html/.css/.js`, both sizes, transparent, commands, the queue, the big win card, saving the scores, reduced
   motion, and browser tests with fake Twitch and Kick sockets.
6. **Leaderboard source**: `leaderboard.html`, panel and strip, reading the board's scores live, with a browser test
   running both pages at once.
7. **Set-up page**, the widgets list entry, the preview pictures, the link-preview image.
8. **`/obs/drop`** for Trongates Legacy's scenes.
9. Docs: a "Drop" section in docs/widgets.md, plus testing.md.

## Open questions for the owner

1. **Name.** Ideas in Chatagram's spirit: **chatinko** (chat + pachinko), **plinkchat**, **chatdrop**, **droppr**. The
   command stays `!drop` whatever it's called.
2. **Default board**: Classic (the best known) or Pachinko (the most eye-catching)?
3. **Cooldown and cap defaults**: 20 s per person and 5 balls per command? A big chat might want 60 s.
4. **Leaderboard default**: take turns between This stream and All time, or This stream only?
5. **Chatter colour** as the default ball colour instead of the accent? It's livelier but less on-theme.
6. **Channel point redemptions** later? A Twitch reward with text shows in chat with a reward id, so "Redeem: drop 10
   balls" could work without a login. Kick's rewards aren't in its chat feed. Not in the first version.
