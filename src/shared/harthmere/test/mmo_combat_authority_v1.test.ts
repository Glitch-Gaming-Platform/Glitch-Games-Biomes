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
    ...overrides,
  };
}

function makeClass(overrides: Partial<HarthmereClassDefinitionV1> = {}): HarthmereClassDefinitionV1 {
  return {
    classId: "warrior",
    displayName: "Warrior",
    baseHp: 100,
    baseMana: 50,
    attackPowerPerLevel: 3,
    spellPowerPerLevel: 0.5,
    allowedWeaponTypes: ["sword", "axe", "mace"],
    talentTree: [
      { nodeId: "power_strike_1", displayName: "Power Strike I", prerequisiteNodeIds: [], talentPointCost: 1 },
      { nodeId: "power_strike_2", displayName: "Power Strike II", prerequisiteNodeIds: ["power_strike_1"], talentPointCost: 2 },
    ],
    ...overrides,
  };
}

function makeActor(overrides: Partial<HarthmereCombatActorSnapshotV1> = {}): HarthmereCombatActorSnapshotV1 {
  return {
    actorId: "player_1",
    classId: "warrior",
    specId: "arms",
    level: 10,
    currentHp: 100,
    maxHp: 100,
    currentResource: 50,
    maxResource: 50,
    resourceKind: "mana",
    equippedAbilities: ["slash"],
    knownAbilities: ["slash", "charge"],
    equippedWeaponType: "sword",
    cooldowns: {},
    talentNodes: [],
    isAlive: true,
    position: { x: 0, y: 0, z: 0 },
    pvpFlagged: false,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<HarthmereCombatTargetSnapshotV1> = {}): HarthmereCombatTargetSnapshotV1 {
  return {
    targetId: "enemy_1",
    isAlive: true,
    currentHp: 80,
    maxHp: 80,
    isHostile: true,
    isBoss: false,
    level: 9,
    pvpFlagged: false,
    position: { x: 3, y: 0, z: 0 },
    ...overrides,
  };
}

function makeZone(overrides: Partial<HarthmereZoneSnapshotV1> = {}): HarthmereZoneSnapshotV1 {
  return {
    zoneId: "town_square",
    pvpRule: "open_pvp",
    isSafeZone: false,
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
    allowedWeaponTypes: ["staff", "wand"],
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
    assert.ok(result.computedDamage !== undefined && result.computedDamage > 0);
  });

  it("attack kind also routes through ability validation", () => {
    const ctx = makeCtx();
    const req = makeReq({ kind: "attack", abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
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
    const actor = makeActor({ classId: "warrior", knownAbilities: ["fireball"], equippedAbilities: ["fireball"], equippedWeaponType: "staff" });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("class")));
  });

  it("fails below level requirement", () => {
    const actor = makeActor({ classId: "mage", level: 3, knownAbilities: ["fireball"], equippedAbilities: ["fireball"], equippedWeaponType: "staff" });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("level")));
  });

  it("fails with wrong weapon type", () => {
    const actor = makeActor({ equippedWeaponType: "axe", knownAbilities: ["fireball"], equippedAbilities: ["fireball"], classId: "mage", level: 10 });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "fireball" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("weapon")));
  });

  it("fails when actor is dead", () => {
    const actor = makeActor({ isAlive: false });
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
});

// ---------------------------------------------------------------------------
// Resource and cooldown
// ---------------------------------------------------------------------------

describe("Ability cast — resource and cooldown", () => {
  it("fails when insufficient resource", () => {
    const actor = makeActor({ currentResource: 0 });
    const ctx = makeCtx({ actor });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("resource") || e.includes("mana")));
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
    const zone = makeZone({ isSafeZone: true, pvpRule: "safe_zone" });
    const ctx = makeCtx({ zone });
    const req = makeReq({ abilityId: "slash" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("safe_zone")));
  });

  it("allows safe-zone-permitted ability in safe zone", () => {
    const zone = makeZone({ isSafeZone: true, pvpRule: "safe_zone" });
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
    assert.ok(result.respecCost !== undefined && result.respecCost > 0);
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
    const actor = makeActor({ talentNodes: [] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 5 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });

  it("fails when prerequisites not met", () => {
    const actor = makeActor({ talentNodes: [] }); // power_strike_1 not purchased
    const ctx = makeCtx({ actor, talentPointsAvailable: 5 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_2" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("prerequisite")));
  });

  it("fails when insufficient talent points", () => {
    const actor = makeActor({ talentNodes: [] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 0 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("talent_points")));
  });

  it("fails buying already-purchased talent node", () => {
    const actor = makeActor({ talentNodes: ["power_strike_1"] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 5 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_1" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("already_purchased")));
  });

  it("succeeds purchasing tier-2 after tier-1 acquired", () => {
    const actor = makeActor({ talentNodes: ["power_strike_1"] });
    const ctx = makeCtx({ actor, talentPointsAvailable: 5 });
    const req = makeReq({ kind: "talent_purchase", talentNodeId: "power_strike_2" });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });
});

// ---------------------------------------------------------------------------
// Loadout change
// ---------------------------------------------------------------------------

describe("Loadout change", () => {
  it("succeeds with known abilities", () => {
    const actor = makeActor({ knownAbilities: ["slash", "charge", "holy_shield"], equippedAbilities: [] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newEquippedAbilities: ["slash", "charge"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });

  it("fails if loadout includes unknown ability", () => {
    const actor = makeActor({ knownAbilities: ["slash"] });
    const ctx = makeCtx({ actor });
    const req = makeReq({ kind: "loadout_change", newEquippedAbilities: ["slash", "fireball"] });
    const result = reduceHarthmereCombatActionV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("not_known")));
  });
});

// ---------------------------------------------------------------------------
// XP reward
// ---------------------------------------------------------------------------

describe("computeHarthmereXpRewardV1", () => {
  it("returns zero for grey content (target much lower level)", () => {
    const xp = computeHarthmereXpRewardV1({ actorLevel: 30, targetLevel: 5, baseXp: 100, restedXpBonus: 0 });
    assert.strictEqual(xp, 0, "grey content should give no XP");
  });

  it("returns full XP for even-level target", () => {
    const xp = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, restedXpBonus: 0 });
    assert.ok(xp > 0);
  });

  it("grants bonus XP for higher-level target", () => {
    const even = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, restedXpBonus: 0 });
    const hard = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 15, baseXp: 100, restedXpBonus: 0 });
    assert.ok(hard > even, `hard (${hard}) should exceed even (${even})`);
  });

  it("applies rested XP bonus additively", () => {
    const base = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, restedXpBonus: 0 });
    const rested = computeHarthmereXpRewardV1({ actorLevel: 10, targetLevel: 10, baseXp: 100, restedXpBonus: 50 });
    assert.ok(rested > base);
  });

  it("returns integer XP (no fractional values)", () => {
    const xp = computeHarthmereXpRewardV1({ actorLevel: 7, targetLevel: 8, baseXp: 77, restedXpBonus: 33 });
    assert.strictEqual(xp, Math.floor(xp), "XP must be an integer");
  });
});

// ---------------------------------------------------------------------------
// PvP legality
// ---------------------------------------------------------------------------

describe("isHarthmerePvPLegalV1", () => {
  it("returns true in open_pvp zone between pvp-flagged players", () => {
    const result = isHarthmerePvPLegalV1({ pvpRule: "open_pvp", isSafeZone: false } as any, true, true);
    assert.ok(result);
  });

  it("returns false in safe_zone", () => {
    const result = isHarthmerePvPLegalV1({ pvpRule: "safe_zone", isSafeZone: true } as any, true, true);
    assert.ok(!result);
  });

  it("returns false when attacker is not pvp-flagged in contested zone", () => {
    const result = isHarthmerePvPLegalV1({ pvpRule: "contested", isSafeZone: false } as any, false, true);
    assert.ok(!result);
  });
});
