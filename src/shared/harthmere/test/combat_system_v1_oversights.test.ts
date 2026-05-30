import assert from "assert";
import {
  resolveHarthmereCombatAction,
  respawnHarthmereCombatant,
  validateHarthmereCombatRequest,
  validateHarthmereRespawnPoint,
  type HarthmereCombatAbilityV1,
  type HarthmereCombatRequestV1,
  type HarthmereCombatStatsV1,
  type HarthmereRespawnPointV1,
} from "../combat_system_v1";

const NOW = 1_700_000_000_000;

function combatant(overrides: Partial<HarthmereCombatStatsV1> = {}): HarthmereCombatStatsV1 {
  return {
    id: "actor",
    name: "Actor",
    entityKind: "player",
    level: 10,
    faction: "player",
    pvpFlag: "voluntary_pvp_flagged",
    hp: 100,
    maxHp: 100,
    attackPoints: 200,
    defense: 0,
    armor: 0,
    magicResistance: 0,
    accuracy: 90,
    evasion: 0,
    criticalChance: 0,
    criticalDamage: 1.5,
    attackSpeed: 1,
    attackRange: 2.2,
    movementSpeed: 4,
    aggroRange: 0,
    leashRange: 0,
    threatValue: 0,
    combatState: "idle",
    attackable: true,
    position: { x: 0, y: 0, z: 0 },
    ...overrides,
  };
}

function lethalStrike(overrides: Partial<HarthmereCombatAbilityV1> = {}): HarthmereCombatAbilityV1 {
  return {
    id: "lethal_strike",
    name: "Lethal Strike",
    type: "melee",
    damageType: "true",
    abilityMultiplier: 1,
    range: 3,
    cooldownSeconds: 1,
    requiresLineOfSight: true,
    requiresFacing: true,
    canCrit: false,
    canBeBlocked: false,
    canBeParried: false,
    canBeDodged: false,
    canBeResisted: false,
    canBeAbsorbed: false,
    varianceMin: 1,
    varianceMax: 1,
    threatMultiplier: 1,
    ...overrides,
  };
}

function request(overrides: Partial<HarthmereCombatRequestV1> = {}): HarthmereCombatRequestV1 {
  const attacker = combatant({ id: "attacker", name: "Attacker" });
  const target = combatant({ id: "victim", name: "Victim", hp: 75, maxHp: 100 });
  return {
    requestId: "req_1",
    idempotencyKey: "idem_1",
    serverNowMs: NOW,
    attacker,
    target,
    ability: lethalStrike(),
    distanceMeters: 2,
    relationship: "hostile",
    source: "server",
    zoneId: "wilds",
    pvpZone: false,
    lineOfSight: true,
    facingOk: true,
    cooldownReady: true,
    ...overrides,
  };
}

function respawnPoint(overrides: Partial<HarthmereRespawnPointV1> = {}): HarthmereRespawnPointV1 {
  return {
    id: "temple_green",
    label: "Temple Green",
    zoneId: "town",
    faction: "harthmere",
    position: { x: 10, y: 70, z: 10 },
    safe: true,
    validGround: true,
    insideWall: false,
    insideHazard: false,
    insideEnemyAoe: false,
    playerOverlap: false,
    connectedToNavigation: true,
    unlocked: true,
    protectionSeconds: 25,
    hpPercent: 0.5,
    resourcePercent: 0.5,
    ...overrides,
  };
}

describe("combat_system_v1 rule oversight fixes", () => {
  it("keeps the base PvE attack path working", () => {
    const result = resolveHarthmereCombatAction(
      request({
        attacker: combatant({ id: "hero", entityKind: "player", faction: "player", pvpFlag: "unflagged" }),
        target: combatant({ id: "bandit", entityKind: "npc", faction: "bandit", hp: 75 }),
      }),
      () => 0.5
    );

    assert.equal(result.ok, true);
    assert.equal(result.damage.finalDamage > 0, true);
  });

  it("blocks attacks from safe zones into combat zones, including duel attempts", () => {
    const fromSafeZone = validateHarthmereCombatRequest(
      request({
        attacker: combatant({ safeZone: true }),
        target: combatant({ safeZone: false }),
      })
    );
    assert.equal(fromSafeZone.ok, false);
    assert.ok(fromSafeZone.reasons.includes("safe_zone_blocks_hostile_action"));
    assert.ok(fromSafeZone.reasons.includes("attacker_safe_zone_blocks_hostile_action"));

    const safeZoneDuel = validateHarthmereCombatRequest(
      request({
        attacker: combatant({ safeZone: true }),
        target: combatant({ safeZone: true }),
        relationship: "duel_opponent",
        safeZone: true,
      })
    );
    assert.equal(safeZoneDuel.ok, false);
    assert.ok(safeZoneDuel.reasons.includes("safe_zone_blocks_hostile_action"));
  });

  it("blocks spawn-protected PvP targets even when their PvP flag is present", () => {
    const result = validateHarthmereCombatRequest(
      request({
        target: combatant({
          pvpFlag: "spawn_protected",
          spawnProtectedUntilMs: NOW + 30_000,
        }),
        pvpZone: true,
      })
    );

    assert.equal(result.ok, false);
    assert.ok(result.reasons.includes("pvp_spawn_protected_flag"));
    assert.ok(result.reasons.includes("target_spawn_protected"));
  });

  it("treats normal PvP deaths as downed with no loot eligibility", () => {
    const result = resolveHarthmereCombatAction(
      request({
        pvpZone: true,
        relationship: "arena_opponent",
        target: combatant({ id: "victim", hp: 40, pvpFlag: "arena_flagged" }),
        attacker: combatant({ id: "attacker", pvpFlag: "arena_flagged" }),
      }),
      () => 0.5
    );

    assert.equal(result.ok, true);
    assert.equal(result.target.combatState, "downed");
    assert.equal(result.rewards.lootEligible, false);
    assert.equal(result.rewards.inventoryDropPolicy, "none");
    assert.ok(result.death?.penalties.includes("normal_pvp_death_no_inventory_destroy"));
  });

  it("marks hardcore PvP deaths as loot-policy eligible while preserving protected item rules", () => {
    const result = resolveHarthmereCombatAction(
      request({
        pvpZone: true,
        hardcoreZone: true,
        relationship: "war_target",
        target: combatant({ id: "victim", hp: 40, pvpFlag: "hardcore_pvp_flagged" }),
        attacker: combatant({ id: "attacker", pvpFlag: "hardcore_pvp_flagged" }),
      }),
      () => 0.5
    );

    assert.equal(result.ok, true);
    assert.equal(result.target.combatState, "dead");
    assert.equal(result.rewards.lootEligible, true);
    assert.equal(result.rewards.inventoryDropPolicy, "drop_only_unbound_trade_goods_and_gathered_resources");
    assert.ok(result.death?.penalties.includes("bound_quest_spellbook_mount_pet_cosmetic_keyring_protected"));
  });

  it("ends duels at 1 HP without death, loot, or PvP rewards", () => {
    const result = resolveHarthmereCombatAction(
      request({
        relationship: "duel_opponent",
        pvpZone: false,
        target: combatant({ id: "duelist_b", hp: 20, pvpFlag: "duel_flagged" }),
        attacker: combatant({ id: "duelist_a", pvpFlag: "duel_flagged" }),
      }),
      () => 0.5
    );

    assert.equal(result.ok, true);
    assert.equal(result.target.hp, 1);
    assert.equal(result.death, undefined);
    assert.equal(result.rewards.lootEligible, false);
    assert.equal(result.rewards.pvpRewardEligible, false);
    assert.ok(result.auditLog.includes("duel_nonlethal_finish_at_1hp"));
  });

  it("validates respawn safety and clamps valid recovery values", () => {
    const invalid = validateHarthmereRespawnPoint(
      respawnPoint({
        protectionSeconds: 0,
        hpPercent: 1.5,
        resourcePercent: -0.25,
        insideEnemyAoe: true,
      })
    );
    assert.equal(invalid.ok, false);
    assert.ok(invalid.reasons.includes("respawn_invalid_protection_seconds"));
    assert.ok(invalid.reasons.includes("respawn_invalid_hp_percent"));
    assert.ok(invalid.reasons.includes("respawn_invalid_resource_percent"));
    assert.ok(invalid.reasons.includes("respawn_inside_enemy_aoe"));

    const alive = respawnHarthmereCombatant({
      combatant: combatant({ combatState: "idle" }),
      point: respawnPoint(),
      nowMs: NOW,
    });
    assert.equal(alive.ok, false);
    assert.ok(alive.reasons.includes("combatant_not_dead_or_respawning"));

    const valid = respawnHarthmereCombatant({
      combatant: combatant({
        combatState: "dead",
        hp: 0,
        maxHp: 100,
        resources: { mana: 40 },
      }),
      point: respawnPoint({ hpPercent: 1, resourcePercent: 0.75 }),
      nowMs: NOW,
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.combatant.hp, 100);
    assert.equal(valid.combatant.resources?.mana, 30);
    assert.equal(valid.combatant.spawnProtectedUntilMs, NOW + 25_000);
  });
});
