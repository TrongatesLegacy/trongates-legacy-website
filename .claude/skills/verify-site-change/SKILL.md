---
name: verify-site-change
description: Check a change to the Trongates Legacy website before calling it done. Use after editing public/index.html, CSS, character art, or anything visual on the site, and whenever the owner reports something looks off (misaligned, clipped, flickering, too small).
---

# Verify a website change

1. Start the dev server if it isn't running: `node dev.mjs` (http://localhost:8888).
2. Syntax-check the inline scripts:
   `node -e "const s=require('fs').readFileSync('public/index.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m)=>new Function(m[1]))"`
3. Screenshot what changed with `node --experimental-websocket scripts/shot.mjs` (options are in the file's
   header). At minimum: desktop 1280×800, phone `--width=390 --height=844 --mobile`, and
   `--width=375 --height=667 --mobile` if layout near the edges changed. Add `--form=…`, `--live`, `--fresh`,
   `--selector=#section` or `--reduced-motion` to reach the state you changed.
4. **Open and look at every image.** Check overlap, clipping, centring and the reported horizontal overflow.
5. If alignment or size is in question, measure visible pixels (docs/verification.md, "Measuring artwork");
   don't reason from `<img>` boxes, the artwork has transparent margins.
6. For anything animated, confirm the reduced-motion path and that rapid repeated input settles cleanly.
7. For timing-sensitive behaviour, sample state in the page with `--eval` (e.g. poll classes every 15ms)
   rather than trusting a single screenshot.
8. Commit with a message explaining why and push (see CLAUDE.md for the git identity).
9. **Run Lighthouse** once the deploy is live: confirm the new version is served
   (`curl -s https://www.trongateslegacy.com/ | grep …`), then `scripts/lighthouse.sh`. If it reports below
   baseline, re-run once (mobile varies by a few points), then fix what it lists before moving on.
10. Tell the owner what you checked, the Lighthouse scores, and anything you couldn't verify.
