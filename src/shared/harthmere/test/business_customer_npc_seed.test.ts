import assert from "assert";

import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE,
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS,
  validateHarthmereBusinessCustomerNpcSeeds,
} from "@/shared/harthmere/business_customer_npc_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";

describe("business customer NPC seeds", () => {
  it("evenly distributes exactly three customers to every outpost business", () => {
    const perOutpost = new Map<string, number>();
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
      perOutpost.set(seed.outpostId, (perOutpost.get(seed.outpostId) ?? 0) + 1);
    }
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const count = perOutpost.get(outpost.outpostId) ?? 0;
      assert.equal(count, 3, `${outpost.outpostId} has ${count} customers`);
    }
    assert.equal(HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.length, 57);
  });

  it("gives every customer a unique entity id, offset, customerNpcId, and copy", () => {
    const ids = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((s) => s.entityId)
    );
    const offsets = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((s) => s.idOffset)
    );
    const customerIds = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((s) => s.customerNpcId)
    );
    const n = HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.length;
    assert.equal(ids.size, n);
    assert.equal(offsets.size, n);
    assert.equal(customerIds.size, n);
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
      assert.ok(seed.displayName.trim().length > 0);
      assert.ok(seed.line.trim().length > 0);
      assert.ok(seed.background.trim().length > 0);
      assert.ok(seed.extraLines.length > 0);
    }
  });

  it("uses only ASCII letters in customer display names (no stray glyphs)", () => {
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
      assert.ok(
        /^[\x20-\x7e]+$/.test(seed.displayName),
        `${seed.customerNpcId} name has non-ASCII: ${seed.displayName}`
      );
    }
  });

  it("places every customer inside its business footprint at ground level", () => {
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.find(
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
      assert.ok(seed.waypoints.length >= 4);
      for (const [wx, wy, wz] of seed.waypoints) {
        assert.ok(
          wx >= site!.footprint.xMin + 2 && wx <= site!.footprint.xMax - 2
        );
        assert.ok(
          wz >= site!.footprint.zMin + 2 && wz <= site!.footprint.zMax - 2
        );
        assert.equal(wy, site!.groundY);
      }
    }
  });

  it("reserves an id band (9701+) clear of owners (9601-9619) and muckers (9451-9550)", () => {
    const ownerIds = new Set(
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((s) => Number(s.entityId))
    );
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
      assert.ok(
        seed.idOffset >= HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE,
        `${seed.customerNpcId} offset ${seed.idOffset} below band`
      );
      assert.ok(
        !ownerIds.has(Number(seed.entityId)),
        `${seed.customerNpcId} collides with an owner entity id`
      );
    }
  });

  it("passes its own structural validation", () => {
    assert.deepEqual(validateHarthmereBusinessCustomerNpcSeeds(), []);
  });
});
