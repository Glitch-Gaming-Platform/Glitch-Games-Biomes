/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { buildHarthmereAdditiveTownCookingStationSeedProposedChanges } from "../additive_town_cooking_station_ecs_seed";
import { buildHarthmereAdditiveTownInteriorCollisionSeedProposedChanges } from "../additive_town_interior_collision_ecs_seed";
import { HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS } from "@/shared/harthmere/additive_town_cooking_station_seed";
import { HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS } from "@/shared/harthmere/additive_town_interior_collision_seed";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES,
  harthmereAdditiveTownInteriorWorldPosition,
} from "@/shared/harthmere/harthmere_additive_town_interiors";
import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";

describe("Harthmere additive-town interiors native ECS end-to-end contract", () => {
  it("materializes the complete 57-building visual-to-physics contract", () => {
    const collisionChanges =
      buildHarthmereAdditiveTownInteriorCollisionSeedProposedChanges({});
    const cookingChanges =
      buildHarthmereAdditiveTownCookingStationSeedProposedChanges({
        nowSeconds: 1234,
      });
    assert.equal(
      collisionChanges.length,
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.length
    );
    assert.equal(
      cookingChanges.length,
      HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.length
    );

    const created = [...collisionChanges, ...cookingChanges].map((change) => {
      assert.equal(change.kind, "create");
      assert.ok(change.kind === "create");
      return change.entity as any;
    });
    assert.equal(
      new Set(created.map((entity) => Number(entity.id))).size,
      created.length
    );

    for (const building of HARTHMERE_BUILDINGS) {
      const solidFixtures = HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
        (fixture) =>
          fixture.buildingName === building.name && fixture.collidable
      );
      assert.ok(
        solidFixtures.length > 0,
        `${building.name} has no solid interior`
      );
      for (const fixture of solidFixtures) {
        const collisionSeed =
          HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.find(
            (seed) => seed.fixtureId === fixture.fixtureId
          );
        const cookingSeed = HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.find(
          (seed) => seed.fixtureId === fixture.fixtureId
        );
        const seed = collisionSeed ?? cookingSeed;
        assert.ok(seed, `${fixture.fixtureId} has no native ECS physics`);
        const entity = created.find(
          (candidate) => Number(candidate.id) === Number(seed!.entityId)
        );
        assert.ok(entity, `${fixture.fixtureId} was not materialized`);
        assert.deepEqual(
          entity.position.v,
          harthmereAdditiveTownInteriorWorldPosition(fixture.position)
        );
        assert.deepEqual(entity.orientation.v, [0, fixture.yaw]);
        assert.deepEqual(entity.size.v, fixture.size);
        assert.ok(entity.collideable);
        if (fixture.kind === "cooking") {
          assert.ok(entity.placeable_component);
          assert.ok(entity.crafting_station_component);
          assert.ok(entity.label?.text);
        } else {
          assert.equal(entity.placeable_component, undefined);
        }
      }
    }
  });
});
