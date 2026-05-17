#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const v31Path = path.join(root, "scripts/harthmere/test-harthmere-all-interior-building-enterability-v31.cjs");
const designPath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-building-design-v1.cjs");

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
    return;
  }
  failures += 1;
  console.log(`FAIL ${label}`);
  if (detail) {
    const lines = Array.isArray(detail) ? detail : [detail];
    for (const line of lines.slice(0, 30)) console.log(`  - ${line}`);
    if (lines.length > 30) console.log(`  - ... ${lines.length - 30} more`);
  }
}

function read(file) {
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function runNode(label, script) {
  if (!fs.existsSync(script)) {
    check(label, false, `Missing ${script}`);
    return;
  }
  const result = spawnSync(process.execPath, [script, root], { encoding: "utf8", maxBuffer: 1024 * 1024 * 12 });
  check(label, result.status === 0, [result.stdout, result.stderr].filter(Boolean).join("\n").trim());
}

const assets = read(assetsPath);
const suite = read(suitePath);

console.log("== Harthmere interior enterability blocker fixes v32 ==");
console.log(`Root: ${root}`);
console.log("");

check("v32 marker exists", assets.includes("HARTHMERE_INTERIOR_ENTERABILITY_FIX_VERSION_V32"));

const oldBlockers = [
  'P("table_long", 556, -228, 0, 0.8, "Ledger work desk", "Player Services")',
  'P("anvil_log_fp", 524, -232, 0, 0.82, "Log-mounted anvil", "Craftsman Row")',
  'P("table_medium", 503, -228, 0, 0.76, "Carpenter planning table", "Craftsman Row")',
  'P("cabinet", 518.6, -155.8, 3.14159, 0.30, "Green Mortar locked poison cabinet against rear wall", "Apothecary")',
  'P("bed_twin1", 402.4, -157.8, Math.PI / 2, 0.3, "Mudden Lean-To Home sleeping pallet against patched wall", "Mudden Ward")',
  'P("cabinet", 457.0, -212.5, 3.14159, 0.32, "Brindle Provision locked supply cabinet against back wall", "Provision House")',
  'P("dummy_fp", 508, -269, 0, 0.88, "Training dummy", "Guard Yard")',
  'P("dummy_fp", 516, -269, 0, 0.88, "Training dummy", "Guard Yard")',
  'P("rack", 504, -226, 0, 0.68, "Public stocks and justice event marker", "Market Square")',
];
check("old v31-blocking exact placements are gone", oldBlockers.every((needle) => !assets.includes(needle)), oldBlockers.filter((needle) => assets.includes(needle)));

const expectedClearanceLabels = [
  "Ledger work desk wall-aligned clear of Player Services entry aisle",
  "Log-mounted anvil wall-aligned clear of Black Anvil entry aisle",
  "Carpenter planning table wall-aligned clear of workshop entry aisle",
  "Practice shield leather strap job leaning beside rack clear of workshop aisle",
  "Bank teller counter side-aligned clear of Player Services routes",
  "Storage steward counter side-aligned clear of storage access route",
  "Main anvil wall-aligned clear of Black Anvil service routes",
  "Tailoring and weaving table with cloth support clear of workshop service route",
  "Public stocks and justice event marker clear of workshop service route and NPC anchors",
  "Training dummy tucked into barracks rear-left training bay",
  "Training dummy tucked into barracks rear-right training bay",
  "Green Mortar locked poison cabinet against rear wall clear of Wyrm and Candle entry aisle",
  "Brindle Provision locked supply cabinet against back wall clear of customer aisle",
  "Mudden Lean-To Home sleeping pallet against patched rear wall clear of doorway",
  "Mudden Poorhouse second sleeping pallet against shared wall clear of entry aisle",
];
check("v32 explicit clear-lane placements are present", expectedClearanceLabels.every((label) => assets.includes(label)), expectedClearanceLabels.filter((label) => !assets.includes(label)));

runNode("v31 all-interior enterability regression passes after v32 fixes", v31Path);
runNode("town placement and NPC anchor regression still passes after moving blockers", designPath);

check("town placement suite includes v32 regression", suite.includes("test-harthmere-interior-enterability-blocker-fixes-v32.cjs"));

console.log("");
console.log(`RESULT: ${failures === 0 ? "PASS" : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
