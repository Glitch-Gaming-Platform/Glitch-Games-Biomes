import {
  landTabPlotCategoryV1,
  landTabPlotCenterV1,
} from "@/client/components/biomes_ui/tabs/landTabPlotCategoryV1";
import type { BuildingSystemPlotDefinitionV1 } from "@/shared/harthmere/building_system_v1";
import assert from "assert";

describe("Land tab Homes/Business split", () => {
  it("classifies residential as homes and everything else as business", () => {
    assert.equal(landTabPlotCategoryV1("residential"), "homes");
    for (const plotType of [
      "commercial",
      "guild",
      "crafting",
      "farm",
      "public",
    ] as const) {
      assert.equal(landTabPlotCategoryV1(plotType), "business");
    }
  });

  it("computes the plot center from its bounds", () => {
    const plot = {
      bounds: { xMin: 10, xMax: 20, zMin: -40, zMax: -30 },
      groundY: 54,
    } as BuildingSystemPlotDefinitionV1;
    assert.deepEqual(landTabPlotCenterV1(plot), [15, 56, -35]);
  });
});
