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

const signatures = new Set(named.map((npc) => npc.face && npc.face.signature).filter(Boolean));
const nonGuardOutfits = new Set();
let guardUniform = null;
for (const npc of remaining) {
  assert(npc.face && npc.face.signature && npc.face.distinguishingFeature, `${npc.id} has visual/face identity`);
  assert(!signatures.has(npc.face.signature), `${npc.id} visual signature unique across v44+v45`);
  signatures.add(npc.face.signature);
  assert(npc.stats && npc.stats.health > 0 && npc.stats.level >= 1 && npc.stats.mana >= 0 && npc.stats.resolve >= 0, `${npc.id} health/mana/level/resolve valid`);
  assert(npc.inventory && Number.isFinite(npc.inventory.gold) && npc.inventory.gold >= 0, `${npc.id} has gold field`);
  assert(Array.isArray(npc.inventory.items) && npc.inventory.items.length >= 2, `${npc.id} has inventory/loot items`);
  assert(npc.clothing && npc.clothing.outfitId && npc.clothing.style, `${npc.id} has clothing/visual style`);
  if (npc.kind === "animal") {
    assert(npc.weapons.length === 0, `${npc.id} animal has no weapons`);
    assert(npc.inventory.gold === 0, `${npc.id} animal has no carried gold`);
  }
  if (npc.role === "guard" || npc.role === "recruit_guard") {
    assert(npc.weapons.length >= 1, `${npc.id} guard/recruit has weapon`);
    guardUniform = guardUniform || npc.clothing.uniformGroup;
    assert(npc.clothing.uniformGroup === guardUniform, `${npc.id} guard/recruit shares guard uniform`);
  } else {
    assert(!npc.clothing.uniformGroup, `${npc.id} non-guard does not use guard uniform`);
    assert(!nonGuardOutfits.has(npc.clothing.outfitId), `${npc.id} non-guard has unique outfit/style id`);
    nonGuardOutfits.add(npc.clothing.outfitId);
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc remaining face weapon stats inventory clothing v45");
