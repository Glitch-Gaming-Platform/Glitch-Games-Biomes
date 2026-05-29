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
# The embedded chat distributor only needs Redis + world state. Keep the
# single-container Glitch runtime from trying to reach unavailable cloud/Discord
# services when the production container is smoke-tested locally.
export GLITCH_DISABLE_GCP="${GLITCH_DISABLE_GCP:-1}"
export GLITCH_SKIP_GOOGLE_SECRETS="${GLITCH_SKIP_GOOGLE_SECRETS:-1}"
export GLITCH_DISABLE_DISCORD="${GLITCH_DISABLE_DISCORD:-1}"

start_next() {
  if [ -x node_modules/.bin/next ]; then
    node_modules/.bin/next start -H "$HOST" -p "$PORT"
    return $?
  fi

  if [ -f node_modules/next/dist/bin/next ]; then
    node node_modules/next/dist/bin/next start -H "$HOST" -p "$PORT"
    return $?
  fi

  echo "ERROR: Could not find Next.js runtime in node_modules." >&2
  return 70
}

CHAT_DISTRIBUTOR_PID=""
if [ "${GLITCH_ENABLE_CHAT_DISTRIBUTOR:-1}" = "1" ]; then
  echo "Starting embedded Glitch chat distributor for live world speech."
  GLITCH_CHAT_API_MODE="${GLITCH_CHAT_API_MODE:-redis}" \
    node -r ts-node/register -r tsconfig-paths/register src/server/chat/main.ts &
  CHAT_DISTRIBUTOR_PID="$!"
else
  echo "Embedded Glitch chat distributor disabled by GLITCH_ENABLE_CHAT_DISTRIBUTOR=${GLITCH_ENABLE_CHAT_DISTRIBUTOR:-}"
fi

cleanup_children() {
  if [ -n "${WEB_PID:-}" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  if [ -n "$CHAT_DISTRIBUTOR_PID" ] && kill -0 "$CHAT_DISTRIBUTOR_PID" 2>/dev/null; then
    kill "$CHAT_DISTRIBUTOR_PID" 2>/dev/null || true
  fi
}
trap cleanup_children INT TERM

start_next &
WEB_PID="$!"
wait "$WEB_PID"
STATUS="$?"
cleanup_children
exit "$STATUS"
