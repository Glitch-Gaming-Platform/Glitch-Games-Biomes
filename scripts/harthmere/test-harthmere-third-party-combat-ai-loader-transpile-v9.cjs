#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const libPath = path.join(root, "scripts/harthmere/harthmere-third-party-combat-ai-test-lib-v1.cjs");
const sourcePath = path.join(root, "src/shared/harthmere/third_party_combat_ai_v1.ts");

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

check("third-party combat AI source exists", fs.existsSync(sourcePath));
check("test loader exists", fs.existsSync(libPath));

const loaderText = fs.readFileSync(libPath, "utf8");
const sourceText = fs.readFileSync(sourcePath, "utf8");

check("combat AI source still uses TypeScript const assertions", sourceText.includes("as const"));
check("test loader transpiles TypeScript before vm execution", loaderText.includes("transpileModule(source"));
check("test loader uses CommonJS output for sandbox exports", loaderText.includes("module: ts.ModuleKind.CommonJS"));

const testLib = require(libPath);
testLib.assertContracts(root);
testLib.assertBehaviorTreeAndFSM(root);
testLib.assertUtilityMovement(root);
testLib.assertAdapterAvailability(root);
testLib.assertNavigationPerception(root);
testLib.assertEndToEnd(root);
testLib.assertProductionHardening(root);

if (!ok || process.exitCode) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
