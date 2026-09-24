#!/usr/bin/env bash
# Atomic deploy of the latest built release to a VPS over SSH.
#   releases/<id>/  — unpacked build
#   current -> releases/<id>  — switched with an atomic rename
# Usage: DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/deploy.sh [--dry-run] [--local]
#   --local  deploy into DEPLOY_ROOT on this machine (no SSH), used for local validation
# Values are passed to the remote script as positional arguments (never interpolated
# into script text) and validated against strict allowlists first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

DRY=0; LOCAL=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --local) LOCAL=1 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

: "${DEPLOY_ROOT:?set DEPLOY_ROOT (e.g. /var/www/kindlehold)}"
KEEP="${KEEP_RELEASES:-5}"
[[ "$KEEP" =~ ^[0-9]{1,3}$ && "$KEEP" -ge 1 ]] || { echo "KEEP_RELEASES must be a number >= 1" >&2; exit 2; }
[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_ROOT" != "/" && "$DEPLOY_ROOT" != *..* ]] || { echo "DEPLOY_ROOT must be an absolute path of [A-Za-z0-9._/-] without '..'" >&2; exit 2; }
if [[ "$LOCAL" -eq 0 && "$DRY" -eq 0 ]]; then
  : "${DEPLOY_HOST:?set DEPLOY_HOST (an SSH host alias)}"
  [[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || { echo "DEPLOY_HOST contains invalid characters" >&2; exit 2; }
fi

ARCHIVE="$(ls -1t .deploy-local/release-*.tar.gz 2>/dev/null | head -n1 || true)"
[[ -n "$ARCHIVE" ]] || { echo "no release archive found; run deploy/scripts/build.sh first" >&2; exit 3; }
ID="$(basename "$ARCHIVE" .tar.gz)"; ID="${ID#release-}"
[[ "$ID" =~ ^[0-9A-Za-z-]+$ ]] || { echo "unexpected release id '$ID'" >&2; exit 3; }

# The remote script reads its inputs from "$1" "$2" "$3" only (quoted heredoc: no expansion here).
read -r -d '' REMOTE_SCRIPT <<'SCRIPT' || true
set -euo pipefail
root="$1"; id="$2"; keep="$3"
mkdir -p "$root/releases/$id"
tar -xzf "$root/incoming-$id.tar.gz" -C "$root/releases/$id"
rm -f "$root/incoming-$id.tar.gz"
test -f "$root/releases/$id/index.html"
if [ -L "$root/current" ]; then readlink "$root/current" > "$root/.previous"; fi
ln -sfn "releases/$id" "$root/current.tmp"
mv -Tf "$root/current.tmp" "$root/current"
cur="$(basename "$(readlink "$root/current")")"
prev="$( [ -f "$root/.previous" ] && basename "$(cat "$root/.previous")" || true )"
cd "$root/releases"
ls -1t | tail -n +$((keep + 1)) | while read -r old; do
  # never prune the active release or the one rollback.sh would return to
  if [ "$old" != "$cur" ] && [ "$old" != "$prev" ]; then rm -rf -- "./$old"; fi
done
echo "deployed $id"
SCRIPT

if [[ "$DRY" -eq 1 ]]; then
  echo "[dry-run] would upload $ARCHIVE to ${DEPLOY_HOST:-<local>}:$DEPLOY_ROOT and run with args: $DEPLOY_ROOT $ID $KEEP"
  echo "$REMOTE_SCRIPT"; exit 0
fi

if [[ "$LOCAL" -eq 1 ]]; then
  mkdir -p -- "$DEPLOY_ROOT"
  cp -- "$ARCHIVE" "$DEPLOY_ROOT/incoming-$ID.tar.gz"
  bash -c "$REMOTE_SCRIPT" deploy "$DEPLOY_ROOT" "$ID" "$KEEP"
else
  ssh "$DEPLOY_HOST" mkdir -p -- "$DEPLOY_ROOT"
  scp -- "$ARCHIVE" "$DEPLOY_HOST:$DEPLOY_ROOT/incoming-$ID.tar.gz"
  ssh "$DEPLOY_HOST" bash -s -- "$DEPLOY_ROOT" "$ID" "$KEEP" <<< "$REMOTE_SCRIPT"
fi

if [[ -n "${HEALTH_URL:-}" ]]; then
  "$(dirname "$0")/health-check.sh" "$HEALTH_URL"
fi
