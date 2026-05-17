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

const expression = bodyOf(runtime, "function addHarthmereProceduralBodyExpressionV24(");
const createTown = bodyOf(runtime, "function createProceduralTownsperson(");

check("procedural body expression helper exists", expression.length > 0);
check("procedural townsperson calls body expression helper",
  createTown.includes("addHarthmereProceduralBodyExpressionV24(root, body, palette, outfitTintV17)"));
check("body expression creates neck part", expression.includes('"townsperson-neck-v24"'));
check("body expression creates shoulder line", expression.includes('"townsperson-shoulder-line-v24"'));
check("body expression creates waist line", expression.includes('"townsperson-waist-line-v24"'));
check("body expression neck derives height from available torso metrics",
  expression.includes("expressionHeadHeightV25") && expression.includes("body.torsoHeight"));
check("body expression shoulders respond to shoulderWidth",
  expression.includes("body.shoulderWidth"));
check("body expression waist/torso responds to torsoWidth/torsoHeight",
  expression.includes("body.torsoWidth") && expression.includes("body.torsoHeight"));
check("body expression uses outfit tint", expression.includes("outfitTint"));
check("body expression exposes runtime diagnostics", expression.includes("harthmereProceduralBodyExpressionV24"));

const createBodyPartCount = (createTown.match(/boxMesh\("townsperson-/g) || []).length;
const expressionPartCount = (expression.match(/boxMesh\(\s*"townsperson-/g) || []).length;
check("combined procedural visual body part count is at least eight",
  createBodyPartCount + expressionPartCount >= 8,
  `createTown=${createBodyPartCount}, expression=${expressionPartCount}`);

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
