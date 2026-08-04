/// <reference types="mocha" />
// HARTHMERE_MOBILE_DEVICE_PROFILE (2026-08-04 mobile audit, items 3 and 9).
import {
  classifyMobileDevice,
  clampToRange,
  mobileGraphicsClampsForClass,
  mobileGraphicsClampsForSignals,
} from "@/client/game/util/mobile_device_profile";
import assert from "assert";

describe("mobile device profile", () => {
  it("treats a low-RAM or low-core device as constrained", () => {
    assert.equal(classifyMobileDevice({ deviceMemoryGb: 2 }), "constrained");
    assert.equal(
      classifyMobileDevice({ hardwareConcurrency: 4 }),
      "constrained"
    );
    // An explicitly weak GPU is enough on its own.
    assert.equal(classifyMobileDevice({ gpuTier: 1 }), "constrained");
  });

  it("never lets a missing signal imply a weak device", () => {
    // iOS Safari does not implement navigator.deviceMemory. A device that
    // reports nothing must not be demoted for it -- that would have made every
    // iPhone constrained.
    assert.equal(classifyMobileDevice({}), "standard");
    assert.equal(
      classifyMobileDevice({ deviceMemoryGb: undefined, gpuTier: 3 }),
      "capable"
    );
  });

  it("only promotes to capable on an explicit high GPU tier", () => {
    assert.equal(classifyMobileDevice({ gpuTier: 2 }), "standard");
    assert.equal(classifyMobileDevice({ gpuTier: 3 }), "capable");
    // ...and a strong GPU cannot rescue a device that is short on memory,
    // because the phone failure mode was process memory, not throughput.
    assert.equal(
      classifyMobileDevice({ gpuTier: 3, deviceMemoryGb: 2 }),
      "constrained"
    );
  });

  it("starts a standard phone exactly where the validated hard pin did", () => {
    // The retired code was `forceRenderScale = 0.5` plus a fixed 64m veryLow
    // tier. Regressing this would start phones somewhere unvalidated.
    const clamps = mobileGraphicsClampsForClass("standard");
    assert.equal(clamps.startRenderScale, 0.5);
    assert.equal(clamps.startDrawDistance, 64);
  });

  it("keeps every class under the draw distance that caused jetsam", () => {
    // The physical iPhone sessions that hit JETSAM_REASON_MEMORY_HIGHWATER
    // were running a 96m radius; nothing may exceed it, and only the most
    // capable class may reach it.
    for (const deviceClass of ["constrained", "standard", "capable"] as const) {
      const clamps = mobileGraphicsClampsForClass(deviceClass);
      assert.ok(
        clamps.maxDrawDistance <= 96,
        `${deviceClass} may not exceed 96m`
      );
      assert.ok(clamps.minDrawDistance <= clamps.startDrawDistance);
      assert.ok(clamps.startDrawDistance <= clamps.maxDrawDistance);
      assert.ok(clamps.minRenderScale <= clamps.startRenderScale);
      assert.ok(clamps.startRenderScale <= clamps.maxRenderScale);
      // Render scale must stay well under 1.0 on a phone regardless of class.
      assert.ok(clamps.maxRenderScale <= 0.8);
    }
  });

  it("gives a constrained device strictly less than a standard one", () => {
    const constrained = mobileGraphicsClampsForSignals({ deviceMemoryGb: 2 });
    const standard = mobileGraphicsClampsForSignals({});
    assert.ok(constrained.startRenderScale < standard.startRenderScale);
    assert.ok(constrained.startDrawDistance <= standard.startDrawDistance);
    assert.ok(constrained.maxDrawDistance <= standard.maxDrawDistance);
  });

  it("clamps and tolerates non-finite input", () => {
    assert.equal(clampToRange(0.9, 0.3, 0.7), 0.7);
    assert.equal(clampToRange(0.1, 0.3, 0.7), 0.3);
    assert.equal(clampToRange(0.5, 0.3, 0.7), 0.5);
    assert.equal(clampToRange(NaN, 0.3, 0.7), 0.3);
  });
});
