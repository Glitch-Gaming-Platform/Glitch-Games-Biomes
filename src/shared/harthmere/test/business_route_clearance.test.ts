import assert from "assert";
import {
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  HARTHMERE_BUSINESS_OUTPOSTS,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS,
  harthmereBusinessRouteClearanceForRecord,
} from "@/shared/harthmere/business_route_clearance";

describe("Harthmere business native customer route clearance", () => {
  for (const record of HARTHMERE_BUSINESS_INTERIORS) {
    it(`${record.outpostId} matches the audited shell and clears the full route`, () => {
      const building =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[record.outpostId];
      assert.ok(building, `${record.outpostId} building`);
      assert.deepEqual(
        {
          width: building.blueprint.footprint.width,
          depth: building.blueprint.footprint.depth,
          floors: record.footprint.floors,
        },
        record.footprint
      );
      assert.deepEqual(
        [building.origin.x, building.origin.y + 1, building.origin.z],
        record.assetWorldAnchor
      );

      const points = harthmereBusinessInteriorInteractionPoints(record);
      assert.deepEqual(
        [
          building.entrance.x + 0.5,
          building.entrance.y,
          building.entrance.z + 0.5,
        ],
        points.entrance,
        `${record.outpostId} real door`
      );
      assert.deepEqual(
        [
          building.serviceCounter.x + 0.5,
          building.serviceCounter.y,
          building.serviceCounter.z + 0.5,
        ],
        record.deskWorldPivot,
        `${record.outpostId} real counter`
      );

      const clearance = harthmereBusinessRouteClearanceForRecord({
        record,
        plan: building.materializationPlan,
        doorX: building.entrance.x,
        surfaceY: building.origin.y,
      });
      assert.equal(
        clearance.passable,
        true,
        `${record.outpostId}: tightest row z=${clearance.tightestRowZ}, width=${clearance.minFreeWidth}`
      );
      assert.ok(
        clearance.minFreeWidth >= HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS,
        record.outpostId
      );
    });
  }

  it("keeps Redpot restaurant-only", () => {
    const redpot = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (outpost) => outpost.outpostId === "outpost_restaurant_redpot"
    );
    assert.ok(redpot);
    assert.equal(redpot.building.profile, "restaurant");
    assert.notEqual(redpot.building.profile, "bakery");
  });
});
