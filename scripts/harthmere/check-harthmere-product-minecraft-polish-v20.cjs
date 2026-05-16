#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");

const faces = fs.readFileSync(facesPath, "utf8");
const npcs = fs.readFileSync(npcsPath, "utf8");
const assets = fs.readFileSync(assetsPath, "utf8");
const player = fs.readFileSync(playerPath, "utf8");

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check("shared product polish version exists", faces.includes("HARTHMERE_PRODUCT_MINECRAFT_POLISH_VERSION"));
check("shared catalog bumped to v20", faces.includes("harthmere-threejs-clothing-catalog-v20-product-minecraft-polish"));
check("shared complete clothing guarantee exists", faces.includes("function harthmereEnsureProductMinecraftClothingSetV20"));
check("appearance config uses complete clothing guarantee", faces.includes("clothing: harthmereEnsureProductMinecraftClothingSetV20("));
check("catalog has blacksmith apron", faces.includes("blacksmith_apron"));
check("catalog has fur cloak", faces.includes("fur_cloak"));
check("catalog has tool hammer", faces.includes("tool_hammer"));
check("NPC product polish version exists", npcs.includes("HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION_V20"));
check("NPC renderer bumped to v20", npcs.includes("harthmere-threejs-clothing-v20-product-minecraft-polish"));
check("NPC renderer has armor pauldrons", npcs.includes("harthmere-npc-armor-left-pauldron-v20"));
check("NPC renderer has robe sash", npcs.includes("harthmere-npc-robe-sash-v20"));
check("NPC renderer has merchant lapels", npcs.includes("harthmere-npc-merchant-left-lapel-v20"));
check("NPC renderer has belt pouches", npcs.includes("harthmere-npc-belt-left-pouch-v20"));
check("NPC renderer has weapon variants", npcs.includes("harthmere-npc-bow-v20") && npcs.includes("harthmere-npc-tool-handle-v20"));
check("runtime product polish version exists", assets.includes("HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION_V20"));
check("runtime product polish helper exists", assets.includes("addHarthmereRuntimeProductMinecraftClothingPolishV20"));
check("runtime calls product polish helper", assets.includes("addHarthmereRuntimeProductMinecraftClothingPolishV20(root, appearance, body, palette, torsoY, shoulderY, headY);"));
check("runtime has polish overlays", assets.includes("townsperson-product-torso-front-v20") && assets.includes("townsperson-product-belt-pouch-left-v20"));
check("player v16 polish kept", player.includes("harthmere-threejs-clothing-v16-polished-catalog-body-fit") || player.includes("harthmere-threejs-clothing-v20-product-minecraft-polish"));
check("GLTF support kept", player.includes("loadGltf") && faces.includes("modelUrl"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
