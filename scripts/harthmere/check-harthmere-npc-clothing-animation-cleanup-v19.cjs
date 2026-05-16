#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");

const faces = fs.readFileSync(facesPath, "utf8");
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

check("unique NPC clothing version exists", faces.includes("HARTHMERE_NPC_UNIQUE_CLOTHING_VERSION"));
check("unique NPC clothing builder exists", faces.includes("makeHarthmereNpcUniqueClothingSet"));
check("generated NPC appearance uses unique clothing", faces.includes("clothing:") && faces.includes("makeHarthmereNpcUniqueClothingSet({"));
check("unique clothing uses deterministic seed", faces.includes("harthmereUniqueNpcClothingSeed"));
check("unique clothing covers guard", faces.includes('input.role === "guard"') && faces.includes("guard_scale_vest"));
check("unique clothing covers hunter", faces.includes('input.role === "hunter"') && faces.includes("quiver_and_bedroll"));
check("unique clothing covers farmer", faces.includes('input.role === "farmer"') && faces.includes("work_apron"));
check("unique clothing covers merchant", faces.includes('input.role === "merchant"') && faces.includes("merchant_coat"));
check("unique clothing covers clergy", faces.includes('input.role === "clergy"') && faces.includes("clergy_robe"));
check("unique clothing covers bandit hostile", faces.includes('input.role === "bandit" || input.role === "hostile"') && faces.includes("bandit_mask"));
check("unique clothing covers undead", faces.includes('input.role === "undead"') && faces.includes("ragged_shroud"));
check("stale v16 base role helper removed", !faces.includes("defaultHarthmereClothingForRoleBaseV16"));
check("stale v17 merge helper removed", !faces.includes("mergeHarthmereLicensedClothingDefaultsV17"));
check("stale v16 merge helper removed", !faces.includes("mergeHarthmereLicensedClothingDefaultsV16"));

check("NPC walk/run animation version exists", npcs.includes("HARTHMERE_NPC_WALK_RUN_ANIMATION_VERSION"));
check("local dev NPC creates animation clips", npcs.includes("makeLocalDevVoxelNpcAnimationClipsV19"));
check("local dev NPC has Walk clip", npcs.includes('new THREE.AnimationClip("Walk"'));
check("local dev NPC has Run clip", npcs.includes('new THREE.AnimationClip("Run"'));
check("local dev NPC has Idle clip", npcs.includes('new THREE.AnimationClip("Idle"'));
check("local dev NPC returns clips", npcs.includes("animations,"));
check("mixed NPC records animation load check", npcs.includes("recordHarthmereNpcAnimationLoadCheckV19(three"));
check("NPC tick records animation execution check", npcs.includes("recordHarthmereNpcAnimationExecutionCheckV19("));
check("execution check has selected state", npcs.includes('selected: running ? "run" : moving ? "walk" : "idle"'));
check("runtime walker check version exists", assets.includes("HARTHMERE_RUNTIME_WALK_ANIMATION_CHECK_VERSION"));
check("runtime walker records execution", assets.includes("harthmereRuntimeWalkAnimationCheck"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
