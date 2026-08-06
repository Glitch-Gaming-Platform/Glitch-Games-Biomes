/// <reference types="mocha" />
import assert from "assert";
import {
  bossPromoCameraPlan,
  preflightBossPromoCamera,
  type BossPromoCameraPresetId,
} from "@/shared/cutscene/boss_promo_camera";
import { preflightBossPromoDungeonCamera } from "@/shared/cutscene/boss_promo_dungeon_preflight";
import {
  HARTHMERE_BOSS_PROMO_SPECS,
  bossFrameFocus,
} from "@/shared/cutscene/promo_scenes";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";

function preflightBoss(
  id: "gilded_bull" | "ninth_winter",
  preset: BossPromoCameraPresetId
) {
  const spec = HARTHMERE_BOSS_PROMO_SPECS.find(
    (candidate) => candidate.id === id
  )!;
  const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
    (candidate) => candidate.id === id
  )!;
  assert.ok(spec.dungeonId);
  const input = {
    stage: spec.stage,
    cameraFar: spec.cameraFar,
    cameraNear: spec.cameraNear,
    fov: spec.fov,
    worldSize: visual.worldSize,
  };
  const plan = bossPromoCameraPlan(input, preset);
  const geometry = preflightBossPromoCamera(input, plan);
  return preflightBossPromoDungeonCamera({
    dungeonId: spec.dungeonId,
    cameraFar: plan.cameraFar,
    cameraNear: plan.cameraNear,
    target: bossFrameFocus({ ...spec, ...plan }, visual),
    bossBodyRadius: geometry.bodyRadius,
  });
}

describe("boss promo canonical dungeon camera preflight", () => {
  it("gives every boss a unique ordered live-review shortlist", () => {
    for (const spec of HARTHMERE_BOSS_PROMO_SPECS) {
      assert.ok(spec.cameraPresetPriority.length >= 3, spec.id);
      assert.equal(
        new Set(spec.cameraPresetPriority).size,
        spec.cameraPresetPriority.length,
        spec.id
      );
    }
  });

  it("keeps every named Gilded Bull candidate in clear Sun Court terrain", () => {
    for (const preset of [
      "baseline",
      "three-quarter-left",
      "three-quarter-right",
      "environment-wide",
      "reverse-inward",
    ] as const) {
      assert.deepEqual(preflightBoss("gilded_bull", preset).issues, [], preset);
    }
  });

  it("keeps the baseline and lateral Ninth Winter cameras inside Ash Hall", () => {
    for (const preset of [
      "baseline",
      "three-quarter-left",
      "three-quarter-right",
    ] as const) {
      assert.deepEqual(
        preflightBoss("ninth_winter", preset).issues,
        [],
        preset
      );
    }
  });

  it("rejects Ninth Winter brackets that enter the longhouse walls", () => {
    for (const preset of ["environment-wide", "reverse-inward"] as const) {
      const result = preflightBoss("ninth_winter", preset);
      assert.ok(result.cameraHits.length > 0, preset);
      assert.ok(result.sightlineHits.length > 0, preset);
      assert.match(result.issues.join("; "), /oakLog terrain/);
    }
  });

  it("keeps both canonical dungeon bosses' first live candidate clear", () => {
    for (const id of ["gilded_bull", "ninth_winter"] as const) {
      const spec = HARTHMERE_BOSS_PROMO_SPECS.find(
        (candidate) => candidate.id === id
      )!;
      assert.deepEqual(
        preflightBoss(id, spec.cameraPresetPriority[0]!).issues,
        [],
        id
      );
    }
  });
});
