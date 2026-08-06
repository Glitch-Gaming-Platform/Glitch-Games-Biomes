/// <reference types="mocha" />
import {
  applyDrawDistanceFloors,
  applyMinimumDrawDistance,
  defaultDynamicDrawDistance,
  graphicsQualityForDevice,
  initialDynamicRenderScaleForGpuTier,
  lowQualityDrawDistanceForDevice,
} from "@/client/game/resources/graphics_settings";
import assert from "assert";

describe("graphics settings draw distance floors", () => {
  it("starts adaptive rendering conservatively from the detected GPU tier", () => {
    assert.equal(initialDynamicRenderScaleForGpuTier(0), 0.5);
    assert.equal(initialDynamicRenderScaleForGpuTier(1), 0.5);
    assert.equal(initialDynamicRenderScaleForGpuTier(2), 0.8);
    assert.equal(initialDynamicRenderScaleForGpuTier(3), 1.0);
  });

  it("forces stored high settings down only on mobile", () => {
    assert.equal(
      graphicsQualityForDevice({
        mobileDevice: true,
        storedQuality: "high",
      }),
      "low"
    );
    assert.equal(
      graphicsQualityForDevice({
        mobileDevice: true,
        storedQuality: "safeMode",
      }),
      "safeMode"
    );
    assert.equal(
      graphicsQualityForDevice({
        mobileDevice: false,
        storedQuality: "high",
      }),
      "high"
    );
    assert.equal(
      graphicsQualityForDevice({
        mobileDevice: true,
        forcedQuality: "high",
        storedQuality: "low",
      }),
      "high"
    );
  });

  it("starts low-memory/mobile clients at 64m without changing desktop's 96m default", () => {
    assert.equal(defaultDynamicDrawDistance(true), 64);
    assert.equal(defaultDynamicDrawDistance(false), 96);
    assert.equal(lowQualityDrawDistanceForDevice(true), "veryLow");
    assert.equal(lowQualityDrawDistanceForDevice(false), "low");
  });

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
