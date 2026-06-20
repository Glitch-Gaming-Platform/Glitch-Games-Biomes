/// <reference types="mocha" />
import {
  applyDrawDistanceFloors,
  applyMinimumDrawDistance,
} from "@/client/game/resources/graphics_settings";
import assert from "assert";

describe("graphics settings draw distance floors", () => {
  it("keeps dynamic draw distance at or above the configured minimum", () => {
    assert.equal(applyMinimumDrawDistance(64, 128), 128);
    assert.equal(applyMinimumDrawDistance(160, 128), 160);
  });

  it("leaves draw distance unchanged without a finite minimum", () => {
    assert.equal(applyMinimumDrawDistance(64, undefined), 64);
    assert.equal(applyMinimumDrawDistance(64, Number.NaN), 64);
  });

  it("applies the Harthmere dynamic baseline only to dynamic draw distance", () => {
    assert.equal(
      applyDrawDistanceFloors(64, {
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: true,
      }),
      128
    );
    assert.equal(
      applyDrawDistanceFloors(256, {
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: true,
      }),
      256
    );
    assert.equal(
      applyDrawDistanceFloors(96, {
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: false,
      }),
      96
    );
  });

  it("still supports a hard minimum override", () => {
    assert.equal(
      applyDrawDistanceFloors(96, {
        hardMinDrawDistance: 160,
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: false,
      }),
      160
    );
  });
});
