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
const alwaysVisibleClothing = bodyOf(runtime, "function addHarthmereRuntimeAlwaysVisibleNpcClothing(");
const outsideClothingShell = bodyOf(runtime, "function addHarthmereRuntimeOutsideClothingShell(");
const rounded = bodyOf(runtime, "function makeHarthmereRuntimeRoundedVoxelGeometry(");
const contract = runtime.slice(
  runtime.indexOf("HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT"),
  runtime.indexOf("function harthmereRuntimeBodyMetrics(")
);

check("runtime body metrics type includes depth axes",
  runtime.includes("torsoDepth: number") &&
  runtime.includes("armDepth: number") &&
  runtime.includes("legDepth: number"));

check("current option-expression contract includes depth values",
  contract.includes("torsoDepth") && contract.includes("armDepth") && contract.includes("legDepth"));

check("body metrics uses the current contract directly",
  metrics.includes("const contract = HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT") &&
  metrics.includes("contract.bodyType[body.bodyType]") &&
  metrics.includes("contract.bodyHeight[body.bodyHeight]") &&
  metrics.includes("contract.shoulderWidth[body.shoulderWidth]") &&
  metrics.includes("contract.armLength[body.armLength]") &&
  metrics.includes("contract.legLength[body.legLength]") &&
  metrics.includes("contract.stance[body.stance]"));

check("body metrics no longer voids the expression contract",
  !metrics.includes("void optionExpressionContract"));

check("height is distributed into torso and legs, not root y scale",
  metrics.includes("heightDelta") &&
  metrics.includes("const torsoHeight") &&
  metrics.includes("const legLength") &&
  createTown.includes("harthmereBodyHeightScaleAppliedToMetrics") &&
  !createTown.includes("root.scale.y *= body.heightScale"));

check("core procedural body uses width/height/depth metrics",
  createTown.includes("[body.torsoWidth, body.torsoHeight, body.torsoDepth]") &&
  createTown.includes("[body.armWidth, body.armLength, body.armDepth]") &&
  createTown.includes("[body.legWidth, body.legLength, body.legDepth]"));

check("current is gated by torso clothing",
  alwaysVisibleClothing.includes("hasTorsoClothing") && alwaysVisibleClothing.includes('skipped: "no-torso-clothing"'));

check("current no longer uses sarcophagus dimensions",
  !alwaysVisibleClothing.includes("Math.max(body.torsoWidth + 0.38, 0.72)") &&
  !alwaysVisibleClothing.includes("Math.max(body.torsoHeight + 0.24, 0.82)") &&
  !alwaysVisibleClothing.includes("const torsoDepth = 0.72") &&
  !alwaysVisibleClothing.includes("const frontZ = -0.48") &&
  !alwaysVisibleClothing.includes("const backZ = 0.48"));

check("current fitted clothing follows body metrics",
  alwaysVisibleClothing.includes("const torsoWidth = body.torsoWidth + 0.1") &&
  alwaysVisibleClothing.includes("const torsoHeight = body.torsoHeight + 0.06") &&
  alwaysVisibleClothing.includes("const torsoDepth = body.torsoDepth + 0.06") &&
  alwaysVisibleClothing.includes("body.armDepth") &&
  alwaysVisibleClothing.includes("body.legDepth"));

check("current no longer uses hard floors/fixed shell offsets",
  !outsideClothingShell.includes("Math.max(body.torsoWidth + 0.32, 0.68)") &&
  !outsideClothingShell.includes("Math.max(body.torsoHeight + 0.2, 0.78)") &&
  !outsideClothingShell.includes("const frontZ = -0.42") &&
  !outsideClothingShell.includes("const backZ = 0.42"));

check("current fitted layer follows body depth metrics",
  outsideClothingShell.includes("const torsoDepth = body.torsoDepth + 0.06") &&
  outsideClothingShell.includes("body.armDepth") &&
  outsideClothingShell.includes("body.legDepth"));

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
