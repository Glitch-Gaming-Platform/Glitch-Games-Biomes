#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures += 1;
    console.log(`FAIL ${rel} exists`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}
function ok(label, condition, details = []) {
  if (condition) console.log(`OK ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
    for (const d of details) console.log(`  - ${d}`);
  }
}

console.log("== Harthmere town collision regression tests v36 ==");
console.log(`Root: ${root}\n`);
const registry = read("src/shared/harthmere/town_registry.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const player = read("src/client/game/scripts/player.ts");

ok(
  "registry blocks broader solid uploaded families",
  /HARTHMERE_SOLID_UPLOADED_ASSET_PLAYER_BLOCKER_FAMILIES_V31/.test(registry) && /banner flag sign window shrine monument pole standard mast temple blocksPlayer: true/.test(registry),
  ["uploaded banners/flags/windows/signs/poles were previously missing from the solid family contract"]
);
ok(
  "registry recognizes church/chapel/temple building bodies and exterior windows",
  /BUILDING_BODY_ASSET_RE/.test(registry) && /EXTERIOR_WINDOW_ASSET_RE/.test(registry) && /church\/chapel\/temple body/.test(registry) && /exterior window glass\/frame blocks movement/.test(registry),
  ["chapel/temple body and window variants fell through to none/generic collision"]
);

ok(
  "exterior window branch is not swallowed by broad building-body branch",
  registry.indexOf("EXTERIOR_WINDOW_ASSET_RE.test(asset)") < registry.indexOf("BUILDING_BODY_ASSET_RE.test(asset)") && /if \(\/window\|door\|stair\|steps\|roof\|chimney\/i\.test\(asset\)\)/.test(assets),
  ["obj_church_window_* must use the small exterior-window blocker instead of the huge church body footprint"]
);

ok(
  "renderer does not mark authored banners/large flags visual-only",
  /isHarthmereSolidBannerOrFlagFixture/.test(assets) && /name\.includes\("banner"\) && !isHarthmereSolidBannerOrFlagFixture/.test(assets) && /name\.includes\("flag"\) && !isHarthmereSolidBannerOrFlagFixture/.test(assets),
  ["watch/north-gate banners must have a physical base and player blocker"]
);
ok(
  "player physics uses same banner/window carve-outs as renderer",
  /isHarthmereLocalDevSolidBannerOrFlagFixture/.test(player) && /isHarthmereLocalDevExteriorWindowBlocker/.test(player) && /chapel\|temple\|cathedral/.test(player),
  ["player-side pass-through classifier must not drift from renderer/town registry"]
);
ok(
  "runtime exports player-explicit collision aliases",
  /__harthmerePlayerCollisionObstacles/.test(assets) && /__harthmereTownCollisionObstacles/.test(assets) && /harthmereDebugCollisionObstaclesV31/.test(assets),
  ["debug/runtime contract should not imply obstacles are NPC-only"]
);

console.log("");
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
