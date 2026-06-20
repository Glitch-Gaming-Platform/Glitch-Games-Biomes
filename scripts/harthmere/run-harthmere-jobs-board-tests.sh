#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "Bootstrapping Harthmere jobs board tests"
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","jsx":"react"}' \
  npx mocha \
    --require ts-node/register/transpile-only \
    --require tsconfig-paths/register \
    src/shared/harthmere/test/mmo_jobs_board_authority.test.ts \
    src/shared/harthmere/test/live_mode_jobs_board_proximity.test.ts \
    src/pages/api/harthmere/test/live_mode_api_persistence.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/jobsBoardLiveAdapter.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/proximityGate.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/jobsBoardPointerLock.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/HarthmereJobsBoardPanel.keyboard.test.tsx \
    src/client/components/harthmere_business/__tests__/businessInterfaceLiveAdapter.test.ts
