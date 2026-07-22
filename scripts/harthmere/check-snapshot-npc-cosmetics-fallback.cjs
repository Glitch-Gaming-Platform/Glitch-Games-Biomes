const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const file = path.join(repo, 'src/client/game/resources/npcs.ts');
const src = fs.readFileSync(file, 'utf8');
const seed = fs.readFileSync(path.join(repo, 'src/server/harthmere/snapshot_grove_npc_ecs_seed.ts'), 'utf8');
const cosmeticReset = fs.readFileSync(path.join(repo, 'src/server/harthmere/player_like_npc_cosmetics.ts'), 'utf8');
const shim = fs.readFileSync(path.join(repo, 'src/server/shim/main.ts'), 'utf8');
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
ok(seed.includes('prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind)'), 'no-asset Grove NPC seeder uses the create/update cosmetic reset helper');
ok(cosmeticReset.includes('prepared.appearance_component = null'), 'existing Grove NPC updates explicitly remove uniform default appearance');
ok(cosmeticReset.includes('prepared.wearing = null'), 'existing Grove NPC updates explicitly remove uniform default wearables');
ok(shim.includes('makeLocalDevPlayerLikeNpcCosmeticRepairChanges'), 'existing production worlds receive component-only NPC cosmetic repairs');
ok(shim.includes('await reconcileLocalDevPlayerLikeNpcCosmetics(service, worldApi)'), 'production world startup runs the versioned NPC cosmetic repair');
ok(routing.includes('sil: "npcs/sil"'), 'Sil uses the original snapshot NPC asset');
ok(routing.includes('doc: "npcs/doc"'), 'Doc uses the original snapshot NPC asset');
ok(!src.includes('makeSnapshotNpcCosmeticsFallbackGltf'), 'player-like NPCs no longer route to the Harthmere voxel cosmetics fallback');
ok(!src.includes('shouldUseSnapshotGroveGeneratedVoxelNpc'), 'no-asset Grove NPCs no longer bypass player-like rendering');
ok(!src.includes('if (npcType.isPlayerLikeAppearance) {\n    const mesh = await makePlayerLikeAppearanceMesh(deps, id);'), 'old naked player-like NPC branch is not first path');
if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot NPC player/Grove avatar routing current check passed');
