#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

LOG="${2:-/tmp/harthmere-typescript-check-$(date +%Y%m%d-%H%M%S).log}"

echo "== Full TypeScript check =="
echo "Root: $ROOT"
echo "Log:  $LOG"

if [[ ! -x node_modules/.bin/tsc ]]; then
  echo "Missing node_modules/.bin/tsc. Run npm/yarn install first." >&2
  exit 1
fi

NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false 2>&1 | tee "$LOG"
echo "TypeScript PASS"
