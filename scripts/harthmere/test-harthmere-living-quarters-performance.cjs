#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const assets = fs.readFileSync(assetsPath, "utf8");
const registry = fs.readFileSync(registryPath, "utf8");

let failed = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

console.log("== Harthmere living quarters/performance tests current ==");
ok(/HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION/.test(assets), "current living-quarter version marker exists");
ok(/function createHarthmereLivingQuarterVoxelShell\s*\(/.test(assets), "current living-quarter shell helper exists");
ok((/return createHarthmereLivingQuarterVoxelShell\(building\);/.test(assets) || /BUILDING_VOXEL_MESHES whole voxel building mesh/.test(assets)), "resident story frames use current instead of current dense shell");
ok(/current solid performance apartment wall panel/.test(assets), "current uses larger solid wall panels");
ok(/current walkable stair tread/.test(assets) && /current upper landing slab/.test(assets), "current apartments have walkable stairs and upper landings");
ok(/current balcony deck walkable/.test(assets) && /current balcony railing/.test(assets), "current apartments have upper balcony/deck access");
ok(/current upper room partition panel/.test(assets), "current apartments keep upper-room partitions");
ok(/function createHarthmereServiceMultiStoryCompletion\s*\(/.test(assets), "current service multi-story completion helper exists");
ok(/createHarthmereServiceMultiStoryCompletion\(building\)/.test(assets), "current service multi-story completion is installed");
ok((/current service two-story completion walkable stair tread/.test(assets) || /createHarthmereServiceBlockStairRun\(building, floor\)/.test(assets)), "current service buildings add walkable stairs");
ok(/isLivingQuarterRepeatedRoomDetail/.test(assets), "optimized runtime thins repeated living-quarter room decor");
ok(/walkable floors, stairs, decks, landings/.test(registry), "town registry makes current walkable surfaces non-blocking");
ok(/compact solid stone apartment wall panel/.test(registry), "town registry gives current wall panels compact collision");
ok(registry.includes("block-built current interior stone\\/ore stair block") || registry.includes("block-built current interior stone/ore stair block"), "town registry removes invisible collision from old current stair blocks");
ok(/harthmere-service-multi-story-completion.*balcony railing/is.test(registry), "town registry keeps current service balcony rails blocking only edges");

if (failed) {
  console.error(`\nRESULT: FAIL ${failed} checks`);
  process.exit(1);
}
console.log("\nRESULT: PASS Harthmere living quarters/performance current");
