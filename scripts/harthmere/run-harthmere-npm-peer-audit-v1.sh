#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT"
mkdir -p /tmp/harthmere-npm-audit
LOG="/tmp/harthmere-npm-audit/npm-install-peer-audit.$(date +%Y%m%d-%H%M%S).log"

echo "==> Running package-lock-only npm peer audit"
echo "==> Log: $LOG"
set +e
npm install --package-lock-only --ignore-scripts 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}
set -e

if [ "$STATUS" -eq 0 ]; then
  echo "RESULT: PASS npm peer audit completed"
  exit 0
fi

echo
if grep -q "ERESOLVE" "$LOG"; then
  echo "RESULT: FAIL npm reported ERESOLVE. Known fixes already applied by this patch:"
  echo "- ReactGrid 4.0.x -> 4.1.17+"
  echo "- emoji-mart 3.x -> emoji-mart 5 + @emoji-mart/react + @emoji-mart/data"
  echo "- react-json-view -> react18-json-view"
  echo "- stylelint-config-prettier removed for Stylelint 15"
  echo "- utf-8-validate pinned to 5.0.10 for ws7/ws8 optional peer compatibility"
  echo "- @kubernetes/client-node moved to 0.22.3 pre-1 Node20 line"
  echo
  echo "Paste the new ERESOLVE block if one remains after these fixes. Do not use peer-dependency bypass flags."
else
  echo "RESULT: FAIL npm install failed for a non-ERESOLVE reason. See log above."
fi
exit "$STATUS"
