#!/usr/bin/env bash
set -euo pipefail

# Build the production image, run it locally against a local Redis container,
# then optionally push the already-tested image to Azure Container Apps.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PUSH_PRODUCTION=0
SKIP_BUILD=0
KEEP_LOCAL_SMOKE=0
TAG="${TAG:-prod-$(date -u +%Y%m%d%H%M%S)}"

usage() {
  cat <<'EOF'
Usage: scripts/glitch/deploy-production-local-redis-smoke-v1.sh [options]

Options:
  --push          Push the locally-smoked image and update Azure Container Apps.
  --tag TAG      Use a specific image tag.
  --skip-build   Reuse existing .next/dist and Docker image tag.
  --keep-local   Leave local smoke containers running for manual inspection.
  -h, --help     Show this help.

The script always uses local Redis for the local production-image smoke test.
It never uses az acr build, so there is no remote source upload just to compile.
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
    --keep-local)
      KEEP_LOCAL_SMOKE=1
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

PROD_ORIGIN="${PROD_ORIGIN:-https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io}"
ACR_SERVER="${ACR_SERVER:-glitchgames.azurecr.io}"
IMAGE_REPO="${IMAGE_REPO:-biomes-node}"
IMAGE="${ACR_SERVER}/${IMAGE_REPO}:${TAG}"
LOCAL_IMAGE="${LOCAL_IMAGE:-biomes-node:local-${TAG}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-openai-resource-group}"
AZURE_CONTAINER_APP="${AZURE_CONTAINER_APP:-biomes-node-vnet}"
PROD_REDIS_HOST="${PROD_REDIS_HOST:-10.0.0.12}"
PROD_REDIS_PORT="${PROD_REDIS_PORT:-6379}"
LOCAL_NETWORK="${LOCAL_NETWORK:-biomes-prod-smoke-net}"
LOCAL_REDIS_CONTAINER="${LOCAL_REDIS_CONTAINER:-biomes-prod-smoke-redis}"
LOCAL_APP_CONTAINER="${LOCAL_APP_CONTAINER:-biomes-prod-smoke-app}"
LOCAL_WEB_PORT="${LOCAL_WEB_PORT:-3017}"
LOCAL_SYNC_PORT="${LOCAL_SYNC_PORT:-4907}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-900}"

log() {
  printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR required command not found: $1" >&2
    exit 1
  fi
}

cleanup() {
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

run_build_checks() {
  log "Running production source guardrails."
  node scripts/glitch/test-production-redis-shared-world-v1.cjs .
  node scripts/harthmere/test-glitch-prod-bucket-asset-proxy-v146.cjs .
  node scripts/harthmere/test-glitch-prod-bucket-asset-proxy-v147.cjs .
  node scripts/harthmere/test-glitch-player-mesh-runtime-v144.cjs .
  node scripts/harthmere/check-harthmere-mission-critical-suite-v112.cjs .
  node scripts/harthmere/test-harthmere-third-party-combat-ai-production-hardening-v1.cjs .
  node scripts/harthmere/test-harthmere-attacked-npc-retaliation-v1.cjs .
  node scripts/harthmere/test-harthmere-live-mode-backend-production-v1.cjs .
  node scripts/harthmere/test-harthmere-live-mode-backend-reducer-v1.cjs .
  node scripts/harthmere/check-biomes-snapshot-bucket-conversion-v1.cjs .
}

build_artifacts() {
  log "Building Next client for production origin: $PROD_ORIGIN"
  rm -rf .next/cache node_modules/.cache/webpack
  GLITCH_RUNTIME=1 \
  GLITCH_LOCAL_ASSETS=1 \
  NEXT_PUBLIC_GLITCH_RUNTIME=1 \
  NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
  NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$PROD_ORIGIN" \
  NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0 \
  NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0 \
  NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0 \
  NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE=1 \
  NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1 \
  GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1 \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  NODE_OPTIONS="--openssl-legacy-provider" \
  ./node_modules/.bin/next build

  log "Building server bundles with webpack."
  NODE_ENV=production \
  NODE_OPTIONS="--openssl-legacy-provider" \
  ./node_modules/.bin/webpack --config server.webpack.config.ts --mode production

  node scripts/glitch/assert-glitch-build-artifacts-current.cjs .
}

build_image() {
  log "Building local production image $LOCAL_IMAGE for $DOCKER_PLATFORM."
  docker buildx build \
    --platform "$DOCKER_PLATFORM" \
    --load \
    -f Dockerfile.biomes \
    -t "$LOCAL_IMAGE" \
    -t "$IMAGE" \
    .
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

smoke_local_image() {
  fetch_title_token_if_needed
  require_cmd docker

  log "Starting local Redis smoke database."
  docker network create "$LOCAL_NETWORK" >/dev/null 2>&1 || true
  docker rm -f "$LOCAL_APP_CONTAINER" "$LOCAL_REDIS_CONTAINER" >/dev/null 2>&1 || true
  docker run -d \
    --name "$LOCAL_REDIS_CONTAINER" \
    --network "$LOCAL_NETWORK" \
    redis:7-alpine \
    redis-server \
      --save "" \
      --appendonly no \
      --stop-writes-on-bgsave-error no >/dev/null

  log "Starting production image locally against local Redis."
  docker run -d \
    --name "$LOCAL_APP_CONTAINER" \
    --network "$LOCAL_NETWORK" \
    -p "${LOCAL_WEB_PORT}:3000" \
    -p "${LOCAL_SYNC_PORT}:4900" \
    -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
    -e GLITCH_TITLE_ID="${GLITCH_TITLE_ID:-42de534c-600f-4228-af9e-b69faef94cce}" \
    -e GLITCH_API_BASE_URL="${GLITCH_API_BASE_URL:-https://api.glitch.fun/api}" \
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
    -e GLITCH_IDLE_SESSION_MS="${GLITCH_IDLE_SESSION_MS:-1000}" \
    -e NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
    "$LOCAL_IMAGE" >/dev/null

  wait_for_http

  log "Running Glitch container smoke test against local production image."
  GLITCH_TEST_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
  GLITCH_TEST_FULL_FEATURES=0 \
  STRICT_GLITCH_RUNTIME_TEST=1 \
  node scripts/glitch/test-glitch-container.cjs

  log "Local production image smoke passed."
}

push_and_deploy() {
  if [ "$PUSH_PRODUCTION" != "1" ]; then
    log "Skipping production push. Re-run with --push after reviewing the local smoke output."
    return
  fi

  require_cmd az
  log "Pushing tested local image $IMAGE."
  az acr login --name "${ACR_NAME:-GlitchGames}"
  docker push "$IMAGE"

  log "Updating Azure Container App $AZURE_CONTAINER_APP to $IMAGE."
  az containerapp update \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --image "$IMAGE" \
    --set-env-vars \
      GLITCH_TITLE_TOKEN=secretref:glitch-title-token \
      GLITCH_REDIS_MODE=external \
      REDIS_HOST="$PROD_REDIS_HOST" \
      GLITCH_REDIS_HOST="$PROD_REDIS_HOST" \
      LOCAL_REDIS_HOST="$PROD_REDIS_HOST" \
      REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_REDIS_PORT="$PROD_REDIS_PORT" \
      GLITCH_POPULATE_SNAPSHOT_REDIS=0 \
      GLITCH_REQUIRE_SNAPSHOT_REDIS=1 \
      GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=0 \
      GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0 \
      NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$PROD_ORIGIN" \
      GLITCH_STATIC_BUCKET_FALLBACK_BASE_URL=https://storage.googleapis.com/biomes-static \
      BIOMES_PLAYER_START_POSITION=484.24980838010384,53,-207.51197432867897 \
      BIOMES_FORCE_LOCAL_DEV_TOWN=0 \
      BIOMES_START_IN_HARTHMERE=0 \
      BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0 \
      GLITCH_DISABLE_GCP=1 \
      GLITCH_SKIP_GOOGLE_SECRETS=1 \
      GLITCH_DISABLE_DISCORD=1

  log "Production update submitted: $IMAGE"
}

require_cmd node
require_cmd docker

run_build_checks
if [ "$SKIP_BUILD" != "1" ]; then
  build_artifacts
  build_image
else
  log "Skipping source/build/image steps by request; local smoke still runs."
fi
smoke_local_image
push_and_deploy
