#!/usr/bin/env node
"use strict";
/* HARTHMERE_BIBLE_IMPLEMENTATION_AUDIT_TEST_V53 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let ok = true;
function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) { ok = false; console.log(`FAIL ${label}`); if (detail) console.log(`  - ${detail}`); }
function check(cond, label, detail) { cond ? pass(label) : fail(label, detail); }

console.log("== Harthmere bible implementation audit test v53 ==");
console.log(`Root: ${root}`);
const auditScript = path.join(root, "scripts/harthmere/audit-harthmere-bible-implementation-v53.cjs");
check(fs.existsSync(auditScript), "audit script exists", auditScript);
if (!fs.existsSync(auditScript)) process.exit(1);

const result = spawnSync(process.execPath, [auditScript, root], { cwd: root, encoding: "utf8" });
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
check(result.status === 0, "audit script exits successfully in report mode", `exit ${result.status}`);

const reportPath = path.join(root, "docs/harthmere/HARTHMERE_BIBLE_IMPLEMENTATION_AUDIT_V53.md");
const jsonPath = path.join(root, "public/assets/harthmere/manifest/harthmere-bible-implementation-audit-v53.json");
check(fs.existsSync(reportPath), "markdown audit report is written", reportPath);
check(fs.existsSync(jsonPath), "json audit report is written", jsonPath);
if (fs.existsSync(jsonPath)) {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  check(data.buildings.requiredCount >= 25, "audit covers at least 25 bible-required buildings", data.buildings.requiredCount);
  check(data.buildings.missing.length === 0, "no bible-required buildings are missing", data.buildings.missing.map((b) => b.name).join(", "));
  check(data.buildings.partialOrIncorrect.length === 0, "no bible-required buildings are decorative-only/partial", data.buildings.partialOrIncorrect.map((b) => b.name).join(", "));
  check(data.dungeons.requiredCount >= 18, "audit covers at least 18 dungeon/main-quest spaces", data.dungeons.requiredCount);
  check(data.dungeons.missing.length === 0, "no bible-required dungeon spaces are missing", data.dungeons.missing.map((d) => d.name).join(", "));
  check(data.dungeons.collisionPlanEvidence, "dungeon spaces have collision plan evidence");
  check(data.npc.totalCount >= 180, "npc catalog has broad v44/v45 coverage", data.npc.totalCount);
  check(data.npc.missingNamedNpc.length === 0, "no required named NPCs are missing", data.npc.missingNamedNpc.join(", "));
  check(data.quests.total >= data.quests.minimumQuestCount, "quest catalog meets minimum count", `${data.quests.total}/${data.quests.minimumQuestCount}`);
  check(data.quests.missingMain.length === 0, "no main quest codes Q1-Q12 are missing", data.quests.missingMain.join(", "));
  check(data.quests.missingOptionalMain.length === 0, "optional Q2.5 is present", data.quests.missingOptionalMain.join(", "));
  check(data.quests.missingSide.length === 0, "side quests SQ-001..SQ-042 are present", data.quests.missingSide.join(", "));
  check(data.quests.runtimeFilesExist, "quest runtime/space/boss/wilds files exist");
}
console.log(ok ? "\nRESULT: PASS bible implementation audit v53" : "\nRESULT: FAIL bible implementation audit v53");
process.exit(ok ? 0 : 1);
