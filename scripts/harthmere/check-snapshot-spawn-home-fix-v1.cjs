#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

const dataSnapshot = read('scripts/b/data_snapshot.py');
const bpy = read('scripts/b/b.py');

ok(
  /ctx\.invoke\(\s*b\.run,[\s\S]*home_override=False,[\s\S]*bikkie_static_prefix=BIKKIE_STATIC_PREFIX/.test(dataSnapshot),
  'data_snapshot run disables devHomeOverride=centerOfTerrain'
);
ok(
  dataSnapshot.includes('center-of-terrain home override') || dataSnapshot.includes('centerOfTerrain'),
  'data_snapshot.py documents why the home override is disabled for snapshot runs'
);
ok(
  bpy.includes('if config.home_override:') && bpy.includes('overrides["devHomeOverride"] = "centerOfTerrain"'),
  'generic ./b run home override behavior is preserved outside data-snapshot run'
);
ok(
  dataSnapshot.includes('storage="memory"'),
  'snapshot run still uses the current Glitch/local shim storage mode'
);
ok(
  dataSnapshot.includes('redis=True'),
  'snapshot run still enables local Redis-backed snapshot world APIs'
);

if (process.exitCode) {
  console.error('snapshot spawn/home fix v1 check failed');
  process.exit(process.exitCode);
}
console.log('snapshot spawn/home fix v1 check passed');
