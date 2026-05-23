#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-/Users/devindixon/Development/biomes-game}"
INSTALL_ID="${INSTALL_ID:-f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7}"
GLITCH_TITLE_ID="${GLITCH_TITLE_ID:-42de534c-600f-4228-af9e-b69faef94cce}"
GLITCH_API_BASE_URL="${GLITCH_API_BASE_URL:-https://api.glitch.fun/api}"
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="${NEXT_PUBLIC_GLITCH_SYNC_BASE_URL:-http://127.0.0.1:3018}"
IMAGE_TAG="${IMAGE_TAG:-glitch-harthmere-biomes:local}"

cd "$REPO"

test -n "${GLITCH_TITLE_TOKEN:-}" || {
  echo 'ERROR: GLITCH_TITLE_TOKEN is missing. Export it first.' >&2
  exit 1
}

echo 'Step 1/6: validate v126 test files'
node scripts/harthmere/validate-harthmere-client-context-render-unblock-v126.cjs "$REPO"

echo 'Step 2/6: clean production build'
rm -rf .next/cache node_modules/.cache/webpack dist
mkdir -p dist

GLITCH_RUNTIME=1 \
GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_RUNTIME=1 \
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$NEXT_PUBLIC_GLITCH_SYNC_BASE_URL" \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
NODE_OPTIONS="--openssl-legacy-provider" \
./node_modules/.bin/next build

NODE_ENV=production \
NODE_OPTIONS="--openssl-legacy-provider" \
./node_modules/.bin/webpack \
  --config server.webpack.config.ts \
  --mode production

ls -lh .next/BUILD_ID dist/shim.js dist/oob.js dist/sync.js dist/logic.js dist/web.js

echo 'Step 3/6: docker build'
docker buildx build \
  --platform linux/amd64 \
  --load \
  --progress=plain \
  -f Dockerfile.biomes \
  -t "$IMAGE_TAG" \
  .

echo 'Step 4/6: start redis and local production container'
docker network create glitch-dev 2>/dev/null || true
docker rm -f glitch-redis-local biomes-local 2>/dev/null || true

docker run -d \
  --name glitch-redis-local \
  --network glitch-dev \
  redis:7-alpine

docker run --rm \
  --network glitch-dev \
  redis:7-alpine \
  redis-cli -h glitch-redis-local ping

docker run -d \
  --name biomes-local \
  --platform linux/amd64 \
  --network glitch-dev \
  -p 3017:3000 \
  -p 3018:4900 \
  -e NODE_ENV=production \
  -e NODE_OPTIONS='--trace-uncaught --trace-warnings --enable-source-maps' \
  -e GLITCH_RUNTIME=1 \
  -e GLITCH_LOCAL_ASSETS=1 \
  -e NEXT_PUBLIC_GLITCH_RUNTIME=1 \
  -e NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
  -e NEXT_PUBLIC_GLITCH_SYNC_BASE_URL='http://127.0.0.1:3018' \
  -e GLITCH_SYNC_BIND_HOST=0.0.0.0 \
  -e GLITCH_WEB_BIND_HOST=0.0.0.0 \
  -e GLITCH_DISABLE_GCP=1 \
  -e GLITCH_DISABLE_DISCORD=1 \
  -e GLITCH_DISABLE_ASSET_MIRROR=1 \
  -e GLITCH_SKIP_GCE_METADATA=1 \
  -e GLITCH_SKIP_GOOGLE_SECRETS=1 \
  -e GLITCH_SKIP_PROD_TRAY=1 \
  -e GLITCH_STORAGE_MODE=memory \
  -e GLITCH_FIREHOSE_MODE=memory \
  -e GLITCH_BISCUIT_MODE=memory \
  -e GLITCH_CHAT_API_MODE=shim \
  -e GLITCH_WORLD_API_MODE=shim \
  -e GLITCH_BIKKIE_CACHE_MODE=local \
  -e GLITCH_SERVER_CACHE_MODE=local \
  -e DISCOVERY_KIND=shim \
  -e RO_SYNC=1 \
  -e SHIM_SERVICE_HOST=127.0.0.1 \
  -e SHIM_SERVICE_PORT=3104 \
  -e LOGIC_SERVICE_HOST=127.0.0.1 \
  -e LOGIC_SERVICE_PORT=3504 \
  -e OOB_SERVICE_HOST=127.0.0.1 \
  -e OOB_SERVICE_PORT=4704 \
  -e SYNC_SERVICE_HOST=127.0.0.1 \
  -e SYNC_SERVICE_PORT=4904 \
  -e REDIS_HOST=glitch-redis-local \
  -e REDIS_PORT=6379 \
  -e GLITCH_REDIS_HOST=glitch-redis-local \
  -e GLITCH_REDIS_PORT=6379 \
  -e ALLOW_NON_K8_REDIS=1 \
  -e USE_K8_REDIS=0 \
  -e GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
  -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
  -e GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL" \
  --entrypoint /bin/bash \
  "$IMAGE_TAG" \
  -lc './scripts/glitch/run-glitch-local-game-stack-v92.sh'

echo 'Step 5/6: wait for web server'
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:3017/api/bikkie >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ "$i" == "90" ]]; then
    docker logs --tail=300 biomes-local || true
    echo 'ERROR: web server did not become ready.' >&2
    exit 1
  fi
done

echo 'Step 6/6: run full browser E2E until player is in-game'
INSTALL_ID="$INSTALL_ID" \
BASE_URL="http://127.0.0.1:3017" \
DOCKER_CONTAINER="biomes-local" \
bash scripts/harthmere/test-harthmere-install-player-ingame-e2e-v126.sh "$REPO"
