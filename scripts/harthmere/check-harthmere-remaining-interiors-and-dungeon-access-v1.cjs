#!/usr/bin/env node
"use strict";
/* HARTHMERE_REMAINING_INTERIORS_AND_DUNGEON_ACCESS_TEST_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const items = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const item of items.filter(Boolean).slice(0, 120)) console.log(`  - ${item}`);
}
function check(label, condition, detail) {
  condition ? pass(label) : fail(label, detail || label);
}

console.log("== Harthmere remaining interiors and dungeon access tests v1 ==");
console.log(`Root: ${root}`);
console.log();

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const src = fs.readFileSync(assetsPath, "utf8");
const marker = "// HARTHMERE_REMAINING_INTERIORS_AND_DUNGEON_ACCESS_V1";
const markerIndex = src.indexOf(marker);
const ambientIndex = src.indexOf("// Ambient NPCs and animals", markerIndex);
const block = markerIndex >= 0 && ambientIndex > markerIndex ? src.slice(markerIndex, ambientIndex) : "";

function has(pattern) { return pattern.test(src); }

check("remaining interiors/dungeon access marker exists", markerIndex >= 0, "Missing HARTHMERE_REMAINING_INTERIORS_AND_DUNGEON_ACCESS_V1");
check("no new actors are added in remaining-interiors block", markerIndex >= 0 && !block.includes("A("), "Found A( actor placement inside remaining-interiors block");

const interiorGroups = [
  ["Player Services has bank, mail, auction, guild, wardrobe, waiting interiors", /bank teller desk[\s\S]*Mail sorting interior table[\s\S]*Auction escrow interior counter[\s\S]*Guild registrar charter desk[\s\S]*Cosmetic wardrobe cabinet[\s\S]*waiting bench/i],
  ["Copper Kettle has kitchen, pantry, rented room, cellar, hearth interiors", /kitchen prep table[\s\S]*pantry rack[\s\S]*rented room bed[\s\S]*cellar hatch[\s\S]*hearth bench/i],
  ["Craftsman Row has smith, carpenter, tailor, leather, alchemy interiors", /repair order table[\s\S]*floor anvil[\s\S]*Carpenter drafting table[\s\S]*Tailor cutting table[\s\S]*Leather drying rack[\s\S]*Alchemy prep shelf/i],
  ["Noble Rise has hearing, legal archive, office, treasury, servant corridor", /public hearing table[\s\S]*legal archive bookcase[\s\S]*Court docket[\s\S]*Reeve private office[\s\S]*Tax treasury chest[\s\S]*Servant side corridor bench/i],
  ["Temple has nave, infirmary, charity, gravekeeper, undercroft interiors", /Chapel nave pew row one left[\s\S]*Chapel infirmary cot[\s\S]*Charity office donation table[\s\S]*Gravekeeper tool cabinet[\s\S]*Chapel Undercroft Test Entrance/i],
  ["River Docks has warehouse office, customs, fish shelf, ferry staging interiors", /Warehouse office desk[\s\S]*Warehouse cargo manifest[\s\S]*Customs inspection counter[\s\S]*Cold fish shelf[\s\S]*Ferry ticket table[\s\S]*Rope and oar rack/i],
  ["Mudden Ward has individual homes, washhouse, clinic, fence, tunnel access interiors", /Mudden Lean-To Home sleeping pallet[\s\S]*Mudden Poorhouse second sleeping pallet[\s\S]*Mudden washhouse folding table[\s\S]*Cheap healer interior remedy table[\s\S]*Fence vendor hidden goods table[\s\S]*Old Well Drain Test Entrance/i],
  ["Guard Yard has bunks, mess, armory, duty board interiors", /Guard Barracks bunk one[\s\S]*Guard Barracks mess table[\s\S]*uniform cabinet[\s\S]*Guard armory weapon rack[\s\S]*Duty board roster/i],
  ["North Gate stable has tack, lead rope, feed permit, cabinet interiors", /stable tack ledger table[\s\S]*Stable lead rope coil[\s\S]*Mount feed and travel permit ledger[\s\S]*Stable tack cabinet/i],
];

for (const [label, pattern] of interiorGroups) {
  check(label, has(pattern), `Missing pattern: ${pattern}`);
}

const routeSteps = [
  "Dungeon route step 01 Chapel Undercroft Test Entrance",
  "Dungeon route step 02 Old Well Drain Test Entrance",
  "Dungeon route step 03 Bellward Halls Debug Start",
  "Dungeon route step 04 First Choir Arena threshold",
  "Dungeon route step 05 Old Harth Antechamber threshold",
  "Dungeon route step 06 Bellbinder Tomb corridor",
  "Dungeon route step 07 Bellward Chamber True Bell threshold",
  "Dungeon route step 08 Wyrm's Bed final chamber threshold",
];

const missingRoutes = routeSteps.filter((needle) => !src.includes(needle));
check("dungeon has explicit ordered test-access route markers", missingRoutes.length === 0, missingRoutes);

check("Bellward debug start has torch and route placard", has(/Bellward Halls Debug Start torch mounted[\s\S]*Dungeon testing route placard supported/i));

const pLines = block.split(/\r?\n/).filter((line) => /\bP\("/.test(line));
check("remaining interiors block adds enough no-NPC interior/dungeon placements", pLines.length >= 100, `found ${pLines.length}`);

const badElevated = pLines.filter((line) =>
  /GROUND_Y\s*\+\s*(?:0\.[4-9]|1\.)/.test(line) &&
  !/(supported|mounted|against|inside|beside|on floor|set into|floor|wall|bracket|table|desk|counter|stand|rack|cabinet|shelf|channel|leaning)/i.test(line)
);
check("new elevated props describe believable support", badElevated.length === 0, badElevated);

const forbidden = pLines.filter((line) => /townsperson|animal_|npc_|dragon_actor|boss_actor|hostile_/i.test(line));
check("remaining interiors block does not sneak NPC, animal, boss, or hostile actors into P placements", forbidden.length === 0, forbidden);

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
