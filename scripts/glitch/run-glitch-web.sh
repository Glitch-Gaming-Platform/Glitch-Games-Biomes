#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export PATH="/app/.venv/bin:/app/node_modules/.bin:$PATH"
export NODE_ENV="${NODE_ENV:-production}"
export NODE_OPTIONS="${NODE_OPTIONS:---openssl-legacy-provider --enable-source-maps}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export IS_SERVER="${IS_SERVER:-true}"
export GLITCH_TITLE_ID="${GLITCH_TITLE_ID:-42de534c-600f-4228-af9e-b69faef94cce}"
export GLITCH_API_BASE_URL="${GLITCH_API_BASE_URL:-https://api.glitch.fun/api}"
export SKIP_PROD_LOAD="${SKIP_PROD_LOAD:-true}"
export SKIP_MISSING_ASSET_CHECK="${SKIP_MISSING_ASSET_CHECK:-true}"
export BIOMES_FORCE_LOCAL_DEV_TOWN="${BIOMES_FORCE_LOCAL_DEV_TOWN:-1}"
export PORT="${PORT:-3000}"

if [ "${PORT}" != "3000" ]; then
  echo "WARNING: this Biomes web service listens on 3000 through ./b run. Configure the Glitch container route to target port 3000. Received PORT=${PORT}."
fi

if [ -z "${GLITCH_TITLE_TOKEN:-}" ]; then
  echo "WARNING: GLITCH_TITLE_TOKEN is not set. Game will still run locally, but Glitch install validation/cloud APIs will be disabled or fail through the proxy."
fi

if [ ! -f snapshot_backup.json ] || [ ! -d public/buckets/biomes-static ] || [ ! -d public/buckets/biomes-bikkie ]; then
  echo "Installed local data snapshot is missing. Recreating it from checked-in local static assets..."
  scripts/glitch/prepare-glitch-image.sh
fi

if ! redis-cli ping >/dev/null 2>&1; then
  echo "Starting local Redis for the single-container Glitch build..."
  redis-server --daemonize yes --save "" --appendonly no --bind 127.0.0.1
fi

for i in $(seq 1 30); do
  if redis-cli ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" = "30" ]; then
    echo "ERROR: Redis did not become ready." >&2
    exit 1
  fi
done

# data-snapshot ensure-redis-populated asks before flushing Redis. The container
# owns this Redis instance, so answer yes non-interactively.
yes | ./b data-snapshot ensure-redis-populated

exec ./b run \
  --no-watch-ts-deps \
  --redis \
  --storage memory \
  --assets local \
  --open-admin-access \
  --bikkie-static-prefix /buckets/biomes-bikkie/ \
  --galois-static-prefix /buckets/biomes-static/ \
  --local-gcs \
  web
