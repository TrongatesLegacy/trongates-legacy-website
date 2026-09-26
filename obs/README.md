# OBS scenes

Five 1920×1080 overlays in the site's style, plus the **Trongates control dock**, which sets them up in OBS for
you (see *The control dock* below). **Start at the index, `https://www.trongateslegacy.com/obs/`**: live previews
of every scene (**Scenes**) and of the widget pages (**Sources**), a Copy button for each OBS address, and an
**Enlarge** button that shows a scene as big as the window with every OBS source's position labelled (← → steps
through the scenes, Esc closes). The right-hand column is the same settings panel as the dock (Live · Scenes ·
Widgets): what you set there drives the previews and the copied addresses. It never talks to veadotube or SMTC
Bridge (a website talking to local apps makes Chrome label the page "Not Secure"); the scenes and the dock do.

| Scene | Address (after `https://www.trongateslegacy.com/obs/`) | File |
|---|---|---|
| Starting soon | `starting` | `starting.html` |
| Be right back | `brb` | `brb.html` |
| Just chatting | `chatting` | `chatting.html` |
| Game | `game` | `game.html` |
| Ending | `ending` | `ending.html` |
| Chat box on its own (optional) | `chat` | `chat.html` |
| Follower goal on its own (optional) | `goal` | `goal.html` |
| Now playing on its own (optional) | `music` | `music.html` |
| Control dock | `control` | `control.html` |

**Game** is a backdrop for the moments before your game appears: "Loading the game" in the middle and nothing
else. Your full-screen game capture sits on top of it, so once the game is up none of the overlay shows. No space
is reserved for the PNGtuber: put veadotube in the far bottom-right corner, over everything.

**Game with `?layout=window`** (the index's *Game (window)* card) keeps the overlay on show around the game:
a 1408 × 792 window on the left for your game capture, with a small *Game* tag in its corner ("Loading the game" shows inside until the game covers it),
the follower goal bottom left with Now playing beside it, the chat top right, and the bottom-right corner left
free for veadotube (`rings=1`, the dock's *Rings* chip, puts the stage's animated rings behind it).

**Just chatting** has the chat on the left and a big space for your PNGtuber (veadotube via Spout) on the right. **Starting soon**, **Be right
back** and **Ending** have no veadotube: instead they open on the selected form (`form=`, else the last one
picked with the control buttons or veadotube), then cycle through Tron, Princess Trina and the Blobfish every
6 seconds (Tron's turn is cyan the first time, then a random one of cyan, gold and red) with the website's glitch swap, and the whole scene recolours with the form on show. Picking a form while
one is up glitches straight to it, and switching to the scene in OBS starts it on the selected form again. While
OBS isn't showing the scene the cycle pauses and colour changes swap the art without animating, so nothing piles
up and plays all at once when the scene comes back. All three carry the Lulu Gang Discord block (logos, *type !discord in chat*
and the QR code). The Botrix chat and goal load inside the frames the overlays draw for them (or the chat is one
shared source the dock places in every frame).

## The Discord

The Discord link itself is never printed on stream (nobody can click it). Each scene mentions it **once**, as
the chat command: *type **!discord** in chat* (your Botrix command). **Ending** also shows a QR code for
`https://discord.gg/FUKz6Dxk8W` (`public/obs/assets/discord-qr.svg`, high error correction; checked with an
independent decoder at 400, 200 and 120px). The SVG's viewBox trims the quiet zone to 2 modules so the code fills
its white square (read by Chrome's barcode detector in the scenes at 1080p and at 720p, down to 87px). If the invite ever changes, regenerate the QR code (see
*Changing the scenes*).

## Colours on Game and Just chatting follow veadotube

Those two overlays connect to **veadotube mini's local API** and listen for avatar state changes. Your Stream
Deck already switches veadotube's state, so **one Stream Deck press changes your PNGtuber *and* recolours the
scene**. There's nothing to set up for this.

Your avatar's states (read from `chibi-v1-animated-with-blobfish.veado`) are mapped exactly:

| veadotube state | Scene colour |
|---|---|
| `cyan`, `animated` | Tron cyan |
| `red` | red |
| `yellow` | gold |
| `pink`, `princess` | Princess Trina pink |
| `blobfish` | Blobfish orange |

A state added later is matched by name (princess/pink → pink, blob/fish → orange, red → red, yellow/gold →
gold, anything else → cyan); the control dock lists every state and its colour, and `map=state name:form`
on the URL overrides one (e.g. `map=cheering:yellow`; forms are `cyan`, `yellow`, `red`, `princess`,
`blobfish`). veadotube must be open on the **same PC** as OBS; if its server isn't `127.0.0.1:54765` (veadotube → program settings → *serving at*; type that into *server address* so it never changes), add
`veado=address:port`.

### If the colours don't follow on Game / Just chatting

The overlays reach veadotube on `127.0.0.1`, and newer browsers block public websites from talking to local
programs (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`; seen in Chrome 153). OBS's built-in browser is an older
Chromium that may still allow it. The control dock shows **veadotube: connected** when it works. If it
doesn't, load those two overlays as local files instead: download the repo
(<https://github.com/TrongatesLegacy/trongates-legacy-website> → **Code → Download ZIP**), keep the
`public/obs` folder somewhere on the streaming PC, and point the browser source at it with a `file:///` URL
(untick **Local file** so you can add options), e.g.
`file:///C:/Users/YOU/public/obs/chatting.html?form=princess`. Keep the whole `public` folder: the scenes use the
website's character art (`public/assets/img/`, pre-sized by `scripts/presize-art.mjs`).
The cycling scenes and the Botrix CSS don't depend on veadotube, so the hosted URLs are fine for them.

## Adding a scene in OBS

The dock (below) writes each overlay's options, adds the shared chat and can place your own sources; you only add
the overlay browser source itself. By hand, for each of the five scenes:

1. **Scene Collection**: in the Scenes panel click **+**, name it (e.g. *Starting soon*).
2. **Sources → + → Browser**, name it *Overlay*:
   - **URL**: the scene's URL from the table at the top (plus any `?…` options)
   - **Width** `1920`, **Height** `1080`
   - tick **Use custom frame rate** and set **FPS** `30`: with it unticked the animations (glitch, ticker, light
     trails, rings) may not play at all
   - leave **Shutdown source when not visible** unticked
   - OK. It fills the canvas; right-click → **Transform → Reset Transform** if it doesn't.
3. Add your **veadotube (Spout)** source above the overlay (see *Sharing the PNGtuber* below), and the Botrix
   widgets above that, at the positions in the table for that scene.
4. To place a source exactly: right-click it → **Transform → Edit Transform** (Ctrl+E), set **Position** and
   **Size** (Bounding Box Type *Scale to inner bounds*, Bounding Box Size = W × H).

**Seeing where things go:** add `?guide=1` to an overlay URL temporarily. Every space then shows a yellow
dashed box labelled with its exact X, Y, W and H. Remove it when you're done.

### Source positions (1920×1080 canvas)

The socials strip runs along the **top** of every scene (a video player's controls cover the bottom), so
the bottom edge is kept clear of anything that matters.

| Scene | Source | X | Y | W | H |
|---|---|---|---|---|---|
| Starting soon | *(nothing else: the overlay is the whole scene)* | | | | |
| Be right back | Botrix chat | 28 | 242 | 554 | 654 |
| | Botrix follower goal | 28 | 982 | 554 | 64 |
| Just chatting | Botrix chat | 28 | 242 | 554 | 654 |
| | Botrix follower goal | 28 | 982 | 554 | 64 |
| | veadotube (Spout) | 760 | 174 | 980 | 880 |
| Game | your game capture, full screen, *above* the overlay | 0 | 0 | 1920 | 1080 |
| | veadotube (Spout) | far bottom-right corner, sized to taste, above everything | | | | |
| Game `?layout=window` | your game capture, *above* the overlay | 28 | 92 | 1408 | 792 |
| | Botrix chat | 1488 | 126 | 404 | 370 |
| | Botrix follower goal | 28 | 982 | 554 | 64 |
| | veadotube (Spout) | 1470 | 530 | 440 | 534 |
| Ending | *(nothing else: the overlay is the whole scene)* | | | | |

The PNGtuber space on Just chatting is sized so the avatar's feet land on the glowing pad and the rings
sit behind its head. Nudge the veadotube source by eye to suit your avatar's framing. The order in each
scene's source list, top to bottom: Botrix widgets → veadotube → Overlay. On **Game**, your full-screen game
capture goes at the very top, so the overlay is only seen before the game appears.

### Options per scene (add to the URL)

| Option | Scenes | What it does |
|---|---|---|
| `hide=goal,discord` | every scene | turn parts off: `chat`, `goal`, `music`, `discord`, `socials` (the social links), `ticker` (the socials strip), `art` (the character), `rings` (the stage's animated rings, halo and pad behind the character or veadotube). On Be right back and Just chatting the chat grows into the room a missing goal or now playing leaves |
| `art=0` | Starting soon, Be right back, Ending | hides the character art (same as `hide=art`) |
| `cycle=0` | Starting soon, Be right back, Ending | stop cycling: show the veadotube form (static) and follow its colour |
| `form=princess` | all | the colour to start on before veadotube connects |
| `noveado=1` | all | don't connect to veadotube |
| `veadodelay=300` | all that follow veadotube | wait this many ms after a veadotube switch before recolouring (if the model loads slowly) |
| `map=pink:red` | all that follow veadotube | pin a veadotube state to a colour (the dock's Live tab sets this) |
| `obs=4455`, `obspw=…` | all | listen to the dock's colour buttons through the OBS WebSocket (the dock adds these) |
| `chat=…`, `goal=…` | Be right back, Just chatting, Game (window), chat, goal | your Botrix widget links, URL-encoded: shows them inside the frames (see *Botrix widgets*; the index's Copy adds them for you) |
| `key=…` | Be right back, Just chatting, Game (window), chat, goal | your `OBS_KEY`: loads the Botrix links kept in Netlify (see *Kept in Netlify*); a `chat=`/`goal=` beside it wins for its frame |
| `layout=window` | Game | the windowed layout (a 1408 × 792 game window, goal, now playing, chat, space for veadotube) instead of the full-screen backdrop |
| `rings=1` | Game (`layout=window`) | the stage's animated rings behind veadotube (off by default here; the dock's *Rings* chip). The other scenes have them on: `hide=rings` turns them off |
| `chat=0` | Be right back, Just chatting, Game (window) | don't load the chat (a shared chat source sits in the frame instead; see *One shared chat for every scene*) |
| `bare=1` | chat | no frame: just the chat, filling the source (the shared chat source) |
| `demo=1` | the same | Botrix's sample messages in the widgets (the index previews use it) |
| `goalcolor=0` | the same | keep the goal in the colours from its Botrix link instead of following the scene's form |
| `motion=full` / `motion=reduce` | every scene and widget page | force animations on or off. By default a normal browser follows the system's reduce-motion setting, but OBS ignores it (Windows' *Animation effects* off would otherwise freeze the scenes on stream) |
| `music=…` | Starting soon, Be right back, Just chatting, Ending, music | now playing: `0` off (same as `hide=music`), `1` also outside OBS, `always` stay up while paused, `demo` a sample track |
| `musichost=…` | the same | SMTC Bridge's address if not `127.0.0.1:5000` |
| `app=…` | the same | only follow this player (part of its Windows app id, e.g. `spotify`, `applemusic`); default: whichever Windows has in focus |
| `cidertoken=…` | the same | Cider's API token (Cider → Settings → Connectivity → Manage External Application Access), used when Windows gives no timeline (see *Now playing*) |
| `musicdebug=1` | the same | show the bridge's raw timeline numbers (position, start, end, seek range, update time) in place of the time, to see what a player sends |

Combine options with `&`, e.g. `https://www.trongateslegacy.com/obs/chatting?form=princess&app=cider`.

## Sharing the PNGtuber across scenes

Add the veadotube Spout source once (in Just chatting), then reuse it in Game: use **+ → Spout2 Capture → Add
Existing** (or copy the source and **Paste (Reference)**), and set its transform from the table.
Both scenes then share one capture.

## Botrix widgets

### Embedded in the scenes (recommended)

The scenes can load your Botrix widgets straight into their frames, so each scene is **one** browser source in
OBS: no Botrix sources to position and no Custom CSS.

1. In the settings panel (index or dock) → **Widgets** → *Links from*: **Pasted links**, paste the **chat** widget
   link (Botrix → Widgets → Chat → *Widget URL* → Copy) and the **follower goal** link. Or keep them in Netlify
   (below) and use *Netlify key*. They're stored in that browser only (Botrix says not to share them), never in
   the repo or on the website.
2. The previews then show the widgets in their frames, with Botrix's sample messages so you can see the look.
3. Each card's **Copy** gives the scene address with the links included (`?chat=…&goal=…`, URL-encoded, or
   `?key=…`), without the sample messages. In OBS the dock writes these for you.
4. **Widgets → Copy settings link** gives the page's address with every setting packed after the `#`
   (`#s=` + base64url of the settings JSON). Open it anywhere (a new tab, another browser or computer, the dock's
   address, or pasted into a tab that already has the page) and the settings are imported, once: later changes
   are kept. A cut-off link shows a warning instead of doing nothing. It's a `#`, not a `?`, because the part
   after `#` is never sent to the server; it's only encoded, not encrypted, so keep the link private. (Older
   `#w=…` and `#key=…` links still import.)

Botrix keeps every setting in the link itself (`theme=neoncards`, `hideMessages=false`, font size…), so after
changing a setting in Botrix, copy the link again, paste it on the index, and re-copy the scene addresses.

Settings chosen for the frames (Botrix → Widgets → Chat): **Design ★ Neon Cards** (dark cards edged in each
viewer's colour, closest to the scenes' panels); **Hide old messages off** (the frame never sits empty);
background transparent; font size 21. The embedded widget fades out at the top of its frame instead of cutting a
message in half. Frames that get a widget: Be right back, Just chatting and Game with `layout=window` (chat + goal each).

Follower goal (Botrix → Widgets → Follower goal), chosen from all 30 designs at the frame's size: **★ Stamina Surge**
(one row, 63px tall, so it fits the 64px goal frame; most other designs are two rows or ignore the font size and
overflow). The goal page doesn't keep changes (they're gone on reload), but the widget reads every setting from its
link, so the settings live in the link itself:
`theme=stamina-surge`, `fontFamily=Orbitron` (not in Botrix's font list, but typing it works), `fontSize=32`,
`fillColor=#22e5ff`, `textColor=#ffffff`, `subTextColor=#ffffff`, `backgroundColor=#11161900` (container
transparent, so the frame's glass shows through), `accentColor=#22e5ff`, `borderColor=#22e5ff66`,
`trackColor=#22e5ff22`, `message=FOLLOWERS`. Only the design, container, fill, text, message and font can be set
on Botrix's page; accent, border, track and sub-text colours are link-only. Colours take an alpha
(`#rrggbbaa`), which is how "transparent" works. Theme ids are kebab-case versions of the design names
(`glass-panel`, `xp-surge`…), except ★ Rainbow, which is `arcoiris`.

The goal follows the scene's colour: `scene.js` sets `fillColor`, `accentColor`, `borderColor` (40%) and
`trackColor` (13%) in the link to the current form's accent. Changing the link reloads the widget, so each form
gets its own copy, made the first time that form shows (the cycling scenes load their three up front) and kept;
switching crossfades to it once it has drawn. `goalcolor=0` turns this off.

### One shared chat for every scene, by hand (the dock does all this for you)

Each scene is its own browser in OBS, so each loads its own copy of the Botrix chat, and Botrix only shows
messages that arrive after a copy loads: scenes loaded or refreshed at different times show different messages.
One chat source added to every scene fixes that (same browser, same messages everywhere):

1. **Index:** Settings → Widgets → turn **Shared chat** on, then re-copy the Be right back, Just chatting and Game
   (window) addresses into their overlay sources. They now end in `chat=0`: the scenes stop loading their own
   chat (the goal still loads).
2. **Create the shared source once** (in any of those scenes): Sources → **+** → Browser → *Create new*, name it
   *Shared chat*:
   - URL: the **Shared chat** card's Copy on the index's **Sources** tab (`…/obs/chat?bare=1&key=…`)
   - Width `554`, Height `654`; tick **Use custom frame rate**, FPS `30`; leave *Shutdown source when not
     visible* unticked
3. **Add it to the other scenes:** Sources → **+** → Browser → **Add Existing** → *Shared chat*. Keep it above the
   overlay in each scene's source list.
4. **Place it** in each scene (right-click → Transform → Edit Transform; Ctrl+E):

| Scene | Position | Crop | Bounding box | Why |
|---|---|---|---|---|
| Be right back | `28, 242` | none | none | the frame is exactly 554 × 654 |
| Just chatting | `28, 242` | none | none | the same left column as Be right back |
| Game `?layout=window` | `1488, 126` | **Top** `147` | *Scale to inner bounds*, `404 × 370` | a smaller frame: the top (oldest messages) is cropped, then it's scaled to 73% |

The chat stacks from the bottom, so cropping the top only drops the oldest messages. In OBS, Position is where
the cropped top-left corner lands. The Enlarge view on the index shows each frame's box to check against.

### A widget on its own (chat.html, goal.html)

`/obs/chat` and `/obs/goal` are just the framed widget (the same frame and *Chat* / *Goal* tab as in the scenes)
on a transparent page, for when one is wanted as its own OBS browser source: on top of the game, or in a scene
of your own. The frame fills whatever size the source is given; suggested **chat 500 × 800**, **goal 500 × 134**
(the goal design needs at least about 464 wide and the frame 134 tall). They take the same options as the scenes:
`key=` or `chat=`/`goal=` for the widget, and the colour follows veadotube / the dock / `form=`. The index's
**Sources** tab (next to **Scenes**) previews them and copies them with your links or key; the dock's Sources tab
adds them to a scene for you.

## Now playing (SMTC Bridge, Windows)

Starting soon, Be right back, Just chatting and Ending show the current song in their own panel (album art,
title, artist, progress, in the scene's colour), read from [SMTC Bridge](https://github.com/nuttylmao/smtc-bridge):
a small Windows tray app that serves whatever Windows' media controls show (Spotify, Apple Music, YouTube Music,
a browser tab…) as JSON at `http://127.0.0.1:5000/now-playing`. Nothing to add in OBS: install the bridge on the
streaming PC, tick *Start with Windows* in its tray menu, and the panel appears while music plays and fades out
when it stops (or when the bridge isn't running). The full-screen Game scene has none (the window layout does): put `/obs/music` on top of the game
instead (the Sources tab; 560 × 100 suggested). To always follow one player (so a YouTube tab can't take
over), type it in Settings → Widgets → *Music app* (e.g. `cider`, `applemusic`, `spotify`; any part
of the app's Windows id, listed at `http://127.0.0.1:5000/sessions` on the streaming PC): Copy then adds `app=…`
to the scenes with Now playing and the music page, and the settings link carries it.

It only asks the bridge from inside OBS: a normal browser would ask for *Apps on device* and label the page
"Not Secure", so there it stays hidden unless the URL has `music=1`. The index previews use a sample track.
Positions (for reference; it isn't an OBS source): Starting soon / Ending X 1220 Y 86 W 560 H 100; Be right back
and Just chatting X 40 Y 74 W 590 H 100 (top of the left column, above the chat and goal: the right side stays clear
for the character / avatar); Game `layout=window` X 637 Y 890 W 560 H 134 (beside the goal, the same height). This replaces nutty's Universal Now Playing
widget (same bridge), so that one isn't needed; it can still be layered on top as a browser source if preferred.

**Players that give Windows no timeline (Cider):** some players report the song but no position or length
(`musicdebug=1` shows `P0 S0 E0 M0`), so there's nothing to draw a progress bar from. For those, the scenes and
the dock ask **Cider's own API** instead (`http://localhost:10767/api/v1/playback/now-playing`, which gives the
position and the length). It usually wants an app token: Cider → Settings → Connectivity → Manage External
Application Access; paste it in Settings → Widgets → *Cider API token*. The dock's Widgets → Troubleshooting says
whether Cider's API answers (ok, needs a token, wrong token, not reachable). Built from Cider 2's documented API;
Cider 3 (the .NET version) may differ: if Troubleshooting says *not reachable* with Cider open, open
`http://localhost:10767/api/v1/playback/active` in a browser on that PC to see whether it's there at all.

### Kept in Netlify (instead of pasting them)

The links can live in the site's Netlify environment variables instead of in each browser. Then the OBS sources
only carry a key, and changing a Botrix setting means updating one variable, not re-copying every scene.

1. Netlify → Site configuration → Environment variables, add (tick *Contains secret values* for each):
   - `BOTRIX_CHAT_URL`: the chat widget link
   - `BOTRIX_GOAL_URL`: the follower goal widget link
   - `OBS_KEY`: a long random password you make up (it's what unlocks the links; anyone with it can read them)
2. Redeploy (Deploys → Trigger deploy) so the function sees them.
3. In the settings panel → **Widgets** → *Links from*: **Netlify key**, type the key. It shows `chat ✓ goal ✓`
   when it works. Each card's **Copy** then gives `…/obs/chatting?key=…`, and the settings link carries the key.
   The index also takes the key in its own address: `https://www.trongateslegacy.com/obs/#key=…`.

**Widgets → Clear** (index) forgets everything the index saved in that browser and takes any `#…`/`?key=` out of the
address so a reload doesn't bring it back.

`/api/obs-widgets` (`netlify/functions/obs-widgets.mjs`) hands the links only to requests whose `X-OBS-Key`
header matches `OBS_KEY`, and never lets them be cached. Scenes loaded as local files ask the live site. A link
pasted on the index (or `chat=`/`goal=` on a scene URL) still wins for its frame. To change the key, update
`OBS_KEY`, redeploy, and re-copy the scene addresses.

### As separate OBS sources

If you'd rather keep Botrix as its own sources (the positions are in the table above): Botrix doesn't support
custom CSS on widgets yet (its docs list it as *upcoming*), so the styling is injected by OBS instead:

1. In Botrix, copy the widget's **browser source URL** (e.g. the chat widget).
2. In OBS, **+ → Browser**, paste it as the URL, and set Width/Height to the W/H from the table.
3. Clear the **Custom CSS** box and put this one line in it:

   | Widget | Custom CSS |
   |---|---|
   | Chat | `@import url("https://www.trongateslegacy.com/obs/botrix/chat.css");` |
   | Anything else (goal, alerts…) | `@import url("https://www.trongateslegacy.com/obs/botrix/widgets.css");` |

   The styles live on the website, so later tweaks reach OBS without editing anything. Right-click the source →
   **Refresh** to pick them up immediately.
4. In Botrix's own widget settings, set the background to transparent if it has that option. The overlay
   already draws the themed frame behind it.

The frames around the widgets change colour with your form. The widget text itself stays white, and chat
usernames keep each viewer's colour. The CSS injected by OBS is fixed and can't follow veadotube.

## The control dock

An OBS dock that runs everything from inside OBS. Tabs: **Live · Scenes · Sources · Widgets · Layout**. Nothing
changes in OBS until you press **Review & apply**, which lists every change first (CREATE / ADD / UPDATE / PLACE /
LOCK / REMOVE) and says which sources will reload. The exceptions are the Sources tab's add buttons (immediate)
and the shared chat's crop following the music (live behaviour).

**Setting it up**
1. **Tools → WebSocket Server Settings**: tick **Enable WebSocket server**, note the port (4455) and the password.
2. On the index, fill in the settings (Widgets: the OBS WebSocket port and password, your Netlify key, music
   app…), then **Widgets → Copy dock address** (it includes the port and password).
3. **Docks → Custom Browser Docks**: name it *Trongates*, paste that address. Apply.

The port and password can also be typed straight into the dock (**Widgets → OBS WebSocket**); changing them
reconnects. They're kept for every scene collection. `obs=`/`obspw=` in the dock's address are read once, so an
old address never overwrites a password you've since corrected in the dock.
4. In the dock, check **Scenes** (it finds your Trongates overlays itself), then **Review & apply**.

The settings in the dock's address are imported **once**; after that the dock keeps its own copy (per scene
collection, in OBS's browser storage, so it survives restarts). A different settings link in the address, or
**Widgets → Import**, imports again. If the dock's storage is ever wiped, **Widgets → Read settings back from OBS**
(or simply opening the dock on a collection it hasn't seen) rebuilds the settings from the overlays' URLs.

**Live:** the avatar buttons (Tron, Tron animated when veadotube has that state, gold, red, Princess, Blobfish).
With veadotube connected a button switches veadotube's state and the colour follows once veadotube confirms, so it
doesn't run ahead of the model; the switch then reaches every scene, the cycling ones too (the dock adds
`obs=`/`obspw=` to the overlays for that). Without veadotube a button just recolours. Below: veadotube's states
(pick a colour for any of them: that becomes `map=` on the scenes that follow veadotube), the song SMTC Bridge
sees, and the connections.

**Scenes:** every OBS scene holding a Trongates overlay, found by the overlay's URL (hosted or a local file), so
your own scene names don't matter (*Intermission → Just chatting*), including overlays inside groups and nested
scenes. Per scene: *Don't manage* to leave it alone, Game's layout (full screen or window), ↻ to reload the
overlay, and chips to turn parts off (Chat, Goal, Now playing, Discord, Social links, Socials strip, Character, Rings)
and *Cycles forms* / *Follows veadotube*. Scenes without a Trongates overlay are listed and left alone.

**Sources:** add our widgets as their own OBS sources to the current scene (or any): the chat box, follower goal,
now playing, and the shared chat. *Add existing* reuses the same source (one browser in several scenes); *New copy*
makes another. They land just above the scene's overlay, centred, and are yours to move; their options (key, music
app…) stay current through Review & apply. **Found, not managed** lists widget sources you added by hand that the
dock recognises (a raw Botrix chat link, our widget pages): *Use as shared chat*, *Adopt*, or *Ignore*.

**Widgets:** Botrix (Netlify key or pasted links), the **shared chat** switch (below), goal colour following, now
playing (music app, stay up while paused, SMTC Bridge address), veadotube (address, whether the buttons switch
the avatar, which state the Tron button uses, a wait before recolouring), animations, troubleshooting (the raw
SMTC timeline), and backup (copy settings link, import, read back from OBS).

**Layout** (optional): pick your own game capture source (e.g. your *Game Captures* scene) and veadotube source per
scene; they're never touched unless picked. **Checks** lists what's off: overlays without custom frame rate 30 or
not filling the canvas, a picked game capture not in the game window, the shared chat out of its frame.
**Tidy layout…** fixes those (after showing the plan). *Lock the dock's own items* locks what the dock placed.

**Avatar size (veadotube):** veadotube's Spout picture is its whole window, mostly empty, so fitting it into the
veadotube space leaves the avatar small. **Measure avatar** (before going live; viewers would see it) steps
veadotube through every state for about a second each, takes five small screenshots of the Spout source per
state (OBS's `GetSourceScreenshot`), and keeps each state's resting outline: the median of the frames, so a
talking, blinking or bouncing frame doesn't count. The avatar's outline is all the states together, and veadotube
goes back to the state it was on. Tidy then scales the avatar to the height you set (by default Just chatting 880, the space's full height, and Game
(window) 580, rising about 30 px over the chat frame's bottom edge) and stands it on the veadotube space's bottom line,
centred; set it taller and it rises further. Nothing is cropped: veadotube's canvas is transparent round the avatar, so anything
that moves past the resting outline (Blobfish's swinging princess, a bounce) stays visible. Keep veadotube's
background transparent: with a background colour the whole uncropped canvas would show as a box. Nothing is measured
during a stream: after this, switching states (Stream Deck, hotkeys, the dock) never moves or resizes it; talking
or bouncing extends it upwards. If veadotube reports a state that isn't measured (a new one), the dock says so on
Live and Layout (**!** on the Layout tab); if the veadotube window size changes, Layout says *measure again*.

**What the dock never does:** reorder, move or change your own sources (unless picked on Layout), put anything
at the top of a scene, or delete anything it didn't create. Its own sources carry a hidden tag
(`tgl_managed` in their settings), so it recognises them even if renamed and never makes duplicates.

**The shared chat (dock):** one browser source, *Trongates · Shared chat*, with your raw Botrix chat link at
554 × 920 (the tallest the left column's chat frame gets), added to every scene with a chat frame, just above that scene's overlay, and fitted to the frame: the
top is cropped to the frame's height (on Game (window) it's also scaled to 404 × 370). The scenes get `chat=0`.
When nothing's playing, Be right back and Just chatting give the chat the room now playing leaves; the dock reads
SMTC Bridge too and changes the shared chat's crop at the same moment. The dock keeps its link current from Netlify
and only reloads it when the link changes. **Remove** takes it out of every scene and undoes `chat=0`. On
Game (window) the chat sits just above the overlay: if your game capture is above the overlay, place it in the window
(Layout) so it doesn't cover the chat.

## Changing the scenes

**QR code:** it's generated once with the `qrcode` npm package (in a temp folder, not a dependency of the repo):
build an SVG from `QR.create(url, { errorCorrectionLevel: 'H' })` with dark modules on a light tile and a
4-module quiet zone, then confirm it decodes (e.g. with `jsqr`) before using it.

After any change, commit and push: that updates the hosted overlays and the Botrix CSS.

**Spacing:** the scenes with frames (Be right back, Just chatting, Game (window)) keep 10px from the canvas's left and
right edges and below the socials strip, 16px from the bottom edge, and 16px between stacked frames. The left
column (now playing, chat, goal) and the goal's spot are the same on all three, so switching scenes doesn't move
them. The geometry lives in four places that must agree: `build-scenes.py` (the frames), `model.js` `chatBox()`
(where the dock fits the shared chat), `panel.js` `CAPTURE` and `VEADO_BOX` (where Tidy puts the game capture and
veadotube), and the position tables above. Change one, change all, and measure the rendered slots.

The control panel is `shared/panel.js` (dock and index), on top of `shared/model.js` (the settings, the scene
types and parts, and the one function that turns settings into each scene's URL; the dock's shared chat geometry
is `chatBox()` there, matching the left column in `build-scenes.py`) and `shared/obsws.js` (a small OBS WebSocket
v5 client). Test the dock against a stand-in OBS WebSocket server before pushing: nothing in OBS can be checked
from the hosted site otherwise.


The scene pages are generated from one template:

```
python3 obs/build-scenes.py        # writes public/obs/{starting,brb,chatting,game,ending}.html
```

Paths inside `public/obs` are relative and it carries its own fonts and logos (`public/obs/assets/`), so the
folder works anywhere. Shared pieces: `public/obs/shared/overlay.css` (look), `theme.js` (form colours, veadotube + OBS WebSocket),
`scene.js` (light trails, form-cycling art, guide labels), `icons.js` (platform icons). The control dock is
`public/obs/control.html`; the Botrix CSS is `public/obs/botrix/`. Everything under `public/` deploys with
the site, so check it the same way as any site change (docs/verification.md). `?guide=1` plus
`scripts/shot.mjs` at `--width=1920 --height=1080` is the quickest check.
