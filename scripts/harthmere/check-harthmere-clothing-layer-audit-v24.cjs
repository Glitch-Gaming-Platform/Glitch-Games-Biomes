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

check("NPC v24 audit marker exists", npcs.includes("HARTHMERE_NPC_CLOTHING_LAYER_AUDIT_V24"));
check("NPC v24 audit helper exists", npcs.includes("auditLocalDevNpcClothingLayersV24"));
check("NPC v24 audit helper is called", npcs.includes("auditLocalDevNpcClothingLayersV24(root)"));
check("NPC v24 audit counts shells", npcs.includes("shellCount") && npcs.includes("visible-clothing-.*-v22"));
check("NPC v24 audit counts details", npcs.includes("detailCount") && npcs.includes("outward-.*-v23"));
check("NPC v24 audit stores likely problem", npcs.includes("likelyProblem"));
check("NPC v24 audit stores debug userData", npcs.includes("harthmereNpcClothingLayerAuditV24"));

check("runtime v24 audit marker exists", assets.includes("HARTHMERE_RUNTIME_CLOTHING_LAYER_AUDIT_V24"));
check("runtime v24 audit helper exists", assets.includes("auditHarthmereRuntimeClothingLayersV24"));
check("runtime v24 audit helper is called", assets.includes("auditHarthmereRuntimeClothingLayersV24(root)"));
check("runtime v24 audit counts shells", assets.includes("shellCount") && assets.includes("runtime-visible-clothing-.*-v22"));
check("runtime v24 audit counts details", assets.includes("detailCount") && assets.includes("runtime-outward-.*-v23"));
check("runtime v24 audit stores debug userData", assets.includes("harthmereRuntimeClothingLayerAuditV24"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
