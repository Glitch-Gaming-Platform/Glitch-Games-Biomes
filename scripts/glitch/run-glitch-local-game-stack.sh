#!/usr/bin/env bash
set -euo pipefail

# GLITCH_PRODUCTION_STACK_PORT_FIX
# One-container Glitch/Biomes stack runner.
# This intentionally keeps the public web ingress on 3000 and the internal sync
# websocket on 4900. Previous revisions let sync fall back to 4902 while the web
# same-origin proxy targeted 4900, which caused /sync ECONNREFUSED and
# early_context stalls.

APP_ROOT="${APP_ROOT:-/app}"
cd "$APP_ROOT"

export GLITCH_STACK_ROLE="${GLITCH_STACK_ROLE:-unified}"
case "$GLITCH_STACK_ROLE" in
  unified)
    GLITCH_DEFAULT_CREATE_TERRAIN=1
    GLITCH_DEFAULT_STORAGE_MODE=shim
    GLITCH_DEFAULT_STREAM_WORKERS=1
    GLITCH_DEFAULT_ANIMA=1
    GLITCH_DEFAULT_GAIA=1
    ;;
  web)
    GLITCH_DEFAULT_CREATE_TERRAIN=0
    GLITCH_DEFAULT_STORAGE_MODE=shim
    GLITCH_DEFAULT_STREAM_WORKERS=1
    GLITCH_DEFAULT_ANIMA=0
    GLITCH_DEFAULT_GAIA=0
    ;;
  simulation)
    GLITCH_DEFAULT_CREATE_TERRAIN=0
    GLITCH_DEFAULT_STORAGE_MODE=memory
    GLITCH_DEFAULT_STREAM_WORKERS=0
    GLITCH_DEFAULT_ANIMA=1
    GLITCH_DEFAULT_GAIA=1
    ;;
  *)
    printf 'ERROR unknown GLITCH_STACK_ROLE=%s; expected unified, web, or simulation\n' "$GLITCH_STACK_ROLE" >&2
    exit 1
    ;;
esac

export NODE_ENV="${NODE_ENV:-production}"
export NODE_OPTIONS="${NODE_OPTIONS:---enable-source-maps}"
export GLITCH_RUNTIME="${GLITCH_RUNTIME:-1}"
export GLITCH_LOCAL_ASSETS="${GLITCH_LOCAL_ASSETS:-1}"
export NEXT_PUBLIC_GLITCH_RUNTIME="${NEXT_PUBLIC_GLITCH_RUNTIME:-1}"
export NEXT_PUBLIC_GLITCH_LOCAL_ASSETS="${NEXT_PUBLIC_GLITCH_LOCAL_ASSETS:-1}"
export GLITCH_DISABLE_GCP="${GLITCH_DISABLE_GCP:-1}"
export LOCAL_GCS="${LOCAL_GCS:-1}"
export GCS_LOCAL_DISK="${GCS_LOCAL_DISK:-1}"
export GLITCH_FORCE_LOCAL_PLAYER_MESH="${GLITCH_FORCE_LOCAL_PLAYER_MESH:-1}"
export GLITCH_SKIP_GCE_METADATA="${GLITCH_SKIP_GCE_METADATA:-1}"
export GLITCH_SKIP_GOOGLE_SECRETS="${GLITCH_SKIP_GOOGLE_SECRETS:-1}"
export GLITCH_DISABLE_DISCORD="${GLITCH_DISABLE_DISCORD:-1}"
export GLITCH_DISABLE_ASSET_MIRROR="${GLITCH_DISABLE_ASSET_MIRROR:-1}"
export GLITCH_SKIP_PROD_TRAY="${GLITCH_SKIP_PROD_TRAY:-1}"
export SKIP_PROD_LOAD="${SKIP_PROD_LOAD:-true}"
export SKIP_MISSING_ASSET_CHECK="${SKIP_MISSING_ASSET_CHECK:-true}"
export BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="${BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN:-1}"
export BIOMES_FORCE_LOCAL_DEV_TOWN="${BIOMES_FORCE_LOCAL_DEV_TOWN:-0}"
export BIOMES_CREATE_LOCAL_DEV_TERRAIN="${BIOMES_CREATE_LOCAL_DEV_TERRAIN:-$GLITCH_DEFAULT_CREATE_TERRAIN}"
export BIOMES_START_IN_HARTHMERE="${BIOMES_START_IN_HARTHMERE:-0}"
export NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="${NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN:-$BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN}"
export NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN="${NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN:-$BIOMES_FORCE_LOCAL_DEV_TOWN}"
export NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE="${NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE:-$BIOMES_START_IN_HARTHMERE}"
export BIOMES_SNAPSHOT_MERGE_MODE="${BIOMES_SNAPSHOT_MERGE_MODE:-1}"
export NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE="${NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE:-1}"
export GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER="${GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER:-1}"
export BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE="${BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE:-1}"
export NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE="${NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE:-1}"
export NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X="${NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X:-${BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X:-1600}}"
export NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z="${NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z:-${BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z:-0}}"

export GLITCH_SHIM_STORAGE_MODE="${GLITCH_SHIM_STORAGE_MODE:-memory}"
export GLITCH_STORAGE_MODE="${GLITCH_STORAGE_MODE:-$GLITCH_DEFAULT_STORAGE_MODE}"
export GLITCH_FIREHOSE_MODE="${GLITCH_FIREHOSE_MODE:-redis}"
export GLITCH_BISCUIT_MODE="${GLITCH_BISCUIT_MODE:-redis2}"
export GLITCH_CHAT_API_MODE="${GLITCH_CHAT_API_MODE:-redis}"
export GLITCH_WORLD_API_MODE="${GLITCH_WORLD_API_MODE:-hfc-hybrid}"
export GLITCH_BIKKIE_CACHE_MODE="${GLITCH_BIKKIE_CACHE_MODE:-redis}"
export GLITCH_SERVER_CACHE_MODE="${GLITCH_SERVER_CACHE_MODE:-local}"
export DISCOVERY_KIND="${DISCOVERY_KIND:-shim}"
export RO_SYNC="${RO_SYNC:-1}"
export GLITCH_REDIS_MODE="${GLITCH_REDIS_MODE:-external}"
if [ -z "${DISTRIBUTED_NOTIFIER_KIND:-}" ]; then
  if [ "$GLITCH_REDIS_MODE" = "external" ]; then
    export DISTRIBUTED_NOTIFIER_KIND=redis
  else
    export DISTRIBUTED_NOTIFIER_KIND=shim
  fi
fi
export GLITCH_ENABLE_STREAM_WORKERS="${GLITCH_ENABLE_STREAM_WORKERS:-$GLITCH_DEFAULT_STREAM_WORKERS}"
export GLITCH_ENABLE_SINK_WORKER="${GLITCH_ENABLE_SINK_WORKER:-0}"
export GLITCH_FOCUSED_NATIVE_E2E_STACK="${GLITCH_FOCUSED_NATIVE_E2E_STACK:-0}"
if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" = "1" ]; then
  # Logic already owns the authoritative event replica. Install Ask's indexes
  # and RPC surface there so focused browser gates do not pay for a duplicate
  # 2.5 GiB Ask replica. Production and full rehearsals retain separate Ask.
  export GLITCH_EMBED_ASK_IN_LOGIC=1
fi

# Anima is the authoritative native-ECS NPC simulation service. Without it,
# NPC entities still render and retain health bars because sync can read their
# seeded ECS records, but nothing advances their behavior state: they do not
# acquire players, chase, retaliate, swing, or write movement updates. Keep it
# enabled by default in the unified stack and retain an explicit kill switch for
# recovery work where operators intentionally need a motionless world.
export GLITCH_ENABLE_ANIMA="${GLITCH_ENABLE_ANIMA:-$GLITCH_DEFAULT_ANIMA}"

# A single local or dedicated simulation stack starts Anima immediately. Keep
# the Redis candidate barrier available for future multi-replica simulation
# deployments so workers can begin distributed shard ownership together.
export GLITCH_ANIMA_STARTUP_CANDIDATES="${GLITCH_ANIMA_STARTUP_CANDIDATES:-1}"
export GLITCH_ANIMA_CANDIDATE_TTL_SECONDS="${GLITCH_ANIMA_CANDIDATE_TTL_SECONDS:-45}"

# Production co-locates many Node services in one 16 GiB container. Anima's
# terrain/replica initialization can otherwise consume the remaining headroom
# even after shard ownership is balanced. Keep its V8 heap bounded separately
# from the larger web heap; native/WASM allocations remain outside this cap.
export GLITCH_ANIMA_MAX_OLD_SPACE_MB="${GLITCH_ANIMA_MAX_OLD_SPACE_MB:-2048}"

# Gaia owns asynchronous native-world simulations.  Farming handlers enqueue
# player actions on plant entities; Gaia consumes those actions, mutates/removes
# the plant, and creates the authoritative harvest drop.  A stack without Gaia
# can accept HarvestPlantEvent while never delivering its world result.
export GLITCH_ENABLE_GAIA="${GLITCH_ENABLE_GAIA:-$GLITCH_DEFAULT_GAIA}"
export GLITCH_GAIA_WASM_MEMORY_MB="${GLITCH_GAIA_WASM_MEMORY_MB:-4096}"
export GLITCH_WEB_MAX_OLD_SPACE_MB="${GLITCH_WEB_MAX_OLD_SPACE_MB:-6144}"

export GLITCH_SIMULATION_BIND_HOST="${GLITCH_SIMULATION_BIND_HOST:-0.0.0.0}"
export GLITCH_SIMULATION_HEALTH_PORT="${GLITCH_SIMULATION_HEALTH_PORT:-3000}"

export GLITCH_SYNC_BIND_HOST="${GLITCH_SYNC_BIND_HOST:-0.0.0.0}"
export GLITCH_WEB_BIND_HOST="${GLITCH_WEB_BIND_HOST:-0.0.0.0}"
export SHIM_SERVICE_HOST="${SHIM_SERVICE_HOST:-127.0.0.1}"
export SHIM_SERVICE_PORT="${SHIM_SERVICE_PORT:-3104}"
export ASK_SERVICE_HOST="${ASK_SERVICE_HOST:-127.0.0.1}"
export ASK_SERVICE_PORT="${ASK_SERVICE_PORT:-3604}"
export LOGIC_SERVICE_HOST="${LOGIC_SERVICE_HOST:-127.0.0.1}"
export LOGIC_SERVICE_PORT="${LOGIC_SERVICE_PORT:-3504}"
export OOB_SERVICE_HOST="${OOB_SERVICE_HOST:-127.0.0.1}"
export OOB_SERVICE_PORT="${OOB_SERVICE_PORT:-4704}"
export SYNC_SERVICE_PORT="${SYNC_SERVICE_PORT:-4904}"

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

RUNTIME_ARGS=(
  --firehoseMode "$GLITCH_FIREHOSE_MODE"
  --biscuitMode "$GLITCH_BISCUIT_MODE"
  --chatApiMode "$GLITCH_CHAT_API_MODE"
  --worldApiMode "$GLITCH_WORLD_API_MODE"
  --bikkieCacheMode "$GLITCH_BIKKIE_CACHE_MODE"
  --serverCacheMode "$GLITCH_SERVER_CACHE_MODE"
)
SHIM_ARGS=(--storageMode "$GLITCH_SHIM_STORAGE_MODE" "${RUNTIME_ARGS[@]}")
SERVICE_ARGS=(--storageMode "$GLITCH_STORAGE_MODE" "${RUNTIME_ARGS[@]}")

PIDS=""
log() { printf '%s\n' "$*"; }

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    log "ERROR missing required env $name for Glitch install validation" >&2
    return 1
  fi
}

redis_configured_host() {
  printf '%s' "${GLITCH_REDIS_HOST:-${LOCAL_REDIS_HOST:-${REDIS_HOST:-}}}"
}

redis_runtime_requested() {
  if [ "${DISTRIBUTED_NOTIFIER_KIND:-shim}" = "redis" ]; then
    return 0
  fi

  case " ${GLITCH_FIREHOSE_MODE:-} ${GLITCH_BISCUIT_MODE:-} ${GLITCH_CHAT_API_MODE:-} ${GLITCH_WORLD_API_MODE:-} ${GLITCH_BIKKIE_CACHE_MODE:-} ${GLITCH_SERVER_CACHE_MODE:-} " in
    *redis*|*hfc-hybrid*)
      return 0
      ;;
  esac

  return 1
}

normalize_redis_env() {
  local host="$1"
  local port="$2"

  export REDIS_HOST="$host"
  export GLITCH_REDIS_HOST="$host"
  export LOCAL_REDIS_HOST="$host"
  export REDIS_PORT="$port"
  export GLITCH_REDIS_PORT="${GLITCH_REDIS_PORT:-$port}"
  export LOCAL_REDIS_PORT="${LOCAL_REDIS_PORT:-$port}"
}

wait_tcp() {
  local host="$1"
  local port="$2"
  local name="$3"
  local default_tries=300
  if [ "${GLITCH_FOCUSED_NATIVE_E2E_STACK:-0}" = "1" ]; then
    # The restored production-shaped Redis world currently exceeds 300k ECS
    # rows. Web/trigger can legitimately spend more than five minutes loading
    # it before opening their listeners. The old default killed the otherwise
    # healthy unified stack and forced every browser batch to start over.
    default_tries=1800
  fi
  local tries="${4:-${GLITCH_STACK_TCP_WAIT_TRIES:-$default_tries}}"
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

wait_http_ready() {
  local host="$1"
  local port="$2"
  local name="$3"
  local tries="${4:-${GLITCH_STACK_HTTP_READY_WAIT_TRIES:-120}}"
  local i
  for i in $(seq 1 "$tries"); do
    if node -e "const http=require('http');const req=http.get({host:process.argv[1],port:Number(process.argv[2]),path:'/ready',timeout:750},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on('timeout',()=>{req.destroy();process.exit(1)});req.on('error',()=>process.exit(1));" "$host" "$port" >/dev/null 2>&1; then
      log "OK $name ready on http://$host:$port/ready"
      return 0
    fi
    sleep 1
  done
  log "ERROR $name not ready on http://$host:$port/ready" >&2
  return 1
}

wait_redis_stream_group() {
  local db="$1"
  local stream="$2"
  local group="$3"
  local name="$4"
  local tries="${5:-${GLITCH_STACK_REDIS_GROUP_WAIT_TRIES:-120}}"
  local i
  for i in $(seq 1 "$tries"); do
    if redis_cli_runtime -n "$db" XINFO GROUPS "$stream" 2>/dev/null | grep -Fq "$group"; then
      log "OK $name Redis consumer group db=$db stream=$stream group=$group"
      return 0
    fi
    sleep 1
  done
  log "ERROR $name Redis consumer group missing db=$db stream=$stream group=$group" >&2
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
  if [ "$name" = "shim" ]; then
    GLITCH_STORAGE_MODE="$GLITCH_SHIM_STORAGE_MODE" HOST="$host" BASE_PORT="$base" RPC_PORT="$rpc" METRICS_PORT="$metrics" \
      node "$file" "$@" &
  elif [ "$name" = "sync" ]; then
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
  # The Anima startup barrier uses one expiring Redis key per replica. Delete
  # ours eagerly during an ordinary shutdown; the TTL remains the safety net for
  # hard node loss where this trap cannot run.
  if [ -n "${ANIMA_CANDIDATE_KEY:-}" ] && command -v redis-cli >/dev/null 2>&1; then
    redis-cli -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" -n 6 \
      DEL "$ANIMA_CANDIDATE_KEY" >/dev/null 2>&1 || true
  fi
  log "Stopping Glitch local game stack: $PIDS"
  kill $PIDS 2>/dev/null || true
  wait $PIDS 2>/dev/null || true
}
trap cleanup INT TERM EXIT

require_env GLITCH_TITLE_ID
require_env GLITCH_API_BASE_URL
if [ "$GLITCH_STACK_ROLE" != "simulation" ]; then
  require_env GLITCH_TITLE_TOKEN
fi

# July 2026 production telemetry showed the public stack at 11-12 GiB before
# simulation startup and roughly 15.1 GiB after Anima/Gaia joined a 16 GiB
# replica. Keep this as a hard runtime guard: a stale Azure environment variable
# must not be able to recreate the node-pressure eviction incident.
if [ "$GLITCH_STACK_ROLE" = "web" ] &&
   { [ "$GLITCH_ENABLE_ANIMA" != "0" ] || [ "$GLITCH_ENABLE_GAIA" != "0" ]; }; then
  log "ERROR GLITCH_STACK_ROLE=web requires GLITCH_ENABLE_ANIMA=0 and GLITCH_ENABLE_GAIA=0; deploy simulations in the dedicated simulation Container App" >&2
  exit 1
fi

if [ "$GLITCH_STACK_ROLE" = "simulation" ] &&
   { [ "$GLITCH_ENABLE_ANIMA" != "1" ] || [ "$GLITCH_ENABLE_GAIA" != "1" ]; }; then
  log "ERROR GLITCH_STACK_ROLE=simulation requires both Anima and Gaia" >&2
  exit 1
fi

start_redis_if_needed() {
  local mode="$GLITCH_REDIS_MODE"
  local host
  host="$(redis_configured_host)"
  local port="${GLITCH_REDIS_PORT:-${LOCAL_REDIS_PORT:-${REDIS_PORT:-6379}}}"

  case "$mode" in
    auto|embedded|external|disabled)
      ;;
    *)
      log "ERROR unknown GLITCH_REDIS_MODE=$mode; expected auto, embedded, external, or disabled" >&2
      return 1
      ;;
  esac

  if [ "$mode" = "disabled" ]; then
    log "Redis disabled by GLITCH_REDIS_MODE=disabled"
    return 0
  fi

  if [ -n "$host" ]; then
    normalize_redis_env "$host" "$port"
    log "Redis external configured host=$REDIS_HOST port=$REDIS_PORT mode=$mode"
    wait_tcp "$REDIS_HOST" "$REDIS_PORT" redis-external 45
    return 0
  fi

  if [ "$mode" = "external" ]; then
    log "ERROR GLITCH_REDIS_MODE=external but no REDIS_HOST, GLITCH_REDIS_HOST, or LOCAL_REDIS_HOST is set" >&2
    return 1
  fi

  if [ "$mode" = "embedded" ] || redis_runtime_requested; then
    if ! command -v redis-server >/dev/null 2>&1; then
      log "ERROR embedded Redis requested but redis-server is not installed in this image" >&2
      return 1
    fi

    normalize_redis_env 127.0.0.1 "${REDIS_PORT:-6379}"
    log "START redis embedded HOST=$REDIS_HOST PORT=$REDIS_PORT mode=$mode GLITCH_PROD_LOCAL_PARITY"
    redis-server \
      --bind 127.0.0.1 \
      --port "$REDIS_PORT" \
      --save "" \
      --appendonly no \
      --protected-mode yes &
    local redis_pid="$!"
    PIDS="$PIDS $redis_pid"
    log "PID redis=$redis_pid"
    wait_tcp 127.0.0.1 "$REDIS_PORT" redis-embedded 45
    return 0
  fi

  log "Redis not started: shim/memory runtime does not need Redis (mode=$mode)"
}

start_redis_if_needed

redis_cli_runtime() {
  redis-cli -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" "$@"
}

wait_anima_startup_barrier() {
  local required="$GLITCH_ANIMA_STARTUP_CANDIDATES"
  if [ "$required" -le 1 ] 2>/dev/null; then
    log "Anima startup barrier disabled for single-replica stack (required=$required)."
    return 0
  fi

  # Existing web/sync services can make a replica look healthy before its Anima
  # process starts. Publish a separate short lease only after this runner has
  # reached the Anima launch point. Redis SET EX remains a single atomic lease
  # on production Redis 8.8.1 and automatically removes a candidate when its
  # node disappears. Database 6 is reserved for service discovery.
  local candidate_id="${HOSTNAME:-$(hostname)}"
  local candidate_prefix="glitch:anima-hotfix:candidate:"
  local candidate_key="${candidate_prefix}${candidate_id}"
  local ttl="$GLITCH_ANIMA_CANDIDATE_TTL_SECONDS"
  local candidate_count
  ANIMA_CANDIDATE_KEY="$candidate_key"

  (
    while true; do
      redis_cli_runtime -n 6 SET "$candidate_key" "$(date +%s)" EX "$ttl" \
        >/dev/null 2>&1 || true
      sleep 5
    done
  ) &
  local heartbeat_pid="$!"
  PIDS="$PIDS $heartbeat_pid"
  log "PID anima-startup-candidate-heartbeat=$heartbeat_pid key=$candidate_key ttl=${ttl}s"

  # Publish synchronously once so the barrier does not depend on when the
  # background heartbeat receives its first scheduling slice.
  redis_cli_runtime -n 6 SET "$candidate_key" "$(date +%s)" EX "$ttl" \
    >/dev/null 2>&1 || true
  log "Anima candidate $candidate_id waiting for $required ready replicas."
  while true; do
    candidate_count="$(
      redis_cli_runtime -n 6 --scan --pattern "${candidate_prefix}*" 2>/dev/null \
        | wc -l | tr -d ' '
    )"
    if [ "${candidate_count:-0}" -ge "$required" ] 2>/dev/null; then
      log "Anima startup barrier satisfied: candidates=$candidate_count required=$required."
      break
    fi
    sleep 2
  done

  # Give every candidate one heartbeat interval to observe the satisfied
  # barrier. This prevents the first observer from beginning a full-shard
  # initialization while another replica is still between Redis SCAN polls.
  sleep 6
}

snapshot_backup_hash() {
  node -e "const fs=require('fs');const crypto=require('crypto');const p=process.argv[1];process.stdout.write(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'))" "$APP_ROOT/snapshot_backup.json"
}

snapshot_redis_hash_key() {
  printf 'biomes:%s:snapshot_hash' "${GLITCH_TITLE_ID:-default}"
}

snapshot_redis_lock_key() {
  printf 'biomes:%s:snapshot_bootstrap_lock' "${GLITCH_TITLE_ID:-default}"
}

snapshot_redis_required_seed_status() {
  local dbsize
  local required_count
  dbsize="$(redis_cli_runtime dbsize 2>/dev/null || true)"
  required_count="$(
    redis_cli_runtime exists \
      b:8810000000019301 \
      b:8810000000019401 \
      b:8810000000019451 2>/dev/null || true
  )"
  printf '%s %s' "${dbsize:-0}" "${required_count:-0}"
}

snapshot_redis_required_seeds_present() {
  local status dbsize required_count
  status="$(snapshot_redis_required_seed_status)"
  dbsize="${status%% *}"
  required_count="${status##* }"
  [ "${dbsize:-0}" -ge 1000 ] && [ "${required_count:-0}" -ge 3 ]
}

is_external_redis_runtime() {
  [ "$GLITCH_REDIS_MODE" = "external" ] || [ "$(redis_configured_host)" != "127.0.0.1" ]
}

snapshot_redis_populate_requested() {
  if [ -n "${GLITCH_POPULATE_SNAPSHOT_REDIS+x}" ]; then
    [ "$GLITCH_POPULATE_SNAPSHOT_REDIS" = "1" ]
    return
  fi
  ! is_external_redis_runtime
}

wait_for_snapshot_redis_hash() {
  local expected_hash="$1"
  local hash_key="$2"
  local wait_seconds="${GLITCH_SNAPSHOT_REDIS_WAIT_SECONDS:-120}"
  local i
  for i in $(seq 1 "$wait_seconds"); do
    if [ "$(redis_cli_runtime get "$hash_key" 2>/dev/null || true)" = "$expected_hash" ]; then
      log "Redis snapshot hash appeared while waiting for bootstrap."
      return 0
    fi
    sleep 1
  done
  return 1
}

ensure_snapshot_redis_populated() {
  case " ${GLITCH_WORLD_API_MODE:-} ${GLITCH_BISCUIT_MODE:-} " in
    *hfc-hybrid*|*redis*)
      ;;
    *)
      log "Snapshot Redis populate skipped: world/bikkie modes do not need Redis snapshot data"
      return 0
      ;;
  esac

  if [ ! -f "$APP_ROOT/snapshot_backup.json" ]; then
    log "ERROR snapshot_backup.json is missing; production hfc-hybrid runtime cannot match local data-snapshot run" >&2
    return 1
  fi

  local installed_hash
  local bootstrapped_hash
  local hash_key
  installed_hash="$(snapshot_backup_hash)"
  hash_key="$(snapshot_redis_hash_key)"
  bootstrapped_hash="$(redis_cli_runtime get "$hash_key" 2>/dev/null || true)"
  if [ -z "$bootstrapped_hash" ]; then
    bootstrapped_hash="$(redis_cli_runtime get biomes_data_snapshot_hash 2>/dev/null || true)"
    if [ "$installed_hash" = "$bootstrapped_hash" ]; then
      redis_cli_runtime set "$hash_key" "$installed_hash" >/dev/null
    fi
  fi
  if [ "$installed_hash" = "$bootstrapped_hash" ]; then
    if ! snapshot_redis_required_seeds_present; then
      local status dbsize required_count
      status="$(snapshot_redis_required_seed_status)"
      dbsize="${status%% *}"
      required_count="${status##* }"
      log "ERROR Redis snapshot hash matches but required bootstrap world data is missing: dbsize=$dbsize required_seed_keys_present=$required_count/3. Run the explicit bootstrap job with GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1, GLITCH_POPULATE_SNAPSHOT_REDIS=1, and GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1 before app replicas." >&2
      return 1
    fi
    log "Redis is already populated with the installed snapshot data."
    return 0
  fi

  if ! snapshot_redis_populate_requested; then
    local status dbsize required_count
    status="$(snapshot_redis_required_seed_status)"
    dbsize="${status%% *}"
    required_count="${status##* }"
    log "Snapshot Redis populate skipped for external production Redis hash=$installed_hash previous=${bootstrapped_hash:-missing} key=$hash_key dbsize=$dbsize required_seed_keys_present=$required_count/3"
    if [ "${GLITCH_REQUIRE_SNAPSHOT_REDIS:-1}" = "1" ]; then
      log "ERROR production Redis is not loaded with this image's snapshot. Run the explicit bootstrap job with GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1, GLITCH_POPULATE_SNAPSHOT_REDIS=1, and GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1 before deploying app replicas." >&2
      return 1
    fi
    return 0
  fi

  if is_external_redis_runtime; then
    if [ "${GLITCH_SNAPSHOT_BOOTSTRAP_ROLE:-0}" != "1" ]; then
      log "ERROR refusing to populate external production Redis from normal app startup. Set GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1 only on the one-time bootstrap job." >&2
      return 1
    fi
    if [ "${GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH:-0}" != "1" ]; then
      log "ERROR refusing to flush external production Redis without GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1." >&2
      return 1
    fi
  fi

  local lock_key
  local lock_value
  local lock_status
  lock_key="$(snapshot_redis_lock_key)"
  lock_value="${HOSTNAME:-biomes}:$$:$installed_hash"
  lock_status="$(redis_cli_runtime set "$lock_key" "$lock_value" NX EX "${GLITCH_SNAPSHOT_REDIS_LOCK_TTL_SECONDS:-1800}" 2>/dev/null || true)"
  if [ "$lock_status" != "OK" ]; then
    log "Another snapshot Redis bootstrap appears to hold $lock_key; waiting for hash=$installed_hash"
    wait_for_snapshot_redis_hash "$installed_hash" "$hash_key"
    return $?
  fi

  log "Populating Redis with installed snapshot data hash=$installed_hash previous=${bootstrapped_hash:-missing} key=$hash_key GLITCH_PROD_SNAPSHOT_REDIS_BOOTSTRAP"
  redis_cli_runtime flushall
  if [ ! -f "$APP_ROOT/dist/bootstrap-redis.js" ]; then
    log "ERROR dist/bootstrap-redis.js is missing from the production image." >&2
    return 1
  fi
  SKIP_PROD_LOAD=true node "$APP_ROOT/dist/bootstrap-redis.js" "$APP_ROOT/snapshot_backup.json"
  redis_cli_runtime set "$hash_key" "$installed_hash"
  redis_cli_runtime set biomes_data_snapshot_hash "$installed_hash"
  redis_cli_runtime del "$lock_key" >/dev/null || true
  if ! is_external_redis_runtime && [ "${GLITCH_EMBEDDED_REDIS_SAVE_AFTER_BOOTSTRAP:-0}" = "1" ]; then
    redis_cli_runtime save || true
  fi
  log "Done populating Redis with installed snapshot data."
}

ensure_snapshot_redis_populated

apply_mutable_hotfix() {
  if [ "${GLITCH_MUTABLE_HOTFIX_ENABLED:-0}" != "1" ] && [ "${GLITCH_MUTABLE_HOTFIX_OPEN:-0}" != "1" ]; then
    return 0
  fi

  log "Applying Glitch mutable hotfix before stack startup."
  if [ ! -f "$APP_ROOT/dist/apply-mutable-hotfix.js" ]; then
    log "ERROR dist/apply-mutable-hotfix.js is missing from the production image." >&2
    return 1
  fi
  node "$APP_ROOT/dist/apply-mutable-hotfix.js"
}

apply_mutable_hotfix

start_mutable_hotfix_watcher() {
  if [ "${GLITCH_MUTABLE_HOTFIX_ENABLED:-0}" != "1" ] && [ "${GLITCH_MUTABLE_HOTFIX_OPEN:-0}" != "1" ]; then
    return 0
  fi
  if [ "${GLITCH_MUTABLE_HOTFIX_WATCH_ENABLED:-1}" != "1" ]; then
    log "Mutable hotfix watcher disabled by GLITCH_MUTABLE_HOTFIX_WATCH_ENABLED."
    return 0
  fi

  log "Starting Glitch mutable hotfix watcher for role=$GLITCH_STACK_ROLE."
  node "$APP_ROOT/dist/apply-mutable-hotfix.js" --watch &
  local pid="$!"
  PIDS="$PIDS $pid"
  log "PID mutable-hotfix-watcher=$pid"
}

start_mutable_hotfix_watcher

start_anima_worker() {
  local galois_prefix="${GALOIS_STATIC_PREFIX:-}"
  if [ -z "$galois_prefix" ]; then
    if [ "$GLITCH_STACK_ROLE" = "simulation" ]; then
      if [ -z "${GLITCH_PUBLIC_WEB_ORIGIN:-}" ]; then
        log "ERROR simulation role requires GALOIS_STATIC_PREFIX or GLITCH_PUBLIC_WEB_ORIGIN" >&2
        return 1
      fi
      galois_prefix="${GLITCH_PUBLIC_WEB_ORIGIN%/}/buckets/biomes-static/"
    else
      galois_prefix="http://127.0.0.1:$WEB_BASE_PORT/buckets/biomes-static/"
    fi
  fi

  # `SHARD_MANAGER_KIND=distributed` and Redis discovery prevent duplicate NPC
  # simulation. HFC writes are mandatory because locomotion and combat are
  # high-frequency state consumed by sync from the Redis-backed world API.
  wait_anima_startup_barrier
  GALOIS_STATIC_PREFIX="$galois_prefix" \
    DISCOVERY_KIND=redis SHARD_MANAGER_KIND=distributed ANIMA_HFC_WRITES=1 \
    NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=$GLITCH_ANIMA_MAX_OLD_SPACE_MB" \
    start_bg anima 127.0.0.1 4100 4104 4101 "$APP_ROOT/dist/anima.js" "${SERVICE_ARGS[@]}"
  wait_http_ready 127.0.0.1 4101 anima
}

start_gaia_worker() {
  local gaia_domain="${GAIA_SHARD_DOMAIN:-}"
  if [ -z "$gaia_domain" ]; then
    if [ "$GLITCH_STACK_ROLE" = "simulation" ]; then
      gaia_domain=gaia-harthmere-simulation
    else
      gaia_domain=gaia-harthmere-unified
    fi
  fi

  # Gaia has a separate shard-manager domain from Anima and an explicit WASM
  # memory budget. The dedicated simulation container has room for this native
  # allocation without taking memory away from public HTTP and sync processes.
  DISCOVERY_KIND=redis SHARD_MANAGER_KIND=distributed \
    GAIA_SHARD_DOMAIN="$gaia_domain" \
    WASM_MEMORY="$GLITCH_GAIA_WASM_MEMORY_MB" \
    start_bg gaia 127.0.0.1 4200 4204 4201 "$APP_ROOT/dist/gaia.js" "${SERVICE_ARGS[@]}"
  wait_http_ready 127.0.0.1 4201 gaia
}

supervise_processes() {
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
}

if [ "$GLITCH_STACK_ROLE" = "simulation" ]; then
  log "Glitch dedicated simulation stack"
  log "  health: $GLITCH_SIMULATION_HEALTH_PORT"
  log "  npc simulation: anima=$GLITCH_ENABLE_ANIMA heapMb=$GLITCH_ANIMA_MAX_OLD_SPACE_MB"
  log "  world simulation: gaia=$GLITCH_ENABLE_GAIA wasmMemoryMb=$GLITCH_GAIA_WASM_MEMORY_MB"

  # Open the Container App target port before native terrain initialization.
  # `/ready` remains 503 until both workers are actually ready, so Azure sees
  # the correct listening port without receiving a false-positive health signal.
  start_bg simulation-health "$GLITCH_SIMULATION_BIND_HOST" "$GLITCH_SIMULATION_HEALTH_PORT" 0 0 \
    "$APP_ROOT/scripts/glitch/simulation-health-server.cjs"
  wait_tcp 127.0.0.1 "$GLITCH_SIMULATION_HEALTH_PORT" simulation-health-http

  # Anima's shared server context requires the Logic RPC API and waits on
  # /logic/ping before it can build its world replica. Keep Logic local to the
  # worker container so simulation does not depend on a public web replica.
  start_bg logic 127.0.0.1 3500 3504 3501 "$APP_ROOT/dist/logic.js" "${SERVICE_ARGS[@]}"
  wait_http_ready 127.0.0.1 3501 simulation-logic

  start_anima_worker
  start_gaia_worker
  wait_http_ready 127.0.0.1 "$GLITCH_SIMULATION_HEALTH_PORT" simulation-stack
  log "GLITCH_SIMULATION_ROLE_READY anima=1 gaia=1 healthPort=$GLITCH_SIMULATION_HEALTH_PORT"
  supervise_processes
fi

log "Redis preflight host=${REDIS_HOST:-unset} port=${REDIS_PORT:-unset} mode=$GLITCH_REDIS_MODE notifier=$DISTRIBUTED_NOTIFIER_KIND"
log "Glitch local game stack"
log "  role: $GLITCH_STACK_ROLE"
log "  web: $WEB_BASE_PORT -> container app target 3000"
log "  sync websocket: $SYNC_PORT -> same-origin /sync proxy"
log "  sync rpc: $RPC_PORT"
log "  chat distributor: 3300/3301"
log "  stream workers: trigger/notify=$GLITCH_ENABLE_STREAM_WORKERS sink=$GLITCH_ENABLE_SINK_WORKER"
log "  focused native E2E services: $GLITCH_FOCUSED_NATIVE_E2E_STACK"
log "  npc simulation: anima=$GLITCH_ENABLE_ANIMA"
log "  world simulation: gaia=$GLITCH_ENABLE_GAIA"
log "  sync base: $NEXT_PUBLIC_GLITCH_SYNC_BASE_URL"

# FOCUSED_E2E_EMPTY_SHIM_BOOT (2026-07-26): focused stacks use Redis/HFC for
# world, firehose, Bikkie, chat, and server cache. Shim supplies discovery and
# lightweight in-memory coordination only; loading the entire 300k+ ECS world
# into its unused bootstrap/player-spatial tables added several cold-start
# minutes before Logic/Sync/Trigger could even begin. Keep full sync bootstrap
# for ordinary unified rehearsals, but use the explicit empty mode and skip the
# unused shim chat observer in focused native browser stacks.
SHIM_BOOTSTRAP_MODE=sync
if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" = "1" ]; then
  SHIM_BOOTSTRAP_MODE=empty
  export BIOMES_SKIP_PLAYER_SPATIAL_OBSERVER=1
fi
start_bg shim 127.0.0.1 3100 3104 3101 "$APP_ROOT/dist/shim.js" --bootstrapMode "$SHIM_BOOTSTRAP_MODE" "${SHIM_ARGS[@]}"
wait_tcp 127.0.0.1 3104 shim-rpc

start_bg bikkie 127.0.0.1 3400 3404 3401 "$APP_ROOT/dist/bikkie.js" "${SERVICE_ARGS[@]}"
start_bg logic 127.0.0.1 3500 3504 3501 "$APP_ROOT/dist/logic.js" "${SERVICE_ARGS[@]}"
if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" != "1" ]; then
  start_bg ask 127.0.0.1 3600 3604 3601 "$APP_ROOT/dist/ask.js" "${SERVICE_ARGS[@]}"
  start_bg chat 127.0.0.1 3300 3304 3301 "$APP_ROOT/dist/chat.js" "${SERVICE_ARGS[@]}"
  start_bg oob 127.0.0.1 4700 4704 4701 "$APP_ROOT/dist/oob.js" "${SERVICE_ARGS[@]}"
  start_bg sidefx 127.0.0.1 4600 4604 4601 "$APP_ROOT/dist/sidefx.js" "${SERVICE_ARGS[@]}"
else
  log "Focused native E2E: Ask is embedded in Logic; chat/oob/sidefx replicas are omitted."
fi
start_bg sync "$GLITCH_SYNC_BIND_HOST" "$BASE_PORT" "$RPC_PORT" "$METRICS_PORT" "$APP_ROOT/dist/sync.js" "${SERVICE_ARGS[@]}"

# FOCUSED_E2E_TRIGGER_PARALLEL_BOOT (2026-07-26): Sync and Trigger each hydrate
# the same 300k+ entity snapshot and neither depends on the other's listener.
# Starting Trigger only after Sync became ready serialized two multi-minute
# bootstraps, making a two-object browser batch pay roughly twice the required
# warm-up. Focused stacks launch Trigger beside Sync, then retain the exact same
# readiness and Redis consumer-group gates below. Full production rehearsals
# keep their historical ordering because they also coordinate Notify/Sidefx.
if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" = "1" ] && [ "$GLITCH_ENABLE_STREAM_WORKERS" = "1" ]; then
  start_bg trigger 127.0.0.1 3700 3704 3701 "$APP_ROOT/dist/trigger.js" "${SERVICE_ARGS[@]}"
fi

# FOCUSED_E2E_LOGIC_BEFORE_WEB (2026-07-26): a focused warm browser run values
# a stable first page more than early public ingress. Logic can spend minutes
# indexing the 335k-entity snapshot; starting Web before its RPC listener was
# ready cached a failed zRPC channel and made the browser wait again after the
# stack was otherwise usable. Full production rehearsals retain early ingress.
if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" = "1" ]; then
  wait_tcp 127.0.0.1 3504 logic-rpc-before-web
fi

# Bind the public ingress after core processes have launched (and, for the
# focused browser topology, after Logic RPC is authoritative). Remaining
# dependency readiness checks continue below.
log "START web HOST=$GLITCH_WEB_BIND_HOST BASE_PORT=$WEB_BASE_PORT RPC_PORT=$WEB_RPC_PORT METRICS_PORT=$WEB_METRICS_PORT heapMb=$GLITCH_WEB_MAX_OLD_SPACE_MB file=$APP_ROOT/dist/web.js assetServerMode=lazy GLITCH_PROD_LOCAL_PARITY"
HOST="$GLITCH_WEB_BIND_HOST" BASE_PORT="$WEB_BASE_PORT" RPC_PORT="$WEB_RPC_PORT" METRICS_PORT="$WEB_METRICS_PORT" \
  node --max-old-space-size="$GLITCH_WEB_MAX_OLD_SPACE_MB" "$APP_ROOT/dist/web.js" "${SERVICE_ARGS[@]}" --assetServerMode lazy &
WEB_PID="$!"
PIDS="$PIDS $WEB_PID"
log "PID web=$WEB_PID"
wait_tcp 127.0.0.1 "$WEB_BASE_PORT" web-http

wait_tcp 127.0.0.1 3504 logic-rpc
if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" != "1" ]; then
  if ! wait_tcp 127.0.0.1 4704 oob-rpc; then
    echo "WARN oob-rpc not listening on 127.0.0.1:4704; continuing because oob-rpc is non-fatal for Container Apps web/sync startup" >&2
  fi
  wait_tcp 127.0.0.1 3604 ask-rpc
  wait_http_ready 127.0.0.1 3301 chat
  wait_redis_stream_group 4 chat-delivery redis-chat-distributor chat-distributor
fi
wait_tcp 127.0.0.1 "$SYNC_PORT" sync-websocket-base
wait_tcp 127.0.0.1 "$RPC_PORT" sync-rpc

if [ "$GLITCH_ENABLE_ANIMA" = "1" ]; then
  start_anima_worker
else
  log "NPC simulation disabled by GLITCH_ENABLE_ANIMA=$GLITCH_ENABLE_ANIMA"
fi

if [ "$GLITCH_ENABLE_GAIA" = "1" ]; then
  start_gaia_worker
else
  log "World simulation disabled by GLITCH_ENABLE_GAIA=$GLITCH_ENABLE_GAIA"
fi

if [ "$GLITCH_ENABLE_STREAM_WORKERS" = "1" ]; then
  if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" != "1" ]; then
    start_bg trigger 127.0.0.1 3700 3704 3701 "$APP_ROOT/dist/trigger.js" "${SERVICE_ARGS[@]}"
  fi
  wait_http_ready 127.0.0.1 3701 trigger
  wait_redis_stream_group 0 firehose trigger-server trigger-firehose
  if [ "$GLITCH_FOCUSED_NATIVE_E2E_STACK" != "1" ]; then
    start_bg notify 127.0.0.1 3800 3804 3801 "$APP_ROOT/dist/notify.js" "${SERVICE_ARGS[@]}"
    wait_http_ready 127.0.0.1 3801 notify
    wait_redis_stream_group 0 firehose notifications-server notify-firehose
  else
    log "Focused native E2E: notification stream worker is omitted."
  fi
else
  log "Stream workers disabled by GLITCH_ENABLE_STREAM_WORKERS=$GLITCH_ENABLE_STREAM_WORKERS"
fi

if [ "$GLITCH_ENABLE_SINK_WORKER" = "1" ]; then
  start_bg sink 127.0.0.1 3900 3904 3901 "$APP_ROOT/dist/sink.js" "${SERVICE_ARGS[@]}"
  wait_http_ready 127.0.0.1 3901 sink
  wait_redis_stream_group 0 firehose sink sink-firehose
else
  log "Sink worker disabled by GLITCH_ENABLE_SINK_WORKER=$GLITCH_ENABLE_SINK_WORKER"
fi

log "GLITCH_PRODUCTION_STACK_PORT_FIX ready web=$WEB_BASE_PORT sync=$SYNC_PORT rpc=$RPC_PORT"
supervise_processes
