import {
  effectiveHarthmereDeathStateForRespawn,
  harthmereDeathMovementShouldLockForTest,
  harthmereDeathScreenShouldRenderForTest,
  harthmereShouldClearLiveAliveDeathLockForTest,
  harthmereLivePlayerDeathSyncActionForTest,
  harthmereLivePlayerDeathSyncSummaryForTest,
  type HarthmereDeathState,
} from "@/client/components/challenges/LocalDevHarthmereDeathSystem";
import {
  createHarthmereDeathTransitionLiveModeRequestForTest,
  createHarthmereLocalCombatAttackLiveModeRequestForTest,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { harthmereRespawnDisabledReason } from "@/client/components/challenges/harthmereCombatDeathInterfaceRules";
import assert from "assert";

describe("Harthmere live death sync", () => {
  const aliveDeathState = (state?: Partial<HarthmereDeathState>) =>
    ({
      version: 1,
      state: "alive",
      deathCount: 0,
      recent: [],
      ...state,
    } satisfies HarthmereDeathState);

  it("treats live hp zero as dead even when the death state string is missing", () => {
    const summary = harthmereLivePlayerDeathSyncSummaryForTest({
      combat: { hp: 0, maxHp: 100 },
    });

    assert.equal(summary.dead, true);
    assert.equal(summary.alive, false);
  });

  it("treats live positive hp and alive state as recovered", () => {
    const summary = harthmereLivePlayerDeathSyncSummaryForTest({
      combat: { hp: 61, maxHp: 240, deathState: "alive" },
    });

    assert.equal(summary.dead, false);
    assert.equal(summary.alive, true);
  });

  it("does not let a dead live state look alive just because hp is stale positive", () => {
    const summary = harthmereLivePlayerDeathSyncSummaryForTest({
      combat: { hp: 61, maxHp: 240, deathState: "dead" },
    });

    assert.equal(summary.dead, true);
    assert.equal(summary.alive, false);
  });

  it("does not let a stale live-alive read clear a local zero-hp death lock", () => {
    assert.equal(
      harthmereShouldClearLiveAliveDeathLockForTest({
        deathState: "dead",
        hp: 0,
        combatState: "dead",
      }),
      false
    );
  });

  it("clears a stale death lock only after local combat is actually alive", () => {
    assert.equal(
      harthmereShouldClearLiveAliveDeathLockForTest({
        deathState: "dead",
        hp: 61,
        combatState: "idle",
      }),
      true
    );
  });

  it("makes a local hp-zero player immediately respawnable at The Grove", () => {
    const effective = effectiveHarthmereDeathStateForRespawn({
      death: aliveDeathState(),
      combatHp: 0,
      combatMaxHp: 240,
      combatState: "idle",
      nowMs: 1_800_000,
    });

    assert.equal(effective.state, "dead");
    assert.equal(effective.currentDeath?.cause, "HP reached zero");
    assert.equal(
      harthmereRespawnDisabledReason(effective, "the_grove"),
      undefined
    );
  });

  it("makes a dead combat-state player respawnable even if hp has not caught up", () => {
    const effective = effectiveHarthmereDeathStateForRespawn({
      death: aliveDeathState(),
      combatHp: 61,
      combatMaxHp: 240,
      combatState: "dead",
      nowMs: 1_800_000,
    });

    assert.equal(effective.state, "dead");
    assert.match(effective.currentDeath?.cause ?? "", /Combat state is dead/);
    assert.equal(
      harthmereRespawnDisabledReason(effective, "the_grove"),
      undefined
    );
  });

  it("makes a live hp-zero player status respawnable before local storage catches up", () => {
    const effective = effectiveHarthmereDeathStateForRespawn({
      death: aliveDeathState(),
      combatHp: 240,
      combatMaxHp: 240,
      combatState: "idle",
      liveHp: 0,
      liveDeathState: "alive",
      nowMs: 1_800_000,
    });

    assert.equal(effective.state, "dead");
    assert.equal(effective.currentDeath?.cause, "HP reached zero");
    assert.equal(
      harthmereRespawnDisabledReason(effective, "the_grove"),
      undefined
    );
  });

  it("preserves an existing locked death record instead of overwriting the recap", () => {
    const death = aliveDeathState({
      state: "downed",
      currentDeath: {
        deathId: "existing",
        state: "downed",
        zone: "Harthmere",
        position: [1, 2, 3],
        cause: "Mucker Bite reduced you to 0 HP",
        killerType: "npc",
        killerName: "Mucker",
        damageSummary: [],
        durabilityLossPercent: 5,
        xpDebt: 0,
        corpsePosition: [1, 2, 3],
        availableRespawns: ["the_grove"],
        createdAt: 1_700_000,
      },
    });

    const effective = effectiveHarthmereDeathStateForRespawn({
      death,
      combatHp: 0,
      combatMaxHp: 240,
      combatState: "dead",
      nowMs: 1_800_000,
    });

    assert.strictEqual(effective, death);
    assert.equal(effective.currentDeath?.deathId, "existing");
  });

  it("does not turn normal positive-hp combat into a death screen", () => {
    const death = aliveDeathState();
    const effective = effectiveHarthmereDeathStateForRespawn({
      death,
      combatHp: 240,
      combatMaxHp: 240,
      combatState: "idle",
      liveHp: 240,
      liveDeathState: "alive",
      nowMs: 1_800_000,
    });

    assert.strictEqual(effective, death);
  });

  it("does not let the wake-up screen suppress a real death screen or movement lock", () => {
    const death = aliveDeathState();
    const effective = effectiveHarthmereDeathStateForRespawn({
      death,
      combatHp: 0,
      combatMaxHp: 260,
      combatState: "idle",
      nowMs: 1_800_000,
    });

    assert.equal(
      harthmereDeathScreenShouldRenderForTest({
        death,
        effectiveDeath: effective,
        wakeUpActive: true,
      }),
      true
    );
    assert.equal(
      harthmereDeathMovementShouldLockForTest({
        deathState: "alive",
        hp: 0,
        combatState: "idle",
        wakeUpActive: true,
      }),
      true
    );
  });

  it("routes every authoritative live HP-zero source into the shared death screen path", () => {
    const cases = [
      {
        label: "falling",
        lastDeath: { cause: "fall_damage" },
        expectedCause: "fall_damage",
        expectedAbility: "Fall Damage",
        expectedDamageType: "survival",
      },
      {
        label: "drowning",
        lastDeath: { cause: "drowning" },
        expectedCause: "drowning",
        expectedAbility: "Drowning",
        expectedDamageType: "survival",
      },
      {
        label: "stamina loss",
        lastDeath: { cause: "stamina_depleted" },
        expectedCause: "Stamina reached zero",
        expectedAbility: "Stamina Depletion",
        expectedDamageType: "survival",
      },
      {
        label: "attacks",
        lastDeath: { cause: "mucker_attack" },
        expectedCause: "Live player status is dead",
        expectedAbility: "Live Entity Attack",
        expectedDamageType: "combat",
      },
    ];

    for (const entry of cases) {
      const action = harthmereLivePlayerDeathSyncActionForTest({
        status: {
          combat: {
            hp: 0,
            maxHp: 100,
            deathState: "dead",
            lastDeath: {
              deathId: `${entry.label}-death`,
              zoneId: "the_grove",
              atMs: 1_800_000,
              respawnAvailableAtMs: 1_805_000,
              ...entry.lastDeath,
            },
          },
        },
        currentDeathState: "alive",
        localHp: 100,
        localMaxHp: 100,
        localCombatState: "idle",
      });

      assert.equal(action.kind, "down", entry.label);
      if (action.kind !== "down") continue;
      assert.equal(action.cause, entry.expectedCause, entry.label);
      assert.equal(action.abilityName, entry.expectedAbility, entry.label);
      assert.equal(action.damageType, entry.expectedDamageType, entry.label);

      const effective = effectiveHarthmereDeathStateForRespawn({
        death: aliveDeathState(),
        combatHp: 100,
        combatMaxHp: 100,
        combatState: "idle",
        liveHp: 0,
        liveDeathState: "dead",
        nowMs: 1_800_000,
      });

      assert.equal(
        harthmereDeathScreenShouldRenderForTest({
          death: aliveDeathState(),
          effectiveDeath: effective,
        }),
        true,
        entry.label
      );
      assert.equal(
        harthmereDeathMovementShouldLockForTest({
          deathState: "dead",
          hp: 0,
          combatState: "dead",
        }),
        true,
        entry.label
      );
      assert.equal(
        harthmereRespawnDisabledReason(effective, "the_grove"),
        undefined,
        entry.label
      );
    }
  });

  it("does not re-enter the death transition when the player is already locked", () => {
    const action = harthmereLivePlayerDeathSyncActionForTest({
      status: {
        combat: {
          hp: 0,
          maxHp: 100,
          deathState: "dead",
        },
      },
      currentDeathState: "downed",
      localHp: 100,
      localMaxHp: 100,
      localCombatState: "idle",
    });

    assert.deepEqual(action, { kind: "pose", state: "downed" });
  });

  it("builds a Cloud Save death transition mutation when local combat downs the player", () => {
    const body = createHarthmereDeathTransitionLiveModeRequestForTest(
      {
        cause: "HP reached zero",
        killerName: "Mucker",
        detail: "Test death",
        abilityName: "Bite",
        damage: 260,
        damageType: "combat",
      },
      1_800_000
    );

    assert.equal(body.actionKind, "request_death_transition");
    assert.equal(body.subsystem, "combat");
    assert.equal(body.payload.cause, "HP reached zero");
    assert.equal(body.payload.damage, 260);
    assert.ok(body.includeSnapshots.includes("playerStatusState"));
  });

  it("builds a Cloud Save attack mutation with loot snapshots for local ECS combat hits", () => {
    const body = createHarthmereLocalCombatAttackLiveModeRequestForTest(
      {
        targetOffset: 8810000000019451,
        ability: "basic",
        source: "local_combat_test",
        finalDamage: 14,
        targetDead: true,
      },
      1_900_000
    );

    assert.ok(body);
    assert.equal(body?.actionKind, "request_attack");
    assert.equal(
      body?.targetId,
      "server-muck-combat:ambient-muck-monster-west_muck_breach-9451:9451"
    );
    assert.equal(body?.payload.abilityId, "basic_strike");
    assert.deepEqual(body?.includeSnapshots, [
      "combatState",
      "inventoryLootState",
      "playerStatusState",
    ]);
    assert.equal(body?.clientClaims.localTargetDead, true);
  });
});
