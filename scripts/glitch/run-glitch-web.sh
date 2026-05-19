#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

PORT="${PORT:-${WEB_PORT:-3000}}"
HOST="${HOST:-0.0.0.0}"
GLITCH_REDIS_MODE="${GLITCH_REDIS_MODE:-external}"

echo "Glitch web start"
echo "  PORT=$PORT"
echo "  HOST=$HOST"
echo "  NODE_ENV=${NODE_ENV:-production}"
echo "  GLITCH_REDIS_MODE=$GLITCH_REDIS_MODE"

if [ "$GLITCH_REDIS_MODE" = "embedded" ]; then
  echo "ERROR: embedded Redis is not supported by the production Dockerfile.biomes image." >&2
  echo "Use a local/dev image with redis-server installed, or run Redis as a sidecar." >&2
  exit 66
fi

echo "Using external Redis. This container will not start or bootstrap redis-server."

export NODE_ENV="${NODE_ENV:-production}"
export PORT="$PORT"
export HOST="$HOST"

if [ -x node_modules/.bin/next ]; then
  exec node_modules/.bin/next start -H "$HOST" -p "$PORT"
fi

if [ -f node_modules/next/dist/bin/next ]; then
  exec node node_modules/next/dist/bin/next start -H "$HOST" -p "$PORT"
fi

echo "ERROR: Could not find Next.js runtime in node_modules." >&2
exit 70
