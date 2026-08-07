import assert from "assert";

import {
  ATTACK_MEMORY_SECONDS,
  attackTimingDecision,
  boundedHarthmereChaseSpeedForName,
  canAttackTarget,
  cancelPendingMeleeAttack,
  chasePathTargetIsStale,
  enhancedNightMuckerHexCombatParams,
  effectiveRetaliationDisengageDistance,
  evaluateMixedCreatureGroupRetaliationTarget,
  evaluateRetaliationTarget,
  effectiveAttackStrikeDelaySecs,
  harthmereProjectileRetaliationLeashDistance,
  isMixedCreatureGroupRetaliationEligible,
  isMixedCreatureGroupRetaliationName,
  isHarthmereCivilianNpcName,
  isHarthmereFightSpeedBoostEligible,
  isHarthmereFightSpeedBoostName,
  isHarthmereMonsterSpeedName,
  isHarthmereSightBoundChaserName,
  isMuckerOrHexerNameForNightAggro,
  isNightForNpcAggro,
  MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE,
  MIXED_CREATURE_GROUP_ALERT_RADIUS,
  NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER,
  NPC_MELEE_STRIKE_GRACE_SECONDS,
  RETALIATION_TARGET_ROTATION_SECONDS,
  RETALIATION_VICINITY_RADIUS_METERS,
  HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
  HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
  HARTHMERE_NPC_CHASE_SPEED_STEP_UP_20,
  HARTHMERE_NPC_CHASE_SPEED_STEP_UP_30,
  HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN,
  HARTHMERE_NPC_SPEED_STEP_DOWN_10,
  HARTHMERE_NPC_SPEED_STEP_DOWN_30,
  HARTHMERE_NON_BOSS_CREATURE_MELEE_FOV_CAP_DEG,
  HARTHMERE_PROJECTILE_RETALIATION_CHASE_BUFFER_METERS,
  HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER,
  retaliationTargetRotationIndex,
  isRetaliationEncounterParticipant,
  shouldDropHarthmereChaseTargetForLineOfSight,
  shouldDropNpcTargetAtSafeZoneBoundary,
  type MixedCreatureGroupAlertCandidate,
} from "@/shared/npc/behavior/chase_attack";
import type { Path } from "@/shared/npc/behavior/pathfinding";
import {
  PATHFINDING_STUCK_DURATION_SECONDS,
  stuckWhilePathfinding,
} from "@/shared/npc/behavior/pathfinding";
import type { BiomesId } from "@/shared/ids";
import { HARTHMERE_NATIVE_NPC_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import { configuredChaseAttackParamsForNpcType } from "@/shared/npc/logic";

const pathTo = (dest: [number, number, number]): Path => ({
  nodes: [{ position: [0, 0, 0] }, { position: dest }],
});

describe("chase attack: strike timing", () => {
  it("starts a swing when no attack is active", () => {
    assert.equal(
      attackTimingDecision({
        now: 100,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "start"
    );
  });

  it("waits before the strike moment and strikes after crossing it", () => {
    assert.equal(
      attackTimingDecision({
        now: 100.4,
        attackTime: 100,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "wait"
    );
    assert.equal(
      attackTimingDecision({
        now: 100.5,
        attackTime: 100,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "strike"
    );
  });

  it("expires a pending strike when a coarse tick skips the bounded contact window", () => {
    assert.equal(
      attackTimingDecision({
        now: 130,
        attackTime: 100,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "expire"
    );
  });

  it("keeps a short coarse-tick grace around the visible impact frame", () => {
    assert.equal(
      attackTimingDecision({
        now: 100.5 + NPC_MELEE_STRIKE_GRACE_SECONDS - 0.000_001,
        attackTime: 100,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "strike"
    );
    assert.equal(
      attackTimingDecision({
        now: 100.501 + NPC_MELEE_STRIKE_GRACE_SECONDS,
        attackTime: 100,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "expire"
    );
  });

  it("cancels unresolved receipts but preserves completed hit receipts", () => {
    const pending: {
      attackTime?: number;
      meleeAttack: {
        result?: "hit" | "miss" | "cancelled";
        resolvedAt?: number;
      };
    } = {
      attackTime: 100,
      meleeAttack: {},
    };
    assert.equal(cancelPendingMeleeAttack(pending, 100.2), true);
    assert.equal(pending.attackTime, undefined);
    assert.equal(pending.meleeAttack.result, "cancelled");
    assert.equal(pending.meleeAttack.resolvedAt, 100.2);

    const completed = {
      attackTime: 100,
      strikeTime: 100.5,
      meleeAttack: { result: "hit" as const, resolvedAt: 100.5 },
    };
    assert.equal(cancelPendingMeleeAttack(completed, 101), false);
    assert.equal(completed.attackTime, 100);
    assert.equal(completed.meleeAttack.result, "hit");
  });

  it("starts the next swing only after the previous one has struck", () => {
    assert.equal(
      attackTimingDecision({
        now: 130,
        attackTime: 100,
        strikeTime: 100.5,
        strikeDelaySecs: 0.5,
        attackIntervalSecs: 2,
      }),
      "start"
    );
  });

  it("returns the raw strike delay when it already fits inside the interval", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 0.5,
        attackAnimationMultiplier: 1,
        attackIntervalSecs: 2,
      }),
      0.5
    );
  });

  it("REGRESSION: clamps the strike below the interval so a hit always lands", () => {
    // Strike moment (3s) >= interval (2s): the unclamped code would restart the
    // swing before the damage window ever opened, so the NPC flails forever.
    const delay = effectiveAttackStrikeDelaySecs({
      attackStrikeMomentSecs: 3,
      attackAnimationMultiplier: 1,
      attackIntervalSecs: 2,
    });
    assert.ok(delay < 2, `expected strike delay < interval, got ${delay}`);
    assert.equal(delay, 2 * 0.95);
  });

  it("accounts for the animation multiplier speeding up the swing", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 1,
        attackAnimationMultiplier: 2,
        attackIntervalSecs: 2,
      }),
      0.5
    );
  });

  it("guards against a zero or negative animation multiplier", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 0.5,
        attackAnimationMultiplier: 0,
        attackIntervalSecs: 2,
      }),
      0.5
    );
  });

  it("handles a non-positive interval without clamping past zero", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 0.5,
        attackAnimationMultiplier: 1,
        attackIntervalSecs: 0,
      }),
      0.5
    );
  });
});

describe("chase attack: committed aim and body-aware contact", () => {
  const base = {
    horizontalDistance: 2,
    verticalGap: 0,
    attackRadius: 2.4,
    attackFovDeg: 100,
  };

  it("hits a target that remains inside the committed front arc", () => {
    assert.equal(
      canAttackTarget({ ...base, targetOrientationDiff: Math.PI / 6 }),
      true
    );
  });

  it("whiffs when the target moves behind the cast yaw during windup", () => {
    assert.equal(
      canAttackTarget({ ...base, targetOrientationDiff: Math.PI }),
      false
    );
  });

  it("rejects giant melee contact against a rider on the upper body", () => {
    assert.equal(
      canAttackTarget({
        ...base,
        targetOrientationDiff: 0,
        attackerPosition: [0, 10, 0],
        attackerSize: [20, 14, 12],
        targetPosition: [0, 20, 0],
      }),
      false
    );
  });
});

describe("chase attack: stale path detection", () => {
  it("keeps the path while the target stays near its destination", () => {
    assert.equal(
      chasePathTargetIsStale(pathTo([10, 0, 0]), [10.5, 0, 0.5], 9),
      false
    );
  });

  it("REGRESSION: rebuilds the path once the target drifts past the threshold", () => {
    // Target ran 10 blocks away from the cached path end; without this the NPC
    // would chase the stale spot until the 8s stuck timer fired.
    assert.equal(
      chasePathTargetIsStale(pathTo([10, 0, 0]), [20, 0, 0], 9),
      true
    );
  });

  it("treats an empty path as stale", () => {
    assert.equal(chasePathTargetIsStale({ nodes: [] }, [0, 0, 0], 9), true);
  });

  it("abandons a path quickly when uneven terrain prevents progress", () => {
    const state = {
      path: pathTo([10, 1, 0]),
      position: [0, 0, 0] as [number, number, number],
      searchTime: 100,
    };
    assert.equal(
      stuckWhilePathfinding(
        state,
        100 + PATHFINDING_STUCK_DURATION_SECONDS - 0.01
      ),
      false
    );
    assert.equal(
      stuckWhilePathfinding(state, 100 + PATHFINDING_STUCK_DURATION_SECONDS),
      true
    );
  });
});

describe("chase attack: night muck/hex aggression helpers", () => {
  it("uses the native road-pack profile when the persisted Bikkie behavior is stale", () => {
    const staleBehavior = {
      damageable: { maxHp: 20, attackable: false },
      chaseAttack: undefined,
    };
    const params = configuredChaseAttackParamsForNpcType(
      HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_road_pack_muckling,
      staleBehavior
    );
    assert.ok(params);
    assert.deepEqual(params.aggroTrigger, {
      kind: "proximity",
      distance: 10.5,
    });
    assert.equal(params.attackDamage, 70);
    assert.equal(params.attackDistance, 2.4);
  });

  it("keeps native non-combat sentinels disabled even if a stale tray says otherwise", () => {
    const params = configuredChaseAttackParamsForNpcType(
      HARTHMERE_NATIVE_NPC_ID_MANIFEST.robot_sentinel,
      {
        chaseAttack: {
          aggroTrigger: { kind: "proximity", distance: 99 },
          disengageDistance: 99,
          attackDistance: 99,
          attackAnimationMultiplier: 1,
          attackStrikeMomentSecs: 0,
          attackIntervalSecs: 1,
          attackFovDeg: 360,
          attackDamage: 999,
        },
      }
    );
    assert.equal(params, undefined);
  });

  it("classifies muckers and hexes without matching protected robots or wards", () => {
    assert.equal(isMuckerOrHexerNameForNightAggro("Mossy Muckling"), true);
    assert.equal(isMuckerOrHexerNameForNightAggro("Old Wood Mucker"), true);
    assert.equal(isMuckerOrHexerNameForNightAggro("Pale Hexer"), true);
    assert.equal(isMuckerOrHexerNameForNightAggro("Mucker Ward"), false);
    assert.equal(isMuckerOrHexerNameForNightAggro("Mucked Robot"), false);
  });

  it("uses the game sun clock for night detection", () => {
    assert.equal(isNightForNpcAggro(0), true);
    assert.equal(isNightForNpcAggro(1_700_000_000), false);
  });

  it("greatly increases Mucker and Hex combat pressure at night only", () => {
    const base = {
      aggroTrigger: { kind: "proximity" as const, distance: 10 },
      disengageDistance: 24,
      attackDistance: 2.4,
      attackAnimationMultiplier: 1,
      attackStrikeMomentSecs: 0.5,
      attackIntervalSecs: 2,
      attackFovDeg: 120,
      attackDamage: 20,
    };
    const night = enhancedNightMuckerHexCombatParams(
      "Pale Hexer",
      true,
      base,
      base
    );
    assert.ok(night);
    assert.ok(night.aggroTrigger.kind === "proximity");
    assert.ok(night.aggroTrigger.distance >= 30);
    assert.ok(night.disengageDistance >= 48);
    assert.ok(night.attackDamage >= 30);
    assert.ok(night.attackIntervalSecs <= 1.1);
    assert.ok(night.attackDistance > base.attackDistance);
    assert.equal(night.attackStrikeMomentSecs, base.attackStrikeMomentSecs);
    assert.ok(night.attackAnimationMultiplier > base.attackAnimationMultiplier);
    assert.ok(NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER >= 1.8);
    assert.equal(night.attackFovDeg, base.attackFovDeg);
    assert.equal(
      enhancedNightMuckerHexCombatParams(
        "Pale Hexer",
        true,
        { ...base, attackFovDeg: 360 },
        base
      )?.attackFovDeg,
      HARTHMERE_NON_BOSS_CREATURE_MELEE_FOV_CAP_DEG,
      "stale/wide source data must not turn a creature swing into a rear hit"
    );

    assert.equal(
      enhancedNightMuckerHexCombatParams("Pale Hexer", false, base, base),
      undefined
    );
    assert.equal(
      enhancedNightMuckerHexCombatParams("Road Bandit Scout", true, base, base),
      undefined
    );
  });
});

describe("chase attack: Harthmere sight and speed limits", () => {
  it("keeps combat creatures sight-bound without affecting protected actors", () => {
    for (const name of [
      "Old Wood Mucker",
      "Gravewood Hexer",
      "Road Bandit Scout",
      "Muckmeadow Cow",
      "Guarded Sheep",
    ]) {
      assert.equal(isHarthmereSightBoundChaserName(name), true, name);
    }
    assert.equal(
      isHarthmereSightBoundChaserName("Captured Bandit Prisoner"),
      false
    );
    assert.equal(isHarthmereSightBoundChaserName("Mucker Ward"), false);
    assert.equal(isHarthmereSightBoundChaserName("Town Guard"), false);
  });

  it("compounds the pursuit tuning history, then applies the extra 10% slowdown", () => {
    assert.equal(HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER, 1.35);
    assert.equal(HARTHMERE_NPC_CHASE_SPEED_STEP_UP_20, 1.2);
    assert.equal(HARTHMERE_NPC_CHASE_SPEED_STEP_UP_30, 1.3);
    assert.equal(HARTHMERE_NPC_SPEED_STEP_DOWN_30, 0.7);
    assert.equal(HARTHMERE_NPC_SPEED_STEP_DOWN_10, 0.9);
    assert.equal(HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN, 0.63);
    // Cumulative, not a replacement: 1.35 -> 1.62 -> 2.106 -> 1.32678.
    assert.equal(
      HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
      HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER * 1.2 * 1.3 * 0.7 * 0.9
    );
    // The 2026-08-03 30% pass and this 10% follow-up are both retained.
    assert.ok(
      Math.abs(
        HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER -
          HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER * 1.2 * 1.3 * 0.7 * 0.9
      ) < 1e-9
    );
    assert.ok(
      HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER <
        HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER * 1.2 * 1.3
    );
    assert.equal(
      boundedHarthmereChaseSpeedForName("Muckmeadow Cow", 2),
      2 * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER
    );
    assert.equal(
      boundedHarthmereChaseSpeedForName("Pale Hexer", 8.64),
      HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND
    );
    // The cap must stay strictly below the 8 m/s player sprint transition, and
    // it scales with the step-down so the ceiling cannot absorb the reduction.
    assert.ok(HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND < 8);
    assert.equal(
      HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
      7.6 * 0.7 * 0.9
    );
    assert.equal(
      boundedHarthmereChaseSpeedForName("Road Bandit Scout", 5.1),
      5.1 * HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN
    );
    assert.equal(
      boundedHarthmereChaseSpeedForName("Unrelated NPC", 8.64),
      8.64
    );
  });

  it("never accelerates town walkers, vendors, guards, or other civilians", () => {
    for (const name of [
      "Rowan, Walker",
      "Local Dev Walking Townsperson",
      "Harthmere Vendor",
      "Town Guard",
      "Iva the Innkeeper",
      "Market Clerk",
      "Toma, Builder",
      "Mira, Town Guide",
      "Grove Villager",
      "Shop Customer",
      "Blacksmith Apprentice",
    ]) {
      assert.equal(isHarthmereCivilianNpcName(name), true, `civilian: ${name}`);
      assert.equal(
        isHarthmereFightSpeedBoostName(name),
        false,
        `boost: ${name}`
      );
      assert.equal(
        boundedHarthmereChaseSpeedForName(name, 2.2),
        2.2,
        `speed: ${name}`
      );
      assert.equal(
        isHarthmereFightSpeedBoostEligible({
          name,
          isPlayerOwned: false,
          isCombatCapable: true,
        }),
        false,
        `eligible: ${name}`
      );
    }
    // Robots/archivists are already excluded by the protected-actor veto.
    assert.equal(isHarthmereFightSpeedBoostName("Bolt, Archive Robot"), false);
    assert.equal(
      boundedHarthmereChaseSpeedForName("Bolt, Archive Robot", 2.2),
      2.2
    );
    // Actual combatants are unaffected by the civilian veto.
    assert.equal(isHarthmereCivilianNpcName("Old Wood Mucker"), false);
    assert.equal(isHarthmereCivilianNpcName("Muckmeadow Cow"), false);
    assert.equal(isHarthmereFightSpeedBoostName("Old Wood Mucker"), true);
  });

  it("slows every hostile monster class while preserving civilians and owned creatures", () => {
    for (const name of [
      "Road Bandit Scout",
      "Grave Undead",
      "Root-Crowned Monster",
      "Thaedryn Boss",
      "Wild Wolf",
    ]) {
      assert.equal(isHarthmereMonsterSpeedName(name), true, name);
      assert.equal(
        boundedHarthmereChaseSpeedForName(name, 4),
        isHarthmereFightSpeedBoostName(name)
          ? Math.min(
              4 * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
              HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND
            )
          : 4 * HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN,
        name
      );
    }
    for (const name of [
      "Town Guard",
      "Harthmere Vendor",
      "Tamed Wolf Companion",
      "Archive Robot Sentinel",
    ]) {
      assert.equal(isHarthmereMonsterSpeedName(name), false, name);
      assert.equal(boundedHarthmereChaseSpeedForName(name, 4), 4, name);
    }
  });

  it("limits fight-speed boosts to Muckers, Hexes, and unowned animals", () => {
    for (const name of [
      "Old Wood Mucker",
      "Pale Hexer",
      "Muckmeadow Cow",
      "Guarded Sheep",
      "Wild Wolf",
      "Marsh Boar",
    ]) {
      assert.equal(isHarthmereFightSpeedBoostName(name), true, name);
    }
    for (const name of [
      "Road Bandit Scout",
      "Wilds Bandit",
      "Local Dev Walking Townsperson",
      "Harthmere Vendor",
      "Captured Bandit Prisoner",
      "Mucker Ward",
      "Tamed Wolf Companion",
      "Owned Cow Pet",
      "Horse Mount",
    ]) {
      assert.equal(isHarthmereFightSpeedBoostName(name), false, name);
    }
    assert.equal(
      isHarthmereFightSpeedBoostEligible({
        name: "Wild Wolf",
        isPlayerOwned: true,
        isCombatCapable: true,
      }),
      false
    );
    assert.equal(
      isHarthmereFightSpeedBoostEligible({
        name: "Wild Wolf",
        isPlayerOwned: false,
        isCombatCapable: false,
      }),
      false
    );
    assert.equal(
      isHarthmereFightSpeedBoostEligible({
        name: "Wild Wolf",
        isPlayerOwned: false,
        isCombatCapable: true,
      }),
      true
    );
  });

  it("drops a Harthmere combat target exactly when sight is broken", () => {
    assert.equal(
      shouldDropHarthmereChaseTargetForLineOfSight("Old Wood Mucker", true),
      false
    );
    assert.equal(
      shouldDropHarthmereChaseTargetForLineOfSight("Old Wood Mucker", false),
      true
    );
    assert.equal(
      shouldDropHarthmereChaseTargetForLineOfSight("Unrelated NPC", false),
      false
    );
  });
});

describe("chase attack: mixed creature group retaliation", () => {
  const recipientId = 9101 as BiomesId;
  const attackedAnimalId = 9102 as BiomesId;
  const secondSourceId = 9103 as BiomesId;
  const playerId = 9201 as BiomesId;
  const secondPlayerId = 9202 as BiomesId;
  const now = 10_000;

  const candidate = (
    overrides: Partial<MixedCreatureGroupAlertCandidate> = {}
  ): MixedCreatureGroupAlertCandidate => ({
    id: attackedAnimalId,
    position: [5, 50, 0],
    eligible: true,
    hasLineOfSight: true,
    lastDamageSource: { kind: "attack", attacker: playerId },
    lastDamageTime: now - 1,
    lastDamageAmount: -10,
    ...overrides,
  });

  const evaluate = (
    candidates: MixedCreatureGroupAlertCandidate[],
    overrides: Partial<
      Parameters<typeof evaluateMixedCreatureGroupRetaliationTarget>[0]
    > = {}
  ) =>
    evaluateMixedCreatureGroupRetaliationTarget({
      recipientId,
      recipientEligible: true,
      recipientPosition: [0, 50, 0],
      candidates,
      lookupAttacker: (id) =>
        id === playerId || id === secondPlayerId
          ? {
              position: [8, 50, 0],
              hp: 100,
              isPlayer: true,
              canBeTargeted: true,
            }
          : undefined,
      now,
      memorySeconds: ATTACK_MEMORY_SECONDS,
      deAggroDistanceSq: 34 * 34,
      ...overrides,
    });

  it("classifies only Muckers, Hexes, and herd animals", () => {
    assert.equal(isMixedCreatureGroupRetaliationName("Old Wood Mucker"), true);
    assert.equal(isMixedCreatureGroupRetaliationName("Pale Hexer"), true);
    assert.equal(isMixedCreatureGroupRetaliationName("Muckmeadow Cow"), true);
    assert.equal(isMixedCreatureGroupRetaliationName("Guarded Sheep"), true);
    assert.equal(isMixedCreatureGroupRetaliationName("Wild Rabbit"), true);
    assert.equal(
      isMixedCreatureGroupRetaliationName("Rabbit Companion"),
      false
    );
    assert.equal(isMixedCreatureGroupRetaliationName("Mucker Ward"), false);
    assert.equal(isMixedCreatureGroupRetaliationName("Town Guard"), false);
  });

  it("excludes owned, restrained, protected, and incomplete NPC entities", () => {
    const eligible = {
      name: "Muckmeadow Cow",
      hasHealth: true,
      hasPosition: true,
      hasNpcMetadata: true,
      isPlayerOwned: false,
      isLockedInPlace: false,
      isRobot: false,
      isQuestGiver: false,
    };
    assert.equal(isMixedCreatureGroupRetaliationEligible(eligible), true);
    for (const invalid of [
      { ...eligible, hasHealth: false },
      { ...eligible, hasPosition: false },
      { ...eligible, hasNpcMetadata: false },
      { ...eligible, isPlayerOwned: true },
      { ...eligible, isLockedInPlace: true },
      { ...eligible, isRobot: true },
      { ...eligible, isQuestGiver: true },
    ]) {
      assert.equal(isMixedCreatureGroupRetaliationEligible(invalid), false);
    }
  });

  it("alerts a nearby mixed-creature ally to the actual player attacker", () => {
    assert.equal(evaluate([candidate()]), playerId);
  });

  it("still alerts after the attacked source is killed in one hit", () => {
    // Candidate health is deliberately not part of the decision: the corpse's
    // authoritative hit metadata remains the witness for the alert window.
    assert.equal(evaluate([candidate({ lastDamageAmount: -999 })]), playerId);
  });

  it("does not recursively propagate an alert without a real damage record", () => {
    assert.equal(
      evaluate([
        candidate({
          lastDamageSource: undefined,
          lastDamageTime: undefined,
          lastDamageAmount: undefined,
        }),
      ]),
      undefined
    );
  });

  it("rejects stale, future, environmental, zero, and healing damage", () => {
    const invalid = [
      candidate({ lastDamageTime: now - ATTACK_MEMORY_SECONDS }),
      candidate({ lastDamageTime: now + 1 }),
      candidate({
        lastDamageSource: { kind: "drown", attacker: playerId },
      }),
      candidate({ lastDamageAmount: 0 }),
      candidate({ lastDamageAmount: 5 }),
    ];
    for (const entry of invalid) {
      assert.equal(evaluate([entry]), undefined);
    }
  });

  it("does not alert self, ineligible families, obscured allies, or distant groups", () => {
    const invalid = [
      candidate({ id: recipientId }),
      candidate({ eligible: false }),
      candidate({ hasLineOfSight: false }),
      candidate({
        position: [MIXED_CREATURE_GROUP_ALERT_RADIUS + 0.1, 50, 0],
      }),
      candidate({
        position: [
          1,
          50 + MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE + 1,
          0,
        ],
      }),
    ];
    for (const entry of invalid) {
      assert.equal(evaluate([entry]), undefined);
    }
  });

  it("rejects dead, non-player, protected, missing, and out-of-leash attackers", () => {
    const attackerStates = [
      {
        position: [8, 50, 0] as const,
        hp: 0,
        isPlayer: true,
        canBeTargeted: true,
      },
      {
        position: [8, 50, 0] as const,
        hp: 100,
        isPlayer: false,
        canBeTargeted: true,
      },
      {
        position: [8, 50, 0] as const,
        hp: 100,
        isPlayer: true,
        canBeTargeted: false,
      },
      undefined,
      {
        position: [40, 50, 0] as const,
        hp: 100,
        isPlayer: true,
        canBeTargeted: true,
      },
    ];
    for (const state of attackerStates) {
      assert.equal(
        evaluate([candidate()], {
          lookupAttacker: () => state,
          deAggroDistanceSq: 34 * 34,
        }),
        undefined
      );
    }
  });

  it("keeps active retaliation participants across safe-zone boundaries", () => {
    assert.equal(
      shouldDropNpcTargetAtSafeZoneBoundary({
        targetId: playerId,
        recentDirectAttackerId: undefined,
        targetInSafeZone: true,
      }),
      true
    );
    assert.equal(
      shouldDropNpcTargetAtSafeZoneBoundary({
        targetId: playerId,
        recentDirectAttackerId: playerId,
        targetInSafeZone: true,
      }),
      false
    );
    assert.equal(
      shouldDropNpcTargetAtSafeZoneBoundary({
        targetId: playerId,
        recentDirectAttackerId: undefined,
        activeRetaliationParticipant: true,
        targetInSafeZone: true,
      }),
      false
    );
    assert.equal(
      shouldDropNpcTargetAtSafeZoneBoundary({
        targetId: playerId,
        recentDirectAttackerId: undefined,
        targetInSafeZone: false,
      }),
      false
    );
  });

  it("chooses the newest valid attacked ally and breaks ties deterministically", () => {
    assert.equal(
      evaluate([
        candidate({ lastDamageTime: now - 2 }),
        candidate({
          id: secondSourceId,
          position: [7, 50, 0],
          lastDamageSource: { kind: "attack", attacker: secondPlayerId },
          lastDamageTime: now - 1,
        }),
      ]),
      secondPlayerId
    );

    assert.equal(
      evaluate([
        candidate({ position: [6, 50, 0] }),
        candidate({
          id: secondSourceId,
          position: [4, 50, 0],
          lastDamageSource: { kind: "attack", attacker: secondPlayerId },
        }),
      ]),
      secondPlayerId
    );
  });

  it("rejects future direct-hit timestamps as well as future group alerts", () => {
    assert.equal(
      evaluateRetaliationTarget({
        lastDamageSource: { kind: "attack", attacker: playerId },
        lastDamageTime: now + 1,
        npcPosition: [0, 50, 0],
        deAggroDistanceSq: 34 * 34,
        lookupEntity: () => ({
          position: { v: [8, 50, 0] },
          health: { hp: 100 },
        }),
        now,
        memorySeconds: ATTACK_MEMORY_SECONDS,
      }),
      undefined
    );
  });
});

describe("chase attack: multiplayer retaliation rotation", () => {
  it("keeps the opener for one readable exchange, then advances", () => {
    const openedAt = 100;
    assert.equal(
      retaliationTargetRotationIndex({
        nowSeconds: openedAt + RETALIATION_TARGET_ROTATION_SECONDS - 0.001,
        encounterOpenedAtSeconds: openedAt,
      }),
      0
    );
    assert.equal(
      retaliationTargetRotationIndex({
        nowSeconds: openedAt + RETALIATION_TARGET_ROTATION_SECONDS,
        encounterOpenedAtSeconds: openedAt,
      }),
      1
    );
  });

  it("offsets authored group responders across nearby players", () => {
    assert.deepEqual(
      [0, 1, 2].map((responderRank) =>
        retaliationTargetRotationIndex({
          nowSeconds: 100,
          encounterOpenedAtSeconds: 100,
          responderRank,
        })
      ),
      [0, 1, 2]
    );
  });

  it("uses a bounded local encounter radius", () => {
    assert.equal(RETALIATION_VICINITY_RADIUS_METERS, 18);
  });

  it("includes an active NPC escort but excludes unrelated nearby NPCs", () => {
    const encounterNpcId = 100 as BiomesId;
    const openerId = 200 as BiomesId;
    const escortId = 300 as BiomesId;
    assert.equal(
      isRetaliationEncounterParticipant({
        participantId: escortId,
        encounterNpcId,
        openerId,
        isPlayer: false,
        isNpc: true,
        npcAttackTarget: encounterNpcId,
      }),
      true
    );
    assert.equal(
      isRetaliationEncounterParticipant({
        participantId: escortId,
        encounterNpcId,
        openerId,
        isPlayer: false,
        isNpc: true,
      }),
      false
    );
    assert.equal(
      isRetaliationEncounterParticipant({
        participantId: openerId,
        encounterNpcId,
        openerId,
        isPlayer: false,
        isNpc: true,
      }),
      true
    );
  });
});

describe("chase attack: long-range projectile retaliation", () => {
  const attackerId = 9301 as BiomesId;
  const now = 10_000;

  it("extends only projectiles that outrange the authored chase leash", () => {
    assert.equal(
      harthmereProjectileRetaliationLeashDistance({
        authoredDisengageDistance: 34,
        projectileReach: 24,
        attackerDistance: 20,
      }),
      34,
      "ordinary bow contact inside a Mucker leash should not enlarge it"
    );
    assert.equal(
      harthmereProjectileRetaliationLeashDistance({
        authoredDisengageDistance: 16,
        projectileReach: 24,
        attackerDistance: 20,
      }),
      24 + HARTHMERE_PROJECTILE_RETALIATION_CHASE_BUFFER_METERS,
      "a bow that can hit livestock beyond its leash must open a chase"
    );
    assert.equal(
      harthmereProjectileRetaliationLeashDistance({
        authoredDisengageDistance: 34,
        projectileReach: 68,
        attackerDistance: 60,
      }),
      68 + HARTHMERE_PROJECTILE_RETALIATION_CHASE_BUFFER_METERS,
      "the longest energy weapon must not become a free stationary kill"
    );
  });

  it("acquires the projectile attacker during retaliation memory, then restores the authored leash", () => {
    const projectileRetaliation = {
      attackerId,
      leashDistance: 72,
      expiresAt: now + ATTACK_MEMORY_SECONDS,
    };
    const extendedDistance = effectiveRetaliationDisengageDistance({
      authoredDisengageDistance: 34,
      targetId: attackerId,
      now,
      projectileRetaliation,
    });
    assert.equal(extendedDistance, 72);
    assert.equal(
      evaluateRetaliationTarget({
        lastDamageSource: { kind: "attack", attacker: attackerId },
        lastDamageTime: now - 1,
        npcPosition: [0, 0, 0],
        deAggroDistanceSq: extendedDistance ** 2,
        lookupEntity: () => ({
          position: { v: [60, 0, 0] },
          health: { hp: 100 },
        }),
        now,
        memorySeconds: ATTACK_MEMORY_SECONDS,
      }),
      attackerId
    );
    assert.equal(
      effectiveRetaliationDisengageDistance({
        authoredDisengageDistance: 34,
        targetId: attackerId,
        now: projectileRetaliation.expiresAt,
        projectileRetaliation,
      }),
      34
    );
    assert.equal(
      effectiveRetaliationDisengageDistance({
        authoredDisengageDistance: 34,
        targetId: 9302 as BiomesId,
        now,
        projectileRetaliation,
      }),
      34,
      "the extension belongs only to the player whose projectile connected"
    );
  });
});
