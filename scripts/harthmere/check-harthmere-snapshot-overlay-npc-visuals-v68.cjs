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

ok(overlays.includes("SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION_V68"), "overlay missing-size compatibility marker exists");
ok(overlays.includes("getOverlayEntitySizeCompatV68(entity)"), "basicEntityPosition uses overlay size compatibility helper");
ok(!/const npcSize = getSizeForEntity\(entity\);\s*ok\(npcSize\);/.test(overlays), "basicEntityPosition no longer hard-crashes on missing size");
ok(overlays.includes("return [1, 2, 1];"), "overlay fallback uses conservative human overlay height");

ok(npcs.includes("SNAPSHOT_PLAYERLIKE_NPC_VISIBLE_FALLBACK_VERSION_V68"), "snapshot player-like NPC visible fallback marker exists");
ok(npcs.includes("shouldForceVisibleSnapshotPlayerLikeNpcFallbackV68"), "player-like NPC fallback decision helper exists");
ok(npcs.includes("makeSnapshotPlayerLikeNpcVisibleFallbackGltfV68"), "player-like NPC visible fallback mesh helper exists");
ok(npcs.includes("BIOMES_SNAPSHOT_NPC_RENDERER"), "snapshot NPC renderer escape hatch exists");
ok(npcs.includes("makeSnapshotPlayerLikeNpcVisibleFallbackGltfV68(deps, id, npcType)"), "makeNpcMesh uses visible fallback before legacy player-like renderer");

if (process.exitCode) {
  console.error("v68 snapshot overlay/NPC visuals check failed");
  process.exit(process.exitCode);
}
console.log("v68 snapshot overlay/NPC visuals check passed");
