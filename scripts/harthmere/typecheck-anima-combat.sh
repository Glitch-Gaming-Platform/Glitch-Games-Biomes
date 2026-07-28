#!/usr/bin/env bash
# ANIMA_COMBAT_TYPECHECK
#
#   scripts/harthmere/typecheck-anima-combat.sh          # both lanes
#   scripts/harthmere/typecheck-anima-combat.sh shared   # fast lane only
#   scripts/harthmere/typecheck-anima-combat.sh server   # server lane only
#
# `./b test` does NOT typecheck (ts-node runs transpileOnly + swc), so green
# tests say nothing about type correctness for this work. Run this too.
#
# The server lane deliberately omits `src/server/shared/config.ts`, which declares
# the global `CONFIG`. Including it roughly triples the check time; excluding it
# makes a small fixed set of untouched transitive modules report a spurious
# TS2304. Those exact files are filtered by name here — nothing else is
# suppressed, so a real error in the combat/escort/seed code still fails.

set -euo pipefail
cd "$(dirname "$0")/../.."

TSC=(node_modules/.bin/tsc --noEmit)
export NODE_OPTIONS="--max-old-space-size=8192"

SCOPED_CONFIG_ARTIFACTS='^(src/server/shared/redis/connection\.ts|src/server/shared/world/lua/apply\.ts|src/server/logic/utils/drops\.ts).*Cannot find name .CONFIG.'

run_shared() {
  echo "== anima combat: shared lane =="
  "${TSC[@]}" -p tsconfig.animacombat.json
  echo "shared lane OK"
}

run_server() {
  echo "== anima combat: server lane =="
  local out status
  set +e
  out="$("${TSC[@]}" -p tsconfig.animaserver.json 2>&1)"
  status=$?
  set -e
  local filtered known
  # `grep -v` exits 1 when every line was filtered. Under `set -e` that is the
  # successful "only documented artifacts remain" case, not a script failure.
  filtered="$(printf '%s\n' "$out" | grep -Ev "$SCOPED_CONFIG_ARTIFACTS" | sed '/^[[:space:]]*$/d' || true)"
  known="$(printf '%s\n' "$out" | grep -E "$SCOPED_CONFIG_ARTIFACTS" || true)"
  if [[ -n "$filtered" ]]; then
    printf '%s\n' "$filtered"
    exit 1
  fi
  if [[ $status -ne 0 ]]; then
    # A nonzero compiler exit with no recognized CONFIG artifact is still a
    # failure (for example, a tsconfig parse error or a global diagnostic that
    # does not begin with `src/`). The old output filter accidentally accepted
    # those because it only retained source-file diagnostics.
    if [[ -z "$known" ]]; then
      printf '%s\n' "$out"
      exit "$status"
    fi
    echo "server lane OK (only the documented scoped-check CONFIG artifacts)"
  else
    echo "server lane OK"
  fi
}

case "${1:-all}" in
  shared) run_shared ;;
  server) run_server ;;
  all)    run_shared; run_server ;;
  *) echo "usage: $0 [shared|server|all]" >&2; exit 2 ;;
esac
