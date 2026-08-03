/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { HARTHMERE_BUSINESS_FURNITURE_ASSETS } from "../generated/harthmere_business_furniture_manifest";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES,
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS,
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS,
  harthmereAdditiveTownInteriorWorldPosition,
  harthmereAdditiveTownInteriorFixtureClearanceSize,
  harthmereAdditiveTownInteriorFixturesForBuilding,
  validateHarthmereAdditiveTownInteriors,
} from "../harthmere_additive_town_interiors";
import { HARTHMERE_BUILDINGS } from "../harthmere_town_buildings";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS,
  validateHarthmereAdditiveTownInteriorCollisionSeeds,
} from "../additive_town_interior_collision_seed";
import {
  HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS,
  harthmereAdditiveTownCookingStationKind,
  harthmereAdditiveTownCookingStationVisualAsset,
  validateHarthmereAdditiveTownCookingStationSeeds,
} from "../additive_town_cooking_station_seed";

describe("Harthmere additive-town interior manifest", () => {
  it("furnishes exactly the 57 fixed shells with explicit lore identities", () => {
    assert.equal(HARTHMERE_BUILDINGS.length, 57);
    assert.equal(HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.length, 57);
    assert.equal(
      new Set(
        HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.map((plan) => plan.buildingName)
      ).size,
      57
    );
    for (const building of HARTHMERE_BUILDINGS) {
      const plan = HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.find(
        (candidate) => candidate.buildingName === building.name
      );
      assert.ok(plan, `${building.name} has no interior plan`);
      assert.ok(plan!.identity.trim(), `${building.name} has no identity`);
      assert.ok(plan!.focalCue.trim(), `${building.name} has no focal cue`);
      assert.ok(
        harthmereAdditiveTownInteriorFixturesForBuilding(building.name)
          .length >= 5,
        `${building.name} is under-furnished`
      );
    }
  });

  it("keeps every fixture and assigned NPC inside collision-safe shell space", () => {
    assert.deepEqual(validateHarthmereAdditiveTownInteriors(), []);
    assert.equal(HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS.length, 41);
    assert.equal(
      new Set(HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS.map((a) => a.offset))
        .size,
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS.length
    );
  });

  it("applies the connected-world offset exactly once at the renderer/ECS boundary", () => {
    assert.deepEqual(
      harthmereAdditiveTownInteriorWorldPosition([486, 53, -209], {}),
      [2086, 53, -209]
    );
    assert.deepEqual(
      harthmereAdditiveTownInteriorWorldPosition([486, 53, -209], {
        BIOMES_HARTHMERE_STANDALONE_TOWN: "1",
      }),
      [486, 53, -209]
    );
  });

  it("reconstructs missing derived clearance bounds from native size and yaw", () => {
    const rotated = HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.find(
      (fixture) =>
        Math.round(Math.abs(fixture.yaw) / (Math.PI / 2)) % 2 === 1 &&
        fixture.size[0] !== fixture.size[2]
    );
    assert.ok(rotated, "expected a non-square quarter-turned fixture");
    assert.deepEqual(
      harthmereAdditiveTownInteriorFixtureClearanceSize({
        fixtureId: rotated!.fixtureId,
        size: rotated!.size,
        yaw: rotated!.yaw,
        clearanceSize: undefined,
      }),
      [rotated!.size[2], rotated!.size[1], rotated!.size[0]]
    );
    assert.deepEqual(
      harthmereAdditiveTownInteriorFixtureClearanceSize(rotated!),
      rotated!.clearanceSize
    );
  });

  it("uses only the compact Harthmere-authored/reused furniture catalogue", () => {
    for (const fixture of HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES) {
      const asset = fixture.furnitureItemId ?? fixture.asset;
      if (!asset) {
        assert.equal(fixture.stationKind, "campfire");
        continue;
      }
      assert.ok(
        asset in HARTHMERE_BUSINESS_FURNITURE_ASSETS,
        `${fixture.fixtureId} uses unknown/off-brand asset ${asset}`
      );
    }
  });

  it("creates one native oriented collision proxy for every solid non-cooking fixture", () => {
    const expected = HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
      (fixture) => fixture.collidable && fixture.kind !== "cooking"
    );
    assert.equal(
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.length,
      expected.length
    );
    assert.deepEqual(validateHarthmereAdditiveTownInteriorCollisionSeeds(), []);
    for (const seed of HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS) {
      const fixture = expected.find(
        (candidate) => candidate.fixtureId === seed.fixtureId
      );
      assert.ok(fixture, `orphan collision ${seed.fixtureId}`);
      assert.deepEqual(seed.size, fixture!.size);
      assert.equal(seed.orientation[1], fixture!.yaw);
      assert.deepEqual(
        seed.position,
        harthmereAdditiveTownInteriorWorldPosition(fixture!.position)
      );
    }
  });

  it("materializes every stove/hearth as a native F-to-cook station", () => {
    const cookingFixtures = HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
      (fixture) => fixture.kind === "cooking"
    );
    assert.equal(
      HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.length,
      cookingFixtures.length
    );
    assert.deepEqual(validateHarthmereAdditiveTownCookingStationSeeds(), []);
    for (const seed of HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS) {
      const fixture = cookingFixtures.find(
        (candidate) => candidate.fixtureId === seed.fixtureId
      );
      assert.ok(fixture, `orphan cooking station ${seed.fixtureId}`);
      assert.equal(seed.stationName, fixture!.label);
      assert.deepEqual(seed.size, fixture!.size);
      assert.deepEqual(
        seed.position,
        harthmereAdditiveTownInteriorWorldPosition(fixture!.position)
      );
      assert.equal(
        harthmereAdditiveTownCookingStationKind(seed.entityId),
        seed.stationKind
      );
      assert.equal(
        harthmereAdditiveTownCookingStationVisualAsset(seed.entityId),
        seed.stationKind === "oven"
          ? "town_oven_range"
          : seed.stationKind === "cookpot"
            ? "town_cookpot"
            : undefined
      );
    }
  });
});
