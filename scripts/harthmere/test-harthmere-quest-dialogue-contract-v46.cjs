#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const banned = /TODO|FIXME|placeholder|test dialogue|dev only|lorem ipsum/i;
for (const q of quests) {
  for (const key of ["offer","active","ready","complete","fail"]) {
    const text = q.dialogue?.[key];
    check(`${q.id} dialogue ${key} exists`, typeof text === "string" && text.length >= 40);
    check(`${q.id} dialogue ${key} has no placeholder wording`, !banned.test(text || ""));
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest dialogue contract v46");
