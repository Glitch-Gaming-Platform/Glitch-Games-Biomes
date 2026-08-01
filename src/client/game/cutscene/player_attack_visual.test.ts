import {
  CUTSCENE_PLAYER_ATTACK_DURATION_SECONDS,
  cutscenePlayerAttackVisualPose,
} from "@/client/game/cutscene/player_attack_visual";
import assert from "assert";

describe("cutscene player attack visual fallback", () => {
  it("keeps neutral endpoints with a readable wind-up and strike", () => {
    assert.equal(CUTSCENE_PLAYER_ATTACK_DURATION_SECONDS, 0.71);
    assert.deepEqual(cutscenePlayerAttackVisualPose("attack1", 0), {
      pitchRadians: 0,
      rollRadians: 0,
      yawRadians: 0,
      liftMeters: 0,
    });
    const windup = cutscenePlayerAttackVisualPose("attack1", 0.28)!;
    const strike = cutscenePlayerAttackVisualPose("attack1", 0.58)!;
    assert.ok(windup.yawRadians > 0.35);
    assert.ok(strike.yawRadians < -0.39);
    assert.ok(strike.pitchRadians < -0.1);
    assert.deepEqual(cutscenePlayerAttackVisualPose("attack1", 1), {
      pitchRadians: 0,
      rollRadians: 0,
      yawRadians: 0,
      liftMeters: 0,
    });
  });

  it("mirrors Attack2 and clamps out-of-range progress", () => {
    const attack1 = cutscenePlayerAttackVisualPose("attack1", 0.28)!;
    const attack2 = cutscenePlayerAttackVisualPose("attack2", 0.28)!;
    assert.equal(attack2.yawRadians, -attack1.yawRadians);
    assert.equal(attack2.rollRadians, -attack1.rollRadians);
    assert.deepEqual(
      cutscenePlayerAttackVisualPose("attack2", -1),
      cutscenePlayerAttackVisualPose("attack2", 0)
    );
    assert.deepEqual(
      cutscenePlayerAttackVisualPose("attack2", 2),
      cutscenePlayerAttackVisualPose("attack2", 1)
    );
  });
});
