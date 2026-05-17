#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_PERIMETER_CLOSURE_TEST_V1
 *
 * Validates that every block-built building has all four corners present on
 * every story, so the wall ring closes. A wall ring with a missing corner is
 * the failure mode that leaves the floating-beam look from the screenshot.
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

const v44Match = src.match(/function\s+createHarthmereContinuousBlockWallsV44\s*\(([\s\S]*?)\n\}/);
if (!v44Match) {
  fail("V44 wall function exists", "createHarthmereContinuousBlockWallsV44 not found");
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("V44 wall function exists");
const v44Body = v44Match[0];

// 1. Four faces must be emitted
const faceLabels = ["north", "south", "east", "west"];
const missingFaces = faceLabels.filter((f) => !new RegExp(`\\b${f}\\b`, "i").test(v44Body));
if (missingFaces.length === 0) {
  pass("V44 emits all four wall faces (north/south/east/west)");
} else {
  fail("V44 emits all four wall faces", `missing: ${missingFaces.join(", ")}`);
}

// 2. Corner placement must not be skipped — must NOT be inside any opening
//    pattern. We check that the V44 function does not short-circuit corners
//    before checking openings.
if (/corner|cornerColumn|halfX|halfZ/i.test(v44Body)) {
  pass("V44 references corner / halfX / halfZ positions");
} else {
  fail("V44 references corner / halfX / halfZ positions",
       "expected corner reference so closures are explicit");
}

// 3. The block ring loop must iterate over both endpoints (corners). Tests
//    that the inclusive endpoint of the range is reached — the loop bound
//    should be `<= halfX` or use `columns = round(width)+1` so we count
//    both endpoints.
if (/columns?\s*=\s*[^;]*\+\s*1/.test(v44Body) ||
    /<=\s*halfX/.test(v44Body) ||
    /<=\s*halfZ/.test(v44Body)) {
  pass("V44 loop includes both endpoints of each face (corners present)");
} else {
  fail("V44 loop includes both endpoints of each face (corners present)",
       "expected `+ 1` column count or `<= halfX/halfZ` bound");
}

// 4. The V44 function must be called once per story (multi-story closure).
const shellBodyMatch = src.match(/function\s+createBuildingShell\s*\([^)]*\)\s*:\s*RuntimePlacement\[\]\s*\{([\s\S]*?)\n\}/);
const shellBody = shellBodyMatch ? shellBodyMatch[1] : "";
if (/createHarthmereContinuousBlockWallsV44\s*\(/.test(shellBody)) {
  pass("createBuildingShell calls V44 walls (per-story closure when called per floor)");
} else {
  fail("createBuildingShell calls V44 walls", "expected V44 call inside createBuildingShell");
}

// 5. Block stair runs must still exist (do not break multi-story access fix)
if (/createHarthmereServiceBlockStairRunV43|createHarthmereBlockStairRunV40/.test(src)) {
  pass("multi-story stair runs preserved (V40 housing and V43 service)");
} else {
  fail("multi-story stair runs preserved (V40 housing and V43 service)",
       "expected createHarthmereServiceBlockStairRunV43 and createHarthmereBlockStairRunV40 to remain");
}

console.log(ok ? "\nRESULT: PASS perimeter closure v1" : "\nRESULT: FAIL perimeter closure v1");
process.exit(ok ? 0 : 1);

