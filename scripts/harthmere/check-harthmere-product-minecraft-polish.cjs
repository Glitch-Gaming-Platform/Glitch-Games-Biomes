#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");

const npcs = fs.readFileSync(npcsPath, "utf8");
const assets = fs.readFileSync(assetsPath, "utf8");
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

check(
  "NPC current product polish const is declared",
  /\bconst\s+HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION\b/.test(npcs)
);

check(
  "NPC current product polish const is used",
  npcs.includes("harthmereProductMinecraftPolish = HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION")
);

check(
  "NPC renderer still bumped to current",
  npcs.includes("harthmere-modular-clothing-runtime-product-minecraft-polish")
);

check(
  "runtime current product polish still exists",
  assets.includes("HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION")
);

check(
  "shared current clothing guarantee still exists",
  faces.includes("harthmereEnsureProductMinecraftClothingSet")
);

check(
  "shared current catalog still exists",
  faces.includes("harthmere-threejs-clothing-catalog-product-minecraft-polish")
);

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
