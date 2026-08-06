import { harthmereImmediateCounterattackAllowedForTest } from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  HARTHMERE_ENEMY_MELEE_PACING,
  HARTHMERE_DODGE_STAMINA_COST,
  HARTHMERE_DOUBLE_JUMP_STAMINA_COST,
  HARTHMERE_EVADE_STAMINA_COST,
  HARTHMERE_PLAYER_ATTACK_TIMINGS,
  HARTHMERE_SPECIAL_MOVEMENT_STAMINA,
  harthmerePlayerAttackCommitmentMs,
} from "@/shared/harthmere/deliberate_combat";
import assert from "assert";

describe("Harthmere deliberate combat pacing", () => {
  it("gives every player attack a readable windup and punishable recovery", () => {
    const minimumWindupMs = {
      basic: 120,
      heavy: 200,
      ranged: 250,
      magic: 400,
    } as const;
    const minimumRecoveryMs = {
      basic: 400,
      heavy: 600,
      ranged: 600,
      magic: 700,
    } as const;
    for (const [kind, timing] of Object.entries(
      HARTHMERE_PLAYER_ATTACK_TIMINGS
    )) {
      const timingKind = kind as keyof typeof HARTHMERE_PLAYER_ATTACK_TIMINGS;
      assert.ok(
        timing.windupMs >= minimumWindupMs[timingKind],
        `${kind} windup is too short`
      );
      assert.ok(timing.impactMs > timing.windupMs, `${kind} has no active arc`);
      assert.ok(
        timing.recoveryMs >= minimumRecoveryMs[timingKind],
        `${kind} recovery is too short`
      );
      assert.equal(
        harthmerePlayerAttackCommitmentMs(timingKind),
        timing.impactMs + timing.recoveryMs
      );
      assert.equal(
        timing.staminaCost,
        0,
        `${kind} must not spend special-movement stamina`
      );
      assert.ok(timing.movementScale < 0.5, `${kind} permits full strafing`);
    }
    assert.ok(
      harthmerePlayerAttackCommitmentMs("heavy") >
        harthmerePlayerAttackCommitmentMs("basic")
    );
  });

  it("charges only special movement against the survival stamina bar", () => {
    assert.equal(HARTHMERE_DODGE_STAMINA_COST, 3);
    assert.equal(HARTHMERE_EVADE_STAMINA_COST, 2);
    assert.equal(HARTHMERE_DOUBLE_JUMP_STAMINA_COST, 4);
    assert.deepEqual(HARTHMERE_SPECIAL_MOVEMENT_STAMINA, {
      dodgeCost: HARTHMERE_DODGE_STAMINA_COST,
      evadeCost: HARTHMERE_EVADE_STAMINA_COST,
      doubleJumpCost: HARTHMERE_DOUBLE_JUMP_STAMINA_COST,
    });
    assert.equal(
      "regenerationPerSecond" in HARTHMERE_SPECIAL_MOVEMENT_STAMINA,
      false
    );
  });

  it("requires enemies to telegraph and recover instead of countering instantly", () => {
    assert.equal(harthmereImmediateCounterattackAllowedForTest(), false);
    for (const [kind, pacing] of Object.entries(HARTHMERE_ENEMY_MELEE_PACING)) {
      assert.ok(pacing.strikeSecs >= 0.5, `${kind} tell is too short`);
      assert.ok(
        pacing.intervalSecs >= pacing.strikeSecs + 1.4,
        `${kind} has no recovery opening`
      );
    }
    assert.ok(
      HARTHMERE_ENEMY_MELEE_PACING.boss.strikeSecs >
        HARTHMERE_ENEMY_MELEE_PACING.ordinary.strikeSecs
    );
    assert.ok(
      HARTHMERE_ENEMY_MELEE_PACING.indisworm.intervalSecs >
        HARTHMERE_ENEMY_MELEE_PACING.ordinary.intervalSecs
    );
  });
});
