#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const repo = path.resolve(__dirname, "..", "..");
function read(rel) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}
function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

const shim = read("src/server/shim/main.ts");
const players = read("src/server/logic/utils/players.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const snapshot = read("scripts/b/data_snapshot.py");
const registry = read("src/shared/harthmere/town_registry.ts");
const routes = read("src/shared/harthmere/town_routes.ts");
const townMap = read("src/shared/harthmere/town_map.ts");
const design = read("src/shared/harthmere/design_rules_v66.ts");

ok(shim.includes("HARTHMERE_CONNECTED_MAP_ROAD_VERSION_V66"), "server connected-road version marker exists");
ok(shim.includes("HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_X_V66 = 512"), "server default connected offset is 512");
ok(shim.includes("HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X_V66"), "server authored snapshot edge road constants exist");
ok(shim.includes("HARTHMERE_CONNECTED_MAP_ROAD_SURFACE_V66"), "server paints readable connector road shoulder");
ok(players.includes('BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ?? "512"'), "player Harthmere spawn default offset is 512");
ok(assets.includes('"512"'), "client runtime default offset includes 512");
ok(assets.includes("HARTHMERE_CONNECTED_MAP_ROAD_V66 Snapshot edge road"), "client renders snapshot edge road placements");
ok(assets.includes("traveler return-safely candle shrine"), "client includes Wilds-bible traveler shrine cue");
ok(assets.includes("bandit scout watching from hedgerow"), "client includes off-road danger cue");
ok(snapshot.includes('os.environ.get("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X", "512")'), "data snapshot exports client offset default 512");
ok(registry.includes("HARTHMERE_LORE_DESIGN_RULES_VERSION_V66"), "registry exposes lore design rules");
ok(registry.includes("snapshot_edge_road"), "wilds registry includes snapshot edge road service");
ok(routes.includes("HARTHMERE_CONNECTED_MAP_ROUTE_ANCHORS_V66"), "route anchors include connected map road");
ok(townMap.includes("HARTHMERE_CONNECTED_MAP_PRESENTATION_V66"), "town map exposes connected road presentation");
ok(design.includes("Harthmere must be reachable from a visible edge road"), "design rules file states connected-not-hidden rule");
ok(design.includes("shiftedDefaultRoad"), "design rules file records shifted road coordinates");

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("PASS harthmere connected town design v66");
