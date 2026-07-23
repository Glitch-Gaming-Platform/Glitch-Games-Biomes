import assert from "assert";

import {
  ATTACK_MEMORY_SECONDS,
  boundedHarthmereChaseSpeedForName,
  chasePathTargetIsStale,
  enhancedNightMuckerHexCombatParams,
  evaluateMixedCreatureGroupRetaliationTarget,
  evaluateRetaliationTarget,
  effectiveAttackStrikeDelaySecs,
  isMixedCreatureGroupRetaliationEligible,
  isMixedCreatureGroupRetaliationName,
  isHarthmereSightBoundChaserName,
  isMuckerOrHexerNameForNightAggro,
  isNightForNpcAggro,
  MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE,
  MIXED_CREATURE_GROUP_ALERT_RADIUS,
  NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER,
  HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
  HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
  shouldDropHarthmereChaseTargetForLineOfSight,
  shouldDropNpcTargetAtSafeZoneBoundary,
  type MixedCreatureGroupAlertCandidate,
} from "@/shared/npc/behavior/chase_attack";
import type { Path } from "@/shared/npc/behavior/pathfinding";
import type { BiomesId } from "@/shared/ids";

const pathTo = (dest: [number, number, number]): Path => ({
  nodes: [{ position: [0, 0, 0] }, { position: dest }],
});

describe("chase attack: strike timing", () => {
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
});

describe("chase attack: night muck/hex aggression helpers", () => {
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
    assert.ok(NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER >= 1.8);

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

  it("boosts Harthmere pursuit while keeping it below player sprint pace", () => {
    assert.equal(
      boundedHarthmereChaseSpeedForName("Pale Hexer", 8.64),
      HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND
    );
    assert.equal(
      boundedHarthmereChaseSpeedForName("Road Bandit Scout", 5.1),
      5.1 * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER
    );
    assert.equal(
      boundedHarthmereChaseSpeedForName("Unrelated NPC", 8.64),
      8.64
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

  it("drops shared-alert targets at safe-zone boundaries but preserves direct retaliation", () => {
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
