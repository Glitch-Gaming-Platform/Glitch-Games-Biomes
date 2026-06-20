const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const repo = path.resolve(__dirname, '..', '..');
const checks = [
  'check-snapshot-merge-foundation.cjs',
  'check-snapshot-asset-version-boundary.cjs',
  'check-snapshot-animation-compat.cjs',
  'check-snapshot-player-animation-profile.cjs',
  'check-snapshot-spawn-home-fix.cjs',
  'check-snapshot-runtime-bridge.cjs',
  'check-snapshot-runtime-bridge-repair.cjs',
  'check-harthmere-extra-town-offset.cjs',
  'check-snapshot-placeable-galois-fallback.cjs',
  'check-snapshot-npc-type-compat.cjs',
  'check-snapshot-collision-missing-aabb-compat.cjs',
  'check-snapshot-buff-type-compat.cjs',
  'check-harthmere-runtime-gate-npc-location.cjs',
  'check-snapshot-npc-cosmetics-fallback.cjs',
  'check-snapshot-pre-mission-integration.cjs',
  'check-snapshot-quest-mission-dump.cjs',
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
console.log('\nOK snapshot/glitch merge regression suite current passed');
