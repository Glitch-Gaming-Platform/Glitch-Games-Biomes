const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.existsSync(path.join(repo, rel)) ? fs.readFileSync(path.join(repo, rel), 'utf8') : ''; }
function ok(cond, msg) { if (!cond) { console.error(`FAIL ${msg}`); process.exitCode=1; } else { console.log(`OK ${msg}`); } }
ok(fs.existsSync(path.join(repo, 'scripts/harthmere/dump-snapshot-pre-mission-integration-state-v1.cjs')), 'pre-mission integration dump script exists');
ok(read('src/client/game/resources/npcs.ts').includes('SNAPSHOT_NPC_COSMETICS_FALLBACK_VERSION_V1'), 'NPC cosmetics fallback is installed before mission/quest work');
ok(read('src/client/game/resources/npcs.ts').includes('shouldUseSnapshotNpcCosmeticsFallbackV1'), 'player-like snapshot NPC fallback gate is installed');
ok(read('src/client/game/renderers/local_dev/harthmere_assets.ts').includes('runtime') || read('src/client/game/renderers/local_dev/harthmere_assets.ts').includes('Harthmere'), 'Harthmere runtime assets file is available');
ok(read('src/server/shim/main.ts').includes('BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN'), 'server supports extra-town toggle before mission/quest work');
ok(read('src/server/logic/utils/players.ts').includes('BIOMES_START_IN_HARTHMERE'), 'spawn selection is explicit before mission/quest work');
ok(read('src/shared/npc/bikkie.ts').includes('maybeIdToNpcType') || read('src/shared/npc/bikkie.ts').includes('LEGACY_SNAPSHOT_NPC'), 'snapshot NPC schema compatibility is installed');
ok(read('src/shared/game/buffs.ts').includes('maybeBuffType') || read('src/shared/game/buffs.ts').includes('SNAPSHOT_BUFF_TYPE_COMPAT'), 'snapshot buff compatibility is installed');
ok(read('src/shared/game/collision.ts').includes('missing-AABB') || read('src/shared/game/collision.ts').includes('SNAPSHOT_COLLISION'), 'snapshot collision compatibility is installed');
ok(read('src/client/game/resources/placeables/helpers.ts').includes('missingPlaceableGltf') || read('src/client/game/resources/placeables/helpers.ts').includes('snapshot-placeable-galois-fallback'), 'snapshot placeable fallback is installed');
if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot pre-mission integration v1 check passed');
