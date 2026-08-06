import assert from "assert";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerQueueTarget,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  HARTHMERE_BUSINESS_STAFF_SIDE_TOLERANCE_METERS,
  HARTHMERE_BUSINESS_STAFF_STATION_RADIUS_METERS,
  harthmereBusinessPointIsStaffSide,
  harthmereBusinessStaffSideStationForPoint,
} from "@/shared/harthmere/business_aisle_keep_out";
import { HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS } from "@/shared/harthmere/business_interior_collision_seed";
import type { Vec3 } from "@/shared/math/types";

/**
 * The shift is played from behind the counter.
 *
 * Proximity alone was the only gate, and it is satisfied just as well from the
 * customer side — so a player could start and run a whole shift standing in the
 * queue's own lane, facing the wrong way, physically blocking the customers
 * they were meant to serve. The production HAR shows a shift started from the
 * side dashboard console at `(652, 65, -178)` rather than Greenlamp's audited
 * staff point at `(656.5, 65, -175)`.
 *
 * One row per business, so a single re-laid-out interior fails alone.
 */
describe("harthmere business staff-side shift station", () => {
  it("covers all nineteen audited businesses", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
  });

  for (const record of HARTHMERE_BUSINESS_INTERIORS) {
    describe(record.outpostId, () => {
      const points = harthmereBusinessInteriorInteractionPoints(record);

      it("accepts the audited staff point", () => {
        assert.ok(
          harthmereBusinessPointIsStaffSide(record, points.staff as Vec3),
          `${record.outpostId} staff point is not staff side`
        );
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(points.staff as Vec3)
            ?.outpostId,
          record.outpostId
        );
      });

      it("rejects the customer side of the counter", () => {
        // This is the whole point of the rule: near enough to serve, wrong side.
        assert.equal(
          harthmereBusinessPointIsStaffSide(record, points.customer as Vec3),
          false,
          `${record.outpostId} customer point counted as staff side`
        );
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(points.customer as Vec3),
          undefined
        );
      });

      it("accepts capsule contact just across the mathematical counter centre", () => {
        const boundary = (points.customer[2] + points.staff[2]) / 2;
        const staffDirection = points.staff[2] > points.customer[2] ? 1 : -1;
        const capsuleContact: Vec3 = [
          points.staff[0],
          points.staff[1],
          boundary -
            staffDirection *
              (HARTHMERE_BUSINESS_STAFF_SIDE_TOLERANCE_METERS - 0.05),
        ];
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(capsuleContact)?.outpostId,
          record.outpostId,
          `${record.outpostId} rejected a player visibly touching the staff side of the counter`
        );
      });

      it("rejects every queue slot and the doorway", () => {
        for (let queueIndex = 0; queueIndex < 3; queueIndex += 1) {
          const slot = harthmereBusinessCustomerQueueTarget(record, queueIndex);
          assert.equal(
            harthmereBusinessStaffSideStationForPoint(slot),
            undefined,
            `${record.outpostId} queue slot ${queueIndex} counted as a staff station`
          );
        }
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(points.entrance as Vec3),
          undefined
        );
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(
            harthmereBusinessCustomerSpawnPoint(record, 0)
          ),
          undefined
        );
      });

      it("puts the counter between the staff station and the customer", () => {
        // Sidedness is only meaningful if something collidable separates the
        // two points; otherwise "behind the counter" is decoration.
        const counter = HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.find(
          (candidate) =>
            candidate.outpostId === record.outpostId &&
            candidate.role === "service_counter"
        );
        assert.ok(counter, `${record.outpostId} has no collidable counter`);
        const boundary = (points.customer[2] + points.staff[2]) / 2;
        assert.ok(
          Math.abs(counter!.position[2] - boundary) <= 1.5,
          `${record.outpostId} counter at ${counter!.position[2]} does not sit on the staff/customer boundary ${boundary}`
        );
      });

      it("keeps the staff station reachable but not oversized", () => {
        // Generous enough not to pin the player to one voxel while serving,
        // tight enough that it cannot be satisfied from the aisle.
        const behind: Vec3 = [
          points.staff[0],
          points.staff[1],
          points.staff[2] +
            (points.staff[2] > points.customer[2] ? 1 : -1) * 1.5,
        ];
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(behind)?.outpostId,
          record.outpostId,
          `${record.outpostId} a step back from the counter must still serve`
        );
        const farBehind: Vec3 = [
          points.staff[0],
          points.staff[1],
          points.staff[2] +
            (points.staff[2] > points.customer[2] ? 1 : -1) *
              (HARTHMERE_BUSINESS_STAFF_STATION_RADIUS_METERS + 2),
        ];
        assert.equal(
          harthmereBusinessStaffSideStationForPoint(farBehind),
          undefined,
          `${record.outpostId} the far wall must not count as the counter`
        );
      });
    });
  }

  it("never resolves one business's staff station from another's", () => {
    // The outposts are far apart, but the lookup scans all 19; a sloppy
    // predicate would match the first record for any point in the world.
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const points = harthmereBusinessInteriorInteractionPoints(record);
      const resolved = harthmereBusinessStaffSideStationForPoint(
        points.staff as Vec3
      );
      assert.equal(resolved?.outpostId, record.outpostId);
    }
  });
});
