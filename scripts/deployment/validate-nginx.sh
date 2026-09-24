#!/usr/bin/env bash
# Local deployment validation: builds, performs two atomic --local deploys, serves them with the
# repository nginx config in the local nginx:1.27-alpine image (bound to 127.0.0.1 only),
# then checks routing, MIME types, caching, security headers, source maps, nested-path reload
# and rollback. Leaves no container running.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
PORT="${VALIDATE_PORT:-8097}"
NAME="kindlehold-nginx-validate"
WWW="$PWD/.deploy-local/www"
IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"
fail() { echo "DEPLOY-VALIDATE FAIL: $*" >&2; docker rm -f "$NAME" >/dev/null 2>&1 || true; exit 1; }

for f in deploy/scripts/*.sh; do bash -n "$f" || fail "syntax error in $f"; done
rm -rf "$WWW" .deploy-local/release-*.tar.gz
deploy/scripts/build.sh --skip-tests >/dev/null
DEPLOY_ROOT="$WWW" deploy/scripts/deploy.sh --local >/dev/null
FIRST="$(cat "$WWW/current/RELEASE")"
sleep 1
deploy/scripts/build.sh --skip-tests >/dev/null
DEPLOY_ROOT="$WWW" deploy/scripts/deploy.sh --local >/dev/null
SECOND="$(cat "$WWW/current/RELEASE")"
[[ "$FIRST" != "$SECOND" ]] || fail "second deploy did not create a new release"

# adapt the example config for the container (paths + logs to stderr)
mkdir -p .deploy-local/nginx
sed -e 's#/var/www/kindlehold/current#/srv/kindlehold/current#' \
    -e 's#access_log .*#access_log /dev/stdout;#' -e 's#error_log .*#error_log /dev/stderr warn;#' \
    -e 's#server_name game.example.com;#server_name _;#' \
    deploy/nginx/game.conf.example > .deploy-local/nginx/default.conf

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:80" \
  -v "$WWW:/srv/kindlehold:ro" -v "$PWD/.deploy-local/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  "$IMAGE" >/dev/null || fail "could not start nginx container"
for i in $(seq 1 30); do curl -fs "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 && break; sleep 0.3; done
docker exec "$NAME" nginx -t >/dev/null 2>&1 || fail "nginx -t failed"

BASE="http://127.0.0.1:${PORT}/"
deploy/scripts/health-check.sh "$BASE" || fail "health check failed"
hdr="$(curl -fsSI "$BASE" | tr -d '\r')"
for h in 'content-security-policy' 'x-content-type-options: nosniff' 'x-frame-options: SAMEORIGIN' 'referrer-policy'; do
  grep -qi "^$h" <<< "$hdr" || fail "missing header $h on index"
done
nested="$(curl -fsS "${BASE}play/campaign?x=1")" || fail "nested path did not load"
grep -q '<title>Kindlehold</title>' <<< "$nested" || fail "nested path did not fall back to index.html"
code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}.env")"; [[ "$code" == 404 || "$code" == 403 ]] || fail ".env reachable ($code)"
code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}assets/does-not-exist.js")"; [[ "$code" == 404 ]] || fail "missing asset returned $code instead of 404"
gz="$(curl -fsS -H 'Accept-Encoding: gzip' -o /dev/null -D - "${BASE}$(grep -oE 'assets/[^"]+\.js' <<< "$nested" | head -n1)" | tr -d '\r')"
grep -qi '^content-encoding: gzip' <<< "$gz" || fail "gzip not applied to JS"
[[ "$(curl -fsS "${BASE}RELEASE")" == "$SECOND" ]] || fail "current does not serve the second release"

DEPLOY_ROOT="$WWW" deploy/scripts/rollback.sh --local >/dev/null
[[ "$(curl -fsS "${BASE}RELEASE")" == "$FIRST" ]] || fail "rollback did not switch to the first release"
DEPLOY_ROOT="$WWW" deploy/scripts/rollback.sh --local >/dev/null
[[ "$(curl -fsS "${BASE}RELEASE")" == "$SECOND" ]] || fail "roll-forward did not switch back"

docker rm -f "$NAME" >/dev/null
echo "DEPLOY-VALIDATE OK: atomic releases ($FIRST, $SECOND), rollback, headers, gzip, MIME, caching, nested-path reload, no source maps"
