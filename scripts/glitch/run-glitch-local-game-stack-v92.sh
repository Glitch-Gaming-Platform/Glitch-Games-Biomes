#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export NODE_ENV="${NODE_ENV:-production}"
export GLITCH_RUNTIME="${GLITCH_RUNTIME:-1}"
export GLITCH_LOCAL_ASSETS="${GLITCH_LOCAL_ASSETS:-1}"
export NEXT_PUBLIC_GLITCH_RUNTIME="${NEXT_PUBLIC_GLITCH_RUNTIME:-1}"
export NEXT_PUBLIC_GLITCH_LOCAL_ASSETS="${NEXT_PUBLIC_GLITCH_LOCAL_ASSETS:-1}"
export NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="${NEXT_PUBLIC_GLITCH_SYNC_BASE_URL:-http://127.0.0.1:3018}"

export GLITCH_DISABLE_GCP="${GLITCH_DISABLE_GCP:-1}"
export GLITCH_DISABLE_DISCORD="${GLITCH_DISABLE_DISCORD:-1}"
export GLITCH_DISABLE_ASSET_MIRROR="${GLITCH_DISABLE_ASSET_MIRROR:-1}"
export GLITCH_SKIP_GCE_METADATA="${GLITCH_SKIP_GCE_METADATA:-1}"
export GLITCH_SKIP_GOOGLE_SECRETS="${GLITCH_SKIP_GOOGLE_SECRETS:-1}"
export GLITCH_SKIP_PROD_TRAY="${GLITCH_SKIP_PROD_TRAY:-1}"

export ALLOW_NON_K8_REDIS="${ALLOW_NON_K8_REDIS:-1}"
export USE_K8_REDIS="${USE_K8_REDIS:-0}"

# Use shim discovery inside this one-container local stack.
export DISCOVERY_KIND="${DISCOVERY_KIND:-shim}"
export SHIM_PORT="${SHIM_PORT:-3104}"

# Allow local read-only sync connections in production-mode Docker.
export RO_SYNC="${RO_SYNC:-1}"

# GLITCH_LOCAL_SERVICE_PORT_OVERRIDES_V93
export SHIM_SERVICE_HOST="${SHIM_SERVICE_HOST:-127.0.0.1}"
export SHIM_SERVICE_PORT="${SHIM_SERVICE_PORT:-3104}"
export LOGIC_SERVICE_HOST="${LOGIC_SERVICE_HOST:-127.0.0.1}"
export LOGIC_SERVICE_PORT="${LOGIC_SERVICE_PORT:-3504}"
export OOB_SERVICE_HOST="${OOB_SERVICE_HOST:-127.0.0.1}"
export OOB_SERVICE_PORT="${OOB_SERVICE_PORT:-4704}"

# GLITCH_REQUIRED_DIST_PREFLIGHT_V92
for required in /app/dist/shim.js /app/dist/oob.js /app/dist/sync.js /app/dist/logic.js /app/dist/web.js; do
  if [ ! -f "$required" ]; then
    echo "ERROR: Missing required runtime bundle: $required" >&2
    exit 82
  fi
done

COMMON_ARGS="
  --storageMode ${GLITCH_STORAGE_MODE:-memory}
  --firehoseMode ${GLITCH_FIREHOSE_MODE:-memory}
  --biscuitMode ${GLITCH_BISCUIT_MODE:-memory}
  --chatApiMode ${GLITCH_CHAT_API_MODE:-shim}
  --worldApiMode ${GLITCH_WORLD_API_MODE:-shim}
  --bikkieCacheMode ${GLITCH_BIKKIE_CACHE_MODE:-local}
  --serverCacheMode ${GLITCH_SERVER_CACHE_MODE:-local}
"

pids=""

start_service() {
  local name="$1"
  local base="$2"
  local rpc="$3"
  local metrics="$4"
  local file="$5"
  shift 5

  if [ ! -f "$file" ]; then
    echo "SKIP $name missing $file"
    return 0
  fi

  local bind_host="127.0.0.1"
  if [ "$name" = "sync" ]; then
    bind_host="${GLITCH_SYNC_BIND_HOST:-0.0.0.0}"
  fi

  echo "START $name HOST=$bind_host BASE_PORT=$base RPC_PORT=$rpc METRICS_PORT=$metrics file=$file"
  HOST="$bind_host" BASE_PORT="$base" RPC_PORT="$rpc" METRICS_PORT="$metrics" node "$file" "$@" &
  pids="$pids $!"
}

cleanup() {
  echo "Stopping services:$pids"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# GLITCH_REDIS_PREFLIGHT_V92
REDIS_HOST_EFFECTIVE="${REDIS_HOST:-${GLITCH_REDIS_HOST:-glitch-redis}}"
REDIS_PORT_EFFECTIVE="${REDIS_PORT:-${GLITCH_REDIS_PORT:-6379}}"

echo "Redis preflight host=$REDIS_HOST_EFFECTIVE port=$REDIS_PORT_EFFECTIVE"

if ! getent hosts "$REDIS_HOST_EFFECTIVE" >/dev/null 2>&1; then
  echo "ERROR: Redis host '$REDIS_HOST_EFFECTIVE' is not resolvable inside this container." >&2
  echo "Start Redis with:" >&2
  echo "docker network create glitch-dev 2>/dev/null || true" >&2
  echo "docker rm -f glitch-redis 2>/dev/null || true" >&2
  echo "docker run -d --name glitch-redis --network glitch-dev redis:7-alpine" >&2
  exit 81
fi

export REDIS_HOST="$REDIS_HOST_EFFECTIVE"
export REDIS_PORT="$REDIS_PORT_EFFECTIVE"
export GLITCH_REDIS_HOST="$REDIS_HOST_EFFECTIVE"
export GLITCH_REDIS_PORT="$REDIS_PORT_EFFECTIVE"

# GLITCH_REQUIRED_TITLE_ENV_V102_FROM_TRACE
# The boot trace showed GLITCH_TITLE_ID, GLITCH_TITLE_TOKEN, and GLITCH_API_BASE_URL
# were empty. That makes /api/glitch/harthmere return disabled:true and causes the
# client to fall back into Biomes login/register flow. Do not allow that.
for required_env in GLITCH_TITLE_ID GLITCH_TITLE_TOKEN GLITCH_API_BASE_URL; do
  if [ -z "${!required_env:-}" ]; then
    echo "ERROR: Missing required env var: $required_env" >&2
    echo "Set GLITCH_TITLE_ID, GLITCH_TITLE_TOKEN, and GLITCH_API_BASE_URL before starting Harthmere." >&2
    exit 83
  fi
done

echo "Glitch local game stack v92"
echo "  web: 3000 -> host 3017"
echo "  sync websocket: 4900 -> host 3018"
echo "  shim rpc: 3104"
echo "  sync base: $NEXT_PUBLIC_GLITCH_SYNC_BASE_URL"

start_service "shim" "3100" "3104" "3101" "/app/dist/shim.js" --bootstrapMode empty $COMMON_ARGS

OOB_PORT="${OOB_PORT:-4700}" \
  start_service "oob" "4700" "4704" "4701" "/app/dist/oob.js" $COMMON_ARGS

SYNC_PORT="${SYNC_PORT:-4900}" \
  echo "START sync HOST=${GLITCH_SYNC_BIND_HOST:-0.0.0.0} BASE_PORT=4900 RPC_PORT=4904 METRICS_PORT=4901 file=/app/dist/sync.js"
env -u SYNC_SERVICE_HOST -u SYNC_SERVICE_PORT \
  HOST="${GLITCH_SYNC_BIND_HOST:-0.0.0.0}" \
  SYNC_PORT="${SYNC_PORT:-4900}" \
  BASE_PORT="4900" \
  RPC_PORT="4904" \
  METRICS_PORT="4901" \
  node "/app/dist/sync.js" $COMMON_ARGS &
pids="$pids $!"

LOGIC_PORT="${LOGIC_PORT:-3500}" \
  start_service "logic" "3500" "3504" "3501" "/app/dist/logic.js" $COMMON_ARGS

# Do not start standalone bikkie here. In production mode it pulls Google Drive
# mirror / Galois asset paths and causes the GoogleAuth/numpy noise.

# GLITCH_WAIT_FOR_RUNTIME_PORTS_V93
wait_tcp() {
  local host="$1"
  local port="$2"
  local label="$3"

  python3 - "$host" "$port" "$label" <<'PYTCP'
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
label = sys.argv[3]
deadline = time.time() + 30
last = None

while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=1):
            print(f"OK {label} listening on {host}:{port}")
            raise SystemExit(0)
    except Exception as e:
        last = e
        time.sleep(0.5)

print(f"ERROR {label} not listening on {host}:{port}: {last}", file=sys.stderr)
raise SystemExit(84)
PYTCP
}

wait_tcp 127.0.0.1 3104 shim-rpc
wait_tcp 127.0.0.1 3504 logic-rpc
wait_tcp 127.0.0.1 4704 oob-rpc
# GLITCH_DEBUG_KEEP_ALIVE_ON_SYNC_FAIL_V94
if [ "${GLITCH_DEBUG_KEEP_ALIVE_ON_SYNC_FAIL:-0}" = "1" ]; then
  wait_tcp 127.0.0.1 4900 sync-websocket-base || true
  wait_tcp 127.0.0.1 4904 sync-rpc || true
else
  wait_tcp 127.0.0.1 4900 sync-websocket-base
  wait_tcp 127.0.0.1 4904 sync-rpc
fi

sleep 5

echo "START web BASE_PORT=3000 RPC_PORT=3004 METRICS_PORT=${METRICS_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}" \
BASE_PORT="${BASE_PORT:-3000}" \
RPC_PORT="${RPC_PORT:-3004}" \
HOST="${HOST:-0.0.0.0}" \
PORT="${PORT:-3000}" \
METRICS_PORT="${METRICS_PORT:-3001}" \
  exec node /app/dist/web.js $COMMON_ARGS
