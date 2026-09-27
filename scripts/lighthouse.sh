#!/bin/sh
# Run Lighthouse (mobile + desktop) and print scores, key metrics and any failing audits.
#   scripts/lighthouse.sh --local      before pushing: against `node dev.mjs` on localhost:8888
#   scripts/lighthouse.sh [url]        after deploy: default is the live site
#   --forms                            also measure Princess Trina's and the Blobfish's looks, whatever changed
#   --changed=<git range>              what to look at for form-theme changes (below)
# Tron (a first visit) is always measured. Princess Trina and the Blobfish (opened with ?form=, as a returning visitor
# sees them: their own title font, backgrounds and canvas) are measured too when the change touches the form themes:
# a font, their art, or lines in public/index.html about forms, looks or themes. What counts as the change: locally,
# everything not yet on origin/main (committed or not); live, the last push (origin/main@{1}..origin/main).
# The local dev server has no CDN, compression or caching headers, so local performance scores run lower
# than live (e.g. 94 vs 100 on mobile) and aren't gated. Local runs gate on what *is* comparable:
#   accessibility and best practices 100, all SEO audits passing, CLS < 0.1, TBT < 200ms
# Live runs additionally gate on performance: mobile >= 97, desktop >= 98.
LOCAL=0 URL="https://www.trongateslegacy.com/" ALL=0 RANGE=""
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL=1; URL="http://localhost:8888/" ;;
    --forms) ALL=1 ;;
    --changed=*) RANGE="${arg#--changed=}" ;;
    *) URL="$arg" ;;
  esac
done
[ "$LOCAL" = 1 ] && { curl -s -o /dev/null -m 3 "$URL" || { echo "dev server not running: start it with: node dev.mjs"; exit 1; }; }

# does the change touch the form themes? (the names the themes' code and styles use; see "form themes" in public/index.html)
THEME_WORDS='princess|blobfish|data-look|data-theme|theme-btn|lookOf|setLook|LOOK_|SWITCH_IN|glitchSwap|accent2|--g1|--g2|--bg[:;) ]|--panel|--muted|--title|--tscale|twin|\.lay|lattice|bg-deep|f-grid|f-ball|f-sand|tiara|\.hook|sonar|sweep|glitter|bubbling|MODES|__form|tgl-form|cinzel|lilita'
THEMED=0
if [ "$ALL" = 1 ]; then THEMED=1; why="--forms"
else
  if [ -n "$RANGE" ]; then R="$RANGE"
  elif [ "$LOCAL" = 1 ]; then R="origin/main"                  # everything not pushed yet, committed or not
  else R="origin/main@{1} origin/main"; fi                     # the last push
  files=$( { git diff --name-only $R -- public/assets; [ "$LOCAL" = 1 ] && git ls-files -o --exclude-standard public/assets; } 2>/dev/null \
    | grep -E 'fonts/|img/(princess|blobfish)' | head -3 | tr '\n' ' ')
  lines=$(git diff -U0 $R -- public/index.html 2>/dev/null | grep -E '^[-+][^-+]' | grep -ciE "$THEME_WORDS")
  if [ -n "$files" ]; then THEMED=1; why="changed: $files"
  elif [ "${lines:-0}" -gt 0 ]; then THEMED=1; why="$lines changed lines in public/index.html about forms or themes"; fi
fi
FORMS="cyan"
if [ "$THEMED" = 1 ]; then FORMS="cyan princess blobfish"; echo "measuring all three forms ($why)"
else echo "measuring Tron only (nothing about the form themes changed; --forms measures all three)"; fi

export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="${TMPDIR:-/tmp}/tgl-lighthouse"; mkdir -p "$OUT"; rm -f "$OUT"/*.json
for form in $FORMS; do
  u="$URL"; [ "$form" != cyan ] && u="$URL?form=$form"
  for mode in mobile desktop; do
    preset=""; [ "$mode" = desktop ] && preset="--preset=desktop"
    npx --yes lighthouse "$u" --quiet $preset --chrome-flags="--headless=new" --output=json --output-path="$OUT/$form-$mode.json" >/dev/null 2>&1 \
      || echo "lighthouse ($form, $mode) exited non-zero; reading whatever it wrote"
  done
done
python3 - "$OUT" "$LOCAL" $FORMS <<'PY'
import json, sys
out, local, forms = sys.argv[1], sys.argv[2] == "1", sys.argv[3:]
bad = False
NAMES = {"cyan": "Tron", "princess": "Princess Trina", "blobfish": "Blobfish"}
for form in forms:
    if len(forms) > 1: print(NAMES[form])
    for mode, floor in (("mobile", 97), ("desktop", 98)):
        d = json.load(open(f"{out}/{form}-{mode}.json")); a = d["audits"]
        sc = {k: (None if v["score"] is None else round(v["score"] * 100)) for k, v in d["categories"].items()}
        print(f"{mode:8} performance {sc.get('performance')}  accessibility {sc.get('accessibility')}  best-practices {sc.get('best-practices')}  seo {sc.get('seo') if sc.get('seo') is not None else '(n/a locally)'}")
        m = {"FCP": "first-contentful-paint", "LCP": "largest-contentful-paint", "TBT": "total-blocking-time", "CLS": "cumulative-layout-shift"}
        print("         " + "  ".join(f"{k} {a[v]['displayValue']}" for k, v in m.items()).replace("\xa0", " ") + f"  page weight {round(a['total-byte-weight']['numericValue'] / 1024)} KB")
        if any((sc.get(k) or 0) < 100 for k in ("accessibility", "best-practices")): bad = True
        if not local and (sc.get("performance") or 0) < floor: bad = True
        if a["cumulative-layout-shift"]["numericValue"] >= 0.1 or a["total-blocking-time"]["numericValue"] >= 200: bad = True
        seo_fail = [r["id"] for r in d["categories"]["seo"]["auditRefs"] if a[r["id"]].get("score") == 0]
        if seo_fail: bad = True; print("         failing SEO audits:", ", ".join(seo_fail))
        for k, v in a.items():
            if v.get("score") is not None and v["score"] < 0.9 and v.get("scoreDisplayMode") in ("binary", "numeric", "metricSavings"):
                print(f"         - {k}: {v.get('displayValue', '')} ({v['title']})")
print(("local: " if local else "") + ("BELOW BASELINE, investigate before moving on" if bad else "at or above baseline")
      + (" (performance not gated locally; check it on the live site after deploy)" if local else ""))
sys.exit(1 if bad else 0)
PY
