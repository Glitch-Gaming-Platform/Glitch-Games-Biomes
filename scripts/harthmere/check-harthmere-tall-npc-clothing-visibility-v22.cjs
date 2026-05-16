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

check("v22 NPC visibility marker exists", npcs.includes("HARTHMERE_TALL_NPC_CLOTHING_VISIBILITY_V22"));
check("v22 NPC visibility helper exists", npcs.includes("addLocalDevNpcVisibleClothingGuaranteeV22"));
check("v22 NPC visibility helper is called", npcs.includes("addLocalDevNpcVisibleClothingGuaranteeV22(root, clothing, palette, body)"));
check("v22 NPC torso wraps front/back/sides", npcs.includes("torso-front-v22") && npcs.includes("torso-back-v22") && npcs.includes("torso-left-v22") && npcs.includes("torso-right-v22"));
check("v22 NPC legs and feet are guaranteed", npcs.includes("left-leg-v22") && npcs.includes("right-leg-v22") && npcs.includes("left-foot-v22") && npcs.includes("right-foot-v22"));
check("v22 NPC belt is guaranteed", npcs.includes("visible-clothing-belt-v22") && npcs.includes("visible-clothing-buckle-v22"));
check("v22 NPC stores debug metadata", npcs.includes("harthmereTallNpcClothingVisibilityBody"));

check("v22 runtime visibility marker exists", assets.includes("HARTHMERE_RUNTIME_TALL_NPC_CLOTHING_VISIBILITY_V22"));
check("v22 runtime visibility helper exists", assets.includes("addHarthmereRuntimeVisibleClothingGuaranteeV22"));
check("v22 runtime visibility helper is called", assets.includes("addHarthmereRuntimeVisibleClothingGuaranteeV22(root, appearance.clothing as any, body, palette)"));
check("v22 runtime torso wraps front/back/sides", assets.includes("runtime-visible-clothing-torso-front-v22") && assets.includes("runtime-visible-clothing-torso-back-v22") && assets.includes("runtime-visible-clothing-torso-left-v22") && assets.includes("runtime-visible-clothing-torso-right-v22"));
check("v22 runtime stores debug metadata", assets.includes("harthmereRuntimeTallNpcClothingVisibilityBody"));

check("v20 complete clothing guarantee still exists", faces.includes("harthmereEnsureProductMinecraftClothingSetV20"));
check("v21 NPC clothing/animation test still exists", fs.existsSync(path.join(root, "scripts/harthmere/test-harthmere-npc-clothing-animation-v21.cjs")));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
