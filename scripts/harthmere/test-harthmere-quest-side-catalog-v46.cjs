#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const byCode = new Map(quests.map((q) => [q.code, q]));
for (let i = 1; i <= 42; i++) {
  const code = `SQ-${String(i).padStart(3,"0")}`;
  const q = byCode.get(code);
  check(`${code} present`, !!q);
  check(`${code} category side/hidden`, q && (q.category === "side" || q.category === "side_hidden"));
  check(`${code} has premise`, q && typeof q.premise === "string" && q.premise.length >= 30);
  check(`${code} has choices or authored resolution`, q && Array.isArray(q.choices) && q.choices.length >= 1);
}
check("SQ-040 hidden", byCode.get("SQ-040")?.hidden === true);
check("SQ-041 hidden", byCode.get("SQ-041")?.hidden === true);
check("SQ-042 hidden", byCode.get("SQ-042")?.hidden === true);
check("SQ-038 unlocks legal pressure for SQ-030", byCode.get("SQ-038")?.rewards.unlocks.includes("legal_pressure_for_sq030"));
check("SQ-030 references Mudden safehouse best path", byCode.get("SQ-030")?.rewards.unlocks.includes("mudden_safehouse_bind_best_path"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest side catalog v46");
