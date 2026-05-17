#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere theft/pickpocket/lockpick tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("performHarthmereTheftAction", source.includes("performHarthmereTheftAction") || hud.includes("performHarthmereTheftAction"));
check("performHarthmerePickpocketAction", source.includes("performHarthmerePickpocketAction") || hud.includes("performHarthmerePickpocketAction"));
check("performHarthmereLockpickAction", source.includes("performHarthmereLockpickAction") || hud.includes("performHarthmereLockpickAction"));
check("escalateHarthmereTrespass", source.includes("escalateHarthmereTrespass") || hud.includes("escalateHarthmereTrespass"));
check("theft", source.includes("theft") || hud.includes("theft"));
check("pickpocket", source.includes("pickpocket") || hud.includes("pickpocket"));
check("lockpicking", source.includes("lockpicking") || hud.includes("lockpicking"));
check("trespassing", source.includes("trespassing") || hud.includes("trespassing"));
finish();
