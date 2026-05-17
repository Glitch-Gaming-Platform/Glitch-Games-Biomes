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

const banned = /(test|testing|development|placeholder|todo|lorem|debug|stub)/i;
const greetings = new Set();
for (const npc of npcs) {
  assert(npc.bibleBackstory && npc.bibleBackstory.length >= 160, `${npc.id} has bible backstory`);
  assert(npc.personality && npc.personality.length >= 40, `${npc.id} has personality`);
  assert(npc.voiceStyle && npc.voiceStyle.length >= 35, `${npc.id} has voice style`);
  for (const key of ["greeting", "service", "rumor", "questOffer", "farewell"]) {
    assert(npc.dialogue[key] && npc.dialogue[key].length >= 45, `${npc.id} dialogue ${key} is production length`);
    assert(!banned.test(npc.dialogue[key]), `${npc.id} dialogue ${key} has no dev/test placeholder wording`);
  }
  assert(!greetings.has(npc.dialogue.greeting), `${npc.id} greeting is unique`);
  greetings.add(npc.dialogue.greeting);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc backstory dialogue v44");
