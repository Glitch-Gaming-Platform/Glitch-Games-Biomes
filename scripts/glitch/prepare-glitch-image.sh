#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export SKIP_PROD_LOAD="${SKIP_PROD_LOAD:-true}"
export SKIP_MISSING_ASSET_CHECK="${SKIP_MISSING_ASSET_CHECK:-true}"
export BIOMES_FORCE_LOCAL_DEV_TOWN="${BIOMES_FORCE_LOCAL_DEV_TOWN:-1}"
export PATH="/app/.venv/bin:/app/node_modules/.bin:$PATH"

if [ -d .git ]; then
  echo "Running git lfs pull for Docker build context..."
  git lfs pull || echo "WARNING: git lfs pull failed. Continuing; build will use files already present in the Docker context."
else
  echo "No .git directory in Docker context; skipping git lfs pull."
fi

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

# Generate TypeScript/Bazel outputs needed by the ts-node web service.
./b ts-deps build

if [ ! -d public/buckets/biomes-static ]; then
  cat >&2 <<'MSG'
ERROR: public/buckets/biomes-static is missing.

The Glitch Docker build is intentionally offline/local-data first. It does not
try to download the dead upstream Biomes production snapshot during image build.
Make sure the repo has the generated/local static bucket checked in or copied in
before building the image.
MSG
  exit 1
fi

rm -rf /tmp/fake-biomes-snapshot /tmp/biomes_data_snapshot.tar.gz
./b script create_local_fake_snapshot /tmp/fake-biomes-snapshot
tar -czf /tmp/biomes_data_snapshot.tar.gz -C /tmp/fake-biomes-snapshot .
./b data-snapshot uninstall || true
./b data-snapshot install-from-file /tmp/biomes_data_snapshot.tar.gz

# Keep image size lower after build-only scratch files are created.
rm -rf /tmp/fake-biomes-snapshot /tmp/biomes_data_snapshot.tar.gz ~/.cache/pip

printf '\nGlitch image preparation complete.\n'
