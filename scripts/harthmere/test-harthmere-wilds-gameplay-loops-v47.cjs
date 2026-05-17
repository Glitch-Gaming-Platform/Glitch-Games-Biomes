#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
function readJsonExport(src, name) { const re = new RegExp(`${name} = ` + "`([\\s\\S]*?)`;", "m"); const m = src.match(re); if (!m) throw new Error(`missing ${name}`); return JSON.parse(m[1]); }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/shared/harthmere/wilds_gameplay_loops_v47.ts"), "utf8");
const loops = readJsonExport(src, "HARTHMERE_WILDS_LOOP_SYSTEMS_V47_JSON");
const required = ["gate_fields_starter_loop_v47", "mill_road_orchard_lane_events_v47", "greenmere_gathering_hunting_loop_v47", "briarfen_wetland_danger_loop_v47", "watchtower_ridge_bandit_loop_v47", "gravewood_undead_loop_v47", "deep_old_wood_supernatural_loop_v47", "resource_ownership_and_theft_law_v47", "overharvesting_consequence_loop_v47", "public_world_events_v47"];
for (const id of required) check(`wilds loop exists: ${id}`, loops.some((l) => l.id === id));
for (const loop of loops) {
  check(`${loop.id} has activities`, loop.coreActivities.length > 0);
  check(`${loop.id} has resources`, loop.resources.length > 0);
  check(`${loop.id} has threats`, loop.threats.length > 0 || loop.id.includes("resource_ownership"));
  check(`${loop.id} has town feedback`, loop.townEffects.length > 0);
  check(`${loop.id} has law/resource rules`, loop.lawRules.length > 0);
  check(`${loop.id} has test cases`, loop.testCases.length > 0);
}
for (const fn of ["classifyHarthmereResourceOwnershipV47", "applyHarthmereWildsGatheringV47", "resolveHarthmereWildsPublicEventV47", "computeHarthmereWildsDangerV47", "validateHarthmereWildsLoopCoverageV47"]) check(`exports ${fn}`, src.includes(`function ${fn}`));
check("owned goods require permission", src.includes("owned_goods") && src.includes("permissionRequired: true"));
check("overharvesting consequences exist", src.includes("corrupted_animals_spawn") && src.includes("resource_recovery_quest_available"));
check("public events require contribution", src.includes("insufficient_contribution"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS wilds gameplay loops v47");
