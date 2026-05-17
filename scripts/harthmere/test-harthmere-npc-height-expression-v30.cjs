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

check("bodyHeight is read from the option-expression contract",
  metrics.includes("contract.bodyHeight[body.bodyHeight]"));

check("bodyHeight produces a height delta",
  metrics.includes("const heightDelta = height.heightScale - 1"));

check("bodyHeight changes torso height",
  metrics.includes("const torsoHeight") &&
  metrics.includes("bodyType.torsoHeight") &&
  metrics.includes("heightDelta"));

check("bodyHeight changes leg length",
  metrics.includes("const legLength") &&
  metrics.includes("leg.legLength") &&
  metrics.includes("heightDelta"));

check("bodyHeight lightly adjusts arm length for proportion",
  metrics.includes("const armLength") &&
  metrics.includes("arm.armLength") &&
  metrics.includes("heightDelta"));

check("procedural townsperson records height-scale diagnostic",
  createTown.includes("harthmereBodyHeightScaleAppliedToMetricsV29"));

check("procedural townsperson no longer stretches the root on Y",
  !createTown.includes("root.scale.y *= body.heightScale"));

const testFiles = [
  "scripts/harthmere/test-harthmere-npc-visual-expression-v23.cjs",
  "scripts/harthmere/test-harthmere-procedural-body-face-clothing-behavior-v16.cjs",
  "scripts/harthmere/test-harthmere-procedural-appearance-field-effect-matrix-v17.cjs",
];

for (const rel of testFiles) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.log(`SKIP missing ${rel}`);
    continue;
  }
  const source = fs.readFileSync(full, "utf8");
  check(`${rel} no longer positively requires root y scale`,
    !/&&\s*createTown(?:Body)?\.includes\("root\.scale\.y \*= body\.heightScale"\)/.test(source) &&
    !/effect includes root\.scale\.y/.test(source),
    "Tests must validate metric-based height expression, not root stretching");
}

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
