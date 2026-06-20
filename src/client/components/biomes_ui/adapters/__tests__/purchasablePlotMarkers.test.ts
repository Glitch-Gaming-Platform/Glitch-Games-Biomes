/// <reference types="mocha" />
import assert from "assert";
import {
  harthmerePurchasablePlotMapLandmarksFromBuildingState,
} from "@/client/components/biomes_ui/adapters/propertyMapMarkers";
import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";

// HARTHMERE plot discovery
// Locks the fix that unowned plots show as "for sale" map landmarks so a new
// player can find and preview a plot (location + price) before buying.
describe("harthmerePurchasablePlotMapLandmarksFromBuildingState", () => {
  it("surfaces every plot as 'for sale' when the player owns nothing", () => {
    const landmarks = harthmerePurchasablePlotMapLandmarksFromBuildingState(undefined);
    assert.strictEqual(landmarks.length, BUILDING_SYSTEM_PLOTS.length);
    for (const lm of landmarks) {
      assert.strictEqual(lm.availability, "for_sale");
      assert.ok(lm.label.startsWith("For sale: "));
      assert.ok(lm.priceGold > 0);
      assert.ok(lm.position.every((v) => Number.isFinite(v)));
      assert.ok(/\d+ gold/.test(lm.description), "price shown in description");
    }
  });

  it("excludes plots the player already owns (via ownedPlotIds)", () => {
    const owned = BUILDING_SYSTEM_PLOTS[0].plotId;
    const landmarks = harthmerePurchasablePlotMapLandmarksFromBuildingState({
      ownedPlotIds: [owned],
    });
    assert.strictEqual(landmarks.length, BUILDING_SYSTEM_PLOTS.length - 1);
    assert.ok(!landmarks.some((lm) => lm.plotId === owned));
  });

  it("excludes plots owned via completedProperties", () => {
    const owned = BUILDING_SYSTEM_PLOTS[1].plotId;
    const landmarks = harthmerePurchasablePlotMapLandmarksFromBuildingState({
      completedProperties: { p1: { plotId: owned } },
    });
    assert.ok(!landmarks.some((lm) => lm.plotId === owned));
  });
});
