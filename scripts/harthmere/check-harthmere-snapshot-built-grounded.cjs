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

ok(
  assets.includes("HARTHMERE_SNAPSHOT_BUILT_RUNTIME_POLICY_VERSION"),
  "client has snapshot-built runtime policy marker"
);
ok(
  assets.includes("filterHarthmereSnapshotBuiltRuntimePlacements"),
  "client filters runtime GLB/map placements"
);
ok(
  assets.includes("isHarthmereRuntimeGlbAsset"),
  "client detects GLB runtime assets by asset path"
);
ok(
  assets.includes("snapHarthmereRuntimePlacementToGround"),
  "client snaps runtime actors to ground"
);
ok(
  assets.includes("? placement") &&
    assets.includes(": snapHarthmereRuntimePlacementToGround(placement);"),
  "client snaps authored actors when extra-town offset is disabled while preserving already-world-space robot anchors"
);
ok(
  assets.includes("snapshotBuiltFiltered.removed"),
  "client reports removed snapshot-built runtime assets"
);
ok(
  assets.includes("for (const placement of snapshotBuiltFiltered.placements)"),
  "client performance pass uses filtered placements, not stale unfiltered placements"
);
ok(
  shim.includes("HARTHMERE_NPC_GROUNDING_VERSION"),
  "server has NPC grounding marker"
);
ok(
  shim.includes("position: harthmereGroundedNpcWorldPosition(npc.position)") ||
    shim.includes(
      "position: harthmereGroundedNpcWorldPositionWithClaim(npc, claimed)"
    ),
  "server uses grounded NPC positions"
);
ok(
  shim.includes("const claimed: HarthmereNpcClaimSet = new Set()") &&
    shim.includes("harthmereGroundedNpcWorldPositionWithClaim(npc, claimed)"),
  "server uses current collision-claimed grounded NPC positions"
);
ok(
  shim.includes("HARTHMERE_CONNECTED_ROAD_SURFACE"),
  "server has explicit connected road surface"
);
ok(
  shim.includes("HARTHMERE_CONNECTED_ROAD_BLOCK_CUES_VERSION"),
  "server has block-built connector road signs/lamps/banners"
);
ok(
  shim.includes("HARTHMERE_AUTO_EXTERNAL_STAIRS_VERSION"),
  "server has auto external stairs for missed multi-floor buildings"
);
ok(
  !/position:\s*harthmereWorldPosition\(npc\.position\)/.test(shim),
  "no raw NPC position shift remains"
);

if (process.exitCode) process.exit(process.exitCode);
console.log("PASS harthmere snapshot-built grounded current");
