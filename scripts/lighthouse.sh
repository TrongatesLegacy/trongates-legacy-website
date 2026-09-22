#!/bin/sh
# Run Lighthouse (mobile + desktop) and print scores, key metrics and any failing audits.
#   scripts/lighthouse.sh --local      before pushing: against `node dev.mjs` on localhost:8888
#   scripts/lighthouse.sh [url]        after deploy: default is the live site
# The local dev server has no CDN, compression or caching headers, so local performance scores run lower
# than live (e.g. 94 vs 100 on mobile) and aren't gated. Local runs gate on what *is* comparable:
#   accessibility and best practices 100, all SEO audits passing, CLS < 0.1, TBT < 200ms
# Live runs additionally gate on performance: mobile >= 95, desktop >= 98.
LOCAL=0
if [ "$1" = "--local" ]; then LOCAL=1; URL="http://localhost:8888/"
  curl -s -o /dev/null -m 3 "$URL" || { echo "dev server not running: start it with: node dev.mjs"; exit 1; }
else URL="${1:-https://www.trongateslegacy.com/}"; fi
export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="${TMPDIR:-/tmp}/tgl-lighthouse"; mkdir -p "$OUT"
for mode in mobile desktop; do
  preset=""; [ "$mode" = desktop ] && preset="--preset=desktop"
  npx --yes lighthouse "$URL" --quiet $preset --chrome-flags="--headless=new" --output=json --output-path="$OUT/$mode.json" >/dev/null 2>&1 \
    || echo "lighthouse ($mode) exited non-zero; reading whatever it wrote"
done
python3 - "$OUT" "$LOCAL" <<'PY'
import json, sys
out, local = sys.argv[1], sys.argv[2] == "1"
bad = False
for mode, floor in (("mobile", 95), ("desktop", 98)):
    d = json.load(open(f"{out}/{mode}.json")); a = d["audits"]
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
