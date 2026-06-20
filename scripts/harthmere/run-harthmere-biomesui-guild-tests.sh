#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

export TS_NODE_TRANSPILE_ONLY=1
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","jsx":"react"}'

npx ts-mocha --no-config --require ts-node/register --project tsconfig.json \
  src/client/components/biomes_ui/__tests__/guildsLiveAdapter.test.ts \
  src/client/components/biomes_ui/__tests__/guildsTabNoDummy.test.tsx
