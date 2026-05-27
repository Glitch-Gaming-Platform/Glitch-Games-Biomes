#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_NPC_RENDER_ASSET_COVERAGE_V163
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition, detail = "") { if (condition) console.log(`OK    ${label}`); else { ok = false; console.error(`FAIL  ${label}`); if (detail) console.error(`      ${detail}`); } }
function read(rel) { const p = path.join(root, rel); if (!fs.existsSync(p)) { check(`missing ${rel}`, false); return ""; } return fs.readFileSync(p, "utf8"); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
const npcResources = read("src/client/game/resources/npcs.ts");
const runtimeAssets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const assetVersionsPath = path.join(root, "src/galois/js/interface/gen/asset_versions.json");
const assetVersions = exists("src/galois/js/interface/gen/asset_versions.json") ? JSON.parse(fs.readFileSync(assetVersionsPath, "utf8")).paths : {};
check("player-like NPCs use makePlayerLikeAppearanceMesh", /npcType\.isPlayerLikeAppearance[\s\S]{0,260}makePlayerLikeAppearanceMesh\(deps, id\)/m.test(npcResources));
check("non-player NPCs require galoisPath", /ok\(npcType\.galoisPath[\s\S]{0,220}resolveAssetUrlUntyped\(npcType\.galoisPath\)/m.test(npcResources));
check("NPC meshes call replaceWithPlayerMaterial before render", /replaceWithPlayerMaterial\(gltf\)/.test(npcResources));
check("NPC meshes disable frustum culling for manual NPC renderer", /setFrustumCulling\(gltf, false\)/.test(npcResources) && /setFrustumCulling\(mesh, false\)/.test(npcResources));
check("NPC animation system has attack action", /attack:\s*\{\s*fileAnimationName:\s*["']Attack["']/.test(npcResources));
for (const asset of ["npcs/seedy_muckling", "npcs/brown_hexer", "npcs/purple_hexer", "item_meshes/npcs/seedy_muckling", "item_meshes/npcs/brown_hexer", "item_meshes/npcs/purple_hexer", "icons/npcs/seedy_muckling", "icons/npcs/brown_hexer", "icons/npcs/purple_hexer", "audio/npc-muckling-on-attack-1", "audio/npc-muckling-on-hit-1", "audio/npc-muckling-on-death-1", "audio/npc-mucker-on-attack-1"]) {
  check(`asset_versions contains ${asset}`, Boolean(assetVersions[asset]));
}
for (const rel of ["public/assets/harthmere/glb/characters/adventurers/Mage.glb", "public/assets/harthmere/glb/characters/adventurers/Knight.glb", "public/assets/harthmere/glb/characters/adventurers/Ranger.glb", "public/assets/harthmere/glb/characters/animations/Rig_Medium_General.glb", "public/assets/harthmere/glb/characters/animations/Rig_Medium_MovementBasic.glb", "public/assets/harthmere/glb/equipment/weapons/sword_1handed.gltf", "public/assets/harthmere/glb/equipment/magic/staff.gltf", "public/assets/harthmere/glb/equipment/ranged/bow.gltf"]) {
  check(`Harthmere runtime asset exists: ${rel}`, exists(rel));
}
for (const animal of ["animal_chicken", "animal_bunny", "animal_pigeon", "animal_cat"]) {
  check(`runtime placements include ${animal}`, runtimeAssets.includes(`A("${animal}"`) || runtimeAssets.includes(`A('${animal}'`));
  check(`procedural animal renderer handles ${animal}`, runtimeAssets.includes(`placement.asset === "${animal}"`) || runtimeAssets.includes(`placement.asset === '${animal}'`));
}
check("procedural animals use concrete geometry", /new THREE\.BoxGeometry/.test(runtimeAssets));
check("procedural animals are added to scene", /createProceduralAnimal\(placement\)[\s\S]{0,320}addToScenes\(scenes, procedural/.test(runtimeAssets));
if (!ok) { console.error("\nRESULT: FAIL"); process.exit(1); }
console.log("\nRESULT: PASS");
