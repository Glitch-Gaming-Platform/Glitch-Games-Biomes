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

const banned = /test|todo|placeholder|lorem|dev only|debug npc|fixme/i;
const greetings = new Set();
for (const npc of remaining) {
  assert(npc.bibleBackstory && npc.bibleBackstory.length >= 120, `${npc.id} has backstory/source rationale`);
  assert(npc.sourceRationale && npc.sourceRationale.length >= 80, `${npc.id} has source rationale`);
  assert(npc.personality && npc.personality.length >= 50, `${npc.id} has personality`);
  assert(npc.voiceStyle && npc.voiceStyle.length >= 50, `${npc.id} has voice style`);
  for (const key of ["greeting", "service", "rumor", "questOffer", "farewell"]) {
    assert(npc.dialogue && npc.dialogue[key] && npc.dialogue[key].length >= 70, `${npc.id} dialogue ${key} is production length`);
    assert(!banned.test(npc.dialogue[key]), `${npc.id} dialogue ${key} has no dev/test placeholder wording`);
  }
  assert(!greetings.has(npc.dialogue.greeting), `${npc.id} greeting is unique enough`);
  greetings.add(npc.dialogue.greeting);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc remaining story dialogue v45");
