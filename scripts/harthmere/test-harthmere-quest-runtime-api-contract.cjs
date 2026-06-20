#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const questPath = path.join(root, "src/shared/harthmere/quest_compendium.ts");
const src = fs.readFileSync(questPath, "utf8");
const { quests } = readQuestModule(root);
check("exports catalog version", /HARTHMERE_QUEST_CATALOG_VERSION\s*=\s*46/.test(src));
check("exports quest lookup", /function getHarthmereQuestById/.test(src));
check("exports activation validator", /function validateHarthmereQuestActivation/.test(src));
check("exports active quest getter", /function getActiveHarthmereQuests/.test(src));
check("exports reward preview", /function previewHarthmereQuestRewards/.test(src));
check("exports catalog validator", /function validateHarthmereQuestCatalog/.test(src));
check("runtime API has enough data to drive journal", quests.every((q) => q.title && q.location && q.objectives && q.rewards && q.dialogue));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest runtime API contract current");
