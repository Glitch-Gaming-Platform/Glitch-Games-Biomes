#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereInventoryGuidance.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere item destroy confirmation tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("getHarthmereDestroyConfirmationText", source.includes("getHarthmereDestroyConfirmationText") || hud.includes("getHarthmereDestroyConfirmationText"));
check("confirmHarthmereItemDestroy", source.includes("confirmHarthmereItemDestroy") || hud.includes("confirmHarthmereItemDestroy"));
check("Cannot destroy quest items", source.includes("Cannot destroy quest items") || hud.includes("Cannot destroy quest items"));
check("Unlock this item", source.includes("Unlock this item") || hud.includes("Unlock this item"));
check("Type DESTROY", source.includes("Type DESTROY") || hud.includes("Type DESTROY"));
check("requires_instance_confirmation", source.includes("requires_instance_confirmation") || hud.includes("requires_instance_confirmation"));
check("quest_item_protected", source.includes("quest_item_protected") || hud.includes("quest_item_protected"));
finish();
