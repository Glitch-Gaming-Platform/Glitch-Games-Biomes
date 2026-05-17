#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere crime evidence memory tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("HARTHMERE_CRIME_EVIDENCE_MEMORY", source.includes("HARTHMERE_CRIME_EVIDENCE_MEMORY") || hud.includes("HARTHMERE_CRIME_EVIDENCE_MEMORY"));
check("evidenceHours", source.includes("evidenceHours") || hud.includes("evidenceHours"));
check("rumorMultiplier", source.includes("rumorMultiplier") || hud.includes("rumorMultiplier"));
check("evidenceExpiresAt", source.includes("evidenceExpiresAt") || hud.includes("evidenceExpiresAt"));
check("victimId", source.includes("victimId") || hud.includes("victimId"));
check("itemIds", source.includes("itemIds") || hud.includes("itemIds"));
check("crimeId", source.includes("crimeId") || hud.includes("crimeId"));
finish();
