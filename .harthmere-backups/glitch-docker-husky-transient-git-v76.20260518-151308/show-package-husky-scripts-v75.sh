#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "== Local package Husky lifecycle scripts v75 =="
node - <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};
let found = false;
for (const [name, value] of Object.entries(scripts)) {
  if (/husky/.test(String(value))) {
    found = true;
    console.log(`${name}: ${value}`);
  }
}
if (!found) {
  console.log('No Husky lifecycle script found in local package.json.');
}
NODE

cat <<'MSG'

The Dockerfile does not mutate your working-tree package.json.
It removes Husky only from the temporary package.json copied into the image before `yarn install`.
MSG
