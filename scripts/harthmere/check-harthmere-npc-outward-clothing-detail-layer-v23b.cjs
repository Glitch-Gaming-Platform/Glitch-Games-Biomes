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

check("v23 rotation wrapper exists", npcs.includes("function localDevVoxelBoxWithRotationV23("));
check("hunter diagonal strap uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-hunter-diagonal-strap-v23"'));
check("worker tool uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-worker-tool-v23"'));
check("merchant lapels use rotation wrapper", npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-merchant-left-lapel-v23"') && npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-merchant-right-lapel-v23"'));
check("bandit sash uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-bandit-torn-sash-v23"'));
check("undead bandages use rotation wrapper", npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-undead-bandage-a-v23"') && npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-undead-bandage-b-v23"'));
check("civilian sash uses rotation wrapper", npcs.includes('localDevVoxelBoxWithRotationV23("harthmere-npc-outward-civilian-sash-v23"'));
check("v23 outward layer still active", npcs.includes("HARTHMERE_NPC_OUTWARD_CLOTHING_DETAIL_LAYER_V23"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
