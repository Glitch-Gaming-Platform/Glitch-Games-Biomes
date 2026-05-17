#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const runtime = fs.readFileSync(runtimePath, "utf8");

let ok = true;
function check(label, condition, detail) {
  if (condition) console.log(`OK ${label}`);
  else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`     ${detail}`);
  }
}

function bodyOf(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) return "";
  const open = source.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

const metrics = bodyOf(runtime, "function harthmereRuntimeBodyMetrics(");
const createTown = bodyOf(runtime, "function createProceduralTownsperson(");
const v27 = bodyOf(runtime, "function addHarthmereRuntimeAlwaysVisibleNpcClothingV27(");
const v26 = bodyOf(runtime, "function addHarthmereRuntimeOutsideClothingShellV26(");
const rounded = bodyOf(runtime, "function makeHarthmereRuntimeRoundedVoxelGeometry(");
const contract = runtime.slice(
  runtime.indexOf("HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26"),
  runtime.indexOf("function harthmereRuntimeBodyMetrics(")
);

check("runtime body metrics type includes depth axes",
  runtime.includes("torsoDepth: number") &&
  runtime.includes("armDepth: number") &&
  runtime.includes("legDepth: number"));

check("v26 option-expression contract includes depth values",
  contract.includes("torsoDepth") && contract.includes("armDepth") && contract.includes("legDepth"));

check("body metrics uses the v26 contract directly",
  metrics.includes("const contract = HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26") &&
  metrics.includes("contract.bodyType[body.bodyType]") &&
  metrics.includes("contract.bodyHeight[body.bodyHeight]") &&
  metrics.includes("contract.shoulderWidth[body.shoulderWidth]") &&
  metrics.includes("contract.armLength[body.armLength]") &&
  metrics.includes("contract.legLength[body.legLength]") &&
  metrics.includes("contract.stance[body.stance]"));

check("body metrics no longer voids the expression contract",
  !metrics.includes("void optionExpressionContractV26"));

check("height is distributed into torso and legs, not root y scale",
  metrics.includes("heightDelta") &&
  metrics.includes("const torsoHeight") &&
  metrics.includes("const legLength") &&
  createTown.includes("harthmereBodyHeightScaleAppliedToMetricsV29") &&
  !createTown.includes("root.scale.y *= body.heightScale"));

check("core procedural body uses width/height/depth metrics",
  createTown.includes("[body.torsoWidth, body.torsoHeight, body.torsoDepth]") &&
  createTown.includes("[body.armWidth, body.armLength, body.armDepth]") &&
  createTown.includes("[body.legWidth, body.legLength, body.legDepth]"));

check("v27 is gated by torso clothing",
  v27.includes("hasTorsoClothing") && v27.includes('skipped: "no-torso-clothing"'));

check("v27 no longer uses sarcophagus dimensions",
  !v27.includes("Math.max(body.torsoWidth + 0.38, 0.72)") &&
  !v27.includes("Math.max(body.torsoHeight + 0.24, 0.82)") &&
  !v27.includes("const torsoDepth = 0.72") &&
  !v27.includes("const frontZ = -0.48") &&
  !v27.includes("const backZ = 0.48"));

check("v27 fitted clothing follows body metrics",
  v27.includes("const torsoWidth = body.torsoWidth + 0.1") &&
  v27.includes("const torsoHeight = body.torsoHeight + 0.06") &&
  v27.includes("const torsoDepth = body.torsoDepth + 0.06") &&
  v27.includes("body.armDepth") &&
  v27.includes("body.legDepth"));

check("v26 no longer uses hard floors/fixed shell offsets",
  !v26.includes("Math.max(body.torsoWidth + 0.32, 0.68)") &&
  !v26.includes("Math.max(body.torsoHeight + 0.2, 0.78)") &&
  !v26.includes("const frontZ = -0.42") &&
  !v26.includes("const backZ = 0.42"));

check("v26 fitted layer follows body depth metrics",
  v26.includes("const torsoDepth = body.torsoDepth + 0.06") &&
  v26.includes("body.armDepth") &&
  v26.includes("body.legDepth"));

check("older visible/detail layers no longer use big Math.max floors",
  !runtime.includes("Math.max(body.torsoHeight + 0.11, 0.66)") &&
  !runtime.includes("Math.max(body.torsoHeight + 0.15, 0.7)") &&
  !runtime.includes("Math.max(body.legLength * 0.92, 0.52)") &&
  !runtime.includes("Math.max(body.legLength * 0.92, 0.5)"));

check("rounded voxel radius is smaller and less blob-like",
  rounded.includes("Math.min(0.012, minEdge * 0.08)") &&
  rounded.includes("const segments = 1"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
