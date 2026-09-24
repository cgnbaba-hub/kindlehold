#!/usr/bin/env bash
# Roll back "current" to the previous release (or a given release id).
# Usage: DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/rollback.sh [release-id] [--local]
set -euo pipefail
: "${DEPLOY_ROOT:?set DEPLOY_ROOT}"
[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_ROOT" != "/" && "$DEPLOY_ROOT" != *..* ]] || { echo "DEPLOY_ROOT must be an absolute path of [A-Za-z0-9._/-] without '..'" >&2; exit 2; }
TARGET=""; LOCAL=0
for a in "$@"; do
  case "$a" in
    --local) LOCAL=1 ;;
    *) [[ "$a" =~ ^[0-9A-Za-z-]+$ ]] || { echo "invalid release id" >&2; exit 2; }; TARGET="$a" ;;
  esac
done
read -r -d '' SCRIPT <<'S' || true
set -euo pipefail
root="$1"; target="${2:-}"
cur="$(readlink "$root/current" || true)"
if [ -z "$target" ]; then
  if [ -f "$root/.previous" ]; then target="$(basename "$(cat "$root/.previous")")"
  else target="$(ls -1t "$root/releases" | grep -vx "$(basename "$cur")" | head -n1)"; fi
fi
[ -n "$target" ] && [ -d "$root/releases/$target" ] || { echo "no release to roll back to" >&2; exit 3; }
echo "$cur" > "$root/.previous"
ln -sfn "releases/$target" "$root/current.tmp"
mv -Tf "$root/current.tmp" "$root/current"
echo "rolled back to $target (was $cur)"
S
if [[ "$LOCAL" -eq 1 ]]; then bash -c "$SCRIPT" rollback "$DEPLOY_ROOT" "$TARGET"
else
  : "${DEPLOY_HOST:?set DEPLOY_HOST}"
  [[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || { echo "DEPLOY_HOST contains invalid characters" >&2; exit 2; }
  ssh "$DEPLOY_HOST" bash -s -- "$DEPLOY_ROOT" "$TARGET" <<< "$SCRIPT"
fi
