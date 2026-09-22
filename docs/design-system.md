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
registered `@property`, so changing form animates the whole page's colour over 0.6s.

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

## Typography

- **Orbitron** 700/900 for display: titles, labels, buttons. Uppercase, tracked out.
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

### Form-switch glitch

~240ms: four 60ms steps where the character is cut into 10-26% horizontal slices, each showing the old or new
artwork (the new one's share rises 25% → 50% → 75% → 92%), shifted sideways up to ±13px with a red/cyan
drop-shadow split. The theme colour changes instantly; only the character glitches. The last glitch frame
stays up until the new idle pose has decoded, so the old form never flashes back. Rapid clicks resolve to the
last pick (`switchId`). Skipped for reduced motion.

## Character sizing

The artwork files are not drawn at the same scale or position, so each form gets a measured CSS transform to
match **Tron's head**: same head width, same head top, and the same centre line where the figure allows it
(a figure with a lot off to one side, like the blobfish, is balanced on its whole silhouette instead). Measured from visible pixels,
using the longest solid run of pixels per row so thin details (the blobfish's fishing rod) don't count.

| Art | Transform (hero, origin 50% 80%) | Why |
|---|---|---|
| Tron (all armours) | none | the reference |
| Princess Trina | `translate(.75%, -1.9%) scale(.937)` | her art fills more of its canvas |
| Blobfish | `translate(-12.7%, -5.8%) scale(1.18)` | drawn smaller, and sits right in its image because the rod and catch fill the left. Horizontally it's a compromise: centring its head like Tron's pushed the whole figure 61px left and the hanging catch off the stage, so the head sits ~40px right of Tron's and the whole figure (catch included) stays inside the stage |

The same transforms are applied inside the glitch slices (`ART_T`), and the class that applies them
(`data-art` on `.tuber`) moves with the artwork, not the theme. If character art is replaced, re-measure
(docs/verification.md) and update both places. The Discord banner uses the same method (matched head widths and tops).

## Accessibility

- Every interactive element has a real accessible name that matches its visible text (Lighthouse flags
  mismatches). Decorative art has empty `alt`; icons in links are `aria-hidden`.
- Colour contrast: body text on `--bg` is well above AA; the accent is only used for large display text
  and decoration.
- Focus rings use the accent (`:focus-visible`).
