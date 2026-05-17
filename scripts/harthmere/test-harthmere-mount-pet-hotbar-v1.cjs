#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere mount/pet hotbar tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("mountHotbarSlot", source.includes("mountHotbarSlot") || hud.includes("mountHotbarSlot"));
check("petHotbarSlot", source.includes("petHotbarSlot") || hud.includes("petHotbarSlot"));
check("slotHarthmereMountHotbar", source.includes("slotHarthmereMountHotbar") || hud.includes("slotHarthmereMountHotbar"));
check("slotHarthmerePetHotbar", source.includes("slotHarthmerePetHotbar") || hud.includes("slotHarthmerePetHotbar"));
check("useHarthmereMountFromHotbar", source.includes("useHarthmereMountFromHotbar") || hud.includes("useHarthmereMountFromHotbar"));
check("useHarthmerePetFromHotbar", source.includes("useHarthmerePetFromHotbar") || hud.includes("useHarthmerePetFromHotbar"));
check("missing_hotbar_mount", source.includes("missing_hotbar_mount") || hud.includes("missing_hotbar_mount"));
check("missing_hotbar_pet", source.includes("missing_hotbar_pet") || hud.includes("missing_hotbar_pet"));
finish();
