#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests, policy } = readQuestModule(root);
const ids = new Set(quests.map((q) => q.id));
const codes = new Set(quests.map((q) => q.code));
check("quest count meets policy", quests.length >= policy.minimumQuestCount, `${quests.length} < ${policy.minimumQuestCount}`);
check("quest ids are unique", ids.size === quests.length);
for (const code of policy.requiredMainQuestCodes) check(`main quest present ${code}`, codes.has(code));
for (const code of policy.requiredOptionalMainCodes) check(`optional main quest present ${code}`, codes.has(code));
for (const code of policy.requiredSideQuestCodes) check(`side quest present ${code}`, codes.has(code));
for (const id of policy.requiredStarterQuestIds) check(`starter/current quest present ${id}`, ids.has(id));
check("has starter quests", quests.filter((q) => q.category === "starter").length >= 9);
check("has repeatable quests", quests.filter((q) => q.category === "repeatable").length >= 15);
check("has hidden quests", quests.filter((q) => q.hidden).length >= 3);
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest catalog total coverage v46");
