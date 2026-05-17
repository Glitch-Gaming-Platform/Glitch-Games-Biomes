#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere server quest/dialogue authority tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("questProgress", source.includes("questProgress") || hud.includes("questProgress"));
check("dialogueChoice", source.includes("dialogueChoice") || hud.includes("dialogueChoice"));
check("validateHarthmereServerQuestDialogueAuthority", source.includes("validateHarthmereServerQuestDialogueAuthority") || hud.includes("validateHarthmereServerQuestDialogueAuthority"));
check("rewardClaimed", source.includes("rewardClaimed") || hud.includes("rewardClaimed"));
check("choiceRequirementsMet", source.includes("choiceRequirementsMet") || hud.includes("choiceRequirementsMet"));
check("serverRevalidationRequired", source.includes("serverRevalidationRequired") || hud.includes("serverRevalidationRequired"));
finish();
