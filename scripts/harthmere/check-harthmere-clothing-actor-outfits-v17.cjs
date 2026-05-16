#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const faces = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const player = path.join(root, "src/client/game/resources/player_mesh.ts");
const npcs = path.join(root, "src/client/game/resources/npcs.ts");
const manifest = path.join(root, "src/shared/harthmere/harthmere_clothing_asset_manifest.ts");

const facesText = fs.readFileSync(faces, "utf8");
const playerText = fs.existsSync(player) ? fs.readFileSync(player, "utf8") : "";
const npcsText = fs.existsSync(npcs) ? fs.readFileSync(npcs, "utf8") : "";
const manifestText = fs.existsSync(manifest) ? fs.readFileSync(manifest, "utf8") : "";

let ok = true;

function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check("v17 marker exists", facesText.includes("HARTHMERE_CLOTHING_ACTOR_OUTFITS_V17"));
check("v17 merge helper exists", facesText.includes("mergeHarthmereLicensedClothingDefaultsV17"));
check("v17 wrapper is active", facesText.includes("return mergeHarthmereLicensedClothingDefaultsV17(role as any, species as any, body as any, baseClothing);"));
check("v16 wrapper no longer active", !facesText.includes("return mergeHarthmereLicensedClothingDefaultsV16(role as any, baseClothing);"));
check("getById imported", facesText.includes("getHarthmereLicensedClothingById"));
check("female peasant outfit defined", facesText.includes("HARTHMERE_QUATERNIUS_FEMALE_PEASANT_OUTFIT_V17"));
check("male peasant outfit defined", facesText.includes("HARTHMERE_QUATERNIUS_MALE_PEASANT_OUTFIT_V17"));
check("female ranger outfit defined", facesText.includes("HARTHMERE_QUATERNIUS_FEMALE_RANGER_OUTFIT_V17"));
check("male ranger outfit defined", facesText.includes("HARTHMERE_QUATERNIUS_MALE_RANGER_OUTFIT_V17"));
check("outfit metadata written", facesText.includes("outfitSelectorVersion: 17") && facesText.includes("outfitFamily"));
check("only Quaternius auto-enabled", facesText.includes('source.licenseId !== "quaternius_fantasy_standard"'));
check("player loader reads modelUrl", playerText.includes("item.modelUrl") && playerText.includes("loadGltf(item.modelUrl)"));
check("npc clothing helper exists", /clothing/i.test(npcsText) && /appearance\.clothing|clothing/.test(npcsText));
check("manifest has Quaternius ids", manifestText.includes("licensed.quaternius.male_peasant_body") && manifestText.includes("licensed.quaternius.male_ranger_body"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
