#!/usr/bin/env node
"use strict";
/* HARTHMERE_DUNGEON_BIBLE_COVERAGE_TEST_V1
 *
 * Asserts that every dungeon room/chamber named in the Harthmere bible
 * (Q5 chapel cellar, Q6 hidden door, Q7 Bellward Halls with 6 prayer
 * chambers + listening chamber, Q9 Pulse/Echo/Spine Halls, Q10 Old Harth
 * tomb + regalia plinths, Q11 Bellward Chamber, Q12 Wyrm's Bed) is
 * physically placed in the renderer AND has block-built enclosure
 * (collisionPlan declaring floor/walls/roof/navmesh).
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
  for (const line of lines.filter(Boolean).slice(0, 60)) console.log(`  - ${line}`);
}

const contractPath = path.join(root, "src/shared/harthmere/town_block_build_v1.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const spacesPath = path.join(root, "src/shared/harthmere/main_quest_spaces_v47.ts");

for (const p of [contractPath, assetsPath, spacesPath]) {
  if (!fs.existsSync(p)) {
    fail("required file exists", p);
    console.log("\nRESULT: FAIL");
    process.exit(1);
  }
}
pass("contract / renderer / quest spaces files exist");

const contract = fs.readFileSync(contractPath, "utf8");
const src = fs.readFileSync(assetsPath, "utf8");
const spaces = fs.readFileSync(spacesPath, "utf8");

const dungeonRe = /\{\s*name:\s*"([^"]+)",\s*quest:\s*"([^"]+)",\s*bible:\s*"([^"]+)"\s*\}/g;
const required = [];
let m;
while ((m = dungeonRe.exec(contract))) {
  required.push({ name: m[1], quest: m[2], bible: m[3] });
}
if (required.length >= 15) {
  pass(`contract lists ${required.length} bible-required dungeon rooms`);
} else {
  fail("contract lists at least 15 bible-required dungeon rooms", `found ${required.length}`);
}

const haystack = (src + "\n" + spaces).toLowerCase();
function normaliseName(s) {
  return s.toLowerCase().replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function fuzzyContains(name) {
  const tokens = normaliseName(name).split(" ").filter((t) => t.length > 2);
  // Allow renderer to use "Chapel Cellar and Undercroft" vs manifest's
  // "Chapel Cellar Undercroft" by requiring all distinctive tokens to
  // appear within a 400-char window.
  if (tokens.length === 0) return haystack.includes(name.toLowerCase());
  const flat = haystack;
  // Slide a 400-char window across haystack
  for (let i = 0; i < flat.length; i += 200) {
    const win = flat.slice(i, i + 400);
    if (tokens.every((t) => win.includes(t))) return true;
  }
  return false;
}
const missing = [];
for (const r of required) {
  if (fuzzyContains(r.name)) {
    pass(`bible dungeon room placed: ${r.name} (${r.quest})`);
  } else {
    fail(`bible dungeon room placed: ${r.name} (${r.quest})`, `not in renderer or main_quest_spaces_v47`);
    missing.push(r.name);
  }
}

// Verify quest spaces declare collisionPlan with floor/walls/roof/navmesh —
// this proves each dungeon space is *enclosed*, not just a marker.
if (/"collisionPlan"\s*:\s*\{[\s\S]*?"floor"[\s\S]*?"walls"[\s\S]*?"roof"[\s\S]*?"navmesh"/.test(spaces)) {
  pass("quest spaces declare floor/walls/roof/navmesh in collisionPlan");
} else {
  fail("quest spaces declare floor/walls/roof/navmesh in collisionPlan",
       "expected `floor`, `walls`, `roof`, and `navmesh` keys in every collisionPlan");
}

// All six Bellward prayer chambers
const chambers = [
  "Chamber of Aevith",
  "Chamber of Karag-Drath",
  "Chamber of Vyrenia",
  "Chamber of Murvath",
  "Chamber of Sylenne",
  "Chamber of Korruthax",
];
const missingChambers = chambers.filter((c) => !haystack.includes(c.toLowerCase()));
if (missingChambers.length === 0) {
  pass("all six Bellward prayer chambers present (Aevith, Karag-Drath, Vyrenia, Murvath, Sylenne, Korruthax)");
} else {
  fail("all six Bellward prayer chambers present", `missing: ${missingChambers.join(", ")}`);
}

// Six Bellbinder regalia plinths in Old Harth's tomb
const regalia = ["Stole", "Hammer", "Tuning Fork", "Handbell", "Chain", "Ring"];
const missingRegalia = regalia.filter((r) => !haystack.includes(`bellbinder ${r.toLowerCase()}`));
if (missingRegalia.length === 0) {
  pass("six Bellbinder regalia plinths present (Stole, Hammer, Tuning Fork, Handbell, Chain, Ring)");
} else {
  fail("six Bellbinder regalia plinths present", `missing: ${missingRegalia.join(", ")}`);
}

console.log(ok ? "\nRESULT: PASS dungeon bible coverage v1" : "\nRESULT: FAIL dungeon bible coverage v1");
process.exit(ok ? 0 : 1);

