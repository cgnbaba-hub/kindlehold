#!/usr/bin/env bash
# Auto-deploy on the VPS: when GitHub's main has a new commit, test it, build it, switch the live
# release atomically, check it, and roll back if the check fails. Run every few minutes by the
# systemd timer from deploy/scripts/install-auto-deploy.sh; safe to run by hand as well.
#
# It works in its own clean worktree (.deploy-local/auto-src), so local edits in the main
# checkout (HANDOFF.md notes and the like) are never touched, stashed or overwritten.
# It fetches over HTTPS only and needs no SSH key.
#
# Usage: deploy/scripts/auto-deploy.sh [--dry-run] [--force]
#   --dry-run  fetch, test and build, but do not switch the live release
#   --force    deploy even if this commit was deployed already or failed before
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE="${KINDLEHOLD_REMOTE:-https://github.com/cgnbaba-hub/kindlehold.git}"
BRANCH="${KINDLEHOLD_BRANCH:-main}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/kindlehold}"
PORT="${KINDLEHOLD_PORT:-8098}"
NAME="${KINDLEHOLD_CONTAINER:-kindlehold-web}"
STATE="$REPO/.deploy-local"
SRC="$STATE/auto-src"

DRY=0; FORCE=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --force) FORCE=1 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo "invalid branch name" >&2; exit 2; }

mkdir -p "$STATE"
log() { echo "[auto-deploy $(date -u +%H:%M:%SZ)] $*"; }
status() { printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:-}" > "$STATE/AUTO_STATUS"; }

# one run at a time (a slow build must not overlap the next timer tick)
exec 9>"$STATE/auto-deploy.lock"
flock -n 9 || { log "another run is still busy"; exit 0; }

cd "$REPO"
git fetch --quiet "$REMOTE" "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
TARGET="$(git rev-parse "refs/remotes/origin/$BRANCH")"
SHORT="${TARGET:0:7}"

if [[ "$FORCE" -eq 0 ]]; then
  [[ "$(cat "$STATE/AUTO_DEPLOYED" 2>/dev/null)" == "$TARGET" ]] && exit 0   # already live: stay quiet
  if [[ "$(cat "$STATE/AUTO_FAILED" 2>/dev/null)" == "$TARGET" ]]; then
    exit 0   # this commit failed before: wait for the next one (or --force)
  fi
fi
log "new commit on $BRANCH: $SHORT"
status running "$SHORT"
fail() { log "FAILED: $*"; echo "$TARGET" > "$STATE/AUTO_FAILED"; status failed "$SHORT $*"; exit 1; }

# a clean worktree of exactly that commit
if git -C "$SRC" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$SRC" checkout --quiet --force --detach "$TARGET"
  git -C "$SRC" clean -fdxq -e node_modules -e .deploy-local
else
  rm -rf "$SRC"
  git worktree prune
  git worktree add --quiet --detach "$SRC" "$TARGET"
fi
cd "$SRC"

# dependencies only when the lockfile changed
LOCKSUM="$(sha256sum package-lock.json | cut -d' ' -f1)"
mkdir -p .deploy-local
if [[ ! -d node_modules || "$(cat .deploy-local/LOCKSUM 2>/dev/null)" != "$LOCKSUM" ]]; then
  log "installing dependencies"
  npm ci --no-audit --no-fund >/dev/null || fail "npm ci"
  echo "$LOCKSUM" > .deploy-local/LOCKSUM
fi

# never ship a red build
log "running tests"
npm test >/dev/null 2>"$STATE/auto-test.log" || { tail -n 30 "$STATE/auto-test.log" >&2 || true; fail "tests"; }
log "building"
deploy/scripts/build.sh --skip-tests >/dev/null || fail "build"

if [[ "$DRY" -eq 1 ]]; then log "dry run: built $SHORT, live release unchanged"; status dry-run "$SHORT"; exit 0; fi

log "switching the live release"
DEPLOY_ROOT="$DEPLOY_ROOT" deploy/scripts/deploy.sh --local >/dev/null || fail "deploy"

# nginx: the running container mounts the config file publish-vps.sh wrote; refresh it from this
# commit's template (in place, so the bind mount sees it) and reload
mkdir -p .deploy-local/nginx
sed -e "s#/var/www/kindlehold/current#/srv/kindlehold/current#" \
    -e 's#access_log .*#access_log /dev/stdout;#' -e 's#error_log .*#error_log /dev/stderr warn;#' \
    -e 's#server_name game.example.com;#server_name _;#' \
    deploy/nginx/game.conf.example > .deploy-local/nginx/public.conf
MOUNT="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}{{.Source}}{{end}}{{end}}' "$NAME" 2>/dev/null || true)"
if [[ -n "$MOUNT" && -f "$MOUNT" ]] && ! cmp -s .deploy-local/nginx/public.conf "$MOUNT"; then
  cp "$MOUNT" "$STATE/nginx-public.conf.bak"
  cat .deploy-local/nginx/public.conf > "$MOUNT"
  docker exec "$NAME" nginx -t >/dev/null 2>&1 || { cat "$STATE/nginx-public.conf.bak" > "$MOUNT"; fail "nginx config of $SHORT is invalid (kept the old one)"; }
fi
docker exec "$NAME" nginx -s reload >/dev/null || fail "nginx reload"

# check what is live; on failure switch back to the previous release
sleep 1
if ! deploy/scripts/health-check.sh "http://127.0.0.1:${PORT}/" >/dev/null 2>"$STATE/auto-health.log"; then
  cat "$STATE/auto-health.log" >&2 || true
  log "health check failed: rolling back"
  DEPLOY_ROOT="$DEPLOY_ROOT" deploy/scripts/rollback.sh --local >/dev/null || true
  docker exec "$NAME" nginx -s reload >/dev/null || true
  fail "health check (rolled back)"
fi
live="$(curl -fsS --max-time 10 "http://127.0.0.1:${PORT}/RELEASE" 2>/dev/null || true)"
[[ -z "$live" || "$live" == *"-$SHORT"* ]] || log "note: /RELEASE reports '$live'"

echo "$TARGET" > "$STATE/AUTO_DEPLOYED"
rm -f "$STATE/AUTO_FAILED"
status deployed "$SHORT"
log "live: $SHORT"
