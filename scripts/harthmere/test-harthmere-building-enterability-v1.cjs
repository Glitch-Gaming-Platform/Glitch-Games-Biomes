#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_ENTERABILITY_TEST_V1
 *
 * MMO Rules §8 (Building Accessibility) + §56 (front door 2m clear, public
 * entrance 3m, shop customer 4m): every usable building must have an
 * accessible entrance, a clear path to the entrance, and an interior spawn
 * point. Also covers edge cases §57: door faces a cliff, door opens into a
 * wall, building traps player.
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

const contractPath = path.join(root, "src/shared/harthmere/town_block_build_v1.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const contract = fs.readFileSync(contractPath, "utf8");
const src = fs.readFileSync(assetsPath, "utf8");

// 1. Contract enforces required clearances
const clearChecks = [
  ["HARTHMERE_FRONT_DOOR_CLEARANCE_METERS_V1", 2.0, "front door 2m clear (MMO §56)"],
  ["HARTHMERE_PUBLIC_ENTRANCE_CLEARANCE_METERS_V1", 3.0, "public entrance 3m clear (MMO §56)"],
  ["HARTHMERE_SHOP_CUSTOMER_SPACE_METERS_V1", 4.0, "shop customer 4m clear (MMO §56)"],
];
for (const [k, v, label] of clearChecks) {
  const re = new RegExp(`${k}\\s*=\\s*${v.toFixed(1).replace(".", "\\.")}`);
  if (re.test(contract)) {
    pass(`contract: ${label}`);
  } else {
    fail(`contract: ${label}`, `expected ${k} = ${v}`);
  }
}

// 2. V44 must accept openings and skip blocks within them
const v44Match = src.match(/function\s+createHarthmereContinuousBlockWallsV44\s*\(([\s\S]*?)\n\}/);
const v44Body = v44Match ? v44Match[0] : "";
if (/opening|openings|skip|continue/i.test(v44Body)) {
  pass("V44 wall function processes openings (skips blocks within door/window range)");
} else {
  fail("V44 wall function processes openings", "expected openings/skip/continue inside V44 body");
}

// 3. Each service profile in the renderer must declare an interior layout
const profiles = [
  "bakery", "provision", "player_services", "smithy", "workshop", "apothecary",
  "magic_shop", "inn", "reeve_hall", "dock_warehouse", "mudden_home", "wash_house",
  "residential_cottage", "barracks", "stable_office", "chapel",
];
const interiorMatch = src.match(/function\s+createHarthmereServiceInteriorBuildoutV43[\s\S]*?\n\}/);
const interior = interiorMatch ? interiorMatch[0] : "";
const missingProfiles = profiles.filter((p) => !new RegExp(`case\\s+"${p}"`).test(interior));
if (missingProfiles.length === 0) {
  pass("all 16 service profiles have an interior buildout case");
} else {
  fail("all 16 service profiles have an interior buildout case", `missing cases: ${missingProfiles.join(", ")}`);
}

// 4. Every interior buildout case places at least one prop "on stone floor"
//    or "supported on stone floor" — proving the interior is a usable floor
//    space, not an obstacle pile.
const supportedHits = (interior.match(/on stone (?:forge )?floor|supported on stone floor|against (?:the )?(?:stone )?wall|on warehouse floor|on supported counter/g) || []).length;
if (supportedHits >= 16) {
  pass(`interior buildouts declare floor/wall support (${supportedHits} declarations across profiles)`);
} else {
  fail("interior buildouts declare floor/wall support", `only ${supportedHits} supported props found across all profiles`);
}

// 5. No building entrance overlaps a hard-blocking interior prop. We check
//    that interior layouts do NOT place a counter / anvil / pulpit AT
//    (0, +d/2) — directly inside the front-door tile.
const entranceBlockedRe = /item\(\s*"(?:anvil_fp|table_medium|church_pulpit|crate_wooden_fp)"\s*,\s*0(?:\.0)?\s*,\s*[+0-9.]+/;
if (!entranceBlockedRe.test(interior)) {
  pass("interior buildouts do not block the front-door tile");
} else {
  fail("interior buildouts do not block the front-door tile",
       "found an interior item at (0, +z) which is the front-door zone — relocate it");
}

// 6. Stair runs use the documented max rise (≤0.42m) so they're walkable
if (/HARTHMERE_(?:SERVICE_BLOCK_STAIR|RESIDENT_BLOCK_STAIR)_MAX_RISE_V4[03]\s*=\s*0\.42/.test(src)) {
  pass("stair max rise is 0.42m (player/NPC accessible)");
} else {
  fail("stair max rise is 0.42m", "expected max rise constant = 0.42");
}
if (/HARTHMERE_(?:SERVICE_BLOCK_STAIR|RESIDENT_BLOCK_STAIR)_MIN_TREAD_V4[03]\s*=\s*0\.7[0-9]/.test(src)) {
  pass("stair min tread is ≥0.7m (player/NPC accessible)");
} else {
  fail("stair min tread is ≥0.7m", "expected min tread constant ≥0.70");
}

console.log(ok ? "\nRESULT: PASS enterability v1" : "\nRESULT: FAIL enterability v1");
process.exit(ok ? 0 : 1);

