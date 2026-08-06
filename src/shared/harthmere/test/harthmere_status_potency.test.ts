import assert from "assert";
import {
  reduceHarthmereCombatAction,
  registerHarthmereAbility,
  registerHarthmereClassDefinition,
  type HarthmereCombatActionContext,
} from "../mmo_combat_authority";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "../live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";

const ABILITY_ID = "status_potency_test_curse";

describe("Harthmere status-effect potency", () => {
  before(() => {
    registerHarthmereClassDefinition({
      classId: "status_test_mage",
      displayName: "Status Test Mage",
      availableSpecializations: ["hexer"],
      primaryResource: "mana",
      maxResourceByLevel: { 1: 100 },
      hpPerLevel: 10,
      baseHp: 100,
      attackPowerPerLevel: 0,
      spellPowerPerLevel: 1,
    });
    registerHarthmereAbility({
      abilityId: ABILITY_ID,
      displayName: "Shadow Curse",
      targetType: "single_enemy",
      classRestriction: ["status_test_mage"],
      specRestriction: [],
      levelRequirement: 1,
      requiredWeaponType: "any",
      resourceKind: "mana",
      resourceCost: 20,
      cooldownMs: 1_000,
      rangeUnits: 10,
      requiresLineOfSight: false,
      allowedInSafeZone: false,
      allowedInPvP: true,
      baseDamage: 1,
      baseHealing: 0,
      attackPowerScaling: 0,
      spellPowerScaling: 0,
      xpReward: 1,
      castTimeMs: 0,
      interruptible: true,
      unlocksMilestones: [],
      statusEffects: [
        {
          effectId: "test_weakness",
          kind: "debuff",
          basePotency: 10,
          durationMs: 5_000,
          target: "resolved_target",
        },
      ],
    });
  });

  function context(skillLevel: number): HarthmereCombatActionContext {
    return {
      actor: {
        actorId: "status_actor",
        classId: "status_test_mage",
        specializationId: "hexer",
        level: 1,
        hp: 100,
        maxHp: 100,
        resource: 100,
        maxResource: 100,
        resourceKind: "mana",
        cooldowns: {},
        sharedCooldowns: {},
        knownAbilities: [ABILITY_ID],
        equippedAbilities: [ABILITY_ID],
        activeTalentNodes: [],
        mainHandWeaponType: "staff",
        offHandWeaponType: "none",
        deathState: "alive",
        position: { x: 0, y: 0, z: 0 },
        pvpFlagged: false,
        legalFlags: {},
      },
      target: {
        targetId: "status_target",
        isHostile: true,
        isAlive: true,
        isAttackable: true,
        hp: 100,
        maxHp: 100,
        position: { x: 2, y: 0, z: 0 },
        isPlayer: false,
        zonePvPRule: "open_pvp",
      },
      zone: {
        zoneId: "status_zone",
        pvpRule: "open_pvp",
        isSafeZone: false,
        allowPvP: true,
        activeLegalSystem: false,
      },
      respecCount: 0,
      actorGold: 0,
      talentPointsAvailable: 0,
      skillLevels: { combat: skillLevel, shadow_magic: skillLevel },
    };
  }

  it("emits a server-authored status effect and caps its magnitude at 25 percent", () => {
    const result = reduceHarthmereCombatAction(
      {
        requestId: "status-master",
        kind: "ability_cast",
        actorId: "status_actor",
        targetId: "status_target",
        abilityId: ABILITY_ID,
        nowMs: 10_000,
      },
      context(100)
    );
    assert.equal(result.ok, true);
    assert.equal(result.statusEffects.length, 1);
    assert.equal(result.statusEffects[0].potency, 12.5);
    assert.equal(result.statusEffects[0].expiresAtMs, 15_000);
    assert.equal(result.statusEffects[0].targetId, "status_target");
  });

  it("has no bonus at level one", () => {
    const result = reduceHarthmereCombatAction(
      {
        requestId: "status-novice",
        kind: "ability_cast",
        actorId: "status_actor",
        targetId: "status_target",
        abilityId: ABILITY_ID,
        nowMs: 20_000,
      },
      context(1)
    );
    assert.equal(result.statusEffects[0].potency, 10);
  });

  it("persists the resolved status on the authoritative live combat target", () => {
    const state = defaultHarthmereLiveModeBackendState("status_actor", 30_000);
    state.classMagic.classId = "status_test_mage";
    state.classMagic.specializationId = "hexer";
    state.classMagic.knownAbilities = [ABILITY_ID];
    state.classMagic.loadout = { slot_1: ABILITY_ID };
    state.classMagic.skills.combat = { xp: 0, level: 100 };
    state.classMagic.skills.shadow_magic = { xp: 0, level: 100 };
    state.classMagic.skills.death_lore = { xp: 0, level: 100 };
    state.combat.entitySnapshots.status_target = {
      hp: 100,
      maxHp: 100,
      position: { x: 2, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "undead",
      species: "skeleton",
    };
    const envelope: HarthmereLiveModeAuthorityEnvelope = {
      requestId: "status-live",
      idempotencyKey: "status-live",
      actorId: "status_actor",
      actionKind: "request_ability_cast",
      subsystem: "combat",
      source: "client_request",
      serverReceivedAtMs: 30_000,
      serverTick: 1,
      actorEntityVersion: 1,
      zoneId: "wilds",
      targetId: "status_target",
      serverActorPosition: { x: 0, y: 0, z: 0 },
      payload: { abilityId: ABILITY_ID },
      clientClaims: {},
    };
    const result = reduceHarthmereLiveModeBackendState(
      state,
      envelope,
      30_000
    );
    const effects =
      result.state.combat.entitySnapshots.status_target.activeStatusEffects;
    assert.ok(effects, JSON.stringify(result.summary));
    assert.equal(effects!["test_weakness:status_actor"].potency, 12.5);
    assert.ok(result.summary.touchedModels.includes("combat_status_effects"));
  });
});
