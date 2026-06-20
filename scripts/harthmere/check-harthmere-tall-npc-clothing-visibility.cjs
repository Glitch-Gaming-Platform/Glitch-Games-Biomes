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

check("current NPC visibility marker exists", npcs.includes("HARTHMERE_TALL_NPC_CLOTHING_VISIBILITY"));
check("current NPC visibility helper exists", npcs.includes("addLocalDevNpcVisibleClothingGuarantee"));
check("current NPC visibility helper is called", npcs.includes("addLocalDevNpcVisibleClothingGuarantee(root, clothing, palette, body)"));
check("current NPC torso wraps front/back/sides", npcs.includes("torso-front") && npcs.includes("torso-back") && npcs.includes("torso-left") && npcs.includes("torso-right"));
check("current NPC legs and feet are guaranteed", npcs.includes("left-leg") && npcs.includes("right-leg") && npcs.includes("left-foot") && npcs.includes("right-foot"));
check("current NPC belt is guaranteed", npcs.includes("visible-clothing-belt") && npcs.includes("visible-clothing-buckle"));
check("current NPC stores debug metadata", npcs.includes("harthmereTallNpcClothingVisibilityBody"));

check("current runtime visibility marker exists", assets.includes("HARTHMERE_RUNTIME_TALL_NPC_CLOTHING_VISIBILITY"));
check("current runtime visibility helper exists", assets.includes("addHarthmereRuntimeVisibleClothingGuarantee"));
check("current runtime visibility helper is called", assets.includes("addHarthmereRuntimeVisibleClothingGuarantee(root, appearance.clothing as any, body, palette)"));
check("current runtime torso wraps front/back/sides", assets.includes("runtime-visible-clothing-torso-front") && assets.includes("runtime-visible-clothing-torso-back") && assets.includes("runtime-visible-clothing-torso-left") && assets.includes("runtime-visible-clothing-torso-right"));
check("current runtime stores debug metadata", assets.includes("harthmereRuntimeTallNpcClothingVisibilityBody"));

check("current complete clothing guarantee still exists", faces.includes("harthmereEnsureProductMinecraftClothingSet"));
check("current NPC clothing/animation test still exists", fs.existsSync(path.join(root, "scripts/harthmere/test-harthmere-npc-clothing-animation.cjs")));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
