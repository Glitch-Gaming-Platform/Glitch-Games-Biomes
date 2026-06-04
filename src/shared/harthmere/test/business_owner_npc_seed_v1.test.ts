import assert from "assert";

import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import {
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1,
  harthmereBusinessOwnerMarkerIdV151,
  isHarthmereBusinessOwnerNpcEntityIdV1,
  validateHarthmereBusinessOwnerNpcSeedsV1,
} from "@/shared/harthmere/business_owner_npc_seed_v1";
import { harthmereJobsBoardQuestMarkerPositionForIdV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";

describe("business owner NPC seeds", () => {
  it("defines exactly one owner per outpost business", () => {
    assert.equal(
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.length,
      HARTHMERE_BUSINESS_OUTPOSTS_V1.length
    );
    const outpostIds = new Set(
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.map((seed) => seed.outpostId)
    );
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      assert.ok(
        outpostIds.has(outpost.outpostId),
        `no owner seeded for ${outpost.outpostId}`
      );
    }
  });

  it("matches each owner to the outpost's authored ownerNpcId", () => {
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
      const outpost = HARTHMERE_BUSINESS_OUTPOSTS_V1.find(
        (candidate) => candidate.outpostId === seed.outpostId
      );
      assert.ok(outpost);
      assert.equal(seed.ownerNpcId, outpost!.ownerNpcId);
      assert.equal(seed.businessName, outpost!.displayName);
    }
  });

  it("gives every owner a unique entity id, offset, and human name", () => {
    const ids = new Set(HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.map((s) => s.entityId));
    const offsets = new Set(HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.map((s) => s.idOffset));
    const names = new Set(HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.map((s) => s.displayName));
    assert.equal(ids.size, HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.length);
    assert.equal(offsets.size, HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.length);
    assert.equal(names.size, HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.length);
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
      assert.ok(seed.displayName.trim().length > 0);
      assert.ok(seed.line.trim().length > 0);
    }
  });

  it("places every owner inside its business building footprint at ground level", () => {
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1.find(
        (candidate) => candidate.outpostId === seed.outpostId
      );
      assert.ok(site);
      const [x, y, z] = seed.position;
      assert.ok(
        x >= site!.footprint.xMin && x <= site!.footprint.xMax,
        `${seed.outpostId} owner X ${x} outside footprint`
      );
      assert.ok(
        z >= site!.footprint.zMin && z <= site!.footprint.zMax,
        `${seed.outpostId} owner Z ${z} outside footprint`
      );
      assert.equal(y, site!.groundY, `${seed.outpostId} owner not on ground`);
    }
  });

  it("does not collide id offsets with grove (9301+), robots (9401+), or muck monsters (9451-9550)", () => {
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
      assert.ok(
        seed.idOffset >= 9601,
        `${seed.ownerNpcId} offset ${seed.idOffset} overlaps a reserved band`
      );
    }
  });

  it("passes its own structural validation", () => {
    assert.deepEqual(validateHarthmereBusinessOwnerNpcSeedsV1(), []);
  });

  it("grounds every owner on the building floor (not floating/buried)", () => {
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1.find(
        (candidate) => candidate.outpostId === seed.outpostId
      );
      assert.ok(site, `missing safe site for ${seed.outpostId}`);
      // Authored at the building floor Y — the grounding system keeps them here.
      assert.equal(seed.position[1], site?.groundY, `${seed.ownerNpcId} off-floor`);
      assert.ok(
        Number.isFinite(seed.position[0]) && Number.isFinite(seed.position[2])
      );
      // Recognized by the grounding path that uses requireOpenSky=false (floor,
      // not roof) — so owners never float onto the roof or bury under it.
      assert.equal(
        isHarthmereBusinessOwnerNpcEntityIdV1(seed.entityId),
        true,
        `${seed.ownerNpcId} not recognized as a business owner for grounding`
      );
    }
  });

  it("exposes every owner as a resolvable map marker (for delivery recipients)", () => {
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
      const markerId = harthmereBusinessOwnerMarkerIdV151(seed.ownerNpcId);
      const marker = harthmereJobsBoardQuestMarkerPositionForIdV1(markerId);
      assert.ok(marker, `owner ${seed.ownerNpcId} must resolve as a marker`);
      assert.equal(marker?.source, "business_owner");
    }
  });
});
