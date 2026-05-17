#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const bell = quests.filter((q) => q.bellTie);
check("main arc all Bell-Tie", quests.filter((q) => q.category === "main" && /^Q\d+$/.test(q.code)).every((q) => q.bellTie));
check("side/starter Bell-Tie quests exist", bell.filter((q) => q.category !== "main").length >= 8);
for (const q of bell) {
  check(`${q.id} Bell-Tie has lore/reward unlock`, q.rewards.unlocks.length || q.rewards.items.length || q.rewards.permanentBuffs.length || q.rewards.variable);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest bell tie coverage v46");
