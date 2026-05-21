#!/usr/bin/env node
// check-harthmere-resolver-contract-v1.cjs
//
// Source-text audit for patch 04. The TS test runs the resolver behaviour
// in-process; this CJS check walks the source files and asserts the wiring:
//
//   - Glitch endpoints stay hard-wired in their existing modules.
//   - Snapshot/quest progress fetches go through the resolver, not the
//     legacy SNAPSHOT_STATE_ENDPOINT_V77 constant directly.
//   - The resolver module exports the new patch-04 helpers.

const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
let failures = 0;
function ok(condition, message) {
  if (condition) { console.log(`OK ${message}`); }
  else { failures += 1; console.error(`FAIL ${message}`); }
}

// 1. Resolver exports the new helpers.
const resolver = read('src/shared/harthmere/snapshot_backend_resolver_v80.ts');
ok(resolver.includes('resolveSnapshotProgressEndpointV80'),
  'resolver exports resolveSnapshotProgressEndpointV80');
ok(resolver.includes('resolveSnapshotHealthEndpointV80'),
  'resolver exports resolveSnapshotHealthEndpointV80');
ok(resolver.includes('resolveSnapshotGroveTerrainModeV80'),
  'resolver exports resolveSnapshotGroveTerrainModeV80');
ok(resolver.includes('resolveSnapshotGroveGroundYV80'),
  'resolver exports resolveSnapshotGroveGroundYV80');
ok(resolver.includes('SnapshotGroveTerrainModeV80'),
  'resolver exports SnapshotGroveTerrainModeV80 type');

// 2. Glitch-specific endpoints stay hard-wired in harthmere_glitch_bridge.
const glitchBridge = read('src/client/game/glitch/harthmere_glitch_bridge.ts');
ok(glitchBridge.includes('/api/glitch/harthmere'),
  'Glitch bridge keeps the hard-wired /api/glitch/harthmere endpoint');
ok(!glitchBridge.includes('resolveSnapshotProgressEndpointV80') &&
   !glitchBridge.includes('resolveSnapshotBackendEnvironmentV80'),
  'Glitch bridge does NOT route through the snapshot resolver (install/save/achievements/leaderboards stay hard-wired)');

// 3. Snapshot progress writes go through the resolver.
const prodPort = read('src/client/components/challenges/SnapshotProductionPortV77.tsx');
ok(prodPort.includes('resolveSnapshotBackendEnvironmentV80') &&
   prodPort.includes('resolveSnapshotProgressEndpointV80'),
  'SnapshotProductionPortV77 imports the v80 resolver helpers');
ok(prodPort.includes('resolveSnapshotProgressEndpointForRuntimeV77'),
  'SnapshotProductionPortV77 has a local helper that calls the resolver at fetch time');

// The legacy constant may still be imported as a fallback, but the two
// active fetches should reference the resolver helper, not the bare constant.
const fetchSnapshotPattern = /await fetch\(\s*SNAPSHOT_STATE_ENDPOINT_V77\b/g;
const directHits = (prodPort.match(fetchSnapshotPattern) || []).length;
ok(directHits === 0,
  `no direct fetch(SNAPSHOT_STATE_ENDPOINT_V77) calls remain in SnapshotProductionPortV77 (found ${directHits})`);

// 4. The runtime_environment health endpoint already goes through the resolver
// (this was wired in v80; patch 04 just preserves it).
const runtimeApi = read('src/pages/api/glitch/runtime_environment.ts');
ok(runtimeApi.includes('resolveSnapshotBackendEnvironmentV80'),
  'runtime_environment API still routes through the resolver');

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll resolver contract checks passed.');
