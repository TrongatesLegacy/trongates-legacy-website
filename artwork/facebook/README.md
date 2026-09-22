# Facebook Page cover photo

`fb-cover.jpg`, 1640×924 (16:9), ~147KB sRGB JPG.

```
node --experimental-websocket artwork/facebook/render.mjs
```

**Upload:** the Page → cover area → **Edit** / camera icon → *Upload photo* → pick the file → drag to
reposition if offered (it's already 16:9, so leave it) → **Save changes**.

## Layout

From <https://www.facebook.com/help/125379114252045> (read in a browser; the page needs JavaScript):

| Fact from the help page | What the design does |
|---|---|
| Cover is left-aligned, full bleed, **16:9 on computers** | the canvas is 16:9 (1640×924 = 2× the 820px-wide desktop cover) |
| **2.4:1 on phones**, so the top and bottom are cropped | all text and every character's head sits inside the centre band (y 120–804 of 924) |
| The profile picture covers part of the left of the cover, and overlaps it by ~40px on phones | the left ~22% holds nothing but grid, glow and a light trail; the bottom centre is empty floor |
| Profile picture is 320×320, cropped to a circle | (separate image; not made here yet) |
| Loads fastest as an sRGB JPG under 100KB | sRGB JPG at quality 4; 147KB at this size, which is a reasonable trade for a sharp 16:9 cover |

The three forms are on the right on the grid floor, using the hero's box and per-artwork transforms so their
heads match (docs/design-system.md, "Character sizing").

Both views were simulated with ffmpeg (desktop 16:9 with the round profile picture over the bottom-left, and
the phone 2.4:1 crop) before handing it over. If the live Page looks different, send a screenshot and
re-measure from it.
