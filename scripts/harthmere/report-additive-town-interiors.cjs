#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const interiors = require(
  path.join(root, "src/shared/harthmere/harthmere_additive_town_interiors")
);
const collisions = require(
  path.join(root, "src/shared/harthmere/additive_town_interior_collision_seed")
);
const cooking = require(
  path.join(root, "src/shared/harthmere/additive_town_cooking_station_seed")
);
const furnitureManifest = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "public/assets/harthmere/manifest/business-furniture-catalogue.json"
    ),
    "utf8"
  )
);

function publicFile(url) {
  return path.join(root, "public", url.replace(/^\//, ""));
}

const glbs = furnitureManifest.items.flatMap((item) =>
  Object.entries(item.assets).map(([lod, url]) => ({
    itemId: item.itemId,
    lod,
    url,
    bytes: fs.statSync(publicFile(url)).size,
  }))
);
const rawGlbs = fs
  .readdirSync(
    path.join(root, "public/assets/harthmere/glb/business_furniture"),
    { recursive: true }
  )
  .filter((entry) => String(entry).endsWith(".raw.glb"));

const layoutErrors = interiors.validateHarthmereAdditiveTownInteriors();
const collisionErrors =
  collisions.validateHarthmereAdditiveTownInteriorCollisionSeeds();
const cookingErrors =
  cooking.validateHarthmereAdditiveTownCookingStationSeeds();
assert.deepEqual(layoutErrors, []);
assert.deepEqual(collisionErrors, []);
assert.deepEqual(cookingErrors, []);
assert.equal(interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.length, 57);
assert.equal(furnitureManifest.items.length, 32);
assert.equal(rawGlbs.length, 0);

const report = {
  version: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
  generatedAt: new Date().toISOString(),
  scope:
    "57 fixed additive-town Harthmere buildings; excludes 19 businesses and Grove connector buildings",
  totals: {
    buildings: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.length,
    fixtures: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.length,
    furniture: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
      (fixture) => fixture.kind === "furniture"
    ).length,
    decor: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
      (fixture) => fixture.kind === "decor"
    ).length,
    cookingStations: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
      (fixture) => fixture.kind === "cooking"
    ).length,
    nativeCollisionProxies:
      collisions.HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.length,
    correctedNpcAnchors:
      interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS.length,
  },
  delivery: {
    catalogueItems: furnitureManifest.items.length,
    reusedItems: furnitureManifest.items.filter(
      (item) => !item.itemId.startsWith("town_")
    ).length,
    newHarthmereItems: furnitureManifest.items
      .filter((item) => item.itemId.startsWith("town_"))
      .map((item) => item.itemId),
    glbFiles: glbs.length,
    totalGlbBytes: glbs.reduce((sum, entry) => sum + entry.bytes, 0),
    maximumGlb: glbs.reduce((maximum, entry) =>
      entry.bytes > maximum.bytes ? entry : maximum
    ),
    rawGlbFiles: rawGlbs.length,
    lod0Meters: 16,
    lod1Meters: 28,
    hiddenBeyondMeters: 28,
    geometryCompression:
      furnitureManifest.performanceContract.geometryCompression,
    textures: furnitureManifest.performanceContract.textures,
    iconResolution: furnitureManifest.performanceContract.iconResolution,
    iconFormat: furnitureManifest.performanceContract.iconFormat,
    runtime:
      "shared dynamic InstancedMesh batches; native box collision; no static-furniture Gaia ticks",
  },
  validation: { layoutErrors, collisionErrors, cookingErrors },
  buildings: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.map((plan) => {
    const fixtures = interiors.harthmereAdditiveTownInteriorFixturesForBuilding(
      plan.buildingName
    );
    return {
      buildingName: plan.buildingName,
      identity: plan.identity,
      focalCue: plan.focalCue,
      fixtureCount: fixtures.length,
      cookingStationCount: fixtures.filter(
        (fixture) => fixture.kind === "cooking"
      ).length,
      floors: [...new Set(fixtures.map((fixture) => fixture.floor))].sort(),
      npcOffsets: interiors.HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS.filter(
        (anchor) => anchor.buildingName === plan.buildingName
      ).map((anchor) => anchor.offset),
    };
  }),
};

const output = path.join(
  root,
  "output/harthmere-additive-town-interiors/harthmere-additive-town-interiors-report.json"
);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ output, ...report.totals, ...report.delivery }, null, 2)
);
