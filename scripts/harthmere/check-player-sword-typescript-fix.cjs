#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
let failed = false;
function check(ok, label) {
  if (ok) console.log(`OK ${label}`);
  else { failed = true; console.error(`FAIL ${label}`); }
}
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const inv = read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
check(!hud.includes('itemId: selectedItem?.id ?? "iron_longsword"'), "HUD no longer passes branded selectedItem id");
check(hud.includes('itemId: "iron_longsword"'), "HUD sends Harthmere sword item id string");
check(hud.includes('selectedItem?.id can be a branded numeric Biomes id'), "HUD has future-dev comment for item id mapping");
check(inv.includes('const swordLocation: HarthmereStorageLocation'), "inventory sword location is typed");
check(inv.includes('const swordEquipmentSlot: EquipmentSlot | undefined'), "inventory sword equipment slot is typed");
check(inv.includes('const sword: HarthmereItemInstance'), "inventory starter sword object is typed");
check(inv.includes('makeItemInstance("iron_longsword", 1, swordLocation)'), "inventory makeItemInstance uses typed location");
check(!inv.includes('location: state.equipment.main_hand ? "backpack" : "equipment"'), "inventory no longer widens location to string");
if (failed) { console.error("\nRESULT: FAIL"); process.exit(1); }
console.log("\nRESULT: PASS");
