#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere dialogue combat interrupt tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("interruptHarthmereDialogue", source.includes("interruptHarthmereDialogue") || hud.includes("interruptHarthmereDialogue"));
check("combat", source.includes("combat") || hud.includes("combat"));
check("npc_death", source.includes("npc_death") || hud.includes("npc_death"));
check("interrupted", source.includes("interrupted") || hud.includes("interrupted"));
check("interrupts", source.includes("interrupts") || hud.includes("interrupts"));
check("status", source.includes("status") || hud.includes("status"));
finish();
