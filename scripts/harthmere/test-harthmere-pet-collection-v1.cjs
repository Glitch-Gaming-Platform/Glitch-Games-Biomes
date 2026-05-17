#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere pet collection tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("learnedPets", source.includes("learnedPets") || hud.includes("learnedPets"));
check("HARTHMERE_PET_DEFINITIONS", source.includes("HARTHMERE_PET_DEFINITIONS") || hud.includes("HARTHMERE_PET_DEFINITIONS"));
check("learnHarthmerePet", source.includes("learnHarthmerePet") || hud.includes("learnHarthmerePet"));
check("petAbilitySlots", source.includes("petAbilitySlots") || hud.includes("petAbilitySlots"));
check("HARTHMERE_PET_ABILITY_DEFINITIONS", source.includes("HARTHMERE_PET_ABILITY_DEFINITIONS") || hud.includes("HARTHMERE_PET_ABILITY_DEFINITIONS"));
check("assignHarthmerePetAbilitySlot", source.includes("assignHarthmerePetAbilitySlot") || hud.includes("assignHarthmerePetAbilitySlot"));
check("duplicate_unlock", source.includes("duplicate_unlock") || hud.includes("duplicate_unlock"));
check("binding", source.includes("binding") || hud.includes("binding"));
finish();
