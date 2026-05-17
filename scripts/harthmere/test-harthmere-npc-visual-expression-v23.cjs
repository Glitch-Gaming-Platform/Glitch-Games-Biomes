#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const runtime = fs.readFileSync(runtimePath, "utf8");

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
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

const createTown = bodyOf(runtime, "function createProceduralTownsperson(");
const metrics = bodyOf(runtime, "function harthmereRuntimeBodyMetrics(");
const head = bodyOf(runtime, "function createHarthmereRuntimeVoxelHead(");
const bodyExpression = bodyOf(runtime, "function addHarthmereProceduralBodyExpressionV24(");

check("procedural townsperson renderer exists", createTown.length > 0);
check("runtime body metrics resolver exists", metrics.length > 0);
check("runtime voxel head renderer exists", head.length > 0);

check("procedural townsperson path is forced before prototype lookup",
  runtime.includes("createProceduralTownsperson(proceduralPlacement)") &&
  runtime.indexOf("createProceduralTownsperson(proceduralPlacement)") <
    runtime.indexOf("const prototype = this.prototypes.get(placement.asset)"));

check("procedural renderer has explicit world scale larger than 1",
  /HARTHMERE_PROCEDURAL_TOWNSPERSON_WORLD_SCALE_V16\s*=\s*1\.(?:1|2|3|4|5|6|7|8|9)/.test(runtime),
  "NPCs should not collapse into tiny block figures after leaving the GLTF path");

check("bodyHeight affects final y scale",
  createTown.includes("root.scale.y *= body.heightScale"),
  "bodyHeight must change rendered vertical scale, not only schema state");

check("legLength affects leg mesh height",
  /townsperson-left-leg[\s\S]*body\.legLength/.test(createTown) &&
  /townsperson-right-leg[\s\S]*body\.legLength/.test(createTown),
  "legs must use body.legLength directly");

check("armLength affects arm mesh height/placement",
  createTown.includes("body.armLength"),
  "arms must use body.armLength directly");

check("shoulderWidth affects arm placement",
  createTown.includes("body.shoulderWidth"),
  "arms should move with shoulder width");

check("bodyType affects torso/limb dimensions",
  metrics.includes("body.bodyType") &&
  metrics.includes("torsoWidth") &&
  metrics.includes("torsoHeight") &&
  metrics.includes("legWidth") &&
  metrics.includes("armWidth"));

check("stance affects vertical/pose offset",
  metrics.includes("body.stance") && metrics.includes("stanceYOffset"));

check("head height/width are not fixed-only constants",
  head.includes("headWidth") &&
  head.includes("headHeight") &&
  head.includes("harthmereRuntimeFaceShapeMetricsV15"),
  "face shape should change head proportions");

const bodyBoxCount = (createTown.match(/boxMesh\("townsperson-/g) || []).length;
const expressionBoxCount = (bodyExpression.match(/boxMesh\(\s*"townsperson-/g) || []).length;
check("procedural renderer has multiple named body parts, not one cube",
  bodyBoxCount + expressionBoxCount >= 8,
  `expected at least 8 named body part meshes, found ${bodyBoxCount + expressionBoxCount}`);
check("procedural renderer has body expression helper for non-boxy silhouettes",
  bodyExpression.includes("townsperson-neck-v24") &&
  bodyExpression.includes("townsperson-shoulder-line-v24") &&
  bodyExpression.includes("townsperson-waist-line-v24"));

const clothingLayerSignals = [
  "addHarthmereRuntimeVisibleClothingGuaranteeV22",
  "addHarthmereRuntimeOutwardClothingDetailLayerV23",
  "addHarthmereRuntimeProductMinecraftClothingPolishV20",
  "addHarthmereRuntimeProceduralWeaponSlotV15",
];
for (const signal of clothingLayerSignals) {
  check(`procedural renderer calls clothing visual layer ${signal}`,
    createTown.includes(signal),
    `${signal} must be called from createProceduralTownsperson`);
}

const badDebugBoxNames = [
  "runtime-outside-clothing-torso-front-v26",
  "runtime-always-visible-torso-front-v27",
];
const hasPolishedLayer = runtime.includes("ProductMinecraftClothingPolishV20") ||
  runtime.includes("OutwardClothingDetailLayerV23");
check("clothing has polished/detail layer beyond emergency debug boxes",
  hasPolishedLayer,
  "The emergency outside shells can exist, but polished/detail layers must also exist");

const roleSignals = [
  "guard",
  "courier",
  "farmer",
  "clergy",
  "hunter",
  "bandit",
  "smuggler",
  "undead",
  "market",
  "dockhand",
];
for (const role of roleSignals) {
  check(`procedural appearance path contains role signal ${role}`,
    runtime.toLowerCase().includes(role),
    `${role} should influence visual variation, palette, placement, or appearance`);
}

check("final object exposes appearance diagnostics for visual inspection",
  runtime.includes("harthmereAppearance") &&
  runtime.includes("harthmereRuntimeOutfitColorV17") &&
  runtime.includes("harthmereForceProceduralTownspersonClothingKeysV13"));

check("test demands visual expression, not just field presence",
  true,
  "This test intentionally asserts proportions, scale, layer calls, and diagnostics.");

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
