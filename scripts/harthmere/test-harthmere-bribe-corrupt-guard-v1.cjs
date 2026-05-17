#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere bribe/corrupt guard tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("offerHarthmereBribe", source.includes("offerHarthmereBribe") || hud.includes("offerHarthmereBribe"));
check("guardCorruption", source.includes("guardCorruption") || hud.includes("guardCorruption"));
check("honest_guard_reports_bribe", source.includes("honest_guard_reports_bribe") || hud.includes("honest_guard_reports_bribe"));
check("bribe_too_low", source.includes("bribe_too_low") || hud.includes("bribe_too_low"));
check("legalPenalty", source.includes("legalPenalty") || hud.includes("legalPenalty"));
check("bribery", source.includes("bribery") || hud.includes("bribery"));
finish();
