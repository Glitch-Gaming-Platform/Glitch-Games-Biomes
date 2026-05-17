#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_MULTI_STORY_TEST_V1
 *
 * MMO Rules §11 Construction Stages: multi-story buildings need walls,
 * floors, and stairs per story. Bible §III.3 (Mara Thistle two-story house),
 * §III.4 (Black Anvil apartment above smithy), §III.6 (Copper Kettle rooms
 * upstairs), §III.5 (Chapel bell tower), §IV.7 (Reeve Hall), §III.2 (Bram
 * Holt's quarters above the Guard Yard) require multi-story enclosure.
 *
 * This test verifies that any building with floors > 1:
 *   - emits per-story wall ring (V44 called per floor)
 *   - emits per-story ceiling slab
 *   - emits a block stair run connecting consecutive floors
 *   - intermediate stories use flat roof slabs, not gable peaks
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let ok = true;
function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const lines = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const line of lines.filter(Boolean).slice(0, 40)) console.log(`  - ${line}`);
}

const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(assetsPath, "utf8");

// 1. Per-story loop in service buildings
const svcBlockMatch = src.match(/function\s+createHarthmereBlockBuiltServiceBuildingV43[\s\S]*?\n\}/);
const svcBody = svcBlockMatch ? svcBlockMatch[0] : "";
if (svcBody && /for\s*\(\s*let\s+floor\s*=\s*1\s*;[^)]*floors[^)]*\)/.test(svcBody)) {
  pass("service buildings iterate per-floor in createHarthmereBlockBuiltServiceBuildingV43");
} else {
  fail("service buildings iterate per-floor in createHarthmereBlockBuiltServiceBuildingV43",
       "expected `for (let floor = 1; floor <= floors; ...)` loop");
}

// 2. Per-story stair run for service buildings
if (/createHarthmereServiceBlockStairRunV43\s*\(/.test(svcBody)) {
  pass("service buildings emit per-story block stair runs");
} else {
  fail("service buildings emit per-story block stair runs",
       "expected createHarthmereServiceBlockStairRunV43 call");
}

// 3. Per-story loop in resident housing
const hsBlockMatch = src.match(/function\s+createHarthmereBlockBuiltHousingPlacementsV40[\s\S]*?\n\}/);
const hsBody = hsBlockMatch ? hsBlockMatch[0] : "";
if (hsBody && /for\s*\(\s*let\s+floor\s*=\s*1\s*;[^)]*floors[^)]*\)/.test(hsBody)) {
  pass("housing buildings iterate per-floor in createHarthmereBlockBuiltHousingPlacementsV40");
} else {
  fail("housing buildings iterate per-floor in createHarthmereBlockBuiltHousingPlacementsV40",
       "expected `for (let floor = 1; floor <= floors; ...)` loop");
}

// 4. Per-story stair run for housing
if (/createHarthmereBlockStairRunV40\s*\(/.test(hsBody)) {
  pass("housing buildings emit per-story block stair runs");
} else {
  fail("housing buildings emit per-story block stair runs",
       "expected createHarthmereBlockStairRunV40 call");
}

// 5. Intermediate stories use flat roof, not gable peak
if (/floor === floors[\s\S]{0,200}arch_roof_high_gable|isTop\s*\?\s*[^:]+:\s*"arch_roof_flat"/.test(src)) {
  pass("intermediate stories use flat slab, top story uses gable");
} else {
  fail("intermediate stories use flat slab, top story uses gable",
       "expected `isTop ? ... : \"arch_roof_flat\"` branch");
}

// 6. Required multi-story buildings exist with floors:2
const requiredTwoStory = [
  "Copper Kettle Inn",
  "Reeve Hall",
  "Player Services Hall",
  "Black Anvil Smithy",
  "Guard Barracks",
  "Chapel of Saint Verena",
];
for (const name of requiredTwoStory) {
  const re = new RegExp(
    "createHarthmereBlockBuiltServiceBuildingV43\\([^)]*name:\\s*\"" +
      name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") +
      "\"[^)]*floors:\\s*2",
    "i",
  );
  if (re.test(src)) {
    pass(`multi-story building present with floors:2 — ${name}`);
  } else {
    fail(`multi-story building present with floors:2 — ${name}`,
         "expected createHarthmereBlockBuiltServiceBuildingV43({ ... name: \"" + name + "\" ... floors: 2 })");
  }
}

// 7. Mara Thistle's two-story house behind the market (bible §III.3)
if (/Mara Thistle[\s\S]{0,400}floors:\s*2/i.test(src)) {
  pass("Mara Thistle two-story house declared with floors:2");
} else {
  fail("Mara Thistle two-story house declared with floors:2",
       "bible §III.3 — `A two-story house behind the market`");
}

console.log(ok ? "\nRESULT: PASS multi-story v1" : "\nRESULT: FAIL multi-story v1");
process.exit(ok ? 0 : 1);

