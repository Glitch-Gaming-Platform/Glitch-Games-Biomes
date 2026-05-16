#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_DUNGEON_COMPLETION_COMPAT_FIXES_TEST_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  for (const line of String(detail || "").split("\n").filter(Boolean).slice(0, 80)) {
    console.log(`  - ${line}`);
  }
}
function check(label, condition, detail) { condition ? pass(label) : fail(label, detail); }

console.log("== Harthmere building/dungeon completion compatibility fixes tests v1 ==");
console.log(`Root: ${root}`);
console.log("");

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const src = fs.readFileSync(assetsPath, "utf8");

check("compat marker exists", src.includes("HARTHMERE_BUILDING_DUNGEON_COMPLETION_COMPAT_FIXES_V1"), "Missing compat marker");
check("Green Mortar mixing table has been moved clear of Wyrm and Candle doorway", /Green Mortar mortar mixing table on floor clear of Wyrm and Candle doorway approach/.test(src), "Missing moved Green Mortar table wording");
check("old blocking Green Mortar mixing table coordinate is gone", !/P\("table_long", 515\.8, -158\.0, 0, 0\.30, "Green Mortar mortar mixing table on floor"/.test(src), "Old blocking Green Mortar table still exists");
check("River Dock Supply ground lamp is not elevated", !/River Dock Supply fog lantern grounded beside shop counter", "River Docks", GROUND_Y \+ 0\.12\)/.test(src), "Ground lamp still has elevated Y");
check("Q11 True Bell has explicit ceiling chain bracket support wording", /Q11 Bellward Chamber True Bell supported by ceiling chain bracket/.test(src), "Missing Q11 True Bell support wording");
check("old True Bell unsupported wording is gone", !/Q11 Bellward Chamber True Bell suspended from ceiling chain supports/.test(src), "Old True Bell wording still exists");

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
