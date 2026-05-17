#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/shared/harthmere/quest_runtime_v47.ts"), "utf8");
for (const fn of ["failHarthmereQuestV47", "abandonHarthmereQuestV47", "retryHarthmereQuestV47"]) {
  check(`exports ${fn}`, new RegExp(`function\\s+${fn}`).test(src));
}
check("failure stores reason", src.includes("failureReason") && src.includes("quest_failed"));
check("abandon stores tick", src.includes("abandonedAtTick") && src.includes("quest_abandoned"));
check("retry requires failed or abandoned", src.includes("retry_requires_failed_or_abandoned_state"));
check("retry creates a fresh active record", src.includes("createHarthmereQuestRuntimeRecordV47(quest, context.tick)") && src.includes("quest_retried"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest runtime fail abandon retry v47");
