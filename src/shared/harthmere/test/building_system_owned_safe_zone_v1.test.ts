/// <reference types="mocha" />
import assert from "assert";
import {
  BUILDING_SYSTEM_PLOTS_V1,
  buildingSystemPlotBoundsByIdV1,
  isPositionInsideBuildingSystemPlotBoundsV1,
} from "../building_system_v1";

// HARTHMERE owned-property safe-zone geometry
// Underpins the fix that makes a player-owned, secured property actually muck-
// safe: the safeZones map stores only a string label, so muck safety resolves
// plot bounds by id and tests containment.
describe("building system plot bounds (owned safe zone geometry)", () => {
  it("resolves authored bounds by plot id", () => {
    const plot = BUILDING_SYSTEM_PLOTS_V1[0];
    const bounds = buildingSystemPlotBoundsByIdV1(plot.plotId);
    assert.deepStrictEqual(bounds, plot.bounds);
  });

  it("returns undefined for unknown plot ids (e.g. robot-area safe-zone keys)", () => {
    assert.strictEqual(
      buildingSystemPlotBoundsByIdV1("west_muck_breach"),
      undefined
    );
    assert.strictEqual(buildingSystemPlotBoundsByIdV1(""), undefined);
  });

  it("treats a point inside the plot bounds as contained (inclusive edges)", () => {
    const plot = BUILDING_SYSTEM_PLOTS_V1[0];
    const b = plot.bounds;
    const center = { x: (b.xMin + b.xMax) / 2, z: (b.zMin + b.zMax) / 2 };
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBoundsV1(b, center),
      true
    );
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBoundsV1(b, { x: b.xMin, z: b.zMax }),
      true
    );
  });

  it("treats points outside the bounds (or with missing bounds) as not contained", () => {
    const plot = BUILDING_SYSTEM_PLOTS_V1[0];
    const b = plot.bounds;
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBoundsV1(b, {
        x: b.xMax + 1,
        z: b.zMin,
      }),
      false
    );
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBoundsV1(undefined, { x: 0, z: 0 }),
      false
    );
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBoundsV1(b, {
        x: NaN,
        z: 0,
      }),
      false
    );
  });

  it("every plot has well-formed bounds (min < max on both axes)", () => {
    for (const plot of BUILDING_SYSTEM_PLOTS_V1) {
      assert.ok(plot.bounds.xMin < plot.bounds.xMax, `${plot.plotId} x`);
      assert.ok(plot.bounds.zMin < plot.bounds.zMax, `${plot.plotId} z`);
    }
  });
});
