#!/usr/bin/env bash
# Post-deployment HTTP health check: index loads, entry script and hashed assets are reachable,
# caching headers are correct, no source maps are exposed.
# Usage: deploy/scripts/health-check.sh https://game.example.com/
set -euo pipefail
URL="${1:?usage: health-check.sh <base-url>}"
[[ "$URL" == */ ]] || URL="$URL/"
fail() { echo "HEALTH FAIL: $*" >&2; exit 1; }

html="$(curl -fsS --max-time 15 "$URL")" || fail "index not reachable at $URL"
grep -q '<title>Kindlehold</title>' <<< "$html" || fail "index.html does not look like Kindlehold"
cc="$(curl -fsSI --max-time 15 "$URL" | tr -d '\r' | grep -i '^cache-control:' || true)"
grep -qi 'no-cache' <<< "$cc" || fail "index.html must not be cached long-term (got: ${cc:-none})"

entry="$(grep -oE '(src|href)="[^"]*assets/[^"]+\.js"' <<< "$html" | head -n1 | sed -E 's/^(src|href)="//; s/"$//')"
[[ -n "$entry" ]] || fail "no hashed entry script referenced by index.html"
case "$entry" in http*) asset_url="$entry" ;; /*) asset_url="$(sed -E 's#^(https?://[^/]+).*#\1#' <<< "$URL")$entry" ;; *) asset_url="$URL$entry" ;; esac
hdr="$(curl -fsSI --max-time 15 "$asset_url" | tr -d '\r')" || fail "entry script not reachable: $asset_url"
grep -qi '^content-type: .*javascript' <<< "$hdr" || fail "entry script has wrong MIME type"
grep -qi 'max-age=31536000' <<< "$hdr" || fail "hashed assets are not long-cached"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${asset_url}.map")"
[[ "$code" == 404 ]] || fail "source map request returned $code (expected 404)"
echo "HEALTH OK: $URL (entry $entry)"
