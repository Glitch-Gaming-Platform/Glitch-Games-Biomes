#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const assetsPath = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(repo, "src/shared/harthmere/town_registry.ts");

let failures = 0;
let warnings = 0;
function ok(message) { console.log(`OK ${message}`); }
function fail(message) { failures += 1; console.log(`FAIL ${message}`); }
function warn(message) { warnings += 1; console.log(`WARN ${message}`); }
function has(text, pattern) { return typeof pattern === "string" ? text.includes(pattern) : pattern.test(text); }

if (!fs.existsSync(assetsPath)) fail(`missing ${assetsPath}`);
if (!fs.existsSync(registryPath)) fail(`missing ${registryPath}`);
const assets = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, "utf8") : "";
const registry = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, "utf8") : "";

console.log("\n== Town registry ==");
has(registry, "HARTHMERE_TOWN_REGISTRY_VERSION") ? ok("town registry version exists") : fail("town registry version missing");
has(registry, "HARTHMERE_TOWN_DISTRICTS") ? ok("district registry exists") : fail("district registry missing");
for (const district of ["north_gate", "market_square", "player_services", "copper_kettle", "craftsman_row", "temple_green", "noble_rise", "river_docks", "mudden_ward", "guard_yard", "old_well_underways"]) {
  has(registry, district) ? ok(`${district} registered`) : fail(`${district} missing from registry`);
}

console.log("\n== Placement metadata standard ==");
has(assets, "town_registry") ? ok("runtime imports town registry") : fail("runtime does not import town registry");
has(assets, "meta?: HarthmerePlacementMetadata") ? ok("RuntimePlacement supports metadata") : fail("RuntimePlacement metadata missing");
has(assets, "collision?: HarthmereCollisionConfig") ? ok("RuntimePlacement supports collision config") : fail("RuntimePlacement collision config missing");
has(assets, "lodTier?: HarthmereLodTier") ? ok("RuntimePlacement supports LOD tier") : fail("RuntimePlacement LOD tier missing");
has(assets, "makeHarthmerePropMetadata") && has(assets, "makeHarthmereActorMetadata") ? ok("P/A helpers generate metadata") : fail("P/A helpers do not generate metadata");
has(assets, "registerHarthmerePlacementInstance") ? ok("runtime registers placement instances with metadata") : fail("placement instance registration missing");
has(assets, "userData.harthmerePlacementMeta") ? ok("metadata is exposed on Object3D userData") : fail("Object3D metadata exposure missing");

console.log("\n== Collision categories and spawn safety ==");
has(registry, "HarthmereCollisionCategory") ? ok("standard collision category type exists") : fail("collision category type missing");
has(registry, "hard") && has(registry, "npcBlocker") && has(registry, "playerBlocker") && has(registry, "serviceClearance") ? ok("core collision categories are represented") : fail("core collision categories incomplete");
has(assets, "collisionFromHarthmerePlacement") ? ok("runtime uses standardized collision inference") : fail("runtime does not use standardized collision inference");
has(assets, "resolveHarthmereRuntimePlacement") ? ok("actor spawn de-overlap resolver exists") : fail("actor spawn resolver missing");
has(assets, "renderer.placement_spawn_resolved") ? ok("spawn correction is debug logged") : fail("spawn correction debug log missing");
has(assets, "__harthmereTownCollisionQuery") ? ok("runtime exposes collision query for player/controller integration") : fail("collision query not exposed");
!has(assets, "\n  );\n  );\n}") ? ok("known duplicate parenthesis syntax fallout is absent") : fail("duplicate parenthesis syntax fallout still present");

console.log("\n== LOD/culling/performance tiers ==");
has(registry, "HarthmereLodTier") ? ok("LOD tier type exists") : fail("LOD tier type missing");
has(registry, "shouldShowHarthmerePlacementAtDistanceSq") ? ok("LOD distance policy exists") : fail("LOD distance policy missing");
has(assets, "updateHarthmerePlacementLod") ? ok("runtime LOD updater exists") : fail("runtime LOD updater missing");
has(assets, "__harthmereTownLodStats") ? ok("runtime exposes LOD stats") : fail("LOD stats exposure missing");
has(assets, "private readonly placementInstances") ? ok("runtime tracks placement instances") : fail("placement instance tracking missing");

console.log("\n== Bad prop animation guard ==");
has(registry, "shouldAutoAnimateHarthmerePlacement") ? ok("auto-animation policy exists") : fail("auto-animation policy missing");
has(assets, "shouldAutoAnimateHarthmerePlacement") ? ok("runtime uses auto-animation policy") : fail("runtime does not use auto-animation policy");
const badMixer = "prototype.clips.length > 0 ? new THREE.AnimationMixer(clone) : undefined";
!has(assets, badMixer) ? ok("props with clips no longer auto-animate by default") : fail("all clipped props still auto-animate by default");

console.log("\n== Overlap risk report from authored P/A calls ==");
const placementRe = /\b([PA])\("([^"]+)",\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),[^\n]*?"([^"]*)",\s*"([^"]*)"/g;
const placements = [];
let match;
while ((match = placementRe.exec(assets))) {
  placements.push({ type: match[1], asset: match[2], x: Number(match[3]), z: Number(match[4]), name: match[5], district: match[6] });
}
ok(`parsed ${placements.length} simple authored placements for smoke audit`);
const exact = new Map();
for (const p of placements) {
  const key = `${p.type}|${p.asset}|${p.x.toFixed(2)}|${p.z.toFixed(2)}|${p.name}`;
  exact.set(key, (exact.get(key) || 0) + 1);
}
const exactDupes = [...exact.values()].filter((count) => count > 1).length;
exactDupes === 0 ? ok("no exact duplicate simple placements found") : warn(`${exactDupes} exact duplicate simple placements found`);
const actorInsideNames = ["in wall", "inside wall", "buried", "ground clipping", "doorway", "threshold"];
const suspiciousActors = placements.filter((p) => p.type === "A" && actorInsideNames.some((needle) => p.name.toLowerCase().includes(needle)));
suspiciousActors.length === 0 ? ok("no actor names explicitly indicate wall/ground/doorway placement") : warn(`${suspiciousActors.length} actor names suggest bad placement`);

console.log("\n== Summary ==");
console.log(`Warnings: ${warnings}`);
console.log(`Failures: ${failures}`);
if (failures > 0) {
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
if (warnings > 0) {
  console.log("\nRESULT: PASS_WITH_WARNINGS");
  process.exit(0);
}
console.log("\nRESULT: PASS");
