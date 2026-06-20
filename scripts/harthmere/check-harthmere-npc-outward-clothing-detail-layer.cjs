#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const npcs = fs.readFileSync(npcsPath, "utf8");

let ok = true;

function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check("current rotation wrapper exists", npcs.includes("function localDevVoxelBoxWithRotation("));
check("hunter diagonal strap uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-hunter-diagonal-strap"'));
check("worker tool uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-worker-tool"'));
check("merchant lapels use rotation wrapper", npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-merchant-left-lapel"') && npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-merchant-right-lapel"'));
check("bandit sash uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-bandit-torn-sash"'));
check("undead bandages use rotation wrapper", npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-undead-bandage-a"') && npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-undead-bandage-b"'));
check("civilian sash uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotation("harthmere-npc-outward-civilian-sash"'));
check("current outward layer still active", npcs.includes("HARTHMERE_NPC_OUTWARD_CLOTHING_DETAIL_LAYER"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
