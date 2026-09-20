# Kick "About" panels

Twelve panels for <https://kick.com/trongateslegacy/about>, styled to match the website.
Images are in `images/` at 640px wide (Kick scales them to 320px, so they stay sharp on retina screens).
**Every image is the same size (640×340).** Kick's panel grid is responsive: 2 columns on a laptop, 3, 4 or
more on wider screens. Rows share a top edge, so any mix of heights leaves gaps at some screen width.
One size is the only layout that stays tidy at every column count.
All are well under Kick's 4MB limit and have transparent cut corners, which blend into Kick's dark background.

## Layout

Kick lays panels out in columns, filling left to right, top to bottom. Add them **in this order** so the
important things land at the top and the small social buttons group together at the end:

| # | Panel | Purpose |
|---|-------|---------|
| 1 | About Tron | Who you are — the first thing people read |
| 2 | Lulu Gang Discord | Your main community call to action |
| 3 | Official Website | Sends people to trongateslegacy.com |
| 4 | The Roster | The three forms — fun, and explains the redeems |
| 5 | Chat Rules | Sets expectations |
| 6 | Support the Stream | Follow / sub / share |
| 7–12 | YouTube, TikTok, Instagram, X, Facebook, Club | One clickable button each |

Why one panel per social: a panel's image can only link to **one** URL, so separate panels make every
logo clickable.

## How to add a panel

1. Go to your channel → **About** tab → **Edit** (or Creator Dashboard → Channel → About/Panels).
2. Click **Add panel**.
3. **Title** – leave it empty. It's optional, and every image already has its heading built in.
4. **Add image** – upload the matching file from `images/`.
5. **Image link** – paste the link. This makes the whole image clickable.
6. **Description** – also optional. Only panels 1, 2, 4, 5 and 6 have text; the Website panel and the six
   social panels are image-only. Going image-only on **all** panels is the tidiest option of all, since
   description lengths are then the only thing that could make rows uneven.
7. **Create**, then repeat. Use the ⠿ drag handle (top-left of each panel) to fix the order if needed.

> Descriptions are written as plain text with full URLs so they work whether or not Kick renders
> formatting. Everything in [square brackets] is a placeholder for you to fill in or delete.

---

## 1. About Tron

- **Image:** `images/01-about.png`
- **Image link:** `https://www.trongateslegacy.com`
- **Description:**

```
Hey, I'm Tron, chill streamer and CEO of the Lulu Gang.

Plenty of gaming with friends. Laid-back vibes, bad jokes, and chat gets a say in how things go.

New here? Say hi in chat, hit follow so you catch the next stream, and come hang out in the Discord between streams.

GGs.
```

## 2. Lulu Gang Discord

- **Image:** `images/02-lulu-gang-discord.png`
- **Image link:** `https://discord.gg/FUKz6Dxk8W`
- **Description:**

```
The Lulu Gang is the community HQ. Go-live pings, clips, memes, game nights and somewhere to hang out when the stream is offline.

Everyone's welcome, come join: https://discord.gg/FUKz6Dxk8W
```

## 3. Official Website

- **Image:** `images/03-website.png`
- **Image link:** `https://www.trongateslegacy.com`
- **Description:** *(leave empty, the image already shows the address)*

## 4. The Roster

- **Image:** `images/04-roster.png`
- **Image link:** `https://www.trongateslegacy.com/#roster`
- **Description:**

```
One streamer, three forms:

TRON: the default loadout. Neon armour, identity disc, suspiciously calm. Armour colour changes with the mood.

PRINCESS TRINA: chat's favourite redeem. One redeem and the armour gets swapped for a tiara. Not canon. Chat disagrees.

THE BLOBFISH: went fishing, caught Princess Trina, refuses to throw her back.

Pick your fighter on the website and the whole site changes with it.
```

## 5. Chat Rules

- **Image:** `images/05-rules.png`
- **Image link:** *(leave empty)*
- **Description:** *(starter set — edit to match how you actually run chat)*

```
Keep it chill:

1. Be kind. No hate speech, harassment or discrimination. Zero tolerance.
2. No spam, excessive caps or self-promo unless asked.
3. No backseating or spoilers unless I ask for help.
4. Keep politics, religion and drama out of chat.
5. Respect the mods. Their word is final.
6. English in chat please, so the mods can keep up.
7. Have fun. That's the whole point.
```

## 6. Support the Stream

- **Image:** `images/06-support.png`
- **Image link:** `https://kick.com/trongateslegacy`
- **Description:**

```
The best support is free: follow, turn on notifications, and hang out in chat. Sharing a clip or bringing a friend helps more than you'd think.

Want to go further? Subs and gifted subs keep the stream improving: new forms, new redeems, better everything. Never expected, always appreciated.
```

## 7. YouTube

- **Image:** `images/07-youtube.png`
- **Image link:** `https://www.youtube.com/@trongateslegacy`
- **Description:** *(leave empty)*

## 8. TikTok

- **Image:** `images/08-tiktok.png`
- **Image link:** `https://www.tiktok.com/@trongateslegacy`
- **Description:** *(leave empty)*

## 9. Instagram

- **Image:** `images/09-instagram.png`
- **Image link:** `https://www.instagram.com/trongateslegacy/`
- **Description:** *(leave empty)*

## 10. X

- **Image:** `images/10-x.png`
- **Image link:** `https://x.com/trongateslegacy`
- **Description:** *(leave empty)*

## 11. Facebook

- **Image:** `images/11-facebook.png`
- **Image link:** `https://www.facebook.com/trongateslegacy`
- **Description:** *(leave empty)*

## 12. Club

- **Image:** `images/12-club.png`
- **Image link:** `https://club.com/trongateslegacy`
- **Description:** *(leave empty)*

---

## Channel banner

`banner/kick-banner.png` (2880×320, 9:1). Upload via channel page → edit banner → *Upload from local device*,
leave the cropper's zoom at minimum so the whole image fits, then Apply.

Kick's help page asks for a minimum of 1280×700, but the cropper only ever keeps a **9:1** strip and Kick
then serves it as a heavily compressed **1105×123 JPG** (about 27KB), stretched to fit the page. Nothing you
upload can change that, so the design uses large type and thick strokes that survive it. It also means
animated PNGs are flattened, so the banner is static. (The offline banner is served at 1500px as WebP, which
is why that one looks crisp.)

The same image is shown three different ways, always centre-cropped, so it's laid out in zones:

| Where | What's visible | What sits there |
|---|---|---|
| Chat user card (click a name in chat) | Only the **middle third** (33%-67% of the width), full height; your avatar covers the bottom-centre, badges/close button the top corners | Lulu Gang logo + "Join the Discord", Princess Trina and the Blobfish either side, a ring that frames the avatar |
| Channel page, desktop | A strip that is always 134px tall: wide screens lose the **top and bottom** (about 5% each at 1920 wide, about 19% at 2560), laptops lose the left/right edges, and the "OFFLINE / stream title" box hides the left half | "TRONGATES LEGACY / CEO of the Lulu Gang", placed right of the chat card's crop and left of the laptop crop; all text sits in the vertical middle |
| Very wide screens | Everything, minus top/bottom | Bonus Tron on the far right |
| Phones | A thin 44px strip | Too small to read anything, so nothing depends on it |

Regenerate after editing `banner/banner.html`: `node --experimental-websocket kick-panels/banner/render.mjs 1 15 2`

## Offline banner

`banner/kick-offline-banner.png` (1920×1080, the size Kick's help page specifies). This fills the video
player while you're offline. Upload via Settings → Profile → *Update Offline Banner Image*.
Regenerate after editing `banner/offline.html`: `node --experimental-websocket kick-panels/banner/render-offline.mjs`

## Optional extras

- **Schedule panel** – if you stream on set days, tell me the days/times and I'll make a matching
  "Schedule" image. Viewers look for this more than almost anything else.
- **PC specs / gear panel** – same offer, if people ask about your setup.

## Changing a panel image

The images are generated from `panels.html` (same fonts, colours and art as the website):

```
node --experimental-websocket kick-panels/render.mjs
```

Edit the text or colours in `panels.html`, run that, and re-upload the changed PNG to Kick.
