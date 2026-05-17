#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereInventoryGuidance.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere safe-to-sell UI tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereSafeToSellState", source.includes("getHarthmereSafeToSellState") || hud.includes("getHarthmereSafeToSellState"));
check("Safe to sell", source.includes("Safe to sell") || hud.includes("Safe to sell"));
check("Do not sell", source.includes("Do not sell") || hud.includes("Do not sell"));
check("quest item", source.includes("quest item") || hud.includes("quest item"));
check("locked", source.includes("locked") || hud.includes("locked"));
check("bound", source.includes("bound") || hud.includes("bound"));
check("has use effect", source.includes("has use effect") || hud.includes("has use effect"));
check("equipment candidate", source.includes("equipment candidate") || hud.includes("equipment candidate"));
finish();
