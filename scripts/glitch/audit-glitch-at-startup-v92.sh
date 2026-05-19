#!/usr/bin/env bash
set -euo pipefail

fail=0

grep -q "GLITCH_LOCAL_SYNC_BASE_URL_V92" src/client/game/client_config.ts \
  && echo "OK client local sync override" \
  || { echo "FAIL missing client local sync override"; fail=1; }

grep -q "HostPort.rpcPort" src/server/sync/server.ts \
  && echo "OK sync rpc uses HostPort.rpcPort" \
  || { echo "FAIL sync still hardcodes rpc port"; fail=1; }

grep -q "DISCOVERY_KIND" scripts/glitch/run-glitch-local-game-stack-v92.sh \
  && echo "OK runner sets discovery kind" \
  || { echo "FAIL missing discovery kind"; fail=1; }

grep -q "NEXT_PUBLIC_GLITCH_SYNC_BASE_URL" scripts/glitch/run-glitch-local-game-stack-v92.sh \
  && echo "OK runner sets browser sync base" \
  || { echo "FAIL missing browser sync base"; fail=1; }

if grep -q 'start_service "bikkie"' scripts/glitch/run-glitch-local-game-stack-v92.sh; then
  echo "FAIL runner still starts standalone bikkie"
  fail=1
else
  echo "OK runner avoids standalone bikkie"
fi

exit "$fail"
