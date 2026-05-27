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

wait_for_azure_revision_ready_v151() {
  local desired_revision="$1"
  local ready_revision=""
  local i=0

  log "Waiting for Azure revision $desired_revision to become ready."
  while [ "$i" -lt "${AZURE_REVISION_READY_POLLS:-90}" ]; do
    ready_revision="$(az containerapp show \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --name "$AZURE_CONTAINER_APP" \
      --query properties.latestReadyRevisionName \
      -o tsv 2>/dev/null || true)"
    if [ "$ready_revision" = "$desired_revision" ]; then
      log "Azure revision is ready: $desired_revision"
      return 0
    fi
    i=$((i + 1))
    sleep "${AZURE_REVISION_READY_SLEEP_SECONDS:-10}"
  done

  echo "ERROR latest revision did not become ready." >&2
  echo "  expected: $desired_revision" >&2
  echo "  ready:    $ready_revision" >&2
  az containerapp revision list \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query '[].{name:name,active:properties.active,trafficWeight:properties.trafficWeight,createdTime:properties.createdTime,healthState:properties.healthState,runningState:properties.runningState}' \
    -o table >&2 || true
  exit 1
}

force_azure_traffic_to_revision_v151() {
  local revision="$1"

  log "Pinning 100% production traffic to concrete ready revision $revision."
  az containerapp ingress traffic set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --revision-weight "$revision=100" >/dev/null

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

validate_bucket_asset_url_v151() {
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

validate_production_bucket_assets_v151() {
  local revision="$1"
  local revision_fqdn revision_origin
  revision_fqdn="$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query properties.latestRevisionFqdn \
    -o tsv)"
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
    validate_bucket_asset_url_v151 "$revision_origin" "$asset_path"
    validate_bucket_asset_url_v151 "$PROD_ORIGIN" "$asset_path"
  done

  log "Production bucket asset validation passed for revision $revision."
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
  node scripts/harthmere/test-glitch-prod-bucket-asset-proxy-v151.cjs .
  node scripts/harthmere/test-glitch-player-mesh-runtime-v144.cjs .
  node scripts/harthmere/test-glitch-prod-galois-runtime-packaging-v174.cjs .
  node scripts/harthmere/test-glitch-prod-galois-runtime-packaging-v175.cjs .
  node scripts/harthmere/test-harthmere-animation-target-pruning-v152.cjs .
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

verify_galois_runtime_in_container_v175() {
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
    "$PY" py/assets/build.py -h >/tmp/galois-build-help-v175.txt
    test -s /tmp/galois-build-help-v175.txt
    head -40 /tmp/galois-build-help-v175.txt || true

    echo "== Verify documented web process is running with lazy asset server =="
    ps -eo args | grep -E "node /app/dist/web[.]js" | grep -q -- "--assetServerMode lazy"
  '
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

  verify_galois_runtime_in_container_v175

  log "Running Glitch container smoke test against local production image."
  GLITCH_TEST_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
  GLITCH_TEST_FULL_FEATURES=0 \
  STRICT_GLITCH_RUNTIME_TEST=1 \
  node scripts/glitch/test-glitch-container.cjs

  log "Running generated player mesh endpoint smoke test against local production image."
  GLITCH_TEST_BASE_URL="http://127.0.0.1:${LOCAL_WEB_PORT}" \
  node scripts/harthmere/test-glitch-prod-player-mesh-endpoint-v174.cjs

  log "Local production image smoke passed."
}

push_and_deploy() {
  if [ "$PUSH_PRODUCTION" != "1" ]; then
    log "Skipping production push. Re-run with --push after reviewing the local smoke output."
    return
  fi

  require_cmd az
  require_cmd curl
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

  local latest_revision
  latest_revision="$(az containerapp show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_CONTAINER_APP" \
    --query properties.latestRevisionName \
    -o tsv)"

  wait_for_azure_revision_ready_v151 "$latest_revision"
  force_azure_traffic_to_revision_v151 "$latest_revision"
  validate_production_bucket_assets_v151 "$latest_revision"

  log "Production update verified: $IMAGE revision=$latest_revision"
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
