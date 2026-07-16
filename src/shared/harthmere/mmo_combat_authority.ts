/*
 * mmo_combat_authority.ts
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
 * The reducer calls reduceHarthmereCombatAction and uses its result.
 */

export const MMO_COMBAT_AUTHORITY_VERSION = "mmo-combat-authority";

// ---------------------------------------------------------------------------
// Catalogue types (loaded server-side, never trusted from client)
// ---------------------------------------------------------------------------

export type HarthmereTargetType =
  | "single_enemy"
  | "single_ally"
  | "self"
  | "ground_aoe"
  | "chain"
  | "cone"
  | "line";

export type HarthmereResourceKind =
  | "mana"
  | "energy"
  | "rage"
  | "focus"
  | "faith"
  | "stamina"
  | "conviction"
  | "souls"
  | "inspiration";

export type HarthmereWeaponType =
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

export type HarthmereZonePvPRule =
  | "safe_zone"
  | "contested"
  | "open_pvp"
  | "arena"
  | "duel_only"
  | "guild_war_only";

export interface HarthmereAbilityCatalogueEntry {
  abilityId: string;
  displayName: string;
  targetType: HarthmereTargetType;
  /** required class ids; empty = any */
  classRestriction: string[];
  /** required spec ids; empty = any spec of the class */
  specRestriction: string[];
  /** minimum class level */
  levelRequirement: number;
  /** required weapon type in main-hand or off-hand */
  requiredWeaponType: HarthmereWeaponType;
  resourceKind: HarthmereResourceKind;
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

export interface HarthmereClassDefinition {
  classId: string;
  displayName: string;
  availableSpecializations: string[];
  primaryResource: HarthmereResourceKind;
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

export interface HarthmereCombatActorSnapshot {
  actorId: string;
  classId: string;
  specializationId: string;
  level: number;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  resourceKind: HarthmereResourceKind;
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
  mainHandWeaponType: HarthmereWeaponType;
  offHandWeaponType: HarthmereWeaponType | "none";
  /** Server-derived bonuses from equipped item definitions. */
  attackPowerBonus?: number;
  spellPowerBonus?: number;
  armorRating?: number;
  deathState: "alive" | "downed" | "dead";
  /** attacker position */
  position: { x: number; y: number; z: number };
  /** current PvP flag — server-owned */
  pvpFlagged: boolean;
  legalFlags: Record<string, boolean>;
}

export interface HarthmereCombatTargetSnapshot {
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
  zonePvPRule: HarthmereZonePvPRule;
}

export interface HarthmereZoneSnapshot {
  zoneId: string;
  pvpRule: HarthmereZonePvPRule;
  isSafeZone: boolean;
  allowPvP: boolean;
  activeLegalSystem: boolean;
}

// ---------------------------------------------------------------------------
// Combat action request
// ---------------------------------------------------------------------------

export type HarthmereCombatActionKind =
  | "attack"
  | "ability_cast"
  | "respec"
  | "talent_purchase"
  | "loadout_change";

export interface HarthmereCombatActionRequest {
  requestId: string;
  kind: HarthmereCombatActionKind;
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

export interface HarthmereCombatActionResult {
  ok: boolean;
  requestId: string;
  kind: HarthmereCombatActionKind;
  actorId: string;
  /** The target that actually receives the resolved hit, if any. */
  targetId?: string;
  /** The target the actor meant to hit before miss/scatter resolution. */
  intendedTargetId?: string;
  hitResolution?: "hit" | "miss" | "stray_hit";
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

const _abilityCatalogue = new Map<string, HarthmereAbilityCatalogueEntry>();
const _classCatalogue = new Map<string, HarthmereClassDefinition>();

export function registerHarthmereAbility(
  entry: HarthmereAbilityCatalogueEntry
) {
  _abilityCatalogue.set(entry.abilityId, entry);
}

export function getHarthmereAbility(
  abilityId: string
): HarthmereAbilityCatalogueEntry | undefined {
  return _abilityCatalogue.get(abilityId);
}

export function registerHarthmereClassDefinition(
  def: HarthmereClassDefinition
) {
  _classCatalogue.set(def.classId, def);
}

export function getHarthmereClassDefinition(
  classId: string
): HarthmereClassDefinition | undefined {
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
    Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2)
  );
}

// ---------------------------------------------------------------------------
// HARTHMERE_SERVER_LINE_OF_SIGHT (audit fix, 2026-07-13)
//
// Previously this was a stub that ALWAYS returned true, so server-side combat
// (NPC AI target selection, requiresLineOfSight abilities) could see and hit
// through walls and terrain — the "aggression from far away / through walls"
// bug class. The fix has two layers:
//   1. A hard distance cap: nothing on the server claims sight beyond
//      HARTHMERE_SERVER_LOS_MAX_DISTANCE, sampler or not.
//   2. A real voxel walk through an INJECTABLE solidity sampler. Hosts that
//      can read terrain register one via
//      registerHarthmereServerVoxelSolidSampler; pure contexts (unit tests,
//      reducers without terrain access) keep the permissive-within-distance
//      behaviour, which is still strictly tighter than the old stub.
// ---------------------------------------------------------------------------

/** True when the voxel containing (x,y,z) blocks sight. */
export type HarthmereServerVoxelSolidSampler = (
  x: number,
  y: number,
  z: number
) => boolean;

// Beyond this many blocks the server refuses to certify line of sight at all —
// bounds both NPC aggression range and the voxel-walk cost.
export const HARTHMERE_SERVER_LOS_MAX_DISTANCE = 48;

// Eye height added to both endpoints so sight is checked head-to-head rather
// than feet-to-feet (feet positions are what combat state stores).
const HARTHMERE_SERVER_LOS_EYE_HEIGHT = 1.5;

let harthmereServerVoxelSolidSampler:
  | HarthmereServerVoxelSolidSampler
  | undefined;

// Called by hosts with terrain access (e.g. the live_mode API route). Safe to
// call repeatedly — last writer wins. Pass undefined to clear (tests).
export function registerHarthmereServerVoxelSolidSampler(
  sampler: HarthmereServerVoxelSolidSampler | undefined
) {
  harthmereServerVoxelSolidSampler = sampler;
}

/**
 * Voxel-walk line of sight between two points (pure; sampler injected so it
 * is unit-testable). Samples the segment at half-block resolution — cheap,
 * deterministic, and cannot tunnel through a full-block wall. The start and
 * end voxels are skipped so an actor standing inside a doorway voxel does not
 * occlude itself.
 */
export function harthmereVoxelWalkLineOfSight(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  isSolid: HarthmereServerVoxelSolidSampler
): boolean {
  const distance = distanceBetween(from, to);
  if (!Number.isFinite(distance)) return false;
  if (distance > HARTHMERE_SERVER_LOS_MAX_DISTANCE) return false;
  if (distance < 1) return true;
  const eyeFrom = { ...from, y: from.y + HARTHMERE_SERVER_LOS_EYE_HEIGHT };
  const eyeTo = { ...to, y: to.y + HARTHMERE_SERVER_LOS_EYE_HEIGHT };
  const steps = Math.max(2, Math.ceil(distance * 2));
  const startVoxel = `${Math.floor(eyeFrom.x)}|${Math.floor(
    eyeFrom.y
  )}|${Math.floor(eyeFrom.z)}`;
  const endVoxel = `${Math.floor(eyeTo.x)}|${Math.floor(eyeTo.y)}|${Math.floor(
    eyeTo.z
  )}`;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = Math.floor(eyeFrom.x + (eyeTo.x - eyeFrom.x) * t);
    const y = Math.floor(eyeFrom.y + (eyeTo.y - eyeFrom.y) * t);
    const z = Math.floor(eyeFrom.z + (eyeTo.z - eyeFrom.z) * t);
    const voxel = `${x}|${y}|${z}`;
    if (voxel === startVoxel || voxel === endVoxel) continue;
    try {
      if (isSolid(x, y, z)) return false;
    } catch {
      // A sampler error (e.g. shard not loaded) must fail OPEN within the
      // distance cap — matching the pre-fix behaviour — rather than letting a
      // transient read error make every NPC blind.
      return true;
    }
  }
  return true;
}

/**
 * Server line-of-sight check used by NPC AI targeting and
 * requiresLineOfSight abilities. Distance-capped always; voxel-checked when a
 * terrain sampler is registered. Client claims are never consulted here.
 *
 * Exported (combat fix C-2, 2026-07-14) so the live-mode NPC-attack path can
 * decide INCOMING-damage line of sight from the same server raycast the
 * OUTGOING (player-attack) path already uses, instead of trusting the
 * client-supplied `lineOfSight` payload (which was spoofable and asymmetric).
 */
export function harthmereServerCheckLineOfSight(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): boolean {
  const distance = distanceBetween(from, to);
  if (!Number.isFinite(distance)) return false;
  if (distance > HARTHMERE_SERVER_LOS_MAX_DISTANCE) return false;
  if (!harthmereServerVoxelSolidSampler) {
    // No terrain access in this context: permissive within the distance cap
    // (strictly tighter than the old always-true stub).
    return true;
  }
  return harthmereVoxelWalkLineOfSight(
    from,
    to,
    harthmereServerVoxelSolidSampler
  );
}

// ---------------------------------------------------------------------------
// Damage formula (server-authoritative; never accept client's damage claim)
// ---------------------------------------------------------------------------

export function computeHarthmereAbilityDamage(
  ability: HarthmereAbilityCatalogueEntry,
  actorClass: HarthmereClassDefinition,
  actorLevel: number,
  varianceMultiplier = 1.0,
  attackPowerBonus = 0,
  spellPowerBonus = 0
): number {
  const attackPower =
    actorClass.baseHp * 0.1 +
    actorClass.attackPowerPerLevel * actorLevel +
    Math.max(0, attackPowerBonus);
  const spellPower =
    actorClass.baseHp * 0.1 +
    actorClass.spellPowerPerLevel * actorLevel +
    Math.max(0, spellPowerBonus);
  const raw =
    ability.baseDamage +
    ability.attackPowerScaling * attackPower +
    ability.spellPowerScaling * spellPower;
  // ±10% variance, seeded from server tick — never from client
  return Math.max(1, Math.round(raw * varianceMultiplier));
}

export function computeHarthmereAbilityHealing(
  ability: HarthmereAbilityCatalogueEntry,
  actorClass: HarthmereClassDefinition,
  actorLevel: number
): number {
  const spellPower =
    actorClass.baseHp * 0.1 + actorClass.spellPowerPerLevel * actorLevel;
  return Math.max(
    0,
    Math.round(ability.baseHealing + ability.spellPowerScaling * spellPower)
  );
}

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function combatFail(errors: string[], ...codes: string[]) {
  errors.push(...codes);
}

function resultFail(
  req: HarthmereCombatActionRequest,
  errors: string[]
): HarthmereCombatActionResult {
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
  req: HarthmereCombatActionRequest,
  overrides: Partial<HarthmereCombatActionResult>
): HarthmereCombatActionResult {
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

function actorHasRequiredWeapon(
  actor: HarthmereCombatActorSnapshot,
  ability: HarthmereAbilityCatalogueEntry
) {
  return (
    ability.requiredWeaponType === "any" ||
    actor.mainHandWeaponType === ability.requiredWeaponType ||
    actor.offHandWeaponType === ability.requiredWeaponType
  );
}

const HARTHMERE_ATTACK_MISS_CHANCE = 0.04;
const HARTHMERE_MISSED_ATTACK_STRAY_HIT_CHANCE = 0.65;

function targetWithinAbilityRange(
  actor: HarthmereCombatActorSnapshot,
  target: HarthmereCombatTargetSnapshot,
  ability: HarthmereAbilityCatalogueEntry
) {
  return distanceBetween(actor.position, target.position) <= ability.rangeUnits;
}

function canStrayAttackHitTarget(
  actor: HarthmereCombatActorSnapshot,
  candidate: HarthmereCombatTargetSnapshot,
  ability: HarthmereAbilityCatalogueEntry,
  zone: HarthmereZoneSnapshot
) {
  if (!candidate.isAlive || !candidate.isAttackable) return false;
  if (!targetWithinAbilityRange(actor, candidate, ability)) return false;
  if (
    ability.requiresLineOfSight &&
    !harthmereServerCheckLineOfSight(actor.position, candidate.position)
  ) {
    return false;
  }
  if (candidate.isPlayer) {
    if (!ability.allowedInPvP || !zone.allowPvP || zone.pvpRule === "safe_zone")
      return false;
    return isHarthmerePvPLegal(actor, candidate, zone).legal;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Attack / ability validation
// ---------------------------------------------------------------------------

function validateAbilityCast(
  req: HarthmereCombatActionRequest,
  actor: HarthmereCombatActorSnapshot,
  target: HarthmereCombatTargetSnapshot | undefined,
  zone: HarthmereZoneSnapshot,
  nearbyTargets: HarthmereCombatTargetSnapshot[] = []
): HarthmereCombatActionResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { abilityId, nowMs } = req;

  if (!abilityId) return resultFail(req, ["missing_ability_id"]);

  // --- Actor preconditions ---
  if (actor.deathState !== "alive")
    combatFail(errors, "actor_is_dead_or_downed");
  if (actor.hp <= 0) combatFail(errors, "actor_hp_is_zero");

  // --- Ability catalogue lookup (server-authoritative) ---
  const ability = getHarthmereAbility(abilityId);
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
  if (!actorHasRequiredWeapon(actor, ability)) {
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
  if (actor.resourceKind !== ability.resourceKind) {
    combatFail(errors, "resource_kind_mismatch");
  }
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
    ability.targetType === "self" &&
    req.targetId &&
    req.targetId !== actor.actorId
  ) {
    combatFail(errors, "self_ability_cannot_target_other");
  }

  if (ability.targetType !== "self" && ability.targetType !== "ground_aoe") {
    if (!target) {
      combatFail(errors, "target_required_but_missing");
    } else {
      if (!target.isAlive) combatFail(errors, "target_is_dead");
      const targetsAlly = ability.targetType === "single_ally";
      if (targetsAlly) {
        if (target.isHostile) combatFail(errors, "target_not_ally");
      } else {
        if (!target.isHostile) {
          if (target.isPlayer || !target.isAttackable) {
            combatFail(errors, "target_not_hostile");
          } else {
            warnings.push("attackable_neutral_target");
          }
        }
        if (!target.isAttackable) combatFail(errors, "target_not_attackable");
      }

      // --- PvP legality ---
      if (target.isPlayer && !targetsAlly) {
        const pvpLegality = isHarthmerePvPLegal(actor, target, zone);
        if (!pvpLegality.legal)
          combatFail(errors, `pvp_illegal:${pvpLegality.reason}`);
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
      if (!targetWithinAbilityRange(actor, target, ability)) {
        combatFail(errors, "target_out_of_range");
      }

      // --- Line of sight (server raycast) ---
      if (ability.requiresLineOfSight) {
        if (!harthmereServerCheckLineOfSight(actor.position, target.position)) {
          combatFail(errors, "no_line_of_sight");
        }
      }
    }
  }

  if (errors.length > 0) return resultFail(req, errors);

  // --- Compute server-authoritative damage/healing ---
  const classDef = getHarthmereClassDefinition(actor.classId);
  let damage = 0;
  let healing = 0;
  let resolvedTarget = target;
  let hitResolution: HarthmereCombatActionResult["hitResolution"] = "hit";

  if (classDef) {
    // Deterministic variance tied to requestId hash to be replay-safe
    const variance = 0.95 + hashStringToFloat(req.requestId) * 0.1;
    if (ability.baseDamage > 0 || ability.attackPowerScaling > 0) {
      damage = computeHarthmereAbilityDamage(
        ability,
        classDef,
        actor.level,
        variance,
        actor.attackPowerBonus,
        actor.spellPowerBonus
      );
    }
    if (ability.baseHealing > 0) {
      healing = computeHarthmereAbilityHealing(ability, classDef, actor.level);
    }
  } else {
    warnings.push("class_definition_not_found_damage_fallback");
    damage = ability.baseDamage;
  }

  const canMiss =
    damage > 0 &&
    target !== undefined &&
    ability.targetType !== "self" &&
    ability.targetType !== "single_ally" &&
    ability.targetType !== "ground_aoe";
  if (
    canMiss &&
    hashStringToFloat(`${req.requestId}:hit`) < HARTHMERE_ATTACK_MISS_CHANCE
  ) {
    const strayCandidates = nearbyTargets.filter(
      (candidate) =>
        candidate.targetId !== target.targetId &&
        canStrayAttackHitTarget(actor, candidate, ability, zone)
    );
    if (
      strayCandidates.length > 0 &&
      hashStringToFloat(`${req.requestId}:stray`) <
        HARTHMERE_MISSED_ATTACK_STRAY_HIT_CHANCE
    ) {
      resolvedTarget =
        strayCandidates[
          Math.floor(
            hashStringToFloat(`${req.requestId}:stray_target`) *
              strayCandidates.length
          )
        ] ?? strayCandidates[0];
      hitResolution = "stray_hit";
      warnings.push(
        resolvedTarget.isHostile
          ? "attack_strayed_to_wrong_target"
          : "attack_strayed_to_non_hostile_target"
      );
    } else {
      damage = 0;
      resolvedTarget = undefined;
      hitResolution = "miss";
      warnings.push("attack_missed");
    }
  }

  const killsTarget =
    resolvedTarget !== undefined &&
    damage > 0 &&
    resolvedTarget.hp - damage <= 0;
  const isPvPKill = killsTarget && (resolvedTarget?.isPlayer ?? false);

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
    targetId:
      hitResolution === "miss"
        ? undefined
        : resolvedTarget?.targetId ?? req.targetId,
    intendedTargetId: req.targetId,
    hitResolution,
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
      hitResolution,
      ...(hitResolution === "stray_hit" && resolvedTarget
        ? [`stray_target:${resolvedTarget.targetId}`]
        : []),
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

export function computeHarthmereRespecCost(respecCount: number): number {
  return Math.round(
    HARTHMERE_RESPEC_BASE_COST_GOLD *
      Math.pow(HARTHMERE_RESPEC_COST_MULTIPLIER, Math.min(respecCount, 10))
  );
}

function validateRespec(
  req: HarthmereCombatActionRequest,
  actor: HarthmereCombatActorSnapshot,
  respecCount: number,
  lastRespecAtMs: number | undefined,
  actorGold: number
): HarthmereCombatActionResult {
  const errors: string[] = [];
  const { nowMs } = req;

  // Cannot respec while dead/downed
  if (actor.deathState !== "alive")
    combatFail(errors, "cannot_respec_while_dead_or_downed");

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

  const goldCost = computeHarthmereRespecCost(respecCount);
  if (actorGold < goldCost) {
    combatFail(errors, "insufficient_gold_for_respec");
  }

  if (errors.length > 0) return resultFail(req, errors);

  return resultOk(req, {
    goldCost: -goldCost, // negative = gold deducted
    auditTags: [
      "respec",
      `cost:${goldCost}`,
      `respec_count:${respecCount + 1}`,
    ],
  });
}

// ---------------------------------------------------------------------------
// Talent purchase validation
// ---------------------------------------------------------------------------

function validateTalentPurchase(
  req: HarthmereCombatActionRequest,
  actor: HarthmereCombatActorSnapshot,
  talentPointsAvailable: number
): HarthmereCombatActionResult {
  const errors: string[] = [];
  const { talentNodeId } = req;

  if (!talentNodeId) return resultFail(req, ["missing_talent_node_id"]);

  if (actor.deathState !== "alive")
    combatFail(errors, "cannot_purchase_talent_while_dead");
  if (talentPointsAvailable < 1)
    combatFail(errors, "no_talent_points_available");
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
  req: HarthmereCombatActionRequest,
  actor: HarthmereCombatActorSnapshot
): HarthmereCombatActionResult {
  const errors: string[] = [];
  const { newLoadout } = req;

  if (!newLoadout) return resultFail(req, ["missing_new_loadout"]);
  if (actor.deathState !== "alive")
    combatFail(errors, "cannot_change_loadout_while_dead");
  if (newLoadout.length > 8) combatFail(errors, "loadout_slot_limit_exceeded");

  const seen = new Set<string>();

  // Cannot change loadout while any ability is on cooldown
  for (const [abilityId, expiresAt] of Object.entries(actor.cooldowns)) {
    if (req.nowMs < expiresAt) {
      combatFail(
        errors,
        `cannot_change_loadout_with_ability_on_cooldown:${abilityId}`
      );
    }
  }

  // Every ability in the new loadout must be in knownAbilities
  for (const abilityId of newLoadout) {
    if (seen.has(abilityId)) {
      combatFail(errors, `duplicate_ability_in_loadout:${abilityId}`);
      continue;
    }
    seen.add(abilityId);
    if (!actor.knownAbilities.includes(abilityId)) {
      combatFail(errors, `loadout_ability_not_known:${abilityId}`);
    }
    const ability = getHarthmereAbility(abilityId);
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
      if (
        ability.specRestriction.length > 0 &&
        !ability.specRestriction.includes(actor.specializationId)
      ) {
        combatFail(errors, `loadout_ability_spec_mismatch:${abilityId}`);
      }
      if (!actorHasRequiredWeapon(actor, ability)) {
        combatFail(errors, `loadout_ability_weapon_requirement:${abilityId}`);
      }
      if (
        ability.requiredTalentNode &&
        !actor.activeTalentNodes.includes(ability.requiredTalentNode)
      ) {
        combatFail(errors, `loadout_ability_talent_not_purchased:${abilityId}`);
      }
    } else {
      combatFail(errors, `loadout_ability_unknown:${abilityId}`);
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

export interface HarthmereCombatActionContext {
  actor: HarthmereCombatActorSnapshot;
  target?: HarthmereCombatTargetSnapshot;
  /** Server-known nearby entities that a missed attack can accidentally hit. */
  nearbyTargets?: HarthmereCombatTargetSnapshot[];
  zone: HarthmereZoneSnapshot;
  /** How many times this actor has respec'd */
  respecCount: number;
  /** Timestamp of last respec, or undefined if never */
  lastRespecAtMs?: number;
  /** Server-owned gold for respec cost check */
  actorGold: number;
  /** Available talent points (server-computed from level + spent) */
  talentPointsAvailable: number;
}

export function reduceHarthmereCombatAction(
  req: HarthmereCombatActionRequest,
  ctx: HarthmereCombatActionContext
): HarthmereCombatActionResult {
  switch (req.kind) {
    case "attack":
    case "ability_cast":
      return validateAbilityCast(
        req,
        ctx.actor,
        ctx.target,
        ctx.zone,
        ctx.nearbyTargets
      );

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

export function isHarthmerePvPLegal(
  actor: HarthmereCombatActorSnapshot,
  target: HarthmereCombatTargetSnapshot,
  zone: HarthmereZoneSnapshot
): { legal: boolean; reason: string } {
  if (!target.isPlayer) {
    return { legal: true, reason: "npc_target" };
  }
  if (zone.isSafeZone) {
    return { legal: false, reason: "safe_zone" };
  }
  if (target.zonePvPRule === "safe_zone") {
    return { legal: false, reason: "target_safe_zone" };
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

export function computeHarthmereXpReward(input: {
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
