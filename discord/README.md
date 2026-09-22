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

Measured from the live profile: your avatar is a circle centred on the banner's bottom edge, about 23% of the
way across, covering the bottom-left. So:

- **Top-left, above the avatar:** "CEO of the" + the Lulu Gang logo.
- **Around the avatar:** a pink and cyan ring the avatar sits inside. It's centred on the full profile; in the
  smaller popout (clicking a name) the avatar sits slightly left of centre in it.
- **Right 60%:** "TRONGATES LEGACY", "Live on Kick · trongateslegacy", and Tron.
- The custom-status bubble only reaches the bottom few pixels, below all the text.

Regenerate after editing `banner.html` (needs Chrome + ffmpeg):

```
node --experimental-websocket discord/render.mjs 60 15   # frames fps
```
