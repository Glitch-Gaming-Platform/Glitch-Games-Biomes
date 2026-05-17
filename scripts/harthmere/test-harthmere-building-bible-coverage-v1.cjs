#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_BIBLE_COVERAGE_TEST_V1
 *
 * Asserts that every building named in the Harthmere story bible is placed
 * in the renderer via createHarthmereBlockBuiltServiceBuildingV43 or the
 * V40 housing equivalent. Reads the required manifest from the shared
 * contract module so the bible coverage list is single-source-of-truth.
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

if (!fs.existsSync(contractPath)) {
  fail("contract module exists", contractPath);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("contract module exists");

const contract = fs.readFileSync(contractPath, "utf8");
const src = fs.readFileSync(assetsPath, "utf8");

// Extract { name: "..." , district: "...", floors: N, bible: "..." } entries
const entryRe = /\{\s*name:\s*"([^"]+)",\s*district:\s*"([^"]+)",\s*profile:\s*"([^"]+)",\s*floors:\s*(\d+),\s*bible:\s*"([^"]+)"\s*\}/g;
const required = [];
let m;
while ((m = entryRe.exec(contract))) {
  required.push({ name: m[1], district: m[2], profile: m[3], floors: Number(m[4]), bible: m[5] });
}
if (required.length >= 20) {
  pass(`contract lists ${required.length} bible-required buildings`);
} else {
  fail("contract lists at least 20 bible-required buildings", `found ${required.length}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}

const missing = [];
const present = [];
for (const r of required) {
  // floors:0 entries are plazas/landmarks, not enclosed buildings — skip enclosure check
  if (r.floors === 0) {
    if (src.includes(r.name)) {
      pass(`bible landmark referenced: ${r.name} (${r.bible})`);
    } else {
      fail(`bible landmark referenced: ${r.name} (${r.bible})`, "expected name to appear somewhere in the renderer");
      missing.push(r.name);
    }
    continue;
  }
  const escapedName = r.name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  // Match either service or housing wrapper. Both end up using V44 walls.
  const re = new RegExp(
    "(?:createHarthmereBlockBuiltServiceBuildingV43|createHarthmereBlockBuiltHousingPlacementsV40)" +
      "[\\s\\S]{0,30}name:\\s*\"" + escapedName + "\"",
    "i",
  );
  const altRe = new RegExp("name:\\s*\"" + escapedName + "\"", "i");
  if (re.test(src)) {
    pass(`bible building present and block-built: ${r.name} (${r.bible})`);
    present.push(r.name);
  } else if (altRe.test(src)) {
    fail(`bible building present and block-built: ${r.name} (${r.bible})`,
         `name is in the source but NOT inside a createHarthmereBlockBuilt* call — building is decorative only`);
    missing.push(r.name);
  } else {
    fail(`bible building present and block-built: ${r.name} (${r.bible})`, "not found in renderer");
    missing.push(r.name);
  }
}

if (missing.length === 0) {
  pass(`all ${required.length} bible-required buildings are block-built`);
} else {
  fail(`all ${required.length} bible-required buildings are block-built`,
       `missing or non-block-built: ${missing.join(", ")}`);
}

// Cross-check: each building has a district per MMO Rules §3 District Rules
const districtSet = new Set(required.map((r) => r.district));
const districtsInRenderer = [];
for (const d of districtSet) {
  if (src.includes(`district: "${d}"`) || src.includes(`"${d}"`)) {
    districtsInRenderer.push(d);
  }
}
if (districtsInRenderer.length === districtSet.size) {
  pass(`all ${districtSet.size} bible districts referenced by buildings`);
} else {
  fail(`all ${districtSet.size} bible districts referenced by buildings`,
       `missing districts: ${[...districtSet].filter((d) => !districtsInRenderer.includes(d)).join(", ")}`);
}

console.log(ok ? "\nRESULT: PASS bible building coverage v1" : "\nRESULT: FAIL bible building coverage v1");
process.exit(ok ? 0 : 1);

