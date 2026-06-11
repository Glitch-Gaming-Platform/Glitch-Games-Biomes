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

const resolver = read("src/shared/harthmere/production_terrain_placement_map_v1.ts");
const generated = read("src/shared/harthmere/generated/production_terrain_placement_map_v1.ts");
const runtime = read("src/shared/harthmere/quest_runtime_v47.ts");
const jobsBoard = read("src/shared/harthmere/jobs_board_quest_marker_positions_v1.ts");
const mapPinned = read("src/client/components/biomes_ui/adapters/mapPinnedDestination.ts");
const jobsBoardMap = read("src/client/components/biomes_ui/adapters/jobsBoardQuestMapAdapter.ts");
const questMarkers = read("src/client/game/renderers/local_dev/harthmere_quest_object_markers_v145.ts");

ok(
  resolver.includes("resolveHarthmereQuestObjectivePlacementV1"),
  "quest placement resolver is exported"
);
ok(
  resolver.includes("chooseHarthmereQuestCaveSpawnPointV1"),
  "cave spawn chooser is exported"
);
ok(
  resolver.includes("chooseHarthmereQuestOutdoorSpawnPointV1"),
  "outdoor spawn chooser is exported"
);
ok(
  generated.includes("HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_V1"),
  "generated placement map module exists"
);
ok(
  runtime.includes("resolveHarthmereQuestObjectivePlacementV1"),
  "quest runtime references production placement map"
);
ok(
  runtime.includes("getHarthmereQuestResolvedWaypointV47"),
  "quest runtime has resolved waypoint helper"
);
ok(
  jobsBoard.includes("harthmereJobsBoardQuestMarkerRuntimePositionForTodoV1"),
  "jobs-board markers expose runtime-resolved positions"
);
ok(
  jobsBoardMap.includes("harthmereJobsBoardQuestMarkerRuntimePositionForTodoV1"),
  "BiomesUI jobs-board map uses runtime-resolved positions"
);
ok(
  mapPinned.includes("resolveHarthmereProductionMarkerPositionV1"),
  "active map pin / quest pointer resolves production marker positions"
);
ok(
  questMarkers.includes("harthmereJobsBoardQuestMarkerRuntimePositionV1"),
  "3D quest-object markers use runtime-resolved positions"
);

if (failures > 0) {
  console.error(`\n${failures} production placement-map check(s) failed.`);
  process.exit(1);
}

console.log("\nAll production placement-map checks passed.");
