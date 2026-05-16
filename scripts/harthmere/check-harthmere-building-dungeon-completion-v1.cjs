#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_DUNGEON_COMPLETION_TEST_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const lines = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const line of lines.filter(Boolean).slice(0, 80)) console.log(`  - ${line}`);
}
function check(label, condition, detail) { condition ? pass(label) : fail(label, detail); }

console.log("== Harthmere building/dungeon completion tests v1 ==");
console.log(`Root: ${root}`);
console.log("");

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const src = fs.readFileSync(assetsPath, "utf8");
check("completion marker exists", src.includes("HARTHMERE_BUILDING_DUNGEON_COMPLETION_V1"), "Missing HARTHMERE_BUILDING_DUNGEON_COMPLETION_V1");

const required = [
  ["Dawn Loaf Bakery", ["Dawn Loaf Bakery brick oven hearth", "Dawn Loaf Bakery kneading table", "Fresh Dawn Loaf bread sample"]],
  ["Brindle Provision House", ["Brindle Provision staple goods shelf", "Brindle Provision customer counter", "Brindle Provision ration crate"]],
  ["Green Mortar Apothecary", ["Green Mortar remedy bottle shelf", "Green Mortar mortar mixing table", "Green Mortar locked poison cabinet"]],
  ["Wyrm and Candle Magic Shop", ["Wyrm and Candle wax shelf", "bell resonance spellbook", "Wyrm and Candle tuning wand"]],
  ["Roadside Family Cottage", ["Roadside Family Cottage sleeping bed", "Family cottage supper candle", "Family cottage prayer cloth"]],
  ["Brass Scale moneylender/pawn interior", ["Brass Scale moneylender counter", "Brass Scale strongbox", "Brass Scale pawned valuables cabinet"]],
  ["River Dock Supply shop interior", ["River Dock Supply shop counter", "River Dock Supply rope hook", "River Dock Supply fog lantern"]],
  ["Q5 undercroft entry", ["Q5 Beneath the Stones", "Q5 undercroft mapping table", "Q5 undercroft wall torch"]],
  ["Q6 hidden door", ["Q6 Hidden Door", "Q6 mural inscription", "Q6 first combat pocket"]],
  ["Q7 Bellward Halls playable arena", ["Q7 First Choir arena", "Q7 central bell-pattern", "Q7 recovery bench"]],
  ["Q9 Veins of the Wyrm halls", ["Q9 Pulse Hall", "Q9 Echo Hall", "Q9 Spine Hall"]],
  ["Q10 Bellbinder Tomb boss-room staging", ["Q10 Bellbinder Tomb", "Q10 north ritual bell", "Q10 bell-clapper mechanism"]],
  ["Q11 Bellward Chamber ritual stations", ["Q11 Bellward Chamber True Bell", "Q11 Rebind ritual station", "Q11 Wake ritual station"]],
  ["Q12 Wyrm's Bed raid room staging", ["Q12 Wyrm's Bed raid arena", "Q12 raid safe-zone", "Q12 memorial replay stone"]],
];

for (const [label, needles] of required) {
  const missing = needles.filter((needle) => !src.includes(needle));
  check(`${label} is represented`, missing.length === 0, missing.join("\n"));
}

const markerIndex = src.indexOf("HARTHMERE_BUILDING_DUNGEON_COMPLETION_V1");
const nextActors = src.indexOf("// Ambient NPCs and animals", markerIndex);
const block = markerIndex >= 0 && nextActors > markerIndex ? src.slice(markerIndex, nextActors) : "";
check("completion block does not add actors", !/\bA\("/.test(block), "Found A(\" inside completion block");
check("completion block avoids outside-world expansion", !/Harthmere Wilds/.test(block), "Completion pass should not add outside-world placements");

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
