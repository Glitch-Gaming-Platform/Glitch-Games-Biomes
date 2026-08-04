import assert from "assert";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  HARTHMERE_BUSINESS_CUSTOMER_COUNTER_CLEARANCE_METERS,
  createHarthmereBusinessCustomerSpatialIntent,
  harthmereBusinessCustomerDeparturePoint,
  harthmereBusinessCustomerQueueTarget,
  harthmereBusinessCustomerSessionEntityId,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessInteriorContainingPosition,
  harthmereBusinessInteriorContainsPosition,
  harthmereBusinessInteriorInteractionPoints,
  validateHarthmereBusinessInteriorRuntimeContract,
} from "../business_interior_runtime";

describe("Harthmere business interior runtime matrix", () => {
  it("covers all 19 audited interiors with exact anchors and LOD policy", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    assert.deepEqual(validateHarthmereBusinessInteriorRuntimeContract(), []);
    const outposts = new Set<string>();
    const types = new Set<string>();
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      assert.ok(!outposts.has(record.outpostId), record.outpostId);
      assert.ok(!types.has(record.businessType), record.businessType);
      outposts.add(record.outpostId);
      types.add(record.businessType);
      assert.deepEqual(record.assetWorldAnchor, [
        record.shellOrigin[0],
        record.shellOrigin[1] + 1,
        record.shellOrigin[2],
      ]);
      const points = harthmereBusinessInteriorInteractionPoints(record);
      assert.deepEqual(points.staff, [
        record.deskWorldPivot[0],
        record.deskWorldPivot[1],
        record.shellOrigin[2] + record.interactionPoints.staff[1],
      ]);
      assert.ok(points.customer[2] < points.staff[2]);
      const counter = record.collisionBoxes.find(
        (box) => box.role === "service_counter"
      );
      assert.ok(counter);
      const customerFace =
        record.assetWorldAnchor[2] + counter!.center[1] - counter!.size[1] / 2;
      assert.ok(
        customerFace - points.customer[2] >=
          HARTHMERE_BUSINESS_CUSTOMER_COUNTER_CLEARANCE_METERS - 0.001,
        `${record.outpostId} customer point intersects the furniture boundary`
      );
      assert.equal(record.lodPolicy.lod0MaxDistanceMeters, 16);
      assert.equal(record.lodPolicy.lod1MaxDistanceMeters, 28);
      assert.equal(record.lodPolicy.hiddenBeyondMeters, 28);
    }
  });

  it("builds spaced door, queue, counter, exit routes for every business", () => {
    const ids = new Set<number>();
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const points = harthmereBusinessInteriorInteractionPoints(record);
      const spawn = harthmereBusinessCustomerSpawnPoint(record, 0);
      const departure = harthmereBusinessCustomerDeparturePoint(record, 0);
      assert.deepEqual(
        spawn,
        points.entrance,
        `${record.outpostId} lead customer must materialize at the audited door`
      );
      assert.ok(departure[2] < points.entrance[2], record.outpostId);
      const targets = Array.from({ length: 12 }, (_, index) =>
        harthmereBusinessCustomerQueueTarget(record, index)
      );
      for (let index = 1; index < targets.length; index += 1) {
        assert.ok(
          Math.hypot(
            targets[index][0] - targets[index - 1][0],
            targets[index][2] - targets[index - 1][2]
          ) >= 1.45,
          `${record.outpostId}: queue spacing ${index}`
        );
      }
      const entityId = harthmereBusinessCustomerSessionEntityId({
        actorId: "matrix_actor",
        sessionId: `session_${record.outpostId}`,
        ticketId: "ticket_1",
      });
      assert.ok(!ids.has(Number(entityId)), record.outpostId);
      ids.add(Number(entityId));
      const entering = createHarthmereBusinessCustomerSpatialIntent({
        record,
        sessionId: `session_${record.outpostId}`,
        ticketId: "ticket_1",
        entityId,
        queueIndex: 0,
        phase: "entering",
      });
      assert.deepEqual(entering.waypoints, [
        points.entrance,
        points.queueStart,
        points.customer,
      ]);
      const departing = createHarthmereBusinessCustomerSpatialIntent({
        record,
        sessionId: `session_${record.outpostId}`,
        ticketId: "ticket_1",
        entityId,
        queueIndex: 0,
        phase: "departing",
      });
      assert.deepEqual(departing.waypoints.slice(0, 2), [
        points.queueStart,
        points.entrance,
      ]);
      assert.deepEqual(departing.waypoints.at(-1), departure);
    }
  });

  it("detects entering and leaving the authored footprint for all 19 businesses", () => {
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const inside = {
        x: record.assetWorldAnchor[0] + record.footprint.width / 2,
        y: record.assetWorldAnchor[1],
        z: record.assetWorldAnchor[2] + record.footprint.depth / 2,
      };
      assert.equal(
        harthmereBusinessInteriorContainsPosition(record, inside),
        true,
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorContainingPosition(inside)?.outpostId,
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorContainsPosition(record, {
          ...inside,
          x: record.assetWorldAnchor[0] - 0.01,
        }),
        false,
        `${record.outpostId}: west exit`
      );
      assert.equal(
        harthmereBusinessInteriorContainsPosition(record, {
          ...inside,
          z: record.assetWorldAnchor[2] + record.footprint.depth,
        }),
        false,
        `${record.outpostId}: north exit`
      );
    }
  });

  it("preserves the corrected expanded/Cinderlane/Redpot contracts", () => {
    const expanded = HARTHMERE_BUSINESS_INTERIORS.filter(
      (record) => record.expandedFromCurrent
    ).map((record) => record.outpostId);
    assert.deepEqual(expanded, [
      "outpost_biome_repair_north",
      "outpost_clinic_greenlamp",
      "outpost_repair_hingehall",
      "outpost_restaurant_redpot",
      "outpost_courier_stampspur",
    ]);
    const cinderlane = HARTHMERE_BUSINESS_INTERIORS.find(
      (record) => record.outpostId === "outpost_tools_cinderlane"
    )!;
    const drawers = cinderlane.fixtures.find((fixture) =>
      fixture.label.toLowerCase().includes("drawers")
    )!;
    assert.deepEqual(drawers.location.slice(0, 2), [7.4, 12]);
    const redpot = HARTHMERE_BUSINESS_INTERIORS.find(
      (record) => record.outpostId === "outpost_restaurant_redpot"
    )!;
    assert.ok(
      redpot.fixtures.some((fixture) =>
        /range|hearth|prep|pantry|dining|wash/i.test(fixture.label)
      )
    );
    assert.ok(
      redpot.fixtures.every((fixture) => !/bakery/i.test(fixture.label))
    );
  });
});
