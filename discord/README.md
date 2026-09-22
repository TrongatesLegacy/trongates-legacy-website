# Discord profile banner

| File | Use |
|---|---|
| `discord-banner.gif` | Animated (1360×480, ~3.5MB, 6s loop): cyan Tron, Princess Trina and the Blobfish take turns on the right, glitching from one to the next; light cycles on the grid, a sheen and a glitch on the title |
| `discord-banner.png` | Static version (first frame, with Tron) |

Both are 2× Discord's recommended 680×240 (17:6), so they stay sharp on retina screens and need no cropping.

**Upload:** User Settings → Profiles → *Profile Banner* → **Change Banner** → *Upload Image* → pick the file →
leave the crop as it is (it already fits) → Apply → Save Changes. Animated banners need Nitro; if the GIF is
refused, use the PNG.

## Layout

Discord shows the avatar in **two different places**, both measured from live screenshots:

| View | Avatar centre | Radius |
|---|---|---|
| Chat popout (click a name) | 17.5% across; top edge 50.5% down | ~15% of the width |
| Full profile / profile editor | 23% across; top edge 52% down | ~17% of the width |

Anything drawn to frame the avatar would be visibly off in one of them, so the bottom-left only has a soft
pink glow. Everything else sits where neither avatar position reaches:

- **Top-left:** "CEO of the" + the Lulu Gang logo, centred horizontally over the **popout** avatar (the view
  most people see) and vertically in the space above the avatar. The avatar's top edge is at almost the same
  height in both views, so it's vertically balanced in both; in the full profile it sits a little left of centre.
- **Right 60%:** "TRONGATES LEGACY", "Live on Kick", and the current form (the halo
  changes to each form's colour).
- The custom-status bubble covers only the bottom strip, below all the text.

Regenerate after editing `banner.html` (needs Chrome + ffmpeg):

```
node --experimental-websocket discord/render.mjs 90 15   # frames fps
```
