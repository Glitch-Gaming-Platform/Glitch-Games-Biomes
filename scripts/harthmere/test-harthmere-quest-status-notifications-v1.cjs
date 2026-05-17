#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere quest status notification tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereQuestStatusNotification", source.includes("getHarthmereQuestStatusNotification") || hud.includes("getHarthmereQuestStatusNotification"));
check("Quest blocked", source.includes("Quest blocked") || hud.includes("Quest blocked"));
check("Ready to turn in", source.includes("Ready to turn in") || hud.includes("Ready to turn in"));
check("Quest failed", source.includes("Quest failed") || hud.includes("Quest failed"));
check("progressText", source.includes("progressText") || hud.includes("progressText"));
check("blockedReason", source.includes("blockedReason") || hud.includes("blockedReason"));
finish();
