#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere mount collection tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("HARTHMERE_MOUNT_PET_COLLECTION_VERSION", source.includes("HARTHMERE_MOUNT_PET_COLLECTION_VERSION") || hud.includes("HARTHMERE_MOUNT_PET_COLLECTION_VERSION"));
check("learnedMounts", source.includes("learnedMounts") || hud.includes("learnedMounts"));
check("HARTHMERE_MOUNT_DEFINITIONS", source.includes("HARTHMERE_MOUNT_DEFINITIONS") || hud.includes("HARTHMERE_MOUNT_DEFINITIONS"));
check("learnHarthmereMount", source.includes("learnHarthmereMount") || hud.includes("learnHarthmereMount"));
check("duplicate_unlock", source.includes("duplicate_unlock") || hud.includes("duplicate_unlock"));
check("binding", source.includes("binding") || hud.includes("binding"));
check("mountEquipment", source.includes("mountEquipment") || hud.includes("mountEquipment"));
check("cannotSellAfterLearned", source.includes("cannotSellAfterLearned") || hud.includes("cannotSellAfterLearned"));
finish();
