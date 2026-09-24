#!/usr/bin/env bash
# Build a production release into dist/ and package it as release-<id>.tar.gz.
# Usage: deploy/scripts/build.sh [--skip-tests]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

SKIP_TESTS=0
[[ "${1:-}" == "--skip-tests" ]] && SKIP_TESTS=1

BASE="${KINDLEHOLD_BASE:-/}"
case "$BASE" in
  /*/|/) ;;
  *) echo "KINDLEHOLD_BASE must start and end with '/' (got '$BASE')" >&2; exit 2 ;;
esac

if [[ ! -d node_modules ]]; then npm ci; fi
if [[ "$SKIP_TESTS" -eq 0 ]]; then npm test; fi

rm -rf dist
KINDLEHOLD_BASE="$BASE" npm run build

if find dist -name '*.map' | grep -q .; then echo "source maps found in dist/ — refusing to package" >&2; exit 3; fi

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
echo "$RELEASE_ID" > dist/RELEASE
mkdir -p .deploy-local
tar -C dist -czf ".deploy-local/release-${RELEASE_ID}.tar.gz" .
echo "built release ${RELEASE_ID} -> .deploy-local/release-${RELEASE_ID}.tar.gz"
