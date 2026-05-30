/**
 * mmo_combat_authority_v1.test.ts
 *
 * Comprehensive tests for server-authoritative combat/ability validation.
 * Covers ability casting, damage computation, respec, talent purchase,
 * loadout change, XP rewards, PvP legality, and edge cases.
 */

import assert from "assert";
import {
  computeHarthmereAbilityDamageV1,
  computeHarthmereAbilityHealingV1,
  computeHarthmereRespecCostV1,
  computeHarthmereXpRewardV1,
  isHarthmerePvPLegalV1,
  reduceHarthmereCombatActionV1,
  registerHarthmereAbilityV1,
  registerHarthmereClassDefinitionV1,
  type HarthmereAbilityCatalogueEntryV1,
  type HarthmereCombatActionContextV1,
  type HarthmereCombatActionRequestV1,
  type HarthmereCombatActorSnapshotV1,
  type HarthmereCombatTargetSnapshotV1,
  type HarthmereClassDefinitionV1,
  type HarthmereZoneSnapshotV1,
} from "../mmo_combat_authority_v1";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAbility(overrides: Partial<HarthmereAbilityCatalogueEntryV1> = {}): HarthmereAbilityCatalogueEntryV1 {
  return {
    abilityId: "slash",
    displayName: "Slash",
    targetType: "single_enemy",
    classRestriction: [],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "sword",
    resourceKind: "mana",
    resourceCost: 10,
    cooldownMs: 1500,
    rangeUnits: 5,
    requiresLineOfSight: false,
    allowedInSafeZone: false,
    allowedInPvP: true,
    baseDamage: 20,
    baseHealing: 0,
    attackPowerScaling: 1.0,
    spellPowerScaling: 0.0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: true,
    unlocksMilestones: [],
    ...overrides,
  };
}

function makeClass(overrides: Partial<HarthmereClassDefinitionV1> = {}): HarthmereClassDefinitionV1 {
  return {
    classId: "warrior",
    displayName: "Warrior",
    availableSpecializations: ["arms", "fury"],
    primaryResource: "mana",
    maxResourceByLevel: {},
    hpPerLevel: 10,
    baseHp: 100,
    attackPowerPerLevel: 3,
    spellPowerPerLevel: 0.5,
    ...overrides,
  };
}

function makeActor(overrides: Partial<HarthmereCombatActorSnapshotV1> = {}): HarthmereCombatActorSnapshotV1 {
  return {
    actorId: "player_1",
    classId: "warrior",
    specializationId: "arms",
    level: 10,
    hp: 100,
    maxHp: 100,
    resource: 50,
    maxResource: 50,
    resourceKind: "mana",
    equippedAbilities: ["slash"],
    knownAbilities: ["slash", "charge"],
    mainHandWeaponType: "sword",
    offHandWeaponType: "none",
    cooldowns: {},
    sharedCooldowns: {},
    activeTalentNodes: [],
    deathState: "alive",
    position: { x: 0, y: 0, z: 0 },
    pvpFlagged: false,
    legalFlags: {},
    ...overrides,
  };
}

function makeTarget(overrides: Partial<HarthmereCombatTargetSnapshotV1> = {}): HarthmereCombatTargetSnapshotV1 {
  return {
    targetId: "enemy_1",
    isAlive: true,
    isAttackable: true,
    isHostile: true,
    isPlayer: false,
    hp: 80,
    maxHp: 80,
    pvpFlagged: false,
    position: { x: 3, y: 0, z: 0 },
    zonePvPRule: "open_pvp",
    ...overrides,
  };
}

function makeZone(overrides: Partial<HarthmereZoneSnapshotV1> = {}): HarthmereZoneSnapshotV1 {
  return {
    zoneId: "town_square",
    pvpRule: "open_pvp",
    isSafeZone: false,
    allowPvP: true,
    activeLegalSystem: false,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<HarthmereCombatActionContextV1> = {}): HarthmereCombatActionContextV1 {
  return {
    actor: makeActor(),
    target: makeTarget(),
    zone: makeZone(),
    respecCount: 0,
    actorGold: 1000,
    talentPointsAvailable: 5,
    ...overrides,
  };
}

function makeReq(overrides: Partial<HarthmereCombatActionRequestV1> = {}): HarthmereCombatActionRequestV1 {
  return {
    requestId: "req_1",
    actorId: "player_1",
    kind: "ability_cast",
    abilityId: "slash",
    targetId: "enemy_1",
    nowMs: Date.now(),
    ...overrides,
  } as HarthmereCombatActionRequestV1;
}

before(() => {
  registerHarthmereClassDefinitionV1(makeClass({ classId: "warrior" }));
  registerHarthmereClassDefinitionV1(makeClass({
    classId: "mage",
    availableSpecializations: ["frost", "fire"],
    attackPowerPerLevel: 0.5,
    spellPowerPerLevel: 4,
  }));
  registerHarthmereAbilityV1(makeAbility({ abilityId: "slash", requiredWeaponType: "sword" }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "fireball",
    requiredWeaponType: "staff",
    resourceCost: 25,
    levelRequirement: 5,
    allowedInSafeZone: false,
    baseDamage: 40,
    spellPowerScaling: 1.5,
    attackPowerScaling: 0,
    classRestriction: ["mage"],
  }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "holy_shield",
    targetType: "self",
    allowedInSafeZone: true,
    resourceCost: 5,
    requiredWeaponType: "any",
    allowedInPvP: true,
  }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "charge",
    requiredWeaponType: "sword",
    cooldownMs: 15_000,
    resourceCost: 5,
  }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "guardian_wall",
    requiredWeaponType: "any",
    classRestriction: ["warrior"],
    specRestriction: ["protection"],
    resourceCost: 5,
  }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "axe_chop",
    requiredWeaponType: "axe",
    classRestriction: ["warrior"],
    resourceCost: 5,
  }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "self_heal",
    targetType: "self",
    allowedInSafeZone: true,
    requiredWeaponType: "any",
    baseDamage: 0,
    attackPowerScaling: 0,
    baseHealing: 30,
    spellPowerScaling: 0.5,
    resourceCost: 5,
  }));
  registerHarthmereAbilityV1(makeAbility({
    abilityId: "ally_heal",
    targetType: "single_ally",
    allowedInSafeZone: true,
    requiredWeaponType: "any",
    baseDamage: 0,
    attackPowerScaling: 0,
    baseHealing: 30,
    spellPowerScaling: 0.5,
    resourceCost: 5,
  }));
});

// ---------------------------------------------------------------------------
// Ability cast — happy path
// ---------------------------------------------------------------------------

describe("Ability cast — base cases", () => {
  it("succeeds for valid ability cast with all conditions met", () => {
    const ctx = makeCtx();
    const req = makeReq({ kind: "ability_cast", abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, `expected ok: ${result.errors?.join(", ")}`);
    assert.ok(result.damage !== undefined && result.damage > 0);
  });

  it("attack kind also routes through ability validation", () => {
    const ctx = makeCtx();
    const req = makeReq({ kind: "attack", abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });

  it("can miss a valid attack while still spending resource and cooldown", () => {
    const ctx = makeCtx();
    const req = makeReq({ requestId: "id_4", abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.hitResolution, "miss");
    assert.strictEqual(result.damage, 0);
    assert.strictEqual(result.targetId, undefined);
    assert.strictEqual(result.intendedTargetId, "enemy_1");
    assert.ok(result.warnings.includes("attack_missed"));
    assert.ok((result.newCooldowns.slash ?? 0) > req.nowMs);
    assert.strictEqual(result.actorResourceAfter, 40);
  });

  it("can scatter a missed attack into a nearby wrong target", () => {
    const wrongTarget = makeTarget({
      targetId: "market_stall_1",
      isHostile: false,
      isAttackable: true,
      hp: 50,
      maxHp: 50,
      position: { x: 2, y: 0, z: 0 },
    });
    const ctx = makeCtx({ nearbyTargets: [wrongTarget] });
    const req = makeReq({ requestId: "id_13", abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.hitResolution, "stray_hit");
    assert.strictEqual(result.targetId, "market_stall_1");
    assert.strictEqual(result.intendedTargetId, "enemy_1");
    assert.ok(result.damage > 0);
    assert.ok(result.warnings.includes("attack_strayed_to_non_hostile_target"));
  });

  it("does not scatter misses into PvP targets that are not legally attackable", () => {
    const protectedPlayer = makeTarget({
      targetId: "protected_player_1",
      isHostile: false,
      isAttackable: true,
      isPlayer: true,
      pvpFlagged: false,
      hp: 100,
      maxHp: 100,
      position: { x: 2, y: 0, z: 0 },
      zonePvPRule: "contested",
    });
    const ctx = makeCtx({
      zone: makeZone({ pvpRule: "contested", allowPvP: true, isSafeZone: false }),
      nearbyTargets: [protectedPlayer],
    });
    const req = makeReq({ requestId: "id_13", abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.hitResolution, "miss");
    assert.strictEqual(result.targetId, undefined);
    assert.ok(result.warnings.includes("attack_missed"));
  });

  it("does not turn offensive spell-power damage into target healing", () => {
    const actor = makeActor({
      classId: "mage",
      level: 10,
      resource: 100,
      knownAbilities: ["fireball"],
      equippedAbilities: ["fireball"],
      mainHandWeaponType: "staff",
    });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "ability_cast", abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.damage > 0);
    assert.strictEqual(result.healing, 0);
  });
});

// ---------------------------------------------------------------------------
// Ability cast — class/spec/level restrictions
// ---------------------------------------------------------------------------

describe("Ability cast — restrictions", () => {
  it("fails if ability not in known abilities", () => {
    const actor = makeActor({ knownAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("not_known")));
  });

  it("fails if ability not equipped", () => {
    const actor = makeActor({ knownAbilities: ["slash"], equippedAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("not_equipped")));
  });

  it("fails for class-restricted ability used by wrong class", () => {
    const actor = makeActor({ classId: "warrior", knownAbilities: ["fireball"], equippedAbilities: ["fireball"], mainHandWeaponType: "staff" });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("class")));
  });

  it("fails below level requirement", () => {
    const actor = makeActor({ classId: "mage", level: 3, knownAbilities: ["fireball"], equippedAbilities: ["fireball"], mainHandWeaponType: "staff" });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("level")));
  });

  it("fails with wrong weapon type", () => {
    const actor = makeActor({ mainHandWeaponType: "axe", knownAbilities: ["fireball"], equippedAbilities: ["fireball"], classId: "mage", level: 10 });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("weapon")));
  });

  it("fails when actor is dead", () => {
    const actor = makeActor({ deathState: "dead" });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails when target is dead", () => {
    const target = makeTarget({ isAlive: false });
    const ctx = makeCtx({ target });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails when an enemy ability targets a non-hostile entity", () => {
    const target = makeTarget({ isHostile: false, isAttackable: false });
    const ctx = makeCtx({ target });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("target_not_hostile"));
  });

  it("allows attackable neutral live entities to enter the same combat pipeline", () => {
    const target = makeTarget({
      targetId: "live_robot_sentinel_1",
      isHostile: false,
      isAttackable: true,
    });
    const ctx = makeCtx({ target });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
    assert.ok(result.damage >= 0);
    assert.ok(result.warnings.includes("attackable_neutral_target"));
  });

  it("rejects self-targeted abilities aimed at another entity", () => {
    const actor = makeActor({ knownAbilities: ["self_heal"], equippedAbilities: ["self_heal"] });
    const ctx = makeCtx({ actor, target: makeTarget() });
    const req = makeReq({ abilityId: "self_heal", targetId: "enemy_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("self_ability_cannot_target_other"));
  });

  it("allows ally-targeted healing on non-hostile non-attackable targets", () => {
    const actor = makeActor({ knownAbilities: ["ally_heal"], equippedAbilities: ["ally_heal"] });
    const ally = makeTarget({ isHostile: false, isAttackable: false, targetId: "ally_1" });
    const ctx = makeCtx({ actor, target: ally });
    const req = makeReq({ abilityId: "ally_heal", targetId: "ally_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
    assert.ok(result.healing > 0);
  });

  it("rejects ally-targeted healing on hostile targets", () => {
    const actor = makeActor({ knownAbilities: ["ally_heal"], equippedAbilities: ["ally_heal"] });
    const ctx = makeCtx({ actor, target: makeTarget({ isHostile: true }) });
    const req = makeReq({ abilityId: "ally_heal" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("target_not_ally"));
  });
});

// ---------------------------------------------------------------------------
// Resource and cooldown
// ---------------------------------------------------------------------------

describe("Ability cast — resource and cooldown", () => {
  it("fails when insufficient resource", () => {
    const actor = makeActor({ resource: 0 });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("resource") || e.includes("mana")));
  });

  it("fails when actor resource kind does not match the ability resource", () => {
    const actor = makeActor({ resourceKind: "energy", resource: 50 });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("resource_kind_mismatch"));
  });

  it("fails when ability is on cooldown", () => {
    const now = Date.now();
    const actor = makeActor({ cooldowns: { slash: now + 5000 } });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash", nowMs: now });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("cooldown")));
  });

  it("succeeds when cooldown has expired", () => {
    const now = Date.now();
    const actor = makeActor({ cooldowns: { slash: now - 100 } });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash", nowMs: now });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });
});

// ---------------------------------------------------------------------------
// Safe zone
// ---------------------------------------------------------------------------

describe("Ability cast — safe zone", () => {
  it("blocks offensive ability in safe zone", () => {
    const zone = makeZone({ isSafeZone: true, pvpRule: "safe_zone", allowPvP: false });
    const ctx = makeCtx({ zone });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("safe_zone")));
  });

  it("allows safe-zone-permitted ability in safe zone", () => {
    const zone = makeZone({ isSafeZone: true, pvpRule: "safe_zone", allowPvP: false });
    const actor = makeActor({ equippedAbilities: ["holy_shield"], knownAbilities: ["holy_shield"] });
    const ctx = makeCtx({ actor, zone, target: undefined });
    const req = makeReq({ abilityId: "holy_shield", targetId: undefined });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });
});

// ---------------------------------------------------------------------------
// Damage computation
// ---------------------------------------------------------------------------

describe("computeHarthmereAbilityDamageV1", () => {
  it("returns at least 1 damage", () => {
    const ability = makeAbility({ baseDamage: 0, attackPowerScaling: 0, spellPowerScaling: 0 });
    const cls = makeClass({ attackPowerPerLevel: 0, spellPowerPerLevel: 0, baseHp: 0 });
    const damage = computeHarthmereAbilityDamageV1(ability, cls, 1);
    assert.ok(damage >= 1);
  });

  it("scales with level", () => {
    const ability = makeAbility({ baseDamage: 10, attackPowerScaling: 1.0 });
    const cls = makeClass({ attackPowerPerLevel: 5 });
    const dmgL1 = computeHarthmereAbilityDamageV1(ability, cls, 1);
    const dmgL10 = computeHarthmereAbilityDamageV1(ability, cls, 10);
    assert.ok(dmgL10 > dmgL1, `level 10 (${dmgL10}) should exceed level 1 (${dmgL1})`);
  });

  it("variance multiplier shifts output proportionally", () => {
    const ability = makeAbility({ baseDamage: 100, attackPowerScaling: 0, spellPowerScaling: 0 });
    const cls = makeClass({ attackPowerPerLevel: 0, spellPowerPerLevel: 0, baseHp: 0 });
    const base = computeHarthmereAbilityDamageV1(ability, cls, 1, 1.0);
    const high = computeHarthmereAbilityDamageV1(ability, cls, 1, 1.1);
    const low  = computeHarthmereAbilityDamageV1(ability, cls, 1, 0.9);
    assert.ok(high > base);
    assert.ok(low < base);
  });
});

describe("computeHarthmereAbilityHealingV1", () => {
  it("returns zero for a non-healing ability", () => {
    const ability = makeAbility({ baseHealing: 0, spellPowerScaling: 0 });
    const cls = makeClass();
    assert.strictEqual(computeHarthmereAbilityHealingV1(ability, cls, 10), 0);
  });

  it("scales healing with spell power", () => {
    const ability = makeAbility({ baseHealing: 50, spellPowerScaling: 1.0 });
    const cls = makeClass({ spellPowerPerLevel: 5 });
    const healL1 = computeHarthmereAbilityHealingV1(ability, cls, 1);
    const healL10 = computeHarthmereAbilityHealingV1(ability, cls, 10);
    assert.ok(healL10 > healL1);
  });
});

// ---------------------------------------------------------------------------
// Respec
// ---------------------------------------------------------------------------

describe("Respec", () => {
  it("succeeds on first respec with sufficient gold", () => {
    const actor = makeActor({ cooldowns: {} });
    const cost = computeHarthmereRespecCostV1(0);
    const ctx = makeCtx({ actor, respecCount: 0, actorGold: cost + 1 });
    const req = makeReq({ kind: "respec" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.goldCost !== undefined && result.goldCost !== 0);
  });

  it("fails respec when gold is insufficient", () => {
    const cost = computeHarthmereRespecCostV1(0);
    const ctx = makeCtx({ respecCount: 0, actorGold: cost - 1 });
    const req = makeReq({ kind: "respec" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("gold") || e.includes("cost")));
  });

  it("escalates respec cost with each respec", () => {
    const cost0 = computeHarthmereRespecCostV1(0);
    const cost1 = computeHarthmereRespecCostV1(1);
    const cost5 = computeHarthmereRespecCostV1(5);
    assert.ok(cost1 > cost0, "cost should increase after first respec");
    assert.ok(cost5 > cost1, "cost should continue to escalate");
  });

  it("caps respec cost escalation at respecCount=10", () => {
    const cost10 = computeHarthmereRespecCostV1(10);
    const cost15 = computeHarthmereRespecCostV1(15);
    assert.strictEqual(cost10, cost15, "cost should plateau after 10 respecs");
  });

  it("fails respec when a critical ability is on cooldown", () => {
    const now = Date.now();
    const actor = makeActor({ cooldowns: { slash: now + 10_000 } });
    const cost = computeHarthmereRespecCostV1(0);
    const ctx = makeCtx({ actor, respecCount: 0, actorGold: cost * 10 });
    const req = makeReq({ kind: "respec", nowMs: now });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("cooldown") || e.includes("respec")));
  });

  it("enforces respec cooldown after a recent respec", () => {
    const now = Date.now();
    const cost = computeHarthmereRespecCostV1(1);
    const ctx = makeCtx({
      respecCount: 1,
      lastRespecAtMs: now - 1000, // 1 second ago — still in cooldown
      actorGold: cost * 10,
    });
    const req = makeReq({ kind: "respec", nowMs: now });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("cooldown") || e.includes("respec")));
  });
});

// ---------------------------------------------------------------------------
// Talent purchase
// ---------------------------------------------------------------------------

describe("Talent purchase", () => {
  it("succeeds when prerequisites met and points available", () => {
    const actor = makeActor({ activeTalentNodes: [] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 5 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.newTalentNodes.includes("power_strike_1"));
  });

  it("fails when insufficient talent points", () => {
    const actor = makeActor({ activeTalentNodes: [] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 0 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("talent_points")));
  });

  it("fails buying already-purchased talent node", () => {
    const actor = makeActor({ activeTalentNodes: ["power_strike_1"] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 5 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("already_purchased")));
  });
});

// ---------------------------------------------------------------------------
// Loadout change
// ---------------------------------------------------------------------------

describe("Loadout change", () => {
  it("succeeds with known abilities", () => {
    const actor = makeActor({ knownAbilities: ["slash", "charge", "holy_shield"], equippedAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout: ["slash", "charge"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.deepStrictEqual(result.newEquippedAbilities, ["slash", "charge"]);
  });

  it("fails if loadout includes unknown ability", () => {
    const actor = makeActor({ knownAbilities: ["slash"] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout: ["slash", "fireball"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("not_known")));
  });

  it("fails if loadout duplicates the same ability", () => {
    const actor = makeActor({ knownAbilities: ["slash", "charge"], equippedAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout: ["slash", "slash"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("duplicate_ability_in_loadout:slash"));
  });

  it("fails if loadout exceeds eight slots", () => {
    const newLoadout = Array.from({ length: 9 }, (_unused, index) => `ability_${index}`);
    const actor = makeActor({ knownAbilities: newLoadout, equippedAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("loadout_slot_limit_exceeded"));
  });

  it("fails if loadout includes an ability missing from the server catalogue", () => {
    const actor = makeActor({ knownAbilities: ["ghost_ability"], equippedAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout: ["ghost_ability"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("loadout_ability_unknown:ghost_ability"));
  });

  it("validates specialization requirements during loadout changes", () => {
    const actor = makeActor({
      specializationId: "arms",
      knownAbilities: ["guardian_wall"],
      equippedAbilities: [],
    });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout: ["guardian_wall"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("loadout_ability_spec_mismatch:guardian_wall"));
  });

  it("validates weapon requirements during loadout changes", () => {
    const actor = makeActor({
      mainHandWeaponType: "sword",
      knownAbilities: ["axe_chop"],
      equippedAbilities: [],
    });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newLoadout: ["axe_chop"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("loadout_ability_weapon_requirement:axe_chop"));
  });
});

// ---------------------------------------------------------------------------
// XP reward
// ---------------------------------------------------------------------------

describe("computeHarthmereXpRewardV1", () => {
  it("returns zero for grey content (target much lower level)", () => {
    const { xpReward } = computeHarthmereXpRewardV1({ actorLevel: 30, targetLevel: 5, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 0 });
    assert.strictEqual(xpReward, 0, "grey content should give no XP");
  });

  it("returns full XP for even-level target", () => {
    const { xpReward } = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 0 });
    assert.ok(xpReward > 0);
  });

  it("grants bonus XP for higher-level target", () => {
    const { xpReward: even } = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 0 });
    const { xpReward: hard } = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 15, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 0 });
    assert.ok(hard > even, `hard (${hard}) should exceed even (${even})`);
  });

  it("applies rested XP bonus additively", () => {
    const { xpReward: base } = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 0 });
    const { xpReward: rested } = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 50 });
    assert.ok(rested > base);
  });

  it("returns integer XP (no fractional values)", () => {
    const { xpReward } = computeHarthmereXpRewardV1({ actorLevel: 7, targetLevel: 8, baseXp: 77, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 33 });
    assert.strictEqual(xpReward, Math.floor(xpReward), "XP must be an integer");
  });

  it("returns restedXpConsumed capped at xpReward", () => {
    const { xpReward, restedXpConsumed } = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, contributionScore: 1, antiFarmMultiplier: 1, restedXpPool: 9999 });
    assert.ok(restedXpConsumed <= xpReward);
  });
});

// ---------------------------------------------------------------------------
// PvP legality
// ---------------------------------------------------------------------------

describe("isHarthmerePvPLegalV1", () => {
  it("returns legal=true in open_pvp zone against NPC", () => {
    const actor = makeActor();
    const target = makeTarget({ isPlayer: false });
    const zone = makeZone({ pvpRule: "open_pvp", isSafeZone: false });
    const result = isHarthmerePvPLegalV1(actor, target, zone);
    assert.ok(result.legal);
  });

  it("returns legal=false in safe_zone for player target", () => {
    const actor = makeActor();
    const target = makeTarget({ isPlayer: true });
    const zone = makeZone({ pvpRule: "safe_zone", isSafeZone: true });
    const result = isHarthmerePvPLegalV1(actor, target, zone);
    assert.ok(!result.legal);
  });

  it("returns legal=false when the target is standing in a safe zone", () => {
    const actor = makeActor({ pvpFlagged: true });
    const target = makeTarget({ isPlayer: true, pvpFlagged: true, zonePvPRule: "safe_zone" });
    const zone = makeZone({ pvpRule: "open_pvp", isSafeZone: false });
    const result = isHarthmerePvPLegalV1(actor, target, zone);
    assert.ok(!result.legal);
    assert.equal(result.reason, "target_safe_zone");
  });

  it("returns legal=true in open_pvp zone for player target", () => {
    const actor = makeActor({ pvpFlagged: true });
    const target = makeTarget({ isPlayer: true, pvpFlagged: true });
    const zone = makeZone({ pvpRule: "open_pvp", isSafeZone: false });
    const result = isHarthmerePvPLegalV1(actor, target, zone);
    assert.ok(result.legal);
  });

  it("returns legal=false when neither player is flagged in contested zone", () => {
    const actor = makeActor({ pvpFlagged: false });
    const target = makeTarget({ isPlayer: true, pvpFlagged: false });
    const zone = makeZone({ pvpRule: "contested", isSafeZone: false });
    const result = isHarthmerePvPLegalV1(actor, target, zone);
    assert.ok(!result.legal);
    assert.ok(result.reason.length > 0);
  });
});
