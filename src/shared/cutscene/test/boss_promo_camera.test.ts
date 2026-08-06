/// <reference types="mocha" />

import {
  BOSS_PROMO_CAMERA_PRESETS,
  BOSS_PROMO_BODY_CLEARANCE_MULTIPLIER,
  bossPromoCameraPlan,
  isBossPromoCameraPresetId,
  preflightBossPromoCamera,
} from "@/shared/cutscene/boss_promo_camera";
import assert from "assert";

const INPUT = {
  stage: [10, 20, 30] as [number, number, number],
  cameraFar: [-10, 28, 40] as [number, number, number],
  cameraNear: [-4, 26, 36] as [number, number, number],
  fov: 32,
  worldSize: [4, 6, 8] as [number, number, number],
};

describe("boss promo camera preflight", () => {
  it("publishes one validated list of CLI/browser preset names", () => {
    assert.equal(BOSS_PROMO_CAMERA_PRESETS.length, 5);
    for (const preset of BOSS_PROMO_CAMERA_PRESETS) {
      assert.equal(isBossPromoCameraPresetId(preset), true);
    }
    assert.equal(isBossPromoCameraPresetId("sideways"), false);
  });

  it("keeps baseline coordinates exact so current evidence remains reproducible", () => {
    const plan = bossPromoCameraPlan(INPUT, "baseline");
    assert.deepEqual(plan.cameraFar, INPUT.cameraFar);
    assert.deepEqual(plan.cameraNear, INPUT.cameraNear);
    assert.equal(plan.fov, 32);
  });

  it("creates repeatable review brackets in the marketing FOV range", () => {
    for (const preset of [
      "three-quarter-left",
      "three-quarter-right",
      "environment-wide",
      "reverse-inward",
    ] as const) {
      const first = bossPromoCameraPlan(INPUT, preset);
      const second = bossPromoCameraPlan(INPUT, preset);
      assert.deepEqual(first, second);
      assert.ok(first.fov >= 35 && first.fov <= 45);
      assert.notDeepEqual(first.cameraFar, INPUT.cameraFar);
    }
  });

  it("checks the complete dolly rather than only its endpoints", () => {
    const bodyRadius = Math.hypot(...INPUT.worldSize) / 2;
    const unsafeDistance =
      bodyRadius * BOSS_PROMO_BODY_CLEARANCE_MULTIPLIER * 0.9;
    const plan = {
      preset: "baseline" as const,
      cameraFar: [10 - unsafeDistance, 20, 30] as [number, number, number],
      cameraNear: [10 + unsafeDistance, 20, 30] as [number, number, number],
      fov: 40,
    };
    const result = preflightBossPromoCamera(INPUT, plan);
    assert.ok(
      result.issues.some((issue) => issue.includes("enters the boss envelope"))
    );
    assert.equal(result.minimumDollyDistance, 0);
  });

  it("reports an out-of-contract marketing FOV before browser capture", () => {
    const result = preflightBossPromoCamera(
      INPUT,
      bossPromoCameraPlan(INPUT, "baseline")
    );
    assert.ok(result.issues.some((issue) => issue.includes("FOV 32")));
  });
});
