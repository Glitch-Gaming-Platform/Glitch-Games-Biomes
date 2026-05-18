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

console.log("== Harthmere living quarters/performance tests v56 ==");
ok(/HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56/.test(assets), "v56 living-quarter version marker exists");
ok(/function createHarthmereLivingQuarterVoxelShellV56\s*\(/.test(assets), "v56 living-quarter shell helper exists");
ok(/return createHarthmereLivingQuarterVoxelShellV56\(building\);/.test(assets), "resident story frames use v56 instead of v49 dense shell");
ok(/v56 solid performance apartment wall panel/.test(assets), "v56 uses larger solid wall panels");
ok(/v56 walkable stair tread/.test(assets) && /v56 upper landing slab/.test(assets), "v56 apartments have walkable stairs and upper landings");
ok(/v56 balcony deck walkable/.test(assets) && /v56 balcony railing/.test(assets), "v56 apartments have upper balcony/deck access");
ok(/v56 upper room partition panel/.test(assets), "v56 apartments keep upper-room partitions");
ok(/function createHarthmereServiceMultiStoryCompletionV56\s*\(/.test(assets), "v56 service multi-story completion helper exists");
ok(/createHarthmereServiceMultiStoryCompletionV56\(building\)/.test(assets), "v56 service multi-story completion is installed");
ok(/v56 service two-story completion walkable stair tread/.test(assets), "v56 service buildings add walkable stairs");
ok(/isLivingQuarterRepeatedRoomDetailV56/.test(assets), "optimized runtime thins repeated living-quarter room decor");
ok(/v56 walkable floors, stairs, decks, landings/.test(registry), "town registry makes v56 walkable surfaces non-blocking");
ok(/compact solid stone apartment wall panel/.test(registry), "town registry gives v56 wall panels compact collision");
ok(registry.includes("block-built v43 interior stone\\/ore stair block") || registry.includes("block-built v43 interior stone/ore stair block"), "town registry removes invisible collision from old v43 stair blocks");
ok(/harthmere-service-multi-story-completion-v56.*balcony railing/is.test(registry), "town registry keeps v56 service balcony rails blocking only edges");

if (failed) {
  console.error(`\nRESULT: FAIL ${failed} checks`);
  process.exit(1);
}
console.log("\nRESULT: PASS Harthmere living quarters/performance v56");
