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

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  if (open === -1) return "";
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

const metrics = functionBody(runtime, "harthmereRuntimeFaceShapeMetricsV15");
const sideProfile = functionBody(runtime, "harthmereRuntimeFaceSideProfile");
const head = functionBody(runtime, "createHarthmereRuntimeVoxelHead");
const targetCenter = functionBody(runtime, "getHarthmereRuntimeLicensedClothingTargetCenterV18");

check("face metrics helper exists", metrics.length > 0);
check("face metrics helper uses face parameter", metrics.includes("face.faceShape"));
check("face metrics helper does not use appearance", !metrics.includes("appearance."));

check("side profile uses scoped face for faceShape", sideProfile.includes("face.faceShape"));
check("side profile does not call metrics with appearance.face", !sideProfile.includes("harthmereRuntimeFaceShapeMetricsV15(appearance.face)"));

check("voxel head uses scoped face for face-shape conditions", head.includes("face.faceShape"));
check("voxel head calls metrics with scoped face", head.includes("harthmereRuntimeFaceShapeMetricsV15(face)"));
check("voxel head does not call metrics with appearance.face", !head.includes("harthmereRuntimeFaceShapeMetricsV15(appearance.face)"));

check("licensed clothing target center has no appearance reference", !targetCenter.includes("appearance."));
check("licensed clothing target center does not call face shape metrics", !targetCenter.includes("harthmereRuntimeFaceShapeMetricsV15("));

check("no direct old failing call remains anywhere",
  !runtime.includes("harthmereRuntimeFaceShapeMetricsV15(appearance.face).height"));

check("no stale free faceShapeMetricsV15 property references remain",
  !runtime.includes("faceShapeMetricsV15.width") &&
  !runtime.includes("faceShapeMetricsV15.height") &&
  !runtime.includes("faceShapeMetricsV15.jaw"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
