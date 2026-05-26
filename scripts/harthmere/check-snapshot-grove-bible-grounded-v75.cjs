#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}
function countMatches(text, re) {
  return [...text.matchAll(re)].length;
}
const sharedPath = 'src/shared/harthmere/snapshot_grove_content_v75.ts';
const shared = read(sharedPath);
const runtime = read('src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx');
const hud = read('src/client/components/challenges/HarthmereUnifiedHUD.tsx');
const dialog = read('src/client/components/challenges/TalkToNPCDefaultDialog.tsx');
const server = read('src/server/shim/main.ts');
const rules = read('src/shared/harthmere/snapshot_runtime_rules_v74.ts');
const landmarks = read('src/pages/api/world_map/landmarks.ts');
const mission = read('src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx');

ok(shared.includes('SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION_V75'), 'shared Grove bible content registry exists');
ok(shared.includes('SNAPSHOT_GROVE_NPC_GROUNDING_VERSION_V75'), 'Grove NPC grounding version marker exists');
ok(shared.includes('SNAPSHOT_GROVE_NPC_FEET_Y_V75 = SNAPSHOT_GROVE_WORLD_GROUND_Y_V75 + 1'), 'Grove NPC feet are grounded at world ground + 1');
ok(shared.includes('snapshotGroveGroundedPositionV75'), 'Grove grounding helper exists');
ok(shared.includes('SNAPSHOT_GROVE_NPCS_V75'), 'Grove NPC compendium exists');
ok(countMatches(shared, /id:\s*"(?:jackie|billy|ranger_jane|luis|taye|alexis|sil|dimmi|doc|old_coop|buddy|mucked_robot)"/g) >= 12, 'all 12 Grove bible NPC ids are present');
ok(countMatches(shared, /line:\s*"[^"]+"/g) >= 12, 'every Grove NPC has at least one in-character line');
ok(countMatches(shared, /extraLines:\s*\[/g) >= 12, 'every Grove NPC has expandable dialogue lines for relationship/likeability');
ok(shared.includes('likeabilityTags'), 'NPCs carry likeability/system tags');
ok(shared.includes('SNAPSHOT_GROVE_QUESTS_V75'), 'Grove quest registry exists');
ok(countMatches(shared, /id:\s*"(?:road_signs_and_small_lies|color_that_still_points_home|cart_that_forgot_its_wheel|road_ready_not_fancy|moss_that_went_quiet|songline_under_the_lawn|sticky_medicine|cove_keeps_pictures|coops_key_hen|tower_with_a_headache|letter_for_the_north_gate|antlers_for_the_watch|toll_ledger_problem|samples_for_the_chapel|tone_beneath_the_road)"/g) >= 15, 'all 15 Grove/Harthmere connector subquests are present');
ok(shared.includes('SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS_V75'), 'player-builder Grove style presets exist');
ok(shared.includes('SNAPSHOT_GROVE_STATIC_ASSET_PORTS_V75'), 'snapshot NPC design asset manifest exists');
ok(shared.includes('asset_data/npcs/jackie') && shared.includes('asset_data/npcs/ranger_jane') && shared.includes('asset_data/npcs/alexis'), 'snapshot NPC design assets are referenced');
const groveNpcAssets = [...shared.matchAll(/"asset_data\/npcs\/[^"]+\.(?:glb|gltf)"/g)]
  .map((match) => match[0].slice(1, -1));
const missingGroveNpcAssets = groveNpcAssets.filter(
  (assetPath) => !fs.existsSync(path.join(root, "public/buckets/biomes-static", assetPath))
);
ok(groveNpcAssets.length >= 9, 'Grove NPC static asset manifest lists the required shipped avatar assets');
ok(missingGroveNpcAssets.length === 0, `Grove NPC static asset paths exist in packaged production buckets${missingGroveNpcAssets.length ? `: ${missingGroveNpcAssets.join(', ')}` : ''}`);

ok(rules.includes('grove_bible_content_v75'), 'v74 coverage manifest records v75 Grove bible content');
ok(rules.includes('SNAPSHOT_GROVE_NO_HARTHMERE_OFFSET_V75'), 'snapshot/Grove coordinate transform explicitly avoids Harthmere offset');
ok(!rules.includes('shiftHarthmereAuthoredPositionToWorldV71(pos)'), 'v74 snapshot authored points no longer use Harthmere shift helper');
ok(rules.includes('snapshotGroveGroundedPositionV75([pos[0], pos[1], pos[2]])'), 'v74 snapshot points ground through Grove helper');

ok(server.includes('makeLocalDevSnapshotGroveNpcChangesV75'), 'server seeds grounded Grove NPC compatibility layer');
ok(server.includes('snapshotGroveGroundedPositionV75(npc.authoredPosition)'), 'server grounds Grove NPCs without Harthmere offset');
ok(server.includes('SNAPSHOT_GROVE_COMBAT_NO_HARTHMERE_OFFSET_V75'), 'server combat spawns use Grove/no-Harthmere-offset marker');
ok(server.includes('snapshotGroveGroundedPositionV75(spawn.authoredPosition)'), 'server snapshot combat spawns are grounded in Grove coordinates');
ok(server.includes('snapshotGroveNpcIds') || server.includes('localDevSnapshotGroveNpcIdsV75'), 'server includes Grove NPC ids in seeding existence check');

ok(dialog.includes('useSnapshotGroveNpcDialogV75'), 'default NPC dialog checks Grove bible dialogue before Harthmere fallback');
ok(hud.includes('SnapshotGroveBibleRuntimeControllerV75'), 'HUD mounts Grove quest runtime controller');
ok(hud.includes('SnapshotGroveMapHUDV75'), 'HUD map includes Grove quest panel');
ok(hud.includes('SnapshotGroveJournalPanelV75'), 'HUD journal includes Grove quest panel');
ok(runtime.includes('SNAPSHOT_GROVE_QUEST_STATE_KEY_V75'), 'Grove runtime has persistent quest state key');
ok(runtime.includes('SNAPSHOT_GROVE_LIKEABILITY_KEY_V75'), 'Grove runtime tracks NPC likeability');
ok(runtime.includes('autoremoveWhenNear: true'), 'Grove map marker auto-removes when player reaches it');
ok(runtime.includes('actions.slice(0, 4)'), 'Grove dialogue keeps actions capped at 4');
ok(runtime.includes('__snapshotGroveV75'), 'Grove runtime exposes developer inspection/reset helper');

ok(landmarks.includes('SNAPSHOT_GROVE_WORLD_MAP_LANDMARKS_VERSION_V75'), 'world map exposes v75 Grove landmarks version');
ok(landmarks.includes('SNAPSHOT_GROVE_LANDMARKS_V75'), 'world map reads shared Grove landmark registry');
ok(landmarks.includes('const seen = new Set'), 'world map dedupes old v71 and new v75 landmarks');

ok(mission.includes('Find the Old Grove Road Post'), 'Road Ahead second step has clearer target text');
ok(mission.includes('snapshotGroveLandmarkByIdV75("old_grove_road_post")'), 'Road Ahead uses shared Grove landmark registry for marker');
ok(mission.includes('autoremoveWhenNear: true'), 'Road Ahead navigation marker auto-removes near objective');
ok(mission.includes('mapManager.removeNavigationAid?.(SNAPSHOT_MISSION_NAV_AID_ID_V71)'), 'Road Ahead removes marker when completed');

if (failures) {
  console.error(`v75 Grove bible grounded check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log('v75 Grove bible grounded check passed');
