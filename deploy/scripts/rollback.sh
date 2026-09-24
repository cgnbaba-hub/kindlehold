#!/usr/bin/env bash
# Roll back "current" to the previous release (or a given release id).
# Usage: DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/rollback.sh [release-id] [--local]
set -euo pipefail
: "${DEPLOY_ROOT:?set DEPLOY_ROOT}"
TARGET=""; LOCAL=0
for a in "$@"; do
  case "$a" in
    --local) LOCAL=1 ;;
    *) [[ "$a" =~ ^[0-9A-Za-z-]+$ ]] || { echo "invalid release id" >&2; exit 2; }; TARGET="$a" ;;
  esac
done
SCRIPT=$(cat <<S
set -euo pipefail
root='$DEPLOY_ROOT'; target='$TARGET'
cur="\$(readlink "\$root/current" || true)"
if [ -z "\$target" ]; then
  if [ -f "\$root/.previous" ]; then target="\$(basename "\$(cat "\$root/.previous")")"
  else target="\$(ls -1t "\$root/releases" | grep -vx "\$(basename "\$cur")" | head -n1)"; fi
fi
[ -n "\$target" ] && [ -d "\$root/releases/\$target" ] || { echo "no release to roll back to" >&2; exit 3; }
echo "\$cur" > "\$root/.previous"
ln -sfn "releases/\$target" "\$root/current.tmp"
mv -Tf "\$root/current.tmp" "\$root/current"
echo "rolled back to \$target (was \$cur)"
S
)
if [[ "$LOCAL" -eq 1 ]]; then bash -c "$SCRIPT"; else : "${DEPLOY_HOST:?set DEPLOY_HOST}"; ssh "$DEPLOY_HOST" "bash -s" <<< "$SCRIPT"; fi
