# Design system

The look is **TRON-style neon on a dark grid**: a PNGtuber's chibi characters standing in a glowing digital
world. Every surface (website, Kick panels, banners, Discord) uses the same palette, fonts and motifs so the
brand reads as one thing across platforms.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#03060d` | page background (near-black blue) |
| `--panel` | `#070d18` | cards, panels |
| `--line` | `#12233a` | grid lines, borders |
| `--text` / `--muted` | `#e8f4ff` / `#8ba3bd` | body text / secondary |
| `--accent` | follows the current form (below) | glows, outlines, highlights, light trails |
| `--kick` | `#53fc18` | anything that means "Kick": buttons, the Kick tile. Never themed. |
| `--live` | `#ff2740` | the on-air ring and LIVE badge. Deliberately not a form colour, so "live" reads the same on every form. |

Accent tints are `--a70/--a40/--a20/--a10` (`color-mix` of the accent with transparent). `--accent` is a
registered `@property`, so changing form animates the whole page's colour over 0.8s (`--t`). Princess Trina and the
Blobfish also tint `--bg`, `--panel`, `--line` and `--muted` and add `--accent2` (see "Form themes").

Brand colours are used only on their own links: YouTube `#ff3b3b`, TikTok `#25f4ee`, Instagram `#ff5fa2`,
X `#e8f4ff`, Facebook `#4c9bff`, Discord blurple `#8c9bff` icons, **Club `#4800ff`** (their exact brand colour,
taken from club.com's mask-icon; too dark for a small icon on black, so the hero icon *fills* with it on hover
instead of tinting the glyph).

## Forms (theming)

The streamer has three characters ("forms"); Tron comes in three armour colours. Picking a form re-themes the
whole site.

| Form key | Accent | Character art |
|---|---|---|
| `cyan` (default) | `#22e5ff` | Tron, cyan armour |
| `yellow` | `#ffd23f` | Tron, yellow armour |
| `red` | `#ff4155` | Tron, red armour |
| `princess` | `#ff63b8` | Princess Trina (Tron redeemed as a princess) |
| `blobfish` | `#ffb36b` | The Blobfish (holding a rod with Princess Trina on the hook) |

- There is **no pink armour form**: it was removed because Princess Trina already owns pink.
- First visit always lands on **cyan Tron** (not random). A visitor's explicit pick is saved in
  `localStorage['tgl-form']` and restored before first paint (inline script in `<head>`), so there's no flash.
- Until a visitor has picked, the form chips hop in a wave with a "Try another form" tag (`.no-pick` on
  `<html>`). It disappears permanently on the first pick.
- Forms can be picked from the hero chips, the roster cards, or the armour dots on the Tron roster card.
  The Tron card remembers the last armour worn, so switching to the blobfish and back returns red Tron if
  that's what they had.

### Form themes (Princess Trina and the Blobfish)

The Tron armours only recolour. Princess Trina and the Blobfish re-light the whole page around the same layout (all in
`public/index.html`, "form themes"):

| | Princess Trina, "Redeemed" | The Blobfish, "The Deep" |
|---|---|---|
| Colours | pink `#ff63b8`, lilac `#b48cff`, gold `#ffd98a`, on plum-black `#0a0510` | peach `#ffb36b`, glow-teal `#45d6c8`, on deep-sea `#020b11` |
| Background | a wide, faint diamond lattice under a lilac glow; at most 3 gold twinkles at a time | the grid sinks: surface light, slanted rays, drifting caustics |
| Light cycles become | glitter comets on the same grid paths | rising, wobbling bubbles |
| Halo | a pearl string and an orbiting gold star | sonar pings and a slow sweep |
| Floor | a ballroom checker | rippled seabed sand, drifting slowly |
| Title font | Cinzel Decorative | Lilita One |
| Title extras | a tiara lands on the T; a gold shine sweeps LEGACY, a ✦ twinkles, TRONGATES glows letter by letter | a line and hook drop by the Y; the letters float on a swell, bubbles escape |
| Buttons, cards, frames | Royal: notched crest corners, double gold frames, ✦ corner ornaments | Chunky: rounded, a thick ledge under buttons, heavy rounded cards |
| Ticker marks | hearts | bubbles |
| Switch-in | sparkles in (a dissolve with glitter) | ripples in |
| Also | no scanlines | bobs slower and deeper; no scanlines |

What never changes: the layout, labels and the nav logo (Orbitron), body text (Chakra Petch), the Kick green (the Kick
button keeps its colour in every style; only its shape follows), and the three Tron armours.

**Nothing moves when the form changes.** It's measured by `tests/browser/form-themes.test.mjs` on desktop and phone.
Any change to a form's look has to keep it passing:
- **Hero title:** two fixed-height rows sized from Orbitron's size; the form's font is scaled (`--tscale`) to fill them.
- **Other titles:** these can wrap (section titles, roster names, the footer sign-off), so they are laid out by their
  Orbitron text. The form's font is drawn over it in the same box (`.twin`, a copy the script makes), and the Orbitron
  copy goes transparent but stays the title for screen readers and search.
- **Heavier edges:** drawn as shadows, never thicker borders.
- **Roster cards:** every card keeps the room for "· active form".

**The OBS scenes carry the same looks** (`public/obs/shared/overlay.css`, "Form looks"; obs/README.md, "Form looks"),
keyed on `<html data-look>`, which `theme.js` works out from the form. The dock's *Form looks* (`looks=`) can give any form
any look, or Tron's. The scenes' differences: the titles float line by line and the swap fades rather than blurs (a moving letter, or a blur, is a GPU layer of its own, and OBS and the index draw every scene at once; each look's layers exist only while it's on, and there's one floor); frames, tabs and the status pill instead of buttons and cards (the frames'
glass and border are three cross-fading skins, so a Botrix widget inside is never touched); no hook on the titles (it
would hang over the text below); the Game (window) border keeps its width (the game covers everything inside it). The
transitions are drawn in each look too (`transition.js`). The same rule holds, measured scene by scene in
`tests/browser/obs-looks.test.mjs`: nothing an OBS source is placed on moves.

**Smooth switching:**
- **Colours:** blend over one clock (`--t`, 0.8s): accent, second accent, background, panels, lines, grey text.
- **Layers:** the background, halo and floor cross-fade in place.
- **Particles:** light cycles, glitter and bubbles already on screen fade out where they are while the new kind arrives.
- **Fonts and shapes** (`[data-look]`): swap while the elements that change are blurred out for 0.16s (the script
  animates them, so their own transitions are untouched), then they blur back in.
- **Reduced motion:** everything swaps at once.
- **Moving floors:** each loop must be a whole number of its pattern's repeats, or the jump back shows. The ballroom
  checker repeats every two cells, so it loops over two (`floor-2`). Tested: the frame before the jump must match the
  frame after it.
- **`?form=`:** `?form=princess` (or any form) opens the site in that form for one visit, as a returning visitor would
  see it, without saving it. `scripts/lighthouse.sh` measures the themes this way.

## Typography

- **Orbitron** 700/900 for display: titles, labels, buttons. Uppercase, tracked out. (Princess Trina's and the Blobfish's
  big titles use Cinzel Decorative and Lilita One instead; see "Form themes". Their labels stay Orbitron.)
- **Chakra Petch** 400/600 for body text.
- Both self-hosted (`public/assets/fonts/`, latin subset, ~31KB total) and preloaded. Google Fonts was removed
  because it render-blocked the first paint by over a second on mobile.
- The title treatment: first word **outlined** (transparent fill, accent stroke), second word **solid**
  (white-to-accent gradient). Used on the site, banners and panels.
- On surfaces that get heavily compressed (Kick's banner is served as a 1105×123 JPG), thin outlines and
  small type turn to mush, so there the outline is replaced with solid colour and type is kept large.

## Motifs

- **Grid**: 56px cells on the site, a fixed layer behind everything; a perspective grid "floor" under the hero.
- **Light cycles**: canvas trails that ride the grid lines and turn at intersections (one rival in orange).
  They fade out where they pass under text/characters (measured content zones, `destination-out`), so they
  never cut through copy. Paused when the tab is hidden; off for reduced motion.
- **Rings / halos**: dashed, rotating identity-disc rings behind characters, in the accent colour.
- **Cut corners**: buttons and cards use `clip-path` polygons with 14px/26px chamfers, like the TRON HUD.
- **Glitch**: the title periodically splits into red/cyan offset slices. Form switches use the same language
  (below).

## Motion

- Everything respects `prefers-reduced-motion`: animations and transitions are disabled, the canvas is hidden,
  and the form-switch glitch becomes an instant swap.
- The hero character floats, blinks at random intervals and **holds the talking pose** for the length of a
  speech line (no mouth flapping: the owner found flicker between idle and talking frames distracting).
- A frame is only shown once decoded (`img.decode()`), otherwise the character blanks for a frame on the
  first blink. Other forms' art is preloaded in the background at low priority after load (skipped on
  data-saver), and hovering or touching a chip warms that form at high priority.

### Form-switch glitch (Tron)

~240ms: four 60ms steps where the character is cut into 10-26% horizontal slices, each showing the old or new
artwork (the new one's share rises 25% → 50% → 75% → 92%), shifted sideways up to ±13px with a red/cyan
drop-shadow split. The theme colour changes instantly; only the character glitches. The last glitch frame
stays up until the new idle pose has decoded, so the old form never flashes back. Rapid clicks resolve to the
last pick (`switchId`). Skipped for reduced motion. Switching to Princess Trina or the Blobfish uses their own
switch-in instead (six 60ms steps): a dissolve with gold sparkles, or 14 bands swaying as through water.

## Character sizing

The artwork files aren't drawn at the same scale or position, so every form is **pre-sized**: drawn onto one shared
640×960 canvas at the size and place that matches **Tron's head** (same head width, same head top, the same centre
line where the figure allows it; a figure with a lot off to one side, like the blobfish, is balanced on its whole
silhouette instead). The website, the OBS scenes and the artwork then use every form **as is**: no per-form CSS
transform anywhere.

- **Sources:** `artwork/forms/` holds the untouched art and `forms.json` (each form's files, its placement as a
  CSS transform on the 640×960 box with `object-fit: contain` and origin 50% 80%, why, and optional WebP quality).
  Tron is the reference; his files in `public/assets/img/` are used as they are.
- **Output:** `node --experimental-websocket scripts/presize-art.mjs` draws each source with its placement in
  headless Chrome, checks nothing falls outside the canvas (it stops rather than clip), and writes
  `public/assets/img/<file>.webp` (640×960) and `<file>-400.webp` (400×600).

| Form | Placement (baked in) | Why |
|---|---|---|
| Tron (all armours) | none | the reference |
| Princess Trina | `translate(.75%, -1.9%) scale(.937)` | her art fills more of its canvas |
| Blobfish | `translate(-3.95%, -4.43%) scale(1.1)` | drawn smaller, and sits right in its image because the rod and catch fill the left. Scale 1.1 is the largest that keeps all four variants (rod tip and hanging catch included) inside the canvas with an 8px margin; centred, lowest point at y 896 as before. (It was 1.18, which spilled past the left edge and the top.) |

**Adding or changing a form** (a new form, pose or mouth/eye variant) always goes through this; never position it
with its own transform:
1. Put the untouched art in `artwork/forms/` and add it to `forms.json` (a new form gets a placement; a new
   variant of an existing form joins its `files`, so it moves exactly with the others).
2. `node --experimental-websocket scripts/presize-art.mjs --measure` reports its head against Tron's (suggested
   scale, top and centre offsets); `--bounds` shows the whole outline on the canvas. Set the placement so the head
   matches and the outline stays inside the canvas.
3. Run the script (without options) to write the files, then check the website hero and cards, and the OBS
   cycling scenes, with that form (docs/verification.md).

## Accessibility

- Every interactive element has a real accessible name that matches its visible text (Lighthouse flags
  mismatches). Decorative art has empty `alt`; icons in links are `aria-hidden`.
- Colour contrast: body text on `--bg` is well above AA; the accent is only used for large display text
  and decoration.
- Focus rings use the accent (`:focus-visible`).
