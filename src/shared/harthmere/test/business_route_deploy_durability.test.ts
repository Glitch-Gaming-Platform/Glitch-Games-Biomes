import assert from "assert";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  createHarthmereBusinessOutpostProceduralBuilding,
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS,
  buildHarthmereOutpostVoxelOccupancy,
  harthmereBusinessRouteClearance,
} from "@/shared/harthmere/business_route_clearance";
import {
  harthmereBusinessBlockedAisleForPoint,
  harthmereBusinessPostClearOfEveryAisle,
} from "@/shared/harthmere/business_aisle_keep_out";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import { buildHarthmereBusinessAisleNpcSweep } from "@/server/harthmere/business_aisle_npc_sweep";
import type { Vec3 } from "@/shared/math/types";

/**
 * Deploy and reconciliation durability.
 *
 * Every geometry fix for the in-world business simulation lives in the authored
 * generator or authored seed tables rather than in a repair pass. That choice
 * only pays off if the guarantees actually reproduce, so these rows assert the
 * three properties a deploy depends on:
 *
 * 1. **Determinism.** Regenerating a building yields byte-identical geometry, so
 *    a cold seed and a warm-Redis refresh cannot diverge.
 * 2. **Idempotence.** Re-running the keep-out sweep over already-corrected data
 *    is a no-op, so reconciliation converges instead of rewriting the same
 *    entities on every startup.
 * 3. **Reproduction.** Geometry rebuilt from the authored source — the path a
 *    reconciliation replay takes — still satisfies the route clearance
 *    contract, not just the module-level singleton captured at import time.
 *
 * Harthmere has been bitten twice by the opposite: seeder composition order
 * dropping a later writer's work, and a seedId-keyed placement map silently
 * undoing a moved structure. Both were invisible until a live run.
 */
describe("harthmere business route deploy durability", () => {
  const buildings = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS as Record<
    string,
    any
  >;

  it("covers all nineteen audited businesses", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
  });

  for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
    const record = HARTHMERE_BUSINESS_INTERIORS.find(
      (candidate) => candidate.outpostId === outpost.outpostId
    )!;

    describe(outpost.outpostId, () => {
      it("regenerates identical geometry on a second build", () => {
        // A warm refresh rebuilds from the same authored source. If generation
        // were order- or clock-dependent, the refreshed world would drift away
        // from the tested one and browser evidence would stop meaning anything.
        const first = createHarthmereBusinessOutpostProceduralBuilding(outpost);
        const second = createHarthmereBusinessOutpostProceduralBuilding(outpost);
        assert.equal(
          second.materializationPlan.edits.length,
          first.materializationPlan.edits.length,
          `${outpost.outpostId} edit count is not deterministic`
        );
        assert.deepEqual(
          second.materializationPlan.edits,
          first.materializationPlan.edits,
          `${outpost.outpostId} regenerated geometry differs`
        );
        assert.deepEqual(second.origin, first.origin);
        assert.deepEqual(second.entrance, first.entrance);
      });

      it("still clears the customer route when rebuilt from source", () => {
        // Deliberately rebuilt rather than read from the cached singleton: this
        // is the path a reconciliation replay takes.
        const rebuilt =
          createHarthmereBusinessOutpostProceduralBuilding(outpost);
        const points = harthmereBusinessInteriorInteractionPoints(record);
        const report = harthmereBusinessRouteClearance({
          outpostId: outpost.outpostId,
          occupancy: buildHarthmereOutpostVoxelOccupancy(
            rebuilt.materializationPlan
          ),
          doorX: rebuilt.entrance.x,
          surfaceY: rebuilt.origin.y,
          approachZ: Math.floor(points.entrance[2] - 10),
          counterZ: Math.floor(points.customer[2]),
        });
        assert.ok(
          report.passable,
          `${outpost.outpostId} rebuilt route clearance ${report.minFreeWidth} at z=${report.tightestRowZ}`
        );
        assert.ok(
          report.minFreeWidth >= HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS
        );
      });

      it("keeps the cached and rebuilt door axis in agreement", () => {
        // The cached singleton is what the client renderer and the interaction
        // anchors read; the rebuilt plan is what the world gets. A divergence
        // means the door the player sees is not the door customers walk.
        const rebuilt =
          createHarthmereBusinessOutpostProceduralBuilding(outpost);
        assert.deepEqual(
          [rebuilt.entrance.x, rebuilt.entrance.y, rebuilt.entrance.z],
          [
            buildings[outpost.outpostId].entrance.x,
            buildings[outpost.outpostId].entrance.y,
            buildings[outpost.outpostId].entrance.z,
          ]
        );
      });
    });
  }

  describe("reconciliation convergence", () => {
    it("is a no-op over already-corrected owner posts", () => {
      // If the sweep disagreed with the authored fix, every startup would
      // rewrite all nineteen owners forever and the world would never settle.
      const candidates = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((owner) => ({
        id: owner.entityId,
        position: owner.position as Vec3,
      }));
      const first = buildHarthmereBusinessAisleNpcSweep({ candidates });
      assert.deepEqual(first.changes, []);
      assert.deepEqual(first.unresolved, []);
    });

    it("converges after one pass for a body authored in a lane", () => {
      const record = HARTHMERE_BUSINESS_INTERIORS[0];
      const points = harthmereBusinessInteriorInteractionPoints(record);
      const inLane: Vec3 = [
        points.customer[0],
        points.customer[1],
        points.customer[2],
      ];
      const moved = harthmereBusinessPostClearOfEveryAisle(inLane);
      assert.equal(harthmereBusinessBlockedAisleForPoint(moved), undefined);
      // Second pass must not move it again: reconciliation has to reach a fixed
      // point, not oscillate between two legal posts on alternating startups.
      const settled = harthmereBusinessPostClearOfEveryAisle(moved);
      assert.deepEqual(settled, moved);
      const sweep = buildHarthmereBusinessAisleNpcSweep({
        candidates: [{ id: 6001 as any, position: moved }],
      });
      assert.deepEqual(sweep.changes, []);
    });
  });
});
