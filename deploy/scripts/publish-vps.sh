#!/usr/bin/env bash
# Publish Kindlehold on this VPS without a domain:
#   1) build + atomic --local release into /var/www/kindlehold
#   2) nginx (repo config) in Docker on 127.0.0.1:8098, restart=unless-stopped
#   3) Cloudflare quick tunnel -> public https://<random>.trycloudflare.com URL
# Re-run after a reboot: quick-tunnel URLs are not stable (a fixed hostname needs a
# public-hostname route in the Cloudflare Zero Trust dashboard, see DEPLOYMENT.md §6).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
ROOT_DIR=/var/www/kindlehold
PORT=8098
NAME=kindlehold-web
LOG="$PWD/.deploy-local/tunnel.log"
mkdir -p .deploy-local/nginx

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  deploy/scripts/build.sh --skip-tests >/dev/null
  DEPLOY_ROOT="$ROOT_DIR" deploy/scripts/deploy.sh --local >/dev/null
fi

sed -e "s#/var/www/kindlehold/current#/srv/kindlehold/current#" \
    -e 's#access_log .*#access_log /dev/stdout;#' -e 's#error_log .*#error_log /dev/stderr warn;#' \
    -e 's#server_name game.example.com;#server_name _;#' \
    deploy/nginx/game.conf.example > .deploy-local/nginx/public.conf

if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped -p "127.0.0.1:${PORT}:80" \
    -v "$ROOT_DIR:/srv/kindlehold:ro" -v "$PWD/.deploy-local/nginx/public.conf:/etc/nginx/conf.d/default.conf:ro" \
    nginx:1.27-alpine >/dev/null
else
  docker exec "$NAME" nginx -s reload >/dev/null
fi
for _ in $(seq 1 30); do curl -fs "http://127.0.0.1:${PORT}/healthz" >/dev/null && break; sleep 0.5; done

if [[ "${SKIP_TUNNEL:-0}" == "1" ]]; then echo "https://kindlehold.js-automata.work/ (via the permanent Cloudflare hostname)"; exit 0; fi
if ! pgrep -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:${PORT}" >/dev/null; then
  : > "$LOG"
  nohup cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${PORT}" >"$LOG" 2>&1 </dev/null &
  disown
fi
URL=""
for _ in $(seq 1 40); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [[ -n "$URL" ]] && break
  sleep 1
done
[[ -n "$URL" ]] || { echo "tunnel URL not found in $LOG" >&2; exit 1; }
echo "$URL" > .deploy-local/PUBLIC_URL
echo "$URL"
