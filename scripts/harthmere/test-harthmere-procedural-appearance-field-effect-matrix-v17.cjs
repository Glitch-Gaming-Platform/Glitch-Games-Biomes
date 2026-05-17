#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtime = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");

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

const metricsBody = bodyOf(runtime, "function harthmereRuntimeBodyMetrics(");
const headBody = bodyOf(runtime, "function createHarthmereRuntimeVoxelHead(");
const createTownBody = bodyOf(runtime, "function createProceduralTownsperson(");
const outfitTintBody = bodyOf(runtime, "function harthmereRuntimeOutfitTintForBodyV17(");
const legTintBody = bodyOf(runtime, "function harthmereRuntimeLegTintForBodyV17(");

const expectedBodyEffects = [
  ["bodyType", metricsBody, ["torsoWidth", "torsoHeight", "legWidth", "armWidth"]],
  ["bodyHeight", metricsBody + createTownBody, ["heightScale", "root.scale.y"]],
  ["shoulderWidth", metricsBody + createTownBody, ["shoulderWidth", "body.shoulderWidth"]],
  ["armLength", metricsBody + createTownBody, ["armLength", "body.armLength"]],
  ["legLength", metricsBody + createTownBody, ["legLength", "body.legLength"]],
  ["stance", metricsBody, ["stanceYOffset", "body.stance"]],
  ["outfitColor", outfitTintBody + legTintBody + createTownBody, ["appearance.body.outfitColor", "outfitTintV17", "legTintV17"]],
];

for (const [field, source, requiredSignals] of expectedBodyEffects) {
  check(`body field ${field} has direct runtime effect source`, source.includes(field), `${field} missing from effect source`);
  for (const signal of requiredSignals) {
    check(`body field ${field} effect includes ${signal}`, source.includes(signal), `${field} should include ${signal}`);
  }
}

const expectedFaceEffects = [
  ["skinTone", ["skin"]],
  ["faceShape", ["harthmereRuntimeFaceShapeMetricsV15"]],
  ["eyeShape", ["face.eyeShape"]],
  ["eyeColor", ["face.eyeColor"]],
  ["browStyle", ["face.browStyle"]],
  ["noseStyle", ["face.noseStyle"]],
  ["mouthStyle", ["face.mouthStyle"]],
  ["hairStyle", ["face.hairStyle"]],
  ["hairColor", ["face.hairColor"]],
  ["facialHair", ["face.facialHair"]],
  ["cheekStyle", ["face.cheekStyle"]],
  ["accessory", ["face.accessory"]],
];

for (const [field, signals] of expectedFaceEffects) {
  for (const signal of signals) {
    check(`face field ${field} effect includes ${signal}`, headBody.includes(signal), `${field} should include ${signal}`);
  }
}

const expectedOutfitColors = ["earth", "forest", "river", "ember", "royal", "ash"];
for (const color of expectedOutfitColors) {
  check(`outfitColor switch handles ${color}`, outfitTintBody.includes(`"${color}"`) || outfitTintBody.includes(`case '${color}'`));
}

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
