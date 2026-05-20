#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const repoRoot = path.resolve(__dirname, '..', '..');
const requiredChecks = [
  'check-snapshot-merge-foundation-v1.cjs',
  'check-snapshot-asset-version-boundary-v1.cjs',
  'check-snapshot-animation-compat-v1.cjs',
  'check-snapshot-player-animation-profile-v1.cjs',
  'check-snapshot-spawn-home-fix-v1.cjs',
  'check-snapshot-runtime-bridge-v1.cjs',
  'check-snapshot-runtime-bridge-repair-v2.cjs',
  'check-harthmere-extra-town-offset-v3.cjs',
  'check-snapshot-placeable-galois-fallback-v1.cjs',
  'check-snapshot-npc-type-compat-v1.cjs',
  'check-snapshot-collision-missing-aabb-compat-v1.cjs',
  'check-snapshot-buff-type-compat-v2.cjs',
];
const optionalChecks = [
  'check-harthmere-runtime-gate-npc-location-v1.cjs',
  'check-snapshot-quest-mission-dump-v1.cjs',
];
function runCheck(name, required) {
  const full = path.join(repoRoot, 'scripts', 'harthmere', name);
  if (!fs.existsSync(full)) {
    if (required) {
      console.error(`FAIL missing required check: ${name}`);
      process.exitCode = 1;
    } else {
      console.log(`SKIP optional check not installed: ${name}`);
    }
    return;
  }
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [full], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`FAIL ${name} exited ${result.status}`);
    process.exit(result.status || 1);
  }
}
for (const check of requiredChecks) runCheck(check, true);
for (const check of optionalChecks) runCheck(check, false);
if (process.exitCode) process.exit(process.exitCode);
console.log('\nOK snapshot/glitch merge regression suite v1 passed');
