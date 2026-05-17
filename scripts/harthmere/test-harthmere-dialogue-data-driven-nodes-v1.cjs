#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere data-driven dialogue node tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const token of ["HarthmereDialogueNode", "nodeId", "npcId", "npcName", "npcRole", "text", "conditions", "choices", "journalSummary", "mapMarkerUpdates", "compassMarkerUpdates"]) {
  check(`dialogue node supports ${token}`, src.includes(token));
}
for (const token of ["choiceId", "requirements", "warnings", "successEffects", "failureEffects", "nextNodeSuccess", "nextNodeFailure"]) {
  check(`dialogue choice supports ${token}`, src.includes(token));
}
finish();
