#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const builderPath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const schemaPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");

const runtime = fs.readFileSync(runtimePath, "utf8");
const builder = fs.existsSync(builderPath) ? fs.readFileSync(builderPath, "utf8") : "";
const schema = fs.readFileSync(schemaPath, "utf8");

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

const loadAllBody = bodyOf(runtime, "private async loadAll()");
const proceduralPlacementBody = bodyOf(runtime, "private addHarthmereProceduralLifePlacement(");
const createTownBody = bodyOf(runtime, "function createProceduralTownsperson(");
const metricsBody = bodyOf(runtime, "function harthmereRuntimeBodyMetrics(");
const headBody = bodyOf(runtime, "function createHarthmereRuntimeVoxelHead(");
const outfitTintBody = bodyOf(runtime, "function harthmereRuntimeOutfitTintForBody(");
const legTintBody = bodyOf(runtime, "function harthmereRuntimeLegTintForBody(");

const faceFields = [
  "skinTone", "faceShape", "eyeShape", "eyeColor", "browStyle", "noseStyle",
  "mouthStyle", "hairStyle", "hairColor", "facialHair", "cheekStyle", "accessory",
];

const geometryBodyFields = [
  "bodyType", "bodyHeight", "shoulderWidth", "armLength", "legLength", "stance",
];

const colorBodyFields = ["outfitColor"];

const clothingSlots = [
  "head", "face", "torso", "legs", "hands", "feet", "back", "belt", "weapon", "shield",
];

const proceduralIndex = loadAllBody.indexOf("this.addHarthmereProceduralLifePlacement(placement)");
const prototypeIndex = loadAllBody.indexOf("const prototype = this.prototypes.get(placement.asset)");
const prototypeGuardIndex = loadAllBody.indexOf("if (prototype && !isProceduralTownspersonKey(placement.asset))");

check("procedural townsperson path is not blocked by prototype path",
  proceduralIndex >= 0 && prototypeIndex >= 0 && proceduralIndex < prototypeIndex,
  `proceduralIndex=${proceduralIndex}, prototypeIndex=${prototypeIndex}`);
check("prototype path refuses townsperson assets", prototypeGuardIndex >= 0);
check("procedural branch uses effective defaultScale before creation",
  proceduralPlacementBody.includes("const proceduralPlacement =") &&
  proceduralPlacementBody.includes("scale: placement.scale ?? assetByKey.get(placement.asset)?.defaultScale ?? 1"));
check("procedural branch registers metadata with proceduralPlacement",
  proceduralPlacementBody.includes("registerHarthmerePlacementInstance(proceduralPlacement"));
check("procedural townsperson has explicit world scale knob",
  runtime.includes("HARTHMERE_PROCEDURAL_TOWNSPERSON_WORLD_SCALE"));
check("procedural townsperson applies world scale and metric-based bodyHeight",
  createTownBody.includes("HARTHMERE_PROCEDURAL_TOWNSPERSON_WORLD_SCALE") &&
  metricsBody.includes("contract.bodyHeight[body.bodyHeight]") &&
  metricsBody.includes("heightDelta") &&
  metricsBody.includes("const torsoHeight") &&
  metricsBody.includes("const legLength") &&
  createTownBody.includes("harthmereBodyHeightScaleAppliedToMetrics") &&
  !createTownBody.includes("root.scale.y *= body.heightScale"));

check("faceShape helper is defined", runtime.includes("harthmereRuntimeFaceShapeMetrics"));
check("faceShape no longer references missing local variable",
  !runtime.includes("faceShapeMetrics.width") &&
  !runtime.includes("faceShapeMetrics.height") &&
  !runtime.includes("faceShapeMetrics.jaw"));
check("runtime head uses faceShape directly", (headBody.includes("face.faceShape") || (headBody.includes("face.faceShape") || headBody.includes("appearance.face.faceShape"))));
check("runtime head uses face shape metrics helper", (headBody.includes("harthmereRuntimeFaceShapeMetrics(face)") || (headBody.includes("harthmereRuntimeFaceShapeMetrics(face)") || headBody.includes("harthmereRuntimeFaceShapeMetrics(appearance.face)"))));

for (const field of faceFields) {
  check(`shared schema has face field ${field}`, schema.includes(field));
  check(`procedural head uses face field ${field}`,
    headBody.includes(`face.${field}`) || headBody.includes(`appearance.face.${field}`),
    `${field} should change the procedural face/head`);
}

for (const field of geometryBodyFields) {
  check(`shared schema has geometry body field ${field}`, schema.includes(field));
  check(`runtime geometry path uses body field ${field}`,
    metricsBody.includes(`body.${field}`) ||
    createTownBody.includes(`body.${field}`) ||
    createTownBody.includes(`appearance.body.${field}`),
    `${field} should change procedural body metrics or geometry`);
}

for (const field of colorBodyFields) {
  check(`shared schema has color body field ${field}`, schema.includes(field));
  check(`runtime color path uses body field ${field}`,
    outfitTintBody.includes(`appearance.body.${field}`) ||
    legTintBody.includes(`appearance.body.${field}`) ||
    createTownBody.includes(`appearance.body.${field}`),
    `${field} should change procedural visible colors`);
}

check("bodyHeight affects rendered leg/torso metrics instead of root y scale",
  metricsBody.includes("heightScale") &&
  metricsBody.includes("heightDelta") &&
  metricsBody.includes("const torsoHeight") &&
  metricsBody.includes("const legLength") &&
  createTownBody.includes("harthmereBodyHeightScaleAppliedToMetrics") &&
  !createTownBody.includes("root.scale.y *= body.heightScale"));
check("armLength affects townsperson arm geometry", createTownBody.includes("body.armLength"));
check("legLength affects townsperson leg geometry", createTownBody.includes("body.legLength"));
check("shoulderWidth affects arm placement", createTownBody.includes("body.shoulderWidth"));
check("bodyType affects torso/body metrics", metricsBody.includes("body.bodyType"));
check("outfitColor affects direct body/leg tint", 
  createTownBody.includes("outfitTint") && createTownBody.includes("legTint") &&
  runtime.includes("harthmereRuntimeOutfitColor"));

for (const slot of clothingSlots) {
  check(`shared schema/catalog includes clothing slot ${slot}`,
    schema.includes(`"${slot}"`) || schema.includes(`'${slot}'`) || schema.includes(`${slot}:`));
  check(`runtime has procedural coverage for clothing slot ${slot}`,
    runtime.includes(`clothing?.${slot}`) ||
    runtime.includes(`clothing.${slot}`) ||
    runtime.includes(`appearance.clothing.${slot}`) ||
    runtime.includes(`"${slot}"`) ||
    runtime.includes(`'${slot}'`),
    `${slot} must be represented in procedural clothing code`);
}

if (builder) {
  for (const field of [...faceFields, ...geometryBodyFields, ...colorBodyFields]) {
    check(`builder contains field ${field}`, builder.includes(field));
  }
  for (const slot of clothingSlots) {
    check(`builder/schema contains clothing slot ${slot}`,
      builder.includes(`"${slot}"`) || builder.includes(`'${slot}'`) ||
      schema.includes(`"${slot}"`) || schema.includes(`'${slot}'`));
  }
}

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
