import assert from "assert";

import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE_V1,
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1,
  validateHarthmereBusinessCustomerNpcSeedsV1,
} from "@/shared/harthmere/business_customer_npc_seed_v1";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_owner_npc_seed_v1";

describe("business customer NPC seeds", () => {
  it("seeds 2-5 customers in every outpost business", () => {
    const perOutpost = new Map<string, number>();
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
      perOutpost.set(seed.outpostId, (perOutpost.get(seed.outpostId) ?? 0) + 1);
    }
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const count = perOutpost.get(outpost.outpostId) ?? 0;
      assert.ok(
        count >= 2 && count <= 5,
        `${outpost.outpostId} has ${count} customers (want 2-5)`
      );
    }
  });

  it("gives every customer a unique entity id, offset, customerNpcId, and copy", () => {
    const ids = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1.map((s) => s.entityId)
    );
    const offsets = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1.map((s) => s.idOffset)
    );
    const customerIds = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1.map((s) => s.customerNpcId)
    );
    const n = HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1.length;
    assert.equal(ids.size, n);
    assert.equal(offsets.size, n);
    assert.equal(customerIds.size, n);
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
      assert.ok(seed.displayName.trim().length > 0);
      assert.ok(seed.line.trim().length > 0);
      assert.ok(seed.background.trim().length > 0);
      assert.ok(seed.extraLines.length > 0);
    }
  });

  it("uses only ASCII letters in customer display names (no stray glyphs)", () => {
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
      assert.ok(
        /^[\x20-\x7e]+$/.test(seed.displayName),
        `${seed.customerNpcId} name has non-ASCII: ${seed.displayName}`
      );
    }
  });

  it("places every customer inside its business footprint at ground level", () => {
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1.find(
        (candidate) => candidate.outpostId === seed.outpostId
      );
      assert.ok(site);
      const [x, y, z] = seed.position;
      assert.ok(
        x >= site!.footprint.xMin && x <= site!.footprint.xMax,
        `${seed.customerNpcId} X ${x} outside footprint`
      );
      assert.ok(
        z >= site!.footprint.zMin && z <= site!.footprint.zMax,
        `${seed.customerNpcId} Z ${z} outside footprint`
      );
      assert.equal(y, site!.groundY, `${seed.customerNpcId} not on ground`);
    }
  });

  it("reserves an id band (9701+) clear of owners (9601-9619) and muckers (9451-9550)", () => {
    const ownerIds = new Set(
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.map((s) => Number(s.entityId))
    );
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
      assert.ok(
        seed.idOffset >= HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE_V1,
        `${seed.customerNpcId} offset ${seed.idOffset} below band`
      );
      assert.ok(
        !ownerIds.has(Number(seed.entityId)),
        `${seed.customerNpcId} collides with an owner entity id`
      );
    }
  });

  it("passes its own structural validation", () => {
    assert.deepEqual(validateHarthmereBusinessCustomerNpcSeedsV1(), []);
  });
});
