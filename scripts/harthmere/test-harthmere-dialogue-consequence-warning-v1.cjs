#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere dialogue consequence warning tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereDialogueConsequenceWarning", source.includes("getHarthmereDialogueConsequenceWarning") || hud.includes("getHarthmereDialogueConsequenceWarning"));
check("consequenceWarning", source.includes("consequenceWarning") || hud.includes("consequenceWarning"));
check("partyImpact", source.includes("partyImpact") || hud.includes("partyImpact"));
check("affect your party", source.includes("affect your party") || hud.includes("affect your party"));
check("quest phase", source.includes("quest phase") || hud.includes("quest phase"));
check("reputation", source.includes("reputation") || hud.includes("reputation"));
finish();
