#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");

const npcs = fs.readFileSync(npcsPath, "utf8");
const assets = fs.readFileSync(assetsPath, "utf8");

let ok = true;

function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check("NPC v23 marker exists", npcs.includes("HARTHMERE_NPC_OUTWARD_CLOTHING_DETAIL_LAYER_V23"));
check("NPC v23 helper exists", npcs.includes("addLocalDevNpcOutwardClothingDetailLayerV23"));
check("NPC v23 helper is called", npcs.includes("addLocalDevNpcOutwardClothingDetailLayerV23(root, clothing, palette, body)"));
check("NPC v23 outward torso detail exists", npcs.includes("outward-clothing-front-panel-v23") && npcs.includes("outward-clothing-back-panel-v23"));
check("NPC v23 outward legs/feet/belt exist", npcs.includes("outward-clothing-left-pant-front-v23") && npcs.includes("outward-clothing-left-boot-v23") && npcs.includes("outward-clothing-belt-v23"));
check("NPC v23 role details exist", npcs.includes("outward-guard-left-pauldron-v23") && npcs.includes("outward-worker-apron-v23") && npcs.includes("outward-merchant-left-lapel-v23"));
check("NPC v23 deterministic variation exists", npcs.includes("hashHarthmereNpcClothingSignatureV23") && npcs.includes("harthmereNpcOutwardClothingDetailVariant"));

check("runtime v23 marker exists", assets.includes("HARTHMERE_RUNTIME_OUTWARD_CLOTHING_DETAIL_LAYER_V23"));
check("runtime v23 helper exists", assets.includes("addHarthmereRuntimeOutwardClothingDetailLayerV23"));
check("runtime v23 helper is called", assets.includes("addHarthmereRuntimeOutwardClothingDetailLayerV23(root, appearance.clothing as any, body, palette)"));
check("runtime v23 outward torso detail exists", assets.includes("runtime-outward-clothing-front-panel-v23") && assets.includes("runtime-outward-clothing-back-panel-v23"));
check("runtime v23 role details exist", assets.includes("runtime-outward-guard-left-pauldron-v23") && assets.includes("runtime-outward-worker-apron-v23") && assets.includes("runtime-outward-merchant-left-lapel-v23"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
