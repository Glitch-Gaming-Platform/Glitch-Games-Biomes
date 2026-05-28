#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT"
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","jsx":"react"}'
npx mocha \
  --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  src/client/components/harthmere_business/__tests__/businessInterfaceLiveAdapter.test.ts
