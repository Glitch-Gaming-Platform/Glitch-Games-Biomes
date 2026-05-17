#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere quest analytics/debug tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereQuestAnalyticsDebug", source.includes("getHarthmereQuestAnalyticsDebug") || hud.includes("getHarthmereQuestAnalyticsDebug"));
check("hasRewardPreview", source.includes("hasRewardPreview") || hud.includes("hasRewardPreview"));
check("hasGuidance", source.includes("hasGuidance") || hud.includes("hasGuidance"));
check("markerType", source.includes("markerType") || hud.includes("markerType"));
check("failureConditions", source.includes("failureConditions") || hud.includes("failureConditions"));
check("blockedReason", source.includes("blockedReason") || hud.includes("blockedReason"));
finish();
