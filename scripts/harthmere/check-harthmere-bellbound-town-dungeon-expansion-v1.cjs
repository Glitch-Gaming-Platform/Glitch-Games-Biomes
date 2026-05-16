#!/usr/bin/env node
"use strict";
/* HARTHMERE_BELLBOUND_TOWN_DUNGEON_EXPANSION_TEST_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) {
  console.log(`OK ${label}`);
}
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const items = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const item of items.filter(Boolean).slice(0, 80)) {
    console.log(`  - ${item}`);
  }
}

console.log("== Harthmere Bellbound town/building/dungeon expansion tests v1 ==");
console.log(`Root: ${root}`);
console.log("");

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const src = fs.readFileSync(assetsPath, "utf8");
const marker = "// HARTHMERE_BELLBOUND_TOWN_DUNGEON_EXPANSION_V1";
const markerIndex = src.indexOf(marker);
if (markerIndex >= 0) {
  pass("Bellbound town/dungeon expansion marker exists");
} else {
  fail("Bellbound town/dungeon expansion marker exists", "Missing HARTHMERE_BELLBOUND_TOWN_DUNGEON_EXPANSION_V1");
}

const ambientIndex = src.indexOf("// Ambient NPCs and animals", markerIndex);
const block = markerIndex >= 0 && ambientIndex > markerIndex ? src.slice(markerIndex, ambientIndex) : "";

function checkPattern(label, pattern) {
  if (pattern.test(src)) pass(label);
  else fail(label, `Missing ${pattern}`);
}

if (markerIndex >= 0 && !block.includes("A(")) pass("no new actors are added in the Bellbound expansion block");
else fail("no new actors are added in the Bellbound expansion block", "Found A( actor placement inside expansion block");

checkPattern("chapel archive has Halene letters and Verenine annals", /Halene Letter Seven[\s\S]*Verenine Annals floor-map volume/);
checkPattern("chapel cellar has buried bell pit and hidden door", /buried bell pit[\s\S]*Bronze listening plate mounted on hidden undercroft door/i);
checkPattern("Reeve Hall has bridge-crack planning table", /Bridge crack planning table[\s\S]*Bell-shaped bridge crack parchment/i);
checkPattern("Black Anvil has bell-casting bay and Bellbinder's Voice workbench", /Bell-casting anvil block[\s\S]*Bellbinder's Voice handbell supported on tuning workbench/i);
checkPattern("Wyrm and Candle magic shop has Bellbinder lore shelf", /Wyrm and Candle Bellbinder shelf[\s\S]*Open bell-tone spellbook/i);
checkPattern("Dock warehouse has interior cargo-contract table", /Dock Ledger Warehouse cargo-contract table[\s\S]*Ferry schedule and sealed cargo contract/i);

const chamberNames = [
  "Chamber of Aevith",
  "Chamber of Karag-Drath",
  "Chamber of Vyrenia",
  "Chamber of Murvath",
  "Chamber of Sylenne",
  "Chamber of Korruthax",
];
const missingChambers = chamberNames.filter((name) => !src.includes(name));
if (missingChambers.length === 0) pass("Bellward Halls has all six Bellward prayer chambers");
else fail("Bellward Halls has all six Bellward prayer chambers", missingChambers);

checkPattern("Bellward Halls has central hub and Listening Chamber", /Bellward Halls central pillar[\s\S]*Listening Chamber blue light shaft/i);
checkPattern("Old Harth antechamber has sarcophagus and Memory Stone", /Old Harth antechamber sarcophagus[\s\S]*Memory Stone suspended over Old Harth sarcophagus/i);
checkPattern("Veins of the Wyrm has Pulse, Echo, and Spine hall proxies", /Pulse Hall dragon-vein glow[\s\S]*Echo Hall phase-safe essence pool[\s\S]*Spine Hall rib wall/i);
checkPattern("Bellbinder Tomb has six regalia plinths", /Bellbinder Stole regalia[\s\S]*Bellbinder Hammer regalia[\s\S]*Bellbinder Tuning Fork regalia[\s\S]*Bellbinder Handbell regalia[\s\S]*Bellbinder Chain regalia[\s\S]*Bellbinder Ring seal regalia/i);
checkPattern("Bellward Chamber and Wyrm's Bed are staged", /True Bell hanging in Bellward Chamber[\s\S]*Wyrm's Bed bronze-stone snout silhouette[\s\S]*Wyrm's Bed final threshold wall/i);

const pLines = block.split(/\r?\n/).filter((line) => /\bP\("/.test(line));
if (pLines.length >= 70) pass("expansion adds enough non-NPC building/interior/dungeon placements");
else fail("expansion adds enough non-NPC building/interior/dungeon placements", `found ${pLines.length}`);

const badFloatingTiny = pLines.filter((line) =>
  /(scroll|book|candle|bell|wand|key|fragment|fishbone|banner|mine_gold_fragment|shield_round_color)/i.test(line) &&
  /GROUND_Y\s*\+\s*(?:0\.[4-9]|1\.)/.test(line) &&
  !/(supported|mounted|hanging|against|on floor|set into floor|floor channel|suspended|anchor|pit|rim|plinth|shelf|table|wall|ceiling)/i.test(line)
);
if (badFloatingTiny.length === 0) pass("new elevated/tiny props declare believable support");
else fail("new elevated/tiny props declare believable support", badFloatingTiny);

const coordFailures = [];
const placementRe = /P\(\s*"([^"]+)"\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,/g;
let m;
while ((m = placementRe.exec(block))) {
  const asset = m[1];
  const x = Number(m[2]);
  const z = Number(m[3]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
  if (x < 330 || x > 660 || z < -345 || z > -70) {
    coordFailures.push(`${asset} at ${x},${z}`);
  }
}
if (coordFailures.length === 0) pass("new town/dungeon placements stay inside authored town envelope");
else fail("new town/dungeon placements stay inside authored town envelope", coordFailures);

const npcAssetLeak = pLines.filter((line) => /townsperson_|animal_/.test(line));
if (npcAssetLeak.length === 0) pass("expansion does not sneak NPC/animal assets into P placements");
else fail("expansion does not sneak NPC/animal assets into P placements", npcAssetLeak);

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
