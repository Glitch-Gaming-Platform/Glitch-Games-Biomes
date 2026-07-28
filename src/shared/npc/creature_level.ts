// HARTHMERE_CREATURE_LEVELING
//
// A per-entity progression layer for combat-capable living NPCs: Hexes, Muckers,
// Mucklings, livestock, bandits, and combat-capable escorts. State-less legacy
// entities read as inert level 1, so adoption does not alter their base stats.
//
// The problem this replaces
// ------------------------
// `combatLevel` already existed on `HarthmereLiveEntityProductionSeed`, but it was
// static profile metadata, not progression. It selected which shared NPC *type*
// (biscuit) a creature got. Two consequences:
//
//   * Every creature of a family shares one type, so `attackDamage`,
//     `attackIntervalSecs`, `attackDistance`, `walkSpeed`, and `runSpeed` are
//     type-owned. Only `maxHp` is entity-owned. Bumping one entity's HP alone
//     produced a half-levelled creature.
//   * Emitting one biscuit per family per level would multiply the checked-in NPC
//     id manifest by the level cap, and a missing manifest entry ships a biscuit
//     with an undefined id, which fails the Bikkie overlay and blocks server boot.
//
// The model
// ---------
// Level lives on the ENTITY (in `npc_state`, Anima's own serialized state), and
// Anima derives effective combat parameters at runtime from
// `shared base profile x level multipliers`. No new NPC types, no manifest churn.
//
// The migration is deliberately inert: every existing creature becomes level 1
// with `levelSource: "migration"`, and level 1 multiplies every stat by exactly
// 1.0. Reinterpreting today's `combatLevel: 4` Hexes as *new* level 4 would buff
// them a second time, since their production HP and damage already encode that
// level.
//
// Balance guard rails, chosen against the measured native numbers (a level 3 Hex
// already deals ~90 damage into a 140 HP player):
//
//   * HP scales fastest (+14%/level) — more time to kill, not more lethality.
//   * Damage scales slowly (+7%/level) and is the only lethality dial.
//   * Speed barely moves (+1.5%/level, hard capped at +12%) so a level 20 Mucker
//     can never outrun a sprinting player.
//   * Attack cadence only improves at milestones and never below 80% of base.
//   * Size, attack reach, aggro radius, and leash distance NEVER scale. Difficulty
//     above the milestones comes from AI quality, not from geometry.

import type { BiomesId } from "@/shared/ids";
import { z } from "zod";

export const HARTHMERE_CREATURE_LEVEL_VERSION =
  "harthmere-creature-level-v1" as const;

/**
 * Bumped whenever the meaning of a base profile changes such that stored levels
 * must be re-derived. Persisted alongside the level so a future rebalance can
 * detect stale progression instead of silently compounding.
 */
export const CREATURE_BASE_PROFILE_VERSION = 1;

export const CREATURE_MIN_LEVEL = 1;
export const CREATURE_MAX_LEVEL = 60;

export const CREATURE_LEVEL_SCALING = {
  /** +14% max HP per level above 1. */
  hpPerLevel: 0.14,
  /** +7% outgoing damage per level above 1. */
  damagePerLevel: 0.07,
  /** +1.5% movement per level above 1... */
  speedPerLevel: 0.015,
  /** ...hard capped here, so pursuit speed stays a tuning decision, not a curve. */
  maxSpeedMultiplier: 1.12,
  /** Attack interval improves only every N levels. */
  attackIntervalMilestoneEvery: 10,
  /** Multiplier applied once per milestone reached. */
  attackIntervalMilestoneFactor: 0.93,
  /** Never swing faster than this fraction of the authored interval. */
  minAttackIntervalMultiplier: 0.8,
  /** +18% kill XP per level... */
  xpPerLevel: 0.18,
  /** ...with diminishing returns capped at 3x so farming a high-level pack is not exponential. */
  maxXpMultiplier: 3,
  /** Reserved drop-scaling curve; not installed in the drop transaction yet. */
  dropBonusEveryLevels: 5,
  /** ...capped, for the same reason. */
  maxDropBonus: 3,
} as const;

/** Levels at which a creature gains an AI capability rather than a bigger number. */
export const CREATURE_MILESTONE_LEVELS = {
  /** Longer lost-sight retention: it remembers where you went. */
  targetRetention: 5,
  /** Reserved flag for level-gated authored group tactics. */
  coordinated: 10,
  /** Flat incoming-damage resistance. */
  resistance: 20,
  /** Reserved flag for encounter-owned family special moves. */
  specialMove: 30,
} as const;

export const CREATURE_MILESTONE_RETENTION_BONUS_SECONDS = 1.25;
export const CREATURE_MILESTONE_RESISTANCE_FRACTION = 0.1;

export type CreatureLevelSource =
  /** Existing world entity brought forward at level 1 with stats untouched. */
  | "migration"
  /** Level chosen by the region / encounter tier the creature spawned in. */
  | "region_tier"
  /** Level written explicitly by authored content (road groups, bosses). */
  | "authored"
  /** Level earned through persisted XP (named and escort NPCs). */
  | "earned";

export const zCreatureProgressionComponent = z.object({
  creatureProgression: z
    .object({
      level: z.number().int().min(CREATURE_MIN_LEVEL).max(CREATURE_MAX_LEVEL),
      baseProfileVersion: z.number().int().nonnegative(),
      levelSource: z.enum(["migration", "region_tier", "authored", "earned"]),
      /** Only meaningful for `earned`; ambient creatures never accumulate. */
      xp: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type CreatureProgressionComponent = z.infer<
  typeof zCreatureProgressionComponent
>;

export interface CreatureProgression {
  level: number;
  baseProfileVersion: number;
  levelSource: CreatureLevelSource;
  xp: number;
}

export function normalizeCreatureLevel(level: number | undefined): number {
  if (!Number.isFinite(level)) {
    return CREATURE_MIN_LEVEL;
  }
  return Math.max(
    CREATURE_MIN_LEVEL,
    Math.min(CREATURE_MAX_LEVEL, Math.trunc(level as number))
  );
}

/**
 * Reads progression off NPC state, defaulting to the inert level 1 migration
 * record. Callers never have to null-check a level.
 */
export function readCreatureProgression(
  state: { creatureProgression?: Partial<CreatureProgression> } | undefined
): CreatureProgression {
  const raw = state?.creatureProgression;
  return {
    level: normalizeCreatureLevel(raw?.level),
    baseProfileVersion: Number.isFinite(raw?.baseProfileVersion)
      ? Math.max(0, Math.trunc(raw!.baseProfileVersion as number))
      : CREATURE_BASE_PROFILE_VERSION,
    levelSource: (raw?.levelSource as CreatureLevelSource) ?? "migration",
    xp: Math.max(0, Number(raw?.xp ?? 0) || 0),
  };
}

export interface CreatureLevelMultipliers {
  hp: number;
  damage: number;
  speed: number;
  attackInterval: number;
  xp: number;
  dropBonus: number;
}

export function creatureLevelMultipliers(
  level: number
): CreatureLevelMultipliers {
  const effective = normalizeCreatureLevel(level);
  const above = effective - CREATURE_MIN_LEVEL;
  const milestones = Math.floor(
    effective / CREATURE_LEVEL_SCALING.attackIntervalMilestoneEvery
  );
  return {
    hp: 1 + CREATURE_LEVEL_SCALING.hpPerLevel * above,
    damage: 1 + CREATURE_LEVEL_SCALING.damagePerLevel * above,
    speed: Math.min(
      CREATURE_LEVEL_SCALING.maxSpeedMultiplier,
      1 + CREATURE_LEVEL_SCALING.speedPerLevel * above
    ),
    attackInterval: Math.max(
      CREATURE_LEVEL_SCALING.minAttackIntervalMultiplier,
      Math.pow(CREATURE_LEVEL_SCALING.attackIntervalMilestoneFactor, milestones)
    ),
    xp: Math.min(
      CREATURE_LEVEL_SCALING.maxXpMultiplier,
      1 + CREATURE_LEVEL_SCALING.xpPerLevel * above
    ),
    dropBonus: Math.min(
      CREATURE_LEVEL_SCALING.maxDropBonus,
      Math.floor(above / CREATURE_LEVEL_SCALING.dropBonusEveryLevels)
    ),
  };
}

export interface CreatureMilestoneAbilities {
  /** Extra seconds of lost-sight target retention. */
  targetRetentionBonusSeconds: number;
  /** Reserved flag for level-gated authored group tactics. */
  coordinated: boolean;
  /** Fraction of incoming damage ignored, 0..1. */
  resistance: number;
  /** Reserved flag for an encounter-owned family special move. */
  specialMove: boolean;
}

export function creatureMilestoneAbilities(
  level: number
): CreatureMilestoneAbilities {
  const effective = normalizeCreatureLevel(level);
  return {
    targetRetentionBonusSeconds:
      effective >= CREATURE_MILESTONE_LEVELS.targetRetention
        ? CREATURE_MILESTONE_RETENTION_BONUS_SECONDS
        : 0,
    coordinated: effective >= CREATURE_MILESTONE_LEVELS.coordinated,
    resistance:
      effective >= CREATURE_MILESTONE_LEVELS.resistance
        ? CREATURE_MILESTONE_RESISTANCE_FRACTION
        : 0,
    specialMove: effective >= CREATURE_MILESTONE_LEVELS.specialMove,
  };
}

/**
 * The subset of a shared NPC profile that scales with level. Everything absent
 * from this shape — attack reach, FOV, aggro radius, disengage distance, body
 * size — is deliberately level invariant.
 */
export interface ScalableCreatureCombatStats {
  maxHp: number;
  attackDamage: number;
  attackIntervalSecs: number;
  walkSpeed: number;
  runSpeed: number;
  killXp: number;
}

export function scaleCreatureCombatStats(
  base: ScalableCreatureCombatStats,
  level: number
): ScalableCreatureCombatStats {
  const multipliers = creatureLevelMultipliers(level);
  return {
    maxHp: Math.max(1, Math.round(base.maxHp * multipliers.hp)),
    attackDamage: Math.max(
      base.attackDamage > 0 ? 1 : 0,
      Math.round(base.attackDamage * multipliers.damage)
    ),
    attackIntervalSecs: Math.max(
      0.4,
      base.attackIntervalSecs * multipliers.attackInterval
    ),
    walkSpeed: base.walkSpeed * multipliers.speed,
    runSpeed: base.runSpeed * multipliers.speed,
    killXp: Math.max(1, Math.round(base.killXp * multipliers.xp)),
  };
}

/** Guaranteed drop counts after the level drop bonus, preserving item order. */
export function scaleCreatureDropCounts(
  drops: ReadonlyArray<{ itemId: string; count: number }>,
  level: number
): Array<{ itemId: string; count: number }> {
  const bonus = creatureLevelMultipliers(level).dropBonus;
  return drops.map((drop) => ({
    itemId: drop.itemId,
    count: Math.max(1, Math.trunc(drop.count) + bonus),
  }));
}

/**
 * XP a creature must bank to reach `level + 1`. Only consulted for `earned`
 * progression (named companions, escorts); ambient creatures are assigned a level
 * and never advance.
 */
export function creatureXpForNextLevel(level: number): number {
  const effective = normalizeCreatureLevel(level);
  return Math.max(60, Math.round(60 * Math.pow(effective, 1.35)));
}

export function awardCreatureXp(
  progression: CreatureProgression,
  xpDelta: number
): CreatureProgression {
  if (progression.levelSource !== "earned") {
    // Ambient and authored creatures have a fixed level by design; silently
    // banking XP they can never spend would be misleading state.
    return progression;
  }
  let level = normalizeCreatureLevel(progression.level);
  let xp = progression.xp + Math.max(0, Math.trunc(xpDelta));
  while (level < CREATURE_MAX_LEVEL && xp >= creatureXpForNextLevel(level)) {
    xp -= creatureXpForNextLevel(level);
    level += 1;
  }
  return { ...progression, level, xp };
}

/**
 * Level assignment is deliberately separate from level scaling, so a region
 * retune never rewrites the scaling curve and vice versa.
 */
export interface CreatureLevelAssignment {
  level: number;
  levelSource: CreatureLevelSource;
}

export function assignCreatureLevel(input: {
  /** Explicit authored level, e.g. a road group or a boss. */
  authoredLevel?: number;
  /** Tier of the region / encounter the creature spawned into. */
  regionTierLevel?: number;
  /** True for a future named-companion/escort XP source. */
  earnsXp?: boolean;
}): CreatureLevelAssignment {
  if (input.earnsXp) {
    return {
      level: normalizeCreatureLevel(input.authoredLevel ?? CREATURE_MIN_LEVEL),
      levelSource: "earned",
    };
  }
  if (Number.isFinite(input.authoredLevel)) {
    return {
      level: normalizeCreatureLevel(input.authoredLevel),
      levelSource: "authored",
    };
  }
  if (Number.isFinite(input.regionTierLevel)) {
    return {
      level: normalizeCreatureLevel(input.regionTierLevel),
      levelSource: "region_tier",
    };
  }
  return { level: CREATURE_MIN_LEVEL, levelSource: "migration" };
}

/**
 * The record written into `npc_state.creatureProgression` when an entity is
 * seeded or reconciled. `migrate: true` (the default for existing worlds)
 * produces the inert level 1 record described at the top of this file.
 */
export function buildCreatureProgression(input: {
  assignment?: CreatureLevelAssignment;
  migrate?: boolean;
}): CreatureProgression {
  if (input.migrate || !input.assignment) {
    return {
      level: CREATURE_MIN_LEVEL,
      baseProfileVersion: CREATURE_BASE_PROFILE_VERSION,
      levelSource: "migration",
      xp: 0,
    };
  }
  return {
    level: normalizeCreatureLevel(input.assignment.level),
    baseProfileVersion: CREATURE_BASE_PROFILE_VERSION,
    levelSource: input.assignment.levelSource,
    xp: 0,
  };
}

/**
 * Incoming damage after the level-20 resistance milestone. Kept here rather than
 * in the native combat mitigation chain so the milestone stays a property of the
 * creature's level, not of the attacker's weapon.
 */
export function applyCreatureLevelResistance(
  rawDamage: number,
  level: number
): number {
  const { resistance } = creatureMilestoneAbilities(level);
  if (!(rawDamage > 0) || resistance <= 0) {
    return Math.max(0, rawDamage);
  }
  return Math.max(1, Math.round(rawDamage * (1 - resistance)));
}

/** Convenience for logging / telemetry that must name a creature's tier. */
export function describeCreatureLevel(
  entityId: BiomesId,
  progression: CreatureProgression
): string {
  return `${entityId}@L${progression.level}(${progression.levelSource})`;
}
