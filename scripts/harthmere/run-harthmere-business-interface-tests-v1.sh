#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$(pwd)}"

export TS_NODE_PROJECT="${TS_NODE_PROJECT:-tsconfig.json}"
export TS_NODE_TRANSPILE_ONLY="${TS_NODE_TRANSPILE_ONLY:-true}"
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","jsx":"react"}'

npx mocha \
  --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  src/client/components/harthmere_business/__tests__/businessInterfaceLiveAdapter.test.ts
