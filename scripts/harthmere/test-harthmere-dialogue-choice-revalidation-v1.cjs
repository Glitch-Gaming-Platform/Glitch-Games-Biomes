#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere dialogue choice revalidation tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("validateHarthmereDialogueChoice", source.includes("validateHarthmereDialogueChoice") || hud.includes("validateHarthmereDialogueChoice"));
check("requiresItems", source.includes("requiresItems") || hud.includes("requiresItems"));
check("missing_required_item", source.includes("missing_required_item") || hud.includes("missing_required_item"));
check("likeability_changed", source.includes("likeability_changed") || hud.includes("likeability_changed"));
check("legal_state_changed", source.includes("legal_state_changed") || hud.includes("legal_state_changed"));
check("notoriety_changed", source.includes("notoriety_changed") || hud.includes("notoriety_changed"));
check("hostile_negotiation_blocked", source.includes("hostile_negotiation_blocked") || hud.includes("hostile_negotiation_blocked"));
finish();
