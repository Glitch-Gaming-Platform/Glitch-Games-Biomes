#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
function readJsonExport(src, name) { const re = new RegExp(`${name} = ` + "`([\\s\\S]*?)`;", "m"); const m = src.match(re); if (!m) throw new Error(`missing ${name}`); return JSON.parse(m[1]); }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/shared/harthmere/main_quest_spaces_v47.ts"), "utf8");
const spaces = readJsonExport(src, "HARTHMERE_MAIN_QUEST_SPACES_V47_JSON");
const requiredNames = ["Old Bridge Crack Interaction Space", "Chapel Cellar and Undercroft", "Hidden Door Encounter", "Bellward Halls Dungeon", "Old Harth's Antechamber", "Veins of the Wyrm", "Bellbinder's Tomb", "Bellward Chamber Race Sequence", "Wyrm's Bed / Thaedryn Arena"];
for (const name of requiredNames) check(`space exists: ${name}`, spaces.some((s) => s.name === name));
for (const qid of ["bellbound_q01_cracks_in_bridge", "bellbound_q05_beneath_the_stones", "bellbound_q06_hidden_door", "bellbound_q07_bellward_halls", "bellbound_q08_voices_in_stone", "bellbound_q09_veins_of_wyrm", "bellbound_q10_bellbinders_tomb", "bellbound_q11_last_ringing", "bellbound_q12_thaedryn_bellbound"]) {
  check(`quest has physical/playable space: ${qid}`, spaces.some((s) => s.questIds.includes(qid) && s.playableRuntime && s.physicallyPlaced));
}
for (const s of spaces) {
  check(`${s.id} has floor/walls/navmesh collision plan`, !!(s.collisionPlan && s.collisionPlan.floor && s.collisionPlan.walls && s.collisionPlan.navmesh));
  check(`${s.id} has entry/exit`, !!(s.entry && s.exit));
  check(`${s.id} has interactables`, Array.isArray(s.interactables) && s.interactables.length > 0);
  check(`${s.id} has accessibility`, Array.isArray(s.accessibility) && s.accessibility.length > 0);
  check(`${s.id} has tests`, Array.isArray(s.testCases) && s.testCases.length > 0);
}
check("exports space validator", src.includes("validateHarthmereMainQuestSpacesV47"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS main quest spaces v47");
