#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere quest notice board tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("HARTHMERE_NOTICE_BOARD_QUESTS", source.includes("HARTHMERE_NOTICE_BOARD_QUESTS") || hud.includes("HARTHMERE_NOTICE_BOARD_QUESTS"));
check("market_notice_board", source.includes("market_notice_board") || hud.includes("market_notice_board"));
check("guard_bounty_board", source.includes("guard_bounty_board") || hud.includes("guard_bounty_board"));
check("crafting_order_board", source.includes("crafting_order_board") || hud.includes("crafting_order_board"));
check("refreshHours", source.includes("refreshHours") || hud.includes("refreshHours"));
check("questIds", source.includes("questIds") || hud.includes("questIds"));
finish();
