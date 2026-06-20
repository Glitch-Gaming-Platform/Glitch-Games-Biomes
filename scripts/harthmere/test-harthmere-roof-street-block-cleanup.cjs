#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const shimPath = path.join(root, "src/server/shim/main.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite.cjs");

const assets = fs.readFileSync(assetsPath, "utf8");
const shim = fs.readFileSync(shimPath, "utf8");
const suite = fs.readFileSync(suitePath, "utf8");

let failed = 0;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

console.log("== Harthmere roof/street block cleanup current test ==");
check("renderer cleanup current marker exists", assets.includes("HARTHMERE_ROOF_STREET_BLOCK_CLEANUP_VERSION"));
check("renderer has street block predicate", /function shouldRemoveStreetBlockPlacement\(/.test(assets));
check("renderer has roof block predicate", /function shouldRemoveRoofBlockPlacement\(/.test(assets));
check("renderer loose block predicate covers structural blocks", /isHarthmereLooseStreetOrRoofBlockPlacement[\s\S]*arch_\(wall\|pillar\|roof\|stairs\)[\s\S]*solid stone\\\/ore[\s\S]*chimney/.test(assets));
check("renderer cleanup report counts street blocks", /removedStreetBlocks: number/.test(assets) && /removedStreetBlocks \+= 1/.test(assets));
check("renderer cleanup report counts roof blocks", /removedRoofBlocks: number/.test(assets) && /removedRoofBlocks \+= 1/.test(assets));
check("runtime placement constant uses cleanup report", /const RUNTIME_PLACEMENTS = HARTHMERE_RUNTIME_PLACEMENT_CLEANUP\.placements/.test(assets));
check("loadAll uses cleaned runtime placements", /prepareHarthmereRuntimePlacements\(RUNTIME_PLACEMENTS\)/.test(assets) || /prepareHarthmereRuntimePlacements\(RUNTIME_PLACEMENTS\)/.test(assets));
check("debug report exposes cleaned placement count", /cleanedPlacements: RUNTIME_PLACEMENTS\.length/.test(assets));
check("street cleanup excludes building footprints", /isInsideAnyHarthmereRoofBuildingFootprint\(x, z, 0\)/.test(assets));
check("roof cleanup models single-story roof clear air", /return relY > 5\.12 && relY <= 24/.test(assets));
check("roof cleanup models upper-story roof clear air", /return relY > 9\.12 && relY <= 24/.test(assets));

check("server terrain clear marker exists", shim.includes("HARTHMERE_CLEAR_ROOF_STREET_AIR_VERSION"));
check("server clears street air blocks", /function harthmereShouldClearStreetAirBlock\(/.test(shim));
check("server clears roof air blocks", /function harthmereShouldClearRoofAirBlock\(/.test(shim));
check("server street clear excludes building footprints", /return !harthmereIsInsideAnyBuildingFootprint\(worldX, worldZ, 0\)/.test(shim));
check("server keeps roof slab but clears above single story", /return relY > 5 && relY <= 24/.test(shim) || /relY > harthmereTopRelY\(building\) && relY <= 32/.test(shim));
check("server keeps upper roof slab but clears above upper roof", /return relY > 9 && relY <= 24/.test(shim) || /relY > harthmereTopRelY\(building\) && relY <= 32/.test(shim));
check("server full-town block pass has early cleanup return", /harthmereShouldForceClearRoofStreetAirBlock\(worldX, worldY, worldZ\)[\s\S]{0,180}return undefined;/.test(shim));
check("full suite includes roof/street cleanup test", suite.includes("test-harthmere-roof-street-block-cleanup.cjs"));

if (failed > 0) {
  console.log(`RESULT FAIL ${failed}`);
  process.exit(1);
}
console.log("RESULT PASS");
