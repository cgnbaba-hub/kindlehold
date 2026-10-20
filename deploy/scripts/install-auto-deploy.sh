#!/usr/bin/env bash
# Install (or remove) the auto-deploy timer on the VPS. Run once from the repo checkout as the
# user who normally runs publish-vps.sh (it needs write access to /var/www/kindlehold and to
# docker); it asks for sudo only to write the two systemd units.
# Usage: deploy/scripts/install-auto-deploy.sh [--uninstall]
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNIT=kindlehold-autodeploy
SUDO=""; [[ "$(id -u)" -ne 0 ]] && SUDO="sudo"

if [[ "${1:-}" == "--uninstall" ]]; then
  $SUDO systemctl disable --now "$UNIT.timer" 2>/dev/null || true
  $SUDO rm -f "/etc/systemd/system/$UNIT.service" "/etc/systemd/system/$UNIT.timer"
  $SUDO systemctl daemon-reload
  echo "auto-deploy removed"; exit 0
fi

RUN_USER="$(id -un)"; RUN_HOME="$HOME"
[[ "$REPO" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo "unusual repo path: $REPO" >&2; exit 2; }
command -v flock >/dev/null || { echo "flock missing (util-linux)" >&2; exit 2; }
docker ps >/dev/null 2>&1 || { echo "$RUN_USER cannot talk to docker" >&2; exit 2; }
[[ -w /var/www/kindlehold ]] || { echo "$RUN_USER cannot write /var/www/kindlehold" >&2; exit 2; }

for f in service timer; do
  sed -e "s#@USER@#$RUN_USER#g" -e "s#@REPO@#$REPO#g" -e "s#@HOME@#$RUN_HOME#g" "$REPO/deploy/systemd/$UNIT.$f" | $SUDO tee "/etc/systemd/system/$UNIT.$f" >/dev/null
done
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now "$UNIT.timer"
echo "auto-deploy installed for $RUN_USER in $REPO"
systemctl list-timers "$UNIT.timer" --no-pager | head -3
