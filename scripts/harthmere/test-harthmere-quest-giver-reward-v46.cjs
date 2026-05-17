#!/usr/bin/env node
const path = require("path");
const { readQuestModule, readNpcIds, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const npcIds = readNpcIds(root);
for (const q of quests) {
  check(`${q.id} has giver, hidden trigger, or automatic trigger`, q.hidden || q.activeRules.startTrigger !== "speak_to_giver" || (typeof q.giverId === "string" && q.giverId.length > 2));
  if (!q.hidden && q.giverId) check(`${q.id} giver exists in NPC compendium`, npcIds.has(q.giverId), q.giverId);
  check(`${q.id} has reward object`, !!q.rewards);
  check(`${q.id} reward preview is production text`, typeof q.rewards.previewText === "string" && q.rewards.previewText.length >= 20);
  check(`${q.id} has XP or silver/items/title/unlock/buff/variable reward`,
    q.rewards.xp > 0 || q.rewards.silver > 0 || q.rewards.items?.length || q.rewards.titles?.length || q.rewards.unlocks?.length || q.rewards.permanentBuffs?.length || q.rewards.variable);
  check(`${q.id} reward grant policy exists`, q.testContract.rewardGrantPolicy === "server_authoritative_once_per_completion");
  check(`${q.id} completion cannot double grant`, q.testContract.edgeCases.includes("double_complete") && q.testContract.edgeCases.includes("client_reward_spoof"));
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest giver reward v46");
