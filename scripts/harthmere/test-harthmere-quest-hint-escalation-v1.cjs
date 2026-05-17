#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere quest hint escalation tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereQuestHintEscalation", source.includes("getHarthmereQuestHintEscalation") || hud.includes("getHarthmereQuestHintEscalation"));
check("2 * 60_000", source.includes("2 * 60_000") || hud.includes("2 * 60_000"));
check("5 * 60_000", source.includes("5 * 60_000") || hud.includes("5 * 60_000"));
check("10 * 60_000", source.includes("10 * 60_000") || hud.includes("10 * 60_000"));
check("subtle", source.includes("subtle") || hud.includes("subtle"));
check("clear", source.includes("clear") || hud.includes("clear"));
check("exact", source.includes("exact") || hud.includes("exact"));
check("recovery", source.includes("recovery") || hud.includes("recovery"));
finish();
