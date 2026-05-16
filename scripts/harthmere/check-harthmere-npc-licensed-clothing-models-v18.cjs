#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");

const npcs = fs.readFileSync(npcsPath, "utf8");
const assets = fs.readFileSync(assetsPath, "utf8");
const player = fs.readFileSync(playerPath, "utf8");
const faces = fs.readFileSync(facesPath, "utf8");

let ok = true;

function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check("player still loads clothing modelUrl", player.includes("loadGltf(item.modelUrl)"));
check("v17 outfit selector active", faces.includes("mergeHarthmereLicensedClothingDefaultsV17"));
check("NPC v18 marker exists", npcs.includes("HARTHMERE_NPC_LICENSED_CLOTHING_MODELS_V18"));
check("NPC queues licensed modelUrl clothing", npcs.includes("queueLocalDevNpcLicensedClothingModelV18(root, String(slot), item, body)"));
check("NPC uses loadGltf for clothing models", npcs.includes("loadGltf(modelUrl)"));
check("NPC keeps v14 proxy fallback", npcs.includes("harthmere-npc-clothing-torso-v14"));
check("NPC records loaded licensed clothing metadata", npcs.includes("harthmereNpcLicensedClothingModelsLoaded"));
check("runtime v18 marker exists", assets.includes("HARTHMERE_RUNTIME_LICENSED_CLOTHING_MODELS_V18"));
check("runtime imports/uses loadGltf", assets.includes("loadGltf(modelUrl)"));
check("runtime queues modelUrl clothing", assets.includes("queueHarthmereRuntimeLicensedClothingModelsV18(root, appearance.clothing as any, body)"));
check("runtime keeps v14 proxy fallback", assets.includes("townsperson-clothing-torso-v14"));
check("runtime records loaded licensed clothing metadata", assets.includes("harthmereRuntimeLicensedClothingModelsLoaded"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
