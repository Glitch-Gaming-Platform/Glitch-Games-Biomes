import assert from "assert";
import businessInteriorManifest from "../../../../public/assets/harthmere/manifest/business-interiors.json";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
} from "../business_customer_simulator";

type Point3 = readonly [number, number, number];

function localToWorld(
  origin: readonly number[],
  point: readonly number[]
): Point3 {
  return [origin[0] + point[0], origin[1] + 1 + point[2], origin[2] + point[1]];
}

function voxelCellCenter(point: { x: number; y: number; z: number }): Point3 {
  return [point.x + 0.5, point.y, point.z + 0.5];
}

function fixtureBounds(fixture: {
  location: number[];
  size: number[];
  rotationDegrees: number;
}) {
  const angle = (fixture.rotationDegrees * Math.PI) / 180;
  const halfX =
    (Math.abs(Math.cos(angle)) * fixture.size[0] +
      Math.abs(Math.sin(angle)) * fixture.size[1]) /
    2;
  const halfY =
    (Math.abs(Math.sin(angle)) * fixture.size[0] +
      Math.abs(Math.cos(angle)) * fixture.size[1]) /
    2;
  return {
    xMin: fixture.location[0] - halfX,
    xMax: fixture.location[0] + halfX,
    yMin: fixture.location[1] - halfY,
    yMax: fixture.location[1] + halfY,
    zMin: fixture.location[2],
    zMax: fixture.location[2] + fixture.size[2],
  };
}

describe("Harthmere Blender interior placement against native outpost shells", () => {
  it("places every authored fixture inside the exact current 19-building records", () => {
    assert.equal(businessInteriorManifest.businesses.length, 19);
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);

    const seenOutposts = new Set<string>();
    for (const business of businessInteriorManifest.businesses) {
      const outpost = HARTHMERE_BUSINESS_OUTPOSTS.find(
        (candidate) => candidate.businessType === business.businessType
      );
      assert.ok(outpost, `${business.slug} has no native outpost`);
      assert.equal(business.outpostId, outpost!.outpostId);
      assert.equal(seenOutposts.has(outpost!.outpostId), false);
      seenOutposts.add(outpost!.outpostId);

      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost!.outpostId];
      assert.ok(record, `${business.outpostId} has no procedural shell`);
      assert.deepEqual(business.shellOrigin, [
        record.origin.x,
        record.origin.y,
        record.origin.z,
      ]);
      assert.deepEqual(business.footprint, {
        width: record.blueprint.footprint.width,
        depth: record.blueprint.footprint.depth,
        floors: outpost!.building.floors,
      });
      assert.deepEqual(business.assetWorldAnchor, [
        record.origin.x,
        record.origin.y + 1,
        record.origin.z,
      ]);

      assert.deepEqual(
        localToWorld(business.shellOrigin, business.interactionPoints.entrance),
        voxelCellCenter(record.entrance),
        `${business.slug} entrance`
      );
      assert.deepEqual(
        localToWorld(
          business.shellOrigin,
          business.interactionPoints.queueStart
        ),
        voxelCellCenter(record.queueNode),
        `${business.slug} queue start`
      );
      assert.deepEqual(
        business.deskWorldPivot,
        voxelCellCenter(record.serviceCounter),
        `${business.slug} desk pivot`
      );

      const customerWorld = localToWorld(
        business.shellOrigin,
        business.interactionPoints.customer
      );
      const staffWorld = localToWorld(
        business.shellOrigin,
        business.interactionPoints.staff
      );
      assert.equal(customerWorld[0], business.deskWorldPivot[0]);
      assert.equal(staffWorld[0], business.deskWorldPivot[0]);
      assert.ok(customerWorld[2] < business.deskWorldPivot[2]);
      assert.ok(staffWorld[2] > business.deskWorldPivot[2]);
      assert.ok(business.deskWorldPivot[2] - customerWorld[2] >= 1.3);
      assert.ok(staffWorld[2] - business.deskWorldPivot[2] >= 1.4);

      const serviceCounters = business.fixtures.filter(
        (fixture) => fixture.role === "service_counter"
      );
      assert.equal(
        serviceCounters.length,
        1,
        `${business.slug} must have exactly one front counter`
      );
      assert.deepEqual(
        localToWorld(business.shellOrigin, serviceCounters[0].location),
        business.deskWorldPivot,
        `${business.slug} counter mesh must use the audited desk pivot`
      );
      assert.ok(
        business.fixtures.some((fixture) => fixture.role === "primary_station"),
        `${business.slug} needs a profession-specific hero station`
      );
      assert.ok(
        business.fixtures.some(
          (fixture) =>
            fixture.role === "stock_storage" || fixture.role === "workstation"
        ),
        `${business.slug} needs usable stock or work furniture`
      );
      assert.ok(
        business.fixtures.some((fixture) => fixture.role === "seating"),
        `${business.slug} needs customer/staff seating`
      );

      let upperFloorFixtures = 0;
      for (const fixture of business.fixtures) {
        const bounds = fixtureBounds(fixture);
        assert.ok(bounds.xMin >= 0, `${business.slug}/${fixture.label} xMin`);
        assert.ok(
          bounds.xMax <= business.footprint.width,
          `${business.slug}/${fixture.label} xMax`
        );
        assert.ok(bounds.yMin >= 0, `${business.slug}/${fixture.label} yMin`);
        assert.ok(
          bounds.yMax <= business.footprint.depth,
          `${business.slug}/${fixture.label} yMax`
        );
        assert.ok(bounds.zMin >= 0, `${business.slug}/${fixture.label} zMin`);
        assert.ok(
          bounds.zMax <= business.footprint.floors * 4,
          `${business.slug}/${fixture.label} exceeds building floors`
        );
        if (fixture.location[2] >= 4) upperFloorFixtures += 1;

        const worldLocation = localToWorld(
          business.shellOrigin,
          fixture.location
        );
        assert.ok(
          worldLocation[0] >= record.origin.x &&
            worldLocation[0] <=
              record.origin.x + record.blueprint.footprint.width,
          `${business.slug}/${fixture.label} world X`
        );
        assert.ok(
          worldLocation[2] >= record.origin.z &&
            worldLocation[2] <=
              record.origin.z + record.blueprint.footprint.depth,
          `${business.slug}/${fixture.label} world Z`
        );
      }

      if (business.footprint.floors > 1) {
        assert.ok(
          upperFloorFixtures >= 4,
          `${business.slug} needs a furnished upper floor`
        );
      } else {
        assert.equal(
          upperFloorFixtures,
          0,
          `${business.slug} must not float furniture above a one-floor shell`
        );
      }
    }
    assert.equal(seenOutposts.size, 19);
  });
});
