#!/usr/bin/env bash
set -euo pipefail

# GLITCH_PRODUCTION_STACK_PORT_FIX_V134
# One-container Glitch/Biomes stack runner.
# This intentionally keeps the public web ingress on 3000 and the internal sync
# websocket on 4900. Previous revisions let sync fall back to 4902 while the web
# same-origin proxy targeted 4900, which caused /sync ECONNREFUSED and
# early_context stalls.

APP_ROOT="${APP_ROOT:-/app}"
cd "$APP_ROOT"

export NODE_ENV="${NODE_ENV:-production}"
export NODE_OPTIONS="${NODE_OPTIONS:- --openssl-legacy-provider}"
export GLITCH_RUNTIME="${GLITCH_RUNTIME:-1}"
export GLITCH_LOCAL_ASSETS="${GLITCH_LOCAL_ASSETS:-1}"
export NEXT_PUBLIC_GLITCH_RUNTIME="${NEXT_PUBLIC_GLITCH_RUNTIME:-1}"
export NEXT_PUBLIC_GLITCH_LOCAL_ASSETS="${NEXT_PUBLIC_GLITCH_LOCAL_ASSETS:-1}"
export GLITCH_DISABLE_GCP="${GLITCH_DISABLE_GCP:-1}"
export GLITCH_SKIP_GCE_METADATA="${GLITCH_SKIP_GCE_METADATA:-1}"
export GLITCH_SKIP_GOOGLE_SECRETS="${GLITCH_SKIP_GOOGLE_SECRETS:-1}"
export GLITCH_DISABLE_DISCORD="${GLITCH_DISABLE_DISCORD:-1}"
export GLITCH_DISABLE_ASSET_MIRROR="${GLITCH_DISABLE_ASSET_MIRROR:-1}"
export GLITCH_SKIP_PROD_TRAY="${GLITCH_SKIP_PROD_TRAY:-1}"

export GLITCH_STORAGE_MODE="${GLITCH_STORAGE_MODE:-memory}"
export GLITCH_FIREHOSE_MODE="${GLITCH_FIREHOSE_MODE:-memory}"
export GLITCH_BISCUIT_MODE="${GLITCH_BISCUIT_MODE:-memory}"
export GLITCH_CHAT_API_MODE="${GLITCH_CHAT_API_MODE:-shim}"
export GLITCH_WORLD_API_MODE="${GLITCH_WORLD_API_MODE:-shim}"
export GLITCH_BIKKIE_CACHE_MODE="${GLITCH_BIKKIE_CACHE_MODE:-local}"
export GLITCH_SERVER_CACHE_MODE="${GLITCH_SERVER_CACHE_MODE:-local}"
export DISCOVERY_KIND="${DISCOVERY_KIND:-shim}"
export RO_SYNC="${RO_SYNC:-1}"

export GLITCH_SYNC_BIND_HOST="${GLITCH_SYNC_BIND_HOST:-0.0.0.0}"
export GLITCH_WEB_BIND_HOST="${GLITCH_WEB_BIND_HOST:-0.0.0.0}"
export SHIM_SERVICE_HOST="${SHIM_SERVICE_HOST:-127.0.0.1}"
export SHIM_SERVICE_PORT="${SHIM_SERVICE_PORT:-3104}"
export LOGIC_SERVICE_HOST="${LOGIC_SERVICE_HOST:-127.0.0.1}"
export LOGIC_SERVICE_PORT="${LOGIC_SERVICE_PORT:-3504}"
export OOB_SERVICE_HOST="${OOB_SERVICE_HOST:-127.0.0.1}"
export OOB_SERVICE_PORT="${OOB_SERVICE_PORT:-4704}"

# Important: this is the actual websocket port the sync server must bind to.
# Do not rely on BASE_PORT alone; the sync server can derive websocket=BASE+2
# when SYNC_PORT is unset.
export SYNC_PORT="${SYNC_PORT:-4900}"
export GLITCH_SYNC_WEBSOCKET_PORT="${GLITCH_SYNC_WEBSOCKET_PORT:-$SYNC_PORT}"
export GLITCH_SYNC_WS_PROXY_PORT="${GLITCH_SYNC_WS_PROXY_PORT:-$SYNC_PORT}"
export BASE_PORT="${BASE_PORT:-4900}"
export RPC_PORT="${RPC_PORT:-4904}"
export METRICS_PORT="${METRICS_PORT:-4901}"

WEB_BASE_PORT="${WEB_BASE_PORT:-3000}"
WEB_RPC_PORT="${WEB_RPC_PORT:-3004}"
WEB_METRICS_PORT="${WEB_METRICS_PORT:-3001}"
SYNC_BASE_URL="${NEXT_PUBLIC_GLITCH_SYNC_BASE_URL:-http://127.0.0.1:$SYNC_PORT}"
export NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$SYNC_BASE_URL"

COMMON_ARGS=(
  --storageMode "$GLITCH_STORAGE_MODE"
  --firehoseMode "$GLITCH_FIREHOSE_MODE"
  --biscuitMode "$GLITCH_BISCUIT_MODE"
  --chatApiMode "$GLITCH_CHAT_API_MODE"
  --worldApiMode "$GLITCH_WORLD_API_MODE"
  --bikkieCacheMode "$GLITCH_BIKKIE_CACHE_MODE"
  --serverCacheMode "$GLITCH_SERVER_CACHE_MODE"
)

PIDS=""
log() { printf '%s\n' "$*"; }

wait_tcp() {
  local host="$1"
  local port="$2"
  local name="$3"
  local tries="${4:-90}"
  local i
  for i in $(seq 1 "$tries"); do
    if node -e "const net=require('net');const s=net.connect(Number(process.argv[2]),process.argv[1]);s.setTimeout(750);s.on('connect',()=>{s.destroy();process.exit(0)});s.on('timeout',()=>process.exit(1));s.on('error',()=>process.exit(1));" "$host" "$port" >/dev/null 2>&1; then
      log "OK $name listening on $host:$port"
      return 0
    fi
    sleep 1
  done
  log "ERROR $name not listening on $host:$port" >&2
  return 1
}

start_bg() {
  local name="$1"
  local host="$2"
  local base="$3"
  local rpc="$4"
  local metrics="$5"
  local file="$6"
  shift 6

  log "START $name HOST=$host BASE_PORT=$base RPC_PORT=$rpc METRICS_PORT=$metrics file=$file"
  if [ "$name" = "sync" ]; then
    HOST="$host" BASE_PORT="$base" SYNC_PORT="$SYNC_PORT" GLITCH_SYNC_WEBSOCKET_PORT="$SYNC_PORT" RPC_PORT="$rpc" METRICS_PORT="$metrics" \
      node "$file" "$@" &
  else
    HOST="$host" BASE_PORT="$base" RPC_PORT="$rpc" METRICS_PORT="$metrics" \
      node "$file" "$@" &
  fi
  local pid="$!"
  PIDS="$PIDS $pid"
  log "PID $name=$pid"
}

cleanup() {
  log "Stopping Glitch local game stack: $PIDS"
  kill $PIDS 2>/dev/null || true
  wait $PIDS 2>/dev/null || true
}
trap cleanup INT TERM EXIT

log "Redis preflight host=${REDIS_HOST:-unset} port=${REDIS_PORT:-unset}"
log "Glitch local game stack v134"
log "  web: $WEB_BASE_PORT -> container app target 3000"
log "  sync websocket: $SYNC_PORT -> same-origin /sync proxy"
log "  sync rpc: $RPC_PORT"
log "  sync base: $NEXT_PUBLIC_GLITCH_SYNC_BASE_URL"

start_bg shim 127.0.0.1 3100 3104 3101 "$APP_ROOT/dist/shim.js" --bootstrapMode empty "${COMMON_ARGS[@]}"
start_bg oob 127.0.0.1 4700 4704 4701 "$APP_ROOT/dist/oob.js" "${COMMON_ARGS[@]}"
start_bg sync "$GLITCH_SYNC_BIND_HOST" "$BASE_PORT" "$RPC_PORT" "$METRICS_PORT" "$APP_ROOT/dist/sync.js" "${COMMON_ARGS[@]}"
start_bg logic 127.0.0.1 3500 3504 3501 "$APP_ROOT/dist/logic.js" "${COMMON_ARGS[@]}"

wait_tcp 127.0.0.1 3104 shim-rpc
wait_tcp 127.0.0.1 4704 oob-rpc
wait_tcp 127.0.0.1 3504 logic-rpc
wait_tcp 127.0.0.1 "$SYNC_PORT" sync-websocket-base
wait_tcp 127.0.0.1 "$RPC_PORT" sync-rpc

log "START web HOST=$GLITCH_WEB_BIND_HOST BASE_PORT=$WEB_BASE_PORT RPC_PORT=$WEB_RPC_PORT METRICS_PORT=$WEB_METRICS_PORT file=$APP_ROOT/dist/web.js"
HOST="$GLITCH_WEB_BIND_HOST" BASE_PORT="$WEB_BASE_PORT" RPC_PORT="$WEB_RPC_PORT" METRICS_PORT="$WEB_METRICS_PORT" \
  node "$APP_ROOT/dist/web.js" "${COMMON_ARGS[@]}" &
WEB_PID="$!"
PIDS="$PIDS $WEB_PID"
log "PID web=$WEB_PID"

wait_tcp 127.0.0.1 "$WEB_BASE_PORT" web-http
log "GLITCH_PRODUCTION_STACK_PORT_FIX_V134 ready web=$WEB_BASE_PORT sync=$SYNC_PORT rpc=$RPC_PORT"

# Keep PID 1 alive and fail the container if any core process exits.
while true; do
  for pid in $PIDS; do
    if ! kill -0 "$pid" 2>/dev/null; then
      log "ERROR process exited pid=$pid; failing container so Azure will restart a bad revision" >&2
      exit 1
    fi
  done
  sleep 5
done
