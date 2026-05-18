#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

IMAGE_NAME="${1:-glitch-harthmere-biomes:local}"

docker build \
  -f Dockerfile.glitch \
  -t "$IMAGE_NAME" \
  .

cat <<MSG

Built $IMAGE_NAME

Run locally with:

docker run --rm -it \
  -p 3000:3000 \
  -e GLITCH_TITLE_TOKEN='your-runtime-title-token' \
  $IMAGE_NAME
MSG
