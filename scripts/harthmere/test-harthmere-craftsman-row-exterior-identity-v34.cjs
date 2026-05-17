#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const legacyCheck = path.join(root, "scripts/harthmere/check-harthmere-craftsman-row-black-anvil-v1.cjs");
const src = fs.readFileSync(assetsPath, "utf8");
const suite = fs.readFileSync(suitePath, "utf8");

let failed = 0;
function ok(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
    if (detail) console.log(`  - ${detail}`);
  }
}

console.log("== Harthmere Craftsman Row exterior identity v34 ==");
console.log(`Root: ${root}`);
console.log("");

const bannerLabel = "Black Anvil red forge banner beside smithy entrance mounted on wall bracket";
const westLampLabel = "Craftsman Row forge glow lamp west of smithy";
const eastLampLabel = "Craftsman Row forge glow lamp east of smithy";

const bannerIndex = src.indexOf(bannerLabel);
const westLampIndex = src.indexOf(westLampLabel);
const eastLampIndex = src.indexOf(eastLampLabel);

ok("forge banner keeps legacy-readable identity phrase and support language", bannerIndex >= 0);
ok("west forge lamp remains placed outside the smithy", westLampIndex >= 0);
ok("east forge lamp remains placed outside the smithy", eastLampIndex >= 0);
ok(
  "forge banner and lamps remain ordered for legacy Craftsman Row check",
  bannerIndex >= 0 && westLampIndex > bannerIndex && eastLampIndex > westLampIndex,
  `banner=${bannerIndex}, west=${westLampIndex}, east=${eastLampIndex}`
);
ok(
  "old v34-breaking banner wording is gone",
  !src.includes("Black Anvil red forge banner mounted beside smithy entrance wall bracket")
);
ok(
  "banner still declares physical wall support instead of floating",
  /Black Anvil red forge banner beside smithy entrance mounted on wall bracket/.test(src)
);

if (fs.existsSync(legacyCheck)) {
  const legacy = spawnSync(process.execPath, [legacyCheck, root], { encoding: "utf8" });
  ok("legacy Black Anvil Craftsman Row check passes", legacy.status === 0, legacy.stdout + legacy.stderr);
} else {
  ok("legacy Black Anvil Craftsman Row check exists", false, legacyCheck);
}

ok(
  "town placement suite includes v34 Craftsman Row exterior identity regression",
  suite.includes('"test-harthmere-craftsman-row-exterior-identity-v34.cjs"') ||
    suite.includes("'test-harthmere-craftsman-row-exterior-identity-v34.cjs'")
);

if (failed) {
  console.log(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
