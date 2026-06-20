/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";

import {
  HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS_V1,
  HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT_V1,
  harthmereBusinessMiniMapPinsForPlayerForTest,
} from "../harthmere_business_minimap_pins_v1";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import { harthmereBusinessOutpostMapLandmarksV1 } from "@/client/components/biomes_ui/adapters/harthmereBusinessMapMarkersV1";

describe("Harthmere business minimap pins V1", () => {
  it("returns nearby business outposts for the HUD minimap without exceeding the visual pin budget", () => {
    const pins = harthmereBusinessMiniMapPinsForPlayerForTest([674, 66, -44]);
    assert.ok(pins.length > 0, "player near Harthmere businesses should see HUD minimap pins");
    assert.ok(pins.length <= HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT_V1);
    assert.ok(pins.every((pin) => pin.distanceMeters <= HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS_V1));
    assert.deepEqual(
      pins.map((pin) => pin.distanceMeters),
      pins.map((pin) => pin.distanceMeters).slice().sort((a, b) => a - b),
      "HUD minimap pins should be nearest-first to avoid clutter",
    );
  });

  it("uses the same canonical business outpost marker positions as the BiomesUI map", () => {
    const pins = harthmereBusinessMiniMapPinsForPlayerForTest([900, 52, -430], {
      maxDistanceMeters: 2200,
      limit: 100,
    });
    assert.equal(pins.length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);
    for (const marker of harthmereBusinessOutpostMapLandmarksV1()) {
      const pin = pins.find((entry) => entry.markerId === marker.id);
      assert.ok(pin, `${marker.label} should have a HUD minimap pin`);
      assert.deepEqual(pin?.position, marker.position);
      assert.equal(pin?.label, marker.label);
      assert.equal(pin?.outpostId, marker.outpostId);
      assert.equal(pin?.primaryBikkieId, marker.primaryBikkieId);
      assert.equal(pin?.primaryBikkieLabel, marker.primaryBikkieLabel);
      assert.equal(pin?.primaryBikkieVisual?.visualId, marker.primaryBikkieVisual?.visualId);
    }
  });

  it("does not render HUD business pins for missing or invalid player positions", () => {
    assert.deepEqual(harthmereBusinessMiniMapPinsForPlayerForTest(undefined), []);
    assert.deepEqual(harthmereBusinessMiniMapPinsForPlayerForTest([Number.NaN, 65, -210]), []);
  });

  it("uses production/world coordinates directly for business pins", () => {
    const pinsRaw = harthmereBusinessMiniMapPinsForPlayerForTest([674, 66, -44]);
    const pinsShifted = harthmereBusinessMiniMapPinsForPlayerForTest([5674, 66, -44]);
    assert.ok(pinsRaw.length > 0, "player near production business positions should see pins");
    assert.equal(pinsShifted.length, 0, "business marker positions should not expect the legacy local +512 X shift");
  });
});
