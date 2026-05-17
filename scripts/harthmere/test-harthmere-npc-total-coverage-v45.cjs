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

const categories = new Set(remaining.map((npc) => npc.category));
for (const category of ["quest_named", "ambient_guard", "ambient_town", "wilds_guard", "wilds_human", "animal", "bandit_type", "undead_type", "forest_monster_type", "smuggler_type"]) {
  assert(categories.has(category), `remaining coverage includes ${category}`);
}
assert(all.length === named.length + remaining.length, "combined v45 all count matches v44 + remaining");
assert(remaining.some((npc) => npc.id === "tessen_hark"), "Tessen Hark added beyond v44");
assert(remaining.some((npc) => npc.id === "mira_holt"), "Mira Holt added beyond v44");
assert(remaining.filter((npc) => npc.kind === "animal").length >= 20, "wildlife animal family coverage present");
assert(remaining.filter((npc) => npc.role === "guard" || npc.role === "recruit_guard").length >= 6, "extra guard/recruit coverage present");
assert(remaining.filter((npc) => npc.role === "bandit").length >= 10, "bandit type coverage present");
assert(remaining.filter((npc) => npc.role === "undead").length >= 9, "undead type coverage present");
assert(remaining.filter((npc) => npc.role === "smuggler").length >= 7, "smuggler type coverage present");
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc total coverage v45");
