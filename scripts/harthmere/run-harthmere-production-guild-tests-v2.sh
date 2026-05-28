#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT"
if [ ! -d node_modules ]; then
  echo "ERROR: node_modules is missing. Install dependencies first." >&2
  exit 1
fi
if [ ! -f node_modules/mocha/bin/mocha ]; then
  echo "ERROR: mocha is missing from node_modules. Run npm install or yarn install first." >&2
  exit 1
fi
if [ ! -d node_modules/ts-node ]; then
  echo "ERROR: ts-node is missing from node_modules. Run npm install or yarn install first." >&2
  exit 1
fi
export TS_NODE_PROJECT="${TS_NODE_PROJECT:-tsconfig.json}"
export TS_NODE_TRANSPILE_ONLY="${TS_NODE_TRANSPILE_ONLY:-true}"
# The repo tsconfig uses module=esnext for Next/browser builds. Force CommonJS for the Node/Mocha test process.
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}'
node \
  -r ts-node/register/transpile-only \
  -r tsconfig-paths/register \
  ./node_modules/mocha/bin/mocha \
  --no-config \
  --extension ts \
  --timeout 10000 \
  --slow 500 \
  src/shared/harthmere/test/mmo_guild_authority_v1.test.ts
