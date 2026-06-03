/// <reference types="mocha" />
import assert from "assert";
import {
  harthmerePurchasablePlotMapLandmarksFromBuildingStateV1,
} from "@/client/components/biomes_ui/adapters/propertyMapMarkersV1";
import { BUILDING_SYSTEM_PLOTS_V1 } from "@/shared/harthmere/building_system_v1";

// HARTHMERE plot discovery
// Locks the fix that unowned plots show as "for sale" map landmarks so a new
// player can find and preview a plot (location + price) before buying.
describe("harthmerePurchasablePlotMapLandmarksFromBuildingStateV1", () => {
  it("surfaces every plot as 'for sale' when the player owns nothing", () => {
    const landmarks = harthmerePurchasablePlotMapLandmarksFromBuildingStateV1(undefined);
    assert.strictEqual(landmarks.length, BUILDING_SYSTEM_PLOTS_V1.length);
    for (const lm of landmarks) {
      assert.strictEqual(lm.availability, "for_sale");
      assert.ok(lm.label.startsWith("For sale: "));
      assert.ok(lm.priceGold > 0);
      assert.ok(lm.position.every((v) => Number.isFinite(v)));
      assert.ok(/\d+ gold/.test(lm.description), "price shown in description");
    }
  });

  it("excludes plots the player already owns (via ownedPlotIds)", () => {
    const owned = BUILDING_SYSTEM_PLOTS_V1[0].plotId;
    const landmarks = harthmerePurchasablePlotMapLandmarksFromBuildingStateV1({
      ownedPlotIds: [owned],
    });
    assert.strictEqual(landmarks.length, BUILDING_SYSTEM_PLOTS_V1.length - 1);
    assert.ok(!landmarks.some((lm) => lm.plotId === owned));
  });

  it("excludes plots owned via completedProperties", () => {
    const owned = BUILDING_SYSTEM_PLOTS_V1[1].plotId;
    const landmarks = harthmerePurchasablePlotMapLandmarksFromBuildingStateV1({
      completedProperties: { p1: { plotId: owned } },
    });
    assert.ok(!landmarks.some((lm) => lm.plotId === owned));
  });
});
