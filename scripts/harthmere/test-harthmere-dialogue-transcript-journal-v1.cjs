#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere dialogue transcript/journal tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("transcript", source.includes("transcript") || hud.includes("transcript"));
check("journalSummaries", source.includes("journalSummaries") || hud.includes("journalSummaries"));
check("skipHarthmereDialogueToJournalSummary", source.includes("skipHarthmereDialogueToJournalSummary") || hud.includes("skipHarthmereDialogueToJournalSummary"));
check("journalSummary", source.includes("journalSummary") || hud.includes("journalSummary"));
check("chooseHarthmereGreetingVariation", source.includes("chooseHarthmereGreetingVariation") || hud.includes("chooseHarthmereGreetingVariation"));
check("recentGreetings", source.includes("recentGreetings") || hud.includes("recentGreetings"));
check("no repeated", source.includes("no repeated") || hud.includes("no repeated"));
finish();
