#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "../..");
const main = fs.readFileSync(path.join(root, "src/server/shim/main.ts"), "utf8");
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const npcText = fs.readFileSync(path.join(root, "src/shared/harthmere/npc_compendium.ts"), "utf8");
const structureManifestPath = path.join(root, "public/harthmere-debug/harthmere-server-voxel-structure-manifest.json");
const housingManifestPath = path.join(root, "public/harthmere-debug/harthmere-npc-housing.json");
const npcs = JSON.parse(npcText.match(/export const HARTHMERE_NAMED_NPCS = (\[[\s\S]*?\]) as const;/)[1]);
const housingMatch = assets.match(/const HARTHMERE_NPC_HOME_ROOMS = (\[[\s\S]*?\]) as const;/);
let failures = 0;
function check(label, ok) {
  if (ok) console.log("OK", label);
  else { console.error("FAIL", label); failures += 1; }
}

check("current server structure marker exists", main.includes("HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_VERSION"));
check("current room partition marker exists", main.includes("HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_VERSION"));
check("room partition function is called from building generator", /harthmereInteriorPartitionBlockAt\(materials, building, worldX, worldY, worldZ\)/.test(main));
check("wilds structure/tree marker exists", main.includes("HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_VERSION"));
check("backend voxel tree target encoded", main.includes("HARTHMERE_BACKEND_VOXEL_TREE_TARGET = 5000"));
check("backend voxel trees are env-gated", main.includes("BIOMES_LOCAL_DEV_BACKEND_VOXEL_TREES") && /HARTHMERE_BACKEND_VOXEL_TREES_ENABLED[\s\S]*process\.env/.test(main));
check("remaining wilds structures are server voxel", ["miller_rest_watermill", "mill_worker_cottage", "last_watch_post_bunkhouse", "northwest_ruined_watchtower", "southwest_orchard_windmill", "dockside_family_house"].every((s) => main.includes(s)));
check("current runtime structural filter exists", assets.includes("HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION"));
check("runtime filter removes obj houses", assets.includes('"obj_house_1"') && assets.includes('"obj_house_2"') && assets.includes('"obj_house_3"'));
check("runtime filter removes bridge/tower/watermill/windmill bodies", assets.includes('"obj_bridge_medium_body"') && assets.includes('"obj_tower_complex"') && assets.includes('"arch_watermill"') && assets.includes('"arch_windmill"'));
check("prepare path uses current structural filter", (assets.includes("filterHarthmereServerVoxelOwnedStructuralPlacements(placements)") || assets.includes("filterHarthmereServerVoxelOwnedStructuralPlacements(shiftedPlacements)")));
check("NPC collision path uses current structural filter", assets.includes("filterHarthmereServerVoxelOwnedStructuralPlacements(PLACEMENTS)"));
check("NPC home furniture function exists", assets.includes("createHarthmereNpcHomeFurniture"));
check("NPC home furniture is injected into placements", assets.includes("...createHarthmereNpcHomeFurniture(),"));
check("NPC home room literal exists", Boolean(housingMatch));
const rooms = housingMatch ? JSON.parse(housingMatch[1]) : [];
check("every named NPC has a home room", rooms.length === npcs.length);
const ids = new Set(rooms.map((r) => r.npcId));
for (const npc of npcs) {
  const room = rooms.find((r) => r.npcId === npc.id);
  check(npc.id + " has current room", Boolean(room));
  if (room) {
    check(npc.id + " route home matches room home label", room.homeLabel === npc.route.homeLocation && room.homeLabel === npc.home);
    check(npc.id + " has furniture kit", Array.isArray(room.furniture) && room.furniture.length >= 5);
    check(npc.id + " room waypoint is 3D", Array.isArray(room.at) && room.at.length === 3 && room.at.every((n) => typeof n === "number"));
  }
}
check("no duplicate NPC room assignments", ids.size === rooms.length);
check("structure manifest written", fs.existsSync(structureManifestPath));
check("housing manifest written", fs.existsSync(housingManifestPath));
if (fs.existsSync(structureManifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(structureManifestPath, "utf8"));
  check("structure manifest lists at least 55 server voxel structures", manifest.structureCount >= 55);
  check("structure manifest documents voxel tree gate", manifest.backendVoxelTrees && manifest.backendVoxelTrees.enabledByDefault === false && manifest.backendVoxelTrees.target === 5000);
}
if (fs.existsSync(housingManifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(housingManifestPath, "utf8"));
  check("housing manifest covers all named NPCs", manifest.npcCount === manifest.housingCount && manifest.allNamedNpcsHaveHousing === true);
}
if (failures) {
  console.error("\n" + failures + " current occupancy checks failed.");
  process.exit(1);
}
console.log("\nAll current server-voxel occupancy/structure checks passed.");
