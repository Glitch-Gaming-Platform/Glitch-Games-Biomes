import {
  landTabPlotCategory,
  landTabPlotCenter,
} from "@/client/components/biomes_ui/tabs/landTabPlotCategory";
import type { BuildingSystemPlotDefinition } from "@/shared/harthmere/building_system";
import assert from "assert";

describe("Land tab Homes/Business split", () => {
  it("classifies residential as homes and everything else as business", () => {
    assert.equal(landTabPlotCategory("residential"), "homes");
    for (const plotType of [
      "commercial",
      "guild",
      "crafting",
      "farm",
      "public",
    ] as const) {
      assert.equal(landTabPlotCategory(plotType), "business");
    }
  });

  it("computes the plot center from its bounds", () => {
    const plot = {
      bounds: { xMin: 10, xMax: 20, zMin: -40, zMax: -30 },
      groundY: 54,
    } as BuildingSystemPlotDefinition;
    assert.deepEqual(landTabPlotCenter(plot), [15, 56, -35]);
  });
});
