#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

cat <<'MSG'
== Husky in the Glitch Docker build v76 ==

Husky is not needed in the production image. It installs local Git hooks for developers.
The Docker build intentionally excludes the real .git directory, so `husky install` fails
unless we either disable lifecycle scripts or provide a temporary Git repository.

We do NOT use yarn --ignore-scripts because Biomes/native dependencies may need legitimate
install/build scripts. Instead Dockerfile.glitch creates a temporary empty .git directory
for yarn install, then removes .git and .husky before the final runtime image layer.

This keeps local development behavior untouched while making the container build repeatable.
MSG

echo
echo "Local package.json scripts mentioning husky:"
node - <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};
let found = false;
for (const [name, value] of Object.entries(scripts)) {
  if (/husky/i.test(String(value))) {
    found = true;
    console.log(`- ${name}: ${value}`);
  }
}
if (!found) console.log('- none in root scripts; yarn may still invoke Husky from package metadata/dependencies.');
NODE
