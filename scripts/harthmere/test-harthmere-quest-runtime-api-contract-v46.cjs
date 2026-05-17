#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const questPath = path.join(root, "src/shared/harthmere/quest_compendium_v46.ts");
const src = fs.readFileSync(questPath, "utf8");
const { quests } = readQuestModule(root);
check("exports catalog version", /HARTHMERE_QUEST_CATALOG_VERSION_V46\s*=\s*46/.test(src));
check("exports quest lookup", /function getHarthmereQuestByIdV46/.test(src));
check("exports activation validator", /function validateHarthmereQuestActivationV46/.test(src));
check("exports active quest getter", /function getActiveHarthmereQuestsV46/.test(src));
check("exports reward preview", /function previewHarthmereQuestRewardsV46/.test(src));
check("exports catalog validator", /function validateHarthmereQuestCatalogV46/.test(src));
check("runtime API has enough data to drive journal", quests.every((q) => q.title && q.location && q.objectives && q.rewards && q.dialogue));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest runtime API contract v46");
