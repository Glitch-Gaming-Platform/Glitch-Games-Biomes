#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failed = 0;
function check(label, condition, details) {
  if (condition) console.log(`OK ${label}`);
  else { failed += 1; console.log(`FAIL ${label}`); if (details) console.log(Array.isArray(details) ? details.slice(0, 40).join("\n") : details); }
}
console.log("== Harthmere building asset-size/rules regression tests v52 ==");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const housingPath = path.join(root, "src/shared/harthmere/resident_housing_v38.ts");
const assets = fs.readFileSync(assetsPath, "utf8");
const housing = fs.existsSync(housingPath) ? fs.readFileSync(housingPath, "utf8") : "";
const stairRefCount = (assets.match(/HARTHMERE_STONE_STAIR_VOXEL_BLOCK_V50/g) || []).length;
check("stone stair voxel constant is either unused or defined", stairRefCount === 0 || /const HARTHMERE_STONE_STAIR_VOXEL_BLOCK_V50\s*=/.test(assets), `references=${stairRefCount}`);
check("living-quarter stairs use solid stacked stone with support blocks", /stair support block/.test(assets) && /solid stacked stone no floating/.test(assets) && /mine_stone_01/.test(assets));
check("resident floors, ceilings, walls, and partitions are block-built stone/ore resources", /createHarthmereLivingQuarterV49FloorAndCeiling/.test(assets) && /arch_roof_flat/.test(assets) && /arch_wall_stone/.test(assets) && /interior partition wall/.test(assets));
check("upper floors remain accessible through doors, balcony deck, and walkable stair/landing labels", /front door overlay floor/.test(assets) && /balcony deck floor/.test(assets) && /upper landing slab/.test(assets) && /entry step walkable/.test(assets));
check("residential/slum housing definitions still request multi-story access", /HARTHMERE_RESIDENTIAL_HOUSE_BUILDINGS_V38/.test(housing) && /HARTHMERE_SLUM_STACK_BUILDINGS_V38/.test(housing) && /floors/.test(housing));
check("measured asset dimensions do not replace the solid-voxel building shell system", /createHarthmereResidentStoryFrameV38/.test(assets) && /createHarthmereLivingQuarterVoxelShellV49/.test(assets));
console.log(`RESULT: ${failed === 0 ? "PASS" : `FAIL (${failed})`}`);
process.exit(failed === 0 ? 0 : 1);
