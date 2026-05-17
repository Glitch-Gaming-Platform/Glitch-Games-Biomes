#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere nearby quest helper tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getNearbyHarthmereQuestHelper", source.includes("getNearbyHarthmereQuestHelper") || hud.includes("getNearbyHarthmereQuestHelper"));
check("distanceMeters", source.includes("distanceMeters") || hud.includes("distanceMeters"));
check("maxDistance", source.includes("maxDistance") || hud.includes("maxDistance"));
check("sort", source.includes("sort") || hud.includes("sort"));
check("slice(0, 5)", source.includes("slice(0, 5)") || hud.includes("slice(0, 5)"));
check("Nearby", source.includes("Nearby") || hud.includes("Nearby"));
finish();
