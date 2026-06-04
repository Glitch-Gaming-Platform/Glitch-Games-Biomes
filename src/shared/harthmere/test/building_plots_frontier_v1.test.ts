import { BUILDING_SYSTEM_PLOTS_V1 } from "@/shared/harthmere/building_system_v1";
import assert from "assert";

describe("Building System for-sale plots live outside the Grove", () => {
  it("no plot is in the_grove and none names the Grove", () => {
    for (const plot of BUILDING_SYSTEM_PLOTS_V1) {
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
    const districts = BUILDING_SYSTEM_PLOTS_V1.map((plot) => plot.district);
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
    for (const plot of BUILDING_SYSTEM_PLOTS_V1) {
      const cx = (plot.bounds.xMin + plot.bounds.xMax) / 2;
      const cz = (plot.bounds.zMin + plot.bounds.zMax) / 2;
      assert.ok(
        !inGroveCluster(cx, cz),
        `${plot.plotId} center ${cx},${cz} is still in the Grove cluster`
      );
    }
  });
});
