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

check("NPC current audit marker exists", npcs.includes("HARTHMERE_NPC_CLOTHING_LAYER_AUDIT"));
check("NPC current audit helper exists", npcs.includes("auditLocalDevNpcClothingLayers"));
check("NPC current audit helper is called", npcs.includes("auditLocalDevNpcClothingLayers(root)"));
check("NPC current audit counts shells", npcs.includes("shellCount") && npcs.includes("visible-clothing-"));
check("NPC current audit counts details", npcs.includes("detailCount") && npcs.includes("outward-"));
check("NPC current audit stores likely problem", npcs.includes("likelyProblem"));
check("NPC current audit stores debug userData", npcs.includes("harthmereNpcClothingLayerAudit"));

check("runtime current audit marker exists", assets.includes("HARTHMERE_RUNTIME_CLOTHING_LAYER_AUDIT"));
check("runtime current audit helper exists", assets.includes("auditHarthmereRuntimeClothingLayers"));
check("runtime current audit helper is called", assets.includes("auditHarthmereRuntimeClothingLayers(root)"));
check("runtime current audit counts shells", assets.includes("shellCount") && assets.includes("runtime-visible-clothing-"));
check("runtime current audit counts details", assets.includes("detailCount") && assets.includes("runtime-outward-"));
check("runtime current audit stores debug userData", assets.includes("harthmereRuntimeClothingLayerAudit"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
