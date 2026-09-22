#!/bin/sh
# Run Lighthouse (mobile + desktop) and print scores, key metrics and any failing audits.
#   scripts/lighthouse.sh [url]        default: the live site
# Run it against the live site after a push has deployed (the local dev server has no CDN, compression or
# caching headers, so its performance numbers are not comparable). Baseline to protect:
#   mobile  performance >= 95, accessibility/best practices 100, all SEO audits passing
#   desktop performance >= 98, accessibility/best practices 100
URL="${1:-https://www.trongateslegacy.com/}"
export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="${TMPDIR:-/tmp}/tgl-lighthouse"; mkdir -p "$OUT"
for mode in mobile desktop; do
  preset=""; [ "$mode" = desktop ] && preset="--preset=desktop"
  npx --yes lighthouse "$URL" --quiet $preset --chrome-flags="--headless=new" --output=json --output-path="$OUT/$mode.json" >/dev/null 2>&1 \
    || echo "lighthouse ($mode) exited non-zero; reading whatever it wrote"
done
python3 - "$OUT" <<'PY'
import json, sys
out = sys.argv[1]
bad = False
for mode, floor in (("mobile", 95), ("desktop", 98)):
    d = json.load(open(f"{out}/{mode}.json")); a = d["audits"]
    sc = {k: (None if v["score"] is None else round(v["score"] * 100)) for k, v in d["categories"].items()}
    print(f"{mode:8} performance {sc.get('performance')}  accessibility {sc.get('accessibility')}  best-practices {sc.get('best-practices')}  seo {sc.get('seo') if sc.get('seo') is not None else '(n/a locally)'}")
    print("         " + "  ".join(f"{k.split('-')[0].upper() if k!='largest-contentful-paint' else 'LCP'} {a[k]['displayValue']}" for k in ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift")).replace("\xa0", " ") + f"  weight {a['total-byte-weight']['displayValue']}")
    if (sc.get("performance") or 0) < floor or any((sc.get(k) or 0) < 100 for k in ("accessibility", "best-practices")): bad = True
    seo_fail = [r["id"] for r in d["categories"]["seo"]["auditRefs"] if a[r["id"]].get("score") == 0]
    if seo_fail: bad = True; print("         failing SEO audits:", ", ".join(seo_fail))
    for k, v in a.items():
        if v.get("score") is not None and v["score"] < 0.9 and v.get("scoreDisplayMode") in ("binary", "numeric", "metricSavings"):
            print(f"         - {k}: {v.get('displayValue', '')} ({v['title']})")
print("BELOW BASELINE, investigate before moving on" if bad else "at or above baseline")
PY
