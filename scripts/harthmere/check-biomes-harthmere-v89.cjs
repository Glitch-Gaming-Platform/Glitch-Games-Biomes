#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  } else {
    console.log('OK', msg);
  }
}

const grab = read('src/server/logic/events/handlers/grab_bags.ts');
ok(grab.includes('BIOMES_PICKUP_MISSING_GRAB_BAG_QUIET_V89'), 'stale/missing grab bag pickup warnings are quieted');
ok(grab.includes('item: q.id(event.item).with("grab_bag").optional()'), 'pickup item query is optional');
ok(grab.includes('if (!item)'), 'pickup handler safely ignores missing grab bags');

const snapshot = read('src/client/components/challenges/SnapshotProductionPortV77.tsx');
ok(snapshot.includes('BIOMES_SNAPSHOT_PROGRESS_DEBOUNCE_V89'), 'snapshot progress garden-hose batching is installed');
ok(snapshot.includes('queueMutationV77(mutation)') && snapshot.includes('window.setTimeout(flush, 1500)'), 'snapshot mutations are queued and debounced');

const live = read('src/shared/harthmere/snapshot_live_debug_v78.ts');
ok(live.includes('SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS_V89'), 'shifted Harthmere bounds are classified as Harthmere, not Wilds');
ok(live.includes('snapshotPointInBoundsV78(position, SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS_V89)'), 'area classifier checks shifted Harthmere bounds');

const survey = read('src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx');
ok(survey.includes('harthmere-auto-survey-terrain-npc-performance-v89'), 'auto survey reports v89');
ok(survey.includes('BIOMES_AUTO_SURVEY_CONSOLE_QUIET_V89'), 'auto survey console spam is summarized');
ok(survey.includes('Date.now() - lastWarn > 15000'), 'auto survey warnings are throttled to 15 seconds');

const shim = read('src/server/shim/main.ts');
ok(shim.includes('HARTHMERE_NPC_SAFE_SPAWN_VERSION_V89'), 'server-side visible NPC spawn version exists');
ok(shim.includes('harthmereNpcSafeAuthoredPositionV89'), 'NPCs snap to safe visible authored positions');
ok(shim.includes('harthmereColumnHasNpcClearanceV89'), 'NPC spawn columns require feet/body/head clearance');
ok(shim.includes('harthmereDoorOutsideCandidatesV89'), 'NPCs authored inside buildings can move to door-side positions');
ok(shim.includes('BIOMES_HARTHMERE_BUILDING_ACCESS_CLEARANCE_V89'), 'building door access clearance is installed');
ok(shim.includes('harthmereV89DoorLaneClearanceBlock(building, worldX, worldY, worldZ)'), 'building blocks and room partitions honor door-lane clearing');

if (process.exitCode) process.exit(process.exitCode);
console.log('\nBiomes/Harthmere v89 checks passed.');
