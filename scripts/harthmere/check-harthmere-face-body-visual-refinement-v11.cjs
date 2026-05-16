#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const checks = [];
let failed = false;
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const check = (label, ok) => {
  checks.push({ label, ok });
  if (!ok) failed = true;
};
const player = read("src/client/game/resources/player_mesh.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const runtime = read("src/client/game/renderers/local_dev/harthmere_assets.ts");

check("player visual refinement version exists", player.includes("HARTHMERE_PLAYER_FACE_BODY_VISUAL_REFINEMENT_VERSION"));
check("player side profile type exists", player.includes("type HarthmerePlayerFaceSideProfile"));
check("player stores sideProfile in face spec", player.includes("sideProfile: HarthmerePlayerFaceSideProfile"));
check("player draws left asymmetric head side", player.includes("local-dev-bolt-left-side-plane-asym"));
check("player draws right asymmetric head side", player.includes("local-dev-bolt-right-side-plane-asym"));
check("ECS NPC imports RoundedBoxGeometry", npcs.includes("RoundedBoxGeometry"));
check("ECS NPC uses MeshToonMaterial", npcs.includes("new THREE.MeshToonMaterial"));
check("ECS NPC uses rounded voxel geometry", npcs.includes("new RoundedBoxGeometry"));
check("ECS NPC side profile type exists", npcs.includes("type HarthmereNpcFaceSideProfile"));
check("ECS NPC stores sideProfile in face spec", npcs.includes("sideProfile: HarthmereNpcFaceSideProfile"));
check("ECS NPC draws asymmetric head sides", npcs.includes("harthmere-npc-left-head-side-asym") && npcs.includes("harthmere-npc-right-head-side-asym"));
check("ECS NPC return sideProfile is valid", npcs.includes("return {\n    sideProfile,\n    headSize:") && !npcs.includes("headSize:    sideProfile"));
check("runtime visual refinement version exists", runtime.includes("HARTHMERE_FACE_BODY_VISUAL_REFINEMENT_VERSION"));
check("runtime unique cosmetics bumped to v11", runtime.includes("harthmere-unique-npc-cosmetics-v11-quality-faces"));
check("runtime side profile type exists", runtime.includes("type HarthmereRuntimeFaceSideProfile"));
check("runtime stores side profile userData", runtime.includes("harthmereRuntimeFaceSideProfile"));
check("runtime draws asymmetric head sides", runtime.includes("-left-head-side-asym") && runtime.includes("-right-head-side-asym"));
check("runtime draws asymmetric hair part", runtime.includes("-hair-part-asym"));
check("runtime unique NPC side lock exists", runtime.includes("npc-head-side-lock-asym"));
check("runtime has no undefined cosmetic color helper", !runtime.includes("harthmereCosmeticColorLighten"));

for (const item of checks) {
  console.log(`${item.ok ? "OK" : "FAIL"} ${item.label}`);
}
console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
