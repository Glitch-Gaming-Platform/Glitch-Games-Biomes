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

const faceSignatures = new Set();
const nonGuardOutfits = new Set();
let guardUniform;
for (const npc of npcs) {
  assert(npc.face && npc.face.signature && npc.face.distinguishingFeature, `${npc.id} has unique face data`);
  assert(!faceSignatures.has(npc.face.signature), `${npc.id} face signature is unique`);
  faceSignatures.add(npc.face.signature);
  assert(npc.stats.health > 0 && npc.stats.level >= 1 && npc.stats.mana >= 0 && npc.stats.resolve >= 0, `${npc.id} health/mana/level/resolve valid`);
  assert(npc.inventory && Number.isFinite(npc.inventory.gold) && npc.inventory.gold >= 0, `${npc.id} has gold`);
  assert(Array.isArray(npc.inventory.items) && npc.inventory.items.length >= 2, `${npc.id} has inventory items`);
  assert(npc.clothing && npc.clothing.outfitId && npc.clothing.style, `${npc.id} has clothing`);
  if (npc.kind === "animal") assert(npc.weapons.length === 0, `${npc.id} animal has no weapons`);
  if (npc.role === "guard") {
    assert(npc.weapons.length >= 1, `${npc.id} guard has weapon`);
    guardUniform = guardUniform || npc.clothing.uniformGroup;
    assert(npc.clothing.uniformGroup === guardUniform, `${npc.id} guard shares guard uniform`);
  } else {
    assert(!npc.clothing.uniformGroup, `${npc.id} non-guard does not use guard uniform`);
    assert(!nonGuardOutfits.has(npc.clothing.outfitId), `${npc.id} non-guard has unique outfit`);
    nonGuardOutfits.add(npc.clothing.outfitId);
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc face weapon stats inventory clothing v44");
