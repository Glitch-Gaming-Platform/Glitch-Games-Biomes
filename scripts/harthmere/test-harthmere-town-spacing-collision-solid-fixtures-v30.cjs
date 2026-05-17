#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
  return fs.readFileSync(file, "utf8");
}

const assets = read(assetsPath);
const registry = read(registryPath);
const player = read(playerPath);
const suite = read(suitePath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
    if (detail) console.log(`  - ${detail}`);
  }
}

console.log("== Harthmere town spacing, solid collision, and fixture support tests v30 ==");
console.log(`Root: ${root}`);
console.log("");

check(
  "v30 collision fix marker exists in registry, renderer, and player movement bridge",
  [registry, assets, player].every((src) => src.includes("harthmere-town-spacing-collision-solid-fixture-v30")),
);

check(
  "generated building front doors and entry steps are explicit navigation openings, not invisible blockers",
  registry.includes("isHarthmereBuildingNavigationOpening") &&
    registry.includes("front door") &&
    registry.includes("entry step") &&
    /building navigation opening\/front door should not create invisible collision/.test(registry) &&
    assets.includes("isHarthmereBuildingNavigationOpeningPlacement") &&
    player.includes("isHarthmereLocalDevBuildingNavigationOpening"),
);

check(
  "Black Anvil / weapon shop entrance can be entered because front-door shell collisions are pass-through",
  /createBuildingShell\(\{ name: "Black Anvil Smithy"[\s\S]{0,260}rot: Math\.PI \/ 2/.test(assets) &&
    /isHarthmereBuildingNavigationOpeningPlacement\(asset, name\)/.test(assets) &&
    /isHarthmereLocalDevBuildingNavigationOpening\(asset, name, district\)/.test(player),
);

check(
  "exterior window assets are no longer broad visual-only holes through walls",
  assets.includes("isHarthmereExteriorWindowCollisionAsset") &&
    /name\.includes\("window"\) && !isHarthmereExteriorWindowCollisionAsset\(asset\)/.test(assets) &&
    player.includes("isHarthmereLocalDevExteriorWindowBlocker") &&
    /name\.includes\("window"\) && !isHarthmereLocalDevExteriorWindowBlocker\(asset\)/.test(player),
);

check(
  "church/chapel body and church window families are solid building blockers",
  /asset === "obj_church_iso"[\s\S]{0,180}blocksPlayer: true/.test(registry) &&
    /asset === "obj_church_iso"[\s\S]{0,220}building_or_wall/.test(assets) &&
    /\^obj_church_window_/.test(assets) &&
    /\^obj_church_window_/.test(player),
);

check(
  "large North Gate flags are solid landmark fixtures, not pass-through banner text",
  /\^obj_flag_large_/.test(registry) &&
    /large flag\/banner pole and cloth are solid landmark fixtures blocksPlayer: true/.test(registry) &&
    /\!\/\^obj_flag_large_\/i\.test\(asset\)/.test(assets) &&
    /\!asset\.startsWith\("obj_flag_large"\)/.test(player),
);

check(
  "north gate watch banners declare physical base support instead of looking like floating cloth",
  assets.includes("Watch banner left planted in tower base solid flag pole") &&
    assets.includes("Watch banner right planted in tower base solid flag pole"),
);

check(
  "elevated decorative fixtures use support language: mounted, attached, supported, planted, wall, ceiling, hook, chain, bracket, or base",
  /mounted beside smithy entrance wall bracket/.test(assets) &&
    /planted in tower base solid flag pole/.test(assets) &&
    /supported by ceiling chain bracket/.test(assets),
);

check(
  "town spacing suite includes this regression test",
  suite.includes("test-harthmere-town-spacing-collision-solid-fixtures-v30.cjs"),
);

console.log("");
console.log(`RESULT: ${failures === 0 ? "PASS" : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
