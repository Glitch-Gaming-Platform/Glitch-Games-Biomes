#!/usr/bin/env bash
set -euo pipefail

fail=0

check_absent() {
  local label="$1"
  local pattern="$2"
  if git grep -n "$pattern" -- src next.config.js public >/tmp/glitch-audit-hit.txt 2>/dev/null; then
    echo "FAIL $label"
    cat /tmp/glitch-audit-hit.txt
    fail=1
  else
    echo "OK $label"
  fi
}

check_present() {
  local label="$1"
  local pattern="$2"
  if git grep -n "$pattern" -- src scripts >/tmp/glitch-audit-hit.txt 2>/dev/null; then
    echo "OK $label"
  else
    echo "FAIL $label"
    fail=1
  fi
}

test ! -f src/middleware.ts && echo "OK middleware removed" || { echo "FAIL middleware still exists"; fail=1; }

check_absent "old production firehose URL absent" "https://www.biomes.gg/api/f"
check_absent "old production manifest URL absent" "https://static.biomes.gg/pwa/manifest.json"

check_present "global bootstrap component exists" "HarthmereGlitchInstallBootstrap"
check_present "bootstrap posts to existing Glitch route" "/api/glitch/harthmere"
check_present "existing Glitch bridge still mounted" "useHarthmereGlitchBridge(Boolean(clientContext), clientContext)"
check_present "existing Glitch API route validates installs" "/installs/"

if [ "$fail" -ne 0 ]; then
  echo "AUDIT FAILED"
  exit 1
fi

echo "AUDIT PASSED"
