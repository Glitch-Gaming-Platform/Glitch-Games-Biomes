#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export SKIP_PROD_LOAD="${SKIP_PROD_LOAD:-true}"
export SKIP_MISSING_ASSET_CHECK="${SKIP_MISSING_ASSET_CHECK:-true}"
export BIOMES_FORCE_LOCAL_DEV_TOWN="${BIOMES_FORCE_LOCAL_DEV_TOWN:-1}"
VENV_DIR="${BIOMES_VENV_DIR:-/app/.venv}"
export PATH="$VENV_DIR/bin:/app/node_modules/.bin:$PATH"
export VIRTUAL_ENV="$VENV_DIR"
export YARN_IGNORE_SCRIPTS=1
export npm_config_ignore_scripts=true

# In Docker we keep the cached venv outside /app so COPY . . cannot overwrite it
# with a host/macOS .venv. Biomes still expects /app/.venv, so link it back.
if [ "$VENV_DIR" != "/app/.venv" ]; then
  rm -rf .venv
  ln -sfn "$VENV_DIR" .venv
fi

if [ ! -x "$VENV_DIR/bin/python" ] && [ ! -x "$VENV_DIR/bin/python3" ]; then
  python3 -m venv "$VENV_DIR"
fi
PYTHON_BIN="$VENV_DIR/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="$VENV_DIR/bin/python3"
fi

REQ_HASH="$(sha256sum requirements.txt | awk '{print $1}')"
REQ_STAMP="$VENV_DIR/.glitch-requirements.sha256"
if [ ! -f "$REQ_STAMP" ] || [ "$(cat "$REQ_STAMP")" != "$REQ_HASH" ]; then
  "$PYTHON_BIN" -m pip install --upgrade pip setuptools wheel
  "$PYTHON_BIN" -m pip install -r requirements.txt
  printf '%s
' "$REQ_HASH" > "$REQ_STAMP"
else
  echo "Python requirements unchanged; using cached $VENV_DIR."
fi

# Generate TypeScript/Bazel outputs needed by the ts-node web service.
# IMPORTANT: use --no-check-ts-deps so ./b does not secretly run yarn install again.
./b --no-check-ts-deps ts-deps build

if [ ! -d public/buckets/biomes-static ]; then
  cat >&2 <<'MSG'
ERROR: public/buckets/biomes-static is missing.

This Docker image copies local repo files only. It will not download production
assets or hydrate Git LFS during Docker build. Put the required local static
bucket files in the repo before building the image.
MSG
  exit 1
fi

rm -rf /tmp/fake-biomes-snapshot /tmp/biomes_data_snapshot.tar.gz
./b --no-check-ts-deps script create_local_fake_snapshot /tmp/fake-biomes-snapshot
tar -czf /tmp/biomes_data_snapshot.tar.gz -C /tmp/fake-biomes-snapshot .
./b --no-check-ts-deps data-snapshot uninstall || true
./b --no-check-ts-deps data-snapshot install-from-file /tmp/biomes_data_snapshot.tar.gz
rm -rf /tmp/fake-biomes-snapshot /tmp/biomes_data_snapshot.tar.gz ~/.cache/pip

printf '\nGlitch image preparation complete.\n'
