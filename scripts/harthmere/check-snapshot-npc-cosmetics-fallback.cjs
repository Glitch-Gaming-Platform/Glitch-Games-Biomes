const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const file = path.join(repo, 'src/client/game/resources/npcs.ts');
const src = fs.readFileSync(file, 'utf8');
const seed = fs.readFileSync(path.join(repo, 'src/server/harthmere/snapshot_grove_npc_ecs_seed.ts'), 'utf8');
const routing = fs.readFileSync(path.join(repo, 'src/shared/harthmere/snapshot_grove_npc_mesh_routing.ts'), 'utf8');
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}
ok(src.includes('makeSnapshotPlayerLikeAppearanceMesh(deps, id)'), 'player-like NPCs use the generated player/Grove avatar mesh path');
ok(seed.includes('delete (base as { appearance_component?: unknown }).appearance_component'), 'no-asset Grove NPC seeder drops uniform default appearance');
ok(seed.includes('delete (base as { wearing?: unknown }).wearing'), 'no-asset Grove NPC seeder drops uniform default wearables');
ok(routing.includes('sil: "npcs/sil"'), 'Sil uses the original snapshot NPC asset');
ok(routing.includes('doc: "npcs/doc"'), 'Doc uses the original snapshot NPC asset');
ok(!src.includes('makeSnapshotNpcCosmeticsFallbackGltf'), 'player-like NPCs no longer route to the Harthmere voxel cosmetics fallback');
ok(!src.includes('shouldUseSnapshotGroveGeneratedVoxelNpc'), 'no-asset Grove NPCs no longer bypass player-like rendering');
ok(!src.includes('if (npcType.isPlayerLikeAppearance) {\n    const mesh = await makePlayerLikeAppearanceMesh(deps, id);'), 'old naked player-like NPC branch is not first path');
if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot NPC player/Grove avatar routing current check passed');
