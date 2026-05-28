#!/usr/bin/env node
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(process.argv[2] || process.cwd());

const scripts = [
  "scripts/harthmere/test-biomes-ui-vitals-v193.cjs",
  "scripts/harthmere/test-biomes-ui-replacement-edge-cases-v1.cjs",
  "scripts/harthmere/test-biomes-ui-full-replacement-readiness-v1.cjs",
];

let failed = false;

for (const script of scripts) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(process.execPath, [script, root], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) failed = true;
}

if (process.env.BIOMES_UI_BROWSER_URL || process.env.BIOMES_UI_RUN_BROWSER_SMOKE === "1") {
  console.log("\n=== scripts/harthmere/test-biomes-ui-browser-smoke-v1.cjs ===");
  const args = ["scripts/harthmere/test-biomes-ui-browser-smoke-v1.cjs"];
  if (process.env.BIOMES_UI_BROWSER_URL) args.push(process.env.BIOMES_UI_BROWSER_URL);

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) failed = true;
} else {
  console.log("\nSkipped live browser smoke. To run it:");
  console.log("BIOMES_UI_RUN_BROWSER_SMOKE=1 node scripts/harthmere/test-biomes-ui-all-v1.cjs .");
  console.log("or set BIOMES_UI_BROWSER_URL=http://localhost:3000/at/Local%20Biomes%20Player");
}

if (failed) {
  console.error("\nFAIL Biomes UI test gate failed. Do not call replacement mode complete yet.");
  process.exit(1);
}

console.log("\nPASS Biomes UI test gate passed.");
