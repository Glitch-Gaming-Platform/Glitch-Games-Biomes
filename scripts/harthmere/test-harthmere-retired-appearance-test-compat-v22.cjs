#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const retired = [
  "test-harthmere-face-shape-scope-and-ts-v18.cjs",
  "test-harthmere-procedural-townsperson-full-feature-coverage-v14.cjs",
  "test-harthmere-character-builder-full-feature-coverage-v14.cjs",
  "test-harthmere-force-procedural-townsperson-clothing-v12.cjs",
];

let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

for (const test of retired) {
  const fullPath = path.join(root, "scripts/harthmere", test);
  check(`${test} exists`, fs.existsSync(fullPath));
  if (fs.existsSync(fullPath)) {
    const source = fs.readFileSync(fullPath, "utf8");
    check(`${test} delegates to newer coverage`, source.includes("Compatibility wrapper"));
  }
}

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
