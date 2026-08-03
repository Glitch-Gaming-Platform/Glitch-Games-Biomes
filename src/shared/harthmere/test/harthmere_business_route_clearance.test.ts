import assert from "assert";
import { HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS } from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerDeparturePoint,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS,
  HARTHMERE_NPC_BODY_WIDTH_METERS,
  buildHarthmereOutpostVoxelOccupancy,
  harthmereBusinessDoorJambColumns,
  harthmereBusinessDoorwayColumns,
  harthmereBusinessRouteClearance,
} from "@/shared/harthmere/business_route_clearance";

/**
 * The regression gate for the defect that blocked the whole in-world business
 * simulation: a one-voxel front door that a one-metre NPC body could not walk
 * through. Every business gets its own row, so a single restyled storefront
 * fails alone and is resumable, instead of collapsing the matrix.
 *
 * This is a pure-data contract over the authored materialization plan — the
 * same plan the seeder and any world reconciliation replay — so it belongs in
 * the fast lane and needs no server bootstrap. See `TESTING_FASTER.md`.
 */
describe("harthmere business customer route clearance", () => {
  const buildings = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS as Record<
    string,
    {
      origin: { x: number; y: number; z: number };
      entrance: { x: number; y: number; z: number };
      materializationPlan: { edits: ReadonlyArray<unknown> };
    }
  >;

  function clearanceFor(outpostId: string) {
    const record = HARTHMERE_BUSINESS_INTERIORS.find(
      (candidate) => candidate.outpostId === outpostId
    )!;
    const building = buildings[outpostId];
    const points = harthmereBusinessInteriorInteractionPoints(record);
    return harthmereBusinessRouteClearance({
      outpostId,
      occupancy: buildHarthmereOutpostVoxelOccupancy(
        building.materializationPlan as any
      ),
      doorX: building.entrance.x,
      surfaceY: building.origin.y,
      // The authored spawn point sits ~9.5 m outside the door; measure a little
      // past it so the whole walked approach is covered, not just the apron.
      approachZ: Math.floor(points.entrance[2] - 10),
      counterZ: Math.floor(points.customer[2]),
    });
  }

  it("covers all nineteen audited businesses", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      assert.ok(
        buildings[record.outpostId],
        `${record.outpostId} has no procedural building`
      );
    }
  });

  it("keeps the doorway wider than the native body", () => {
    // The body is exactly one voxel wide, so a one-voxel opening is
    // face-coincident on both sides and not traversable. The contract is that
    // the opening always leaves at least a full voxel of margin.
    assert.ok(
      HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS >=
        HARTHMERE_NPC_BODY_WIDTH_METERS + 2,
      "minimum route clearance must leave a voxel of margin either side"
    );
    assert.deepEqual(harthmereBusinessDoorwayColumns(100), [99, 100, 101]);
    assert.deepEqual(harthmereBusinessDoorJambColumns(100), [98, 102]);
  });

  for (const record of HARTHMERE_BUSINESS_INTERIORS) {
    describe(record.outpostId, () => {
      it("has a traversable lane from the approach to the counter", () => {
        const report = clearanceFor(record.outpostId);
        const tight = report.rows.filter(
          (row) => row.freeWidth < HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS
        );
        assert.deepEqual(
          tight.map(
            (row) =>
              `z=${row.z} free=${row.freeWidth} blocked_by=${row.blockingLabels.join("/")}`
          ),
          [],
          `${record.outpostId} route is obstructed`
        );
        assert.ok(
          report.passable,
          `${record.outpostId} minimum clearance ${report.minFreeWidth} at z=${report.tightestRowZ}`
        );
      });

      it("keeps the door opening centred on the authored door axis", () => {
        const report = clearanceFor(record.outpostId);
        const building = buildings[record.outpostId];
        const doorRow = report.rows.find(
          (row) => row.z === building.origin.z
        );
        assert.ok(doorRow, "door row is inside the measured route");
        assert.ok(
          doorRow!.freeRange,
          `${record.outpostId} door row has no free span`
        );
        const { minX, maxX } = doorRow!.freeRange!;
        assert.ok(
          minX <= building.entrance.x && maxX >= building.entrance.x,
          `${record.outpostId} free span ${minX}..${maxX} does not contain door axis ${building.entrance.x}`
        );
      });

      it("grades a standable pad under every spawn and departure anchor", () => {
        // The apron is sized to contain the whole authored spawn fan and both
        // departure points. If a future route change fans customers wider than
        // the graded pad, they spawn on raw hilly terrain at an authored Y and
        // the old "customer never moves" class of failure comes straight back.
        const interior = HARTHMERE_BUSINESS_INTERIORS.find(
          (candidate) => candidate.outpostId === record.outpostId
        )!;
        const building = buildings[record.outpostId];
        const occupancy = buildHarthmereOutpostVoxelOccupancy(
          building.materializationPlan as any
        );
        for (let queueIndex = 0; queueIndex < 4; queueIndex += 1) {
          for (const [label, point] of [
            ["spawn", harthmereBusinessCustomerSpawnPoint(interior, queueIndex)],
            [
              "departure",
              harthmereBusinessCustomerDeparturePoint(interior, queueIndex),
            ],
          ] as const) {
            const foot = occupancy.footLevel(
              Math.floor(point[0]),
              Math.floor(point[2]),
              building.origin.y + 1
            );
            assert.equal(
              foot,
              building.origin.y + 1,
              `${record.outpostId} ${label}[${queueIndex}] at ${point.join(",")} is not on the graded apron`
            );
          }
        }
      });

      it("does not obstruct the customer, staff or queue anchors", () => {
        const interior = HARTHMERE_BUSINESS_INTERIORS.find(
          (candidate) => candidate.outpostId === record.outpostId
        )!;
        const building = buildings[record.outpostId];
        const occupancy = buildHarthmereOutpostVoxelOccupancy(
          building.materializationPlan as any
        );
        const points = harthmereBusinessInteriorInteractionPoints(interior);
        for (const [label, point] of Object.entries(points)) {
          // Customer, staff, queue and entrance anchors must all be somewhere a
          // body can actually stand, or the simulation parks an NPC inside a
          // fixture and physics fights it forever.
          const foot = occupancy.footLevel(
            Math.floor(point[0]),
            Math.floor(point[2]),
            building.origin.y + 1
          );
          assert.ok(
            foot !== undefined,
            `${record.outpostId} ${label} anchor at ${point.join(",")} is not standable`
          );
        }
      });
    });
  }
});
