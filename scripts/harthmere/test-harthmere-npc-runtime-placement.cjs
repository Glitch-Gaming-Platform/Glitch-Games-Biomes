#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const v44Path = path.join(root, "src/shared/harthmere/npc_compendium.ts");
const v45Path = path.join(root, "src/shared/harthmere/npc_compendium.ts");
const v44Text = fs.readFileSync(v44Path, "utf8");
const v45Text = fs.readFileSync(v45Path, "utf8");
function parseArray(text, name) {
  const re = new RegExp(String.raw`export const ${name} = (\[[\s\S]*?\]) as const;`);
  const match = text.match(re);
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}
const named = parseArray(v44Text, "HARTHMERE_NAMED_NPCS");
const remaining = parseArray(v45Text, "HARTHMERE_REMAINING_NPCS");
const all = [...named, ...remaining];
function assert(cond, msg) {
  if (!cond) { console.error("FAIL", msg); process.exitCode = 1; }
  else { console.log("OK", msg); }
}

const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const renderer = fs.readFileSync(rendererPath, "utf8");
assert(renderer.includes("HARTHMERE_REMAINING_NPCS"), "renderer imports remaining NPC compendium");
assert(renderer.includes("HARTHMERE_REMAINING_NPCS_RUNTIME_PLACEMENTS_START"), "renderer has current runtime placement block");
assert(renderer.includes("harthmereRemainingNpcActorAsset(npc)"), "runtime placements resolve current actor asset");
for (const npc of remaining) {
  assert(typeof npc.spawn.x === "number" && typeof npc.spawn.z === "number" && typeof npc.spawn.rot === "number", `${npc.id} has spawn x/z/rot`);
  assert(typeof npc.spawn.asset === "string" && /^(townsperson_|animal_)/.test(npc.spawn.asset), `${npc.id} uses a known runtime actor asset prefix`);
  assert(Number.isInteger(npc.combatOffset) && npc.combatOffset >= 9800, `${npc.id} has stable combat offset`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc runtime placement current");
