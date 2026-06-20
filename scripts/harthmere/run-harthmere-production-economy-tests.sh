#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$(pwd)}"

# Match the existing Harthmere production test scripts: register ts-node in
# transpile-only mode and register tsconfig-paths so @/... imports resolve from
# tsconfig.json baseUrl/paths. This avoids changing already-working authority
# modules just to satisfy one targeted test runner.
export TS_NODE_PROJECT="${TS_NODE_PROJECT:-tsconfig.json}"
export TS_NODE_TRANSPILE_ONLY="${TS_NODE_TRANSPILE_ONLY:-true}"
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}'

npx mocha \
  --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  src/shared/harthmere/test/mmo_economy_authority.test.ts
