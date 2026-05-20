#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const helpersPath = path.join(root, 'src/client/game/resources/placeables/helpers.ts');
const helpers = fs.readFileSync(helpersPath, 'utf8');

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

ok(helpers.includes('GLITCH_SNAPSHOT_PLACEABLE_GALOIS_FALLBACK_V1'), 'placeable fallback marker is present');
ok(helpers.includes('function makeMissingPlaceableGltf'), 'missing placeable GLTF helper exists');
ok(helpers.includes('missing-placeable-galois'), 'missing placeholder scene is named for debugging');
ok(helpers.includes('snapshot-placeable-galois-fallback'), 'missing galois path is logged in development');
ok(helpers.includes('return makeMissingPlaceableGltf(item, galoisPath);'), 'unresolved galoisPath returns placeholder instead of crashing');
ok(!helpers.includes('ok(url);\n    return loadGltf(url);'), 'old unresolved URL assertion is removed');
ok(helpers.includes('animations: []'), 'placeholder GLTF is static and safe for basic placeables');
ok(helpers.includes('scenes: [scene]'), 'placeholder GLTF has scenes array for gltfToThree fallback');

if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot placeable galois fallback v1 check passed');
