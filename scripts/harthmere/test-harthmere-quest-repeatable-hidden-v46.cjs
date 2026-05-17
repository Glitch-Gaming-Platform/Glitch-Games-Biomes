#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests, policy } = readQuestModule(root);
const repeatables = quests.filter((q) => q.category === "repeatable");
check("repeatables cover daily and weekly", repeatables.some((q) => q.repeatability === "daily") && repeatables.some((q) => q.repeatability === "weekly"));
for (const family of policy.requiredRepeatableFamilies) {
  check(`repeatable family covered ${family}`, repeatables.some((q) => JSON.stringify(q).includes(family)));
}
for (const q of repeatables) {
  check(`${q.id} repeatability not once`, q.repeatability === "daily" || q.repeatability === "weekly");
  check(`${q.id} has cooldown-like repeatable policy`, q.contentType.includes("Daily") || q.contentType.includes("Weekly"));
}
const hidden = quests.filter((q) => q.hidden);
for (const q of hidden) {
  check(`${q.id} hidden has world trigger`, q.giverId === null && q.activeRules.startTrigger !== "speak_to_giver");
  check(`${q.id} hidden has trigger-like objective`, q.objectives.some((o) => ["inspect","read","choice"].includes(o.type)));
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest repeatable hidden v46");
