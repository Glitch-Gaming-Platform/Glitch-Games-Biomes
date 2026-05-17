#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

check("service buildings have stone theme function", src.includes("harthmereServiceStoneThemeV43"));
check("service structural wall asset is stone", /wall:\s*"arch_wall_stone"/.test(src));
check("service structural door is stone", /door:\s*floor === 1 \? "arch_wall_door" : "arch_wall_stone"/.test(src));
check("service structural corner is stone", /corner:\s*"arch_wall_corner"/.test(src));
check("service buildings generate ground floor slabs", src.includes("solid stone/ore ground floor slab"));
check("service buildings generate ceiling slabs", src.includes("solid stone/ore ceiling slab"));
check("service buildings label enclosed shell", src.includes("solid stone/ore structural wall enclosed service shell"));
check("resident/slum housing no longer picks wood wall blocks", !/function harthmereResidentWallBlockAssetV40[\s\S]*?arch_wall_wood[\s\S]*?function createHarthmereResidentFloorDeckBlocksV40/.test(src));
check("resident/slum housing wall function returns stone/ore", /function harthmereResidentWallBlockAssetV40[\s\S]*mine_stone_01[\s\S]*arch_wall_stone[\s\S]*function createHarthmereResidentFloorDeckBlocksV40/.test(src));
check("resident/slum housing theme uses stone wall", /function harthmereHousingV38Theme[\s\S]*wall:\s*"arch_wall_stone"[\s\S]*door:\s*"arch_wall_door"/.test(src));

process.exit(ok ? 0 : 1);
