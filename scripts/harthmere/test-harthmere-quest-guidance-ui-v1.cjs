#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere quest guidance UI tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("HARTHMERE_QUEST_GUIDANCE_VERSION", source.includes("HARTHMERE_QUEST_GUIDANCE_VERSION") || hud.includes("HARTHMERE_QUEST_GUIDANCE_VERSION"));
check("HARTHMERE_QUEST_JOURNAL_SECTIONS", source.includes("HARTHMERE_QUEST_JOURNAL_SECTIONS") || hud.includes("HARTHMERE_QUEST_JOURNAL_SECTIONS"));
check("Tracked Quests", source.includes("Tracked Quests") || hud.includes("Tracked Quests"));
check("Recommended Next Quests", source.includes("Recommended Next Quests") || hud.includes("Recommended Next Quests"));
check("getHarthmereQuestStatusNotification", source.includes("getHarthmereQuestStatusNotification") || hud.includes("getHarthmereQuestStatusNotification"));
check("blocked", source.includes("blocked") || hud.includes("blocked"));
check("ready_to_turn_in", source.includes("ready_to_turn_in") || hud.includes("ready_to_turn_in"));
finish();
