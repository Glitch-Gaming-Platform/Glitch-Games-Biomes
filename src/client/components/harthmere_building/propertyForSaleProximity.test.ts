import { HARTHMERE_PROPERTY_MARKER_SOURCE } from "@/client/components/biomes_ui/adapters/propertyMapMarkers";
import type { HarthmerePurchasablePlotMapLandmark } from "@/client/components/biomes_ui/adapters/propertyMapMarkers";
import { nearestPropertyForSaleLandmark } from "@/client/components/harthmere_building/propertyForSaleProximity";
import assert from "assert";

function landmark(
  plotId: string,
  x: number,
  z: number
): HarthmerePurchasablePlotMapLandmark {
  return {
    id: `plot_for_sale:${plotId}`,
    plotId,
    label: `For sale: ${plotId}`,
    kind: "property",
    availability: "for_sale",
    position: [x, 54, z],
    area: "Frontier",
    visibleOnWorldMap: true,
    source: HARTHMERE_PROPERTY_MARKER_SOURCE,
    priceGold: 25,
    description: "",
  };
}

describe("property for-sale proximity", () => {
  const a = landmark("a", 100, 100);
  const b = landmark("b", 200, 200);

  it("returns the nearest plot within radius", () => {
    const result = nearestPropertyForSaleLandmark([a, b], { x: 105, z: 100 }, 18);
    assert.equal(result?.landmark.plotId, "a");
    assert.ok((result?.distance ?? Infinity) <= 18);
  });

  it("returns undefined when all plots are out of range", () => {
    assert.equal(
      nearestPropertyForSaleLandmark([a, b], { x: 0, z: 0 }, 18),
      undefined
    );
  });

  it("returns undefined without a player position", () => {
    assert.equal(
      nearestPropertyForSaleLandmark([a, b], undefined, 18),
      undefined
    );
  });
});
