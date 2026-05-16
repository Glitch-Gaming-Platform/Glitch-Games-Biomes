#!/usr/bin/env node
"use strict";
/* HARTHMERE_INTERIOR_EXPANSION_REGRESSION_FIXES_TEST_V2 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  for (const item of String(detail || "").split("\n").filter(Boolean).slice(0, 80)) {
    console.log(`  - ${item}`);
  }
}
function check(label, condition, detail) { condition ? pass(label) : fail(label, detail); }

console.log("== Harthmere interior expansion regression fixes tests v2 ==");
console.log(`Root: ${root}`);
console.log("");

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const src = fs.readFileSync(assetsPath, "utf8");

check("unregistered barrel placement was replaced with registered crate/cask asset", !/P\("barrel"/.test(src) && /Cellar ale cask crate/.test(src), "Found P(\"barrel\") or missing Cellar ale cask crate");
check("unregistered cage placement was replaced with registered fence cell asset", !/P\("cage"/.test(src) && /Barracks prisoner holding cell fence/.test(src), "Found P(\"cage\") or missing holding cell fence");
check("Mudden lean-to meal table was moved clear of front-door approach", /Mudden Lean-To Home meal table beside sleeping pallet with clear doorway approach/.test(src), "Missing clear doorway approach wording");
check("Mudden washhouse folding table was moved clear of rat-catcher route", /Mudden washhouse folding table beneath laundry line clear of rat-catcher route/.test(src), "Missing rat-catcher clear route wording");
check("Copper Kettle cellar hatch was moved clear of animal route", /Copper Kettle cellar hatch set into kitchen floor clear of animal route/.test(src), "Missing animal route clear wording");
check("dungeon console teleport helper exists", /HARTHMERE_DUNGEON_CONSOLE_TELEPORT_HELPER_V2/.test(src) && /teleportToDungeonTestTarget/.test(src), "Missing teleport helper marker/function");
check("dungeon console global alias exists", /__harthmereDungeonTest/.test(src), "Missing __harthmereDungeonTest global alias");
check("dungeon console helper exposes Bellward and Wyrm target names", /bellwardHalls[\s\S]*wyrmsBed/.test(src), "Missing bellwardHalls/wyrmsBed targets");
check("dungeon console helper stores localStorage fallback request", /biomes\.localDev\.harthmere\.teleportTarget/.test(src) && /forceDungeonTestTarget/.test(src), "Missing localStorage fallback keys");

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
