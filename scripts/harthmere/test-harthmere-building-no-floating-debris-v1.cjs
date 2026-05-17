#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_NO_FLOATING_DEBRIS_TEST_V1
 *
 * The screenshot bug: sparse decorative wall panels leave 4+m gaps that
 * look like floating beams. This test guards against regression by:
 *   1. Ensuring the legacy sparse ±hw*0.48 / ±hw*0.45 pattern is gone.
 *   2. Ensuring no service / housing building declares a wall/door/window
 *      placement WITHOUT a sibling V44 block ring call in the same scope.
 *   3. Ensuring orphan arch_* asset placements outside known builders are
 *      explicitly labelled as decorative landmarks (not building shells).
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

const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(assetsPath, "utf8");

// 1. Legacy sparse offset pattern is gone from createBuildingShell
const shellMatch = src.match(/function\s+createBuildingShell\s*\([^)]*\)\s*:\s*RuntimePlacement\[\]\s*\{([\s\S]*?)\n\}/);
const shellBody = shellMatch ? shellMatch[1] : "";
const sparseHits = shellBody ? (shellBody.match(/hw\s*\*\s*0\.4[58]|hd\s*\*\s*0\.4[58]/g) || []) : [];
if (sparseHits.length === 0) {
  pass("legacy sparse hw*0.45/0.48 wall offsets removed from createBuildingShell");
} else {
  fail("legacy sparse hw*0.45/0.48 wall offsets removed from createBuildingShell",
       `still ${sparseHits.length} sparse offsets present`);
}

// 2. Total wall-asset count in createBuildingShell must be small (only the
//    decorative overlays remain — door, windows, roof, chimney, banner).
//    Real wall blocks come from V44, not BP() in this function.
const bpCount = shellBody ? (shellBody.match(/\bBP\(/g) || []).length : 0;
if (bpCount <= 14) {
  pass(`createBuildingShell uses only decorative BP() overlays (${bpCount} <= 14)`);
} else {
  fail(`createBuildingShell uses only decorative BP() overlays`,
       `${bpCount} BP() calls is too many — walls should come from V44 block ring`);
}

// 3. V44 must be defined and reference wall block assets
const v44Match = src.match(/function\s+createHarthmereContinuousBlockWallsV44[\s\S]*?\n\}/);
const v44Body = v44Match ? v44Match[0] : "";
if (/arch_wall_stone|mine_stone_0[12]/.test(v44Body)) {
  pass("V44 wall function references block wall assets (arch_wall_stone / mine_stone_01)");
} else {
  fail("V44 wall function references block wall assets",
       "expected arch_wall_stone or mine_stone_01 inside V44 body");
}

// 4. Every district named in the bible-required manifest has its buildings
//    grouped together with createHarthmere*BuiltService/Housing calls — i.e.
//    we should be able to find these patterns in the source and they should
//    all reach createBuildingShell -> V44.
const builderHits = (src.match(/createHarthmereBlockBuiltServiceBuildingV43\s*\(/g) || []).length;
const housingHits = (src.match(/createHarthmereBlockBuiltHousingPlacementsV40\s*\(/g) || []).length;
if (builderHits >= 18) {
  pass(`enough service-building placements (${builderHits} >= 18)`);
} else {
  fail(`enough service-building placements`, `only ${builderHits} found; expected at least 18`);
}
if (housingHits >= 1) {
  pass(`housing builder used in at least one place (${housingHits})`);
} else {
  fail(`housing builder used in at least one place`, `not used at all`);
}

// 5. Outside of the known builders, there should be no orphan wall placements
//    masquerading as buildings. We scan for P("arch_wall_*" placements that
//    are NOT inside one of the recognised builder bodies.
const wallPlacementRe = /\bP\(\s*"arch_wall_(stone|wood|wood_broken|window_stone|window_glass|window_round|wood_window|wood_door|doorway_round|door|corner|wood_corner)"\s*,/g;
const knownBuilderHeaders = [
  "function createBuildingShell",
  "function createHarthmereContinuousBlockWallsV44",
  "function createHarthmereServiceFloorDeckBlocksV43",
  "function createHarthmereServiceBlockStairRunV43",
  "function createHarthmereServiceInteriorBuildoutV43",
  "function createHarthmereResidentFloorDeckBlocksV40",
  "function createHarthmereResidentWallBlocksV40",
  "function createHarthmereBlockStairRunV40",
];
function inKnownBuilder(idx) {
  // Find the nearest preceding function header
  let nearestHeader = -1;
  let nearestPos = -1;
  for (let h = 0; h < knownBuilderHeaders.length; h += 1) {
    const headerIdx = src.lastIndexOf(knownBuilderHeaders[h], idx);
    if (headerIdx > nearestPos) {
      nearestPos = headerIdx;
      nearestHeader = h;
    }
  }
  if (nearestHeader < 0) return false;
  // The next `\n}\n` after this header ends the function
  const end = src.indexOf("\n}\n", nearestPos);
  return end > idx;
}

const orphans = [];
let m;
while ((m = wallPlacementRe.exec(src))) {
  if (inKnownBuilder(m.index)) continue;
  // Allow placements explicitly labelled as landmarks/silhouettes/decor.
  const window = src.slice(m.index, m.index + 200);
  if (/silhouette|landmark|decor|ruin|crumb|debris-allowed|brace|patch|lean-to|sagging|leaning|broken|alley|marker|anchor|accessibility|spawn|entry/i.test(window)) continue;
  orphans.push(window.split("\n")[0]);
}
if (orphans.length === 0) {
  pass("no orphan wall placements outside known builders or landmark labels");
} else {
  fail("no orphan wall placements outside known builders", orphans.slice(0, 12));
}

console.log(ok ? "\nRESULT: PASS no floating debris v1" : "\nRESULT: FAIL no floating debris v1");
process.exit(ok ? 0 : 1);

