#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

const required = [
  "Dawn Loaf Bakery",
  "Brindle Provision House",
  "Player Services Hall",
  "Black Anvil Smithy",
  "Carpenter and Tailor Workshop",
  "Green Mortar Apothecary",
  "Wyrm and Candle Magic Shop",
  "Copper Kettle Inn",
  "Reeve Hall",
  "Dock Ledger Warehouse",
  "Mudden Lean-To Home",
  "Mudden Wash House",
  "Roadside Family Cottage",
  "Guard Barracks",
  "Stable Yard Office",
  "Chapel of Saint Verena",
];

check("v43 version marker exists", src.includes("HARTHMERE_SERVICE_BUILDING_BLOCK_REBUILD_VERSION_V43"));
check("block-built service generator exists", src.includes("createHarthmereBlockBuiltServiceBuildingV43"));
for (const name of required) {
  check(
    `${name} uses block-built v43 generator`,
    src.includes(`createHarthmereBlockBuiltServiceBuildingV43({ name: "${name}"`),
  );
}

for (const name of required.filter((n) => n !== "Chapel of Saint Verena")) {
  check(
    `${name} no longer uses direct shell-only placement`,
    !src.includes(`createBuildingShell({ name: "${name}"`),
  );
}

check("no old direct chapel iso body placement", !src.includes('P("obj_church_iso"'));
check("no old direct chapel blue roof placement", !src.includes('P("obj_church_roof_blue"'));
check("no service shell still uses WOOD_THEME", !/createBuildingShell\(\{[^\n]*theme:\s*WOOD_THEME/.test(src));
check("no service shell still uses POOR_THEME", !/createBuildingShell\(\{[^\n]*theme:\s*POOR_THEME/.test(src));
check("no service shell still uses DOCK_THEME", !/createBuildingShell\(\{[^\n]*theme:\s*DOCK_THEME/.test(src));

process.exit(ok ? 0 : 1);
