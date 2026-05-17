#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const main = quests.filter((q) => q.category === "main" && /^Q\d+$/.test(q.code)).sort((a,b) => Number(a.code.slice(1)) - Number(b.code.slice(1)));
check("exactly 12 numbered main quests", main.length === 12, `${main.length}`);
for (let i = 0; i < main.length; i++) {
  const expected = `Q${i + 1}`;
  check(`main code sequence ${expected}`, main[i].code === expected, main[i].code);
  check(`${expected} is Bell-Tie`, main[i].bellTie === true);
  if (i > 0) check(`${expected} requires prior main quest`, main[i].activeRules.prerequisiteQuestIds.includes(main[i-1].id), main[i].activeRules.prerequisiteQuestIds.join(","));
}
const q12 = main.find((q) => q.code === "Q12");
check("Q12 has path-dependent final rewards", q12.rewards.variable === true && q12.rewards.previewText.includes("Path-dependent"));
check("Q12 unlocks post-main state", q12.rewards.unlocks.includes("post_main_harthmere_state"));
const optional = quests.find((q) => q.code === "Q2.5");
check("Q2.5 optional branch exists", !!optional);
check("Q2.5 requires Q2", optional.activeRules.prerequisiteQuestIds.includes("bellbound_q02_whispers_at_well"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest main arc sequence v46");
