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
ok(src.includes('SNAPSHOT_NPC_COSMETICS_FALLBACK_VERSION_V1'), 'NPC cosmetics fallback version marker is present');
ok(src.includes('snapshotNpcHasUsefulCosmeticsV1'), 'cosmetic ECS detector helper is present');
ok(src.includes('shouldUseSnapshotNpcCosmeticsFallbackV1'), 'player-like NPC fallback gate is present');
ok(src.includes('makeSnapshotNpcCosmeticsFallbackGltfV1'), 'generated fallback GLTF helper is present');
ok(src.includes('makeLocalDevVoxelNpcGltf(deps, id)'), 'fallback reuses visible Harthmere voxel NPC generator');
ok(src.includes('!snapshotNpcHasUsefulCosmeticsV1(deps, id)'), 'fallback only applies when appearance/wearing is missing');
ok(src.includes('SNAPSHOT_NPC_COSMETICS_FALLBACK_V1 using generated visible cosmetics'), 'fallback emits searchable development log');
ok(!src.includes('if (npcType.isPlayerLikeAppearance) {\n    const mesh = await makePlayerLikeAppearanceMesh(deps, id);'), 'old naked player-like NPC branch is not first path');
if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot NPC cosmetics fallback v1 check passed');
