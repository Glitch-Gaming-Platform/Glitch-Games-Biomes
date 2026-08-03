/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { buildHarthmereAdditiveTownCookingStationSeedChanges } from "../additive_town_cooking_station_ecs_seed";
import { buildHarthmereAdditiveTownInteriorCollisionSeedChanges } from "../additive_town_interior_collision_ecs_seed";
import { HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS } from "@/shared/harthmere/additive_town_cooking_station_seed";
import { HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS } from "@/shared/harthmere/additive_town_interior_collision_seed";
import { harthmereBiscuitForItemDefinition } from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  ensureHarthmerePlaceableDecorCatalogue,
  getHarthmerePlaceableDecorSpec,
} from "@/shared/harthmere/mmo_placeable_decor_catalogue";
import { getHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";
import { newPlaceable } from "@/server/logic/utils/placeables";

describe("Harthmere additive-town interior ECS seeds", () => {
  it("writes invisible native collision entities without simulation/render components", () => {
    const changes = buildHarthmereAdditiveTownInteriorCollisionSeedChanges({
      tick: 77,
      existingIds: new Set(),
    });
    assert.equal(
      changes.length,
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.length
    );
    for (const change of changes) {
      assert.equal(change.kind, "create");
      if (change.kind !== "create") continue;
      const entity = change.entity as any;
      assert.ok(entity.position);
      assert.ok(entity.orientation);
      assert.ok(entity.size);
      assert.ok(entity.collideable);
      assert.equal(entity.placeable_component, undefined);
      assert.equal(entity.npc_metadata, undefined);
      assert.equal(entity.farming_plant_component, undefined);
      assert.equal(entity.robot_component, undefined);
    }
  });

  it("writes locked native cooking placeables while leaving Gaia farming untouched", () => {
    const changes = buildHarthmereAdditiveTownCookingStationSeedChanges({
      tick: 78,
      nowSeconds: 1234,
      existingIds: new Set(),
    });
    assert.equal(
      changes.length,
      HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.length
    );
    for (const change of changes) {
      assert.equal(change.kind, "create");
      if (change.kind !== "create") continue;
      const entity = change.entity as any;
      assert.ok(entity.placeable_component);
      assert.ok(entity.crafting_station_component);
      assert.ok(entity.collideable);
      assert.ok(entity.locked_in_place);
      assert.ok(entity.label?.text);
      assert.equal(entity.farming_plant_component, undefined);
      assert.equal(entity.robot_component, undefined);
      assert.equal(entity.npc_metadata, undefined);
    }
  });

  it("converges existing ids through updates rather than duplicate creates", () => {
    const existingIds = new Set(
      HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.map((seed) => seed.entityId)
    );
    const changes = buildHarthmereAdditiveTownCookingStationSeedChanges({
      tick: 79,
      nowSeconds: 1234,
      existingIds,
    });
    assert.ok(changes.every((change) => change.kind === "update"));
  });

  it("makes player-placed cookpots and ovens native F-interactable stations too", () => {
    ensureHarthmerePlaceableDecorCatalogue();
    for (const itemId of ["town_cookpot", "town_oven_range"]) {
      assert.ok(getHarthmerePlaceableDecorSpec(itemId));
      const definition = getHarthmereItemDefinition(itemId);
      assert.ok(definition, `${itemId} has no inventory definition`);
      const item = harthmereBiscuitForItemDefinition(definition!);
      const entity = newPlaceable({
        id: item.id,
        creatorId: undefined,
        position: [0, 0, 0],
        orientation: [0, 0],
        item,
        timestamp: 1234,
      });
      assert.ok(entity.placeable_component);
      assert.ok(entity.crafting_station_component);
      assert.ok(entity.collideable);
    }
  });
});
