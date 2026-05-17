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

const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const renderer = fs.readFileSync(rendererPath, "utf8");
assert(renderer.includes("HARTHMERE_NAMED_NPCS_V44"), "renderer imports named NPC compendium");
assert(renderer.includes("HARTHMERE_NAMED_NPCS_V44_RUNTIME_PLACEMENTS_START"), "renderer has named NPC runtime placement block");
assert(renderer.includes("harthmereNamedNpcActorAssetV44(npc)"), "runtime placements resolve compendium actor asset");
assert(renderer.includes("npc.combatOffset"), "runtime placements carry stable combat offsets");
for (const npc of npcs) {
  assert(typeof npc.spawn.x === "number" && typeof npc.spawn.z === "number", `${npc.id} has spawn x/z`);
  assert(npc.spawn.asset.startsWith("townsperson_"), `${npc.id} uses runtime townsperson actor asset`);
  assert(Number.isInteger(npc.combatOffset) && npc.combatOffset >= 9400, `${npc.id} has stable combat offset`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc runtime placement v44");
