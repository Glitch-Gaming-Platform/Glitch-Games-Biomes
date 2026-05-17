#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const schemaPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");

const runtime = fs.readFileSync(runtimePath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");

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

function blockFrom(source, token, max = 20000) {
  const idx = source.indexOf(token);
  if (idx < 0) return "";
  return source.slice(idx, Math.min(source.length, idx + max));
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

function extractConstValues(source, constName) {
  const idx = source.indexOf(constName);
  if (idx < 0) return [];
  const eq = source.indexOf("=", idx);
  const close = source.indexOf("] as const", eq);
  const altClose = source.indexOf("];", eq);
  const end = close >= 0 ? close : altClose;
  if (eq < 0 || end < 0) return [];
  const block = source.slice(eq, end);
  const values = new Set();
  const stringRegex = /["']([a-zA-Z0-9_-]+)["']/g;
  let match;
  while ((match = stringRegex.exec(block))) {
    values.add(match[1]);
  }
  return [...values];
}

const contract = blockFrom(runtime, "HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26", 12000);
const metrics = bodyOf(runtime, "function harthmereRuntimeBodyMetrics(");
const faceMetrics = bodyOf(runtime, "function harthmereRuntimeFaceShapeMetricsV15(");
const head = bodyOf(runtime, "function createHarthmereRuntimeVoxelHead(");
const bodyExpression = bodyOf(runtime, "function addHarthmereProceduralBodyExpressionV24(");

const optionSources = {
  faceShape: "HARTHMERE_FACE_SHAPES",
  bodyType: "HARTHMERE_BODY_TYPES",
  bodyHeight: "HARTHMERE_BODY_HEIGHTS",
  shoulderWidth: "HARTHMERE_SHOULDER_WIDTHS",
  armLength: "HARTHMERE_ARM_LENGTHS",
  legLength: "HARTHMERE_LEG_LENGTHS",
  stance: "HARTHMERE_BODY_STANCES",
  outfitColor: "HARTHMERE_OUTFIT_COLORS",
};

check("v26 option-expression contract exists", contract.length > 0);
check("body metrics function references v26 option-expression contract",
  metrics.includes("HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26") ||
  metrics.includes("optionExpressionContractV26"));
check("face-shape metrics function references v26 face contract",
  faceMetrics.includes("HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26.faceShape") ||
  faceMetrics.includes("faceShapeExpressionContractV26"));

for (const [field, constName] of Object.entries(optionSources)) {
  const options = extractConstValues(schema, constName);
  check(`${field} has schema options`, options.length > 0);
  for (const option of options) {
    check(`v26 contract/runtime handles ${field}:${option}`,
      contract.includes(`${option}:`) ||
      contract.includes(`"${option}"`) ||
      runtime.includes(`case "${option}"`) ||
      runtime.includes(`case '${option}'`),
      `${field}:${option} must be explicit in the visual-expression contract or runtime branch`);
  }
}

const dynamicFaceFields = [
  "skinTone",
  "eyeShape",
  "eyeColor",
  "browStyle",
  "noseStyle",
  "mouthStyle",
  "hairStyle",
  "hairColor",
  "facialHair",
  "cheekStyle",
  "accessory",
];

for (const field of dynamicFaceFields) {
  check(`runtime head dynamically expresses ${field}`,
    head.includes(`face.${field}`),
    `${field} should be dynamically consumed by the head renderer`);
}

check("body expression does not reference missing body.headHeight",
  !bodyExpression.includes("body.headHeight"));
check("body expression derives neck/head expression from torsoHeight",
  bodyExpression.includes("expressionHeadHeightV25") && bodyExpression.includes("body.torsoHeight"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
