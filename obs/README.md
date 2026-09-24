# OBS scenes

Five 1920×1080 overlays in the site's style, plus an optional control dock. **Start at the index,
`https://www.trongateslegacy.com/obs/`**: live previews of every scene in a grid, click one to open it, a Copy
button for each OBS address, and an **Enlarge** button that shows the scene as big as the window with every
OBS source's position labelled (← → steps through the scenes, Esc closes). The control panel sits in a column on the right of
the index too: its colour buttons set the colour the previews show. It doesn't connect to veadotube there: a website
talking to a local app makes Chrome label the page "Not Secure" (after you allow "Apps on device"). The scenes and
the OBS dock still follow veadotube.

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
| Control dock (optional) | `control` | `control.html` |

**Game** is a backdrop for the moments before your game appears: big "Loading the game" text centred to the
right of the chat. Your full-screen game capture sits on top of it, so once the game is up none of the overlay
shows. No space is reserved for the PNGtuber: put veadotube in the far bottom-right corner, over everything.

**Just chatting** has the chat on the left and a big space for your PNGtuber (veadotube via Spout) on the right. **Starting soon**, **Be right
back** and **Ending** have no veadotube: instead they open on the selected form (`form=`, else the last one
picked with the control buttons or veadotube), then cycle through Tron, Princess Trina and the Blobfish every
6 seconds (Tron's turn is cyan the first time, then a random one of cyan, gold and red) with the website's glitch swap, and the whole scene recolours with the form on show. Picking a form while
one is up glitches straight to it, and switching to the scene in OBS starts it on the selected form again. All three carry the Lulu Gang Discord block (logos, *type !discord in chat*
and the QR code). Botrix widgets are separate OBS sources placed on top, in the frames the
overlays draw for them.

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
`blobfish`). veadotube must be open on the **same PC** as OBS; if its server isn't `127.0.0.1:2424`, add
`veado=address:port`.

### If the colours don't follow on Game / Just chatting

The overlays reach veadotube on `127.0.0.1`, and newer browsers block public websites from talking to local
programs (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`; seen in Chrome 153). OBS's built-in browser is an older
Chromium that may still allow it. The control dock shows **veadotube: connected** when it works. If it
doesn't, load those two overlays as local files instead: download the repo
(<https://github.com/TrongatesLegacy/trongates-legacy-website> → **Code → Download ZIP**), keep the
`public/obs` folder somewhere on the streaming PC, and point the browser source at it with a `file:///` URL
(untick **Local file** so you can add options), e.g.
`file:///C:/Users/YOU/obs/chatting.html?topic=Chilling`. The folder is self-contained (its own fonts and art).
The cycling scenes and the Botrix CSS don't depend on veadotube, so the hosted URLs are fine for them.

## Adding a scene in OBS

For each of the five scenes:

1. **Scene Collection**: in the Scenes panel click **+**, name it (e.g. *Starting soon*).
2. **Sources → + → Browser**, name it *Overlay*:
   - **URL**: the scene's URL from the table at the top (plus any `?…` options)
   - **Width** `1920`, **Height** `1080`, **FPS** `30`
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
| Be right back | Botrix chat | 1348 | 156 | 494 | 728 |
| | Botrix follower goal | 1348 | 974 | 494 | 64 |
| Just chatting | Botrix chat | 58 | 160 | 554 | 724 |
| | Botrix follower goal | 58 | 974 | 554 | 64 |
| | veadotube (Spout) | 760 | 174 | 980 | 880 |
| Game | your game capture, full screen, *above* the overlay | 0 | 0 | 1920 | 1080 |
| | veadotube (Spout) | far bottom-right corner, sized to taste, above everything | | | | |
| | Botrix chat | 68 | 256 | 464 | 624 |
| | Botrix follower goal | 68 | 972 | 464 | 64 |
| Ending | *(nothing else: the overlay is the whole scene)* | | | | |

The PNGtuber space on Just chatting is sized so the avatar's feet land on the glowing pad and the rings
sit behind its head. Nudge the veadotube source by eye to suit your avatar's framing. The order in each
scene's source list, top to bottom: Botrix widgets → veadotube → Overlay. On **Game**, your full-screen game
capture goes at the very top, so the overlay is only seen before the game appears.

### Options per scene (add to the URL)

| Option | Scenes | What it does |
|---|---|---|
| `topic=Rocket%20League` | Just chatting, Game | adds a label next to the name in the top bar (Game shows "Game time" by default; Just chatting shows none) |
| `art=0` | Starting soon, Be right back, Ending | hides the character art |
| `cycle=0` | Starting soon, Be right back, Ending | stop cycling: show the veadotube form (static) and follow its colour |
| `form=princess` | all | the colour to start on before veadotube connects |
| `noveado=1` | all | don't connect to veadotube |
| `chat=…`, `goal=…` | Be right back, Just chatting, Game, chat, goal | your Botrix widget links, URL-encoded: shows them inside the frames (see *Botrix widgets*; the index's Copy adds them for you) |
| `key=…` | Be right back, Just chatting, Game, chat, goal | your `OBS_KEY`: loads the Botrix links kept in Netlify (see *Kept in Netlify*); a `chat=`/`goal=` beside it wins for its frame |
| `demo=1` | the same | Botrix's sample messages in the widgets (the index previews use it) |
| `goalcolor=0` | the same | keep the goal in the colours from its Botrix link instead of following the scene's form |
| `music=…` | Starting soon, Be right back, Just chatting, Ending, music | now playing: `0` off, `1` also outside OBS, `always` stay up while paused, `demo` a sample track |
| `musichost=…` | the same | SMTC Bridge's address if not `127.0.0.1:5000` |
| `app=…` | the same | only follow this player (part of its Windows app id, e.g. `spotify`, `applemusic`); default: whichever Windows has in focus |

Combine options with `&`, e.g. `https://www.trongateslegacy.com/obs/chatting?topic=Chilling&form=princess`.

## Sharing the PNGtuber across scenes

Add the veadotube Spout source once (in Just chatting), then reuse it in Game: use **+ → Spout2 Capture → Add
Existing** (or copy the source and **Paste (Reference)**), and set its transform from the table.
Both scenes then share one capture.

## Botrix widgets

### Embedded in the scenes (recommended)

The scenes can load your Botrix widgets straight into their frames, so each scene is **one** browser source in
OBS: no Botrix sources to position and no Custom CSS.

1. On the index page, paste the **chat** widget link (Botrix → Widgets → Chat → *Widget URL* → Copy) and,
   once you have it, the **follower goal** link into the *Botrix widgets* panel. They're stored in that browser
   only (Botrix says not to share them), never in the repo or on the website.
2. The previews then show the widgets in their frames, with Botrix's sample messages so you can see the look.
3. Each card's **Copy** now gives the scene address with the links included (`?chat=…&goal=…`, URL-encoded,
   without the sample messages). Use that as the scene's browser source URL.
4. **Copy bookmark link** (under the links) gives the index address with both links packed after the `#`
   (`#w=` + base64url of `{"chat":…,"goal":…}`). Open it anywhere (new tab, another browser or computer, or pasted
   into a tab that already has the index) and the links fill in and are saved in that browser. The `#…` stays in
   the address bar, so bookmarking the page keeps it, and editing a link updates it. A cut-off link shows a warning
   instead of silently doing nothing. It's a `#`, not a `?`, because the part after `#` is never sent to the server
   (a query string would land in Netlify's logs); it's only encoded, not encrypted, so keep the bookmark private.

Botrix keeps every setting in the link itself (`theme=neoncards`, `hideMessages=false`, font size…), so after
changing a setting in Botrix, copy the link again, paste it on the index, and re-copy the scene addresses.

Settings chosen for the frames (Botrix → Widgets → Chat): **Design ★ Neon Cards** (dark cards edged in each
viewer's colour, closest to the scenes' panels); **Hide old messages off** (the frame never sits empty);
background transparent; font size 21. The embedded widget fades out at the top of its frame instead of cutting a
message in half. Frames that get a widget: Be right back, Just chatting and Game (chat + goal each).

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

### A widget on its own (chat.html, goal.html)

`/obs/chat` and `/obs/goal` are just the framed widget (the same frame and *Chat* / *Goal* tab as in the scenes)
on a transparent page, for when one is wanted as its own OBS browser source: on top of the game, or in a scene
of your own. The frame fills whatever size the source is given; suggested **chat 500 × 800**, **goal 500 × 134**
(the goal design needs at least about 464 wide and the frame 134 tall). They take the same options as the scenes:
`key=` or `chat=`/`goal=` for the widget, and the colour follows veadotube / the dock / `form=`. The index's
**Widgets** tab (next to **Scenes**, top right) previews them and copies them with your links or key.

## Now playing (SMTC Bridge, Windows)

Starting soon, Be right back, Just chatting and Ending show the current song in their own panel (album art,
title, artist, progress, in the scene's colour), read from [SMTC Bridge](https://github.com/nuttylmao/smtc-bridge):
a small Windows tray app that serves whatever Windows' media controls show (Spotify, Apple Music, YouTube Music,
a browser tab…) as JSON at `http://127.0.0.1:5000/now-playing`. Nothing to add in OBS: install the bridge on the
streaming PC, tick *Start with Windows* in its tray menu, and the panel appears while music plays and fades out
when it stops (or when the bridge isn't running). The Game scene has none: put `/obs/music` on top of the game
instead (Widgets tab on the index; 560 × 100 suggested). To always follow one player (so a YouTube tab can't take
over), type it in the index's *Now playing: music app* field (e.g. `cider`, `applemusic`, `spotify`; any part
of the app's Windows id, listed at `http://127.0.0.1:5000/sessions` on the streaming PC): Copy then adds `app=…`
to the scenes with Now playing and the music page, and the bookmark link carries it.

It only asks the bridge from inside OBS: a normal browser would ask for *Apps on device* and label the page
"Not Secure", so there it stays hidden unless the URL has `music=1`. The index previews use a sample track.
Positions (for reference; it isn't an OBS source): Starting soon / Ending X 1220 Y 86 W 560 H 100, Be right back
X 800 Y 104 W 500 H 100, Just chatting X 690 Y 68 W 560 H 100. This replaces nutty's Universal Now Playing
widget (same bridge), so that one isn't needed; it can still be layered on top as a browser source if preferred.

### Kept in Netlify (instead of pasting them)

The links can live in the site's Netlify environment variables instead of in each browser. Then the OBS sources
only carry a key, and changing a Botrix setting means updating one variable, not re-copying every scene.

1. Netlify → Site configuration → Environment variables, add (tick *Contains secret values* for each):
   - `BOTRIX_CHAT_URL`: the chat widget link
   - `BOTRIX_GOAL_URL`: the follower goal widget link
   - `OBS_KEY`: a long random password you make up (it's what unlocks the links; anyone with it can read them)
2. Redeploy (Deploys → Trigger deploy) so the function sees them.
3. On the index, type the key into *Or the Netlify key*. The panel shows `Netlify: chat ✓, goal ✓` when it works.
   Each card's **Copy** then gives `…/obs/chatting?key=…`, and the bookmark link carries the key. The index also
   takes the key in its own address, like the scenes: bookmark `https://www.trongateslegacy.com/obs/#key=…`
   (`?key=…` works too, but the `#` form never reaches the server).

**Clear saved data** (next to Copy bookmark link) forgets everything the index saved in that browser: both links,
the key and the last colour, and takes any `#w=`/`#key=`/`?key=` out of the address so a reload doesn't bring them back.

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

## The control dock (optional)

The same panel as on the index, as an OBS dock. It shows whether veadotube is connected, lists your avatar states and the colour each maps
to, and has manual colour buttons for when veadotube isn't running.

1. **Tools → WebSocket Server Settings**: tick **Enable WebSocket server**, note the port (4455) and the password.
2. **Docks → Custom Browser Docks**: name it *Trongates*, with URL
   `https://www.trongateslegacy.com/obs/control?obs=4455&obspw=YOURPASSWORD` (drop `&obspw=…` if you
   didn't set a password). If it can't connect, use the local copy (see above).
3. For the buttons to reach the scenes, the scene overlays also need the WebSocket: add
   `obs=4455&obspw=YOURPASSWORD` to their URLs. Only do this if you want the manual buttons. The automatic
   veadotube colour change doesn't need it.

## Changing the scenes

**QR code:** it's generated once with the `qrcode` npm package (in a temp folder, not a dependency of the repo):
build an SVG from `QR.create(url, { errorCorrectionLevel: 'H' })` with dark modules on a light tile and a
4-module quiet zone, then confirm it decodes (e.g. with `jsqr`) before using it.

After any change, commit and push: that updates the hosted overlays and the Botrix CSS.


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
