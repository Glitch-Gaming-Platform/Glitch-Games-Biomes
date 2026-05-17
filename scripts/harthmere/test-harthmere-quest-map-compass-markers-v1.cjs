#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere quest map/compass marker tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("HarthmereQuestMarkerType", source.includes("HarthmereQuestMarkerType") || hud.includes("HarthmereQuestMarkerType"));
check("exact_location", source.includes("exact_location") || hud.includes("exact_location"));
check("search_area", source.includes("search_area") || hud.includes("search_area"));
check("route", source.includes("route") || hud.includes("route"));
check("turn_in", source.includes("turn_in") || hud.includes("turn_in"));
check("compassLabel", source.includes("compassLabel") || hud.includes("compassLabel"));
check("heightHint", source.includes("heightHint") || hud.includes("heightHint"));
check("radiusMeters", source.includes("radiusMeters") || hud.includes("radiusMeters"));
finish();
