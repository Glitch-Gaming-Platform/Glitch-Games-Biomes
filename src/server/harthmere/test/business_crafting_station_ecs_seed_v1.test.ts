import assert from "assert";

import {
  buildHarthmereBusinessCraftingStationSeedChangesV1,
  buildHarthmereBusinessCraftingStationSeedProposedChangesV1,
  harthmereBusinessCraftingStationSeedEntityIdsV1,
} from "@/server/harthmere/business_crafting_station_ecs_seed_v1";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_owner_npc_seed_v1";
import { HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1 } from "@/shared/harthmere/business_crafting_station_seed_v1";
import type { BiomesId } from "@/shared/ids";

describe("business crafting station ECS seed builder", () => {
  it("creates one placeable crafting-station entity per business", () => {
    const changes = buildHarthmereBusinessCraftingStationSeedChangesV1({
      tick: 1,
      nowSeconds: 1000,
    });
    assert.equal(
      changes.length,
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1.length
    );

    const ids = new Set<BiomesId>();
    for (const change of changes) {
      assert.equal(change.kind, "create");
      assert.ok(change.kind !== "delete");
      const entity = (change as { entity: any }).entity;
      const seed = HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1.find(
        (candidate) => candidate.entityId === entity.id
      );
      assert.ok(seed, `unexpected entity id ${entity.id}`);

      // A placed crafting station: the placeable item is the station, it carries
      // the crafting station marker, and it's positioned/labelled in the shop.
      assert.ok(entity.placeable_component, "needs placeable_component");
      assert.equal(
        Number(entity.placeable_component.item_id),
        Number(seed!.stationItemId)
      );
      assert.ok(
        entity.crafting_station_component,
        "needs crafting_station_component for the F-craft overlay"
      );
      assert.deepEqual(entity.position?.v, seed!.position);
      assert.equal(entity.label?.text, seed!.stationName);
      assert.ok(entity.collideable, "station should collide");
      assert.ok(entity.locked_in_place, "station should be immovable");

      // placed_by is REQUIRED for the client rich-placeable overlay branch to
      // fire (overlays.ts gates on placeable_component && placed_by). The shop
      // owner is the placer.
      assert.ok(entity.placed_by, "needs placed_by for the placeable overlay");
      const owner = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.find(
        (candidate) => candidate.outpostId === seed!.outpostId
      );
      assert.ok(owner);
      assert.equal(Number(entity.placed_by.id), Number(owner!.entityId));

      ids.add(entity.id);
    }
    assert.equal(ids.size, changes.length, "station entity ids must be unique");
  });

  it("emits updates instead of creates for already-seeded stations", () => {
    const existingIds = new Set<BiomesId>([
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1[0].entityId,
    ]);
    const changes = buildHarthmereBusinessCraftingStationSeedChangesV1({
      tick: 2,
      nowSeconds: 1000,
      existingIds,
    });
    const first = changes.find(
      (change) =>
        change.kind !== "delete" &&
        (change as { entity: any }).entity.id ===
          HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1[0].entityId
    );
    assert.ok(first);
    assert.equal(first!.kind, "update");
  });

  it("exposes the same ids as the shared seed and proposes matching changes", () => {
    const ids = harthmereBusinessCraftingStationSeedEntityIdsV1().map(Number);
    assert.deepEqual(
      ids,
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1.map((seed) =>
        Number(seed.entityId)
      )
    );

    const proposed = buildHarthmereBusinessCraftingStationSeedProposedChangesV1({
      nowSeconds: 1000,
    });
    assert.equal(proposed.length, ids.length);
    for (const change of proposed) {
      assert.equal(change.kind, "create");
    }
  });
});
