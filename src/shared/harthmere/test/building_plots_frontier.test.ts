import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";
import { HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP } from "@/shared/harthmere/generated/production_terrain_placement_map";
import assert from "assert";

describe("Building System for-sale plots live outside the Grove", () => {
  it("no plot is in the_grove and none names the Grove", () => {
    for (const plot of BUILDING_SYSTEM_PLOTS) {
      assert.notEqual(
        plot.area,
        "the_grove",
        `${plot.plotId} is still area "the_grove"`
      );
      assert.ok(
        !/grove/i.test(plot.district),
        `${plot.plotId} district "${plot.district}" still references the Grove`
      );
    }
  });

  it("each plot has a unique designated district", () => {
    const districts = BUILDING_SYSTEM_PLOTS.map((plot) => plot.district);
    assert.equal(
      new Set(districts).size,
      districts.length,
      "districts must be unique"
    );
  });

  it("plot centers are outside the old Grove cluster", () => {
    // The old Grove cluster sat at x≈472-550, z≈-218..-106.
    const inGroveCluster = (x: number, z: number) =>
      x >= 460 && x <= 560 && z >= -230 && z <= -95;
    for (const plot of BUILDING_SYSTEM_PLOTS) {
      const cx = (plot.bounds.xMin + plot.bounds.xMax) / 2;
      const cz = (plot.bounds.zMin + plot.bounds.zMax) / 2;
      assert.ok(
        !inGroveCluster(cx, cz),
        `${plot.plotId} center ${cx},${cz} is still in the Grove cluster`
      );
    }
  });

  it("for-sale plot bounds do not cover known production markers", () => {
    for (const plot of BUILDING_SYSTEM_PLOTS) {
      const overlaps = HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.placements
        .filter((placement) => {
          const [x, , z] = placement.recommendedPosition;
          return (
            x >= plot.bounds.xMin &&
            x <= plot.bounds.xMax &&
            z >= plot.bounds.zMin &&
            z <= plot.bounds.zMax
          );
        })
        .map((placement) => `${placement.source}:${placement.id}`);
      assert.deepStrictEqual(overlaps, [], `${plot.plotId} overlaps markers`);
    }
  });
});
