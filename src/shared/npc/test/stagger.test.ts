import { NpcCombatState } from "@/shared/ecs/gen/components";
import type { HarthmereNativeNpcCombatProfile } from "@/shared/harthmere/harthmere_native_combat";
import {
  HARTHMERE_BOSS_STAGGER_DURATION_BONUS_SECONDS,
  HARTHMERE_BOSS_STAGGER_TIMING,
  HARTHMERE_NPC_STAGGER_TIMING,
  activeHarthmereNpcStaggerPresentation,
  advanceHarthmereNpcStagger,
  harthmereNpcPoiseMax,
  harthmereNpcStaggerEligible,
  type HarthmereNpcStaggerState,
} from "@/shared/npc/stagger";
import assert from "assert";

function profile(overrides: Partial<HarthmereNativeNpcCombatProfile> = {}) {
  return {
    attackDamage: 30,
    behaviorKind: "hostile",
    isBoss: false,
    isPlayerLikeAppearance: undefined,
    ...overrides,
  } as HarthmereNativeNpcCombatProfile;
}

describe("enemy stagger", () => {
  it("includes hostile creatures and bosses but excludes player-like NPCs", () => {
    assert.equal(harthmereNpcStaggerEligible(profile()), true);
    assert.equal(harthmereNpcStaggerEligible(profile({ isBoss: true })), true);
    assert.equal(
      harthmereNpcStaggerEligible(profile({ isPlayerLikeAppearance: true })),
      false
    );
    assert.equal(
      harthmereNpcStaggerEligible(profile({ behaviorKind: "sentinel" })),
      false
    );
  });

  it("gives bosses a larger poise pool and two-second extended windows", () => {
    const ordinaryPoise = harthmereNpcPoiseMax({ maxHp: 5000, level: 12 });
    const bossPoise = harthmereNpcPoiseMax({
      maxHp: 5000,
      level: 12,
      isBoss: true,
    });
    assert.ok(bossPoise > ordinaryPoise);
    assert.equal(HARTHMERE_BOSS_STAGGER_DURATION_BONUS_SECONDS, 2);
    assert.equal(
      HARTHMERE_BOSS_STAGGER_TIMING.light.durationSeconds,
      14 / 24 + 2
    );
    assert.equal(
      HARTHMERE_BOSS_STAGGER_TIMING.medium.durationSeconds,
      30 / 24 + 2
    );
    assert.equal(
      HARTHMERE_BOSS_STAGGER_TIMING.heavy.durationSeconds,
      58 / 24 + 2
    );

    const result = advanceHarthmereNpcStagger({
      state: { poise: 1, poiseMax: bossPoise, poiseUpdatedAt: 10 },
      nowSeconds: 10,
      maxHp: 5000,
      level: 12,
      isBoss: true,
      damageTime: 10,
      damageAmount: 1500,
      damageIsAttack: true,
      damageDirection: [0, 0, 1],
    });
    assert.equal(result.triggered?.kind, "heavy");
    assert.ok(
      Math.abs(
        result.triggered!.expiryTime -
          result.triggered!.startTime -
          HARTHMERE_BOSS_STAGGER_TIMING.heavy.durationSeconds
      ) < 1e-9
    );
  });

  it("accumulates poise damage and turns a strong breaking blow into heavy stagger", () => {
    const poiseMax = harthmereNpcPoiseMax({ maxHp: 500, level: 3 });
    const result = advanceHarthmereNpcStagger({
      state: { poise: poiseMax, poiseMax, poiseUpdatedAt: 10 },
      nowSeconds: 10,
      maxHp: 500,
      level: 3,
      damageTime: 10,
      damageAmount: 165,
      damageIsAttack: true,
      damageDirection: [3, 0, 0],
    });

    assert.equal(result.triggered?.kind, "heavy");
    assert.equal(result.active, true);
    assert.equal(result.state.poise, 0);
    assert.deepEqual(result.triggered?.direction, [1, 0, 0]);
    assert.ok(
      Math.abs(
        result.triggered!.expiryTime -
          result.triggered!.startTime -
          HARTHMERE_NPC_STAGGER_TIMING.heavy.durationSeconds
      ) < 1e-9
    );
  });

  it("lets repeated light hits break poise without processing the same hit twice", () => {
    let state: HarthmereNpcStaggerState | undefined;
    let triggered = false;
    for (let hit = 1; hit <= 8; hit += 1) {
      const hitTime = hit * 0.15;
      const result = advanceHarthmereNpcStagger({
        state,
        nowSeconds: hitTime,
        maxHp: 550,
        level: 2,
        damageTime: hitTime,
        damageAmount: 22,
        damageIsAttack: true,
        damageDirection: [0, 0, -1],
      });
      state = result.state;
      if (result.triggered) {
        triggered = true;
        break;
      }
      const duplicate = advanceHarthmereNpcStagger({
        state,
        nowSeconds: hitTime,
        maxHp: 550,
        level: 2,
        damageTime: hitTime,
        damageAmount: 22,
        damageIsAttack: true,
      });
      assert.equal(duplicate.ignoredReason, "no_new_damage");
      assert.equal(duplicate.state.poise, state.poise);
    }
    assert.equal(triggered, true);
  });

  it("prevents stagger lock during the reaction and immunity window", () => {
    const first = advanceHarthmereNpcStagger({
      state: undefined,
      nowSeconds: 5,
      maxHp: 200,
      level: 1,
      damageTime: 5,
      damageAmount: 100,
      damageIsAttack: true,
    });
    assert.ok(first.triggered);

    const during = advanceHarthmereNpcStagger({
      state: first.state,
      nowSeconds: 5.1,
      maxHp: 200,
      level: 1,
      damageTime: 5.1,
      damageAmount: 100,
      damageIsAttack: true,
    });
    assert.equal(during.ignoredReason, "active");
    assert.equal(during.state.poise, 0);

    const afterReaction = first.triggered!.expiryTime + 0.01;
    const immune = advanceHarthmereNpcStagger({
      state: during.state,
      nowSeconds: afterReaction,
      maxHp: 200,
      level: 1,
      damageTime: afterReaction,
      damageAmount: 100,
      damageIsAttack: true,
    });
    assert.equal(immune.ignoredReason, "immune");
    assert.equal(immune.active, false);
    assert.ok((immune.state.poise ?? 0) > 0);
  });

  it("never refreshes or immediately retriggers an extended boss stagger", () => {
    const first = advanceHarthmereNpcStagger({
      state: { poise: 1, poiseMax: 420, poiseUpdatedAt: 30 },
      nowSeconds: 30,
      maxHp: 5000,
      level: 12,
      isBoss: true,
      damageTime: 30,
      damageAmount: 1500,
      damageIsAttack: true,
      damageDirection: [1, 0, 0],
    });
    assert.ok(first.triggered);
    const fixedExpiry = first.triggered!.expiryTime;

    const during = advanceHarthmereNpcStagger({
      state: first.state,
      nowSeconds: fixedExpiry - 0.01,
      maxHp: 5000,
      level: 12,
      isBoss: true,
      damageTime: fixedExpiry - 0.01,
      damageAmount: 1500,
      damageIsAttack: true,
    });
    assert.equal(during.ignoredReason, "active");
    assert.equal(during.state.stagger?.expiryTime, fixedExpiry);

    const immune = advanceHarthmereNpcStagger({
      state: during.state,
      nowSeconds: fixedExpiry + 0.01,
      maxHp: 5000,
      level: 12,
      isBoss: true,
      damageTime: fixedExpiry + 0.01,
      damageAmount: 1500,
      damageIsAttack: true,
    });
    assert.equal(immune.active, false);
    assert.equal(immune.ignoredReason, "immune");
    assert.equal(immune.state.stagger, undefined);
    assert.ok(immune.state.immunityUntil! > fixedExpiry + 0.01);
    assert.ok((immune.state.poise ?? 0) > 0);
  });

  it("validates the exact public stagger window consumed by rendering", () => {
    const state = NpcCombatState.create({
      stagger_kind: "medium",
      stagger_start_time: 20,
      stagger_expiry_time: 20.95,
      stagger_direction: [0, 0, 1],
    });
    assert.equal(
      activeHarthmereNpcStaggerPresentation(state, 20.5)?.kind,
      "medium"
    );
    assert.equal(activeHarthmereNpcStaggerPresentation(state, 21), undefined);
  });
});
