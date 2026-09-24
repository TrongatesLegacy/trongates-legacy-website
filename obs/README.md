# OBS scenes

Five 1920×1080 overlays in the site's style, plus an optional control dock. **Start at the index,
`https://www.trongateslegacy.com/obs/`**: live previews of every scene in a grid, click one to open it, a Copy
button for each OBS address, and an **Enlarge** button that shows the scene as big as the window with every
OBS source's position labelled (← → steps through the scenes, Esc closes). The control panel is built into
the index too: its colour buttons set the colour the previews show.

| Scene | File |
|---|---|
| Starting soon | `starting.html` |
| Be right back | `brb.html` |
| Just chatting | `chatting.html` |
| Game | `game.html` |
| Ending | `ending.html` |
| Control dock (optional) | `control.html` |

**Game** is a backdrop for the moments before your game appears: big "Loading the game" text centred to the
right of the chat. Your full-screen game capture sits on top of it, so once the game is up none of the overlay
shows. No space is reserved for the PNGtuber: put veadotube in the far bottom-right corner, over everything.

**Just chatting** has the chat on the left and a big space for your PNGtuber (veadotube via Spout) on the right. **Starting soon**, **Be right
back** and **Ending** have no veadotube: instead they cycle through
cyan Tron → Princess Trina → the Blobfish every 6 seconds with the website's glitch swap, and the whole scene
recolours with the form on show. All three carry the Lulu Gang Discord block (logos, *type !discord in chat*
and the QR code). Botrix widgets are separate OBS sources placed on top, in the frames the
overlays draw for them.

## The Discord

The Discord link itself is never printed on stream (nobody can click it). Each scene mentions it **once**, as
the chat command: *type **!discord** in chat* (your Botrix command). **Ending** also shows a QR code for
`https://discord.gg/FUKz6Dxk8W` (`public/obs/assets/discord-qr.svg`, high error correction; checked with an
independent decoder at 400, 200 and 120px). If the invite ever changes, regenerate the QR code (see
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

| Scene | Source | X | Y | W | H |
|---|---|---|---|---|---|
| Starting soon | *(nothing else: the overlay is the whole scene)* | | | | |
| Be right back | Botrix chat | 1348 | 122 | 494 | 800 |
| Just chatting | Botrix chat | 58 | 96 | 554 | 730 |
| | Botrix follower goal | 58 | 916 | 554 | 58 |
| | veadotube (Spout) | 760 | 110 | 980 | 880 |
| Game | your game capture, full screen, *above* the overlay | 0 | 0 | 1920 | 1080 |
| | veadotube (Spout) | far bottom-right corner, sized to taste, above everything | | | | |
| | Botrix chat | 68 | 192 | 464 | 630 |
| | Botrix follower goal | 68 | 914 | 464 | 58 |
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

Combine options with `&`, e.g. `https://www.trongateslegacy.com/obs/chatting.html?topic=Chilling&form=princess`.

## Sharing the PNGtuber across scenes

Add the veadotube Spout source once (in Just chatting), then reuse it in Game: use **+ → Spout2 Capture → Add
Existing** (or copy the source and **Paste (Reference)**), and set its transform from the table.
Both scenes then share one capture.

## Botrix widgets

Botrix doesn't support custom CSS on widgets yet (its docs list it as *upcoming*), so the styling is injected
by OBS instead:

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
   `https://www.trongateslegacy.com/obs/control.html?obs=4455&obspw=YOURPASSWORD` (drop `&obspw=…` if you
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
