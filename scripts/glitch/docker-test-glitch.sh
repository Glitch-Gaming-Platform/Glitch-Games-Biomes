#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

IMAGE_NAME="${IMAGE_NAME:-glitch-harthmere-biomes:local}"
CONTAINER_NAME="${CONTAINER_NAME:-harthmere-glitch-test}"
HOST_PORT="${HOST_PORT:-3017}"
CONTAINER_PORT="3000"
GLITCH_TITLE_ID="${GLITCH_TITLE_ID:-42de534c-600f-4228-af9e-b69faef94cce}"
GLITCH_TEST_INSTALL_ID="${GLITCH_TEST_INSTALL_ID:-f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7}"
GLITCH_API_BASE_URL="${GLITCH_API_BASE_URL:-https://api.glitch.fun/api}"
GLITCH_IDLE_SESSION_MS="${GLITCH_IDLE_SESSION_MS:-1000}"
GLITCH_SESSION_TTL_MS="${GLITCH_SESSION_TTL_MS:-43200000}"
BUILD_IMAGE="${BUILD_IMAGE:-1}"
KEEP_CONTAINER="${KEEP_CONTAINER:-0}"
DOCKER_BUILD_PROGRESS="${DOCKER_BUILD_PROGRESS:-plain}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed or is not on PATH." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running or this user cannot access Docker." >&2
  exit 1
fi

if [ -z "${GLITCH_TITLE_TOKEN:-}" ]; then
  cat >&2 <<'MSG'
ERROR: GLITCH_TITLE_TOKEN is required for the runtime smoke test.

Run like this:

GLITCH_TITLE_TOKEN='<runtime-title-token>' \
  scripts/glitch/docker-test-glitch.sh
MSG
  exit 1
fi

if [ ! -f Dockerfile.glitch ]; then
  echo "ERROR: Dockerfile.glitch is missing. Run install-harthmere-glitch-dockerfile-v69.sh first." >&2
  exit 1
fi

if [ "$BUILD_IMAGE" = "1" ]; then
  echo "==> Building $IMAGE_NAME from Dockerfile.glitch"
  docker build \
    --progress="$DOCKER_BUILD_PROGRESS" \
    -f Dockerfile.glitch \
    -t "$IMAGE_NAME" \
    .
else
  echo "==> Skipping docker build because BUILD_IMAGE=$BUILD_IMAGE"
fi

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "==> Removing previous test container $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

cleanup() {
  status=$?
  if [ "$KEEP_CONTAINER" = "1" ]; then
    echo "==> Keeping container $CONTAINER_NAME for debugging."
    echo "    Logs: docker logs -f $CONTAINER_NAME"
    echo "    Shell: docker exec -it $CONTAINER_NAME bash"
  else
    echo "==> Stopping test container $CONTAINER_NAME"
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

echo "==> Running $CONTAINER_NAME on host port $HOST_PORT -> container port $CONTAINER_PORT"
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -e PORT="$CONTAINER_PORT" \
  -e WEB_PORT="$CONTAINER_PORT" \
  -e GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
  -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
  -e GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL" \
  -e GLITCH_IDLE_SESSION_MS="$GLITCH_IDLE_SESSION_MS" \
  -e GLITCH_SESSION_TTL_MS="$GLITCH_SESSION_TTL_MS" \
  -e SKIP_PROD_LOAD=true \
  -e SKIP_MISSING_ASSET_CHECK=true \
  -e BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
  "$IMAGE_NAME" >/dev/null

echo "==> Waiting for web server at http://127.0.0.1:$HOST_PORT"
ready=0
for i in $(seq 1 240); do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    echo "ERROR: container exited before becoming healthy." >&2
    docker logs --tail=240 "$CONTAINER_NAME" >&2 || true
    exit 1
  fi
  if [ $((i % 15)) -eq 0 ]; then
    echo "Still waiting... last container logs:"
    docker logs --tail=30 "$CONTAINER_NAME" || true
  fi
  sleep 2
done

if [ "$ready" != "1" ]; then
  echo "ERROR: container did not become ready." >&2
  docker logs --tail=240 "$CONTAINER_NAME" >&2 || true
  exit 1
fi

echo "==> Web server is ready. Running Glitch proxy/runtime smoke tests."
GLITCH_TEST_BASE_URL="http://127.0.0.1:${HOST_PORT}" \
GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
GLITCH_TEST_INSTALL_ID="$GLITCH_TEST_INSTALL_ID" \
node scripts/glitch/test-glitch-container.cjs

echo "==> Docker image + Glitch runtime smoke test passed."
echo "    Local URL: http://127.0.0.1:${HOST_PORT}/?install_id=${GLITCH_TEST_INSTALL_ID}"
