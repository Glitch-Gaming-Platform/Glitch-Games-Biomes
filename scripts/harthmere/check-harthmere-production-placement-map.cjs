#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let failures = 0;
function ok(condition, label) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const resolver = read("src/shared/harthmere/production_terrain_placement_map.ts");
const generated = read("src/shared/harthmere/generated/production_terrain_placement_map.ts");
const runtime = read("src/shared/harthmere/bible_quest_live_authority.ts");
const jobsBoard = read("src/shared/harthmere/jobs_board_quest_marker_positions.ts");
const mapPinned = read("src/client/components/biomes_ui/adapters/mapPinnedDestination.ts");
const jobsBoardMap = read("src/client/components/biomes_ui/adapters/jobsBoardQuestMapAdapter.ts");
const questMarkers = read("src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts");

ok(
  resolver.includes("resolveHarthmereQuestObjectivePlacement"),
  "quest placement resolver is exported"
);
ok(
  resolver.includes("chooseHarthmereQuestCaveSpawnPoint"),
  "cave spawn chooser is exported"
);
ok(
  resolver.includes("chooseHarthmereQuestOutdoorSpawnPoint"),
  "outdoor spawn chooser is exported"
);
ok(
  generated.includes("HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP"),
  "generated placement map module exists"
);
ok(
  runtime.includes("resolveHarthmereQuestObjectivePlacement"),
  "quest runtime references production placement map"
);
ok(
  runtime.includes("getHarthmereQuestResolvedWaypoint"),
  "quest runtime has resolved waypoint helper"
);
ok(
  jobsBoard.includes("harthmereJobsBoardQuestMarkerRuntimePositionForTodo"),
  "jobs-board markers expose runtime-resolved positions"
);
ok(
  jobsBoardMap.includes("harthmereJobsBoardQuestMarkerRuntimePositionForTodo"),
  "BiomesUI jobs-board map uses runtime-resolved positions"
);
ok(
  mapPinned.includes("resolveHarthmereProductionMarkerPosition"),
  "active map pin / quest pointer resolves production marker positions"
);
ok(
  questMarkers.includes("harthmereJobsBoardQuestMarkerRuntimePosition"),
  "3D quest-object markers use runtime-resolved positions"
);

if (failures > 0) {
  console.error(`\n${failures} production placement-map check(s) failed.`);
  process.exit(1);
}

console.log("\nAll production placement-map checks passed.");
