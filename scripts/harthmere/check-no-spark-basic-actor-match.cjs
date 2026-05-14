#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const checks = [
  [
    "src/client/game/renderers/local_dev/harthmere_assets.ts",
    [
      "harthmere-no-spark-basic-actor-match-v11",
      "harthmere-no-spark-basic-physical-sanitize",
      "harthmere-no-spark-basic-debug-extra",
      "harthmereNoSparkBasic",
      "effectKind",
      "vfxKind",
      "detail.targetOffset !== undefined && detail.targetOffset !== null",
    ],
  ],
  [
    "src/client/components/challenges/LocalDevHarthmereCombat.tsx",
    [
      "harthmere-no-spark-basic-actor-match-v11",
      "harthmere-no-spark-basic-event-marker",
      "harthmerePhysicalAttack",
      "harthmereEventAttackerClipPriority",
      "effectKind: harthmerePhysicalAttack",
      "vfxKind: harthmerePhysicalAttack",
    ],
  ],
];

let ok = true;

for (const [rel, needles] of checks) {
  const full = path.join(root, rel);
  console.log(`\n${rel}`);
  if (!fs.existsSync(full)) {
    console.log("  MISSING FILE");
    ok = false;
    continue;
  }

  const text = fs.readFileSync(full, "utf8");
  for (const needle of needles) {
    const found = text.includes(needle);
    console.log(`  ${found ? "OK" : "MISSING"} ${needle}`);
    if (!found) ok = false;
  }
}

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
