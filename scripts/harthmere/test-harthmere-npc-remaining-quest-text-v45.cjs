#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const v44Path = path.join(root, "src/shared/harthmere/npc_compendium_v44.ts");
const v45Path = path.join(root, "src/shared/harthmere/npc_compendium_v45.ts");
const v44Text = fs.readFileSync(v44Path, "utf8");
const v45Text = fs.readFileSync(v45Path, "utf8");
function parseArray(text, name) {
  const re = new RegExp(String.raw`export const ${name} = (\[[\s\S]*?\]) as const;`);
  const match = text.match(re);
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}
const named = parseArray(v44Text, "HARTHMERE_NAMED_NPCS_V44");
const remaining = parseArray(v45Text, "HARTHMERE_REMAINING_NPCS_V45");
const all = [...named, ...remaining];
function assert(cond, msg) {
  if (!cond) { console.error("FAIL", msg); process.exitCode = 1; }
  else { console.log("OK", msg); }
}

for (const npc of remaining) {
  assert(Array.isArray(npc.questHooks) && npc.questHooks.length >= 1, `${npc.id} has quest/hook text`);
  for (const quest of npc.questHooks) {
    assert(quest.id && quest.title && quest.giver === npc.name, `${npc.id} quest id/title/giver valid`);
    assert(quest.offerText && quest.offerText.length >= 100, `${npc.id} quest offer text polished`);
    assert(quest.objectiveText && quest.objectiveText.length >= 90, `${npc.id} quest objective text exists`);
    assert(quest.completionText && quest.completionText.length >= 100, `${npc.id} quest completion text exists`);
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc remaining quest text v45");
