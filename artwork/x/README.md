# X (Twitter) profile header

`x-header.jpg`, 3000×1000 (2× X's 1500×500 header, 3:1), ~570KB — well under X's 2MB limit.

```
node --experimental-websocket artwork/x/render.mjs
```

**Upload:** x.com → profile → **Edit profile** → the camera icon on the header → pick the file → X offers a
crop box; the image is already 3:1, so leave it at the default → **Apply** → **Save**.

## Layout

X shows the whole 3:1 image (it doesn't crop the sides), but two things sit on top of it:

| What | Where | Result |
|---|---|---|
| Profile picture | circle ~22% of the header's width, centred ~14% across, half of it below the bottom edge — roughly x 40-370, y 330-500 in 1500×500 terms | the left third is deliberately empty: grid, glow and one light trail only |
| Display name / handle | directly under the header, starting at the avatar's left edge | nothing depends on the very bottom strip |

- Text (eyebrow, title, "Live on Kick / trongateslegacy.com") sits in the middle, starting 55px right of where
  the avatar ends, and is large enough to read when X scales the header down on a phone.
- The three forms are on the right on the grid floor, using the **hero's box and per-artwork transforms** so
  their heads match (docs/design-system.md, "Character sizing").
- Everything stays 40px inside the edges.

**Unverified:** help.x.com and x.com both block automated browsers (Cloudflare / HTTP 403), so the size and the
avatar geometry above come from the commonly published values, not from measuring the live profile. After
uploading, send a screenshot of the profile so the numbers can be re-measured and the layout adjusted
(the same was needed for Kick and Discord, where the first guesses were wrong).
