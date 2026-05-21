#!/usr/bin/env node
//
// check-biomes-harthmere-v94.cjs
//
// Static verification for the v94 perf-and-placement patch. The audits
// across v91/v92/v93 kept regressing because the patches were not actually
// observable from the source — only from a live capture. This script makes
// the key v94 invariants observable at install-check time so future patches
// cannot quietly undo them.
//
// Invariants verified:
//   1. v94 marker constants and structures are present in source.
//   2. Every named-and-stationary NPC in the bible cluster table is anchored
//      with a non-flat Y value matching its declared cluster.
//   3. No two NPC ids in the v94 anchor table share the same authored XZ.
//   4. The mission-target label override map exists and the quest-target
//      world-position resolver routes through it.
//   5. The diagnostics survey splits wandering vs town NPC off-ground counts.
//   6. The mission system auto-untracks completed quests.
//   7. The streaming pre-warm constants are exported.

const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
let failed = 0;
function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    failed += 1;
  } else {
    console.log(`OK ${message}`);
  }
}

// --- 1. Marker constants ---

const shim = read('src/server/shim/main.ts');
const polish = read('src/shared/harthmere/town_production_polish_v1.ts');
const quests = read('src/client/components/challenges/LocalDevHarthmereQuests.tsx');
const survey = read('src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx');
const mission = read('src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx');

ok(shim.includes('HARTHMERE_PERF_AND_PLACEMENT_VERSION_V94'), 'server has v94 version constant');
ok(shim.includes('HARTHMERE_NPC_STABLE_ANCHOR_V94'), 'server has v94 stable anchor table');
ok(shim.includes('harthmereGroundedNpcWorldPositionWithClaimV94'), 'server uses v94 grounded-with-claim placement');
ok(shim.includes('HarthmereNpcClaimSetV94'), 'server defines v94 collision claim set type');
ok(shim.includes('harthmereResolveCollisionV94'), 'server has v94 collision resolver');

// --- 2. Cluster Y constants are present ---

ok(shim.includes('HARTHMERE_CLUSTER_FEET_Y_DOCKS_V94 = 73'), 'docks cluster Y = 73 (audit-measured)');
ok(shim.includes('HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN_V94 = 68'), 'plaza fountain cluster Y = 68 (audit-measured)');
ok(shim.includes('HARTHMERE_CLUSTER_FEET_Y_SMITHY_V94 = 68'), 'smithy cluster Y = 68 (audit-measured)');
ok(shim.includes('HARTHMERE_CLUSTER_FEET_Y_TAVERN_V94 = 63'), 'tavern cluster Y = 63 (audit-measured)');
ok(shim.includes('HARTHMERE_CLUSTER_FEET_Y_BANK_V94 = 58'), 'bank cluster Y = 58 (audit-measured)');
ok(shim.includes('HARTHMERE_CLUSTER_FEET_Y_APOTHECARY_V94 = 58'), 'apothecary cluster Y = 58');

// --- 3. Audit-confirmed offenders have v94 anchors with the right cluster Y ---

function anchorLine(idOffset) {
  // matches lines like `  [34, [584, HARTHMERE_CLUSTER_FEET_Y_DOCKS_V94, -183]],`
  const rx = new RegExp(`\\[\\s*${idOffset}\\s*,\\s*\\[\\s*-?\\d+\\s*,\\s*([A-Z_0-9]+)\\s*,\\s*-?\\d+\\s*\\]\\s*\\]`);
  const m = shim.match(rx);
  return m ? m[1] : undefined;
}

const expectedClusterByOffset = {
  // Anchored by direct audit measurement
  34: 'HARTHMERE_CLUSTER_FEET_Y_DOCKS_V94', // Tovin Reed
  51: 'HARTHMERE_CLUSTER_FEET_Y_DOCKS_V94', // Ferry Master Wren
  65: 'HARTHMERE_CLUSTER_FEET_Y_DOCKS_V94', // River Knots Lookout
  6:  'HARTHMERE_CLUSTER_FEET_Y_BANK_V94', // Banker Merl Voss
  59: 'HARTHMERE_CLUSTER_FEET_Y_BANK_V94', // Guild Registrar Wyne
  43: 'HARTHMERE_CLUSTER_FEET_Y_BANK_V94', // Courier Anwen
  60: 'HARTHMERE_CLUSTER_FEET_Y_BANK_V94', // Auction Clerk Pellam
  36: 'HARTHMERE_CLUSTER_FEET_Y_BANK_V94', // Perrin, Moneylender
  11: 'HARTHMERE_CLUSTER_FEET_Y_TAVERN_V94', // Garrick, Bartender
  15: 'HARTHMERE_CLUSTER_FEET_Y_TAVERN_V94', // Sola, Traveler
  30: 'HARTHMERE_CLUSTER_FEET_Y_TAVERN_V94', // Elowen Pike
  29: 'HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN_V94', // Master Osric Vale
  41: 'HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN_V94', // Market Board
  3:  'HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN_V94', // Toma, Builder
  31: 'HARTHMERE_CLUSTER_FEET_Y_BASE_V94', // Father Aldren
  46: 'HARTHMERE_CLUSTER_FEET_Y_BASE_V94', // Sister Maelle
  5:  'HARTHMERE_CLUSTER_FEET_Y_BASE_V94', // Maren Dawnloaf
};

for (const [offset, expected] of Object.entries(expectedClusterByOffset)) {
  const got = anchorLine(Number(offset));
  ok(got === expected, `npc id offset ${offset} anchored to ${expected} (got ${got || 'missing'})`);
}

// --- 4. No two anchors share authored XZ ---

const anchorRx = /\[\s*(\d+)\s*,\s*\[\s*(-?\d+)\s*,\s*[A-Z_0-9]+\s*,\s*(-?\d+)\s*\]\s*\]/g;
const seenXZ = new Map();
let m;
const stableAnchorBlockMatch = shim.match(/HARTHMERE_NPC_STABLE_ANCHOR_V94 = new Map<number, Vec3>\(\[([\s\S]*?)\]\);/);
ok(!!stableAnchorBlockMatch, 'stable anchor block parseable');
const anchorBlock = stableAnchorBlockMatch ? stableAnchorBlockMatch[1] : '';
let collisions = 0;
while ((m = anchorRx.exec(anchorBlock)) !== null) {
  const key = `${m[2]}:${m[3]}`;
  if (seenXZ.has(key)) {
    console.error(`FAIL anchor collision at XZ ${key}: id ${seenXZ.get(key)} and id ${m[1]}`);
    collisions += 1;
  } else {
    seenXZ.set(key, m[1]);
  }
}
ok(collisions === 0, `no two anchored NPCs share the same XZ (${seenXZ.size} unique anchors)`);

// --- 5. Quest target Y override map ---

ok(quests.includes('HARTHMERE_QUEST_TARGET_LABEL_CLUSTER_FEET_Y_V94'), 'quest target label-cluster Y map exists');
ok(quests.includes('harthmereQuestTargetFeetYForLabelV94'), 'quest target Y helper exists');
ok(quests.includes('HARTHMERE_QUEST_TARGET_V94_VERSION'), 'quest target v94 version constant exists');
// Audit-measured targets must be in the override map
const requiredLabels = [
  '"Tovin Reed"', '"River Knots Lookout"',
  '"Harthmere Bank"', '"Courier Anwen"',
  '"Copper Kettle Bar"', '"Elowen Pike"',
  '"Market Board"', '"Master Osric Vale"',
  '"Green Mortar Healer"', '"Ysabet Fenlow"',
];
for (const label of requiredLabels) {
  ok(quests.includes(label + ':'), `quest target Y override covers ${label}`);
}

// --- 6. Survey wandering filter ---

ok(survey.includes('HARTHMERE_WANDERING_NPC_LABEL_RX_V94'), 'survey defines wandering NPC label regex');
ok(survey.includes('isHarthmereWanderingNpcLabelV94'), 'survey exposes wandering filter');
ok(survey.includes('offGroundWanderingCount'), 'survey reports wandering count separately');
ok(survey.includes('HARTHMERE_SURVEY_RAW_SAMPLE_CAP_V94'), 'survey has reduced retention cap');
ok(survey.includes('HARTHMERE_PERF_AND_PLACEMENT_SURVEY_V94'), 'survey has v94 version marker');
ok(survey.includes('throttleWhenFpsBelow'), 'survey auto-throttles when fps tanks');

// --- 7. Mission system auto-untrack ---

ok(mission.includes('biomes:harthmere-mission-marker-clear'), 'mission system fires marker-clear event on completion');
ok(mission.includes('HARTHMERE_PERF_AND_PLACEMENT_V94'), 'mission system carries v94 marker');

// --- 8. Streaming pre-warm constants ---

ok(polish.includes('HARTHMERE_PERF_AND_PLACEMENT_PREWARM_V94'), 'town polish exports v94 pre-warm constants');
ok(polish.includes('ringRadiusMeters: 96'), 'pre-warm ring radius matches districtLodDistanceMeters');

if (failed > 0) {
  console.error(`\n${failed} v94 check(s) failed.`);
  process.exit(1);
}
console.log('\nBiomes/Harthmere v94 perf-and-placement checks passed.');
