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
  "NPC v20 product polish const is declared",
  /\bconst\s+HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION_V20\b/.test(npcs)
);

check(
  "NPC v20 product polish const is used",
  npcs.includes("harthmereProductMinecraftPolish = HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION_V20")
);

check(
  "NPC renderer still bumped to v20",
  npcs.includes("harthmere-modular-clothing-runtime-v20-product-minecraft-polish")
);

check(
  "runtime v20 product polish still exists",
  assets.includes("HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION_V20")
);

check(
  "shared v20 clothing guarantee still exists",
  faces.includes("harthmereEnsureProductMinecraftClothingSetV20")
);

check(
  "shared v20 catalog still exists",
  faces.includes("harthmere-threejs-clothing-catalog-v20-product-minecraft-polish")
);

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
