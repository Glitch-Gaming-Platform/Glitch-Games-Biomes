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
  placeHarthmereAdditiveTownInteriorPlanForTest,
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

  it("keeps the relocated Mail Post fully furnishable during server startup", () => {
    const mailPost = HARTHMERE_BUILDINGS.find(
      (building) => building.name === "mail_post_house"
    );
    assert.ok(mailPost, "missing Mail Post shell");
    assert.deepEqual(
      [mailPost!.x0, mailPost!.x1, mailPost!.z0, mailPost!.z1],
      [516, 530, -219, -205]
    );

    const fixtures =
      harthmereAdditiveTownInteriorFixturesForBuilding("mail_post_house");
    assert.equal(fixtures.length, 12);
    const bench = fixtures.find(
      (fixture) => fixture.fixtureId === "mail_post_house:mail_bench"
    );
    assert.ok(bench, "Mail Post courier bench was not safely placed");
    assert.equal(bench!.floor, 0);
    assert.ok(bench!.position[0] > mailPost!.x0);
    assert.ok(bench!.position[0] < mailPost!.x1);
    assert.ok(bench!.position[2] > mailPost!.z0);
    assert.ok(bench!.position[2] < mailPost!.z1);

    const outgoing = fixtures.find(
      (fixture) => fixture.fixtureId === "mail_post_house:mail_outgoing"
    );
    assert.ok(outgoing, "Mail Post outgoing bins were not safely placed");
    assert.deepEqual(
      outgoing!.clearanceSize,
      [1, 0.92, 1],
      "outgoing bins must reserve a conservative footprint beside the stair boundary"
    );
    assert.ok(mailPost!.stairs, "Mail Post must retain its authored stairs");
    const stairSouthKeepClearBoundary = mailPost!.stairs!.z0 - 1.35;
    const outgoingSouthEdge =
      outgoing!.position[2] + outgoing!.clearanceSize[2] / 2;
    assert.ok(
      stairSouthKeepClearBoundary - outgoingSouthEdge >= 0.5,
      "outgoing bins must retain at least 0.5m beyond the inclusive stair keep-clear boundary"
    );

    const authoredGroundFloor = new Map(
      fixtures
        .filter((fixture) => fixture.floor === 0)
        .map((fixture) => [
          fixture.fixtureId,
          [fixture.position[0], fixture.position[2], fixture.yaw],
        ])
    );
    assert.deepEqual(
      authoredGroundFloor,
      new Map([
        ["mail_post_house:mail_counter", [518.15, -207.15, Math.PI]],
        ["mail_post_house:mail_sorting", [518.15, -216.85, 0]],
        ["mail_post_house:mail_scale", [518.15, -210.1, Math.PI / 2]],
        ["mail_post_house:mail_secure", [527.85, -216.85, -Math.PI / 2]],
        ["mail_post_house:mail_outgoing", [520.4, -217.4, 0]],
        ["mail_post_house:mail_bench", [527.575, -214.175, Math.PI / 2]],
      ])
    );

    const plan = HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.find(
      (candidate) => candidate.buildingName === "mail_post_house"
    );
    assert.ok(plan, "missing Mail Post interior plan");
    const denseOnly = placeHarthmereAdditiveTownInteriorPlanForTest(
      mailPost!,
      plan!,
      true
    );
    assert.equal(
      denseOnly.length,
      plan!.fixtures.length,
      "production fallback must place every Mail Post fixture without a coarse wall slot"
    );
    assert.equal(
      new Set(denseOnly.map((fixture) => fixture.fixtureId)).size,
      plan!.fixtures.length
    );
    assert.notDeepEqual(
      denseOnly
        .filter((fixture) => fixture.floor === 0)
        .map((fixture) => [fixture.position[0], fixture.position[2]]),
      fixtures
        .filter((fixture) => fixture.floor === 0)
        .map((fixture) => [fixture.position[0], fixture.position[2]]),
      "forced dense placement must exercise the safe fallback instead of authored coordinates"
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
