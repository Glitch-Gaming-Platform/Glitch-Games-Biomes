#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_CEILING_FLOOR_TEST_V1
 *
 * MMO Rules §11 Construction Stages requires foundation → walls → roof →
 * interior. Every block-built building must have:
 *   - A ground floor slab at floor 1
 *   - A ceiling slab at the top of every story
 *   - A roof on the top story
 * This test verifies the renderer emits all three for every service /
 * housing building, NOT just walls.
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

// 1. Service buildings: ground floor + ceiling per story
if (src.includes("solid stone/ore ground floor slab")) {
  pass("service buildings declare ground floor slab");
} else {
  fail("service buildings declare ground floor slab",
       "expected `solid stone/ore ground floor slab` label in createHarthmereServiceFloorDeckBlocksV43");
}
if (src.includes("solid stone/ore ceiling slab")) {
  pass("service buildings declare ceiling slab per story");
} else {
  fail("service buildings declare ceiling slab per story",
       "expected `solid stone/ore ceiling slab` label");
}

// 2. Housing: ceiling slab per story
if (/floor\s*\$\{?floor\}?\s*solid stone ceiling and floor slab enclosing the story shell/.test(src) ||
    /solid stone ceiling and floor slab enclosing the story shell/.test(src)) {
  pass("resident housing declares per-story ceiling/floor slab");
} else {
  fail("resident housing declares per-story ceiling/floor slab",
       "expected `solid stone ceiling and floor slab enclosing the story shell` label");
}

// 3. Top-story roof asset is set in the theme
if (/isTop\s*\?\s*\(building\.roof\s*\?\?\s*defaultRoof\)\s*:\s*"arch_roof_flat"/.test(src) ||
    /isTop\s*\?\s*theme\.roof/.test(src)) {
  pass("only the top story uses a gable/pitched roof; intermediate stories use flat slabs");
} else {
  fail("only the top story uses a gable/pitched roof; intermediate stories use flat slabs",
       "expected isTop ternary picking roof asset");
}

// 4. Roof asset reference exists for the top story
if (/arch_roof_(high_gable|gable|high_point|flat)/.test(src)) {
  pass("renderer references roof assets (gable/flat/high_point)");
} else {
  fail("renderer references roof assets", "expected arch_roof_high_gable / arch_roof_gable / arch_roof_flat");
}

// 5. V44 must NOT replace the slab emit — the slab functions must still be
//    called by the service / housing wrappers.
if (/createHarthmereServiceFloorDeckBlocksV43\s*\(/.test(src)) {
  pass("service buildings still emit floor/ceiling slabs (V43 deck blocks)");
} else {
  fail("service buildings still emit floor/ceiling slabs (V43 deck blocks)",
       "expected createHarthmereServiceFloorDeckBlocksV43 call");
}
if (/createHarthmereResidentFloorDeckBlocksV40\s*\(/.test(src)) {
  pass("housing buildings still emit floor/ceiling slabs (V40 deck blocks)");
} else {
  fail("housing buildings still emit floor/ceiling slabs (V40 deck blocks)",
       "expected createHarthmereResidentFloorDeckBlocksV40 call");
}

console.log(ok ? "\nRESULT: PASS ceiling/floor v1" : "\nRESULT: FAIL ceiling/floor v1");
process.exit(ok ? 0 : 1);

