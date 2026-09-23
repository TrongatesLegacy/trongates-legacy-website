# OBS scenes

Five 1920×1080 overlays in the site's style, plus an optional control dock:

| Scene | File |
|---|---|
| Starting soon | `starting.html` |
| Be right back | `brb.html` |
| Just chatting | `chatting.html` |
| Game | `game.html` |
| Ending | `ending.html` |
| Control dock (optional) | `control.html` |

Your PNGtuber (veadotube via Spout) appears on **Game** and **Just chatting** only; those overlays leave a space
for it. **Starting soon**, **Be right back** and **Ending** show the current form's character art instead,
which swaps automatically with your form. Botrix widgets are separate OBS sources placed on top, in the
frames the overlays draw for them.

## Where OBS loads them from: local files

Use the copy in **`Dropbox/Kick/obs-overlays`** on the streaming PC (`obs/sync-dropbox.sh` puts it there from
this repo; re-run it after any change and Dropbox delivers the update).

Why local files and not the website: the scenes recolour by talking to veadotube on `127.0.0.1`, and browsers
now block public websites from reaching local services (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`). A page
opened from a local file is allowed to. The same files are also hosted at
`https://www.trongateslegacy.com/obs/…` for previewing, but from there the colours won't follow veadotube.

In OBS, point a browser source at a local file with options by **unticking "Local file"** and typing a
`file:///` URL, with forward slashes, e.g.:

```
file:///C:/Users/YOU/Dropbox/Kick/obs-overlays/starting.html?minutes=10
```

(Find the real folder in File Explorer, click the address bar and copy it; swap `\` for `/`.) If you don't need
options, you can instead tick **Local file** and browse to the `.html`.

## Colours follow your form automatically

Every overlay connects to **veadotube mini's local API** and listens for avatar state changes. Your Stream Deck
already switches veadotube's state, so **one Stream Deck press changes your PNGtuber *and* recolours every
scene**. There's nothing to set up for this.

The colour is picked from the state's name:

| State name contains | Colour |
|---|---|
| princess, trina, tiara, dress, pink | Princess Trina pink |
| blob, fish | Blobfish orange |
| red, angry, rage, mad | red |
| yellow, gold, happy | gold |
| anything else | Tron cyan |

To see exactly what each of your states maps to, open the control dock (below). It lists them all. If one
is wrong, add `map=state name:form` to the end of each scene URL. For example:
`file:///…/obs-overlays/starting.html?map=fishing:blobfish,cheering:yellow`.
The forms are `cyan`, `yellow`, `red`, `princess` and `blobfish`.

veadotube must be open on the **same PC** as OBS. If it uses a server address other than `127.0.0.1:2424`,
add `veado=address:port` to the URLs.

## Adding a scene in OBS

For each of the five scenes:

1. **Scene Collection**: in the Scenes panel click **+**, name it (e.g. *Starting soon*).
2. **Sources → + → Browser**, name it *Overlay*:
   - **URL**: the scene's `file:///…/obs-overlays/<scene>.html` URL (plus any `?…` options)
   - **Width** `1920`, **Height** `1080`, **FPS** `30`
   - tick **Refresh browser when scene becomes active** on *Be right back* only (restarts its "Away for" timer)
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
| Just chatting | veadotube (Spout) | 180 | 110 | 980 | 880 |
| | Botrix chat | 1308 | 96 | 554 | 730 |
| | Botrix follower goal | 1308 | 916 | 554 | 58 |
| Game | game / display capture | 0 | 0 | 1920 | 1080 (put it *below* the overlay) |
| | veadotube (Spout) | 1500 | 560 | 380 | 480 |
| | Botrix chat | 58 | 302 | 394 | 470 |
| | Botrix follower goal | 58 | 982 | 394 | 40 |
| | Botrix alerts | 0 | 0 | 1920 | 1080 (full screen; alerts appear top-centre) |
| Ending | *(nothing else: the overlay is the whole scene)* | | | | |

The PNGtuber spaces (Just chatting, Game) are sized so the avatar's feet land on the glowing pad and the rings
sit behind its head. Nudge the veadotube source by eye to suit your avatar's framing. The order in each
scene's source list, top to bottom: Botrix widgets → veadotube → Overlay (→ game capture on the Game scene).

### Options per scene (add to the URL)

| Option | Scenes | What it does |
|---|---|---|
| `minutes=10` | Starting soon | shows "Starting in 9:59" counting down, then "Any second now" |
| `at=19:30` | Starting soon | counts down to that local time instead |
| `topic=Rocket%20League` | Just chatting | changes "Just chatting" in the top bar |
| `chat=0` / `goal=0` | Game | hides the chat / goal frame if you don't use it there |
| `art=0` | Starting soon, Be right back, Ending | hides the character art |
| `form=princess` | all | the colour to start on before veadotube connects |
| `noveado=1` | all | don't connect to veadotube |

Combine options with `&`, e.g. `…/starting.html?minutes=10&map=fishing:blobfish`.

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

A small OBS panel that shows whether veadotube is connected, lists your avatar states and the colour each maps
to, and has manual colour buttons for when veadotube isn't running.

1. **Tools → WebSocket Server Settings**: tick **Enable WebSocket server**, note the port (4455) and the password.
2. **Docks → Custom Browser Docks**: name it *Trongates*, with URL
   `file:///…/obs-overlays/control.html?obs=4455&obspw=YOURPASSWORD` (drop `&obspw=…` if you didn't set a
   password). It has to be the local file too, for the same local-network reason.
3. For the buttons to reach the scenes, the scene overlays also need the WebSocket: add
   `obs=4455&obspw=YOURPASSWORD` to their URLs. Only do this if you want the manual buttons. The automatic
   veadotube colour change doesn't need it.

## Changing the scenes

After any change: `obs/sync-dropbox.sh` (updates the PC's copy via Dropbox), then commit and push (updates the
hosted copy and the Botrix CSS).


The scene pages are generated from one template:

```
python3 obs/build-scenes.py        # writes public/obs/{starting,brb,chatting,game,ending}.html
```

Paths inside `public/obs` are relative and it carries its own fonts and logos (`public/obs/assets/`), so the
folder works anywhere. Shared pieces: `public/obs/shared/overlay.css` (look), `theme.js` (form colours, veadotube + OBS WebSocket),
`scene.js` (light trails, timers, guide labels), `icons.js` (platform icons). The control dock is
`public/obs/control.html`; the Botrix CSS is `public/obs/botrix/`. Everything under `public/` deploys with
the site, so check it the same way as any site change (docs/verification.md). `?guide=1` plus
`scripts/shot.mjs` at `--width=1920 --height=1080` is the quickest check.
