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

const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const shim = read("src/server/shim/main.ts");

ok(assets.includes("HARTHMERE_SNAPSHOT_BUILT_RUNTIME_POLICY_VERSION_V67"), "client has snapshot-built runtime policy marker");
ok(assets.includes("filterHarthmereSnapshotBuiltRuntimePlacementsV67"), "client filters runtime GLB/map placements");
ok(assets.includes("isHarthmereRuntimeGlbAssetV67"), "client detects GLB runtime assets by asset path");
ok(assets.includes("snapHarthmereRuntimePlacementToGroundV67"), "client snaps runtime actors to ground");
ok(assets.includes("return snapHarthmereRuntimePlacementToGroundV67(placement);"), "client snaps actors even when extra-town offset is disabled");
ok(assets.includes("snapshotBuiltFiltered.removed"), "client reports removed snapshot-built runtime assets");
ok(assets.includes("for (const placement of snapshotBuiltFiltered.placements)"), "client performance pass uses filtered placements, not stale unfiltered placements");
ok(shim.includes("HARTHMERE_NPC_GROUNDING_VERSION_V67"), "server has NPC grounding marker");
ok(shim.includes("harthmereGroundedNpcWorldPositionV67(npc.position)"), "server uses grounded NPC positions");
ok(shim.includes("HARTHMERE_CONNECTED_ROAD_SURFACE_V67"), "server has explicit connected road surface");
ok(shim.includes("HARTHMERE_CONNECTED_ROAD_BLOCK_CUES_VERSION_V67"), "server has block-built connector road signs/lamps/banners");
ok(shim.includes("HARTHMERE_AUTO_EXTERNAL_STAIRS_VERSION_V67"), "server has auto external stairs for missed multi-floor buildings");
ok(!/position:\s*harthmereWorldPositionV1\(npc\.position\)/.test(shim), "no raw NPC position shift remains");

if (process.exitCode) process.exit(process.exitCode);
console.log("PASS harthmere snapshot-built grounded v67");
