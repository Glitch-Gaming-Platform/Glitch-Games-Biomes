/// <reference types="mocha" />
import assert from "assert";
import {
  BUILDING_SYSTEM_PLOTS,
  buildingSystemPlotBoundsById,
  isPositionInsideBuildingSystemPlotBounds,
} from "../building_system";

// HARTHMERE owned-property safe-zone geometry
// Underpins the fix that makes a player-owned, secured property actually muck-
// safe: the safeZones map stores only a string label, so muck safety resolves
// plot bounds by id and tests containment.
describe("building system plot bounds (owned safe zone geometry)", () => {
  it("resolves authored bounds by plot id", () => {
    const plot = BUILDING_SYSTEM_PLOTS[0];
    const bounds = buildingSystemPlotBoundsById(plot.plotId);
    assert.deepStrictEqual(bounds, plot.bounds);
  });

  it("returns undefined for unknown plot ids (e.g. robot-area safe-zone keys)", () => {
    assert.strictEqual(
      buildingSystemPlotBoundsById("west_muck_breach"),
      undefined
    );
    assert.strictEqual(buildingSystemPlotBoundsById(""), undefined);
  });

  it("treats a point inside the plot bounds as contained (inclusive edges)", () => {
    const plot = BUILDING_SYSTEM_PLOTS[0];
    const b = plot.bounds;
    const center = { x: (b.xMin + b.xMax) / 2, z: (b.zMin + b.zMax) / 2 };
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBounds(b, center),
      true
    );
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBounds(b, { x: b.xMin, z: b.zMax }),
      true
    );
  });

  it("treats points outside the bounds (or with missing bounds) as not contained", () => {
    const plot = BUILDING_SYSTEM_PLOTS[0];
    const b = plot.bounds;
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBounds(b, {
        x: b.xMax + 1,
        z: b.zMin,
      }),
      false
    );
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBounds(undefined, { x: 0, z: 0 }),
      false
    );
    assert.strictEqual(
      isPositionInsideBuildingSystemPlotBounds(b, {
        x: NaN,
        z: 0,
      }),
      false
    );
  });

  it("every plot has well-formed bounds (min < max on both axes)", () => {
    for (const plot of BUILDING_SYSTEM_PLOTS) {
      assert.ok(plot.bounds.xMin < plot.bounds.xMax, `${plot.plotId} x`);
      assert.ok(plot.bounds.zMin < plot.bounds.zMax, `${plot.plotId} z`);
    }
  });
});
