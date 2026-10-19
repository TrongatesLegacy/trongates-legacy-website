# Inputty's pictures

`og.html` → `public/inputty/assets/og.jpg` (1200 × 630), the link preview of `/inputty/`, and `scene.html` →
`public/inputty/assets/scene.webp` (960 × 540), its scene and lineup picture on the widgets page. Both have the real
overlay inside (`/inputty/play.html`, WASD and Mouse as the set-up starts) with W, Shift and the left mouse button
held, so they always match it. The link preview shows it in Neon on its panel (the owner asked for more contrast: the
pale Zojie line art washed out over the bright pretend game; Neon's cyan on dark read best of the eight); the scene
keeps the set-up's own look, as the live overlay fades in over it. The scene's pretend game (`.gbg`) is the same CSS as Inputty's scene on the widgets
page: keep the two identical, so the picture can fade out under the live overlay.

```
node --experimental-websocket artwork/inputty/render.mjs
```

It also dates the preview's address in `public/inputty/index.html` (`og.jpg?v=…`): X, Discord and the rest keep a
preview by its address, so without a new one they go on showing the old picture. Re-run after any change to the overlay's look or the starting layout (also in the `SC.inputty` link in
`public/widgets/index.html`), and look at both before committing.

`presets/` holds the full-size original preset pictures from input-overlay (GPL-2.0, see `public/inputty/presets/LICENSE.txt`),
written by `scripts/inputty-presets.mjs`. They're kept for now (the owner) and never served: the site ships shrunk copies.
