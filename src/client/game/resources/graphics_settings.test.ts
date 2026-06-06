/// <reference types="mocha" />
import {
  applyDrawDistanceFloorsV1,
  applyMinimumDrawDistanceV1,
} from "@/client/game/resources/graphics_settings";
import assert from "assert";

describe("graphics settings draw distance floors", () => {
  it("keeps dynamic draw distance at or above the configured minimum", () => {
    assert.equal(applyMinimumDrawDistanceV1(64, 128), 128);
    assert.equal(applyMinimumDrawDistanceV1(160, 128), 160);
  });

  it("leaves draw distance unchanged without a finite minimum", () => {
    assert.equal(applyMinimumDrawDistanceV1(64, undefined), 64);
    assert.equal(applyMinimumDrawDistanceV1(64, Number.NaN), 64);
  });

  it("applies the Harthmere dynamic baseline only to dynamic draw distance", () => {
    assert.equal(
      applyDrawDistanceFloorsV1(64, {
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: true,
      }),
      128
    );
    assert.equal(
      applyDrawDistanceFloorsV1(256, {
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: true,
      }),
      256
    );
    assert.equal(
      applyDrawDistanceFloorsV1(96, {
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: false,
      }),
      96
    );
  });

  it("still supports a hard minimum override", () => {
    assert.equal(
      applyDrawDistanceFloorsV1(96, {
        hardMinDrawDistance: 160,
        dynamicMinDrawDistance: 128,
        isDynamicDrawDistance: false,
      }),
      160
    );
  });
});
