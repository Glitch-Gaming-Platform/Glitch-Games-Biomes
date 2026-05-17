#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue sheet edge-case rule tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const key of ["npcDiesDuringConversation", "playerAttackedDuringConversation", "playerWalksAway", "playerDisconnectsDuringChoice", "playerClicksChoiceTwice", "playerBecomesCriminalDuringVendor", "hostileNpcConversation", "requiredItemMissingAfterOpen", "reputationChangesMidDialogue", "partyLeaderMajorChoice", "skippedDialogueNeedsInfo"]) {
  check(`edge rule exists: ${key}`, src.includes(key));
}
check("interruption resolver returns npc dead", src.includes("npc_dead"));
check("interruption resolver returns combat interrupt", src.includes("combat_interrupt"));
check("interruption resolver returns distance timeout", src.includes("distance_timeout"));
check("hostile NPCs require negotiation support", src.includes("hostile_no_negotiation"));
finish();
