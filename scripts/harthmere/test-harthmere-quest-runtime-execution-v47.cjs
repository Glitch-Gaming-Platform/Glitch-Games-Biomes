#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/shared/harthmere/quest_runtime_v47.ts"), "utf8");
check("quest runtime v47 version exported", /HARTHMERE_QUEST_RUNTIME_VERSION_V47\s*=\s*47/.test(src));
for (const fn of ["createHarthmereQuestRuntimeContextV47", "acceptHarthmereQuestV47", "advanceHarthmereQuestObjectiveV47", "completeHarthmereQuestV47", "validateHarthmereQuestRuntimeEventV47"]) {
  check(`exports ${fn}`, new RegExp(`function\\s+${fn}`).test(src));
}
for (const state of ["locked", "available", "active", "ready_to_complete", "completed", "failed", "abandoned"]) {
  check(`runtime includes state ${state}`, src.includes(`"${state}"`));
}
check("imports v46 quest catalog", src.includes("HARTHMERE_QUEST_CATALOG_V46"));
check("accept uses v46 activation validation", src.includes("validateHarthmereQuestActivationV46"));
check("completion requires ready state", src.includes('record.state !== "ready_to_complete"'));
check("objectives move quest to ready-to-complete", src.includes('record.state = "ready_to_complete"'));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest runtime execution v47");
