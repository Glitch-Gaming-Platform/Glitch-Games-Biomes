#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
for (const q of quests) {
  const a = q.activeRules;
  check(`${q.id} has active rules`, !!a);
  check(`${q.id} initial state valid`, ["locked","available"].includes(a.initialState));
  check(`${q.id} has start trigger`, typeof a.startTrigger === "string" && a.startTrigger.length >= 5);
  check(`${q.id} has time-of-day coverage`, Array.isArray(a.timeOfDay) && a.timeOfDay.length >= 1);
  check(`${q.id} has active hour list`, Array.isArray(a.activeHours) && a.activeHours.every((h) => Number.isInteger(h) && h >= 0 && h <= 23));
  check(`${q.id} has weather gate list`, Array.isArray(a.weather) && a.weather.length >= 1);
  check(`${q.id} has level band`, Number.isInteger(q.levelBand.min) && Number.isInteger(q.levelBand.max) && q.levelBand.min <= q.levelBand.max);
  check(`${q.id} has estimated timing`, Number.isInteger(q.estimatedMinutes) && q.estimatedMinutes > 0);
  check(`${q.id} activation test cases cover timing/prereq/duplicate`,
    a.activationTestCases.includes("valid level and timing becomes available") &&
    a.activationTestCases.includes("missing prerequisite stays locked") &&
    a.activationTestCases.includes("duplicate acceptance is idempotent"));
}
const nightQuests = quests.filter((q) => q.activeRules.timeOfDay.includes("night") && q.activeRules.timeOfDay.length < 4);
check("has explicitly time-gated night/dusk quests", nightQuests.length >= 5, `${nightQuests.length}`);
const stormQuests = quests.filter((q) => q.activeRules.weather.includes("storm") && q.activeRules.weather.length < 5);
check("has weather-gated hidden/storm quests", stormQuests.length >= 2, `${stormQuests.length}`);
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest activation timing v46");
