#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_WALL_CONTINUITY_TEST_V1
 *
 * Validates that the renderer emits continuous block-built walls instead of
 * sparse decorative panels with multi-meter gaps. Verifies:
 *   1. The shared contract module exists with the V1 marker.
 *   2. The renderer declares createHarthmereContinuousBlockWallsV44.
 *   3. The wall-emit function loops over a per-tile step <= 1.2m.
 *   4. createBuildingShell delegates wall generation to the V44 function,
 *      not to the legacy sparse ±hw*0.48 placement pattern.
 *   5. The legacy sparse pattern is gone (or fenced off behind the V44 path).
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

if (!fs.existsSync(contractPath)) {
  fail("contract module exists", contractPath);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("contract module exists");

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", assetsPath);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const contractSrc = fs.readFileSync(contractPath, "utf8");
const assetsSrc = fs.readFileSync(assetsPath, "utf8");

// 1. Contract version marker
if (contractSrc.includes("HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1") &&
    contractSrc.includes("harthmere-town-block-build-v1")) {
  pass("contract module declares V1 version marker");
} else {
  fail("contract module declares V1 version marker", "missing HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1 = 'harthmere-town-block-build-v1'");
}

// 2. Contract MAX_GAP guarantee
if (/HARTHMERE_BLOCK_MAX_GAP_METERS_V1\s*=\s*1\.2/.test(contractSrc)) {
  pass("contract enforces max gap 1.2m");
} else {
  fail("contract enforces max gap 1.2m", "expected `HARTHMERE_BLOCK_MAX_GAP_METERS_V1 = 1.2`");
}

// 3. Renderer declares the V44 wall function
const v44Re = /function\s+createHarthmereContinuousBlockWallsV44\s*\(/;
if (v44Re.test(assetsSrc)) {
  pass("renderer declares createHarthmereContinuousBlockWallsV44");
} else {
  fail("renderer declares createHarthmereContinuousBlockWallsV44", "expected `function createHarthmereContinuousBlockWallsV44(`");
}

// 4. The V44 function body must contain a per-tile loop and a max step <= 1.2
const v44BodyMatch = assetsSrc.match(/function\s+createHarthmereContinuousBlockWallsV44\s*\(([\s\S]*?)\n\}/);
const v44Body = v44BodyMatch ? v44BodyMatch[0] : "";
if (v44Body && /for\s*\([^)]*\)/.test(v44Body)) {
  pass("V44 body uses a for-loop to emit blocks");
} else {
  fail("V44 body uses a for-loop to emit blocks", "expected a for-loop iterating per tile");
}

// step <= 1.0 is the default tile; we accept any literal <= 1.2
const stepLiterals = (v44Body.match(/(?:step|tile|HARTHMERE_BLOCK_TILE_METERS_V1)\s*[:=]\s*([0-9]*\.?[0-9]+)/g) || [])
  .map((m) => Number(m.replace(/.*?([0-9]*\.?[0-9]+)$/, "$1")));
const hasTileImport = /HARTHMERE_BLOCK_TILE_METERS_V1/.test(v44Body) || /\btile\s*=\s*1(?:\.0)?\b/.test(v44Body);
if (hasTileImport || stepLiterals.some((s) => s > 0 && s <= 1.2)) {
  pass("V44 step size <= 1.2m (or uses HARTHMERE_BLOCK_TILE_METERS_V1)");
} else {
  fail("V44 step size <= 1.2m", `step literals seen: ${stepLiterals.join(", ") || "<none>"}`);
}

// 5. createBuildingShell must delegate to V44
const shellBodyMatch = assetsSrc.match(/function\s+createBuildingShell\s*\([^)]*\)\s*:\s*RuntimePlacement\[\]\s*\{([\s\S]*?)\n\}/);
const shellBody = shellBodyMatch ? shellBodyMatch[1] : "";
if (shellBody && /createHarthmereContinuousBlockWallsV44\s*\(/.test(shellBody)) {
  pass("createBuildingShell delegates walls to V44");
} else {
  fail("createBuildingShell delegates walls to V44", "expected createHarthmereContinuousBlockWallsV44(...) call inside createBuildingShell");
}

// 6. Legacy sparse pattern must be gone from createBuildingShell.
//    The previous code placed walls at ±hw*0.48 / ±hw*0.45 with at most 12
//    individual BP() calls. Verify those literal offsets no longer dominate.
const sparseOffsets = shellBody ? (shellBody.match(/hw\s*\*\s*0\.4[58]/g) || []) : [];
if (sparseOffsets.length === 0) {
  pass("legacy sparse hw*0.48/hw*0.45 wall offsets are gone from createBuildingShell");
} else {
  fail("legacy sparse hw*0.48/hw*0.45 wall offsets are gone from createBuildingShell",
       `still found ${sparseOffsets.length} sparse offsets in createBuildingShell body`);
}

// 7. The renderer must import or reference the shared contract version
if (assetsSrc.includes("HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1") ||
    assetsSrc.includes("harthmere-town-block-build-v1")) {
  pass("renderer references shared block-build V1 contract");
} else {
  fail("renderer references shared block-build V1 contract",
       "expected HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1 or 'harthmere-town-block-build-v1' marker in renderer");
}

console.log(ok ? "\nRESULT: PASS wall continuity v1" : "\nRESULT: FAIL wall continuity v1");
process.exit(ok ? 0 : 1);

