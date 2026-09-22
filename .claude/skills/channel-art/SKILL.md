---
name: channel-art
description: Create or adjust Trongates Legacy artwork for other platforms (Kick about panels, Kick channel banner, Kick offline banner, Discord profile banner, the website's link-preview/OG image, or a new platform). Use when the owner asks for a banner, panel, header or profile image, or sends a screenshot of how one looks on a platform.
---

# Channel artwork

All platform art is HTML rendered to PNG/GIF with headless Chrome, so it shares the site's fonts, colours and
character art. Read the relevant guide first: kick-panels/README.md, discord/README.md or og/README.md, and
docs/design-system.md for the visual language.

1. **Find the real display geometry before designing.** Platforms crop, overlay and compress art in several
   different views, and document almost none of it. Look for the platform's stated size, then measure the
   owner's screenshots of the live page (draw a grid over a crop with ffmpeg `drawgrid` to read positions).
   Record every view: what's cropped, what's covered (avatars, buttons, status bubbles), how it's scaled.
2. **Lay out in zones** so every view shows something complete. Put text only where all views keep it; put
   characters where they survive at least the main view. If two views place an overlay (like an avatar)
   differently, don't draw anything that must line up with it exactly.
3. Build `<name>.html` next to the existing ones and a `render.mjs` (copy an existing renderer). Render at 2×
   the display size. Animated output: GIF via ffmpeg palettegen/paletteuse (Discord), never rely on Kick
   keeping animation (it re-encodes banners to JPG).
4. **Simulate each view** from the rendered file with ffmpeg (crop/scale to the measured geometry, draw the
   overlays as grey shapes, and for Kick re-encode to a small JPG) and look at the result.
5. Match character sizes by measured head width/top (docs/verification.md), not by image height.
6. Update the folder's README with the file, size, upload steps and the measured geometry, then commit.
   These folders don't trigger a Netlify deploy.
7. When the owner uploads it and sends a screenshot, re-measure from that screenshot and adjust; earlier
   measurements have been wrong before.
