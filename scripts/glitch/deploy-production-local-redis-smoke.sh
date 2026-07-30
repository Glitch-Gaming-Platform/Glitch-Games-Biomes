#!/usr/bin/env bash
set -euo pipefail

# Build the production image, optionally run it locally against a local Redis
# container, then optionally push the image to Azure Container Apps.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PUSH_PRODUCTION=0
SKIP_BUILD=0
STOP_BEFORE_DOCKER_BUILD=0
KEEP_LOCAL_SMOKE=0
REDIS_HEALTH_CHECK_ONLY=0
BOOTSTRAP_PROD_REDIS_SNAPSHOT=0
RUN_LOCAL_SMOKE="${RUN_LOCAL_SMOKE:-0}"
RUN_LOCAL_FULL_REHEARSAL="${RUN_LOCAL_FULL_REHEARSAL:-0}"
HARTHMERE_RUN_LOCAL_BROWSER_E2E="${HARTHMERE_RUN_LOCAL_BROWSER_E2E:-$RUN_LOCAL_FULL_REHEARSAL}"
HARTHMERE_TERRAIN_SEED_MODE="${HARTHMERE_TERRAIN_SEED_MODE:-additive}"
DOCKER_BUILD_DIRECT_PUSH="${DOCKER_BUILD_DIRECT_PUSH:-1}"
DOCKER_BUILD_MIN_FREE_MB="${DOCKER_BUILD_MIN_FREE_MB:-18432}"
DOCKER_CACHE_EXPORT_MIN_FREE_MB="${DOCKER_CACHE_EXPORT_MIN_FREE_MB:-32768}"
DOCKER_BUILD_POST_BUILD_MIN_FREE_MB="${DOCKER_BUILD_POST_BUILD_MIN_FREE_MB:-8192}"
DOCKER_BUILD_RETRY_WITHOUT_CACHE_ON_ENOSPC="${DOCKER_BUILD_RETRY_WITHOUT_CACHE_ON_ENOSPC:-1}"
# Set only after independently verifying the exact tag in ACR. This lets a
# failed post-push rollout resume without paying to upload the same large image.
IMAGE_WAS_PUSHED="${IMAGE_WAS_PUSHED:-0}"
TAG="${TAG:-prod-$(date -u +%Y%m%d%H%M%S)}"

usage() {
  cat <<'EOF'
Usage: scripts/glitch/deploy-production-local-redis-smoke.sh [options]

Options:
  --push          Push the built image and update Azure Container Apps.
  --tag TAG      Use a specific image tag.
  --skip-build   Reuse existing .next/dist and Docker image tag.
  --stop-before-docker-build
                 Run guardrails and source artifact builds, then exit before
                 the Docker image build.
  --local-smoke  Run the memory-heavy local container HTTP smoke before push.
  --local-rehearsal
                 Run the production image, full Harthmere reconciliation,
                 ElevenLabs configuration check, and Anima/Gaia checks locally;
                 leave the local stack running for manual inspection.
  --keep-local   Leave local smoke containers running for manual inspection.
  --bootstrap-prod-redis-snapshot
                 Explicitly flush and reload production Redis from snapshot_backup.json
                 before updating Azure. Normal deploys fail fast on snapshot mismatch.
  --migrate-existing-terrain
                 Update existing authored shard seeds while preserving every
                 player/world overlay. Ordinary deploys only add missing shards.
  --redis-health-check-only
                 Only check/repair production Redis AOF/write health, then exit.
  -h, --help     Show this help.

The local production-image HTTP smoke is opt-in because the full container can
exceed developer-machine memory. When --local-smoke is used, the script uses
local Redis and waits for the local web server before running smoke checks.
It never uses az acr build, so there is no remote source upload just to compile.
When --push is used without --local-smoke, Docker Buildx pushes the image
directly by default to avoid loading the full image into the local Docker daemon.
Set DOCKER_BUILD_DIRECT_PUSH=0 to restore the older load-then-docker-push path.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --push)
      PUSH_PRODUCTION=1
      shift
      ;;
    --tag)
      TAG="${2:?missing tag after --tag}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --stop-before-docker-build)
      STOP_BEFORE_DOCKER_BUILD=1
      shift
      ;;
    --local-smoke)
      RUN_LOCAL_SMOKE=1
      shift
      ;;
    --local-rehearsal)
      RUN_LOCAL_SMOKE=1
      RUN_LOCAL_FULL_REHEARSAL=1
      KEEP_LOCAL_SMOKE=1
      shift
      ;;
    --keep-local)
      KEEP_LOCAL_SMOKE=1
      shift
      ;;
    --bootstrap-prod-redis-snapshot)
      BOOTSTRAP_PROD_REDIS_SNAPSHOT=1
      shift
      ;;
    --migrate-existing-terrain)
      HARTHMERE_TERRAIN_SEED_MODE=preserve-overlays
      shift
      ;;
    --redis-health-check-only)
      REDIS_HEALTH_CHECK_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$HARTHMERE_TERRAIN_SEED_MODE" in
  additive|preserve-overlays) ;;
  destructive)
    if [ "${BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED:-0}" != "1" ]; then
      echo "ERROR destructive terrain reseeding requires BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED=1." >&2
      exit 2
    fi
    ;;
  *)
    echo "ERROR unknown HARTHMERE_TERRAIN_SEED_MODE=$HARTHMERE_TERRAIN_SEED_MODE; expected additive, preserve-overlays, or destructive." >&2
    exit 2
    ;;
esac

if [ "$STOP_BEFORE_DOCKER_BUILD" = "1" ] && [ "$PUSH_PRODUCTION" = "1" ]; then
  echo "ERROR --stop-before-docker-build cannot be combined with --push." >&2
  exit 2
fi

if [ "$STOP_BEFORE_DOCKER_BUILD" = "1" ] && [ "$RUN_LOCAL_SMOKE" = "1" ]; then
  echo "ERROR --stop-before-docker-build cannot be combined with --local-smoke." >&2
  exit 2
fi

PROD_ORIGIN="${PROD_ORIGIN:-https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io}"
GLITCH_TITLE_ID="${GLITCH_TITLE_ID:-42de534c-600f-4228-af9e-b69faef94cce}"
GLITCH_API_BASE_URL="${GLITCH_API_BASE_URL:-https://api.glitch.fun/api}"
ACR_SERVER="${ACR_SERVER:-glitchgames.azurecr.io}"
ACR_NAME="${ACR_NAME:-GlitchGames}"
IMAGE_REPO="${IMAGE_REPO:-biomes-node}"
IMAGE="${ACR_SERVER}/${IMAGE_REPO}:${TAG}"
LOCAL_IMAGE="${LOCAL_IMAGE:-biomes-node:local-${TAG}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-openai-resource-group}"
AZURE_CONTAINER_APP="${AZURE_CONTAINER_APP:-biomes-node-vnet}"
AZURE_WEB_TARGET_PORT="${AZURE_WEB_TARGET_PORT:-3000}"
AZURE_MIN_REPLICAS="${AZURE_MIN_REPLICAS:-3}"
AZURE_MAX_REPLICAS="${AZURE_MAX_REPLICAS:-3}"
AZURE_ALLOW_SINGLE_REPLICA="${AZURE_ALLOW_SINGLE_REPLICA:-0}"
AZURE_CONTAINER_APP_ENVIRONMENT="${AZURE_CONTAINER_APP_ENVIRONMENT:-glitch-prod-vnet-env}"
AZURE_SIMULATION_CONTAINER_APP="${AZURE_SIMULATION_CONTAINER_APP:-biomes-simulation-vnet}"
AZURE_SIMULATION_TARGET_PORT="${AZURE_SIMULATION_TARGET_PORT:-3000}"
AZURE_SIMULATION_MIN_REPLICAS="${AZURE_SIMULATION_MIN_REPLICAS:-1}"
AZURE_SIMULATION_MAX_REPLICAS="${AZURE_SIMULATION_MAX_REPLICAS:-1}"
AZURE_SIMULATION_CPU="${AZURE_SIMULATION_CPU:-4.0}"
AZURE_SIMULATION_MEMORY="${AZURE_SIMULATION_MEMORY:-16Gi}"
AZURE_SIMULATION_WORKLOAD_PROFILE="${AZURE_SIMULATION_WORKLOAD_PROFILE:-d4-prod}"
HARTHMERE_WORLD_SYNC_RUNNER_MODE="${HARTHMERE_WORLD_SYNC_RUNNER_MODE:-auto}"
HARTHMERE_WORLD_SYNC_JOB_NAME="${HARTHMERE_WORLD_SYNC_JOB_NAME:-biomes-harthmere-sync}"
HARTHMERE_WORLD_SYNC_JOB_CONTAINER_NAME="${HARTHMERE_WORLD_SYNC_JOB_CONTAINER_NAME:-harthmere-sync}"
HARTHMERE_WORLD_SYNC_JOB_CPU="${HARTHMERE_WORLD_SYNC_JOB_CPU:-4.0}"
HARTHMERE_WORLD_SYNC_JOB_MEMORY="${HARTHMERE_WORLD_SYNC_JOB_MEMORY:-16Gi}"
HARTHMERE_WORLD_SYNC_JOB_WORKLOAD_PROFILE="${HARTHMERE_WORLD_SYNC_JOB_WORKLOAD_PROFILE:-$AZURE_SIMULATION_WORKLOAD_PROFILE}"
HARTHMERE_WORLD_SYNC_JOB_TIMEOUT_SECONDS="${HARTHMERE_WORLD_SYNC_JOB_TIMEOUT_SECONDS:-10800}"
HARTHMERE_WORLD_SYNC_JOB_CREATED=0
HARTHMERE_TERRAIN_JOB_NAME="${HARTHMERE_TERRAIN_JOB_NAME:-biomes-harthmere-terrain}"
HARTHMERE_TERRAIN_JOB_CONTAINER_NAME="${HARTHMERE_TERRAIN_JOB_CONTAINER_NAME:-harthmere-terrain}"
HARTHMERE_TERRAIN_JOB_CREATED=0
HARTHMERE_TERRAIN_AUDIT_JOB_NAME="${HARTHMERE_TERRAIN_AUDIT_JOB_NAME:-biomes-harthmere-terrain-audit}"
HARTHMERE_TERRAIN_AUDIT_JOB_CONTAINER_NAME="${HARTHMERE_TERRAIN_AUDIT_JOB_CONTAINER_NAME:-harthmere-terrain-audit}"
HARTHMERE_TERRAIN_AUDIT_JOB_CREATED=0
HARTHMERE_PREFLIGHT_INSTALL_ID="${HARTHMERE_PREFLIGHT_INSTALL_ID:-f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7}"
HARTHMERE_RUN_PRODUCTION_BROWSER_E2E="${HARTHMERE_RUN_PRODUCTION_BROWSER_E2E:-0}"
PROD_REDIS_HOST="${PROD_REDIS_HOST:-10.0.0.12}"
PROD_REDIS_PUBLIC_HOST="${PROD_REDIS_PUBLIC_HOST:-}"
PROD_REDIS_HEALTH_HOST="${PROD_REDIS_HEALTH_HOST:-$PROD_REDIS_HOST}"
PROD_REDIS_HEALTH_MODE="${PROD_REDIS_HEALTH_MODE:-azure-vm}"
PROD_REDIS_VM_RESOURCE_GROUP="${PROD_REDIS_VM_RESOURCE_GROUP:-$AZURE_RESOURCE_GROUP}"
PROD_REDIS_VM_NAME="${PROD_REDIS_VM_NAME:-biomes-redis-prod}"
PROD_REDIS_NSG_RESOURCE_GROUP="${PROD_REDIS_NSG_RESOURCE_GROUP:-$AZURE_RESOURCE_GROUP}"
PROD_REDIS_NSG_NAME="${PROD_REDIS_NSG_NAME:-biomes-redis-prod-nsg}"
PROD_REDIS_ALLOWED_SOURCE_PREFIX="${PROD_REDIS_ALLOWED_SOURCE_PREFIX:-10.0.1.0/27}"
PROD_REDIS_RECONCILE_HOST="${PROD_REDIS_RECONCILE_HOST:-$PROD_REDIS_PUBLIC_HOST}"
PROD_REDIS_PORT="${PROD_REDIS_PORT:-6379}"
PROD_REDIS_AOF_AUTOFIX="${PROD_REDIS_AOF_AUTOFIX:-1}"
PROD_REDIS_RDB_DIR="${PROD_REDIS_RDB_DIR:-/var/lib/redis}"
PROD_REDIS_RDB_FILENAME="${PROD_REDIS_RDB_FILENAME:-dump.rdb}"
PROD_REDIS_SAVE_SCHEDULE="${PROD_REDIS_SAVE_SCHEDULE:-900 1 300 10 60 10000}"
GLITCH_MUTABLE_HOTFIX_REDIS_KEY="${GLITCH_MUTABLE_HOTFIX_REDIS_KEY:-glitch:mutable_hotfix:current}"
HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE:-per-outpost}"
HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_SCAN_COUNT="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_SCAN_COUNT:-5000}"
HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE:-2}"
HARTHMERE_CONNECTOR_ROUTE_SCAN_COUNT="${HARTHMERE_CONNECTOR_ROUTE_SCAN_COUNT:-5000}"
HARTHMERE_CONNECTOR_ROUTE_APPLY_SHARD_BATCH_SIZE="${HARTHMERE_CONNECTOR_ROUTE_APPLY_SHARD_BATCH_SIZE:-4}"
HARTHMERE_TERRAIN_MAINTENANCE_REVISION=""
AZURE_SIMULATION_MAINTENANCE_PAUSED=0
AZURE_PREVIOUS_SIMULATION_REVISIONS=""
LOCAL_NETWORK="${LOCAL_NETWORK:-biomes-prod-smoke-net}"
LOCAL_REDIS_CONTAINER="${LOCAL_REDIS_CONTAINER:-biomes-prod-smoke-redis}"
LOCAL_REDIS_IMAGE="${LOCAL_REDIS_IMAGE:-redis:6.0.16-alpine}"
LOCAL_APP_CONTAINER="${LOCAL_APP_CONTAINER:-biomes-prod-smoke-app}"
LOCAL_WEB_PORT="${LOCAL_WEB_PORT:-3017}"
LOCAL_SYNC_PORT="${LOCAL_SYNC_PORT:-4907}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-900}"
# Long browser/ECS sweeps should survive a child-process crash or Docker
# Desktop restart instead of silently leaving dead port-forward containers.
# Callers can still set `no` for one-shot CI cleanup semantics.
LOCAL_STACK_RESTART_POLICY="${LOCAL_STACK_RESTART_POLICY:-unless-stopped}"

if { [ "$AZURE_MIN_REPLICAS" -lt 2 ] || [ "$AZURE_MAX_REPLICAS" -lt 2 ]; } &&
   [ "$AZURE_ALLOW_SINGLE_REPLICA" != "1" ]; then
  echo "ERROR single-replica production deploys are disabled for this title." >&2
  echo "Azure can evict or replace the only replica, forcing users through a full cold start of the large Biomes image." >&2
  echo "Use AZURE_MIN_REPLICAS>=2 and AZURE_MAX_REPLICAS>=2, or set AZURE_ALLOW_SINGLE_REPLICA=1 for an explicit emergency downgrade." >&2
  exit 2
fi

if [ "$AZURE_MIN_REPLICAS" -gt "$AZURE_MAX_REPLICAS" ]; then
  echo "ERROR AZURE_MIN_REPLICAS=$AZURE_MIN_REPLICAS is greater than AZURE_MAX_REPLICAS=$AZURE_MAX_REPLICAS." >&2
  exit 2
fi

log() {
  printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR required command not found: $1" >&2
    exit 1
  fi
}

available_root_disk_mb() {
  df -Pm / | awk 'NR == 2 { print $4 }'
}

path_size_mb() {
  local path="$1"
  if [ -e "$path" ]; then
    du -sm "$path" 2>/dev/null | awk '{ print $1 }'
  else
    printf '0\n'
  fi
}

show_docker_build_disk_budget() {
  echo "::group::Docker build disk budget"
  df -h
  du -sh /tmp/.buildx-cache /tmp/.buildx-cache-new 2>/dev/null || true
  echo "::endgroup::"
}

prune_docker_builder_storage() {
  docker buildx prune -af || true
  docker builder prune -af || true
  docker system prune -af --volumes || true
}

disable_docker_build_layer_cache() {
  local reason="$1"
  echo "::warning::$reason"
  rm -rf /tmp/.buildx-cache /tmp/.buildx-cache-new
  DOCKER_BUILD_CACHE_FROM=""
  DOCKER_BUILD_CACHE_TO=""
  export DOCKER_BUILD_CACHE_FROM DOCKER_BUILD_CACHE_TO
}

prepare_docker_build_disk_budget() {
  require_cmd docker
  rm -rf /tmp/.buildx-cache-new

  log "Checking Docker build disk budget."
  show_docker_build_disk_budget

  local cache_size_mb free_mb
  cache_size_mb="$(path_size_mb /tmp/.buildx-cache)"
  if [ "$cache_size_mb" -gt "${MAX_DOCKER_LAYER_CACHE_MB:-4096}" ]; then
    echo "::warning::Restored Buildx cache is ${cache_size_mb}MB, above ${MAX_DOCKER_LAYER_CACHE_MB:-4096}MB; deleting it before Docker build."
    rm -rf /tmp/.buildx-cache
  fi

  free_mb="$(available_root_disk_mb)"
  if [ "$free_mb" -lt "$DOCKER_BUILD_MIN_FREE_MB" ]; then
    log "Pruning Docker storage before image build because only ${free_mb}MB is free."
    prune_docker_builder_storage
    free_mb="$(available_root_disk_mb)"
  fi

  if [ "$free_mb" -lt "$DOCKER_BUILD_MIN_FREE_MB" ]; then
    disable_docker_build_layer_cache "Only ${free_mb}MB free before Docker build, below ${DOCKER_BUILD_MIN_FREE_MB}MB; retrying this run without external Buildx cache."
    free_mb="$(available_root_disk_mb)"
  fi

  if [ -n "${DOCKER_BUILD_CACHE_TO:-}" ] && [ "$free_mb" -lt "$DOCKER_CACHE_EXPORT_MIN_FREE_MB" ]; then
    echo "::warning::Only ${free_mb}MB free before Docker build, below ${DOCKER_CACHE_EXPORT_MIN_FREE_MB}MB cache-export budget; disabling refreshed Buildx cache export for this run."
    rm -rf /tmp/.buildx-cache-new
    DOCKER_BUILD_CACHE_TO=""
    export DOCKER_BUILD_CACHE_TO
  fi
}

cleanup_docker_build_disk_budget_after_build() {
  local free_mb
  free_mb="$(available_root_disk_mb)"
  if [ "$free_mb" -ge "$DOCKER_BUILD_POST_BUILD_MIN_FREE_MB" ]; then
    return
  fi

  echo "::warning::Only ${free_mb}MB free after Docker build, below ${DOCKER_BUILD_POST_BUILD_MIN_FREE_MB}MB; deleting refreshed Buildx cache and pruning Docker before Azure update."
  rm -rf /tmp/.buildx-cache-new
  prune_docker_builder_storage
  show_docker_build_disk_budget
}

extract_az_run_command_stdout() {
  node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const parsed = JSON.parse(raw);
const message = parsed?.value?.[0]?.message ?? "";
const stdoutMarker = "[stdout]\n";
const stderrMarker = "\n[stderr]\n";
const stdoutStart = message.indexOf(stdoutMarker);
const stderrStart = message.indexOf(stderrMarker);
if (stdoutStart === -1 || stderrStart === -1 || stderrStart < stdoutStart) {
  process.stdout.write(message);
  process.exit(0);
}
process.stdout.write(message.slice(stdoutStart + stdoutMarker.length, stderrStart));
const stderr = message.slice(stderrStart + stderrMarker.length).trim();
if (stderr) {
  process.stderr.write(`${stderr}\n`);
}
'
}

prod_redis_cli() {
  if [ "$PROD_REDIS_HEALTH_MODE" = "direct" ]; then
    redis-cli -h "$PROD_REDIS_HEALTH_HOST" -p "$PROD_REDIS_PORT" "$@"
    return
  fi

  if [ "$PROD_REDIS_HEALTH_MODE" != "azure-vm" ]; then
    echo "ERROR unsupported PROD_REDIS_HEALTH_MODE=$PROD_REDIS_HEALTH_MODE; expected azure-vm or direct." >&2
    return 2
  fi

  require_cmd az
  require_cmd node

  local remote_cmd="" quoted arg output
  for arg in redis-cli -h 127.0.0.1 -p "$PROD_REDIS_PORT" "$@"; do
    printf -v quoted '%q' "$arg"
    remote_cmd+="$quoted "
  done

  if ! output="$(
    az vm run-command invoke \
      --resource-group "$PROD_REDIS_VM_RESOURCE_GROUP" \
      --name "$PROD_REDIS_VM_NAME" \
      --command-id RunShellScript \
      --scripts "set -eu; $remote_cmd" \
      -o json
  )"; then
    printf '%s\n' "$output" >&2
    return 1
  fi

  printf '%s' "$output" | extract_az_run_command_stdout
}

prod_redis_vm_run_script() {
  local script="$1"

  if [ "$PROD_REDIS_HEALTH_MODE" != "azure-vm" ]; then
    echo "ERROR prod_redis_vm_run_script requires PROD_REDIS_HEALTH_MODE=azure-vm." >&2
    return 2
  fi

  require_cmd az
  require_cmd node

  local output
  if ! output="$(
    az vm run-command invoke \
      --resource-group "$PROD_REDIS_VM_RESOURCE_GROUP" \
      --name "$PROD_REDIS_VM_NAME" \
      --command-id RunShellScript \
      --scripts "$script" \
      -o json
  )"; then
    printf '%s\n' "$output" >&2
    return 1
  fi

  printf '%s' "$output" | extract_az_run_command_stdout
}

prod_redis_config_get() {
  local key="$1"
  prod_redis_cli --raw CONFIG GET "$key" 2>/dev/null | tail -n 1 | tr -d '\r'
}

prod_redis_info_value() {
  local section="$1"
  local key="$2"
  prod_redis_cli --raw INFO "$section" 2>/dev/null \
    | awk -F: -v key="$key" '$1 == key { gsub(/\r/, "", $2); print $2; exit }'
}

production_redis_write_probe() {
  local probe_key="codex:deploy-redis-write-probe:${TAG}:$$:${RANDOM}:$(date -u +%s)"
  prod_redis_cli --raw SET "$probe_key" ok EX 60 NX 2>&1 || true
}

load_production_redis_aof_health() {
  local probe_key="codex:deploy-redis-write-probe:${TAG}:$$:${RANDOM}:$(date -u +%s)"

  if [ "$PROD_REDIS_HEALTH_MODE" != "azure-vm" ]; then
    ping="$(prod_redis_cli --raw PING 2>&1 || true)"
    appendonly="$(prod_redis_config_get appendonly)"
    dir="$(prod_redis_config_get dir)"
    dbfilename="$(prod_redis_config_get dbfilename)"
    save="$(prod_redis_config_get save)"
    aof_enabled="$(prod_redis_info_value persistence aof_enabled)"
    aof_last_write_status="$(prod_redis_info_value persistence aof_last_write_status)"
    rdb_last_bgsave_status="$(prod_redis_info_value persistence rdb_last_bgsave_status)"
    write_probe="$(production_redis_write_probe)"
    return
  fi

  local q_port q_probe report
  printf -v q_port '%q' "$PROD_REDIS_PORT"
  printf -v q_probe '%q' "$probe_key"
  report="$(
    prod_redis_vm_run_script "$(cat <<EOF
set -eu
port=$q_port
probe_key=$q_probe
redis_raw() { redis-cli --raw -h 127.0.0.1 -p "\$port" "\$@" 2>/dev/null || true; }
emit() { key="\$1"; shift; printf '%s=%s\n' "\$key" "\$*"; }
emit ping "\$(redis_raw PING)"
emit appendonly "\$(redis_raw CONFIG GET appendonly | tail -n 1 | tr -d '\r')"
emit dir "\$(redis_raw CONFIG GET dir | tail -n 1 | tr -d '\r')"
emit dbfilename "\$(redis_raw CONFIG GET dbfilename | tail -n 1 | tr -d '\r')"
emit save "\$(redis_raw CONFIG GET save | tail -n 1 | tr -d '\r')"
info="\$(redis_raw INFO persistence)"
emit aof_enabled "\$(printf '%s\n' "\$info" | awk -F: '\$1 == "aof_enabled" { gsub(/\r/, "", \$2); print \$2; exit }')"
emit aof_last_write_status "\$(printf '%s\n' "\$info" | awk -F: '\$1 == "aof_last_write_status" { gsub(/\r/, "", \$2); print \$2; exit }')"
emit rdb_last_bgsave_status "\$(printf '%s\n' "\$info" | awk -F: '\$1 == "rdb_last_bgsave_status" { gsub(/\r/, "", \$2); print \$2; exit }')"
emit write_probe "\$(redis-cli --raw -h 127.0.0.1 -p "\$port" SET "\$probe_key" ok EX 60 NX 2>&1 || true)"
EOF
)"
  )"

  while IFS='=' read -r key value; do
    case "$key" in
      ping) ping="$value" ;;
      appendonly) appendonly="$value" ;;
      dir) dir="$value" ;;
      dbfilename) dbfilename="$value" ;;
      save) save="$value" ;;
      aof_enabled) aof_enabled="$value" ;;
      aof_last_write_status) aof_last_write_status="$value" ;;
      rdb_last_bgsave_status) rdb_last_bgsave_status="$value" ;;
      write_probe) write_probe="$value" ;;
    esac
  done <<< "$report"
}

check_production_redis_network_guard() {
  require_cmd az
  require_cmd node

  log "Checking production Redis NSG guardrails on $PROD_REDIS_NSG_NAME."
  local rules_json
  rules_json="$(
    az network nsg rule list \
      --resource-group "$PROD_REDIS_NSG_RESOURCE_GROUP" \
      --nsg-name "$PROD_REDIS_NSG_NAME" \
      -o json
  )"

  RULES_JSON="$rules_json" node -e '
const port = process.argv[1];
const allowedSource = process.argv[2];
const rules = JSON.parse(process.env.RULES_JSON || "[]");

function values(...parts) {
  return parts.flatMap((part) => {
    if (!part) {
      return [];
    }
    return Array.isArray(part) ? part : [part];
  });
}

function portMatches(rule) {
  const ports = values(rule.destinationPortRange, rule.destinationPortRanges);
  return ports.includes(port) || ports.includes("*");
}

function sourceMatches(rule, source) {
  return values(rule.sourceAddressPrefix, rule.sourceAddressPrefixes).includes(source);
}

function publicSource(rule) {
  return values(rule.sourceAddressPrefix, rule.sourceAddressPrefixes).some((source) =>
    ["*", "0.0.0.0/0", "Internet", "Any"].includes(source)
  );
}

const inbound6379 = rules.filter(
  (rule) => rule.direction === "Inbound" && portMatches(rule)
);
const unsafeAllows = inbound6379.filter(
  (rule) => rule.access === "Allow" && publicSource(rule)
);
const subnetAllow = inbound6379.find(
  (rule) => rule.access === "Allow" && sourceMatches(rule, allowedSource)
);
const denyOther = inbound6379.find(
  (rule) => rule.access === "Deny" && publicSource(rule)
);

if (unsafeAllows.length || !subnetAllow || !denyOther) {
  if (unsafeAllows.length) {
    console.error(
      `ERROR Redis port ${port} has public allow rule(s): ${unsafeAllows
        .map((rule) => rule.name)
        .join(", ")}`
    );
  }
  if (!subnetAllow) {
    console.error(
      `ERROR Redis port ${port} is missing an allow rule from ${allowedSource}.`
    );
  }
  if (!denyOther) {
    console.error(
      `ERROR Redis port ${port} is missing an explicit deny-all rule after the Container Apps subnet allow.`
    );
  }
  process.exit(1);
}

console.log(
  `OK Redis NSG allows ${allowedSource} and explicitly denies other ${port}/tcp sources.`
);
' "$PROD_REDIS_PORT" "$PROD_REDIS_ALLOWED_SOURCE_PREFIX"
}

snapshot_backup_hash() {
  node -e "const fs=require('fs');const crypto=require('crypto');const p=process.argv[1];process.stdout.write(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'))" snapshot_backup.json
}

production_snapshot_hash_key() {
  printf 'biomes:%s:snapshot_hash' "$GLITCH_TITLE_ID"
}

production_redis_snapshot_hash() {
  local hash_key="$1"
  local current_hash
  current_hash="$(prod_redis_cli --raw GET "$hash_key" 2>/dev/null | tr -d '\r' || true)"
  if [ -n "$current_hash" ]; then
    printf '%s' "$current_hash"
    return
  fi
  prod_redis_cli --raw GET biomes_data_snapshot_hash 2>/dev/null | tr -d '\r' || true
}

check_production_redis_snapshot_materialized() {
  local phase="$1"
  local dbsize required_count
  dbsize="$(prod_redis_cli --raw DBSIZE 2>/dev/null | tr -d '\r' || true)"
  required_count="$(
    prod_redis_cli --raw EXISTS \
      b:8810000000019301 \
      b:8810000000019401 \
      b:8810000000019451 2>/dev/null | tr -d '\r' || true
  )"

  if [ "${dbsize:-0}" -lt 1000 ] || [ "${required_count:-0}" -lt 3 ]; then
    echo "ERROR production Redis snapshot is not materially loaded before $phase:" >&2
    echo "  dbsize=${dbsize:-unknown}" >&2
    echo "  required_seed_keys_present=${required_count:-unknown}/3" >&2
    echo "  required bootstrap keys: Grove NPC, robot, Muck/Hex hostile" >&2
    return 1
  fi

  log "Production Redis snapshot materialization OK before $phase: dbsize=$dbsize required_seed_keys_present=$required_count/3."
}

check_production_redis_snapshot_materialized_values() {
  local phase="$1"
  local dbsize="$2"
  local required_count="$3"

  if [ "${dbsize:-0}" -lt 1000 ] || [ "${required_count:-0}" -lt 3 ]; then
    echo "ERROR production Redis snapshot is not materially loaded before $phase:" >&2
    echo "  dbsize=${dbsize:-unknown}" >&2
    echo "  required_seed_keys_present=${required_count:-unknown}/3" >&2
    echo "  required bootstrap keys: Grove NPC, robot, Muck/Hex hostile" >&2
    return 1
  fi

  log "Production Redis snapshot materialization OK before $phase: dbsize=$dbsize required_seed_keys_present=$required_count/3."
}

load_production_redis_snapshot_state() {
  local hash_key="$1"
  local expected_hash="${2:-}"

  if [ "$PROD_REDIS_HEALTH_MODE" != "azure-vm" ]; then
    current_hash="$(production_redis_snapshot_hash "$hash_key")"
    dbsize="$(prod_redis_cli --raw DBSIZE 2>/dev/null | tr -d '\r' || true)"
    required_count="$(
      prod_redis_cli --raw EXISTS \
        b:8810000000019301 \
        b:8810000000019401 \
        b:8810000000019451 2>/dev/null | tr -d '\r' || true
    )"
    return
  fi

  local q_port q_hash_key q_expected_hash report
  printf -v q_port '%q' "$PROD_REDIS_PORT"
  printf -v q_hash_key '%q' "$hash_key"
  printf -v q_expected_hash '%q' "$expected_hash"
  report="$(
    prod_redis_vm_run_script "$(cat <<EOF
set -eu
port=$q_port
hash_key=$q_hash_key
expected_hash=$q_expected_hash
redis_raw() { redis-cli --raw -h 127.0.0.1 -p "\$port" "\$@" 2>/dev/null || true; }
emit() { key="\$1"; shift; printf '%s=%s\n' "\$key" "\$*"; }
hash="\$(redis_raw GET "\$hash_key" | tr -d '\r')"
if [ -z "\$hash" ]; then
  hash="\$(redis_raw GET biomes_data_snapshot_hash | tr -d '\r')"
fi
if [ -n "\$expected_hash" ] && [ "\$hash" = "\$expected_hash" ]; then
  redis-cli --raw -h 127.0.0.1 -p "\$port" SET "\$hash_key" "\$expected_hash" >/dev/null 2>&1 || true
fi
emit current_hash "\$hash"
emit dbsize "\$(redis_raw DBSIZE | tr -d '\r')"
emit required_count "\$(redis_raw EXISTS b:8810000000019301 b:8810000000019401 b:8810000000019451 | tr -d '\r')"
EOF
)"
  )"

  while IFS='=' read -r key value; do
    case "$key" in
      current_hash) current_hash="$value" ;;
      dbsize) dbsize="$value" ;;
      required_count) required_count="$value" ;;
    esac
  done <<< "$report"
}

bootstrap_production_redis_snapshot() {
  local expected_hash="$1"
  local hash_key="$2"

  if [ "$BOOTSTRAP_PROD_REDIS_SNAPSHOT" != "1" ]; then
    return 1
  fi

  if [ "$PROD_REDIS_HEALTH_MODE" = "azure-vm" ]; then
    echo "ERROR refusing local production Redis bootstrap while Redis is private." >&2
    echo "Run the snapshot bootstrap from an in-VNet one-time job/container, then re-run deploy." >&2
    echo "This guard prevents FLUSHALL without a reachable private path to reload snapshot_backup.json." >&2
    return 1
  fi

  log "Bootstrapping production Redis snapshot hash=$expected_hash host=${PROD_REDIS_HEALTH_HOST}:${PROD_REDIS_PORT}."
  prod_redis_cli FLUSHALL >/dev/null
  if [ -f dist/bootstrap-redis.js ]; then
    IS_SERVER=1 \
      SKIP_PROD_LOAD=true \
      REDIS_HOST="$PROD_REDIS_HEALTH_HOST" \
      GLITCH_REDIS_HOST="$PROD_REDIS_HEALTH_HOST" \
      LOCAL_REDIS_HOST="$PROD_REDIS_HEALTH_HOST" \
      REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_DISABLE_GCP=1 \
      GLITCH_SKIP_GOOGLE_SECRETS=1 \
      GLITCH_DISABLE_DISCORD=1 \
      node dist/bootstrap-redis.js snapshot_backup.json
  else
    log "WARN dist/bootstrap-redis.js missing; falling back to ts-node Redis bootstrap." >&2
    IS_SERVER=1 \
      SKIP_PROD_LOAD=true \
      REDIS_HOST="$PROD_REDIS_HEALTH_HOST" \
      GLITCH_REDIS_HOST="$PROD_REDIS_HEALTH_HOST" \
      LOCAL_REDIS_HOST="$PROD_REDIS_HEALTH_HOST" \
      REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_DISABLE_GCP=1 \
      GLITCH_SKIP_GOOGLE_SECRETS=1 \
      GLITCH_DISABLE_DISCORD=1 \
      node -r ts-node/register scripts/node/bootstrap_redis.ts snapshot_backup.json
  fi
  prod_redis_cli SET "$hash_key" "$expected_hash" >/dev/null
  prod_redis_cli SET biomes_data_snapshot_hash "$expected_hash" >/dev/null
}

force_production_redis_bgsave() {
  local phase="$1"
  local started info in_progress last_status

  log "Forcing production Redis RDB save after $phase."
  started="$(prod_redis_cli --raw BGSAVE 2>&1 | tr -d '\r' || true)"
  if ! printf '%s\n' "$started" | grep -Eq 'Background saving started|Background save already in progress'; then
    echo "WARN production Redis BGSAVE returned: $started" >&2
  fi

  local i=0
  while [ "$i" -lt "${PROD_REDIS_BGSAVE_POLLS:-60}" ]; do
    info="$(prod_redis_cli --raw INFO persistence 2>/dev/null || true)"
    in_progress="$(printf '%s\n' "$info" | awk -F: '$1 == "rdb_bgsave_in_progress" { gsub(/\r/, "", $2); print $2; exit }')"
    last_status="$(printf '%s\n' "$info" | awk -F: '$1 == "rdb_last_bgsave_status" { gsub(/\r/, "", $2); print $2; exit }')"
    if [ "${in_progress:-0}" = "0" ]; then
      break
    fi
    i=$((i + 1))
    sleep "${PROD_REDIS_BGSAVE_SLEEP_SECONDS:-2}"
  done

  if [ "${last_status:-unknown}" != "ok" ]; then
    echo "ERROR production Redis RDB save did not finish cleanly after $phase: rdb_last_bgsave_status=${last_status:-unknown}" >&2
    exit 1
  fi
  log "Production Redis RDB save OK after $phase."
}

check_production_redis_snapshot_hash() {
  local phase="$1"
  local expected_hash hash_key current_hash dbsize required_count

  if [ ! -f snapshot_backup.json ]; then
    echo "ERROR snapshot_backup.json is missing; cannot verify production Redis snapshot before $phase." >&2
    exit 1
  fi

  expected_hash="$(snapshot_backup_hash)"
  hash_key="$(production_snapshot_hash_key)"
  load_production_redis_snapshot_state "$hash_key" "$expected_hash"

  if [ "$current_hash" = "$expected_hash" ]; then
    log "Production Redis snapshot hash OK before $phase: $expected_hash."
    if check_production_redis_snapshot_materialized_values "$phase" "$dbsize" "$required_count"; then
      return
    fi
    if ! bootstrap_production_redis_snapshot "$expected_hash" "$hash_key"; then
      echo "ERROR refusing to deploy with a hash marker but missing production Redis world data." >&2
      echo "Run again with --bootstrap-prod-redis-snapshot only when you intend to flush/reload production Redis before Azure update." >&2
      exit 1
    fi
    load_production_redis_snapshot_state "$hash_key" "$expected_hash"
  fi

  if [ "$current_hash" != "$expected_hash" ]; then
    echo "WARN production Redis snapshot mismatch before $phase:" >&2
    echo "  key=$hash_key" >&2
    echo "  expected=$expected_hash" >&2
    echo "  actual=${current_hash:-missing}" >&2

    if ! bootstrap_production_redis_snapshot "$expected_hash" "$hash_key"; then
      echo "ERROR refusing to deploy an image whose snapshot does not match production Redis." >&2
      echo "Run again with --bootstrap-prod-redis-snapshot only when you intend to flush/reload production Redis before Azure update." >&2
      exit 1
    fi
  fi

  load_production_redis_snapshot_state "$hash_key" "$expected_hash"
  if [ "$current_hash" != "$expected_hash" ]; then
    echo "ERROR production Redis snapshot still mismatches after bootstrap:" >&2
    echo "  expected=$expected_hash" >&2
    echo "  actual=${current_hash:-missing}" >&2
    exit 1
  fi

  check_production_redis_snapshot_materialized_values "$phase" "$dbsize" "$required_count"
  log "Production Redis snapshot bootstrap verified before $phase: $expected_hash."
}

repair_production_redis_aof() {
  log "Repairing production Redis persistence guardrails on ${PROD_REDIS_HEALTH_HOST}:${PROD_REDIS_PORT}."
  prod_redis_cli CONFIG SET appendonly no >/dev/null
  prod_redis_cli CONFIG SET stop-writes-on-bgsave-error no >/dev/null
  prod_redis_cli CONFIG SET dir "$PROD_REDIS_RDB_DIR" >/dev/null
  prod_redis_cli CONFIG SET dbfilename "$PROD_REDIS_RDB_FILENAME" >/dev/null
  prod_redis_cli CONFIG SET save "$PROD_REDIS_SAVE_SCHEDULE" >/dev/null
  prod_redis_cli CONFIG REWRITE >/dev/null || true
  force_production_redis_bgsave "Redis persistence repair"
}

check_production_redis_aof_health() {
  local phase="$1"
  if [ "$PROD_REDIS_HEALTH_MODE" = "direct" ]; then
    require_cmd redis-cli
  else
    require_cmd az
    require_cmd node
  fi

  log "Checking production Redis AOF/write health before $phase."
  local ping appendonly aof_enabled aof_last_write_status rdb_last_bgsave_status dbfilename dir save write_probe
  load_production_redis_aof_health
  if [ "$ping" != "PONG" ]; then
    echo "ERROR production Redis health check cannot PING ${PROD_REDIS_HEALTH_HOST}:${PROD_REDIS_PORT}: $ping" >&2
    exit 1
  fi

  local needs_repair=0
  if printf '%s\n' "$write_probe" | grep -qi 'MISCONF\|AOF file\|No space left on device'; then
    needs_repair=1
  fi
  if [ "$aof_enabled" = "1" ] && [ "$aof_last_write_status" = "err" ]; then
    needs_repair=1
  fi
  if [ "$appendonly" = "yes" ] && [ "$aof_last_write_status" = "err" ]; then
    needs_repair=1
  fi
  if [ "$appendonly" != "no" ] || [ "$aof_enabled" != "0" ]; then
    needs_repair=1
  fi
  if [ "$dbfilename" != "$PROD_REDIS_RDB_FILENAME" ]; then
    needs_repair=1
  fi
  if [ "$dir" != "$PROD_REDIS_RDB_DIR" ] || [ "$save" != "$PROD_REDIS_SAVE_SCHEDULE" ]; then
    needs_repair=1
  fi
  if [ "$rdb_last_bgsave_status" = "err" ]; then
    needs_repair=1
  fi

  if [ "$needs_repair" = "1" ]; then
    echo "WARN production Redis persistence/write health needs repair:" >&2
    echo "  appendonly=${appendonly:-unknown} aof_enabled=${aof_enabled:-unknown} aof_last_write_status=${aof_last_write_status:-unknown}" >&2
    echo "  rdb_last_bgsave_status=${rdb_last_bgsave_status:-unknown} dir=${dir:-unknown} dbfilename=${dbfilename:-unknown} save=${save:-unknown}" >&2
    echo "  write_probe=$write_probe" >&2
    if [ "$PROD_REDIS_AOF_AUTOFIX" != "1" ]; then
      echo "ERROR refusing to continue with unhealthy production Redis because PROD_REDIS_AOF_AUTOFIX=$PROD_REDIS_AOF_AUTOFIX." >&2
      echo "Set PROD_REDIS_AOF_AUTOFIX=1 to apply the deploy-time Redis AOF repair." >&2
      exit 1
    fi
    repair_production_redis_aof
    load_production_redis_aof_health
  fi

  if [ "$appendonly" != "no" ] || [ "$aof_enabled" != "0" ] || [ "$dir" != "$PROD_REDIS_RDB_DIR" ] || [ "$dbfilename" != "$PROD_REDIS_RDB_FILENAME" ] || [ "$save" != "$PROD_REDIS_SAVE_SCHEDULE" ] || [ "$rdb_last_bgsave_status" != "ok" ] || [ "$write_probe" != "OK" ]; then
    echo "ERROR production Redis AOF/write health check failed after repair attempt:" >&2
    echo "  appendonly=${appendonly:-unknown} aof_enabled=${aof_enabled:-unknown} aof_last_write_status=${aof_last_write_status:-unknown}" >&2
    echo "  rdb_last_bgsave_status=${rdb_last_bgsave_status:-unknown} dir=${dir:-unknown} dbfilename=${dbfilename:-unknown} save=${save:-unknown} write_probe=$write_probe" >&2
    exit 1
  fi

  log "Production Redis write health OK: appendonly=$appendonly aof_enabled=$aof_enabled dir=$dir dbfilename=$dbfilename save=\"$save\"."
}

use_azure_world_sync_job() {
  case "$HARTHMERE_WORLD_SYNC_RUNNER_MODE" in
    azure-job)
      return 0
      ;;
    direct)
      return 1
      ;;
    auto)
      [ -z "${PROD_REDIS_RECONCILE_HOST:-}" ]
      return
      ;;
    *)
      echo "ERROR unknown HARTHMERE_WORLD_SYNC_RUNNER_MODE=$HARTHMERE_WORLD_SYNC_RUNNER_MODE; expected auto, direct, or azure-job." >&2
      exit 2
      ;;
  esac
}

check_production_world_sync_runner() {
  if [ "${HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION:-0}" = "1" ]; then
    return
  fi

  if [ -z "${PROD_REDIS_RECONCILE_HOST:-}" ] && [ "$PROD_REDIS_HEALTH_MODE" = "direct" ]; then
    PROD_REDIS_RECONCILE_HOST="$PROD_REDIS_HEALTH_HOST"
  fi

  if use_azure_world_sync_job; then
    if ! command -v az >/dev/null 2>&1; then
      echo "ERROR Azure CLI is required for the in-VNet Harthmere reconciliation job." >&2
      exit 1
    fi
    log "Post-deploy Harthmere reconciliation will run in a temporary Azure VNet job."
    return
  fi

  if [ -z "${PROD_REDIS_RECONCILE_HOST:-}" ]; then
    echo "ERROR post-deploy world sync needs direct Redis access from an in-VNet runner." >&2
    echo "Production Redis is intentionally private; do not re-open the public Redis IP." >&2
    echo "Use HARTHMERE_WORLD_SYNC_RUNNER_MODE=azure-job from a local workstation, run from an Azure/VNet runner, or explicitly request an app-only rollout." >&2
    exit 1
  fi
}

archive_production_mutable_hotfix_manifest() {
  local phase="$1"
  local archive_key result archived_key size

  archive_key="glitch:mutable_hotfix:archived:${TAG}:$(date -u +%Y%m%dT%H%M%SZ)"
  log "Checking production mutable hotfix manifest before $phase."
  if ! result="$(
    prod_redis_cli --raw EVAL \
      'local v=redis.call("GET", KEYS[1]); if not v then return "missing" end; redis.call("SET", KEYS[2], v); redis.call("DEL", KEYS[1]); return KEYS[2] .. " " .. string.len(v)' \
      2 \
      "$GLITCH_MUTABLE_HOTFIX_REDIS_KEY" \
      "$archive_key" 2>&1
  )"; then
    echo "ERROR failed to archive production mutable hotfix manifest before $phase:" >&2
    printf '%s\n' "$result" >&2
    exit 1
  fi

  result="$(printf '%s' "$result" | tr -d '\r')"
  if [ "$result" = "missing" ]; then
    log "No production mutable hotfix manifest present before $phase."
    return
  fi

  archived_key="${result% *}"
  size="${result##* }"
  if [ "$archived_key" != "$archive_key" ] || ! printf '%s\n' "$size" | grep -Eq '^[0-9]+$'; then
    echo "ERROR unexpected mutable hotfix archive result before $phase: $result" >&2
    exit 1
  fi

  log "Archived and cleared production mutable hotfix manifest before $phase: $archive_key (${size} bytes)."
}

wait_for_azure_revision_ready() {
  local desired_revision="$1"
  local container_app="${2:-$AZURE_CONTAINER_APP}"
  local max_polls="${3:-${AZURE_REVISION_READY_POLLS:-90}}"
  local min_replicas=""
  local replica_count="0"
  local ready_count="0"
  local i=0

  min_replicas="$(az containerapp revision show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$container_app" \
    --revision "$desired_revision" \
    --query 'properties.template.scale.minReplicas' \
    -o tsv 2>/dev/null || true)"
  if ! printf '%s\n' "$min_replicas" | grep -Eq '^[1-9][0-9]*$'; then
    min_replicas=1
  fi

  log "Waiting for all $min_replicas minimum replicas of Azure revision $desired_revision to become ready."
  while [ "$i" -lt "$max_polls" ]; do
    replica_count="$(az containerapp replica list \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$container_app" \
      --revision "$desired_revision" \
      --query 'length(@)' \
      -o tsv 2>/dev/null || true)"
    ready_count="$(az containerapp replica list \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$container_app" \
      --revision "$desired_revision" \
      --query '[?properties.containers[0].ready==`true` && properties.containers[0].started==`true`] | length(@)' \
      -o tsv 2>/dev/null || true)"
    replica_count="${replica_count:-0}"
    ready_count="${ready_count:-0}"
    if [ "$replica_count" -ge "$min_replicas" ] 2>/dev/null &&
       [ "$ready_count" -ge "$min_replicas" ] 2>/dev/null; then
      log "Azure revision replicas are ready: $desired_revision ($ready_count/$min_replicas)."
      return 0
    fi
    i=$((i + 1))
    sleep "${AZURE_REVISION_READY_SLEEP_SECONDS:-10}"
  done

  echo "ERROR Azure revision replicas did not become ready." >&2
  echo "  revision: $desired_revision" >&2
  echo "  replicas: ${replica_count:-0}" >&2
  echo "  ready:    ${ready_count:-0}/${min_replicas}" >&2
  az containerapp replica list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$container_app" \
    --revision "$desired_revision" \
    --query '[].{name:name,runningState:properties.runningState,ready:properties.containers[0].ready,started:properties.containers[0].started,restarts:properties.containers[0].restartCount,details:properties.containers[0].runningStateDetails}' \
    -o table >&2 || true
  az containerapp revision list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$container_app" \
    --query '[].{name:name,active:properties.active,trafficWeight:properties.trafficWeight,createdTime:properties.createdTime,healthState:properties.healthState,runningState:properties.runningState}' \
    -o table >&2 || true
  return 1
}

ensure_azure_revision_active() {
  local revision="$1"
  local container_app="${2:-$AZURE_CONTAINER_APP}"
  local active
  active="$(az containerapp revision show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$container_app" \
    --revision "$revision" \
    --query properties.active \
    -o tsv 2>/dev/null || true)"
  if [ "$active" = "true" ]; then
    return
  fi
  log "Reactivating reused Azure revision $revision before readiness checks."
  az containerapp revision activate \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$container_app" \
    --revision "$revision" \
    --output none
}

verify_azure_revision_zero_restarts() {
  local revision="$1"
  local container_app="${2:-$AZURE_CONTAINER_APP}"
  local restart_counts
  restart_counts="$(az containerapp replica list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$container_app" \
    --revision "$revision" \
    --query '[].properties.containers[0].restartCount' \
    -o tsv 2>/dev/null || true)"
  if ! printf '%s\n' "$restart_counts" | grep -Eq '^[0-9]+$'; then
    echo "ERROR could not read Azure restart counts for revision $revision." >&2
    return 1
  fi
  if printf '%s\n' "$restart_counts" | awk 'NF && $1 != 0 { bad=1 } END { exit bad ? 0 : 1 }'; then
    echo "ERROR Azure revision $revision has a non-zero container restart count." >&2
    az containerapp replica list \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$container_app" \
      --revision "$revision" \
      --query '[].{name:name,restarts:properties.containers[0].restartCount,runningState:properties.runningState}' \
      -o table >&2 || true
    return 1
  fi
  log "Azure revision restart count is zero: $revision."
}

free_azure_capacity_for_maintenance() {
  local candidate_revision="$1"
  local stale
  stale="$(az containerapp revision list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query "[?name!='${candidate_revision}' && properties.active==\`true\` && (properties.trafficWeight==\`0\` || properties.trafficWeight==null)].name" \
    -o tsv 2>/dev/null || true)"
  while IFS= read -r revision; do
    [ -n "$revision" ] || continue
    if printf '%s\n' "$AZURE_PREVIOUS_TRAFFIC_WEIGHTS" | grep -Eq "^${revision}="; then
      log "Keeping serving revision $revision active while freeing maintenance capacity."
      continue
    fi
    log "Deactivating zero-traffic revision $revision to free workload-profile capacity for maintenance jobs."
    az containerapp revision deactivate \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --revision "$revision" \
      --output none || true
  done <<< "$stale"
}

azure_revision_fqdn() {
  local revision="$1"
  local fqdn
  fqdn="$(az containerapp revision show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --revision "$revision" \
    --query properties.fqdn \
    -o tsv 2>/dev/null || true)"
  if [ -z "$fqdn" ] || [ "$fqdn" = "null" ]; then
    fqdn="$(az containerapp show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --query properties.latestRevisionFqdn \
      -o tsv 2>/dev/null || true)"
  fi
  printf '%s\n' "$fqdn"
}

ensure_azure_ingress_target_port() {
  log "Ensuring Azure ingress serves the web process on target port $AZURE_WEB_TARGET_PORT."
  az containerapp ingress update \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --target-port "$AZURE_WEB_TARGET_PORT" \
    --transport http \
    --type external \
    --output none

  local actual_port
  actual_port="$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query properties.configuration.ingress.targetPort \
    -o tsv 2>/dev/null || true)"
  if [ "$actual_port" != "$AZURE_WEB_TARGET_PORT" ]; then
    echo "ERROR Azure ingress target port is $actual_port, expected $AZURE_WEB_TARGET_PORT." >&2
    exit 1
  fi
}

wait_for_simulation_role_ready() {
  local revision="$1"
  local i=0
  local logs=""

  log "Waiting for dedicated Anima/Gaia readiness marker on $revision."
  while [ "$i" -lt "${AZURE_SIMULATION_READY_POLLS:-90}" ]; do
    logs="$(az containerapp logs show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_SIMULATION_CONTAINER_APP" \
      --revision "$revision" \
      --type console \
      --tail 300 \
      --follow false 2>/dev/null || true)"
    if printf '%s\n' "$logs" | grep -Eq \
      '(GLITCH_SIMULATION_ROLE_READY )?anima=1 gaia=1 healthPort=[0-9]+'; then
      log "Dedicated simulation revision is ready: $revision (Anima and Gaia)."
      return 0
    fi
    i=$((i + 1))
    sleep "${AZURE_SIMULATION_READY_SLEEP_SECONDS:-10}"
  done

  echo "ERROR dedicated simulation revision did not report both Anima and Gaia ready: $revision" >&2
  printf '%s\n' "$logs" >&2
  az containerapp logs show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_SIMULATION_CONTAINER_APP" \
    --revision "$revision" \
    --type system \
    --tail 100 \
    --follow false >&2 || true
  return 1
}

pause_simulation_container_app_for_world_maintenance() {
  if ! az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_SIMULATION_CONTAINER_APP" \
    --output none 2>/dev/null; then
    log "Dedicated simulation app does not exist yet; no simulation pause is required."
    return
  fi

  AZURE_PREVIOUS_SIMULATION_REVISIONS="$(az containerapp revision list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_SIMULATION_CONTAINER_APP" \
    --query '[?properties.active==`true`].name' \
    -o tsv 2>/dev/null || true)"
  if [ -z "$AZURE_PREVIOUS_SIMULATION_REVISIONS" ]; then
    log "Dedicated simulation app is already paused."
    return
  fi

  log "Pausing Anima/Gaia while terrain maintenance and ECS reconciliation write production world state."
  while IFS= read -r revision; do
    [ -n "$revision" ] || continue
    az containerapp revision deactivate \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_SIMULATION_CONTAINER_APP" \
      --revision "$revision" \
      --output none
  done <<< "$AZURE_PREVIOUS_SIMULATION_REVISIONS"
  AZURE_SIMULATION_MAINTENANCE_PAUSED=1
}

restore_previous_simulation_after_failed_maintenance() {
  if [ "$AZURE_SIMULATION_MAINTENANCE_PAUSED" != "1" ] ||
     [ -z "$AZURE_PREVIOUS_SIMULATION_REVISIONS" ]; then
    return
  fi
  log "Restoring the previously active simulation revision after failed world maintenance."
  while IFS= read -r revision; do
    [ -n "$revision" ] || continue
    az containerapp revision activate \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_SIMULATION_CONTAINER_APP" \
      --revision "$revision" \
      --output none || return 1
    wait_for_azure_revision_ready "$revision" "$AZURE_SIMULATION_CONTAINER_APP" || return 1
  done <<< "$AZURE_PREVIOUS_SIMULATION_REVISIONS"
  AZURE_SIMULATION_MAINTENANCE_PAUSED=0
  AZURE_PREVIOUS_SIMULATION_REVISIONS=""
}

deploy_simulation_container_app() {
  local simulation_revision
  local registry_username
  local registry_password
  local simulation_exists=0
  local simulation_envs=(
    GLITCH_STACK_ROLE=simulation
    GLITCH_TITLE_ID="$GLITCH_TITLE_ID"
    GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL"
    GLITCH_REDIS_MODE=external
    REDIS_HOST="$PROD_REDIS_HOST"
    GLITCH_REDIS_HOST="$PROD_REDIS_HOST"
    LOCAL_REDIS_HOST="$PROD_REDIS_HOST"
    REDIS_PORT="$PROD_REDIS_PORT"
    GLITCH_REDIS_PORT="$PROD_REDIS_PORT"
    GLITCH_POPULATE_SNAPSHOT_REDIS=0
    GLITCH_REQUIRE_SNAPSHOT_REDIS=1
    GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=0
    GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0
    GLITCH_STORAGE_MODE=memory
    GLITCH_FIREHOSE_MODE=redis
    GLITCH_BISCUIT_MODE=redis2
    GLITCH_CHAT_API_MODE=redis
    GLITCH_WORLD_API_MODE=hfc-hybrid
    GLITCH_BIKKIE_CACHE_MODE=redis
    GLITCH_SERVER_CACHE_MODE=redis
    DISTRIBUTED_NOTIFIER_KIND=redis
    GLITCH_ENABLE_STREAM_WORKERS=0
    GLITCH_ENABLE_SINK_WORKER=0
    GLITCH_ENABLE_ANIMA=1
    GLITCH_ANIMA_STARTUP_CANDIDATES=1
    GLITCH_ANIMA_MAX_OLD_SPACE_MB=2048
    GLITCH_ENABLE_GAIA=1
    GLITCH_GAIA_WASM_MEMORY_MB=4096
    # Anima's first native terrain/context load exceeds the web stack's generic
    # two-minute service timeout. Keep the dedicated health endpoint unready
    # while allowing up to 15 minutes for each native worker to initialize.
    GLITCH_STACK_HTTP_READY_WAIT_TRIES=900
    GLITCH_SIMULATION_HEALTH_PORT="$AZURE_SIMULATION_TARGET_PORT"
    GLITCH_PUBLIC_WEB_ORIGIN="$PROD_ORIGIN"
    GALOIS_STATIC_PREFIX="${PROD_ORIGIN%/}/buckets/biomes-static/"
    GAIA_SHARD_DOMAIN=gaia-harthmere-simulation-v1
    BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1
    BIOMES_FORCE_LOCAL_DEV_TOWN=0
    BIOMES_CREATE_LOCAL_DEV_TERRAIN=0
    BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED=0
    BIOMES_TERRAIN_SEED_MODE=additive
    BIOMES_START_IN_HARTHMERE=0
    BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600
    BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0
    GLITCH_DISABLE_GCP=1
    GLITCH_SKIP_GCE_METADATA=1
    GLITCH_SKIP_GOOGLE_SECRETS=1
    GLITCH_DISABLE_DISCORD=1
    SKIP_PROD_LOAD=true
    SKIP_MISSING_ASSET_CHECK=true
    ALLOW_NON_K8_REDIS=1
    USE_K8_REDIS=0
  )

  if az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_SIMULATION_CONTAINER_APP" \
    --output none 2>/dev/null; then
    simulation_exists=1
  fi

  # Keep the public stack and native simulations on separate D4 replicas. The
  # failed co-located revision reached about 15.1 GiB of 16 GiB and was evicted;
  # explicit Anima/Gaia heap budgets are necessary but not sufficient isolation.
  if [ "$simulation_exists" = "1" ]; then
    log "Updating dedicated Anima/Gaia Container App $AZURE_SIMULATION_CONTAINER_APP to $IMAGE."
    az containerapp revision set-mode \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_SIMULATION_CONTAINER_APP" \
      --mode single \
      --output none
    az containerapp update \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_SIMULATION_CONTAINER_APP" \
      --image "$IMAGE" \
      --workload-profile-name "$AZURE_SIMULATION_WORKLOAD_PROFILE" \
      --cpu "$AZURE_SIMULATION_CPU" \
      --memory "$AZURE_SIMULATION_MEMORY" \
      --min-replicas "$AZURE_SIMULATION_MIN_REPLICAS" \
      --max-replicas "$AZURE_SIMULATION_MAX_REPLICAS" \
      --command ./scripts/glitch/run-glitch-local-game-stack.sh \
      --args "" \
      --set-env-vars "${simulation_envs[@]}" \
      --output none
  else
    log "Creating dedicated Anima/Gaia Container App $AZURE_SIMULATION_CONTAINER_APP with $AZURE_SIMULATION_CPU CPU and $AZURE_SIMULATION_MEMORY memory."
    registry_username="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
    registry_password="$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)"
    az containerapp create \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_SIMULATION_CONTAINER_APP" \
      --environment "$AZURE_CONTAINER_APP_ENVIRONMENT" \
      --workload-profile-name "$AZURE_SIMULATION_WORKLOAD_PROFILE" \
      --image "$IMAGE" \
      --registry-server "$ACR_SERVER" \
      --registry-username "$registry_username" \
      --registry-password "$registry_password" \
      --ingress internal \
      --target-port "$AZURE_SIMULATION_TARGET_PORT" \
      --transport http \
      --cpu "$AZURE_SIMULATION_CPU" \
      --memory "$AZURE_SIMULATION_MEMORY" \
      --min-replicas "$AZURE_SIMULATION_MIN_REPLICAS" \
      --max-replicas "$AZURE_SIMULATION_MAX_REPLICAS" \
      --command ./scripts/glitch/run-glitch-local-game-stack.sh \
      --args "" \
      --env-vars "${simulation_envs[@]}" \
      --output none
    unset registry_password
  fi

  az containerapp ingress enable \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_SIMULATION_CONTAINER_APP" \
    --type internal \
    --target-port "$AZURE_SIMULATION_TARGET_PORT" \
    --transport http \
    --output none

  simulation_revision="$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_SIMULATION_CONTAINER_APP" \
    --query properties.latestRevisionName \
    -o tsv)"
  if [ -z "$simulation_revision" ] || [ "$simulation_revision" = "null" ]; then
    echo "ERROR Azure did not return a dedicated simulation revision after update." >&2
    exit 1
  fi

  # latestReadyRevisionName remains populated when maintenance has deactivated
  # the sole simulation revision, so readiness alone cannot prove Anima exists.
  ensure_azure_revision_active "$simulation_revision" "$AZURE_SIMULATION_CONTAINER_APP"
  wait_for_azure_revision_ready "$simulation_revision" "$AZURE_SIMULATION_CONTAINER_APP"
  wait_for_simulation_role_ready "$simulation_revision"
  verify_azure_revision_zero_restarts "$simulation_revision" "$AZURE_SIMULATION_CONTAINER_APP"
  AZURE_SIMULATION_MAINTENANCE_PAUSED=0
  AZURE_PREVIOUS_SIMULATION_REVISIONS=""
  log "Dedicated Anima/Gaia update verified: $IMAGE revision=$simulation_revision"
}

capture_azure_traffic_weights() {
  az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query "properties.configuration.ingress.traffic[].{revisionName:revisionName,weight:weight}" \
    -o tsv 2>/dev/null | awk 'NF >= 2 && $2 > 0 { print $1 "=" $2 }' || true
}

restore_azure_traffic_weights() {
  local weights_text="$1"
  local weights=()
  local rollback_revisions=()
  local active_revisions=""
  local active_revision=""
  local rollback_revision=""
  local preserve="0"
  while IFS= read -r weight; do
    [ -n "$weight" ] || continue
    weights+=("$weight")
    rollback_revisions+=("${weight%%=*}")
  done <<< "$weights_text"
  if [ "${#weights[@]}" -eq 0 ]; then
    return
  fi

  log "Restoring previous Azure revisions and traffic after failed deployment validation."
  active_revisions="$(az containerapp revision list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query '[?properties.active==`true`].name' \
    -o tsv 2>/dev/null || true)"
  while IFS= read -r active_revision; do
    [ -n "$active_revision" ] || continue
    preserve=0
    for rollback_revision in "${rollback_revisions[@]}"; do
      if [ "$active_revision" = "$rollback_revision" ]; then
        preserve=1
        break
      fi
    done
    if [ "$preserve" != "1" ]; then
      log "Deactivating failed Azure revision $active_revision before rollback."
      az containerapp revision deactivate \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --name "$AZURE_CONTAINER_APP" \
        --revision "$active_revision" >/dev/null || true
    fi
  done <<< "$active_revisions"

  for rollback_revision in "${rollback_revisions[@]}"; do
    if printf '%s\n' "$active_revisions" | grep -Fxq "$rollback_revision"; then
      log "Previous Azure revision $rollback_revision remains active."
      continue
    fi
    log "Reactivating previous Azure revision $rollback_revision."
    az containerapp revision activate \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --revision "$rollback_revision" >/dev/null || return 1
  done
  for rollback_revision in "${rollback_revisions[@]}"; do
    wait_for_azure_revision_ready "$rollback_revision" || return 1
  done

  az containerapp ingress traffic set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --revision-weight "${weights[@]}" >/dev/null || return 1
  log "Previous Azure traffic restored: ${weights[*]}"
}

AZURE_TRAFFIC_RESTORE_ARMED=0
AZURE_PREVIOUS_TRAFFIC_WEIGHTS=""

force_azure_traffic_to_revision() {
  local revision="$1"

  log "Pinning 100% production traffic to concrete ready revision $revision."
  az containerapp ingress traffic set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --revision-weight "$revision=100" >/dev/null

  confirm_azure_traffic_to_revision "$revision"
}

deactivate_stale_azure_revisions() {
  local revision="$1"
  local stale
  stale="$(az containerapp revision list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query "[?name!='${revision}' && properties.active==\`true\`].name" \
    -o tsv 2>/dev/null || true)"
  if [ -n "$stale" ]; then
    echo "$stale" | while IFS= read -r old_revision; do
      [ -z "$old_revision" ] && continue
      log "Deactivating stale Azure revision $old_revision."
      az containerapp revision deactivate \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --name "$AZURE_CONTAINER_APP" \
        --revision "$old_revision" >/dev/null || true
    done
  fi
}

confirm_azure_traffic_to_revision() {
  local revision="$1"
  local weight

  weight="$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query "properties.configuration.ingress.traffic[?revisionName=='${revision}'].weight | [0]" \
    -o tsv 2>/dev/null || true)"

  if [ "$weight" != "100" ]; then
    echo "ERROR production traffic was not pinned to ready revision $revision." >&2
    az containerapp show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --query "properties.configuration.ingress.traffic" \
      -o json >&2 || true
    exit 1
  fi

  log "Production traffic confirmed live on ready revision $revision."
}

promote_azure_revision_when_ready() {
  local revision="$1"

  if [ -z "$revision" ]; then
    echo "ERROR Azure Container App update did not report a latest revision." >&2
    exit 1
  fi

  ensure_azure_revision_active "$revision"
  wait_for_azure_revision_ready "$revision"
  verify_azure_revision_zero_restarts "$revision"
  validate_production_revision_before_traffic "$revision"
  force_azure_traffic_to_revision "$revision"
}

validate_bucket_asset_url() {
  local base="$1"
  local asset_path="$2"
  local url="${base%/}${asset_path}"
  local tmp_body tmp_headers status source_header cors_header content_type body_size
  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"

  status="$(curl -L -sS \
    -o "$tmp_body" \
    -D "$tmp_headers" \
    -H 'Origin: https://www.glitch.fun' \
    -H 'Accept: */*' \
    -H 'Sec-Fetch-Mode: cors' \
    -w '%{http_code}' \
    "$url" || true)"

  source_header="$(awk 'BEGIN{IGNORECASE=1} /^x-glitch-bucket-asset-proxy:/ {print; exit}' "$tmp_headers" | tr -d '\r')"
  cors_header="$(awk 'BEGIN{IGNORECASE=1} /^access-control-allow-origin:/ {print; exit}' "$tmp_headers" | tr -d '\r')"
  content_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print; exit}' "$tmp_headers" | tr -d '\r')"
  body_size="$(wc -c < "$tmp_body" | tr -d ' ')"

  if [ "$status" != "200" ]; then
    echo "ERROR asset validation failed: HTTP $status $url" >&2
    echo "Headers:" >&2
    cat "$tmp_headers" >&2
    echo "Body preview:" >&2
    head -c 300 "$tmp_body" >&2 || true
    echo >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  if ! printf '%s\n' "$source_header" | grep -qi 'source=local'; then
    echo "ERROR asset was not served from packaged local files: $url" >&2
    echo "  $source_header" >&2
    cat "$tmp_headers" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  if ! printf '%s\n' "$cors_header" | grep -q '\*'; then
    echo "ERROR asset is missing iframe/XHR CORS header: $url" >&2
    cat "$tmp_headers" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  if [ "$body_size" -lt 64 ]; then
    echo "ERROR asset response is suspiciously small ($body_size bytes): $url" >&2
    cat "$tmp_headers" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  echo "OK asset $asset_path status=$status bytes=$body_size ${content_type:-content-type=?} ${source_header:-source=?}"
  rm -f "$tmp_body" "$tmp_headers"
}

validate_production_bucket_assets() {
  local revision="$1"
  local revision_fqdn revision_origin
  revision_fqdn="$(azure_revision_fqdn "$revision")"
  revision_origin="https://${revision_fqdn}"

  log "Validating iframe/XHR bucket assets on production FQDN and concrete revision FQDN."
  local asset_paths=(
    "/buckets/biomes-static/assets/69/69e51f48fd43cdef37609a2b2cf880e7570e35aa"
    "/buckets/biomes-static/assets/69/69a456e2e5160e977ef7bcfbc0ee80cfbb317369"
    "/buckets/biomes-static/assets/1e/1e878ab416281b6081950cc82aaef08e48085dd7"
    "/buckets/biomes-static/assets/21/212cd24988043364c715865641e46b41d3116f32"
    "/buckets/biomes-static/assets/56/561ed3b9a76f0bee95ab938d997bc4bf9d43a019"
    "/buckets/biomes-static/assets/5e/5ec3cf5667937a74ccfdf770d3ecf69fd264e896"
    "/buckets/biomes-static/assets/7c/7c0e7fb5914777280fe9c42090ade76c05d5faf2"
    "/buckets/biomes-static/assets/9f/9f4e9e8b161077391f2f44fe088423ace9c53c68"
    "/buckets/biomes-static/assets/a0/a05dc47123f5f8a6108bec0f434388dd59798819"
    "/buckets/biomes-static/assets/b3/b3cf8c06a3c548c4dfa30c60f04c36b4a1bf8e7f"
    "/buckets/biomes-static/assets/c4/c49da8c16810b0714b8fdefd80c5165744c19800"
  )

  for asset_path in "${asset_paths[@]}"; do
    validate_bucket_asset_url "$revision_origin" "$asset_path"
    validate_bucket_asset_url "$PROD_ORIGIN" "$asset_path"
  done

  log "Production bucket asset validation passed for revision $revision."
}

validate_world_sync_http_url() {
  local base="$1"
  local path="$2"
  local label="$3"
  local expected_pattern="${4:-}"
  local url="${base%/}${path}"
  local tmp_body status body_size
  tmp_body="$(mktemp)"

  status="$(curl -L -sS \
    -o "$tmp_body" \
    -H 'Accept: application/json,text/plain,*/*' \
    -w '%{http_code}' \
    "$url" || true)"
  body_size="$(wc -c < "$tmp_body" | tr -d ' ')"

  if [ "$status" != "200" ]; then
    echo "ERROR post-deploy world sync HTTP check failed for $label: HTTP $status $url" >&2
    echo "Body preview:" >&2
    head -c 600 "$tmp_body" >&2 || true
    echo >&2
    rm -f "$tmp_body"
    exit 1
  fi

  if [ "$body_size" -lt 2 ]; then
    echo "ERROR post-deploy world sync HTTP check returned an empty response for $label: $url" >&2
    rm -f "$tmp_body"
    exit 1
  fi

  if [ -n "$expected_pattern" ] && ! grep -Eq "$expected_pattern" "$tmp_body"; then
    echo "ERROR post-deploy world sync HTTP check returned unexpected body for $label: $url" >&2
    echo "Expected pattern: $expected_pattern" >&2
    echo "Body preview:" >&2
    head -c 1000 "$tmp_body" >&2 || true
    echo >&2
    rm -f "$tmp_body"
    exit 1
  fi

  echo "OK live world endpoint $label status=$status bytes=$body_size"
  rm -f "$tmp_body"
}

validate_game_html_url() {
  local base="$1"
  local label="$2"
  local url="${base%/}/"
  local tmp_body tmp_headers status content_type body_preview
  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"

  status="$(curl -L -sS \
    -o "$tmp_body" \
    -D "$tmp_headers" \
    -H 'Accept: text/html,*/*' \
    -w '%{http_code}' \
    "$url" || true)"
  content_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print; exit}' "$tmp_headers" | tr -d '\r')"
  body_preview="$(head -c 240 "$tmp_body" | tr '\n' ' ' || true)"

  if [ "$status" != "200" ]; then
    echo "ERROR $label did not serve game HTML: HTTP $status $url" >&2
    echo "Body preview: $body_preview" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  if ! printf '%s\n' "$content_type" | grep -qi 'text/html'; then
    echo "ERROR $label did not serve text/html: ${content_type:-content-type=?} $url" >&2
    echo "Body preview: $body_preview" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  if grep -Eq '^[[:space:]]*# HELP|^[[:space:]]*# TYPE' "$tmp_body"; then
    echo "ERROR $label returned metrics instead of game HTML: $url" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  if ! grep -Eiq '<html|<!doctype html|__NEXT_DATA__' "$tmp_body"; then
    echo "ERROR $label response does not look like game HTML: $url" >&2
    echo "Body preview: $body_preview" >&2
    rm -f "$tmp_body" "$tmp_headers"
    exit 1
  fi

  echo "OK game HTML $label status=$status ${content_type:-content-type=?}"
  rm -f "$tmp_body" "$tmp_headers"
}

validate_production_revision_before_traffic() {
  local revision="$1"
  local revision_fqdn revision_origin install_id expected_sync_host attempt=1
  revision_fqdn="$(azure_revision_fqdn "$revision")"
  if [ -z "$revision_fqdn" ] || [ "$revision_fqdn" = "null" ]; then
    echo "ERROR Azure revision $revision does not have a revision-specific FQDN." >&2
    exit 1
  fi

  revision_origin="https://${revision_fqdn}"
  # The Glitch API validates real title-install UUIDs. Synthetic deployment ids
  # receive an upstream 404 even when the candidate is healthy, so this defaults
  # to the non-secret production test install and remains operator-overridable.
  install_id="$HARTHMERE_PREFLIGHT_INSTALL_ID"

  log "Smoke-testing concrete Azure revision before shifting production traffic: $revision_origin"
  validate_game_html_url "$revision_origin" "revision $revision root"
  validate_world_sync_http_url "$revision_origin" "/api/glitch/runtime_environment" "revision runtime environment" '"ok"[[:space:]]*:[[:space:]]*true'
  validate_world_sync_http_url "$revision_origin" "/api/world_map/metadata" "revision world map metadata" '"fullImageWidth"[[:space:]]*:[[:space:]]*[0-9]'
  validate_world_sync_http_url "$revision_origin" "/api/harthmere/live_mode_jobs_board_state?install_id=${install_id}" "revision jobs board shared state" '"ok"[[:space:]]*:[[:space:]]*true'
  validate_world_sync_http_url "$revision_origin" "/api/harthmere/live_mode_player_status_state?install_id=${install_id}&gameplay_active=0" "revision player status state" '"ok"[[:space:]]*:[[:space:]]*true'

  if [ "$HARTHMERE_RUN_PRODUCTION_BROWSER_E2E" != "1" ]; then
    log "Skipping browser E2E on production revision; rendered E2E is required in the local rehearsal instead."
    return
  fi

  expected_sync_host="${PROD_ORIGIN#*://}"
  expected_sync_host="${expected_sync_host%%/*}"
  expected_sync_host="${expected_sync_host%%:*}"
  while [ "$attempt" -le "${HARTHMERE_PREFLIGHT_E2E_ATTEMPTS:-2}" ]; do
    log "Running strict rendered-world browser E2E against concrete revision before traffic (attempt $attempt)."
    if HARTHMERE_E2E_EXPECTED_SYNC_HOST="$expected_sync_host" \
      HEADLESS=1 \
      STRICT_RENDER="${HARTHMERE_PREFLIGHT_STRICT_RENDER:-1}" \
      E2E_ARTIFACTS_DIR="/tmp/harthmere-pretraffic-${revision}-attempt-${attempt}" \
      node scripts/harthmere/test-harthmere-install-player-ingame-e2e.cjs . \
        --base-url "$revision_origin" \
        --install-id "$install_id"; then
      return
    fi
    if [ "$attempt" -ge "${HARTHMERE_PREFLIGHT_E2E_ATTEMPTS:-2}" ]; then
      echo "ERROR rendered-world browser E2E failed after $attempt attempts." >&2
      return 1
    fi
    log "Rendered-world E2E did not pass during candidate warmup; waiting once before retry."
    sleep "${HARTHMERE_PREFLIGHT_E2E_RETRY_SLEEP_SECONDS:-20}"
    attempt=$((attempt + 1))
  done
}

validate_production_world_sync_http() {
  local revision="$1"
  local revision_fqdn revision_origin install_id
  revision_fqdn="$(azure_revision_fqdn "$revision")"
  revision_origin="https://${revision_fqdn}"
  install_id="deploy-world-sync-${TAG}-${revision}"

  log "Validating live Harthmere world APIs on production FQDN and concrete revision FQDN."
  for base in "$revision_origin" "$PROD_ORIGIN"; do
    # Liveness/reachability: the app has no "/ready" route (that path renders the
    # Next.js 404 page). Probe the root "/" — the same path the in-container
    # healthcheck uses — then the API readiness endpoints below confirm ok:true.
    validate_game_html_url "$base" "root reachability"
    validate_world_sync_http_url "$base" "/api/glitch/runtime_environment" "runtime environment" '"ok"[[:space:]]*:[[:space:]]*true'
    validate_world_sync_http_url "$base" "/api/world_map/metadata" "world map metadata" '"fullImageWidth"[[:space:]]*:[[:space:]]*[0-9]'
    validate_world_sync_http_url "$base" "/api/harthmere/live_mode_jobs_board_state?install_id=${install_id}" "jobs board shared state" '"ok"[[:space:]]*:[[:space:]]*true'
    validate_world_sync_http_url "$base" "/api/harthmere/live_mode_player_status_state?install_id=${install_id}&gameplay_active=0" "player status state" '"ok"[[:space:]]*:[[:space:]]*true'
  done

  log "Live Harthmere world API validation passed for revision $revision."
}

# HARTHMERE_PRODUCTION_CONTENT_AUDIT:
# After reconciliation, confirm the authored content families actually exist in
# production Redis by entity-id range. This is the automatic guard that catches
# "we added content to the game but it never reached production" (e.g. the 19
# business owner NPCs that were missing). Entity ids are
# SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE (8810000000010000) + idOffset.
audit_production_authored_content() {
  if [ "${HARTHMERE_SKIP_PRODUCTION_CONTENT_AUDIT:-0}" = "1" ]; then
    log "Skipping production authored-content audit by request."
    return
  fi
  local base=8810000000010000
  count_present_id_range() {
    local lo="$1" hi="$2" off
    local keys=()
    for off in $(seq "$lo" "$hi"); do
      keys+=("b:$((base + off))")
    done
    prod_redis_cli --raw EXISTS "${keys[@]}" 2>/dev/null | tr -d '\r' || true
  }
  count_present_live_seed_family() {
    local family="$1" id present
    local keys=()
    while IFS= read -r id; do
      [ -n "$id" ] && keys+=("b:$id")
    done < <(
      IS_SERVER=1 HARTHMERE_AUDIT_SEED_FAMILY="$family" \
        node -r ts-node/register/transpile-only -r tsconfig-paths/register - <<'NODE'
const {
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} = require("./src/shared/harthmere/live_entity_production_seed");
const family = process.env.HARTHMERE_AUDIT_SEED_FAMILY;
const seeds =
  family === "muckers"
    ? harthmereGroundedMuckMonsterSeedsInTerritory()
    : harthmereGroundedLivestockSeedsInTerritory();
for (const seed of seeds) console.log(Number(seed.entityId));
NODE
    )
    if [ "${#keys[@]}" -eq 0 ]; then
      printf '0 0\n'
      return
    fi
    present="$(prod_redis_cli --raw EXISTS "${keys[@]}" 2>/dev/null | tr -d '\r' | tr -d '[:space:]' || true)"
    printf '%s %s\n' "${present:-0}" "${#keys[@]}"
  }
  local grove_npcs muckers expected_muckers livestock expected_livestock owners customers stations robots
  grove_npcs="$(count_present_id_range 9301 9320 | tr -d '[:space:]')"
  # Derive every active Mucker/Hex and animal id from the canonical grounded
  # seed manifest. Fixed legacy ranges missed late open-Wilds groups and the
  # Mossy hunt, so an audit could pass while new or relocated creatures were
  # absent from production.
  read -r muckers expected_muckers < <(count_present_live_seed_family muckers)
  read -r livestock expected_livestock < <(count_present_live_seed_family livestock)
  owners="$(count_present_id_range 9601 9619 | tr -d '[:space:]')"
  # Business crafting stations: one per business, 19 total, offsets 9651..9669
  # (clear of owners 9601-9619 and customers 9701+).
  stations="$(count_present_id_range 9651 9669 | tr -d '[:space:]')"
  # Business customers: 19 businesses x 3 patrons = 57, offsets 9701..9757.
  customers="$(count_present_id_range 9701 9757 | tr -d '[:space:]')"
  robots="$(count_present_id_range 9401 9420 | tr -d '[:space:]')"
  log "Production authored-content audit: groveNpcs=${grove_npcs} muckers=${muckers}/${expected_muckers} wildlife=${livestock}/${expected_livestock} businessOwners=${owners}/19 businessCraftingStations=${stations}/19 businessCustomers=${customers}/57 robots=${robots}"

  local failed=0
  if [ "${livestock:-0}" -lt "${expected_livestock:-0}" ]; then
    echo "ERROR wildlife (cows/sheep/rabbits) missing in production: ${livestock}/${expected_livestock}." >&2
    failed=1
  fi
  if [ "${owners:-0}" -lt 19 ]; then
    echo "ERROR business owner NPCs missing in production: ${owners}/19 — the reconciler did not materialize them." >&2
    failed=1
  fi
  if [ "${stations:-0}" -lt 19 ]; then
    echo "ERROR business crafting stations missing in production: ${stations}/19 — the reconciler did not materialize them." >&2
    failed=1
  fi
  if [ "${customers:-0}" -lt 57 ]; then
    echo "ERROR business customer NPCs missing in production: ${customers}/57 — the reconciler did not materialize them." >&2
    failed=1
  fi
  if [ "${muckers:-0}" -lt "${expected_muckers:-0}" ]; then
    echo "ERROR muck monsters missing in production: ${muckers}/${expected_muckers}." >&2
    failed=1
  fi
  if [ "${grove_npcs:-0}" -lt 1 ]; then
    echo "ERROR Snapshot Grove NPCs missing in production: ${grove_npcs}." >&2
    failed=1
  fi
  if [ "$failed" = "1" ]; then
    echo "ERROR production authored-content audit FAILED — prod/local content discrepancy not resolved." >&2
    exit 1
  fi
  log "Production authored-content audit passed: all authored families materialized in production."
}

# HARTHMERE_ENTITY_GROUNDING_PROBE:
# Probe the real production terrain for every deterministic NPC, hostile,
# Mucker, animal, robot, business occupant, and seeded business object. The
# probe repairs original-map hilly placements and verifies additive Harthmere's
# flat Y=53 contract with persisted ECS readback. It is a required deployment
# gate; use HARTHMERE_SKIP_GROUNDING_PROBE=1 only for an explicit emergency
# app-only rollout.
run_production_grounding_probe() {
  if [ "${HARTHMERE_SKIP_GROUNDING_PROBE:-0}" = "1" ]; then
    log "Skipping production terrain grounding repair/audit by request."
    return
  fi
  log "Repairing and auditing production terrain grounding for all deterministic actor/object families."
  REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    GLITCH_REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    REDIS_PORT="${HARTHMERE_WORLD_SYNC_REDIS_PORT:-$PROD_REDIS_PORT}" \
    IS_SERVER=1 \
    APPLY=1 \
    node scripts/harthmere/probe-production-terrain-grounding.cjs
}

run_production_live_creature_grounding_reconcile() {
  if [ "${HARTHMERE_SKIP_LIVE_CREATURE_GROUNDING_RECONCILE:-0}" = "1" ]; then
    log "Skipping production live-creature grounding reconciliation by request."
    return
  fi
  log "Repairing and auditing persisted Mucker, Hex, and animal bodies against final production terrain."
  REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    GLITCH_REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    LOCAL_REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    REDIS_PORT="${HARTHMERE_WORLD_SYNC_REDIS_PORT:-$PROD_REDIS_PORT}" \
    GLITCH_REDIS_PORT="${HARTHMERE_WORLD_SYNC_REDIS_PORT:-$PROD_REDIS_PORT}" \
    IS_SERVER=1 \
    APPLY=1 \
    node scripts/harthmere/reconcile-production-live-creature-grounding.cjs
}

harthmere_business_outpost_ids() {
  node -r ts-node/register/transpile-only -r tsconfig-paths/register - <<'NODE'
const { HARTHMERE_BUSINESS_OUTPOSTS } = require("./src/shared/harthmere/business_customer_simulator");
for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
  console.log(outpost.outpostId);
}
NODE
}

materialize_production_business_outposts() {
  local redis_host redis_port scan_count shard_batch_size mode
  redis_host="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}"
  redis_port="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_REDIS_PORT:-$PROD_REDIS_PORT}"
  scan_count="$HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_SCAN_COUNT"
  shard_batch_size="$HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE"
  mode="$HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE"

  if [ "$mode" = "bulk" ]; then
    log "Reconciling all Harthmere business outpost terrain in one materializer process."
    APPLY=1 \
      IS_SERVER=1 \
      REDIS_HOST="$redis_host" \
      GLITCH_REDIS_HOST="$redis_host" \
      LOCAL_REDIS_HOST="$redis_host" \
      REDIS_PORT="$redis_port" \
      GLITCH_REDIS_PORT="$redis_port" \
      SCAN_COUNT="$scan_count" \
      APPLY_SHARD_BATCH_SIZE="$shard_batch_size" \
      node scripts/harthmere/materialize-business-outposts-redis.cjs
    return
  fi

  if [ "$mode" != "per-outpost" ]; then
    echo "ERROR unknown HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE=$mode; expected per-outpost or bulk." >&2
    exit 1
  fi

  log "Reconciling Harthmere business outpost terrain one outpost at a time to avoid production OOM."
  local outpost_ids outpost_id materialized_count expected_count
  outpost_ids="$(harthmere_business_outpost_ids)"
  materialized_count=0
  expected_count=19
  while IFS= read -r outpost_id; do
    [ -n "$outpost_id" ] || continue
    log "Reconciling Harthmere business outpost terrain: $outpost_id"
    APPLY=1 \
      IS_SERVER=1 \
      REDIS_HOST="$redis_host" \
      GLITCH_REDIS_HOST="$redis_host" \
      LOCAL_REDIS_HOST="$redis_host" \
      REDIS_PORT="$redis_port" \
      GLITCH_REDIS_PORT="$redis_port" \
      SCAN_COUNT="$scan_count" \
      APPLY_SHARD_BATCH_SIZE="$shard_batch_size" \
      OUTPOST_ID="$outpost_id" \
      node scripts/harthmere/materialize-business-outposts-redis.cjs
    materialized_count=$((materialized_count + 1))
  done <<< "$outpost_ids"

  if [ "$materialized_count" -ne "$expected_count" ]; then
    echo "ERROR business outpost terrain materialization processed ${materialized_count}/${expected_count} outposts." >&2
    exit 1
  fi
  log "Harthmere business outpost terrain materialization processed ${materialized_count}/${expected_count} outposts."
}

materialize_production_harthmere_connector_route() {
  local redis_host redis_port
  redis_host="${HARTHMERE_CONNECTOR_ROUTE_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}"
  redis_port="${HARTHMERE_CONNECTOR_ROUTE_REDIS_PORT:-$PROD_REDIS_PORT}"

  log "Reconciling the protected Grove-to-Harthmere player route against production terrain."
  APPLY=1 \
    IS_SERVER=1 \
    REDIS_HOST="$redis_host" \
    GLITCH_REDIS_HOST="$redis_host" \
    LOCAL_REDIS_HOST="$redis_host" \
    REDIS_PORT="$redis_port" \
    GLITCH_REDIS_PORT="$redis_port" \
    SCAN_COUNT="$HARTHMERE_CONNECTOR_ROUTE_SCAN_COUNT" \
    APPLY_SHARD_BATCH_SIZE="$HARTHMERE_CONNECTOR_ROUTE_APPLY_SHARD_BATCH_SIZE" \
    node scripts/harthmere/materialize-harthmere-connector-route.cjs
}

audit_production_harthmere_extension_terrain() {
  log "Auditing the complete additive Harthmere foundation and flat Y=52 surface."
  IS_SERVER=1 \
    REDIS_HOST="${HARTHMERE_TERRAIN_AUDIT_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    GLITCH_REDIS_HOST="${HARTHMERE_TERRAIN_AUDIT_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    LOCAL_REDIS_HOST="${HARTHMERE_TERRAIN_AUDIT_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    REDIS_PORT="${HARTHMERE_TERRAIN_AUDIT_REDIS_PORT:-$PROD_REDIS_PORT}" \
    GLITCH_REDIS_PORT="${HARTHMERE_TERRAIN_AUDIT_REDIS_PORT:-$PROD_REDIS_PORT}" \
    node scripts/harthmere/audit-production-extension-terrain.cjs
}

wait_for_production_harthmere_extension_terrain_audit() {
  local attempt=1
  local max_attempts="${HARTHMERE_TERRAIN_AUDIT_POLLS:-90}"
  while [ "$attempt" -le "$max_attempts" ]; do
    if audit_production_harthmere_extension_terrain; then
      return 0
    fi
    log "Harthmere terrain seed is still converging (${attempt}/${max_attempts}); waiting before the next audit."
    attempt=$((attempt + 1))
    sleep "${HARTHMERE_TERRAIN_AUDIT_SLEEP_SECONDS:-10}"
  done
  echo "ERROR Harthmere extension terrain did not pass its production audit." >&2
  return 1
}

delete_azure_world_sync_job() {
  if [ "$HARTHMERE_WORLD_SYNC_JOB_CREATED" != "1" ]; then
    return
  fi
  log "Deleting temporary Harthmere reconciliation job $HARTHMERE_WORLD_SYNC_JOB_NAME."
  az containerapp job delete \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
    --yes \
    --output none >/dev/null 2>&1 || true
  HARTHMERE_WORLD_SYNC_JOB_CREATED=0
}

delete_azure_terrain_job() {
  if [ "$HARTHMERE_TERRAIN_JOB_CREATED" != "1" ]; then
    return
  fi
  log "Deleting temporary Harthmere terrain job $HARTHMERE_TERRAIN_JOB_NAME."
  az containerapp job delete \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_JOB_NAME" \
    --yes \
    --output none >/dev/null 2>&1 || true
  HARTHMERE_TERRAIN_JOB_CREATED=0
}

delete_azure_terrain_audit_job() {
  if [ "$HARTHMERE_TERRAIN_AUDIT_JOB_CREATED" != "1" ]; then
    return
  fi
  log "Deleting temporary Harthmere terrain audit job $HARTHMERE_TERRAIN_AUDIT_JOB_NAME."
  az containerapp job delete \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
    --yes \
    --output none >/dev/null 2>&1 || true
  HARTHMERE_TERRAIN_AUDIT_JOB_CREATED=0
}

run_azure_terrain_audit_job() {
  local registry_username registry_password execution status="" polls=0 logs=""

  if az containerapp job show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
    --output none >/dev/null 2>&1; then
    az containerapp job delete \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
      --yes \
      --output none
  fi

  registry_username="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
  registry_password="$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)"
  log "Creating post-simulation authored-terrain audit; dynamic player and Gaia overlays are preserved."
  az containerapp job create \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
    --environment "$AZURE_CONTAINER_APP_ENVIRONMENT" \
    --trigger-type Manual \
    --replica-timeout 1800 \
    --replica-retry-limit 0 \
    --replica-completion-count 1 \
    --parallelism 1 \
    --workload-profile-name "$HARTHMERE_WORLD_SYNC_JOB_WORKLOAD_PROFILE" \
    --image "$IMAGE" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$registry_username" \
    --registry-password "$registry_password" \
    --container-name "$HARTHMERE_TERRAIN_AUDIT_JOB_CONTAINER_NAME" \
    --cpu "$HARTHMERE_WORLD_SYNC_JOB_CPU" \
    --memory "$HARTHMERE_WORLD_SYNC_JOB_MEMORY" \
    --command node \
    --args scripts/harthmere/audit-production-extension-terrain.cjs \
    --env-vars \
      NODE_ENV=production \
      NODE_OPTIONS="--openssl-legacy-provider --enable-source-maps --max-old-space-size=8192" \
      NODE_PATH=/opt/harthmere-maintenance/node_modules \
      IS_SERVER=1 \
      REDIS_HOST="$PROD_REDIS_HOST" \
      GLITCH_REDIS_HOST="$PROD_REDIS_HOST" \
      LOCAL_REDIS_HOST="$PROD_REDIS_HOST" \
      REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT" \
      ALLOW_NON_K8_REDIS=1 \
      USE_K8_REDIS=0 \
      BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600 \
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0 \
      HARTHMERE_TERRAIN_AUDIT_MODE=authored \
    --output none
  unset registry_password
  HARTHMERE_TERRAIN_AUDIT_JOB_CREATED=1

  execution="$(az containerapp job start \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
    --query name -o tsv)"
  while [ "$polls" -lt "${HARTHMERE_TERRAIN_AUDIT_JOB_POLLS:-180}" ]; do
    status="$(az containerapp job execution show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
      --job-execution-name "$execution" \
      --query properties.status -o tsv 2>/dev/null || true)"
    case "$status" in
      Succeeded|Failed|Stopped|Degraded) break ;;
    esac
    polls=$((polls + 1))
    sleep "${HARTHMERE_WORLD_SYNC_JOB_POLL_SECONDS:-10}"
  done
  logs="$(az containerapp job logs show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_AUDIT_JOB_NAME" \
    --execution "$execution" \
    --container "$HARTHMERE_TERRAIN_AUDIT_JOB_CONTAINER_NAME" \
    --tail 300 \
    --format text 2>&1 || true)"
  printf '%s\n' "$logs"
  if [ "$status" != "Succeeded" ] ||
     ! printf '%s\n' "$logs" | grep -Fq "OK Harthmere authored terrain is complete and valid while player and simulation overlays remain preserved."; then
    echo "ERROR post-simulation terrain audit failed: execution=$execution status=${status:-unknown}." >&2
    delete_azure_terrain_audit_job
    return 1
  fi
  log "Post-simulation authored-terrain audit passed without treating player edits or dynamic Muck as corruption."
  delete_azure_terrain_audit_job
}

run_azure_terrain_seed_job() {
  local registry_username registry_password execution status="" polls=0 logs=""
  local terrain_command terrain_command_b64 terrain_eval_arg

  if az containerapp job show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_JOB_NAME" \
    --output none >/dev/null 2>&1; then
    az containerapp job delete \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_TERRAIN_JOB_NAME" \
      --yes \
      --output none
  fi

  # The shim performs the exact production terrain seed. A Container Apps Job
  # avoids inheriting the web revision's 15-minute startup probe, which would
  # restart this intentional ~30-minute maintenance operation. The wrapper
  # exits only after the shim's completion log and an authored-seed audit.
  # Azure CLI treats dash-prefixed values after --args as CLI options. Pass a
  # single --eval=<wrapper> Node argument instead, with the wrapper encoded so
  # its shell metacharacters and newlines survive CLI and ARM serialization.
  terrain_command='const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const logPath = "/tmp/harthmere-terrain.log";
const logFd = fs.openSync(logPath, "w");
const shim = spawn(process.execPath, ["dist/shim.js", "--bootstrapMode", "sync"], {
  env: process.env,
  stdio: ["ignore", logFd, logFd],
});
const cleanup = () => {
  if (shim.exitCode === null && !shim.killed) shim.kill("SIGTERM");
};
process.on("SIGTERM", () => { cleanup(); process.exit(143); });
process.on("SIGINT", () => { cleanup(); process.exit(130); });
process.on("exit", cleanup);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readLog = () => {
  try { return fs.readFileSync(logPath, "utf8"); } catch { return ""; }
};
(async () => {
  for (let attempt = 1; attempt <= 720; attempt += 1) {
    if (shim.exitCode !== null) {
      process.stdout.write(readLog());
      throw new Error(`Harthmere terrain shim exited before completion (status ${shim.exitCode}).`);
    }
    const output = readLog();
    if (output.includes("Seeded local dev starter town")) {
      process.stdout.write(output);
      const nodePath = "/opt/harthmere-maintenance/node_modules" +
        (process.env.NODE_PATH ? `:${process.env.NODE_PATH}` : "");
      const audit = spawnSync(process.execPath, ["scripts/harthmere/audit-production-extension-terrain.cjs"], {
        env: { ...process.env, NODE_PATH: nodePath },
        stdio: "inherit",
      });
      if (audit.status !== 0) throw new Error(`Harthmere terrain audit failed (status ${audit.status}).`);
      console.log("HARTHMERE_TERRAIN_MAINTENANCE_READY");
      cleanup();
      return;
    }
    if (attempt % 30 === 0) {
      console.log(output.split("\n").slice(-20).join("\n"));
    }
    await sleep(5000);
  }
  process.stdout.write(readLog());
  throw new Error("Timed out waiting for Harthmere terrain maintenance.");
})().catch((error) => {
  console.error(`ERROR ${error.message}`);
  cleanup();
  process.exitCode = 1;
});'
  terrain_command_b64="$(printf '%s' "$terrain_command" | base64 | tr -d '\n')"
  terrain_eval_arg="--eval=eval(Buffer.from('${terrain_command_b64}','base64').toString())"

  registry_username="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
  registry_password="$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)"
  log "Creating temporary in-VNet Harthmere terrain job (no web startup probe)."
  az containerapp job create \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_JOB_NAME" \
    --environment "$AZURE_CONTAINER_APP_ENVIRONMENT" \
    --trigger-type Manual \
    --replica-timeout "$HARTHMERE_WORLD_SYNC_JOB_TIMEOUT_SECONDS" \
    --replica-retry-limit 0 \
    --replica-completion-count 1 \
    --parallelism 1 \
    --workload-profile-name "$HARTHMERE_WORLD_SYNC_JOB_WORKLOAD_PROFILE" \
    --image "$IMAGE" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$registry_username" \
    --registry-password "$registry_password" \
    --container-name "$HARTHMERE_TERRAIN_JOB_CONTAINER_NAME" \
    --cpu "$HARTHMERE_WORLD_SYNC_JOB_CPU" \
    --memory "$HARTHMERE_WORLD_SYNC_JOB_MEMORY" \
    --command node \
    --args="$terrain_eval_arg" \
    --env-vars \
      NODE_ENV=production \
      NODE_OPTIONS="--openssl-legacy-provider --enable-source-maps --max-old-space-size=8192" \
      IS_SERVER=1 \
      REDIS_HOST="$PROD_REDIS_HOST" \
      GLITCH_REDIS_HOST="$PROD_REDIS_HOST" \
      LOCAL_REDIS_HOST="$PROD_REDIS_HOST" \
      REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT" \
      ALLOW_NON_K8_REDIS=1 \
      USE_K8_REDIS=0 \
      GLITCH_RUNTIME=1 \
      GLITCH_DISABLE_GCP=1 \
      GLITCH_SKIP_GCE_METADATA=1 \
      GLITCH_SKIP_GOOGLE_SECRETS=1 \
      GLITCH_DISABLE_DISCORD=1 \
      GLITCH_DISABLE_ASSET_MIRROR=1 \
      GLITCH_SKIP_PROD_TRAY=1 \
      SKIP_PROD_LOAD=true \
      SKIP_MISSING_ASSET_CHECK=true \
      GLITCH_REDIS_MODE=external \
      DISTRIBUTED_NOTIFIER_KIND=redis \
      GLITCH_STORAGE_MODE=memory \
      GLITCH_SHIM_STORAGE_MODE=memory \
      GLITCH_WORLD_API_MODE=hfc-hybrid \
      GLITCH_BISCUIT_MODE=redis2 \
      GLITCH_BIKKIE_CACHE_MODE=redis \
      GLITCH_POPULATE_SNAPSHOT_REDIS=0 \
      GLITCH_REQUIRE_SNAPSHOT_REDIS=1 \
      BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
      BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 \
      BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED=0 \
      BIOMES_TERRAIN_SEED_MODE="$HARTHMERE_TERRAIN_SEED_MODE" \
      BIOMES_MIGRATE_HARTHMERE_AUTHORED_WATER="${BIOMES_MIGRATE_HARTHMERE_AUTHORED_WATER:-0}" \
      BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED="${BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED:-0}" \
      BIOMES_SKIP_RETIRED_TERRAIN_SCAN=1 \
      BIOMES_SKIP_BIKKIE_NAMES_WRITE=1 \
      BIOMES_SKIP_PLAYER_SPATIAL_OBSERVER=1 \
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600 \
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0 \
    --output none
  unset registry_password
  HARTHMERE_TERRAIN_JOB_CREATED=1

  execution="$(az containerapp job start \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_JOB_NAME" \
    --query name -o tsv)"
  while [ "$polls" -lt "${HARTHMERE_WORLD_SYNC_JOB_POLLS:-1080}" ]; do
    status="$(az containerapp job execution show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_TERRAIN_JOB_NAME" \
      --job-execution-name "$execution" \
      --query properties.status -o tsv 2>/dev/null || true)"
    case "$status" in
      Succeeded|Failed) break ;;
    esac
    polls=$((polls + 1))
    sleep "${HARTHMERE_WORLD_SYNC_JOB_SLEEP_SECONDS:-10}"
  done
  logs="$(az containerapp job logs show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_TERRAIN_JOB_NAME" \
    --execution "$execution" \
    --container "$HARTHMERE_TERRAIN_JOB_CONTAINER_NAME" \
    --tail 300 2>&1 || true)"
  printf '%s\n' "$logs"
  if [ "$status" != "Succeeded" ] || ! printf '%s\n' "$logs" | grep -q "HARTHMERE_TERRAIN_MAINTENANCE_READY"; then
    echo "ERROR Harthmere terrain job failed: execution=$execution status=${status:-unknown}." >&2
    delete_azure_terrain_job
    return 1
  fi
  log "Harthmere terrain job passed the complete foundation audit: $execution."
  delete_azure_terrain_job
}

run_azure_world_sync_job() {
  local registry_username registry_password execution status="" polls=0 logs=""

  if az containerapp job show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
    --output none >/dev/null 2>&1; then
    log "Removing stale Harthmere reconciliation job $HARTHMERE_WORLD_SYNC_JOB_NAME."
    az containerapp job delete \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
      --yes \
      --output none
  fi

  registry_username="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
  registry_password="$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)"
  log "Creating temporary in-VNet Harthmere reconciliation job (${HARTHMERE_WORLD_SYNC_JOB_CPU} CPU, ${HARTHMERE_WORLD_SYNC_JOB_MEMORY})."
  az containerapp job create \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
    --environment "$AZURE_CONTAINER_APP_ENVIRONMENT" \
    --trigger-type Manual \
    --replica-timeout "$HARTHMERE_WORLD_SYNC_JOB_TIMEOUT_SECONDS" \
    --replica-retry-limit 0 \
    --replica-completion-count 1 \
    --parallelism 1 \
    --workload-profile-name "$HARTHMERE_WORLD_SYNC_JOB_WORKLOAD_PROFILE" \
    --image "$IMAGE" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$registry_username" \
    --registry-password "$registry_password" \
    --container-name "$HARTHMERE_WORLD_SYNC_JOB_CONTAINER_NAME" \
    --cpu "$HARTHMERE_WORLD_SYNC_JOB_CPU" \
    --memory "$HARTHMERE_WORLD_SYNC_JOB_MEMORY" \
    --command ./scripts/glitch/run-harthmere-production-reconciliation.sh \
    --env-vars \
      NODE_ENV=production \
      NODE_OPTIONS="--openssl-legacy-provider --enable-source-maps --max-old-space-size=8192" \
      IS_SERVER=1 \
      APPLY=1 \
      REDIS_HOST="$PROD_REDIS_HOST" \
      GLITCH_REDIS_HOST="$PROD_REDIS_HOST" \
      LOCAL_REDIS_HOST="$PROD_REDIS_HOST" \
      REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT" \
      ALLOW_NON_K8_REDIS=1 \
      USE_K8_REDIS=0 \
      BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600 \
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0 \
      HARTHMERE_DEPLOY_TAG="$TAG" \
      HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE="$HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE" \
      HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_SCAN_COUNT="$HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_SCAN_COUNT" \
      HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE="$HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE" \
      HARTHMERE_CONNECTOR_ROUTE_SCAN_COUNT="$HARTHMERE_CONNECTOR_ROUTE_SCAN_COUNT" \
      HARTHMERE_CONNECTOR_ROUTE_APPLY_SHARD_BATCH_SIZE="$HARTHMERE_CONNECTOR_ROUTE_APPLY_SHARD_BATCH_SIZE" \
      HARTHMERE_SKIP_BUSINESS_OUTPOST_MATERIALIZATION="${HARTHMERE_SKIP_BUSINESS_OUTPOST_MATERIALIZATION:-0}" \
      HARTHMERE_SKIP_CONNECTOR_ROUTE_MATERIALIZATION="${HARTHMERE_SKIP_CONNECTOR_ROUTE_MATERIALIZATION:-0}" \
      HARTHMERE_SKIP_GROUNDING_PROBE="${HARTHMERE_SKIP_GROUNDING_PROBE:-0}" \
      HARTHMERE_SKIP_LIVE_CREATURE_GROUNDING_RECONCILE="${HARTHMERE_SKIP_LIVE_CREATURE_GROUNDING_RECONCILE:-0}" \
    --output none
  unset registry_password
  HARTHMERE_WORLD_SYNC_JOB_CREATED=1

  log "Starting Harthmere production reconciliation inside the Azure VNet."
  execution="$(az containerapp job start \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
    --query name \
    -o tsv)"
  if [ -z "$execution" ]; then
    execution="$(az containerapp job execution list \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
      --query 'sort_by(@,&properties.startTime)[-1].name' \
      -o tsv)"
  fi
  if [ -z "$execution" ]; then
    echo "ERROR Azure did not return a Harthmere reconciliation execution name." >&2
    exit 1
  fi

  while [ "$polls" -lt "${HARTHMERE_WORLD_SYNC_JOB_POLLS:-1080}" ]; do
    status="$(az containerapp job execution show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
      --job-execution-name "$execution" \
      --query properties.status \
      -o tsv 2>/dev/null || true)"
    case "$status" in
      Succeeded)
        break
        ;;
      Failed|Stopped|Degraded)
        break
        ;;
    esac
    polls=$((polls + 1))
    if [ $((polls % 6)) -eq 0 ]; then
      log "Harthmere reconciliation job status: ${status:-Pending} (${polls}/${HARTHMERE_WORLD_SYNC_JOB_POLLS:-1080})."
    fi
    sleep "${HARTHMERE_WORLD_SYNC_JOB_POLL_SECONDS:-10}"
  done

  logs="$(az containerapp job logs show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$HARTHMERE_WORLD_SYNC_JOB_NAME" \
    --execution "$execution" \
    --container "$HARTHMERE_WORLD_SYNC_JOB_CONTAINER_NAME" \
    --tail 300 \
    --format text 2>&1 || true)"
  printf '%s\n' "$logs"

  if [ "$status" != "Succeeded" ]; then
    echo "ERROR Harthmere reconciliation job did not succeed: execution=$execution status=${status:-unknown}." >&2
    delete_azure_world_sync_job
    exit 1
  fi
  if ! printf '%s\n' "$logs" | grep -q "HARTHMERE_PRODUCTION_RECONCILIATION_READY tag=$TAG"; then
    echo "ERROR Harthmere reconciliation job succeeded without the required read-back success marker." >&2
    delete_azure_world_sync_job
    exit 1
  fi

  log "Harthmere reconciliation job passed all migration and read-back gates: $execution."
  delete_azure_world_sync_job
}

seed_production_harthmere_extension_terrain() {
  local candidate_revision="$1"
  local max_suffix_length
  local suffix
  local tag_slug

  if [ "${HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION:-0}" = "1" ]; then
    log "Skipping additive Harthmere terrain maintenance during an explicit app-only rollout."
    return
  fi
  if [ "${HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED:-0}" = "1" ]; then
    log "Skipping additive Harthmere terrain seed by request."
    return
  fi

  log "Running Harthmere terrain maintenance in $HARTHMERE_TERRAIN_SEED_MODE mode (additive is the ordinary deployment default)."

  if use_azure_world_sync_job; then
    run_azure_terrain_seed_job
    return
  fi

  # The normal web revision deliberately leaves startup terrain seeding off so
  # three replicas cannot race the same Redis writes. A temporary one-replica,
  # zero-traffic copy performs the idempotent seed before promotion instead.
  wait_for_azure_revision_ready "$candidate_revision"
  # Azure limits the complete "<app>--<suffix>" revision name to 54
  # characters. Derive the suffix budget from the actual app name so long,
  # descriptive image tags cannot fail after the candidate is already ready.
  max_suffix_length=$((54 - ${#AZURE_CONTAINER_APP} - 2))
  if [ "$max_suffix_length" -lt 9 ]; then
    echo "ERROR Azure Container App name leaves no safe terrain revision suffix budget: $AZURE_CONTAINER_APP" >&2
    exit 1
  fi
  tag_slug="$(printf '%s' "$TAG" | tr '[:upper:]_' '[:lower:]-' | tr -cd 'a-z0-9-')"
  suffix="$(printf 'terrain-%s' "$tag_slug" | cut -c1-"$max_suffix_length")"
  log "Creating one-replica Harthmere terrain maintenance revision from $candidate_revision."
  HARTHMERE_TERRAIN_MAINTENANCE_REVISION="$(az containerapp revision copy \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --from-revision "$candidate_revision" \
    --revision-suffix "$suffix" \
    --min-replicas 1 \
    --max-replicas 1 \
    --set-env-vars \
      BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 \
      BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED=0 \
      BIOMES_TERRAIN_SEED_MODE="$HARTHMERE_TERRAIN_SEED_MODE" \
      BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED="${BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED:-0}" \
      GLITCH_ENABLE_STREAM_WORKERS=0 \
    --query properties.latestRevisionName \
    -o tsv)"
  if [ -z "$HARTHMERE_TERRAIN_MAINTENANCE_REVISION" ]; then
    echo "ERROR Azure did not return the Harthmere terrain maintenance revision name." >&2
    exit 1
  fi

  # A complete 2,362-shard Harthmere rebuild intentionally runs longer than a
  # normal web cold start. Give this isolated zero-traffic revision up to one
  # hour while keeping the ordinary candidate/rollback readiness gate short.
  wait_for_azure_revision_ready \
    "$HARTHMERE_TERRAIN_MAINTENANCE_REVISION" \
    "$AZURE_CONTAINER_APP" \
    "${HARTHMERE_TERRAIN_MAINTENANCE_READY_POLLS:-360}"
  if use_azure_world_sync_job; then
    # Shim startup awaits the terrain seed before the revision becomes ready.
    # The in-VNet job audits the complete foundation before applying outposts.
    log "Deferring the private-Redis terrain read-back audit to the in-VNet reconciliation job."
  else
    wait_for_production_harthmere_extension_terrain_audit
  fi
  log "Deactivating completed Harthmere terrain maintenance revision $HARTHMERE_TERRAIN_MAINTENANCE_REVISION."
  az containerapp revision deactivate \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --revision "$HARTHMERE_TERRAIN_MAINTENANCE_REVISION" >/dev/null
  HARTHMERE_TERRAIN_MAINTENANCE_REVISION=""
}

reconcile_production_world_sync() {
  local revision="$1"

  if [ "${HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION:-0}" = "1" ]; then
    log "Skipping Harthmere production world sync reconciliation by request."
    return
  fi
  if [ "${HARTHMERE_SKIP_RECONCILIATION_AFTER_TERRAIN:-0}" = "1" ]; then
    log "Skipping broad Harthmere outpost/ECS/connector reconciliation after targeted terrain maintenance."
    return
  fi

  check_production_redis_aof_health "post-deploy world sync"
  check_production_redis_snapshot_hash "post-deploy world sync"

  if use_azure_world_sync_job; then
    run_azure_world_sync_job
    validate_production_world_sync_http "$revision"
    audit_production_authored_content
    force_production_redis_bgsave "post-deploy world sync and grounding reconciliation"
    return
  fi

  if [ "${HARTHMERE_SKIP_BUSINESS_OUTPOST_MATERIALIZATION:-0}" != "1" ]; then
    log "Reconciling Harthmere business outpost terrain against production Redis."
    materialize_production_business_outposts
  else
    log "Skipping Harthmere business outpost terrain reconciliation by request."
  fi

  log "Reconciling Harthmere production world sync against production Redis."
  APPLY=1 \
    IS_SERVER=1 \
    REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    GLITCH_REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    LOCAL_REDIS_HOST="${HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST}" \
    REDIS_PORT="${HARTHMERE_WORLD_SYNC_REDIS_PORT:-$PROD_REDIS_PORT}" \
    GLITCH_REDIS_PORT="${HARTHMERE_WORLD_SYNC_REDIS_PORT:-$PROD_REDIS_PORT}" \
    node scripts/harthmere/reconcile-production-world-sync.cjs

  # The protected player route must be the final terrain writer. Town/world
  # sync can legitimately rebuild nearby Harthmere terrain, so applying the
  # connector before it risks burying the tunnel/causeway again.
  if [ "${HARTHMERE_SKIP_CONNECTOR_ROUTE_MATERIALIZATION:-0}" != "1" ]; then
    materialize_production_harthmere_connector_route
  else
    log "Skipping Grove-to-Harthmere connector route reconciliation by request."
  fi

  validate_production_world_sync_http "$revision"
  audit_production_authored_content
  run_production_grounding_probe
  run_production_live_creature_grounding_reconcile
  force_production_redis_bgsave "post-deploy world sync and grounding reconciliation"
}

cleanup() {
  local status="$?"
  delete_azure_world_sync_job
  delete_azure_terrain_job
  delete_azure_terrain_audit_job
  if [ -n "${HARTHMERE_TERRAIN_MAINTENANCE_REVISION:-}" ]; then
    log "Deactivating unfinished Harthmere terrain maintenance revision $HARTHMERE_TERRAIN_MAINTENANCE_REVISION."
    az containerapp revision deactivate \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --revision "$HARTHMERE_TERRAIN_MAINTENANCE_REVISION" >/dev/null 2>&1 || true
    HARTHMERE_TERRAIN_MAINTENANCE_REVISION=""
  fi
  if [ "$status" -ne 0 ] && [ "${AZURE_TRAFFIC_RESTORE_ARMED:-0}" = "1" ]; then
    AZURE_TRAFFIC_RESTORE_ARMED=0
    if ! restore_azure_traffic_weights "$AZURE_PREVIOUS_TRAFFIC_WEIGHTS"; then
      echo "ERROR automatic Azure traffic rollback failed; manual intervention is required." >&2
    fi
  fi
  if [ "$status" -ne 0 ] && [ "$AZURE_SIMULATION_MAINTENANCE_PAUSED" = "1" ]; then
    if ! restore_previous_simulation_after_failed_maintenance; then
      echo "ERROR automatic simulation restoration failed; manual intervention is required." >&2
    fi
  fi
  # Image-only builds do not own an already-running local rehearsal stack.
  # Removing the default container names here destroyed a warm Redis/world
  # even though this invocation never started local smoke at all.
  if [ "$RUN_LOCAL_SMOKE" != "1" ]; then
    return
  fi
  if [ "$KEEP_LOCAL_SMOKE" = "1" ]; then
    log "Keeping local smoke containers: $LOCAL_APP_CONTAINER, $LOCAL_REDIS_CONTAINER"
    return
  fi
  docker rm -f "$LOCAL_APP_CONTAINER" "$LOCAL_REDIS_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fetch_title_token_if_needed() {
  if [ -n "${GLITCH_TITLE_TOKEN:-}" ]; then
    return
  fi
  if ! command -v az >/dev/null 2>&1; then
    echo "ERROR GLITCH_TITLE_TOKEN is not set and az is not available to read the Container App secret." >&2
    exit 1
  fi
  log "Reading GLITCH_TITLE_TOKEN from Azure Container App secret."
  GLITCH_TITLE_TOKEN="$(
    az containerapp secret show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --secret-name glitch-title-token \
      --query value \
      -o tsv
  )"
  export GLITCH_TITLE_TOKEN
  if [ -z "$GLITCH_TITLE_TOKEN" ]; then
    echo "ERROR Azure secret glitch-title-token was empty." >&2
    exit 1
  fi
}

ensure_generated_ts_deps() {
  log "Generating TypeScript dependencies for production route imports."
  if ! command -v bazel >/dev/null 2>&1 && ! command -v bazelisk >/dev/null 2>&1; then
    echo "ERROR Bazel/Bazelisk is required to generate TypeScript dependencies." >&2
    echo "Install it with: npm install -g @bazel/bazelisk" >&2
    exit 1
  fi
  ./b --no-check-ts-deps ts-deps build
}

count_files_under() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    printf '0\n'
    return
  fi
  find "$dir" -type f | wc -l | tr -d '[:space:]'
}

count_harthmere_runtime_assets() {
  local dir="public/assets/harthmere"
  if [ ! -d "$dir" ]; then
    printf '0\n'
    return
  fi
  find "$dir" -path "$dir/_source" -prune -o -type f -print | wc -l | tr -d '[:space:]'
}

ensure_harthmere_runtime_assets() {
  local runtime_count
  runtime_count="$(count_harthmere_runtime_assets)"
  if [ "$runtime_count" -ge 6500 ]; then
    log "Harthmere runtime assets are present ($runtime_count files)."
    return
  fi

  if command -v git >/dev/null 2>&1 && git lfs version >/dev/null 2>&1; then
    log "Refreshing Git LFS Harthmere runtime assets."
    git lfs pull --include="public/assets/harthmere/**" --exclude=""
    runtime_count="$(count_harthmere_runtime_assets)"
  fi

  if [ "$runtime_count" -lt 6500 ]; then
    echo "ERROR Harthmere runtime assets are incomplete ($runtime_count files)." >&2
    echo "Run git lfs pull --include=\"public/assets/harthmere/**\" --exclude=\"\" and retry." >&2
    exit 1
  fi
}

ensure_harthmere_voice_assets() {
  local manifest="public/harthmere/voices/generated/current/manifest.json"
  # Focused local browser builds may proceed with the already-hydrated voice
  # subset while the separate recording task updates its catalog. Production
  # builds remain strict because this opt-out is disabled by default.
  if [ "${HARTHMERE_SKIP_VOICE_ASSET_CHECK:-0}" = "1" ]; then
    log "Skipping Harthmere voice-manifest completeness for targeted local build."
    return
  fi
  if [ -f "$manifest" ] &&
     node scripts/harthmere/check-harthmere-npc-voice-recordings.cjs . >/dev/null 2>&1; then
    log "Harthmere NPC voice recordings are present and hydrated."
    return
  fi

  if command -v git >/dev/null 2>&1 && git lfs version >/dev/null 2>&1; then
    log "Refreshing Git LFS Harthmere NPC voice recordings."
    git lfs pull --include="public/harthmere/**" --exclude=""
  fi
  node scripts/harthmere/check-harthmere-npc-voice-recordings.cjs .
}

ensure_snapshot_bucket_assets() {
  local bucket_count
  bucket_count="$(count_files_under public/buckets)"
  if [ -d public/buckets/biomes-static ] &&
     [ -d public/buckets/biomes-bikkie ] &&
     [ -f snapshot_backup.json ] &&
     [ "$bucket_count" -ge 15000 ]; then
    log "Snapshot bucket mirror is present ($bucket_count files)."
    return
  fi

  log "Installing production data snapshot bucket mirror."
  ./b --no-check-ts-deps data-snapshot uninstall
  ./b --no-check-ts-deps data-snapshot pull

  bucket_count="$(count_files_under public/buckets)"
  if [ ! -d public/buckets/biomes-static ] ||
     [ ! -d public/buckets/biomes-bikkie ] ||
     [ ! -f snapshot_backup.json ] ||
     [ "$bucket_count" -lt 15000 ]; then
    echo "ERROR production data snapshot buckets are incomplete after hydration ($bucket_count files)." >&2
    echo "Check BIOMES_DATA_SNAPSHOT_URL/BIOMES_DATA_SNAPSHOT_SHA256 or rerun ./b --no-check-ts-deps data-snapshot pull." >&2
    exit 1
  fi
}

ensure_production_asset_inputs() {
  log "Preparing production asset inputs."
  ensure_harthmere_runtime_assets
  ensure_harthmere_voice_assets
  ensure_snapshot_bucket_assets
}

reset_build_outputs_preserving_caches() {
  local next_cache_tmp=""
  if [ -d .next/cache ]; then
    next_cache_tmp="$(mktemp -d "${TMPDIR:-/tmp}/biomes-next-cache.XXXXXX")"
    mv .next/cache "$next_cache_tmp/cache"
  fi

  rm -rf .next dist
  if [ -n "$next_cache_tmp" ]; then
    mkdir -p .next
    mv "$next_cache_tmp/cache" .next/cache
    rmdir "$next_cache_tmp"
  fi
  mkdir -p node_modules/.cache/webpack
}

run_build_checks() {
  log "Running production source guardrails."
  ensure_production_asset_inputs
  ensure_generated_ts_deps
  node scripts/harthmere/test-harthmere-world-chat-live.cjs .
  BIOMES_PROD_STREAM_REDIS_CHECK=0 node scripts/harthmere/test-harthmere-stream-workers-production.cjs .
  node scripts/harthmere/test-harthmere-no-google-npc-text.cjs .
  node scripts/harthmere/test-glitch-aegis-telemetry-mucker-clearance.cjs .
  node scripts/glitch/test-production-api-route-imports.cjs .
  node scripts/glitch/test-production-deploy-local-redis-smoke.cjs .
  node scripts/glitch/test-production-redis6-stream-compat.cjs .
  node scripts/glitch/test-production-redis-shared-world.cjs .
  node scripts/harthmere/test-glitch-prod-bucket-asset-proxy.cjs .
  node scripts/harthmere/test-glitch-player-mesh-runtime.cjs .
  node scripts/glitch/test-glitch-oob-anonymous-ro-sync.cjs .
  node scripts/harthmere/test-glitch-prod-galois-runtime-packaging.cjs .
  node scripts/harthmere/test-harthmere-character-builder-save-glitch.cjs .
  node scripts/harthmere/test-harthmere-animation-target-pruning.cjs .
  node scripts/harthmere/check-harthmere-extra-town-offset.cjs .
  node scripts/harthmere/check-harthmere-mission-critical-suite.cjs .
  node scripts/harthmere/test-harthmere-npc-route-graph.cjs .
  if [ "${HARTHMERE_SKIP_UNRELATED_NAVIGATION_GUARDRAIL:-0}" = "1" ]; then
    echo "INFO skipping the unrelated runtime-navigation guardrail for a targeted local browser build"
  else
    node scripts/harthmere/test-harthmere-runtime-navigation-collision.cjs .
  fi
  node scripts/harthmere/test-harthmere-npc-navigation-grounded-routes.cjs .
  node scripts/harthmere/test-harthmere-connector-route-materialization.cjs .
  node scripts/harthmere/test-harthmere-glitch-cloud-save-all-state.cjs .
  node scripts/harthmere/test-harthmere-uploaded-coordinate-marker-cleanup.cjs
  node scripts/harthmere/test-harthmere-grove-npc-speed.cjs .
  node scripts/harthmere/test-biomes-ui-inbox-live-messaging.cjs .
  node scripts/harthmere/test-harthmere-third-party-combat-ai-production-hardening.cjs .
  node scripts/harthmere/test-harthmere-attacked-npc-retaliation.cjs .
  node scripts/harthmere/test-harthmere-retaliation-diagnostics.cjs .
  node scripts/harthmere/test-harthmere-retaliation-nearest-diagnostics.cjs .
  node scripts/harthmere/test-harthmere-live-mode-backend-production.cjs .
  node scripts/harthmere/test-harthmere-live-mode-backend-reducer.cjs .
  node scripts/harthmere/test-harthmere-live-entity-production-smoke.cjs .
  ./node_modules/.bin/mocha --config .mocharc.fast.json \
    src/server/shim/terrain_seed_migration.test.ts \
    src/client/game/helpers/player_shards.test.ts \
    src/client/components/system/test/load_progress_recovery.test.ts \
    src/client/game/test/load_progress.test.ts
  ./b test -b -p "src/shared/harthmere/test/harthmere_native_bikkie_items.test.ts"
  node scripts/harthmere/test-snapshot-grove-quest-marker-acceptance.cjs .
  node scripts/harthmere/check-biomes-snapshot-bucket-conversion.cjs .
}

build_artifacts() {
  local build_id build_node_options
  build_id="$(git rev-parse HEAD)"
  # Bound both production compilers so a local release rehearsal cannot evict
  # Redis or the browser test it is about to run on memory-constrained Macs.
  build_node_options="--openssl-legacy-provider --max-old-space-size=${BIOMES_BUILD_MAX_OLD_SPACE_MB:-6144}"
  log "Building Next client for production origin: $PROD_ORIGIN"
  reset_build_outputs_preserving_caches
  GLITCH_RUNTIME=1 \
  GLITCH_LOCAL_ASSETS=1 \
  GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
  GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL" \
  NEXT_PUBLIC_GLITCH_RUNTIME=1 \
  NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
  NEXT_PUBLIC_GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
  NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$PROD_ORIGIN" \
  BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
  BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 \
  BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600 \
  BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0 \
  NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
  NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600 \
  NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0 \
  NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0 \
  NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0 \
  NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE=1 \
  NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1 \
  GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1 \
  BIOMES_BUILD_ID="$build_id" \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  NODE_OPTIONS="$build_node_options" \
  ./node_modules/.bin/next build

  log "Building server bundles with webpack."
  BIOMES_BUILD_ID="$build_id" \
  NODE_ENV=production \
  NODE_OPTIONS="$build_node_options" \
  ./node_modules/.bin/webpack --config server.webpack.config.cjs --mode production

  # Retain private/server maps for debugging, but never package browser maps
  # into the public production image.
  find .next/static -type f -name '*.map' -delete
  rm -f public/sw.js.map

  node scripts/glitch/repair-next-pages-manifest.cjs .
  node scripts/glitch/assert-glitch-build-artifacts-current.cjs .
}

compose_docker_build_args() {
  DOCKER_ARGS=(
    --platform "$DOCKER_PLATFORM"
    -f Dockerfile.biomes
    -t "$IMAGE"
  )
  if should_directly_push_buildx_image; then
    DOCKER_ARGS+=(--push)
    IMAGE_WAS_PUSHED=1
  else
    DOCKER_ARGS+=(--load -t "$LOCAL_IMAGE")
  fi
  if [ -n "${DOCKER_BUILD_CACHE_FROM:-}" ]; then
    DOCKER_ARGS+=(--cache-from "$DOCKER_BUILD_CACHE_FROM")
  fi
  if [ -n "${DOCKER_BUILD_CACHE_TO:-}" ]; then
    DOCKER_ARGS+=(--cache-to "$DOCKER_BUILD_CACHE_TO")
  fi
  DOCKER_ARGS+=(.)
}

run_docker_buildx_build() {
  local build_log="$1"
  shift
  docker buildx build "$@" 2>&1 | tee "$build_log"
  return "${PIPESTATUS[0]}"
}

build_image() {
  prepare_docker_build_disk_budget

  local build_log status
  build_log="$(mktemp "${TMPDIR:-/tmp}/biomes-docker-build.XXXXXX")"

  compose_docker_build_args
  if should_directly_push_buildx_image; then
    log "Building and pushing production image $IMAGE for $DOCKER_PLATFORM."
  else
    log "Building local production image $LOCAL_IMAGE for $DOCKER_PLATFORM."
  fi

  set +e
  run_docker_buildx_build "$build_log" "${DOCKER_ARGS[@]}"
  status="$?"
  set -e

  if [ "$status" -ne 0 ] &&
     [ "$DOCKER_BUILD_RETRY_WITHOUT_CACHE_ON_ENOSPC" = "1" ] &&
     { [ -n "${DOCKER_BUILD_CACHE_FROM:-}" ] || [ -n "${DOCKER_BUILD_CACHE_TO:-}" ]; } &&
     grep -Eiq 'no space left on device|ENOSPC' "$build_log"; then
    log "Docker build hit runner disk pressure while using Buildx cache; pruning cache and retrying once without external layer cache."
    disable_docker_build_layer_cache "Docker Buildx reported no space left on device; external layer cache is disabled for the retry."
    prune_docker_builder_storage
    compose_docker_build_args
    set +e
    run_docker_buildx_build "$build_log" "${DOCKER_ARGS[@]}"
    status="$?"
    set -e
  fi

  rm -f "$build_log"
  if [ "$status" -ne 0 ]; then
    return "$status"
  fi

  cleanup_docker_build_disk_budget_after_build
}

should_directly_push_buildx_image() {
  [ "$PUSH_PRODUCTION" = "1" ] &&
    [ "$RUN_LOCAL_SMOKE" != "1" ] &&
    [ "$DOCKER_BUILD_DIRECT_PUSH" = "1" ]
}

wait_for_http() {
  local deadline=$((SECONDS + SMOKE_TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if PORT="$LOCAL_WEB_PORT" node scripts/glitch/healthcheck-glitch-web.cjs >/dev/null 2>&1; then
      return 0
    fi
    if ! docker inspect "$LOCAL_APP_CONTAINER" >/dev/null 2>&1; then
      echo "ERROR local app container disappeared." >&2
      return 1
    fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$LOCAL_APP_CONTAINER" 2>/dev/null || true)" != "true" ]; then
      echo "ERROR local app container exited during smoke." >&2
      docker logs --tail 240 "$LOCAL_APP_CONTAINER" >&2 || true
      return 1
    fi
    sleep 5
  done
  echo "ERROR timed out waiting for local production image on http://127.0.0.1:$LOCAL_WEB_PORT" >&2
  docker logs --tail 240 "$LOCAL_APP_CONTAINER" >&2 || true
  return 1
}

wait_for_unified_stack_services() {
  local deadline=$((SECONDS + SMOKE_TIMEOUT_SECONDS))
  local services=(web logic sync trigger notify shim chat sidefx ask bikkie oob)
  if [ -n "${LOCAL_STACK_READY_SERVICES:-}" ]; then
    # Space-delimited escape hatch for a specialized local gate. The caller is
    # responsible for naming every role its browser path actually consumes.
    read -r -a services <<<"$LOCAL_STACK_READY_SERVICES"
  elif [ "${HARTHMERE_NATIVE_ECS_E2E:-0}" = "1" ]; then
    # Native quest/UI browser gates need the browser, signed event authority,
    # socket projection, trigger reducer, snapshot bootstrap, and Bikkie. They
    # do not need notify/chat/side-effect/ask/OOB workers before the first test
    # can start. The unified container may continue warming those roles in the
    # background while the focused serial browser session is already useful.
    services=(web logic sync trigger shim bikkie)
  fi
  log "Waiting for ${#services[@]} required unified-stack services before browser testing: ${services[*]}."
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$LOCAL_APP_CONTAINER" 2>/dev/null || true)" != "true" ]; then
      echo "ERROR local production image exited before the unified stack became ready." >&2
      docker logs --tail 240 "$LOCAL_APP_CONTAINER" >&2 || true
      return 1
    fi
    local logs
    logs="$(docker logs "$LOCAL_APP_CONTAINER" 2>&1)"
    local ready=1
    local service
    for service in "${services[@]}"; do
      if ! grep -Fq "\"message\":\"$service now running\"" <<<"$logs"; then
        ready=0
        break
      fi
    done
    if [ "$ready" = "1" ]; then
      log "Required unified-stack services are ready."
      return 0
    fi
    sleep 5
  done
  echo "ERROR timed out waiting for required unified-stack services: ${services[*]}." >&2
  docker logs --tail 240 "$LOCAL_APP_CONTAINER" >&2 || true
  return 1
}

wait_for_local_native_simulations() {
  local deadline=$((SECONDS + ${LOCAL_NATIVE_SIMULATION_READY_TIMEOUT_SECONDS:-1200}))
  local require_anima="${GLITCH_ENABLE_ANIMA:-1}"
  local require_gaia="${GLITCH_ENABLE_GAIA:-1}"
  if [ "$require_anima" != "1" ] && [ "$require_gaia" != "1" ]; then
    log "Native simulations are disabled for this frontend/logic/ECS-only browser gate."
    return 0
  fi
  if [ "$require_anima" = "1" ] && [ "$require_gaia" = "1" ]; then
    log "Waiting for local Anima and Gaia readiness before native-ECS browser testing."
  elif [ "$require_anima" = "1" ]; then
    log "Waiting for local Anima readiness; Gaia is disabled for this focused browser gate."
  else
    log "Waiting for local Gaia readiness; Anima is disabled for this focused browser gate."
  fi
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$LOCAL_APP_CONTAINER" 2>/dev/null || true)" != "true" ]; then
      echo "ERROR local production image exited before required native simulations became ready." >&2
      docker logs --tail 240 "$LOCAL_APP_CONTAINER" >&2 || true
      return 1
    fi
    if docker exec \
      -e "HARTHMERE_REQUIRE_ANIMA=$require_anima" \
      -e "HARTHMERE_REQUIRE_GAIA=$require_gaia" \
      "$LOCAL_APP_CONTAINER" /bin/sh -lc '
        { [ "$HARTHMERE_REQUIRE_ANIMA" != "1" ] || curl -fsS http://127.0.0.1:4101/ready >/dev/null; } &&
        { [ "$HARTHMERE_REQUIRE_GAIA" != "1" ] || curl -fsS http://127.0.0.1:4201/ready >/dev/null; }
      ' >/dev/null 2>&1; then
      log "Required local native simulation readiness passed."
      return 0
    fi
    sleep 5
  done
  echo "ERROR timed out waiting for required local native simulation readiness." >&2
  docker logs --tail 240 "$LOCAL_APP_CONTAINER" >&2 || true
  return 1
}

verify_galois_runtime_in_container() {
  log "Verifying Galois Python/voxeloo runtime inside local production container before any push."
  docker exec "$LOCAL_APP_CONTAINER" /bin/sh -lc '
    set -eu
    PY="${BIOMES_ASSET_PYTHON:-/opt/biomes-python/bin/python}"
    echo "BIOMES_ASSET_PYTHON=$PY"
    test -x "$PY"

    echo "== Python/Galois imports =="
    "$PY" - <<'"'"'PYCODE'"'"'
import os
import sys
import site
print("python", sys.executable)
print("user_site", site.getusersitepackages())
for mod in ["docopt", "numpy", "PIL", "pygltflib", "jsonschema", "stringcase", "voxeloo"]:
    __import__(mod)
    print("OK", mod)
PYCODE

    echo "== Galois build.py help/import check =="
    cd /app/src/galois
    "$PY" py/assets/build.py -h >/tmp/galois-build-help.txt
    test -s /tmp/galois-build-help.txt
    head -40 /tmp/galois-build-help.txt || true

    echo "== Verify documented web process is running with lazy asset server =="
    ps -eo pid,ppid,user,args | grep -E "dist/web[.]js|run-glitch-local-game-stack" | grep -v grep || true
    if ! ps -eo args | grep -E "node .*dist/web[.]js|node dist/web[.]js|/app/dist/web[.]js" | grep -q -- "--assetServerMode lazy"; then
      echo "ERROR: documented web process with --assetServerMode lazy was not found"
      ps -eo pid,ppid,user,args | grep -E "node|dist/web[.]js|run-glitch-local-game-stack" | grep -v grep || true
      exit 1
    fi
  '
}

run_local_full_deployment_rehearsal() {
  local reconciliation_log
  reconciliation_log="$(mktemp)"

  log "Running the complete Harthmere terrain, outpost, ECS, connector, and grounding reconciliation locally."
  if ! docker exec \
    -e HARTHMERE_DEPLOY_TAG="local-$TAG" \
    "$LOCAL_APP_CONTAINER" \
    ./scripts/glitch/run-harthmere-production-reconciliation.sh \
    | tee "$reconciliation_log"; then
    rm -f "$reconciliation_log"
    echo "ERROR complete local Harthmere reconciliation failed." >&2
    return 1
  fi
  if ! grep -Fq \
    "HARTHMERE_PRODUCTION_RECONCILIATION_READY tag=local-$TAG" \
    "$reconciliation_log"; then
    rm -f "$reconciliation_log"
    echo "ERROR local Harthmere reconciliation completed without its read-back marker." >&2
    return 1
  fi
  rm -f "$reconciliation_log"

  # The unified local stack uses the same bounded Anima heap and Gaia WASM
  # allowance as production. Probe both native workers after reconciliation so
  # a map write cannot leave either required simulation unhealthy.
  docker exec -i "$LOCAL_APP_CONTAINER" node - <<'NODE'
const http = require("http");
const probes = [
  ["Anima", 4101],
  ["Gaia", 4201],
];
Promise.all(
  probes.map(
    ([name, port]) =>
      new Promise((resolve, reject) => {
        const req = http.get(
          { host: "127.0.0.1", port, path: "/ready", timeout: 2000 },
          (res) => {
            res.resume();
            if (res.statusCode === 200) {
              console.log(`OK ${name} local readiness`);
              resolve();
            } else {
              reject(new Error(`${name} readiness returned ${res.statusCode}`));
            }
          }
        );
        req.on("timeout", () => req.destroy(new Error(`${name} readiness timed out`)));
        req.on("error", reject);
      })
  )
).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE

  if [ -n "${ELEVENLABS_API_KEY:-}" ]; then
    # Validate only presence and parser acceptance; never print the secret.
    docker exec "$LOCAL_APP_CONTAINER" /bin/sh -lc '
      test -n "${ELEVENLABS_API_KEY:-}"
      export NODE_PATH="/opt/harthmere-maintenance/node_modules${NODE_PATH:+:$NODE_PATH}"
      node -r ts-node/register/transpile-only -r tsconfig-paths/register -e '\''
        const { elevenLabsConfigFromEnv } = require("./src/server/shared/elevenlabs");
        if (!elevenLabsConfigFromEnv(process.env)) process.exit(1);
        console.log("OK ElevenLabs local production configuration");
      '\''
    '
  else
    echo "ERROR --local-rehearsal requires ELEVENLABS_API_KEY so speech deployment is tested locally." >&2
    return 1
  fi

  if [ "$(docker inspect -f '{{.RestartCount}}' "$LOCAL_APP_CONTAINER")" != "0" ]; then
    echo "ERROR local production container restarted during the full rehearsal." >&2
    return 1
  fi
  log "Complete local production rehearsal passed; the stack will remain running."
}

smoke_local_image() {
  local optional_env_args=(
    -e "HARTHMERE_NATIVE_ECS_E2E=${HARTHMERE_NATIVE_ECS_E2E:-0}"
    -e "HARTHMERE_E2E_CONTROL_TOKEN=${HARTHMERE_E2E_CONTROL_TOKEN:-}"
    -e "HARTHMERE_E2E_BIBLE_NOW_MS=${HARTHMERE_E2E_BIBLE_NOW_MS:-}"
    -e "HARTHMERE_E2E_BIBLE_WEATHER=${HARTHMERE_E2E_BIBLE_WEATHER:-}"
  )
  local idle_session_ms="${GLITCH_IDLE_SESSION_MS:-1000}"
  if [ "${HARTHMERE_NATIVE_ECS_E2E:-0}" = "1" ] && [ -z "${GLITCH_IDLE_SESSION_MS:-}" ]; then
    # A one-second idle timeout is useful for disposable smoke probes but can
    # tear down a production-bundle stack between chapters. Keep focused native
    # browser sessions alive for fifteen minutes unless the caller overrides it.
    idle_session_ms=900000
  fi
  if [ "${HARTHMERE_NATIVE_ECS_E2E:-0}" = "1" ]; then
    # Next stack boot uses the memory-bounded six-service topology. The current
    # warm stack is never restarted just to adopt this optimization; it takes
    # effect on the next local image run after the updated launcher is built.
    optional_env_args+=(
      -e "GLITCH_FOCUSED_NATIVE_E2E_STACK=${GLITCH_FOCUSED_NATIVE_E2E_STACK:-1}"
      -e "GLITCH_ASSET_EXPORT_WORKERS=${GLITCH_ASSET_EXPORT_WORKERS:-1}"
      -e "GLITCH_ANIMA_MAX_OLD_SPACE_MB=${GLITCH_ANIMA_MAX_OLD_SPACE_MB:-1536}"
      -e "GLITCH_GAIA_WASM_MEMORY_MB=${GLITCH_GAIA_WASM_MEMORY_MB:-3072}"
      -e "GLITCH_WEB_MAX_OLD_SPACE_MB=${GLITCH_WEB_MAX_OLD_SPACE_MB:-4096}"
    )
  fi
  fetch_title_token_if_needed
  require_cmd docker

  if [ -n "${ELEVENLABS_API_KEY:-}" ]; then
    # `docker run -e NAME` copies the host value without putting it in argv or
    # logs, which keeps the local rehearsal from exposing the provider key.
    optional_env_args+=(
      -e ELEVENLABS_API_KEY
      -e "ELEVENLABS_MODEL_ID=${ELEVENLABS_MODEL_ID:-eleven_v3}"
    )
  fi

  log "Starting local Redis smoke database: $LOCAL_REDIS_IMAGE."
  docker network create "$LOCAL_NETWORK" >/dev/null 2>&1 || true
  docker rm -f "$LOCAL_APP_CONTAINER" "$LOCAL_REDIS_CONTAINER" >/dev/null 2>&1 || true
  docker run -d \
    --name "$LOCAL_REDIS_CONTAINER" \
    --network "$LOCAL_NETWORK" \
    --restart "$LOCAL_STACK_RESTART_POLICY" \
    --health-cmd 'redis-cli ping' \
    --health-interval 15s \
    --health-timeout 5s \
    --health-retries 3 \
    "$LOCAL_REDIS_IMAGE" \
    redis-server \
      --save "" \
      --appendonly no \
      --stop-writes-on-bgsave-error no >/dev/null

  log "Starting production image locally against local Redis."
  docker run -d \
    --name "$LOCAL_APP_CONTAINER" \
    --network "$LOCAL_NETWORK" \
    --restart "$LOCAL_STACK_RESTART_POLICY" \
    --stop-timeout 90 \
    --health-cmd 'node scripts/glitch/healthcheck-glitch-web.cjs' \
    --health-interval 30s \
    --health-timeout 10s \
    --health-start-period 300s \
    --health-retries 3 \
    -p "${LOCAL_WEB_PORT}:3000" \
    -p "${LOCAL_SYNC_PORT}:4900" \
    -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
    -e GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
    -e GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL" \
    -e GLITCH_REDIS_MODE=external \
    -e REDIS_HOST="$LOCAL_REDIS_CONTAINER" \
    -e GLITCH_REDIS_HOST="$LOCAL_REDIS_CONTAINER" \
    -e LOCAL_REDIS_HOST="$LOCAL_REDIS_CONTAINER" \
    -e REDIS_PORT=6379 \
    -e GLITCH_REDIS_PORT=6379 \
    -e GLITCH_POPULATE_SNAPSHOT_REDIS=1 \
    -e GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1 \
    -e GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1 \
    -e GLITCH_REQUIRE_SNAPSHOT_REDIS=1 \
    -e GLITCH_STACK_ROLE=unified \
    -e "GLITCH_ENABLE_ANIMA=${GLITCH_ENABLE_ANIMA:-1}" \
    -e "GLITCH_ENABLE_GAIA=${GLITCH_ENABLE_GAIA:-1}" \
    -e "GLITCH_ENABLE_STREAM_WORKERS=${GLITCH_ENABLE_STREAM_WORKERS:-1}" \
    -e BIOMES_CREATE_LOCAL_DEV_TERRAIN="${BIOMES_CREATE_LOCAL_DEV_TERRAIN:-0}" \
    -e HARTHMERE_VISUAL_TEST_AUTH=1 \
    -e GLITCH_IDLE_SESSION_MS="$idle_session_ms" \
    -e GLITCH_STACK_HTTP_READY_WAIT_TRIES="${GLITCH_STACK_HTTP_READY_WAIT_TRIES:-600}" \
    -e GLITCH_STACK_TCP_WAIT_TRIES="${GLITCH_STACK_TCP_WAIT_TRIES:-1800}" \
    -e NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="http://127.0.0.1:${LOCAL_SYNC_PORT}" \
    "${optional_env_args[@]}" \
    "$LOCAL_IMAGE" >/dev/null

  wait_for_http
  wait_for_unified_stack_services

  verify_galois_runtime_in_container

  if [ "${HARTHMERE_NATIVE_ECS_E2E:-0}" = "1" ]; then
    wait_for_local_native_simulations
  fi

  if [ "$RUN_LOCAL_FULL_REHEARSAL" = "1" ]; then
    run_local_full_deployment_rehearsal
  fi

  if [ "$HARTHMERE_RUN_LOCAL_BROWSER_E2E" = "1" ]; then
    log "Running install-to-player browser E2E against the local production image."
    HARTHMERE_E2E_EXPECTED_SYNC_HOST="127.0.0.1" \
    HEADLESS="${HARTHMERE_LOCAL_E2E_HEADLESS:-1}" \
    STRICT_RENDER="${HARTHMERE_LOCAL_E2E_STRICT_RENDER:-0}" \
    E2E_ARTIFACTS_DIR="/tmp/harthmere-local-rehearsal-${TAG}" \
    node scripts/harthmere/test-harthmere-install-player-ingame-e2e.cjs . \
      --base-url "http://127.0.0.1:${LOCAL_WEB_PORT}" \
      --install-id "$HARTHMERE_PREFLIGHT_INSTALL_ID"
  fi

  log "Running Glitch container smoke test against local production image."
  GLITCH_TEST_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
  GLITCH_TEST_FULL_FEATURES=0 \
  STRICT_GLITCH_RUNTIME_TEST=1 \
  node scripts/glitch/test-glitch-container.cjs

  log "Running generated player mesh endpoint smoke test against local production image."
  GLITCH_TEST_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
  node scripts/harthmere/test-glitch-prod-player-mesh-endpoint.cjs

  if [ "${HARTHMERE_SKIP_LIVE_ENTITY_BROWSER_SMOKE:-0}" != "1" ]; then
    log "Running live entity robot visual smoke against local production image."
    HARTHMERE_LIVE_ENTITY_VISUAL_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
    HARTHMERE_LIVE_ENTITY_VISUAL_COORDINATE_ROUTE="${HARTHMERE_LIVE_ENTITY_VISUAL_COORDINATE_ROUTE:-0}" \
    HARTHMERE_LIVE_ENTITY_VISUAL_DEV_USER="${HARTHMERE_LIVE_ENTITY_VISUAL_DEV_USER:-VisualRobotSmoke}" \
    node scripts/harthmere/test-harthmere-live-entity-robot-visuals.cjs .
  fi

  log "Local production image smoke passed."
}

push_and_deploy() {
  if [ "$PUSH_PRODUCTION" != "1" ]; then
    log "Skipping production push. Re-run with --push after reviewing the local smoke output."
    return
  fi

  require_cmd az
  require_cmd curl
  if [ "$IMAGE_WAS_PUSHED" != "1" ]; then
    check_production_image_push_preflight
    log "Pushing built image $IMAGE."
    login_to_acr
    docker push "$IMAGE"
  else
    log "Production image was already pushed by Docker Buildx: $IMAGE."
  fi

  check_production_redis_aof_health "Azure Container App update"
  check_production_redis_snapshot_hash "Azure Container App update"
  archive_production_mutable_hotfix_manifest "Azure Container App update"
  log "Updating Azure Container App $AZURE_CONTAINER_APP to $IMAGE."
  existing_azure_envs=()
  while IFS= read -r env_name; do
    if [ -n "$env_name" ]; then
      existing_azure_envs+=("$env_name")
    fi
  done < <(
    az containerapp show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --query "properties.template.containers[0].env[].name" \
      -o tsv
  )
  remove_azure_envs=()
  for env_name in "${existing_azure_envs[@]}"; do
    case "$env_name" in
      ES_LOCAL_DEV_BACKEND_VOXEL_TREES_*|GLITCH_CODEX_HOTPATCH|GLITCH_CODEX_HOTPATCH_JS|GLITCH_MUTABLE_HOTFIX_MANIFEST_BASE64|GLITCH_MUTABLE_HOTFIX_MANIFEST_URL|GLITCH_PLAYER_MESH_FALLBACK_ON_BUILD_ERROR|GLITCH_STATIC_PLAYER_MESH_HOTFIX|GLITCH_ANIMA_STARTUP_CANDIDATES|GLITCH_ANIMA_MAX_OLD_SPACE_MB|GLITCH_GAIA_WASM_MEMORY_MB|WASM_MEMORY|GAIA_SHARD_DOMAIN|GALOIS_STATIC_PREFIX|GLITCH_PUBLIC_WEB_ORIGIN)
        remove_azure_envs+=("$env_name")
        ;;
    esac
  done
  update_args=(
    --resource-group "$AZURE_RESOURCE_GROUP"
    --name "$AZURE_CONTAINER_APP"
    --image "$IMAGE"
    --command ./scripts/glitch/run-glitch-local-game-stack.sh
    --args ""
    --min-replicas "$AZURE_MIN_REPLICAS"
    --max-replicas "$AZURE_MAX_REPLICAS"
  )
  if [ "${#remove_azure_envs[@]}" -gt 0 ]; then
    update_args+=(--remove-env-vars "${remove_azure_envs[@]}")
  fi
  update_args+=(
    --set-env-vars
      GLITCH_TITLE_TOKEN=secretref:glitch-title-token
      GLITCH_TITLE_ID="$GLITCH_TITLE_ID"
      GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL"
      NEXT_PUBLIC_GLITCH_TITLE_ID="$GLITCH_TITLE_ID"
      GLITCH_STACK_ROLE=web
      GLITCH_REDIS_MODE=external
      REDIS_HOST="$PROD_REDIS_HOST"
      GLITCH_REDIS_HOST="$PROD_REDIS_HOST"
      LOCAL_REDIS_HOST="$PROD_REDIS_HOST"
      REDIS_PORT="$PROD_REDIS_PORT"
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT"
      GLITCH_POPULATE_SNAPSHOT_REDIS=0
      GLITCH_REQUIRE_SNAPSHOT_REDIS=1
      GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=0
      GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0
      GLITCH_ENABLE_STREAM_WORKERS=1
      GLITCH_ENABLE_SINK_WORKER=0
      # Anima and Gaia are required, but production telemetry proved that they
      # cannot safely share the 16 GiB public web replica. The runner also
      # rejects this role if stale settings turn either worker back on.
      GLITCH_ENABLE_ANIMA=0
      GLITCH_ENABLE_GAIA=0
      DISTRIBUTED_NOTIFIER_KIND=redis
      GLITCH_SERVER_CACHE_MODE=redis
      PLAYER_MESH_MAX_ACTIVE_COMPUTES=1
      PLAYER_MESH_WARMUP_MAX_ACTIVE_COMPUTES=0
      GLITCH_WEB_MAX_OLD_SPACE_MB="${GLITCH_WEB_MAX_OLD_SPACE_MB:-6144}"
      NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$PROD_ORIGIN"
      GLITCH_STATIC_BUCKET_FALLBACK_BASE_URL=https://storage.googleapis.com/biomes-static
      BIOMES_PLAYER_START_POSITION=484.24980838010384,53,-207.51197432867897
      BIOMES_FORCE_LOCAL_DEV_TOWN=0
      BIOMES_START_IN_HARTHMERE=0
      BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1
      # Production terrain is reconciled once by this deploy script. Rebuilding
      # it in every web replica caused concurrent startup memory spikes.
      BIOMES_CREATE_LOCAL_DEV_TERRAIN=0
      BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED=0
      BIOMES_TERRAIN_SEED_MODE=additive
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600
      BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0
      NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1
      NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600
      NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0
      GLITCH_DISABLE_GCP=1
      GLITCH_SKIP_GOOGLE_SECRETS=1
      GLITCH_DISABLE_DISCORD=1
      AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-https://glitch-openai-instance.openai.azure.com/}"
      AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2025-04-01-preview}"
      AZURE_OPENAI_DEPLOYMENT="${AZURE_OPENAI_DEPLOYMENT:-gpt-5.5}"
      AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key
      AZURE_SPEECH_REGION="${AZURE_SPEECH_REGION:-eastus2}"
      AZURE_SPEECH_KEY=secretref:azure-speech-key
      # ElevenLabs is the default player TTS provider. The secret must be
      # created on the Container App before a production push.
      ELEVENLABS_API_KEY=secretref:elevenlabs-api-key
      ELEVENLABS_MODEL_ID="${ELEVENLABS_MODEL_ID:-eleven_v3}"
  )
  AZURE_PREVIOUS_TRAFFIC_WEIGHTS="$(capture_azure_traffic_weights)"
  if [ -z "$AZURE_PREVIOUS_TRAFFIC_WEIGHTS" ]; then
    echo "ERROR refusing Azure update without a captured serving revision for rollback." >&2
    exit 1
  fi
  AZURE_TRAFFIC_RESTORE_ARMED=1
  az containerapp update "${update_args[@]}"
  ensure_azure_ingress_target_port

  local latest_revision
  latest_revision="$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query properties.latestRevisionName \
    -o tsv)"

  ensure_azure_revision_active "$latest_revision"
  free_azure_capacity_for_maintenance "$latest_revision"
  if [ "${HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION:-0}" != "1" ]; then
    # Start maintenance from a freshly persisted pre-terrain checkpoint. This
    # reduces recovery exposure if a later maintenance gate fails.
    force_production_redis_bgsave "pre-terrain maintenance checkpoint"
    pause_simulation_container_app_for_world_maintenance
  fi
  seed_production_harthmere_extension_terrain "$latest_revision"
  ensure_azure_revision_active "$latest_revision"
  wait_for_azure_revision_ready "$latest_revision"
  verify_azure_revision_zero_restarts "$latest_revision"
  validate_production_revision_before_traffic "$latest_revision"
  reconcile_production_world_sync "$latest_revision"
  force_azure_traffic_to_revision "$latest_revision"
  validate_production_bucket_assets "$latest_revision"
  validate_production_world_sync_http "$latest_revision"
  AZURE_TRAFFIC_RESTORE_ARMED=0
  deactivate_stale_azure_revisions "$latest_revision"
  deploy_simulation_container_app
  if [ "${HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION:-0}" != "1" ]; then
    # The pre-simulation audit proves maintenance wrote clean shards. This
    # second audit proves active Gaia leaves them clean instead of immediately
    # recreating atmospheric Muck.
    sleep "${HARTHMERE_POST_SIMULATION_AUDIT_SETTLE_SECONDS:-30}"
    run_azure_terrain_audit_job
    force_production_redis_bgsave "post-simulation Harthmere terrain verification"
  fi

  log "Production web and dedicated Anima/Gaia updates verified: $IMAGE webRevision=$latest_revision"
}

login_to_acr() {
  az acr login --name "$ACR_NAME"
}

check_production_image_push_preflight() {
  check_production_redis_network_guard
  check_production_world_sync_runner
  check_production_redis_aof_health "production image push"
  check_production_redis_snapshot_hash "production image push"
}

if [ "$REDIS_HEALTH_CHECK_ONLY" = "1" ]; then
  check_production_redis_network_guard
  check_production_redis_aof_health "manual Redis health check"
  check_production_redis_snapshot_hash "manual Redis health check"
  exit 0
fi

require_cmd node
if [ "$STOP_BEFORE_DOCKER_BUILD" != "1" ]; then
  require_cmd docker
fi

run_build_checks
if [ "$SKIP_BUILD" != "1" ]; then
  build_artifacts
  if [ "$STOP_BEFORE_DOCKER_BUILD" = "1" ]; then
    log "Stopping before Docker build by request. Build artifacts are current; skipped image build."
    exit 0
  fi
  if should_directly_push_buildx_image; then
    require_cmd az
    check_production_image_push_preflight
    login_to_acr
  fi
  build_image
else
  if [ "$STOP_BEFORE_DOCKER_BUILD" = "1" ]; then
    log "Skipping source/build/image steps by request; stop-before-Docker-build mode has no Docker work to run."
    exit 0
  fi
  log "Skipping source/build/image steps by request."
fi
if [ "$RUN_LOCAL_SMOKE" = "1" ]; then
  smoke_local_image
else
  log "Skipping local production-image HTTP smoke. Use --local-smoke to run the memory-heavy local container check."
fi
push_and_deploy
