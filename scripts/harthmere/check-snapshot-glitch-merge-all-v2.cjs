const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const repo = path.resolve(__dirname, '..', '..');
const checks = [
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
  'check-harthmere-runtime-gate-npc-location-v1.cjs',
  'check-snapshot-npc-cosmetics-fallback-v1.cjs',
  'check-snapshot-pre-mission-integration-v1.cjs',
  'check-snapshot-quest-mission-dump-v1.cjs',
].filter((check) => fs.existsSync(path.join(repo, 'scripts/harthmere', check)));
let failed = false;
for (const check of checks) {
  const script = path.join(repo, 'scripts/harthmere', check);
  console.log(`\n=== ${check} ===`);
  const result = spawnSync(process.execPath, [script], { cwd: repo, stdio: 'inherit' });
  if (result.status !== 0) {
    failed = true;
    console.error(`FAILED ${check}`);
    break;
  }
}
if (failed) process.exit(1);
console.log('\nOK snapshot/glitch merge regression suite v2 passed');
