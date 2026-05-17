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

const required = ["sergeant_bram_holt", "walt_ormsby", "mara_thistle", "edrik_vane", "reeve_caldus_merrow", "master_osric_vale", "apprentice_luth", "master_garrik_fen", "helna_voss", "selka_doryn", "ysabet_fenlow", "old_jory_brann", "dawn_loaf", "tovin_reed", "lina_reed", "sora_reed", "father_aldren_mell", "sister_maelle_frenn", "brother_vance_holt", "brother_halpen_wren", "mother_halene_brae", "elowen_pike", "tisa_pike", "cellan_bow", "nessa_crowe", "old_tam_crowe", "boy_tam", "banker_merl_voss", "courier_anwen_mell", "auction_pell_marsten", "erena_voss", "lady_henrietta_merrow", "lila_merrow", "ren_skell", "lord_wrethan_pell", "henrick_brell", "veska_reed", "edda_wren", "merrit_bracken", "sella_reedfoot", "tamsin_vale", "brother_cael_marsen", "rusk_hallowhand", "veneth_moss_woman"];
assert(npcs.length === required.length, `expected ${required.length} named NPCs, found ${npcs.length}`);
const ids = new Set(npcs.map((n) => n.id));
for (const id of required) assert(ids.has(id), `required named NPC present: ${id}`);
assert(ids.size === npcs.length, "named NPC ids are unique");
for (const npc of npcs) {
  assert(npc.implementationStatus === "implemented_v44", `${npc.id} marked implemented_v44`);
  assert(npc.name && npc.district && npc.home, `${npc.id} has name, district, and home`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc compendium all named v44");
