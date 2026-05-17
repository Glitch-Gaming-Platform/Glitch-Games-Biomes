#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const compendiumPath = path.join(root, "src/shared/harthmere/npc_compendium_v44.ts");
const text = fs.readFileSync(compendiumPath, "utf8");
const match = text.match(/export const HARTHMERE_NAMED_NPCS_V44 = (\[[\s\S]*?\]) as const;/);
if (!match) throw new Error("Could not parse HARTHMERE_NAMED_NPCS_V44 JSON literal");
const npcs = JSON.parse(match[1]);
function assert(cond, msg) { if (!cond) { console.error("FAIL", msg); process.exitCode = 1; } else { console.log("OK", msg); } }

for (const npc of npcs) {
  assert(Array.isArray(npc.questHooks) && npc.questHooks.length >= 1, `${npc.id} has related mission/quest hook`);
  for (const quest of npc.questHooks) {
    assert(quest.id && quest.title && quest.giver === npc.name, `${npc.id} quest id/title/giver valid`);
    assert(quest.offerText && quest.offerText.length >= 90, `${npc.id} quest offer text is polished`);
    assert(quest.objectiveText && quest.objectiveText.length >= 70, `${npc.id} quest objective text exists`);
    assert(quest.completionText && quest.completionText.length >= 80, `${npc.id} quest completion text exists`);
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc quest text v44");
