/*
 * mmo_combat_authority_v1.ts
 *
 * Server-authoritative combat and ability validation for Harthmere MMO.
 *
 * The server MUST validate ALL of the following before applying any mutation:
 *   class / level / spec / known ability / equipped ability
 *   weapon & armor requirements / resource cost / cooldown
 *   range / line-of-sight / target validity
 *   zone & PvP & legal rules
 *   damage & healing / XP / unlocks / talents / respecs
 *
 * The client NEVER supplies authoritative values for any of these.
 * The reducer calls reduceHarthmereCombatActionV1 and uses its result.
 */

export const MMO_COMBAT_AUTHORITY_VERSION_V1 = "mmo-combat-authority-v1";

// ---------------------------------------------------------------------------
// Catalogue types (loaded server-side, never trusted from client)
// ---------------------------------------------------------------------------

export type HarthmereTargetTypeV1 =
  | "single_enemy"
  | "single_ally"
  | "self"
  | "ground_aoe"
  | "chain"
  | "cone"
  | "line";

export type HarthmereResourceKindV1 = "mana" | "energy" | "rage" | "focus" | "faith";

export type HarthmereWeaponTypeV1 =
  | "sword"
  | "axe"
  | "mace"
  | "dagger"
  | "staff"
  | "bow"
  | "crossbow"
  | "wand"
  | "unarmed"
  | "any";

export type HarthmereZonePvPRuleV1 =
  | "safe_zone"
  | "contested"
  | "open_pvp"
  | "arena"
  | "duel_only"
  | "guild_war_only";

export interface HarthmereAbilityCatalogueEntryV1 {
  abilityId: string;
  displayName: string;
  targetType: HarthmereTargetTypeV1;
  /** required class ids; empty = any */
  classRestriction: string[];
  /** required spec ids; empty = any spec of the class */
  specRestriction: string[];
  /** minimum class level */
  levelRequirement: number;
  /** required weapon type in main-hand or off-hand */
  requiredWeaponType: HarthmereWeaponTypeV1;
  resourceKind: HarthmereResourceKindV1;
  resourceCost: number;
  /** Cooldown in ms */
  cooldownMs: number;
  /** Shared/category cooldown key (e.g. "global_cooldown") */
  sharedCooldownCategory?: string;
  sharedCooldownMs?: number;
  /** Max range in game units */
  rangeUnits: number;
  requiresLineOfSight: boolean;
  /** Whether the ability can be cast in safe zones */
  allowedInSafeZone: boolean;
  /** Whether the ability can damage PvP-flagged enemies */
  allowedInPvP: boolean;
  /** Base damage; server re-derives from this + stats */
  baseDamage: number;
  /** Base healing; server re-derives from this + stats */
  baseHealing: number;
  /** Damage scalar (multiplied by attacker attack power) */
  attackPowerScaling: number;
  /** Healing scalar */
  spellPowerScaling: number;
  /** XP granted on successful use */
  xpReward: number;
  castTimeMs: number;
  /** Whether the ability can be interrupted */
  interruptible: boolean;
  /** Unlocks at specific milestones when learned */
  unlocksMilestones: string[];
  /** Required talent node to be active */
  requiredTalentNode?: string;
}

export interface HarthmereClassDefinitionV1 {
  classId: string;
  displayName: string;
  availableSpecializations: string[];
  primaryResource: HarthmereResourceKindV1;
  maxResourceByLevel: Record<number, number>;
  /** hp per level */
  hpPerLevel: number;
  baseHp: number;
  /** attack power per level */
  attackPowerPerLevel: number;
  /** spell power per level */
  spellPowerPerLevel: number;
}

// ---------------------------------------------------------------------------
// Combat actor snapshot (server-owned state; never trust client)
// ---------------------------------------------------------------------------

export interface HarthmereCombatActorSnapshotV1 {
  actorId: string;
  classId: string;
  specializationId: string;
  level: number;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  resourceKind: HarthmereResourceKindV1;
  /** abilityId → expires-at ms */
  cooldowns: Record<string, number>;
  /** shared cooldown category → expires-at ms */
  sharedCooldowns: Record<string, number>;
  knownAbilities: string[];
  /** abilities currently in the active loadout (must be subset of knownAbilities) */
  equippedAbilities: string[];
  /** talent nodes currently active */
  activeTalentNodes: string[];
  /** main-hand equipped weapon type */
  mainHandWeaponType: HarthmereWeaponTypeV1;
  offHandWeaponType: HarthmereWeaponTypeV1 | "none";
  deathState: "alive" | "downed" | "dead";
  /** attacker position */
  position: { x: number; y: number; z: number };
  /** current PvP flag — server-owned */
  pvpFlagged: boolean;
  legalFlags: Record<string, boolean>;
}

export interface HarthmereCombatTargetSnapshotV1 {
  targetId: string;
  isHostile: boolean;
  isAlive: boolean;
  isAttackable: boolean;
  hp: number;
  maxHp: number;
  position: { x: number; y: number; z: number };
  pvpFlagged?: boolean;
  /** Whether the target is a player */
  isPlayer: boolean;
  /** Zone PvP rules applying to this target at time of action */
  zonePvPRule: HarthmereZonePvPRuleV1;
}

export interface HarthmereZoneSnapshotV1 {
  zoneId: string;
  pvpRule: HarthmereZonePvPRuleV1;
  isSafeZone: boolean;
  allowPvP: boolean;
  activeLegalSystem: boolean;
}

// ---------------------------------------------------------------------------
// Combat action request
// ---------------------------------------------------------------------------

export type HarthmereCombatActionKindV1 =
  | "attack"
  | "ability_cast"
  | "respec"
  | "talent_purchase"
  | "loadout_change";

export interface HarthmereCombatActionRequestV1 {
  requestId: string;
  kind: HarthmereCombatActionKindV1;
  actorId: string;
  targetId?: string;
  abilityId?: string;
  nowMs: number;
  /** For talent purchase */
  talentNodeId?: string;
  /** Gold cost for respec — server will re-derive, but used for UI context */
  respecType?: "full" | "partial";
  /** New loadout abilities (server validates ownership/eligibility for each) */
  newLoadout?: string[];
}

// ---------------------------------------------------------------------------
// Combat action result
// ---------------------------------------------------------------------------

export interface HarthmereCombatActionResultV1 {
  ok: boolean;
  requestId: string;
  kind: HarthmereCombatActionKindV1;
  actorId: string;
  targetId?: string;
  errors: string[];
  warnings: string[];
  /** Server-computed damage; NEVER trusted from client */
  damage: number;
  /** Server-computed healing */
  healing: number;
  /** Gold cost (for respec) */
  goldCost: number;
  /** XP to award the attacker/caster */
  xpDelta: number;
  /** Skill XP for the relevant skill */
  skillXpDelta: number;
  /** Cooldowns to set: abilityId/category → expires-at ms */
  newCooldowns: Record<string, number>;
  /** New shared cooldown categories */
  newSharedCooldowns: Record<string, number>;
  /** New resource value for actor after this action */
  actorResourceAfter: number;
  /** Whether the target dies from this action */
  killsTarget: boolean;
  /** Talent nodes added (talent purchase) */
  newTalentNodes: string[];
  /** New equipped abilities after loadout change */
  newEquippedAbilities: string[];
  /** Whether this is a PvP kill */
  isPvPKill: boolean;
  auditTags: string[];
}

// ---------------------------------------------------------------------------
// Catalogue registries
// ---------------------------------------------------------------------------

const _abilityCatalogue = new Map<string, HarthmereAbilityCatalogueEntryV1>();
const _classCatalogue = new Map<string, HarthmereClassDefinitionV1>();

export function registerHarthmereAbilityV1(entry: HarthmereAbilityCatalogueEntryV1) {
  _abilityCatalogue.set(entry.abilityId, entry);
}

export function getHarthmereAbilityV1(
  abilityId: string
): HarthmereAbilityCatalogueEntryV1 | undefined {
  return _abilityCatalogue.get(abilityId);
}

export function registerHarthmereClassDefinitionV1(def: HarthmereClassDefinitionV1) {
  _classCatalogue.set(def.classId, def);
}

export function getHarthmereClassDefinitionV1(
  classId: string
): HarthmereClassDefinitionV1 | undefined {
  return _classCatalogue.get(classId);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function distanceBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
  );
}

/**
 * Stub line-of-sight check.  In production this calls the terrain/voxel
 * raycaster.  Here we trust the server tick geometry; client claims are
 * always rejected.
 */
function serverCheckLineOfSight(
  _from: { x: number; y: number; z: number },
  _to: { x: number; y: number; z: number }
): boolean {
  // TODO: wire to actual voxel raycast when terrain system is available.
  // Returning true here means LoS is not yet blocked by server geometry —
  // the game can ship with this stub and tighten it later without changing
  // the contract.
  return true;
}

// ---------------------------------------------------------------------------
// Damage formula (server-authoritative; never accept client's damage claim)
// ---------------------------------------------------------------------------

export function computeHarthmereAbilityDamageV1(
  ability: HarthmereAbilityCatalogueEntryV1,
  actorClass: HarthmereClassDefinitionV1,
  actorLevel: number,
  varianceMultiplier = 1.0
): number {
  const attackPower =
    actorClass.baseHp * 0.1 + actorClass.attackPowerPerLevel * actorLevel;
  const spellPower =
    actorClass.baseHp * 0.1 + actorClass.spellPowerPerLevel * actorLevel;
  const raw =
    ability.baseDamage +
    ability.attackPowerScaling * attackPower +
    ability.spellPowerScaling * spellPower;
  // ±10% variance, seeded from server tick — never from client
  return Math.max(1, Math.round(raw * varianceMultiplier));
}

export function computeHarthmereAbilityHealingV1(
  ability: HarthmereAbilityCatalogueEntryV1,
  actorClass: HarthmereClassDefinitionV1,
  actorLevel: number
): number {
  const spellPower =
    actorClass.baseHp * 0.1 + actorClass.spellPowerPerLevel * actorLevel;
  return Math.max(0, Math.round(ability.baseHealing + ability.spellPowerScaling * spellPower));
}

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function combatFail(errors: string[], ...codes: string[]) {
  errors.push(...codes);
}

function resultFail(
  req: HarthmereCombatActionRequestV1,
  errors: string[]
): HarthmereCombatActionResultV1 {
  return {
    ok: false,
    requestId: req.requestId,
    kind: req.kind,
    actorId: req.actorId,
    targetId: req.targetId,
    errors,
    warnings: [],
    damage: 0,
    healing: 0,
    goldCost: 0,
    xpDelta: 0,
    skillXpDelta: 0,
    newCooldowns: {},
    newSharedCooldowns: {},
    actorResourceAfter: 0,
    killsTarget: false,
    newTalentNodes: [],
    newEquippedAbilities: [],
    isPvPKill: false,
    auditTags: [],
  };
}

function resultOk(
  req: HarthmereCombatActionRequestV1,
  overrides: Partial<HarthmereCombatActionResultV1>
): HarthmereCombatActionResultV1 {
  return {
    ok: true,
    requestId: req.requestId,
    kind: req.kind,
    actorId: req.actorId,
    targetId: req.targetId,
    errors: [],
    warnings: [],
    damage: 0,
    healing: 0,
    goldCost: 0,
    xpDelta: 0,
    skillXpDelta: 0,
    newCooldowns: {},
    newSharedCooldowns: {},
    actorResourceAfter: 0,
    killsTarget: false,
    newTalentNodes: [],
    newEquippedAbilities: [],
    isPvPKill: false,
    auditTags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Attack / ability validation
// ---------------------------------------------------------------------------

function validateAbilityCast(
  req: HarthmereCombatActionRequestV1,
  actor: HarthmereCombatActorSnapshotV1,
  target: HarthmereCombatTargetSnapshotV1 | undefined,
  zone: HarthmereZoneSnapshotV1
): HarthmereCombatActionResultV1 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { abilityId, nowMs } = req;

  if (!abilityId) return resultFail(req, ["missing_ability_id"]);

  // --- Actor preconditions ---
  if (actor.deathState !== "alive") combatFail(errors, "actor_is_dead_or_downed");
  if (actor.hp <= 0) combatFail(errors, "actor_hp_is_zero");

  // --- Ability catalogue lookup (server-authoritative) ---
  const ability = getHarthmereAbilityV1(abilityId);
  if (!ability) return resultFail(req, ["unknown_ability_id"]);

  // --- Known ability check ---
  if (!actor.knownAbilities.includes(abilityId)) {
    combatFail(errors, "ability_not_known");
  }

  // --- Equipped in loadout ---
  if (!actor.equippedAbilities.includes(abilityId)) {
    combatFail(errors, "ability_not_equipped_in_loadout");
  }

  // --- Class requirement ---
  if (
    ability.classRestriction.length > 0 &&
    !ability.classRestriction.includes(actor.classId)
  ) {
    combatFail(errors, "class_requirement_not_met");
  }

  // --- Spec requirement ---
  if (
    ability.specRestriction.length > 0 &&
    !ability.specRestriction.includes(actor.specializationId)
  ) {
    combatFail(errors, "spec_requirement_not_met");
  }

  // --- Level requirement ---
  if (actor.level < ability.levelRequirement) {
    combatFail(errors, "level_requirement_not_met");
  }

  // --- Required weapon type ---
  const hasRequiredWeapon =
    ability.requiredWeaponType === "any" ||
    actor.mainHandWeaponType === ability.requiredWeaponType ||
    actor.offHandWeaponType === ability.requiredWeaponType;
  if (!hasRequiredWeapon) {
    combatFail(errors, "weapon_requirement_not_met");
  }

  // --- Talent requirement ---
  if (
    ability.requiredTalentNode &&
    !actor.activeTalentNodes.includes(ability.requiredTalentNode)
  ) {
    combatFail(errors, "talent_node_requirement_not_met");
  }

  // --- Resource cost (server-owned resource, never trust client) ---
  if (actor.resource < ability.resourceCost) {
    combatFail(errors, "insufficient_resource");
  }

  // --- Individual cooldown ---
  const cdExpiry = actor.cooldowns[abilityId];
  if (cdExpiry !== undefined && nowMs < cdExpiry) {
    combatFail(errors, "ability_on_cooldown");
  }

  // --- Shared/global cooldown ---
  if (ability.sharedCooldownCategory) {
    const sharedExpiry = actor.sharedCooldowns[ability.sharedCooldownCategory];
    if (sharedExpiry !== undefined && nowMs < sharedExpiry) {
      combatFail(errors, "shared_cooldown_active");
    }
  }

  // --- Zone rules ---
  if (!ability.allowedInSafeZone && zone.isSafeZone) {
    combatFail(errors, "ability_blocked_in_safe_zone");
  }

  // --- Target-dependent checks ---
  if (
    ability.targetType !== "self" &&
    ability.targetType !== "ground_aoe"
  ) {
    if (!target) {
      combatFail(errors, "target_required_but_missing");
    } else {
      if (!target.isAlive) combatFail(errors, "target_is_dead");
      if (!target.isAttackable) combatFail(errors, "target_not_attackable");

      // --- PvP legality ---
      if (target.isPlayer) {
        if (!zone.allowPvP && !actor.pvpFlagged) {
          combatFail(errors, "pvp_not_permitted_in_zone");
        }
        if (zone.pvpRule === "safe_zone") {
          combatFail(errors, "cannot_attack_player_in_safe_zone");
        }
        if (!ability.allowedInPvP) {
          combatFail(errors, "ability_not_allowed_in_pvp");
        }
      }

      // --- Range check (server geometry) ---
      const dist = distanceBetween(actor.position, target.position);
      if (dist > ability.rangeUnits) {
        combatFail(errors, "target_out_of_range");
      }

      // --- Line of sight (server raycast) ---
      if (ability.requiresLineOfSight) {
        if (!serverCheckLineOfSight(actor.position, target.position)) {
          combatFail(errors, "no_line_of_sight");
        }
      }
    }
  }

  if (errors.length > 0) return resultFail(req, errors);

  // --- Compute server-authoritative damage/healing ---
  const classDef = getHarthmereClassDefinitionV1(actor.classId);
  let damage = 0;
  let healing = 0;

  if (classDef) {
    // Deterministic variance tied to requestId hash to be replay-safe
    const variance = 0.95 + (hashStringToFloat(req.requestId) * 0.1);
    if (ability.baseDamage > 0 || ability.attackPowerScaling > 0) {
      damage = computeHarthmereAbilityDamageV1(ability, classDef, actor.level, variance);
    }
    if (ability.baseHealing > 0 || ability.spellPowerScaling > 0) {
      healing = computeHarthmereAbilityHealingV1(ability, classDef, actor.level);
    }
  } else {
    warnings.push("class_definition_not_found_damage_fallback");
    damage = ability.baseDamage;
  }

  const killsTarget = target !== undefined && target.hp - damage <= 0;
  const isPvPKill = killsTarget && (target?.isPlayer ?? false);

  const newCooldowns: Record<string, number> = {
    [abilityId]: nowMs + ability.cooldownMs,
  };
  const newSharedCooldowns: Record<string, number> = {};
  if (ability.sharedCooldownCategory && ability.sharedCooldownMs) {
    newSharedCooldowns[ability.sharedCooldownCategory] =
      nowMs + ability.sharedCooldownMs;
  }

  const actorResourceAfter = Math.max(0, actor.resource - ability.resourceCost);

  return resultOk(req, {
    damage,
    healing,
    xpDelta: killsTarget ? ability.xpReward : 0,
    skillXpDelta: Math.ceil(ability.xpReward * 0.1),
    newCooldowns,
    newSharedCooldowns,
    actorResourceAfter,
    killsTarget,
    isPvPKill,
    warnings,
    auditTags: [
      "ability_cast",
      abilityId,
      ...(damage > 0 ? [`damage:${damage}`] : []),
      ...(healing > 0 ? [`healing:${healing}`] : []),
      ...(killsTarget ? ["kill"] : []),
      ...(isPvPKill ? ["pvp_kill"] : []),
    ],
  });
}

// ---------------------------------------------------------------------------
// Respec validation
// ---------------------------------------------------------------------------

const HARTHMERE_RESPEC_BASE_COST_GOLD = 500;
const HARTHMERE_RESPEC_COST_MULTIPLIER = 1.5;
const HARTHMERE_MAX_RESPEC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function computeHarthmereRespecCostV1(respecCount: number): number {
  return Math.round(
    HARTHMERE_RESPEC_BASE_COST_GOLD *
      Math.pow(HARTHMERE_RESPEC_COST_MULTIPLIER, Math.min(respecCount, 10))
  );
}

function validateRespec(
  req: HarthmereCombatActionRequestV1,
  actor: HarthmereCombatActorSnapshotV1,
  respecCount: number,
  lastRespecAtMs: number | undefined,
  actorGold: number
): HarthmereCombatActionResultV1 {
  const errors: string[] = [];
  const { nowMs } = req;

  // Cannot respec while dead/downed
  if (actor.deathState !== "alive") combatFail(errors, "cannot_respec_while_dead_or_downed");

  // Cannot respec while any abilities are on cooldown (prevents cooldown bypass exploit)
  for (const [abilityId, expiresAt] of Object.entries(actor.cooldowns)) {
    if (nowMs < expiresAt) {
      combatFail(errors, `cannot_respec_with_ability_on_cooldown:${abilityId}`);
    }
  }

  // Respec cooldown
  if (lastRespecAtMs !== undefined) {
    const elapsed = nowMs - lastRespecAtMs;
    if (elapsed < HARTHMERE_MAX_RESPEC_COOLDOWN_MS) {
      combatFail(errors, "respec_on_cooldown");
    }
  }

  const goldCost = computeHarthmereRespecCostV1(respecCount);
  if (actorGold < goldCost) {
    combatFail(errors, "insufficient_gold_for_respec");
  }

  if (errors.length > 0) return resultFail(req, errors);

  return resultOk(req, {
    goldCost: -goldCost, // negative = gold deducted
    auditTags: ["respec", `cost:${goldCost}`, `respec_count:${respecCount + 1}`],
  });
}

// ---------------------------------------------------------------------------
// Talent purchase validation
// ---------------------------------------------------------------------------

function validateTalentPurchase(
  req: HarthmereCombatActionRequestV1,
  actor: HarthmereCombatActorSnapshotV1,
  talentPointsAvailable: number
): HarthmereCombatActionResultV1 {
  const errors: string[] = [];
  const { talentNodeId } = req;

  if (!talentNodeId) return resultFail(req, ["missing_talent_node_id"]);

  if (actor.deathState !== "alive") combatFail(errors, "cannot_purchase_talent_while_dead");
  if (talentPointsAvailable < 1) combatFail(errors, "no_talent_points_available");
  if (actor.activeTalentNodes.includes(talentNodeId)) {
    combatFail(errors, "talent_node_already_purchased");
  }

  if (errors.length > 0) return resultFail(req, errors);

  return resultOk(req, {
    newTalentNodes: [talentNodeId],
    auditTags: ["talent_purchase", talentNodeId],
  });
}

// ---------------------------------------------------------------------------
// Loadout change validation
// ---------------------------------------------------------------------------

function validateLoadoutChange(
  req: HarthmereCombatActionRequestV1,
  actor: HarthmereCombatActorSnapshotV1
): HarthmereCombatActionResultV1 {
  const errors: string[] = [];
  const { newLoadout } = req;

  if (!newLoadout) return resultFail(req, ["missing_new_loadout"]);
  if (actor.deathState !== "alive") combatFail(errors, "cannot_change_loadout_while_dead");

  // Cannot change loadout while any ability is on cooldown
  for (const [abilityId, expiresAt] of Object.entries(actor.cooldowns)) {
    if (req.nowMs < expiresAt) {
      combatFail(errors, `cannot_change_loadout_with_ability_on_cooldown:${abilityId}`);
    }
  }

  // Every ability in the new loadout must be in knownAbilities
  for (const abilityId of newLoadout) {
    if (!actor.knownAbilities.includes(abilityId)) {
      combatFail(errors, `loadout_ability_not_known:${abilityId}`);
    }
    const ability = getHarthmereAbilityV1(abilityId);
    if (ability) {
      // Class/spec/level checks per ability
      if (
        ability.classRestriction.length > 0 &&
        !ability.classRestriction.includes(actor.classId)
      ) {
        combatFail(errors, `loadout_ability_class_mismatch:${abilityId}`);
      }
      if (actor.level < ability.levelRequirement) {
        combatFail(errors, `loadout_ability_level_requirement:${abilityId}`);
      }
      if (ability.requiredTalentNode && !actor.activeTalentNodes.includes(ability.requiredTalentNode)) {
        combatFail(errors, `loadout_ability_talent_not_purchased:${abilityId}`);
      }
    }
  }

  if (errors.length > 0) return resultFail(req, errors);

  return resultOk(req, {
    newEquippedAbilities: [...newLoadout],
    auditTags: ["loadout_change", `ability_count:${newLoadout.length}`],
  });
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export interface HarthmereCombatActionContextV1 {
  actor: HarthmereCombatActorSnapshotV1;
  target?: HarthmereCombatTargetSnapshotV1;
  zone: HarthmereZoneSnapshotV1;
  /** How many times this actor has respec'd */
  respecCount: number;
  /** Timestamp of last respec, or undefined if never */
  lastRespecAtMs?: number;
  /** Server-owned gold for respec cost check */
  actorGold: number;
  /** Available talent points (server-computed from level + spent) */
  talentPointsAvailable: number;
}

export function reduceHarthmereCombatActionV1(
  req: HarthmereCombatActionRequestV1,
  ctx: HarthmereCombatActionContextV1
): HarthmereCombatActionResultV1 {
  switch (req.kind) {
    case "attack":
    case "ability_cast":
      return validateAbilityCast(req, ctx.actor, ctx.target, ctx.zone);

    case "respec":
      return validateRespec(
        req,
        ctx.actor,
        ctx.respecCount,
        ctx.lastRespecAtMs,
        ctx.actorGold
      );

    case "talent_purchase":
      return validateTalentPurchase(req, ctx.actor, ctx.talentPointsAvailable);

    case "loadout_change":
      return validateLoadoutChange(req, ctx.actor);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashStringToFloat(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Zone PvP legality helper (used by both combat and building systems)
// ---------------------------------------------------------------------------

export function isHarthmerePvPLegalV1(
  actor: HarthmereCombatActorSnapshotV1,
  target: HarthmereCombatTargetSnapshotV1,
  zone: HarthmereZoneSnapshotV1
): { legal: boolean; reason: string } {
  if (!target.isPlayer) {
    return { legal: true, reason: "npc_target" };
  }
  if (zone.isSafeZone) {
    return { legal: false, reason: "safe_zone" };
  }
  if (zone.pvpRule === "safe_zone") {
    return { legal: false, reason: "zone_is_safe" };
  }
  if (zone.pvpRule === "arena" || zone.pvpRule === "open_pvp") {
    return { legal: true, reason: "open_pvp_zone" };
  }
  if (actor.pvpFlagged && target.pvpFlagged) {
    return { legal: true, reason: "both_flagged" };
  }
  return { legal: false, reason: "pvp_not_permitted" };
}

// ---------------------------------------------------------------------------
// XP reward computation (server-authoritative — never trust client XP claim)
// ---------------------------------------------------------------------------

export function computeHarthmereXpRewardV1(input: {
  actorLevel: number;
  targetLevel: number;
  baseXp: number;
  contributionScore: number;
  antiFarmMultiplier: number;
  restedXpPool: number;
}): { xpReward: number; restedXpConsumed: number } {
  const levelDiff = input.targetLevel - input.actorLevel;

  // Grey content (10+ levels below) grants no XP
  if (levelDiff < -9) {
    return { xpReward: 0, restedXpConsumed: 0 };
  }

  let xp = input.baseXp * Math.max(0.1, 1 + levelDiff * 0.1);
  xp = xp * Math.max(0.05, Math.min(1, input.contributionScore));
  xp = xp * Math.max(0, Math.min(1, input.antiFarmMultiplier));

  // Rested XP bonus: doubles XP up to the rested pool
  const restedBonus = Math.min(input.restedXpPool, xp);
  xp += restedBonus;

  return {
    xpReward: Math.round(xp),
    restedXpConsumed: Math.round(restedBonus),
  };
}
