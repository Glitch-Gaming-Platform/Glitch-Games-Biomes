/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";

import {
  HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS_V1,
  HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT_V1,
  harthmereBusinessMiniMapPinsForPlayerForTest,
} from "../harthmere_business_minimap_pins_v1";
import {
  HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1,
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
} from "@/shared/harthmere/business_customer_simulator_v1";

describe("Harthmere business minimap pins V1", () => {
  it("returns nearby business outposts for the HUD minimap without exceeding the visual pin budget", () => {
    const pins = harthmereBusinessMiniMapPinsForPlayerForTest([500, 65, -210]);
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
    const pins = harthmereBusinessMiniMapPinsForPlayerForTest([500, 65, -210], {
      maxDistanceMeters: 1000,
      limit: 100,
    });
    assert.equal(pins.length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);
    for (const marker of HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1) {
      const pin = pins.find((entry) => entry.markerId === marker.markerId);
      assert.ok(pin, `${marker.label} should have a HUD minimap pin`);
      assert.deepEqual(pin?.position, marker.position);
      assert.equal(pin?.label, marker.label);
      assert.equal(pin?.outpostId, marker.outpostId);
      assert.equal(pin?.primaryBikkieId, marker.primaryBikkieGraphic?.bikkieId);
      assert.equal(pin?.primaryBikkieLabel, marker.primaryBikkieGraphic?.label);
      assert.equal(pin?.primaryBikkieVisual?.visualId, marker.primaryBikkieVisual?.visualId);
    }
  });

  it("does not render HUD business pins for missing or invalid player positions", () => {
    assert.deepEqual(harthmereBusinessMiniMapPinsForPlayerForTest(undefined), []);
    assert.deepEqual(harthmereBusinessMiniMapPinsForPlayerForTest([Number.NaN, 65, -210]), []);
  });

  it("finds businesses when the player position uses the Glitch runtime X offset", () => {
    // In the Glitch / extra-town runtime the buildings are shifted +512 on X.
    // MiniMapHUD subtracts the offset from the live player position before calling
    // this function, so a player at runtime coords [1012, 65, -210] becomes [500, 65, -210]
    // here — matching the canonical business positions.
    const pinsRaw = harthmereBusinessMiniMapPinsForPlayerForTest([500, 65, -210]);
    const pinsShifted = harthmereBusinessMiniMapPinsForPlayerForTest([1012, 65, -210]);
    assert.ok(pinsRaw.length > 0, "player near canonical positions should see pins");
    assert.equal(pinsShifted.length, 0, "player at shifted coordinates without offset correction should see no pins — useHarthmereBusinessMiniMapPinsV1 must subtract the runtime offset before calling this function");
  });
});
