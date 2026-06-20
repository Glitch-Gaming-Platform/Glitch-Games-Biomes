#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere bounty/city lockdown tests current ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("bountyGold", source.includes("bountyGold") || hud.includes("bountyGold"));
check("getHarthmereOutlawEscalation", source.includes("getHarthmereOutlawEscalation") || hud.includes("getHarthmereOutlawEscalation"));
check("public_enemy", source.includes("public_enemy") || hud.includes("public_enemy"));
check("outlaw", source.includes("outlaw") || hud.includes("outlaw"));
check("cityLockdown", source.includes("cityLockdown") || hud.includes("cityLockdown"));
check("bountyHunters", source.includes("bountyHunters") || hud.includes("bountyHunters"));
check("activeBounties", source.includes("activeBounties") || hud.includes("activeBounties"));
finish();
