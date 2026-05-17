// Harthmere combat system v1
// Pure, server-authoritative rules engine for TDD coverage.
// The client can request intent and show animation; this module decides legality,
// hit result, damage, death state, contribution, and reward eligibility.

export const HARTHMERE_COMBAT_SYSTEM_VERSION_V1 = "harthmere-combat-system-core-v1";

export const HARTHMERE_COMBAT_PIPELINE_V1 = [
  "server_request_normalized",
  "attacker_can_act",
  "target_exists_and_alive",
  "target_attackable",
  "relationship_and_pvp_legality",
  "safe_zone_and_spawn_protection",
  "cooldown_and_resource_check",
  "range_check",
  "line_of_sight_check",
  "facing_check",
  "hit_roll",
  "avoid_block_parry_resist_absorb_roll",
  "damage_calculation",
  "damage_application",
  "secondary_effects",
  "threat_and_contribution_update",
  "death_or_downed_state",
  "xp_loot_quest_reputation_legal_reward_rules",
  "combat_log_and_audit_record",
] as const;

export const HARTHMERE_REQUIRED_COMBAT_FEEDBACK_V1 = [
  "miss",
  "dodge",
  "block",
  "parry",
  "resist",
  "absorb",
  "immune",
  "evade",
  "critical_hit",
  "normal_hit",
  "death",
  "interrupted",
  "out_of_range",
  "no_line_of_sight",
  "invalid_target",
] as const;

export type HarthmereDamageType =
  | "physical"
  | "slashing"
  | "piercing"
  | "blunt"
  | "fire"
  | "ice"
  | "lightning"
  | "poison"
  | "bleed"
  | "holy"
  | "dark"
  | "arcane"
  | "true"
  | "siege"
  | "environmental";

export type HarthmereHitResult =
  | "miss"
  | "dodge"
  | "parry"
  | "block"
  | "resist"
  | "absorb"
  | "normal_hit"
  | "critical_hit"
  | "glancing_hit"
  | "crushing_hit"
  | "immune"
  | "evade"
  | "dead"
  | "invalid_target"
  | "out_of_range"
  | "no_line_of_sight"
  | "interrupted";

export type HarthmereCombatStateName =
  | "idle"
  | "in_combat"
  | "casting"
  | "stunned"
  | "frozen"
  | "asleep"
  | "feared"
  | "silenced"
  | "disarmed"
  | "evading"
  | "downed"
  | "dead"
  | "reviving"
  | "respawning"
  | "ghost"
  | "protected_after_respawn"
  | "captured"
  | "unconscious"
  | "permadead";

export type HarthmereFaction =
  | "player"
  | "harthmere"
  | "guard"
  | "merchant"
  | "civilian"
  | "wildlife"
  | "bandit"
  | "undead"
  | "training"
  | "boss"
  | "summon"
  | "pet";

export type HarthmereCombatRelationship =
  | "friendly"
  | "neutral"
  | "hostile"
  | "duel_opponent"
  | "party_member"
  | "raid_member"
  | "guild_member"
  | "faction_ally"
  | "faction_enemy"
  | "criminal_target"
  | "bounty_target"
  | "arena_opponent"
  | "battleground_opponent"
  | "war_target"
  | "protected_player"
  | "safe_zone_player";

export type HarthmerePvpFlag =
  | "unflagged"
  | "duel_flagged"
  | "voluntary_pvp_flagged"
  | "faction_war_flagged"
  | "guild_war_flagged"
  | "arena_flagged"
  | "battleground_flagged"
  | "criminal_flagged"
  | "bounty_target"
  | "hardcore_pvp_flagged"
  | "spawn_protected";

export type HarthmereCrowdControlCategory =
  | "hard_control"
  | "movement_control"
  | "caster_control"
  | "displacement"
  | "forced_targeting";

export type HarthmereCombatRole = "tank" | "healer" | "damage" | "support" | "controller" | "summoner" | "scout";

export interface HarthmereVec3 {
  x: number;
  y: number;
  z: number;
}

export interface HarthmereCombatStatsV1 {
  id: string;
  name: string;
  entityKind: "player" | "npc" | "boss" | "pet" | "summon" | "mount" | "training_dummy";
  level: number;
  rank?: "critter" | "civilian" | "normal" | "strong" | "elite" | "mini_boss" | "dungeon_boss" | "world_boss" | "legendary_boss";
  faction: HarthmereFaction;
  relationship?: HarthmereCombatRelationship;
  pvpFlag?: HarthmerePvpFlag;
  role?: HarthmereCombatRole;
  hp: number;
  maxHp: number;
  attackPoints: number;
  defense: number;
  armor: number;
  magicResistance: number;
  accuracy: number;
  evasion: number;
  criticalChance: number;
  criticalDamage: number;
  attackSpeed: number;
  attackRange: number;
  movementSpeed: number;
  aggroRange: number;
  leashRange: number;
  threatValue: number;
  combatState: HarthmereCombatStateName;
  attackable: boolean;
  safeZone?: boolean;
  spawnProtectedUntilMs?: number;
  aggressionUntilMs?: number;
  position: HarthmereVec3;
  homePosition?: HarthmereVec3;
  resources?: Record<string, number>;
  activeAbsorbs?: Array<{ id: string; amount: number; damageTypes?: HarthmereDamageType[] }>;
  immunities?: HarthmereDamageType[];
  resistances?: Partial<Record<HarthmereDamageType, number>>;
  tags?: string[];
}

export interface HarthmereCombatAbilityV1 {
  id: string;
  name: string;
  type: "melee" | "ranged" | "spell" | "heal" | "shield" | "buff" | "debuff" | "aoe" | "cone_aoe" | "taunt" | "revive";
  damageType: HarthmereDamageType;
  abilityMultiplier: number;
  range: number;
  cooldownSeconds: number;
  resourceCost?: { resource: string; amount: number };
  castTimeSeconds?: number;
  requiresLineOfSight: boolean;
  requiresFacing?: boolean;
  canCrit: boolean;
  canBeBlocked: boolean;
  canBeParried: boolean;
  canBeDodged: boolean;
  canBeResisted: boolean;
  canBeAbsorbed: boolean;
  varianceMin: number;
  varianceMax: number;
  threatMultiplier: number;
  targetCap?: number;
  coneAngle?: number;
  telegraphSeconds?: number;
  crowdControl?: { category: HarthmereCrowdControlCategory; durationSeconds: number };
  statusEffects?: HarthmereStatusEffectV1[];
}

export interface HarthmereStatusEffectV1 {
  id: string;
  label: string;
  category: "burning" | "bleeding" | "poisoned" | "stunned" | "slowed" | "rooted" | "silenced" | "feared" | "shielded" | "buff" | "debuff";
  durationMs: number;
  maxStacks: number;
  tickDamage?: number;
  damageType?: HarthmereDamageType;
  ccCategory?: HarthmereCrowdControlCategory;
}

export interface HarthmereCombatRequestV1 {
  requestId: string;
  idempotencyKey: string;
  serverNowMs: number;
  attacker: HarthmereCombatStatsV1;
  target: HarthmereCombatStatsV1;
  ability: HarthmereCombatAbilityV1;
  distanceMeters: number;
  relationship: HarthmereCombatRelationship;
  source: "server" | "client_intent";
  partyId?: string;
  raidId?: string;
  zoneId: string;
  safeZone?: boolean;
  pvpZone?: boolean;
  hardcoreZone?: boolean;
  lineOfSight?: boolean;
  facingOk?: boolean;
  cooldownReady?: boolean;
  duplicateRequest?: boolean;
  attackerContributedAtMs?: number;
  clientSupplied?: Record<string, unknown>;
  repeatedKillCount?: number;
}

export interface HarthmereValidationResultV1 {
  ok: boolean;
  result?: HarthmereHitResult;
  reasons: string[];
  rejectedClientFields: string[];
  audit: string[];
}

export interface HarthmereDamageResultV1 {
  baseDamage: number;
  rawDamage: number;
  reduction: number;
  absorbDamage: number;
  mitigatedDamage: number;
  finalDamage: number;
}

export interface HarthmereContributionV1 {
  playerId: string;
  damage: number;
  healing: number;
  shielding: number;
  objectives: number;
  revives: number;
  crowdControl: number;
  interrupts: number;
  tanking: number;
  support: number;
  firstContributedAtMs: number;
  lastContributedAtMs: number;
  inRange: boolean;
  active: boolean;
}

export interface HarthmereThreatEntryV1 {
  targetId: string;
  threat: number;
  lastThreatAtMs: number;
  source: "damage" | "healing" | "shielding" | "taunt" | "objective";
}

export interface HarthmereDeathRecordV1 {
  entityId: string;
  state: HarthmereCombatStateName;
  downedUntilMs?: number;
  deathTimeMs?: number;
  killerId?: string;
  cause: string;
  deathMessage: string;
  eligibleForRevive: boolean;
  eligibleForRespawn: boolean;
  penalties: string[];
  creditPlayerIds: string[];
}

export interface HarthmereRespawnPointV1 {
  id: string;
  label: string;
  position: HarthmereVec3;
  faction?: HarthmereFaction;
  zoneId: string;
  safe: boolean;
  validGround: boolean;
  insideWall: boolean;
  insideHazard: boolean;
  insideEnemyAoe: boolean;
  playerOverlap: boolean;
  connectedToNavigation: boolean;
  unlocked: boolean;
  protectionSeconds: number;
  hpPercent: number;
  resourcePercent: number;
}

export interface HarthmereCombatResolutionV1 {
  ok: boolean;
  result: HarthmereHitResult;
  attacker: HarthmereCombatStatsV1;
  target: HarthmereCombatStatsV1;
  damage: HarthmereDamageResultV1;
  death?: HarthmereDeathRecordV1;
  contribution: HarthmereContributionV1;
  threat: HarthmereThreatEntryV1;
  rewards: HarthmereRewardDecisionV1;
  auditLog: string[];
  feedback: string;
}

export interface HarthmereRewardDecisionV1 {
  xpEligible: boolean;
  lootEligible: boolean;
  questCreditEligible: boolean;
  reputationDelta: number;
  legalDelta: number;
  pvpRewardEligible: boolean;
  suppressionReasons: string[];
}

export const HARTHMERE_DEFAULT_ABILITIES_V1: Record<string, HarthmereCombatAbilityV1> = {
  basic_strike: {
    id: "basic_strike",
    name: "Basic Strike",
    type: "melee",
    damageType: "slashing",
    abilityMultiplier: 1,
    range: 2.2,
    cooldownSeconds: 1.4,
    requiresLineOfSight: true,
    requiresFacing: true,
    canCrit: true,
    canBeBlocked: true,
    canBeParried: true,
    canBeDodged: true,
    canBeResisted: false,
    canBeAbsorbed: true,
    varianceMin: 0.9,
    varianceMax: 1.1,
    threatMultiplier: 1,
  },
  heavy_strike: {
    id: "heavy_strike",
    name: "Heavy Strike",
    type: "melee",
    damageType: "blunt",
    abilityMultiplier: 1.45,
    range: 2.4,
    cooldownSeconds: 2.8,
    requiresLineOfSight: true,
    requiresFacing: true,
    canCrit: true,
    canBeBlocked: true,
    canBeParried: true,
    canBeDodged: true,
    canBeResisted: false,
    canBeAbsorbed: true,
    varianceMin: 0.85,
    varianceMax: 1.2,
    threatMultiplier: 1.4,
  },
  spark: {
    id: "spark",
    name: "Spark",
    type: "spell",
    damageType: "arcane",
    abilityMultiplier: 0.82,
    range: 24,
    cooldownSeconds: 4,
    resourceCost: { resource: "mana", amount: 12 },
    requiresLineOfSight: true,
    requiresFacing: false,
    canCrit: true,
    canBeBlocked: false,
    canBeParried: false,
    canBeDodged: true,
    canBeResisted: true,
    canBeAbsorbed: true,
    varianceMin: 0.95,
    varianceMax: 1.05,
    threatMultiplier: 0.9,
  },
  guard_taunt: {
    id: "guard_taunt",
    name: "Taunt",
    type: "taunt",
    damageType: "true",
    abilityMultiplier: 0,
    range: 20,
    cooldownSeconds: 8,
    requiresLineOfSight: true,
    requiresFacing: false,
    canCrit: false,
    canBeBlocked: false,
    canBeParried: false,
    canBeDodged: false,
    canBeResisted: true,
    canBeAbsorbed: false,
    varianceMin: 1,
    varianceMax: 1,
    threatMultiplier: 5,
    crowdControl: { category: "forced_targeting", durationSeconds: 3 },
  },
  revive: {
    id: "revive",
    name: "Revive",
    type: "revive",
    damageType: "holy",
    abilityMultiplier: 0,
    range: 4,
    cooldownSeconds: 10,
    castTimeSeconds: 3,
    requiresLineOfSight: true,
    canCrit: false,
    canBeBlocked: false,
    canBeParried: false,
    canBeDodged: false,
    canBeResisted: false,
    canBeAbsorbed: false,
    varianceMin: 1,
    varianceMax: 1,
    threatMultiplier: 0,
  },
};

export function clampHarthmereCombatNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function distanceHarthmereCombatMeters(a: HarthmereVec3, b: HarthmereVec3) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function levelDamageModifier(attackerLevel: number, defenderLevel: number) {
  const diff = attackerLevel - defenderLevel;
  if (diff <= -10) return 0.25;
  if (diff <= -6) return 0.5;
  if (diff <= -3) return 0.75;
  if (diff >= 10) return 2;
  if (diff >= 6) return 1.5;
  if (diff >= 3) return 1.25;
  if (diff >= 1) return 1.1;
  return 1;
}

export function levelHitModifier(attackerLevel: number, defenderLevel: number) {
  const diff = attackerLevel - defenderLevel;
  if (diff <= -10) return -0.3;
  if (diff <= -6) return -0.2;
  if (diff <= -3) return -0.1;
  if (diff >= 6) return 0.15;
  if (diff >= 3) return 0.1;
  if (diff >= 1) return 0.05;
  return 0;
}

export function deriveHarthmereCombatStats(input: {
  id: string;
  name: string;
  level: number;
  entityKind: HarthmereCombatStatsV1["entityKind"];
  faction: HarthmereFaction;
  attributes?: Partial<Record<"strength" | "dexterity" | "intelligence" | "wisdom" | "constitution" | "charisma" | "perception" | "willpower" | "luck", number>>;
  gear?: { attack?: number; armor?: number; magicResistance?: number };
  rank?: HarthmereCombatStatsV1["rank"];
  position?: HarthmereVec3;
}): HarthmereCombatStatsV1 {
  const a = {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    wisdom: 10,
    constitution: 10,
    charisma: 10,
    perception: 10,
    willpower: 10,
    luck: 10,
    ...(input.attributes ?? {}),
  };
  const rankMultiplier = input.rank === "world_boss" ? 40 : input.rank === "dungeon_boss" ? 15 : input.rank === "mini_boss" ? 5 : input.rank === "elite" ? 2.5 : input.rank === "strong" ? 1.35 : input.rank === "civilian" ? 0.65 : input.rank === "critter" ? 0.25 : 1;
  const maxHp = Math.max(1, Math.round((100 + input.level * 20 + a.constitution * 10) * rankMultiplier));
  const attackPoints = Math.max(0, Math.round((10 + input.level * 4 + a.strength * 2 + (input.gear?.attack ?? 0)) * Math.max(0.4, Math.min(rankMultiplier, 8))));
  const armor = Math.round((input.gear?.armor ?? 0) + input.level * 3 + a.constitution * 1.25);
  const magicResistance = Math.round((input.gear?.magicResistance ?? 0) + input.level * 2 + a.wisdom * 1.5);
  return {
    id: input.id,
    name: input.name,
    entityKind: input.entityKind,
    level: input.level,
    rank: input.rank,
    faction: input.faction,
    hp: maxHp,
    maxHp,
    attackPoints,
    defense: Math.round(input.level * 5 + armor + a.constitution * 1.5),
    armor,
    magicResistance,
    accuracy: Math.round(70 + a.perception * 0.6 + a.dexterity * 0.3),
    evasion: Math.round(5 + a.dexterity * 0.35),
    criticalChance: clampHarthmereCombatNumber(0.05 + a.luck * 0.001 + a.dexterity * 0.0015, 0.01, 0.55),
    criticalDamage: 1.5,
    attackSpeed: 1,
    attackRange: 2.2,
    movementSpeed: 4.5,
    aggroRange: input.entityKind === "npc" ? 12 : input.entityKind === "boss" ? 30 : 0,
    leashRange: input.entityKind === "boss" ? 80 : input.entityKind === "npc" ? 45 : 0,
    threatValue: 0,
    combatState: "idle",
    attackable: true,
    position: input.position ?? { x: 0, y: 0, z: 0 },
  };
}

export function classifyHarthmereCombatRelationship(input: {
  attacker: HarthmereCombatStatsV1;
  target: HarthmereCombatStatsV1;
  sameParty?: boolean;
  sameRaid?: boolean;
  duelAccepted?: boolean;
  arenaOpponents?: boolean;
  battlegroundOpponents?: boolean;
  guildWar?: boolean;
  factionWar?: boolean;
  targetCriminal?: boolean;
  targetBounty?: boolean;
}): HarthmereCombatRelationship {
  if (input.sameParty) return "party_member";
  if (input.sameRaid) return "raid_member";
  if (input.duelAccepted) return "duel_opponent";
  if (input.arenaOpponents) return "arena_opponent";
  if (input.battlegroundOpponents) return "battleground_opponent";
  if (input.guildWar) return "war_target";
  if (input.factionWar) return "faction_enemy";
  if (input.targetCriminal) return "criminal_target";
  if (input.targetBounty) return "bounty_target";
  if (input.attacker.faction === input.target.faction) return "friendly";
  if (["bandit", "undead"].includes(input.target.faction) || ["bandit", "undead"].includes(input.attacker.faction)) return "hostile";
  return "neutral";
}

export function isHarthmerePvpAttackLegal(request: HarthmereCombatRequestV1) {
  const attackerIsPlayer = request.attacker.entityKind === "player";
  const targetIsPlayer = request.target.entityKind === "player";
  if (!attackerIsPlayer || !targetIsPlayer) {
    return { legal: true, reason: "not_player_vs_player" };
  }
  if (request.relationship === "duel_opponent" || request.relationship === "arena_opponent" || request.relationship === "battleground_opponent" || request.relationship === "war_target" || request.relationship === "faction_enemy" || request.relationship === "criminal_target" || request.relationship === "bounty_target") {
    return { legal: true, reason: request.relationship };
  }
  if (request.pvpZone && request.attacker.pvpFlag !== "unflagged" && request.target.pvpFlag !== "unflagged") {
    return { legal: true, reason: "mutual_pvp_flagged" };
  }
  return { legal: false, reason: "pvp_not_consented_or_flagged" };
}

export function validateHarthmereCombatRequest(request: HarthmereCombatRequestV1): HarthmereValidationResultV1 {
  const reasons: string[] = [];
  const audit: string[] = ["server_validates_combat_request"];
  const rejectedClientFields = Object.keys(request.clientSupplied ?? {}).filter((field) => [
    "hitResult",
    "finalDamage",
    "targetHpAfter",
    "targetHpBefore",
    "deathState",
    "xpGranted",
    "lootGranted",
    "questCredit",
    "pvpLegal",
    "lineOfSightAccepted",
    "distanceAccepted",
    "contributionCredit",
  ].includes(field));
  if (rejectedClientFields.length > 0) {
    reasons.push("client_supplied_authoritative_combat_fields_rejected");
  }
  if (request.duplicateRequest) reasons.push("duplicate_idempotency_key_rejected");
  const attackerBlockedStates: HarthmereCombatStateName[] = ["dead", "downed", "respawning", "ghost", "captured", "unconscious", "permadead", "stunned", "frozen", "asleep", "feared"];
  if (attackerBlockedStates.includes(request.attacker.combatState)) reasons.push(`attacker_cannot_act:${request.attacker.combatState}`);
  if (request.ability.type === "spell" && request.attacker.combatState === "silenced") reasons.push("attacker_silenced");
  if (request.ability.type === "melee" && request.attacker.combatState === "disarmed") reasons.push("attacker_disarmed");
  if (!request.target.attackable) reasons.push("target_not_attackable");
  if (request.target.hp <= 0 || request.target.combatState === "dead") reasons.push("target_already_dead");
  if (request.target.combatState === "evading") reasons.push("target_evading");
  const pvp = isHarthmerePvpAttackLegal(request);
  if (!pvp.legal) reasons.push(pvp.reason);
  if ((request.safeZone || request.target.safeZone) && request.relationship !== "duel_opponent") reasons.push("safe_zone_blocks_hostile_action");
  if ((request.target.spawnProtectedUntilMs ?? 0) > request.serverNowMs) reasons.push("target_spawn_protected");
  if ((request.attacker.spawnProtectedUntilMs ?? 0) > request.serverNowMs) reasons.push("attacker_spawn_protected_cannot_attack");
  if (request.cooldownReady === false) reasons.push("ability_on_cooldown");
  if (request.ability.resourceCost) {
    const current = request.attacker.resources?.[request.ability.resourceCost.resource] ?? 0;
    if (current < request.ability.resourceCost.amount) reasons.push("not_enough_resource");
  }
  const latencyTolerance = request.ability.type === "melee" ? 0.35 : 0.75;
  if (request.distanceMeters > request.ability.range + latencyTolerance) reasons.push("out_of_range");
  if (request.ability.requiresLineOfSight && request.lineOfSight === false) reasons.push("no_line_of_sight");
  if (request.ability.requiresFacing && request.facingOk === false) reasons.push("bad_facing");
  const hardResult = reasons.includes("out_of_range") ? "out_of_range" : reasons.includes("no_line_of_sight") ? "no_line_of_sight" : reasons.includes("target_already_dead") ? "dead" : reasons.length ? "invalid_target" : undefined;
  return { ok: reasons.length === 0, result: hardResult, reasons, rejectedClientFields, audit };
}

export function physicalDamageReduction(attacker: HarthmereCombatStatsV1, defender: HarthmereCombatStatsV1) {
  const defensiveValue = Math.max(defender.defense, defender.armor);
  return clampHarthmereCombatNumber(defensiveValue / (defensiveValue + attacker.level * 100), 0, 0.75);
}

export function magicalDamageReduction(attacker: HarthmereCombatStatsV1, defender: HarthmereCombatStatsV1, damageType: HarthmereDamageType) {
  const typedResistance = defender.resistances?.[damageType] ?? 0;
  const defensiveValue = defender.magicResistance + typedResistance;
  return clampHarthmereCombatNumber(defensiveValue / (defensiveValue + attacker.level * 100), 0, 0.75);
}

export function damageReductionForType(attacker: HarthmereCombatStatsV1, defender: HarthmereCombatStatsV1, damageType: HarthmereDamageType) {
  if (damageType === "true") return 0;
  if (["fire", "ice", "lightning", "poison", "holy", "dark", "arcane"].includes(damageType)) {
    return magicalDamageReduction(attacker, defender, damageType);
  }
  return physicalDamageReduction(attacker, defender);
}

export function resolveHarthmereHitResult(input: {
  attacker: HarthmereCombatStatsV1;
  defender: HarthmereCombatStatsV1;
  ability: HarthmereCombatAbilityV1;
  rng?: () => number;
}): HarthmereHitResult {
  const rng = input.rng ?? Math.random;
  const { attacker, defender, ability } = input;
  if (!defender.attackable) return "immune";
  if (defender.hp <= 0 || defender.combatState === "dead") return "dead";
  if (defender.combatState === "evading") return "evade";
  if (defender.immunities?.includes(ability.damageType)) return "immune";
  const hitChance = clampHarthmereCombatNumber(0.8 + attacker.accuracy / 100 - defender.evasion / 100 + levelHitModifier(attacker.level, defender.level), 0.05, 0.95);
  if (rng() > hitChance) return rng() < 0.5 ? "miss" : "dodge";
  if (ability.canBeParried && ["guard", "player"].includes(defender.faction) && rng() < 0.08) return "parry";
  if (ability.canBeBlocked && (defender.tags?.includes("shield") || defender.role === "tank" || defender.faction === "guard") && rng() < 0.12) return "block";
  if (ability.canBeResisted && rng() < clampHarthmereCombatNumber((defender.magicResistance - attacker.accuracy) / 1000, 0, 0.35)) return "resist";
  if (ability.canBeAbsorbed && (defender.activeAbsorbs ?? []).some((shield) => shield.amount > 0 && (!shield.damageTypes || shield.damageTypes.includes(ability.damageType)))) return "absorb";
  if (ability.canCrit && rng() < clampHarthmereCombatNumber(attacker.criticalChance, 0, 0.75)) return "critical_hit";
  if (attacker.level >= defender.level + 8 && rng() < 0.08) return "crushing_hit";
  if (defender.level >= attacker.level + 8 && rng() < 0.12) return "glancing_hit";
  return "normal_hit";
}

export function calculateHarthmereDamage(input: {
  attacker: HarthmereCombatStatsV1;
  defender: HarthmereCombatStatsV1;
  ability: HarthmereCombatAbilityV1;
  hitResult: HarthmereHitResult;
  rng?: () => number;
}): HarthmereDamageResultV1 {
  const zero: HarthmereDamageResultV1 = { baseDamage: 0, rawDamage: 0, reduction: 0, absorbDamage: 0, mitigatedDamage: 0, finalDamage: 0 };
  if (["miss", "dodge", "parry", "immune", "evade", "invalid_target", "out_of_range", "no_line_of_sight", "dead", "interrupted"].includes(input.hitResult)) return zero;
  const rng = input.rng ?? Math.random;
  const baseDamage = Math.max(0, input.attacker.attackPoints * input.ability.abilityMultiplier);
  const variance = input.ability.varianceMin + (input.ability.varianceMax - input.ability.varianceMin) * rng();
  const criticalModifier = input.hitResult === "critical_hit" ? input.attacker.criticalDamage : 1;
  const hitModifier = input.hitResult === "glancing_hit" ? 0.65 : input.hitResult === "crushing_hit" ? 1.45 : 1;
  const blockModifier = input.hitResult === "block" ? 0.55 : 1;
  const resistModifier = input.hitResult === "resist" ? 0.5 : 1;
  const rawDamage = baseDamage * variance * criticalModifier * hitModifier * blockModifier * resistModifier * levelDamageModifier(input.attacker.level, input.defender.level);
  const reduction = damageReductionForType(input.attacker, input.defender, input.ability.damageType);
  let mitigatedDamage = rawDamage * (1 - reduction);
  let absorbDamage = 0;
  if (input.hitResult === "absorb") {
    const shield = (input.defender.activeAbsorbs ?? []).find((candidate) => candidate.amount > 0 && (!candidate.damageTypes || candidate.damageTypes.includes(input.ability.damageType)));
    absorbDamage = Math.min(mitigatedDamage, shield?.amount ?? 0);
    mitigatedDamage = Math.max(0, mitigatedDamage - absorbDamage);
  }
  const finalDamage = mitigatedDamage <= 0 && absorbDamage > 0 ? 0 : Math.max(1, Math.round(mitigatedDamage));
  return { baseDamage: Math.round(baseDamage), rawDamage: Math.round(rawDamage), reduction, absorbDamage: Math.round(absorbDamage), mitigatedDamage: Math.round(rawDamage - finalDamage), finalDamage };
}

export function resolveHarthmereDeathState(input: {
  target: HarthmereCombatStatsV1;
  attacker: HarthmereCombatStatsV1;
  ability: HarthmereCombatAbilityV1;
  damage: number;
  nowMs: number;
  pvp?: boolean;
  bossEncounter?: boolean;
  hardcore?: boolean;
  creditPlayerIds?: string[];
}): HarthmereDeathRecordV1 | undefined {
  if (input.target.hp > 0) return undefined;
  const player = input.target.entityKind === "player";
  const downedMs = input.pvp ? 20_000 : input.bossEncounter ? 45_000 : 45_000;
  const state: HarthmereCombatStateName = player && !input.hardcore ? "downed" : "dead";
  const cause = `${input.attacker.name}:${input.ability.name}:${input.damage}`;
  const deathMessage = player ? `You were ${state === "downed" ? "downed" : "slain"} by ${input.attacker.name}.` : `${input.target.name} was defeated by ${input.attacker.name}.`;
  return {
    entityId: input.target.id,
    state,
    downedUntilMs: state === "downed" ? input.nowMs + downedMs : undefined,
    deathTimeMs: input.nowMs,
    killerId: input.attacker.id,
    cause,
    deathMessage,
    eligibleForRevive: state === "downed" || (!input.hardcore && player),
    eligibleForRespawn: player,
    penalties: player ? ["durability_loss", "temporary_recovery_sickness"] : ["corpse_timer", "respawn_timer"],
    creditPlayerIds: input.creditPlayerIds ?? [input.attacker.id],
  };
}

export function updateHarthmereThreat(input: { attacker: HarthmereCombatStatsV1; target: HarthmereCombatStatsV1; ability: HarthmereCombatAbilityV1; damage: number; healing?: number; shielding?: number; nowMs: number }): HarthmereThreatEntryV1 {
  const base = input.damage + (input.healing ?? 0) * 0.5 + (input.shielding ?? 0) * 0.35;
  const taunt = input.ability.type === "taunt" ? 500 : 0;
  return { targetId: input.attacker.id, threat: Math.round(base * input.ability.threatMultiplier + taunt), lastThreatAtMs: input.nowMs, source: input.ability.type === "taunt" ? "taunt" : input.damage > 0 ? "damage" : input.healing ? "healing" : "shielding" };
}

export function updateHarthmereContribution(input: { playerId: string; damage?: number; healing?: number; shielding?: number; objective?: number; revive?: boolean; crowdControl?: boolean; interrupt?: boolean; tanking?: number; support?: number; nowMs: number; inRange: boolean; active: boolean }): HarthmereContributionV1 {
  return {
    playerId: input.playerId,
    damage: Math.max(0, Math.round(input.damage ?? 0)),
    healing: Math.max(0, Math.round(input.healing ?? 0)),
    shielding: Math.max(0, Math.round(input.shielding ?? 0)),
    objectives: Math.max(0, Math.round(input.objective ?? 0)),
    revives: input.revive ? 1 : 0,
    crowdControl: input.crowdControl ? 1 : 0,
    interrupts: input.interrupt ? 1 : 0,
    tanking: Math.max(0, Math.round(input.tanking ?? 0)),
    support: Math.max(0, Math.round(input.support ?? 0)),
    firstContributedAtMs: input.nowMs,
    lastContributedAtMs: input.nowMs,
    inRange: input.inRange,
    active: input.active,
  };
}

export function calculateHarthmereCombatRewards(input: { attacker: HarthmereCombatStatsV1; target: HarthmereCombatStatsV1; contribution: HarthmereContributionV1; relationship: HarthmereCombatRelationship; repeatedKillCount?: number; pvp?: boolean; afk?: boolean; lowLevelProtection?: boolean }): HarthmereRewardDecisionV1 {
  const suppressionReasons: string[] = [];
  if (!input.contribution.active || !input.contribution.inRange) suppressionReasons.push("contributor_not_active_or_in_range");
  if (input.afk) suppressionReasons.push("afk_participation_rejected");
  if (input.repeatedKillCount && input.repeatedKillCount >= 2) suppressionReasons.push("repeated_kill_diminishing_rewards");
  if (input.pvp && input.attacker.level >= input.target.level + 10) suppressionReasons.push("low_level_grief_reward_suppressed");
  if (input.target.rank === "civilian" || input.target.rank === "critter") suppressionReasons.push("harmless_target_no_meaningful_xp");
  const xpEligible = suppressionReasons.length === 0 && input.target.hp <= 0;
  const lootEligible = xpEligible && !["party_member", "raid_member", "friendly", "faction_ally"].includes(input.relationship);
  const illegalCivilianAttack = ["civilian", "merchant", "guard"].includes(input.target.faction) && input.attacker.entityKind === "player";
  return {
    xpEligible,
    lootEligible,
    questCreditEligible: xpEligible || (input.target.tags?.includes("public_quest_target") ?? false),
    reputationDelta: illegalCivilianAttack ? -250 : input.target.faction === "bandit" || input.target.faction === "undead" ? 30 : 0,
    legalDelta: illegalCivilianAttack ? -400 : 0,
    pvpRewardEligible: Boolean(input.pvp && xpEligible && !suppressionReasons.includes("low_level_grief_reward_suppressed")),
    suppressionReasons,
  };
}

export function resolveHarthmereCombatAction(request: HarthmereCombatRequestV1, rng: () => number = Math.random): HarthmereCombatResolutionV1 {
  const validation = validateHarthmereCombatRequest(request);
  if (!validation.ok) {
    return {
      ok: false,
      result: validation.result ?? "invalid_target",
      attacker: request.attacker,
      target: request.target,
      damage: { baseDamage: 0, rawDamage: 0, reduction: 0, absorbDamage: 0, mitigatedDamage: 0, finalDamage: 0 },
      contribution: updateHarthmereContribution({ playerId: request.attacker.id, damage: 0, nowMs: request.serverNowMs, inRange: false, active: false }),
      threat: { targetId: request.attacker.id, threat: 0, lastThreatAtMs: request.serverNowMs, source: "damage" },
      rewards: { xpEligible: false, lootEligible: false, questCreditEligible: false, reputationDelta: 0, legalDelta: 0, pvpRewardEligible: false, suppressionReasons: validation.reasons },
      auditLog: [...validation.audit, ...validation.reasons, ...validation.rejectedClientFields.map((field) => `rejected_client_field:${field}`)],
      feedback: validation.result ?? validation.reasons[0] ?? "invalid_target",
    };
  }
  const hitResult = resolveHarthmereHitResult({ attacker: request.attacker, defender: request.target, ability: request.ability, rng });
  const damage = calculateHarthmereDamage({ attacker: request.attacker, defender: request.target, ability: request.ability, hitResult, rng });
  const nextResources = { ...(request.attacker.resources ?? {}) };
  if (request.ability.resourceCost) {
    nextResources[request.ability.resourceCost.resource] = Math.max(0, (nextResources[request.ability.resourceCost.resource] ?? 0) - request.ability.resourceCost.amount);
  }
  const attacker = { ...request.attacker, combatState: "in_combat" as HarthmereCombatStateName, resources: nextResources, aggressionUntilMs: request.serverNowMs + 60_000 };
  const nextHp = clampHarthmereCombatNumber(request.target.hp - damage.finalDamage, 0, request.target.maxHp);
  let target: HarthmereCombatStatsV1 = { ...request.target, hp: nextHp, combatState: nextHp <= 0 ? "dead" : "in_combat" };
  const pvp = request.attacker.entityKind === "player" && request.target.entityKind === "player";
  const contribution = updateHarthmereContribution({ playerId: request.attacker.id, damage: damage.finalDamage, crowdControl: Boolean(request.ability.crowdControl), nowMs: request.serverNowMs, inRange: true, active: true });
  const death = resolveHarthmereDeathState({ target, attacker, ability: request.ability, damage: damage.finalDamage, nowMs: request.serverNowMs, pvp, hardcore: request.hardcoreZone, creditPlayerIds: [request.attacker.id] });
  if (death) target = { ...target, combatState: death.state };
  const threat = updateHarthmereThreat({ attacker, target, ability: request.ability, damage: damage.finalDamage, nowMs: request.serverNowMs });
  const rewards = calculateHarthmereCombatRewards({ attacker, target, contribution, relationship: request.relationship, repeatedKillCount: request.repeatedKillCount, pvp });
  const auditLog = [
    ...HARTHMERE_COMBAT_PIPELINE_V1,
    `hit_result:${hitResult}`,
    `final_damage:${damage.finalDamage}`,
    death ? `death_state:${death.state}` : "death_state:none",
    `xp_eligible:${rewards.xpEligible}`,
    `loot_eligible:${rewards.lootEligible}`,
  ];
  return { ok: true, result: death ? "dead" : hitResult, attacker, target, damage, death, contribution, threat, rewards, auditLog, feedback: death?.deathMessage ?? `${attacker.name} ${hitResult} ${target.name} for ${damage.finalDamage}.` };
}

export function canReviveHarthmereCombatTarget(input: { reviver: HarthmereCombatStatsV1; target: HarthmereCombatStatsV1; distanceMeters: number; lineOfSight: boolean; zoneAllowsRevive: boolean; pvpRulesAllowRevive: boolean; bossRulesAllowRevive: boolean }) {
  const reasons: string[] = [];
  if (!input.target || !["dead", "downed"].includes(input.target.combatState)) reasons.push("target_not_dead_or_downed");
  if (input.reviver.hp <= 0 || ["dead", "downed", "stunned", "silenced"].includes(input.reviver.combatState)) reasons.push("reviver_cannot_cast_revive");
  if (input.distanceMeters > HARTHMERE_DEFAULT_ABILITIES_V1.revive.range + 0.35) reasons.push("revive_out_of_range");
  if (!input.lineOfSight) reasons.push("revive_no_line_of_sight");
  if (!input.zoneAllowsRevive) reasons.push("zone_blocks_revive");
  if (!input.pvpRulesAllowRevive) reasons.push("pvp_rules_block_revive");
  if (!input.bossRulesAllowRevive) reasons.push("boss_rules_block_revive");
  return { ok: reasons.length === 0, reasons };
}

export function reviveHarthmereCombatTarget(input: { target: HarthmereCombatStatsV1; reviveType: "basic" | "healer" | "high_level" | "shrine" | "self" }) {
  const hpPercent = input.reviveType === "basic" ? 0.2 : input.reviveType === "healer" ? 0.4 : input.reviveType === "high_level" ? 0.7 : input.reviveType === "shrine" ? 0.5 : 0.3;
  return { ...input.target, hp: Math.max(1, Math.round(input.target.maxHp * hpPercent)), combatState: "idle" as HarthmereCombatStateName, spawnProtectedUntilMs: undefined };
}

export function validateHarthmereRespawnPoint(point: HarthmereRespawnPointV1) {
  const reasons: string[] = [];
  if (!point.safe) reasons.push("respawn_not_safe");
  if (!point.validGround) reasons.push("respawn_not_valid_ground");
  if (point.insideWall) reasons.push("respawn_inside_wall");
  if (point.insideHazard) reasons.push("respawn_inside_hazard");
  if (point.insideEnemyAoe) reasons.push("respawn_inside_enemy_aoe");
  if (point.playerOverlap) reasons.push("respawn_overlaps_player_or_npc");
  if (!point.connectedToNavigation) reasons.push("respawn_not_connected_to_navigation");
  if (!point.unlocked) reasons.push("respawn_not_unlocked");
  return { ok: reasons.length === 0, reasons };
}

export function respawnHarthmereCombatant(input: { combatant: HarthmereCombatStatsV1; point: HarthmereRespawnPointV1; nowMs: number }) {
  const validation = validateHarthmereRespawnPoint(input.point);
  if (!validation.ok) return { ok: false, combatant: input.combatant, reasons: validation.reasons };
  const hp = Math.max(1, Math.round(input.combatant.maxHp * input.point.hpPercent));
  const resources: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.combatant.resources ?? {})) {
    resources[key] = Math.round(value * input.point.resourcePercent);
  }
  return { ok: true, combatant: { ...input.combatant, hp, resources, position: input.point.position, combatState: "protected_after_respawn" as HarthmereCombatStateName, spawnProtectedUntilMs: input.nowMs + input.point.protectionSeconds * 1000 }, reasons: [] };
}

export function resolveCrowdControlDiminishingReturn(input: { category: HarthmereCrowdControlCategory; previousApplications: number; baseDurationMs: number }) {
  const multiplier = input.previousApplications <= 0 ? 1 : input.previousApplications === 1 ? 0.5 : input.previousApplications === 2 ? 0.25 : 0;
  return { category: input.category, durationMs: Math.round(input.baseDurationMs * multiplier), immune: multiplier === 0 };
}

export function validateHarthmereLeash(input: { npc: HarthmereCombatStatsV1; currentPosition: HarthmereVec3 }) {
  if (!input.npc.homePosition || !input.npc.leashRange) return { ok: true, result: "within_leash" as const };
  const distance = distanceHarthmereCombatMeters(input.npc.homePosition, input.currentPosition);
  if (distance > input.npc.leashRange) return { ok: false, result: "evade_and_return_home" as const, distance };
  return { ok: true, result: "within_leash" as const, distance };
}

export const HARTHMERE_COMBAT_EDGE_CASES_V1 = [
  "target_dies_before_attack_lands",
  "attacker_dies_before_projectile_lands",
  "simultaneous_death",
  "healing_and_damage_same_tick",
  "disconnect_during_combat",
  "safe_zone_abuse",
  "spawn_camping",
  "attacking_through_walls",
  "npc_pathfinding_exploit",
  "boss_leash_abuse",
  "damage_reflection_loop",
  "infinite_healing_loop",
  "buff_stacking_exploit",
  "aoe_target_caps",
  "kill_stealing",
  "pvp_griefing",
  "low_level_player_protection",
  "pet_and_summon_contribution",
  "legal_and_reputation_penalties",
  "raid_leader_kick_before_loot",
  "boss_dragged_out_of_arena",
] as const;

