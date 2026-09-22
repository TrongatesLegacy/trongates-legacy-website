# Link-preview (Open Graph) image

`public/assets/img/og.jpg`, 1200×630, the image shown when trongateslegacy.com is shared on Discord, X,
Facebook, iMessage, Slack, etc. It's a dedicated design (`og.html`), not a screenshot of the site.

```
node --experimental-websocket og/render.mjs
```

renders it and bumps the `?v=` date on the `og:image` / `twitter:image` URLs in `public/index.html`.
Platforms cache previews by image URL, so without a new URL they keep showing the old picture.

**When to re-render:** after changing the brand (name, tagline, colours, fonts), the character art, or the
character sizing transforms (which are copied from the hero, see docs/design-system.md). Then look at the
image, run the site checks (it changes `index.html`), and push. Tools like https://www.opengraph.xyz show how
the live page previews.

## Layout rules

- Everything important stays **48px inside every edge**: X crops large cards to 2:1 (loses ~15px top and
  bottom), and some apps round the corners.
- Text is large (title 76px, tagline 27px) because previews are often shown ~500px wide or smaller.
- Left: "CEO of the Lulu Gang", the title (outlined + solid, as everywhere), the tagline, a Watch on Kick
  button and the URL. Right: the three forms in a row on the grid floor.
- The characters use the **same box and per-artwork transforms as the hero**, so their heads match exactly:
  measured head tops within 1px, Trina and Tron's head widths 171/173px (the blobfish's head is a
  different shape, as on the site).
- Apps that crop previews to a square (small WhatsApp previews) cut into the title. That's the trade-off of a
  text-beside-characters layout; every major platform shows the full image.
