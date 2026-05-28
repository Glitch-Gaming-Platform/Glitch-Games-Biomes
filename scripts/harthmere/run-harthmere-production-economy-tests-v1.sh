#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$(pwd)}"

TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
  npx ts-mocha --no-config --project tsconfig.json \
    src/shared/harthmere/test/mmo_economy_authority_v1.test.ts
