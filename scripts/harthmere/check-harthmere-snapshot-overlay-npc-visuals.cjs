#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

const overlays = read("src/client/game/scripts/overlays.ts");
const npcs = read("src/client/game/resources/npcs.ts");

ok(overlays.includes("SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION"), "overlay missing-size compatibility marker exists");
ok(overlays.includes("getOverlayEntitySizeCompat(entity)"), "basicEntityPosition uses overlay size compatibility helper");
ok(!/const npcSize = getSizeForEntity\(entity\);\s*ok\(npcSize\);/.test(overlays), "basicEntityPosition no longer hard-crashes on missing size");
ok(overlays.includes("return [1, 2, 1];"), "overlay fallback uses conservative human overlay height");

const hasRichSnapshotFirstPath =
  npcs.includes("SNAPSHOT_RICH_NPC_APPEARANCE makeNpcMesh") &&
  npcs.includes("makeSnapshotPlayerLikeAppearanceMesh(deps, id)");
ok(!npcs.includes("makeSnapshotPlayerLikeNpcVisibleFallbackGltf"), "player-like NPCs no longer use the Harthmere voxel fallback");
ok(
  hasRichSnapshotFirstPath,
  "makeNpcMesh uses the rich player/Grove avatar path before unsafe legacy player-like renderer"
);

if (process.exitCode) {
  console.error("current snapshot overlay/NPC visuals check failed");
  process.exit(process.exitCode);
}
console.log("current snapshot overlay/NPC visuals check passed");
