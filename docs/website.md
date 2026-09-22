# Website

One HTML file, no framework, no build: `public/index.html`. The owner asked for a single-page site that's
visually impressive but fast on every device; a single file with inline CSS/JS and no dependencies gives the
fastest first paint and nothing to break on deploy. Main focus: **get people to the Kick stream**.

## Page structure

| Section | What it does | Notes |
|---|---|---|
| Nav | brand, section links, Kick pill | pill shows "Live · N watching" when live; on phones ≤480px it shrinks so it never touches the edge |
| Hero | title, tagline, Kick + Latest videos buttons, Lulu Gang Discord card, social icon row, the interactive character, form chips | the character talks when clicked (or opens Kick when live) |
| Ticker | scrolling list of games + "GGs" | decorative, `aria-hidden` |
| Stream (`#stream`) | Kick player behind a click-to-load facade, status panel, follower panel, Follow button | player auto-loads (muted) when live and scrolled near |
| Roster (`#roster`) | three character cards with joke stats | clicking a card switches the site to that form; Tron card has armour dots |
| Videos (`#videos`) | featured VOD, list, shorts rail | YouTube lite embeds (thumbnail until clicked) |
| Socials (`#socials`) | bento grid: big Kick tile, Lulu Gang Discord tile, platform tiles | |
| Footer | "See you on the Grid", Kick button, fan-made disclaimer | |

## Live state

`/api/feed` returns Kick status; when live the page sets `data-live="true"` on `<html>` and:
- a red broadcast ring, pulsing ripples and a **LIVE NOW** badge appear around the hero character (hover flips
  it to **WATCH NOW ▶**); clicking the character or badge opens the stream
- nav pill, buttons and status panel switch to live wording; the player loads itself muted
- the character says "We're LIVE! Click me to watch."

**Previewing**: `?live=1` on any URL forces it. On localhost there's a "DEV · mock live" button bottom-left
(or press `L`), remembered for the tab in `sessionStorage['tgl-mock-live']`.

## Data: videos and live status

YouTube's RSS feeds reject requests from datacentre IPs (Netlify, GitHub Actions) with 404s, and Kick's
website API returns 403 to server-side requests. So:

- **`/api/feed`** (`netlify/functions/feed.mjs`) uses the **YouTube Data API** (`YOUTUBE_API_KEY`, uploads
  playlist `UULF…` and shorts playlist `UUSH…`) and the **official Kick API** (`KICK_CLIENT_ID` /
  `KICK_CLIENT_SECRET`, client-credentials token cached per warm instance). Falls back to RSS / Kick's site API
  if the keys are missing. Reports upstream failures in an `errors` array.
- Cached at Netlify's CDN for 180s (stale-while-revalidate 1h); failures only 15s.
- **`public/feed.json`** is a static copy the page renders first; a GitHub Action (`update-feed.yml`,
  daily at 05:17 UTC) refreshes it with the same API key (repo secret) and commits only when it changes. The
  page never lets `feed.json` overwrite a newer live list (both fetches race).
- Each stream VOD is uploaded twice (with and without "| Music |" in the title); the music copies are hidden.
- Thumbnails are right-sized: `mqdefault` for list rows, `hq720` WebP for the featured video, and for shorts
  the 4:3 `sddefault` frame, which `object-fit: cover` crops to exactly the vertical short (YouTube only
  offers 1080×1920 for shorts otherwise, ~200KB each).
- Only one video plays at a time; starting another closes the first. Shorts loop in YouTube's embed and
  never report "ended", so the page detects the jump from the last second back to 0 and closes the player.

## Performance

Lighthouse on the live site: see the latest `scripts/lighthouse.sh` run; the baseline is mobile performance
≥97 and desktop ≥98 with accessibility and best practices 100 (performance / accessibility / best practices); every SEO audit passes (the local run can't produce an SEO score, see
verification.md). Keep it there:

- Fonts self-hosted and preloaded (no render-blocking requests).
- Character art ships at 400w and 640w via `srcset`; phones get the 400w. The hero's first frame is
  preloaded with `fetchpriority=high`, chosen before first paint from the saved form.
- **Nothing else downloads until the hero has painted.** The current form's blink/talk frames start 900ms
  after load, every other form's art 3s after load when idle. Starting them at load put ~600KB in
  competition with the hero image; Lighthouse's slow-phone model counts every request that starts before
  the first paint, and mobile performance was 94 because of it (99 after). Keep new below-the-fold images
  lazy/low priority for the same reason (the hero's Discord card logos are `loading=lazy fetchpriority=low`).
- **The main script starts after the first frame** (`requestAnimationFrame(() => setTimeout(boot))`), so setting up
  the rest of the page never delays the hero. Code in `boot` that waits for the load event must use `onLoad()`,
  which also runs if load has already fired.
- **Continuous animations only animate `transform` and `opacity`** (GPU-composited). Rotating rings are each
  their own `<svg>` (rotating a `<circle>` inside an svg repaints every frame), the grid floor moves by
  `translateY` rather than `background-position`, and pulses scale a pseudo-element rather than animating
  `box-shadow`. Anything else repaints every frame, costs battery, and competes with loading.
- Other forms, the Kick player and YouTube players load only when needed.
- Canvas animation caps devicePixelRatio at 1.5, pauses when hidden, rebuilds riders only on width changes
  (mobile URL bars fire resize on scroll).
- `/assets/*` is cached for 30 days (netlify.toml).
- The only third-party script is Netlify's own badge/HUD, which Netlify injects. It's left alone rather than
  hidden with CSS/JS, since hiding a host's badge can breach their terms; removing it is a Netlify setting/plan
  question for the owner.

## SEO and sharing

Canonical `https://www.trongateslegacy.com/`, full Open Graph + Twitter card tags, `og.jpg` (1200×630,
generated from the hero), JSON-LD `WebSite` + `Person` with every social profile in `sameAs`, robots.txt and
sitemap.xml. `www` is the primary domain; the apex redirects to it (DNS: A record to Netlify's load balancer
on the apex, CNAME for `www`, at OVH).

## Deploy

Netlify builds from `main` with no build command; publish dir `public`, functions dir `netlify/functions`.
The `ignore` rule in netlify.toml skips builds when a push doesn't touch `public/`, `netlify/` or
`netlify.toml` (e.g. edits to kick-panels/, discord/, docs/).
