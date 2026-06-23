#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
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

function countLiteralId(source, id) {
  return (source.match(new RegExp(`id: "${id}"`, "g")) || []).length;
}

const bridge = read(
  "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx"
);
const canonical = read("src/shared/harthmere/snapshot_complete_port.ts");
const overlay = read(
  "src/client/components/overlays/inspected/CursorInspectionOverlayComponent.tsx"
);
const objectInteractions = read(
  "src/client/components/challenges/harthmereObjectInteractions.ts"
);
const objectContainers = read(
  "src/client/components/challenges/harthmereObjectContainers.ts"
);
const dialogueSemantics = read(
  "src/client/components/challenges/dialogueObjectSemantics.ts"
);
const objectSemantics = read(
  "src/shared/harthmere/object_interaction_semantics.ts"
);
const helperQuests = read("src/shared/harthmere/live_entity_helper_quests.ts");
const ecsBridge = read("src/shared/harthmere/live_entity_ecs_bridge.ts");
const helperTest = read(
  "src/client/components/challenges/TalkToNPCDefaultDialog.liveEntityHelper.test.ts"
);

const canonicalRoadAheadStepIds = [
  "meet_jackie_in_grove",
  "road_ahead_meet_up_with_billy",
  "road_ahead_collect_muckwad",
  "road_ahead_place_blocks",
  "road_ahead_wear",
  "road_ahead_find_bag",
  "road_ahead_selfie",
  "busted_wooden_axe",
  "busted_muck_busters",
  "return_to_jackie",
];

const canonicalRewardAndItemSymbols = [
  "road_ahead_map_layer",
  "muck_handling_practice",
  "builder_footing_practice",
  "prepared_traveler_practice",
  "movement_practice",
  "photo_proof_practice",
  "repair_material_practice",
  "muck_buster_practice",
  "road_ready_milestone",
  "muckwad_sample",
  "road_repair_block_bundle",
  "grove_travel_top",
  "grove_travel_bottoms",
  "road_snack",
  "cove_photo_frame",
  "rough_repair_wood",
  "practice_muck_buster",
];

const targetObjectActions = {
  "Old Grove Road Post": ['"old grove road post"', '"read"', '"Read"'],
  "Muckwad Patch": ['"muckwad patch"', '"gather"', '"Gather"'],
  "Building Practice Spot": [
    '"building practice spot"',
    '"practice"',
    '"Practice"',
  ],
  "Lovely Locks Mirror": [
    '"lovely locks mirror"',
    '"check_outfit"',
    '"Check Outfit"',
  ],
  "Road Jump Stretch": ['"road jump stretch"', '"practice"', '"Practice"'],
  "Selfie Overlook": ['"selfie overlook"', '"take_photo"', '"Take Photo"'],
  "Fountain Workbench": ['"fountain workbench"', '"craft"', '"Craft"'],
  "Crossroads Service Tower": [
    '"crossroads service tower"',
    '"inspect"',
    '"Inspect"',
  ],
};

ok(
  canonical.includes('SNAPSHOT_ROAD_AHEAD_MISSION_TITLE = "Road Ahead"') &&
    canonical.includes(
      'SNAPSHOT_ROAD_AHEAD_MISSION_ID = "snapshot_road_ahead_full_chain"'
    ),
  "canonical Road Ahead mission is saved under the expected title and id"
);
ok(
  canonical.includes("SNAPSHOT_OFFICIAL_NUX_CHALLENGES"),
  "canonical current Road Ahead NUX view is still present"
);

for (const id of canonicalRoadAheadStepIds) {
  ok(
    countLiteralId(canonical, id) === 1,
    `canonical Road Ahead source has one ${id} step`
  );
  ok(
    countLiteralId(bridge, id) === 0,
    `Road Ahead bridge does not carry a duplicate ${id} step literal`
  );
}

for (const id of canonicalRoadAheadStepIds.slice(1, -1)) {
  ok(countLiteralId(canonical, id) === 1, `canonical chain has one ${id} step`);
}

for (const symbol of canonicalRewardAndItemSymbols) {
  ok(
    canonical.includes(symbol),
    `canonical Road Ahead/Busted reward or item symbol ${symbol} is saved`
  );
}

ok(
  overlay.includes("openHarthmereObjectContainer") &&
    overlay.includes("isHarthmereContainerObjectLabel") &&
    overlay.includes('"Open Container"'),
  "inspect overlay restores an F-key container action for authored objects"
);
ok(
  objectContainers.includes("HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION") &&
    objectContainers.includes("backfillLegacySealedRoadAheadClothingCrate") &&
    objectContainers.includes("questLootVersion"),
  "object containers backfill legacy sealed Road Ahead clothing crates once"
);
ok(
  overlay.includes("isHarthmereNonLivingObjectLabel") &&
    overlay.includes("performHarthmereObjectInteraction") &&
    objectInteractions.includes("HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT") &&
    objectInteractions.includes("dispatchHarthmereWorldObjectInteractionEvent"),
  "inspect overlay restores F-key actions for non-container world objects"
);
ok(
  objectSemantics.includes("open_jobs_board") &&
    objectSemantics.includes('"cook"') &&
    objectSemantics.includes('"craft"') &&
    objectSemantics.includes('"recover"') &&
    objectSemantics.includes('"tend"'),
  "object semantics distinguish jobs boards, cooking stations, crafting stations, recovery, and tended beds"
);
ok(
  objectInteractions.includes("HARTHMERE_JOBS_BOARD_OPEN_EVENT") &&
    objectInteractions.includes(
      'dispatchHarthmereHudActionEvent("crafting")'
    ) &&
    objectInteractions.includes("harthmereReadableObjectTextForLabel"),
  "client object interactions route jobs boards, craft/cook stations, and readable text through real UI paths"
);
ok(
  dialogueSemantics.includes("isHarthmereNonLivingObjectLabel") &&
    helperQuests.includes("isHarthmereNonLivingObjectLabel") &&
    ecsBridge.includes("isHarthmereNonLivingObjectLabel"),
  "dialogue, helper quests, and ECS combat classification share non-living object semantics"
);
for (const term of [
  "stakes?",
  "fences?",
  "tables?",
  "mirrors?",
  "patch(?:es)?",
  "ovens?",
  "cookpots?",
  "mailbags?",
]) {
  ok(
    objectSemantics.includes(term),
    `object semantics include authored world object term ${term}`
  );
}

for (const label of [
  "Clothing Crate",
  "Billy's Toolbag",
  "Chest The Grove Underwater Main",
  "Gus's Oven",
  "Carlo's Cookpot",
  "Fountain Workbench",
  "Old Grove Road Post",
  "Fountain Lesson Board",
]) {
  ok(helperTest.includes(label), `${label} is covered by regression tests`);
}

for (const [label, snippets] of Object.entries(targetObjectActions)) {
  ok(
    snippets.every((snippet) => objectSemantics.includes(snippet)) &&
      helperTest.includes(label),
    `${label} has the expected authored object action and test coverage`
  );
}

if (failures) {
  console.error(
    `Road Ahead object/container regression check failed: ${failures} failure(s)`
  );
  process.exit(1);
}

console.log("Road Ahead object/container regression check passed");
