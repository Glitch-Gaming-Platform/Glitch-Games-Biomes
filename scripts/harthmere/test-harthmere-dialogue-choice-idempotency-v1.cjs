#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere dialogue choice idempotency tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("processedChoiceRequestIds", source.includes("processedChoiceRequestIds") || hud.includes("processedChoiceRequestIds"));
check("processHarthmereDialogueChoice", source.includes("processHarthmereDialogueChoice") || hud.includes("processHarthmereDialogueChoice"));
check("duplicate: true", source.includes("duplicate: true") || hud.includes("duplicate: true"));
check("choiceId", source.includes("choiceId") || hud.includes("choiceId"));
check("idempotency", source.includes("idempotency") || hud.includes("idempotency"));
check("completed", source.includes("completed") || hud.includes("completed"));
finish();
