import { HARTHMERE_PROPERTY_MARKER_SOURCE_V1 } from "@/client/components/biomes_ui/adapters/propertyMapMarkersV1";
import type { HarthmerePurchasablePlotMapLandmarkV1 } from "@/client/components/biomes_ui/adapters/propertyMapMarkersV1";
import { nearestPropertyForSaleLandmarkV1 } from "@/client/components/harthmere_building/propertyForSaleProximityV1";
import assert from "assert";

function landmark(
  plotId: string,
  x: number,
  z: number
): HarthmerePurchasablePlotMapLandmarkV1 {
  return {
    id: `plot_for_sale:${plotId}`,
    plotId,
    label: `For sale: ${plotId}`,
    kind: "property",
    availability: "for_sale",
    position: [x, 54, z],
    area: "Frontier",
    visibleOnWorldMap: true,
    source: HARTHMERE_PROPERTY_MARKER_SOURCE_V1,
    priceGold: 25,
    description: "",
  };
}

describe("property for-sale proximity", () => {
  const a = landmark("a", 100, 100);
  const b = landmark("b", 200, 200);

  it("returns the nearest plot within radius", () => {
    const result = nearestPropertyForSaleLandmarkV1([a, b], { x: 105, z: 100 }, 18);
    assert.equal(result?.landmark.plotId, "a");
    assert.ok((result?.distance ?? Infinity) <= 18);
  });

  it("returns undefined when all plots are out of range", () => {
    assert.equal(
      nearestPropertyForSaleLandmarkV1([a, b], { x: 0, z: 0 }, 18),
      undefined
    );
  });

  it("returns undefined without a player position", () => {
    assert.equal(
      nearestPropertyForSaleLandmarkV1([a, b], undefined, 18),
      undefined
    );
  });
});
