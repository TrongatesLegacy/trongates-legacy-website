# Discord profile banner

| File | Use |
|---|---|
| `discord-banner.gif` | Animated (1360×480, ~0.8MB, loops): light cycles on the grid, a sheen across the title, the website's glitch |
| `discord-banner.png` | Static version of the same design |

Both are 2× Discord's recommended 680×240 (17:6), so they stay sharp on retina screens and need no cropping.

**Upload:** User Settings → Profiles → *Profile Banner* → **Change Banner** → *Upload Image* → pick the file →
leave the crop as it is (it already fits) → Apply → Save Changes. Animated banners need Nitro; if the GIF is
refused, use the PNG.

## Layout

Discord shows the avatar in **two different places**, both measured from live screenshots:

| View | Avatar centre | Radius |
|---|---|---|
| Chat popout (click a name) | 18% across, 87% down | ~15% of the width |
| Full profile / profile editor | 23% across, on the bottom edge | ~17% of the width |

Anything drawn to frame the avatar would be visibly off in one of them, so the bottom-left only has a soft
pink glow. Everything else sits where neither avatar position reaches:

- **Top-left:** "CEO of the" + the Lulu Gang logo (clear of the avatar even in the popout, where it sits higher).
- **Right 60%:** "TRONGATES LEGACY", "Live on Kick · trongateslegacy", and Tron.
- The custom-status bubble covers only the bottom strip, below all the text.

Regenerate after editing `banner.html` (needs Chrome + ffmpeg):

```
node --experimental-websocket discord/render.mjs 60 15   # frames fps
```
