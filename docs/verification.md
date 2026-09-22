# Verifying changes

Most bugs on this project have been visual (things overlapping, clipped by a platform's crop, off-centre by
an artwork's transparent margin), and none of them are visible in the code. Check with real renders.

## Screenshots

Start `node dev.mjs`, then:

```
node --experimental-websocket scripts/shot.mjs                         # desktop hero
node --experimental-websocket scripts/shot.mjs --width=390 --height=844 --mobile
node --experimental-websocket scripts/shot.mjs --width=375 --height=667 --mobile   # iPhone SE, the tightest
node --experimental-websocket scripts/shot.mjs --form=blobfish --selector=#roster
node --experimental-websocket scripts/shot.mjs --fresh                 # first-visit state
node --experimental-websocket scripts/shot.mjs --live                  # on-air state
node --experimental-websocket scripts/shot.mjs --full --out=/tmp/page  # whole page, numbered shots
```

Then open the PNGs and look. The script also reports horizontal overflow (anything wider than the viewport).
For interactions, `--eval="…"` runs JS in the page first (click chips, trigger states) and prints its result.

## Measuring artwork

Never align or size characters by their `<img>` box. Draw the image to a canvas, read the alpha channel and
find the visible bounds. For heads, use the widest **solid run** of pixels per row within the top ~22% of the
figure (starting from the first row whose run is ≥30% of the widest), so a fishing rod or stray hair strand
doesn't count as the top of the head. Then map through the element's `object-fit`, `object-position` and CSS
transform to screen coordinates. The character sizing table in design-system.md was produced this way.

## Platform crops (Kick, Discord)

These platforms crop and overlay images differently in different views, and it isn't documented anywhere.
The numbers in kick-panels/README.md and discord/README.md were measured from the owner's screenshots of the
live pages. When the owner sends a new screenshot, re-measure from it (draw a grid over a crop of the image to
read positions) rather than trusting earlier numbers, then simulate the crop with ffmpeg on the rendered
image and look at the result before handing it over.

## Before pushing

- Syntax-check the inline scripts:
  `node -e "const s=require('fs').readFileSync('public/index.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>new Function(m[1]))"`
- Desktop + phone screenshots of what changed; reduced motion if it animates.

- After deploy, check `/api/feed` on the live site: `source` should be `playlists` and `errors` empty.

## Lighthouse (required for every website change)

Run it twice:

1. **Before pushing**, with `node dev.mjs` running: `scripts/lighthouse.sh --local`. Gates on accessibility and
   best practices 100, every SEO audit passing, CLS < 0.1 and TBT < 200ms. Performance is printed but not
   gated, because the dev server has no compression, caching or CDN: local mobile performance runs around
   94 when live is 100. A drop well below that, or a slower LCP than before, is still worth a look.
2. **After the deploy is live** (check the changed file is served, e.g.
   `curl -s https://www.trongateslegacy.com/ | grep <something new>`): `scripts/lighthouse.sh`. Adds the
   performance gates: mobile ≥95, desktop ≥98.

Both print scores, metrics and any failing audits, and exit non-zero when below baseline. Mobile performance varies by a few points run to run; if it dips just under, run it again
before investigating. Include the scores when reporting the change to the owner.

The local run can't produce an overall SEO score (its "canonical" audit crashes on Node 21), so the script
checks the individual SEO audits instead; https://pagespeed.web.dev gives the official number.
