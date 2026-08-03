import assert from "assert";

import { harthmereBusinessCustomerNpcSeedIds } from "@/shared/harthmere/business_customer_npc_seed";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS,
  harthmereBusinessCraftingStationSeedByOutpost,
  harthmereBusinessCraftingStationSeedIds,
  isHarthmereBusinessCraftingStationEntityId,
  validateHarthmereBusinessCraftingStationSeeds,
} from "@/shared/harthmere/business_crafting_station_seed";
import {
  harthmereBusinessInteriorForOutpost,
  harthmereBusinessInteriorLocalToWorld,
} from "@/shared/harthmere/business_interior_runtime";
import { harthmereBusinessOwnerNpcSeedIds } from "@/shared/harthmere/business_owner_npc_seed";
import { ensureHarthmereProductionCraftingCatalogue } from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  getHarthmereCraftingStation,
  normalizeHarthmereCraftingStationId,
} from "@/shared/harthmere/mmo_inventory_authority";

describe("business crafting station seeds", () => {
  it("defines exactly one crafting station per outpost business", () => {
    assert.equal(
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.length,
      HARTHMERE_BUSINESS_OUTPOSTS.length
    );
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const seed = harthmereBusinessCraftingStationSeedByOutpost(
        outpost.outpostId
      );
      assert.ok(seed, `no crafting station seeded for ${outpost.outpostId}`);
      assert.equal(seed!.businessType, outpost.businessType);
      assert.equal(seed!.businessName, outpost.displayName);
    }
  });

  it("passes its own structural validation", () => {
    assert.deepEqual(validateHarthmereBusinessCraftingStationSeeds(), []);
  });

  it("assigns a real crafting station item id and readable name to each", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
      assert.ok(
        Number.isFinite(Number(seed.stationItemId)) &&
          Number(seed.stationItemId) > 0,
        `${seed.outpostId} must reference a real station item id`
      );
      assert.ok(seed.stationName.trim().length > 0);
    }
  });

  it("normalizes every seeded station item id to a registered crafting station", () => {
    ensureHarthmereProductionCraftingCatalogue();
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
      const normalizedStationId = normalizeHarthmereCraftingStationId(
        seed.stationItemId
      );
      const station = getHarthmereCraftingStation(normalizedStationId);
      assert.ok(
        station,
        `${seed.outpostId} station item ${seed.stationItemId} must resolve`
      );
      assert.equal(station!.displayName, seed.stationName);
    }
  });

  it("anchors every native interaction at the combined interior's primary station", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
      const interior = harthmereBusinessInteriorForOutpost(seed.outpostId);
      const station = interior?.collisionBoxes.find(
        (box) => box.role === "primary_station"
      );
      assert.ok(interior, `no interior for ${seed.outpostId}`);
      assert.ok(station, `no primary station for ${seed.outpostId}`);
      const center = harthmereBusinessInteriorLocalToWorld(
        interior!,
        station!.center as [number, number, number]
      );
      assert.deepEqual(seed.position, [
        center[0],
        center[1] - station!.size[2] / 2,
        center[2],
      ]);
    }
  });

  it("does not sit exactly on top of the owner (footprint center)", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.find(
        (candidate) => candidate.outpostId === seed.outpostId
      )!;
      const centerX = (site.footprint.xMin + site.footprint.xMax) / 2;
      const centerZ = (site.footprint.zMin + site.footprint.zMax) / 2;
      const dist = Math.hypot(
        seed.position[0] - centerX,
        seed.position[2] - centerZ
      );
      assert.ok(dist > 0.5, `${seed.outpostId} station overlaps the owner`);
    }
  });

  it("uses a unique id band clear of owners and customers", () => {
    const stationIds = harthmereBusinessCraftingStationSeedIds().map(Number);
    assert.equal(
      new Set(stationIds).size,
      stationIds.length,
      "ids must be unique"
    );

    const ownerIds = new Set(harthmereBusinessOwnerNpcSeedIds().map(Number));
    const customerIds = new Set(
      harthmereBusinessCustomerNpcSeedIds().map(Number)
    );
    for (const id of stationIds) {
      assert.ok(!ownerIds.has(id), `station id ${id} collides with an owner`);
      assert.ok(
        !customerIds.has(id),
        `station id ${id} collides with a customer`
      );
      assert.ok(isHarthmereBusinessCraftingStationEntityId(id));
    }
    assert.ok(!isHarthmereBusinessCraftingStationEntityId(undefined));
    assert.ok(!isHarthmereBusinessCraftingStationEntityId(1));
  });
});
