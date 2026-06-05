import assert from "assert";

import { harthmereBusinessCustomerNpcSeedIdsV1 } from "@/shared/harthmere/business_customer_npc_seed_v1";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import {
  HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1,
  harthmereBusinessCraftingStationSeedByOutpostV1,
  harthmereBusinessCraftingStationSeedIdsV1,
  isHarthmereBusinessCraftingStationEntityIdV1,
  validateHarthmereBusinessCraftingStationSeedsV1,
} from "@/shared/harthmere/business_crafting_station_seed_v1";
import { harthmereBusinessOwnerNpcSeedIdsV1 } from "@/shared/harthmere/business_owner_npc_seed_v1";

describe("business crafting station seeds", () => {
  it("defines exactly one crafting station per outpost business", () => {
    assert.equal(
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1.length,
      HARTHMERE_BUSINESS_OUTPOSTS_V1.length
    );
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const seed = harthmereBusinessCraftingStationSeedByOutpostV1(
        outpost.outpostId
      );
      assert.ok(seed, `no crafting station seeded for ${outpost.outpostId}`);
      assert.equal(seed!.businessType, outpost.businessType);
      assert.equal(seed!.businessName, outpost.displayName);
    }
  });

  it("passes its own structural validation", () => {
    assert.deepEqual(validateHarthmereBusinessCraftingStationSeedsV1(), []);
  });

  it("assigns a real crafting station item id and readable name to each", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1) {
      assert.ok(
        Number.isFinite(Number(seed.stationItemId)) &&
          Number(seed.stationItemId) > 0,
        `${seed.outpostId} must reference a real station item id`
      );
      assert.ok(seed.stationName.trim().length > 0);
    }
  });

  it("places every station on the floor inside its building footprint", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1.find(
        (candidate) => candidate.outpostId === seed.outpostId
      );
      assert.ok(site, `no safe site for ${seed.outpostId}`);
      const [x, y, z] = seed.position;
      assert.ok(
        x >= site!.footprint.xMin && x <= site!.footprint.xMax,
        `${seed.outpostId} station x outside footprint`
      );
      assert.ok(
        z >= site!.footprint.zMin && z <= site!.footprint.zMax,
        `${seed.outpostId} station z outside footprint`
      );
      assert.equal(y, site!.groundY, `${seed.outpostId} station off the floor`);
    }
  });

  it("does not sit exactly on top of the owner (footprint center)", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS_V1) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1.find(
        (candidate) => candidate.outpostId === seed.outpostId
      )!;
      const centerX = (site.footprint.xMin + site.footprint.xMax) / 2;
      const centerZ = (site.footprint.zMin + site.footprint.zMax) / 2;
      const dist = Math.hypot(seed.position[0] - centerX, seed.position[2] - centerZ);
      assert.ok(dist > 0.5, `${seed.outpostId} station overlaps the owner`);
    }
  });

  it("uses a unique id band clear of owners and customers", () => {
    const stationIds = harthmereBusinessCraftingStationSeedIdsV1().map(Number);
    assert.equal(new Set(stationIds).size, stationIds.length, "ids must be unique");

    const ownerIds = new Set(harthmereBusinessOwnerNpcSeedIdsV1().map(Number));
    const customerIds = new Set(
      harthmereBusinessCustomerNpcSeedIdsV1().map(Number)
    );
    for (const id of stationIds) {
      assert.ok(!ownerIds.has(id), `station id ${id} collides with an owner`);
      assert.ok(
        !customerIds.has(id),
        `station id ${id} collides with a customer`
      );
      assert.ok(isHarthmereBusinessCraftingStationEntityIdV1(id));
    }
    assert.ok(!isHarthmereBusinessCraftingStationEntityIdV1(undefined));
    assert.ok(!isHarthmereBusinessCraftingStationEntityIdV1(1));
  });
});
