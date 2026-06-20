#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereInventoryGuidance.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere durability warning UI tests current ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereDurabilityWarning", source.includes("getHarthmereDurabilityWarning") || hud.includes("getHarthmereDurabilityWarning"));
check("Broken: repair before using", source.includes("Broken: repair before using") || hud.includes("Broken: repair before using"));
check("Critical durability", source.includes("Critical durability") || hud.includes("Critical durability"));
check("Worn: reduced value", source.includes("Worn: reduced value") || hud.includes("Worn: reduced value"));
check("durabilityMax", source.includes("durabilityMax") || hud.includes("durabilityMax"));
check("durabilityWarning", source.includes("durabilityWarning") || hud.includes("durabilityWarning"));
finish();
