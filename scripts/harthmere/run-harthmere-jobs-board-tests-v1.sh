#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "Bootstrapping Harthmere jobs board tests"
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","jsx":"react"}' \
  npx mocha \
    --require ts-node/register/transpile-only \
    --require tsconfig-paths/register \
    src/shared/harthmere/test/mmo_jobs_board_authority_v1.test.ts \
    src/shared/harthmere/test/live_mode_jobs_board_proximity_v145.test.ts \
    src/pages/api/harthmere/test/live_mode_api_persistence.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/jobsBoardLiveAdapter.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/proximityGateV141.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/jobsBoardPointerLockV145.test.ts \
    src/client/components/harthmere_jobs_board/__tests__/HarthmereJobsBoardPanel.keyboard.test.tsx \
    src/client/components/harthmere_business/__tests__/businessInterfaceLiveAdapter.test.ts
