# YouTube channel banner

`yt-banner.jpg`, 2560×1440 (16:9), ~244KB. YouTube's upload dialog asks for **at least 2048×1152 and 6MB or
less**; this is the usual 2560×1440 upload size, so it stays sharp on TVs.

```
node --experimental-websocket artwork/youtube/render.mjs
```

**Upload:** YouTube Studio → **Customisation** → **Branding** → *Banner image* → **Change** → pick the file →
YouTube shows a crop preview per device; the layout already fits, so accept it → **Publish**.

## Layout

YouTube shows the same image at very different crops:

| Device | What's shown | What sits there |
|---|---|---|
| Phone | only the centre **safe area**, 1546×423 here (x 507–2053, y 508–931) | everything that matters: title, "CEO of the Lulu Gang", Live on Kick / the URL, and all three forms |
| Desktop | a full-width band, 2560×423, through the middle | the same, with grid, glow and light trails running off both sides |
| TV | the whole 16:9 image | the full scene: the perspective grid floor below, trails above |

Measured to confirm every character's visible artwork (not its image box) sits inside the safe area with
≥20px to spare: Trina 1495–1713, Tron 1669–1853, the Blobfish 1800–2029, against a safe area of 507–2053.
The first attempt had the Blobfish 26px outside it, which the phone crop cut off. The forms use the hero's
box and per-artwork transforms so their heads match (docs/design-system.md, "Character sizing").

**Partly unverified:** the 2048×1152 minimum and 6MB limit come from YouTube's own upload dialog (screenshot
from the owner). The 1546×423 safe area is the widely published figure (1235×338 at 2048×1152, the same
proportion) — YouTube's help pages didn't expose it to scripted reading. YouTube's own upload preview shows
the three crops, so check them there; if anything is cut, send a screenshot and the numbers can be corrected.
