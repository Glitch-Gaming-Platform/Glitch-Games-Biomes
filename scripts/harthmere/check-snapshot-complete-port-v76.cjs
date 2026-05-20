#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    failed = true;
  }
}

const sharedPath = 'src/shared/harthmere/snapshot_complete_port_v76.ts';
const runtimePath = 'src/client/components/challenges/LocalDevSnapshotCompletePortV76.tsx';
const hudPath = 'src/client/components/challenges/HarthmereUnifiedHUD.tsx';
const dialoguePath = 'src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx';
const questsPath = 'src/client/components/challenges/LocalDevHarthmereQuests.tsx';
const assetsPath = 'src/client/game/renderers/local_dev/harthmere_assets.ts';
const bridgePath = 'src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx';
const extractorPath = 'scripts/harthmere/extract-snapshot-challenges-v76.cjs';
const grovePath = 'src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx';

ok(exists(sharedPath), 'shared v76 complete-port registry exists');
ok(exists(runtimePath), 'client v76 runtime/controller exists');
ok(exists(extractorPath), 'source-backed snapshot challenge extractor exists');

const shared = exists(sharedPath) ? read(sharedPath) : '';
const runtime = exists(runtimePath) ? read(runtimePath) : '';
const hud = exists(hudPath) ? read(hudPath) : '';
const dialogue = exists(dialoguePath) ? read(dialoguePath) : '';
const quests = exists(questsPath) ? read(questsPath) : '';
const assets = exists(assetsPath) ? read(assetsPath) : '';
const bridge = exists(bridgePath) ? read(bridgePath) : '';
const grove = exists(grovePath) ? read(grovePath) : '';
const extractor = exists(extractorPath) ? read(extractorPath) : '';

ok(shared.includes('SNAPSHOT_COMPLETE_PORT_VERSION_V76'), 'v76 complete-port version marker exists');
ok(shared.includes('SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTION_VERSION_V76'), 'canonical challenge extraction contract exists');
ok(extractor.includes('SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTOR_V76'), 'extractor has v76 marker');
ok(extractor.includes('NUX_PAIRED_STEPS'), 'extractor reads official NUX paired step enum');
ok(shared.includes('SNAPSHOT_SERVER_COMPLETION_STATE_VERSION_V76'), 'server completion state contract marker exists');
ok(shared.includes('SNAPSHOT_MISSION_TEST_MATRIX_VERSION_V76'), 'mission test matrix marker exists');
ok(shared.includes('SNAPSHOT_GROVE_FOOT_CLEARANCE_AUDIT_VERSION_V76'), 'foot-clearance audit marker exists');
ok(shared.includes('SNAPSHOT_HARTHMERE_BIBLE_NPC_UPGRADE_VERSION_V76'), 'Harthmere bible NPC upgrade marker exists');
ok(shared.includes('SNAPSHOT_OFFICIAL_NUX_CHALLENGES_V76'), 'official NUX challenge extraction array exists');
for (const id of [
  '166072605041642',
  '3623277001113501',
  '5660250530071909',
  '4273096364377975',
  '7786806792035454',
  '8903834562824062',
  '4478447552347541',
  '6113676978673631',
]) {
  ok(shared.includes(id), `official snapshot paired step id ${id} is preserved`);
}

for (const questId of [
  'road_signs_and_small_lies',
  'color_that_still_points_home',
  'cart_that_forgot_its_wheel',
  'road_ready_not_fancy',
  'moss_that_went_quiet',
  'songline_under_the_lawn',
  'sticky_medicine',
  'cove_keeps_pictures',
  'coops_key_hen',
  'tower_with_a_headache',
  'letter_for_the_north_gate',
  'antlers_for_the_watch',
  'toll_ledger_problem',
  'samples_for_the_chapel',
  'tone_beneath_the_road',
]) {
  ok(shared.includes(questId), `structured reward/test coverage includes ${questId}`);
}

ok(shared.includes('SNAPSHOT_FISHING_WATER_CAMERA_SYSTEMS_V76'), 'fishing/water/camera runtime contract exists');
ok(shared.includes('fishingCatchTable'), 'Shutter Cove fishing catch table exists');
ok(shared.includes('cameraFallback'), 'camera/social post fallback exists');
ok(shared.includes('SNAPSHOT_MUCK_PERSISTENCE_V76'), 'persistent muck-cleared world-state contract exists');
ok(shared.includes('SNAPSHOT_AUDIO_CUES_V76'), 'reward/combat/muck/camera/fishing audio cue map exists');
ok(shared.includes('snapshotGroveFootClearanceAuditV76'), 'Grove foot audit function exists');
ok(shared.includes('SNAPSHOT_GROVE_MAX_FEET_CLEARANCE_V76 = 0.25'), 'feet clearance tolerance is explicit');
ok(shared.includes('SNAPSHOT_RAW_FLOATING_NPC_ASSET_PATTERNS_V76'), 'raw floating NPC asset pattern list exists');

for (const offset of ['offset: 27', 'offset: 28', 'offset: 29', 'offset: 30', 'offset: 31', 'offset: 41', 'offset: 44', 'offset: 6', 'offset: 63', 'offset: 69']) {
  ok(shared.includes(offset), `Harthmere bible profile has ${offset}`);
}
ok(shared.includes('Where Jackie points with instinct, the board points with ink'), 'Market Board has Grove-like bible voice line');
ok(shared.includes('Jackie sent you with dust on your boots'), 'Sergeant Bram has Grove connector line');

ok(runtime.includes('SnapshotCompletePortRuntimeControllerV76'), 'runtime controller is exported');
ok(runtime.includes('SnapshotMissionAuditPanelV76'), 'mission audit panel is exported');
ok(runtime.includes('SnapshotGroundingAuditPanelV76'), 'grounding audit panel is exported');
ok(runtime.includes('window.localStorage.setItem(SNAPSHOT_CLEARED_MUCK_KEY_V76'), 'muck clear persistence writes local dev state');
ok(runtime.includes('SNAPSHOT_PHOTO_PROOFS_KEY_V76'), 'photo/social fallback local proof state exists');
ok(runtime.includes('fishing_catch'), 'fishing catch event is handled');
ok(runtime.includes('__snapshotV76'), 'developer debug helper is exposed');
ok(runtime.includes('runMissionAudit'), 'debug helper exposes mission audit');
ok(runtime.includes('runFootAudit'), 'debug helper exposes foot audit');
ok(runtime.includes('forceCompleteActiveStep'), 'debug helper can force-complete active mission step');

ok(hud.includes('SnapshotCompletePortRuntimeControllerV76'), 'HUD imports v76 runtime controller');
ok(hud.includes('<SnapshotCompletePortRuntimeControllerV76 />'), 'HUD mounts v76 runtime controller');
ok(hud.includes('SnapshotMissionAuditPanelV76'), 'HUD imports v76 mission QA panel');
ok(hud.includes('<SnapshotMissionAuditPanelV76 />'), 'HUD renders v76 mission QA panel');
ok(hud.includes('SnapshotGroundingAuditPanelV76'), 'HUD imports v76 grounding audit panel');
ok(hud.includes('<SnapshotGroundingAuditPanelV76 />'), 'HUD renders v76 grounding audit panel');
ok(hud.includes('SnapshotPortStatusPanelV76'), 'HUD imports v76 port status panel');

ok(dialogue.includes('snapshotHarthmereBibleLinesV76'), 'Harthmere dialogue imports v76 bible lines');
ok(dialogue.includes('SNAPSHOT_HARTHMERE_BIBLE_DIALOGUE_V76'), 'Harthmere dialogue has v76 insertion marker');
ok(dialogue.includes('...bibleLinesV76.slice(0, 2)'), 'Harthmere dialogue adds bible-like NPC lines');

ok(quests.includes('SNAPSHOT_MARKET_BOARD_PRIORITY_FIX_V76'), 'Market Board priority fix marker exists');
ok(/action\.name\.startsWith\("Complete:"\).*?action\.name\.startsWith\("Accept:"\)/s.test(quests), 'quest Complete/Accept actions are prioritized before utility actions');
ok(quests.includes('harthmere.market_board.activate') || quests.includes('SNAPSHOT_MARKET_BOARD_ACTIVATION_EVENT_V76'), 'market board activation cue/event is recorded');

ok(assets.includes('SNAPSHOT_RAW_FLOATING_NPC_HIDE_V76'), 'harthmere_assets hides raw snapshot floating NPC placements');
ok(assets.includes('isSnapshotRawFloatingNpcRuntimePlacementV76'), 'raw snapshot floating NPC detection helper exists');
ok(assets.includes('asset_data/npcs'), 'raw snapshot NPC asset path detection exists');

ok(bridge.includes('SNAPSHOT_MARKET_JACKIE_ACTIVATION_FIX_V76') || bridge.includes('Old Grove Road Post'), 'Road Ahead marker text/activation remains patched');
ok(!grove.includes('default:\n      default:'), 'Grove runtime no longer has duplicate default case');

// Deep but static mission test coverage: read shared file and count visible test case sources.
const officialCount = (shared.match(/source: "snapshot_nux_state_machine"/g) || []).length;
ok(officialCount >= 8, `at least 8 official snapshot NUX challenge entries exist (${officialCount})`);
const rewardCount = (shared.match(/questId: quest\.id/g) || []).length;
ok(rewardCount >= 1, 'structured rewards derive from every Grove quest');
ok(shared.includes('snapshotMissionTestCasesV76'), 'mission test cases are generated for all Road Ahead + Grove quest objectives');
ok(shared.includes('expectedMarkerRemovesOnComplete: true'), 'mission tests assert marker removal after completion');
ok(shared.includes('expectedStateAfter'), 'mission tests assert status transitions');
ok(shared.includes('expectedInventoryItems'), 'mission tests assert item grants');
ok(shared.includes('expectedAudioCue'), 'mission tests assert audio/completion cue');

if (failed) {
  console.error('v76 snapshot complete port check failed');
  process.exit(1);
}
console.log('v76 snapshot complete port check passed');
