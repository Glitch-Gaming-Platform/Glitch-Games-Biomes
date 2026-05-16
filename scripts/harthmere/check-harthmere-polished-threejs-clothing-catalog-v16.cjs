#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");

function check(name, ok) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${name}`);
  }
}

const faces = fs.readFileSync(facesPath, "utf8");
const player = fs.readFileSync(playerPath, "utf8");

check("catalog version exists", /HARTHMERE_THREEJS_CLOTHING_CATALOG_VERSION/.test(faces));
check("catalog export exists", /HARTHMERE_THREEJS_CLOTHING_CATALOG:\s*Record<string, HarthmereClothingItem>/.test(faces));
check("catalog helper exists", /function harthmereThreeJsClothingItem/.test(faces));
check("catalog by slot helper exists", /function harthmereClothingCatalogForSlot/.test(faces));
check("catalog has guard armor", /guard_tabard_armor/.test(faces) && /guard_scale_vest/.test(faces));
check("catalog has civilian palette tunics", /earth_tunic/.test(faces) && /royal_tunic/.test(faces) && /ash_tunic/.test(faces));
check("catalog has multiple torso variants", /merchant_coat/.test(faces) && /noble_doublet/.test(faces) && /mage_wraps/.test(faces));
check("catalog has legs feet hands belt head face back weapon shield", /guard_greaves/.test(faces) && /travel_boots/.test(faces) && /guard_gloves/.test(faces) && /ledger_belt/.test(faces) && /guard_helmet/.test(faces) && /bandit_mask/.test(faces) && /quiver_and_bedroll/.test(faces) && /sword_1handed/.test(faces) && /shield_round/.test(faces));
check("defaults use catalog helper", /harthmereThreeJsClothingItem\(`\$\{basePalette\}_tunic`\)/.test(faces));
check("guard defaults use polished catalog", /guard_scale_vest/.test(faces) && /harthmereThreeJsClothingItem\("guard_greaves"\)/.test(faces));
check("farmer merchant clergy bandit undead defaults use catalog", /harthmereThreeJsClothingItem\("work_apron"\)/.test(faces) && /harthmereThreeJsClothingItem\("merchant_coat"\)/.test(faces) && /harthmereThreeJsClothingItem\("clergy_robe"\)/.test(faces) && /harthmereThreeJsClothingItem\("bandit_mask"\)/.test(faces) && /harthmereThreeJsClothingItem\("torn_tunic"\)/.test(faces));
check("player runtime bumped to v16", /harthmere-modular-clothing-runtime-v16-polished-threejs-catalog/.test(player));
check("player renderer has v16 body fit marker", /harthmere-threejs-clothing-v16-polished-catalog-body-fit/.test(player));
check("player renderer reads threeJsVariant", /const variant = item\.threeJsVariant \?\? item\.id/.test(player));
check("player renderer has armor details", /left-pauldron/.test(player) && /chest-emblem/.test(player) && /scale-row/.test(player));
check("player renderer has robe and mage details", /robe-sash/.test(player) && /robe-center-fold/.test(player));
check("player renderer has merchant details", /left-lapel/.test(player) && /coat-button-top/.test(player));
check("player renderer has polished legs feet hands", /left-knee-detail/.test(player) && /left-toe/.test(player) && /right-bracer/.test(player));
check("player renderer has belt/back/weapon/shield detail", /ledger/.test(player) && /satchel-flap/.test(player) && /bow-string/.test(player) && /shield-rim-top/.test(player));
check("GLB clothing remains supported", /loadHarthmerePlayerClothingModel/.test(player) && /renderMode !== "threejs"/.test(player));

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
