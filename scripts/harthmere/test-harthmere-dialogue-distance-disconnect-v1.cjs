#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere dialogue distance/disconnect tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("checkHarthmereDialogueDistance", source.includes("checkHarthmereDialogueDistance") || hud.includes("checkHarthmereDialogueDistance"));
check("maxDistanceMeters", source.includes("maxDistanceMeters") || hud.includes("maxDistanceMeters"));
check("Math.hypot", source.includes("Math.hypot") || hud.includes("Math.hypot"));
check("disconnect", source.includes("disconnect") || hud.includes("disconnect"));
check("distance", source.includes("distance") || hud.includes("distance"));
check("lastPlayerPosition", source.includes("lastPlayerPosition") || hud.includes("lastPlayerPosition"));
finish();
