#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const { loadTown, makeReporter, normalizeDistrict } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere danger-zone communication tests v1", root);
const town = loadTown(root);
const dangerDistricts = ["river_docks", "mudden_ward", "old_well_underways", "wilds"];
const missingDanger = dangerDistricts.filter((d) => !new RegExp(`${d}:\\s*\\{[\\s\\S]{0,400}dangerZone:\\s*true`, "i").test(town.registrySrc));
report.check("danger and medium-risk districts are marked in registry", missingDanger.length === 0, missingDanger);
for (const d of dangerDistricts) { const districtPlacements = town.placements.filter((p) => normalizeDistrict(p.district) === d); const hasWarning = districtPlacements.some((p) => /warning|danger|caution|barred|watch|guard|breadcrumb|torch|sign|fence|gate|blood|corpse|bones|sighting|whisper|plague|flood|fire|ambush|crypt|undead/i.test(`${p.asset} ${p.name}`)); report.check(`${d} communicates danger visually`, hasWarning, "Missing warning/breadcrumb/danger visual"); }
const starterSafeDistricts = ["north_gate", "market_square", "player_services", "copper_kettle", "craftsman_row", "temple_green", "guard_yard"];
const hostilesInSafe = town.placements.filter((p) => p.kind === "A" && starterSafeDistricts.includes(normalizeDistrict(p.district)) && !/prisoner|captured|bounty|warrant|training|dummy/i.test(`${p.asset} ${p.name}`) && /bandit|undead|monster|wolf|beast|hostile|skeleton|zombie|goblin/i.test(`${p.asset} ${p.name}`)).map((p) => `${p.name || p.asset} in ${p.district} line ${p.line}`);
report.check("starter safe/service districts do not contain hostile spawns", hostilesInSafe.length === 0, hostilesInSafe);
report.check("leaving safety has transition cues", /leaving safety|danger transition|warning.*district|barred|watch sign|hidden drain|underways|flood warning|river beast|crypt disturbance/i.test(town.assetsSrc), "Expected transition warnings at unsafe edges");
report.finish();
