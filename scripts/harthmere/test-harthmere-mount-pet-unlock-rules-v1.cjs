#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere mount/pet unlock rule tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("learnedTokenItemId", source.includes("learnedTokenItemId") || hud.includes("learnedTokenItemId"));
check("canSellHarthmereMountOrPetToken", source.includes("canSellHarthmereMountOrPetToken") || hud.includes("canSellHarthmereMountOrPetToken"));
check("Mount/pet unlock tokens become collection records", source.includes("Mount/pet unlock tokens become collection records") || hud.includes("Mount/pet unlock tokens become collection records"));
check("account_bound", source.includes("account_bound") || hud.includes("account_bound"));
check("character_bound", source.includes("character_bound") || hud.includes("character_bound"));
check("cannotSellAfterLearned", source.includes("cannotSellAfterLearned") || hud.includes("cannotSellAfterLearned"));
check("not_learned", source.includes("not_learned") || hud.includes("not_learned"));
finish();
