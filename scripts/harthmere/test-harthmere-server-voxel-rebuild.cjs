#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(__dirname, "../..");
const main = fs.readFileSync(path.join(repo, "src/server/shim/main.ts"), "utf8");
const assets = fs.readFileSync(path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");

let failures = 0;
function check(label, ok) {
  if (ok) {
    console.log("OK", label);
  } else {
    console.error("FAIL", label);
    failures += 1;
  }
}

const structureNames = [...main.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueNames = new Set(structureNames);

check("current server voxel marker exists", main.includes("HARTHMERE_SERVER_VOXEL_ALL_BUILDINGS_DUNGEONS_VERSION"));
check("all structures live in shim/server terrain layer", /const HARTHMERE_BUILDINGS:\s*HarthmereBuilding\[]/.test(main));
check("at least 40 server voxel buildings are defined", uniqueNames.size >= 40);
check("missing north gate gatehouse is server voxel", main.includes("north_gate_west_gatehouse") && main.includes("north_gate_east_gatehouse"));
check("missing toll booth is server voxel", main.includes("north_gate_toll_booth"));
check("Brother Vance cottage is server voxel", main.includes("brother_vance_chapel_cottage"));
check("Mara Thistle house is server voxel", main.includes("mara_thistle_two_story_house"));
check("Edrik Vane estate is server voxel", main.includes("edrik_vane_noble_rise_estate"));
check("residential apartments are server voxel", main.includes("rosewall_house") && main.includes("millers_rest_house"));
check("slum stacks are 4-5 story server voxel", /tangle_stairs_stack[\s\S]*floors:\s*5/.test(main) && /washline_stack[\s\S]*floors:\s*4/.test(main));
check("stairs and balconies are terrain-generator fields", /type HarthmereStairs/.test(main) && /type HarthmereBalcony/.test(main));
check("stair opening prevents ceiling blocker", /harthmereIsStairOrLanding/.test(main) && /return undefined;/.test(main));
check("bridge parapets are priority server voxel blocks", /Real walkable bridge with parapets/.test(main));
check("north gate crossbar is priority before street clear", /Large, obvious north-gate crossbar/.test(main) && /priorityBlock[\s\S]*harthmereShouldForceClearRoofStreetAirBlock/.test(main));
check("dungeon areas are defined", /HARTHMERE_DUNGEON_AREAS/.test(main) && /rat_crowns_den/.test(main) && /crypt_rest_room/.test(main));
check("underground dungeon air carve hook exists", /harthmereShouldCarveDungeonAirBlockAt/.test(main));
check("terrain seed loop calls dungeon air carve", /!harthmereShouldCarveDungeonAirBlockAt\((?:worldX|authoredWorldX), worldY, (?:worldZ|authoredWorldZ)\)/.test(main));
check("runtime structural filter exists", assets.includes("HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION"));
check("runtime filter removes arch_wall_stone placements", /HARTHMERE_SERVER_VOXEL_OWNED_STRUCTURAL_ASSETS[\s\S]*"arch_wall_stone"/.test(assets));
check("runtime filter is called before floating/performance prep", /serverVoxelFiltered = filterHarthmereServerVoxelOwnedStructuralPlacements[45]\((?:placements|shiftedPlacements)\)[\s\S]*filterHarthmereUnsupportedFloatingBlockPlacements\(serverVoxelFiltered\.placements\)/.test(assets));
check("NPC collision cache also ignores server-voxel-owned structural GLBs", /serverVoxelCollisionPlacements = filterHarthmereServerVoxelOwnedStructuralPlacements[45]\(PLACEMENTS\)\.placements[\s\S]*serverVoxelCollisionPlacements\.map/.test(assets));
check("wall-block asset registration is preserved", /gltf\("arch_wall_stone",\s*"glb\/buildings\/fantasy_town\/wall-block\.glb"/.test(assets));
check("server voxel rebuild did not replace arch_wall_stone with mine_stone_01", !/arch_wall_stone[\s\S]{0,120}mine_stone_01/.test(assets.slice(0, 3500)));

if (failures) {
  console.error("\n" + failures + " checks failed");
  process.exit(1);
}
console.log("\nAll current server-voxel rebuild checks passed.");
