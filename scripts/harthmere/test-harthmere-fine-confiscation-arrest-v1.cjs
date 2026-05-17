#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere fine/confiscation/arrest tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("calculateHarthmereFineGold", source.includes("calculateHarthmereFineGold") || hud.includes("calculateHarthmereFineGold"));
check("confiscatedItemIds", source.includes("confiscatedItemIds") || hud.includes("confiscatedItemIds"));
check("fineGold", source.includes("fineGold") || hud.includes("fineGold"));
check("arrest_attempt", source.includes("arrest_attempt") || hud.includes("arrest_attempt"));
check("community_service", source.includes("community_service") || hud.includes("community_service"));
check("jail", source.includes("jail") || hud.includes("jail"));
check("createHarthmereCourtTrial", source.includes("createHarthmereCourtTrial") || hud.includes("createHarthmereCourtTrial"));
finish();
