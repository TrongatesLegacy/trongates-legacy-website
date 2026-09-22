# club.com profile cover

| File | Use |
|---|---|
| `club-cover.gif` | **animated** (1600×538, ~1.3MB): the three forms take turns with the glitch swap, light trails ride the grid, a sheen crosses the title. Confirmed working on a live profile. |
| `club-cover.jpg` | static version (3200×1076, first frame: Tron) if you'd rather not animate |

```
node --experimental-websocket artwork/club/render.mjs 72 12   # frames fps
```

**Upload:** profile → **Edit Profile** → cover image → *Choose Photo* → pick the file → **Save**.
The dialog shows a 2:1 crop box, but the saved cover keeps the whole 3:1 frame (confirmed live), so accept it.

## Layout

Club's dialog says: *"The cover image scales to fit any screen. On wide screens, parts may crop to preserve
layout. Image files must be 10 MB or smaller. Avoid flashing or fast-moving images."* Animation is therefore
allowed — this loop is slow, with no flashes or fast movement.

Measured from a screenshot of the live profile: club.com lays the profile details **on top** of the cover's
lower-left, and the cover is displayed at ~3:1 with nothing cropped (the title lands at 21% across and the
character at 76%, exactly as designed):

| Overlay | Where (fraction of the cover) |
|---|---|
| Avatar (circle) | centred ~5.8% across, ~67% down, radius ~4.2% of the width |
| Display name / handle / follower counts | x from ~10%, y 60–80% |
| Bio and social icon row | x from ~2.5%, y 84–97% |
| "Edit Profile" button | x ~85–96%, y 87–95% |

So the title block sits in the upper left (clear of the name, which starts at 60% down), the forms stand on
the right on the grid floor, and the bottom-left is empty. The forms use the hero's box and per-artwork
transforms so their heads match (docs/design-system.md, "Character sizing").
