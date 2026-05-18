#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

cat <<'MSG'
== Glitch Docker dependency explanation v74 ==
The Dockerfile copies the local game source. It is not cloning the game repository.

However, `yarn install` must build node_modules from package.json/yarn.lock. If package.json or yarn.lock contains Git dependencies, Yarn fetches those dependency repositories.

Known Git dependency involved in this build:
MSG

grep -n "react-leaflet-markercluster\|github.com/ill-inc" package.json yarn.lock 2>/dev/null || true

cat <<'MSG'

That repository is a JavaScript dependency, not the Harthmere/Biomes game source.
We disable Husky because the Docker context excludes .git and Husky hooks are only for developer checkouts, not production images.
MSG
