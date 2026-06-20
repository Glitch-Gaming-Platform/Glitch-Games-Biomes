const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const file = path.join(repo, 'src/client/game/resources/npcs.ts');
const src = fs.readFileSync(file, 'utf8');
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}
ok(src.includes('SNAPSHOT_NPC_COSMETICS_FALLBACK_VERSION'), 'NPC cosmetics fallback version marker is present');
ok(src.includes('snapshotNpcHasUsefulCosmetics'), 'cosmetic ECS detector helper is present');
ok(src.includes('wearingItems instanceof Map'), 'cosmetic detector treats Map-backed wearables as useful');
ok(src.includes('shouldUseSnapshotNpcCosmeticsFallback'), 'player-like NPC fallback gate is present');
ok(src.includes('makeSnapshotNpcCosmeticsFallbackGltf'), 'generated fallback GLTF helper is present');
ok(src.includes('makeLocalDevVoxelNpcGltf(deps, id)'), 'fallback reuses visible Harthmere voxel NPC generator');
ok(src.includes('!snapshotNpcHasUsefulCosmetics(deps, id)'), 'fallback only applies when appearance/wearing is missing');
ok(src.includes('SNAPSHOT_NPC_COSMETICS_FALLBACK using generated visible cosmetics'), 'fallback emits searchable development log');
ok(!src.includes('if (npcType.isPlayerLikeAppearance) {\n    const mesh = await makePlayerLikeAppearanceMesh(deps, id);'), 'old naked player-like NPC branch is not first path');
if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot NPC cosmetics fallback current check passed');
