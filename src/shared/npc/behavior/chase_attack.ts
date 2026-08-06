import { secondsSinceEpoch } from "@/shared/ecs/config";
import { Emote } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { Entity } from "@/shared/ecs/gen/entities";
import { CollisionHelper } from "@/shared/game/collision";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import {
  getPlayerBuffs,
  getPlayerModifiersFromBuffs,
} from "@/shared/game/players";
import { isDayTime, sunInclination } from "@/shared/game/sun_moon_position";
import type { BiomesId } from "@/shared/ids";
import { zBiomesId } from "@/shared/ids";
import { degToRad, diffAngle } from "@/shared/math/angles";
import {
  add,
  centerAndSideLengthToAABB,
  distSq,
  distSqToAABB,
  length,
  scale,
  sub,
  yaw,
} from "@/shared/math/linear";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { zVec3f } from "@/shared/math/types";
import { isSafeZone } from "@/shared/npc/behavior/common";
import {
  AStarPathfinder,
  GraphImpl,
  findNextTargetOnPath,
  pathDestination,
  repairPathDestinationIfConnected,
  stuckWhilePathfinding,
  updatePathfindingPosition,
  zPathfindingComponent,
  type Path,
} from "@/shared/npc/behavior/pathfinding";
import {
  evaluatePathDestination,
  PATHFINDING_REBUILD_COOLDOWN_SECONDS,
} from "@/shared/npc/behavior/pathfinding_geometry";
import {
  bodyVerticalGap,
  chaseApproachDecision,
  chaseRepositionYawOffset,
  evaluateChaseTargetRetention,
  horizontalDistance,
  lineOfSightEyeHeight,
  lineOfSightTargetSamples,
  targetIsRidingAttackerBody,
  withinAttackReach,
  ATTACK_VERTICAL_REACH_METERS,
  CHASE_LOST_SIGHT_GRACE_SECONDS,
  TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS,
} from "@/shared/npc/behavior/combat_geometry";
import {
  assistFactionJoinsCombat,
  decodeCreatureGroupMembership,
  evaluateGroupAlert,
  groupAlertClearReason,
  groupResponderPlan,
  shouldFleeGroupAlert,
  type CreatureGroupMembership,
  type GroupAlert,
  type GroupAlertCandidate,
  type GroupResponderPlanMember,
} from "@/shared/npc/creature_group";
import {
  creatureLevelMultipliers,
  creatureMilestoneAbilities,
  readCreatureProgression,
} from "@/shared/npc/creature_level";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import { npcGroundTraversalProfile } from "@/shared/npc/ground_locomotion";
import type {
  BehaviorChaseAttackParams,
  BehaviorRangedAttackParams,
} from "@/shared/npc/npc_types";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import {
  decayThreat,
  pickRetaliationParticipantTarget,
  pickThreatPreferredTarget,
  type RetaliationParticipantCandidate,
  type ThreatTable,
  type ThreatTargetCandidate,
} from "@/shared/npc/threat";
import { ok } from "assert";
import { z } from "zod";
import { ch1NinthWinterPhase } from "@/shared/harthmere/ch1_dungeon_encounters";
import {
  HARTHMERE_MAGIC_RELEASE_WINDUP_SECS,
  harthmereMagicChargeDurationSecs,
} from "@/shared/harthmere/magic_charge";

// If the chase target drifts more than this far (meters) from the destination
// of the cached A* path, the path is stale and must be rebuilt instead of
// walking the NPC to where the target used to be.
const CHASE_PATH_TARGET_DRIFT_METERS = 3.0;
const CHASE_PATH_TARGET_DRIFT_SQ =
  CHASE_PATH_TARGET_DRIFT_METERS * CHASE_PATH_TARGET_DRIFT_METERS;
export const NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE = 30;
export const NIGHT_MUCKER_HEX_DISENGAGE_DISTANCE = 48;
export const NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER = 1.8;
export const NIGHT_MUCKER_HEX_DAMAGE_MULTIPLIER = 1.5;
export const NIGHT_MUCKER_HEX_ATTACK_INTERVAL_MULTIPLIER = 0.55;
export const HARTHMERE_NON_BOSS_CREATURE_MELEE_FOV_CAP_DEG = 125;
// Combat pursuit tuning is cumulative, not absolute. It was first tuned to
// 1.35x, then raised by 20% to 1.62x, and the current requirement is another
// 30% on top of that already-increased pursuit speed.
export const HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER = 1.35;
export const HARTHMERE_NPC_CHASE_SPEED_STEP_UP_20 = 1.2;
export const HARTHMERE_NPC_CHASE_SPEED_STEP_UP_30 = 1.3;
/**
 * 2026-08-03 playtest: monsters are 30% slower.
 *
 * Applied as its own cumulative step rather than by editing the numbers above,
 * so the tuning history stays readable and a later change can reason about what
 * the pursuit speed was before this pass.
 */
export const HARTHMERE_NPC_SPEED_STEP_DOWN_30 = 0.7;
/** 2026-08-06 follow-up: hostile battle movement is another 10% slower. */
export const HARTHMERE_NPC_SPEED_STEP_DOWN_10 = 0.9;
export const HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN =
  HARTHMERE_NPC_SPEED_STEP_DOWN_30 * HARTHMERE_NPC_SPEED_STEP_DOWN_10;
export const HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER =
  HARTHMERE_PREVIOUS_NPC_CHASE_SPEED_MULTIPLIER *
  HARTHMERE_NPC_CHASE_SPEED_STEP_UP_20 *
  HARTHMERE_NPC_CHASE_SPEED_STEP_UP_30 *
  HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN;
// Normal player sprint animation transitions at 8 m/s. Keep Harthmere pursuit
// urgent without allowing an NPC to outrun a sprinting player on open ground.
//
// The ceiling and the floor scale with the step-down too. A cap left at its old
// value would silently absorb the reduction for exactly the fast creatures the
// change is aimed at, and a floor left at its old value would put every slow
// creature back at its previous speed.
export const HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND =
  7.6 * HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN;
export const HARTHMERE_NPC_CHASE_MIN_EFFECTIVE_METERS_PER_SECOND =
  2.25 * HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN;
const CHASE_STUCK_DIRECT_PURSUIT_SECONDS = 1.0;
const LINE_OF_SIGHT_SAMPLE_STEP_METERS = 0.45;
const LINE_OF_SIGHT_SAMPLE_BOX_METERS = 0.18;
const DEFAULT_PLAYER_EYE_HEIGHT_METERS = 1.45;
export const CH1_SOUND_HUNTER_HEARING_DISTANCE = 28;
export const CH1_SOUND_HUNTER_MIN_SPEED = 1.35;
// Anima normally revisits nearby combatants every 100ms. Allow a few delayed
// ticks to resolve a swing, but never carry a pending hit across a long stall,
// target change, lost line of sight, or a later re-entry into range.
export const NPC_MELEE_STRIKE_GRACE_SECONDS = 0.45;

// The strike of a swing lands `attackStrikeMomentSecs / attackAnimationMultiplier`
// seconds in. If that delay is >= the attack interval, every new swing restarts
// before the strike window opens, so `npc.attack()` is never called and the NPC
// flails without ever dealing damage. Clamp the delay to sit strictly inside the
// interval so a hit always lands, regardless of biscuit configuration.
/**
 * Shortest tell an ordinary enemy may present before its strike lands.
 *
 * Bosses are protected by `HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS`; ordinary
 * enemies previously had a ceiling on the strike delay but no floor, so any
 * stacked animation multiplier could compress the tell indefinitely. A night
 * hexer's 1.35x multiplier already takes an ordinary 0.72 s tell down to
 * 0.53 s, which is close to the practical limit for reading and answering a new
 * cue, and nothing structurally stopped the next multiplier from going further.
 *
 * `HARTHMERE_COMBAT_SYSTEM.md` states the requirement this enforces: "the tell
 * must be long enough to read".
 */
export const HARTHMERE_MINIMUM_ENEMY_TELL_SECS = 0.45;

export function effectiveAttackStrikeDelaySecs(params: {
  attackStrikeMomentSecs: number;
  attackAnimationMultiplier: number;
  attackIntervalSecs: number;
}): number {
  const animationMultiplier =
    params.attackAnimationMultiplier > 0 ? params.attackAnimationMultiplier : 1;
  const rawDelay =
    Math.max(0, params.attackStrikeMomentSecs) / animationMultiplier;
  if (!(params.attackIntervalSecs > 0)) {
    return rawDelay;
  }
  // Keep the strike strictly before the interval boundary (95% of it) so the
  // damage branch is always reachable. The readable floor is applied first, but
  // the interval ceiling still wins for very short intervals so the damage
  // branch cannot become unreachable.
  const readableDelay = Math.max(rawDelay, HARTHMERE_MINIMUM_ENEMY_TELL_SECS);
  return Math.min(readableDelay, params.attackIntervalSecs * 0.95);
}

export type AttackTimingDecision = "start" | "strike" | "wait" | "expire";

/**
 * Advance one bounded melee swing. A short coarse-tick grace keeps ordinary
 * scheduler jitter from dropping a visible contact, while an old pending swing
 * expires instead of landing after the target has left and re-entered range.
 */
export function attackTimingDecision(input: {
  now: number;
  attackTime?: number;
  strikeTime?: number;
  strikeDelaySecs: number;
  attackIntervalSecs: number;
  maxStrikeLatenessSecs?: number;
}): AttackTimingDecision {
  if (input.attackTime === undefined) {
    return "start";
  }
  const elapsed = input.now - input.attackTime;
  const hasStruck =
    input.strikeTime !== undefined && input.strikeTime >= input.attackTime;
  if (!hasStruck) {
    if (elapsed < input.strikeDelaySecs) {
      return "wait";
    }
    if (
      elapsed <=
      input.strikeDelaySecs +
        (input.maxStrikeLatenessSecs ?? NPC_MELEE_STRIKE_GRACE_SECONDS)
    ) {
      return "strike";
    }
    return "expire";
  }
  if (hasStruck && elapsed >= input.attackIntervalSecs) {
    return "start";
  }
  return "wait";
}

type MutableMeleeAttackState = {
  attackTime?: number;
  strikeTime?: number;
  meleeAttack?: {
    result?: "hit" | "miss" | "cancelled";
    resolvedAt?: number;
  };
};

export function hasPendingMeleeAttack(
  state: Readonly<MutableMeleeAttackState> | undefined
): boolean {
  if (!state) return false;
  if (state.meleeAttack) {
    return state.meleeAttack.result === undefined;
  }
  return (
    state.attackTime !== undefined &&
    (state.strikeTime === undefined || state.strikeTime < state.attackTime)
  );
}

/** Cancel only an unresolved swing; completed hit receipts remain available
 * long enough for the logic server to validate the matching damage event. */
export function cancelPendingMeleeAttack(
  state: MutableMeleeAttackState,
  now = secondsSinceEpoch()
): boolean {
  if (!hasPendingMeleeAttack(state)) {
    return false;
  }
  state.attackTime = undefined;
  state.strikeTime = undefined;
  if (state.meleeAttack) {
    state.meleeAttack.result = "cancelled";
    state.meleeAttack.resolvedAt = now;
  }
  return true;
}

// True when the cached path's destination no longer matches where the target is
// now (squared-distance comparison against `maxDriftSq`). An empty path is
// always considered stale.
export function chasePathTargetIsStale(
  path: Path,
  targetPosition: ReadonlyVec3,
  maxDriftSq: number
): boolean {
  const { nodes } = path;
  if (nodes.length === 0) {
    return true;
  }
  const destination = nodes[nodes.length - 1].position;
  return distSq(destination, targetPosition) > maxDriftSq;
}

export function isNightForNpcAggro(seconds: number): boolean {
  return !isDayTime(sunInclination(seconds));
}

export function isMuckerOrHexerNameForNightAggro(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward/.test(
      text
    )
  ) {
    return false;
  }
  return /\b(muckling|mucker|muckwad|hex|hexer)\b|muck[-\s]scarred|pale\s+muck/.test(
    text
  );
}

export function isHarthmereSightBoundChaserName(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward|prisoner/.test(
      text
    )
  ) {
    return false;
  }
  return (
    isMuckerOrHexerNameForNightAggro(text) ||
    /\b(bandit|outlaw|thief|brigand|rogue|ambusher|trapper|bruiser)\b/.test(
      text
    ) ||
    /\b(cow|sheep|rabbit)\b/.test(text)
  );
}

export function isChapter1SoundHunterName(name: string | undefined): boolean {
  return /\b(cistern hexer|under-ice hexer|unfinished stalker)\b/i.test(
    String(name ?? "")
  );
}

export function chapter1SoundHunterCanHear(input: {
  velocity?: ReadonlyVec3;
  threat: number;
}): boolean {
  if (input.threat > 0) return true;
  const velocity = input.velocity;
  if (!velocity) return false;
  return Math.hypot(velocity[0], velocity[2]) >= CH1_SOUND_HUNTER_MIN_SPEED;
}

export function chapter1EncounterChaseAttackParams(
  npc: SimulatedNpc,
  baseParams: BehaviorChaseAttackParams | undefined,
  fallbackParams: BehaviorChaseAttackParams
): BehaviorChaseAttackParams | undefined {
  const name = harthmereNpcCombatName(npc).toLowerCase();
  if (name.includes("gilded bull")) {
    const base = baseParams ?? fallbackParams;
    const horned =
      (npc.state.chapter1Encounter?.brokenPartIds?.length ?? 0) < 2;
    return {
      ...base,
      aggroTrigger: { kind: "proximity", distance: 24 },
      disengageDistance: Math.max(base.disengageDistance, 42),
      attackDistance: horned
        ? Math.max(base.attackDistance, 3.6)
        : Math.max(base.attackDistance, 2.4),
      attackFovDeg: horned ? 70 : 150,
      attackIntervalSecs: horned
        ? Math.max(0.8, base.attackIntervalSecs * 0.7)
        : base.attackIntervalSecs * 1.45,
      attackDamage: horned
        ? Math.max(base.attackDamage + 4, Math.ceil(base.attackDamage * 1.4))
        : Math.max(1, Math.floor(base.attackDamage * 0.65)),
    };
  }
  if (name.includes("ninth winter")) {
    const base = baseParams ?? fallbackParams;
    const phase = ch1NinthWinterPhase({
      hp: npc.hp,
      maxHp: npc.health.maxHp,
      cycleStartedAtMs: npc.state.chapter1Encounter?.cycleStartedAtMs,
      nowMs: Date.now(),
    });
    const hearthFed = npc.state.chapter1Encounter?.hearthFed === true;
    const phaseDamage = phase === "year_breaks" ? 1.25 : 1;
    const darknessDamage = hearthFed ? 1 : 1.35;
    return {
      ...base,
      aggroTrigger: { kind: "proximity", distance: 28 },
      disengageDistance: Math.max(base.disengageDistance, 50),
      attackDistance: Math.max(base.attackDistance, 3),
      attackFovDeg: Math.max(base.attackFovDeg, 180),
      attackIntervalSecs:
        phase === "year_breaks"
          ? Math.max(0.65, base.attackIntervalSecs * 0.72)
          : base.attackIntervalSecs,
      attackDamage: Math.max(
        1,
        Math.ceil(base.attackDamage * phaseDamage * darknessDamage)
      ),
    };
  }
  if (isChapter1SoundHunterName(name)) {
    const base = baseParams ?? fallbackParams;
    return {
      ...base,
      aggroTrigger: {
        kind: "proximity",
        distance: Math.max(
          base.aggroTrigger.kind === "proximity"
            ? base.aggroTrigger.distance
            : 0,
          CH1_SOUND_HUNTER_HEARING_DISTANCE
        ),
      },
      disengageDistance: Math.max(
        base.disengageDistance,
        CH1_SOUND_HUNTER_HEARING_DISTANCE + 12
      ),
    };
  }
  return undefined;
}

// Movement acceleration is intentionally narrower than sight-bound combat.
// Bandits still use native ECS/Anima targeting and line-of-sight disengagement,
// but only Muckers, Hexes, and combat-capable animals receive the Harthmere
// fight-speed boost. Protected/owned creatures must never inherit it from a
// species word in their label.
// Town NPCs are people, never combat pursuers. Their labels are matched here
// first so that no civilian can inherit the fight-speed boost through an
// incidental species/word collision in a generated name or role description.
export function isHarthmereCivilianNpcName(name: string | undefined): boolean {
  const text = String(name ?? "").toLowerCase();
  return /\b(townsperson|townspeople|townsfolk|townperson|civilian|villager|resident|walker|walking|vendor|merchant|shopkeep|shopkeeper|innkeep|innkeeper|barkeep|customer|patron|clerk|banker|teller|registrar|supplier|guide|guard|watchman|sentry|patrol|sergeant|reeve|archivist|scribe|mascot|builder|blacksmith|smith|apprentice|healer|priest|monk|elder|questgiver)\b/.test(
    text
  );
}

export function isHarthmereFightSpeedBoostName(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /\b(pet|companion|tamed|owned|mount|prisoner)\b|robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward/.test(
      text
    )
  ) {
    return false;
  }
  if (isHarthmereCivilianNpcName(text)) {
    return false;
  }
  return (
    isMuckerOrHexerNameForNightAggro(text) ||
    /\b(cow|sheep|rabbit|wolf|boar|bear|deer|duck|horse|stag|goose|chicken|pig|goat)\b/.test(
      text
    )
  );
}

/** Hostile creature labels whose authored movement receives the 30% slowdown. */
export function isHarthmereMonsterSpeedName(name: string | undefined): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /\b(pet|companion|tamed|owned|mount|prisoner)\b|robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward/.test(
      text
    ) ||
    isHarthmereCivilianNpcName(text)
  ) {
    return false;
  }
  return (
    isHarthmereFightSpeedBoostName(text) ||
    /\b(bandit|outlaw|thief|brigand|rogue|ambusher|trapper|bruiser|undead|zombie|corpse|drowned|monster|creature|boss|wyrm|stalker|gilded bull|ninth winter)\b/.test(
      text
    )
  );
}

export function isHarthmereFightSpeedBoostEligible(input: {
  name: string | undefined;
  isPlayerOwned: boolean;
  isCombatCapable: boolean;
}): boolean {
  return (
    input.isCombatCapable &&
    !input.isPlayerOwned &&
    isHarthmereFightSpeedBoostName(input.name)
  );
}

export function boundedHarthmereChaseSpeedForName(
  name: string | undefined,
  requestedSpeed: number
): number {
  if (!Number.isFinite(requestedSpeed) || requestedSpeed <= 0) {
    return 0;
  }
  return isHarthmereFightSpeedBoostName(name)
    ? Math.min(
        requestedSpeed * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
        HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND
      )
    : isHarthmereMonsterSpeedName(name)
      ? requestedSpeed * HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN
      : requestedSpeed;
}

export function shouldDropHarthmereChaseTargetForLineOfSight(
  name: string | undefined,
  hasLineOfSight: boolean
): boolean {
  return isHarthmereSightBoundChaserName(name) && !hasLineOfSight;
}

// Only the authored mixed Muck encounters participate in pack retaliation.
// The deny-list keeps player-owned pets, robots, wards, and similarly named
// utility NPCs from becoming hostile because they happened to be nearby.
export function isMixedCreatureGroupRetaliationName(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /\b(pet|companion|tamed|owned|mount)\b|robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward/.test(
      text
    )
  ) {
    return false;
  }
  return (
    isMuckerOrHexerNameForNightAggro(text) ||
    /\b(cow|sheep|rabbit)\b/.test(text)
  );
}

export function isMixedCreatureGroupRetaliationEligible(input: {
  name: string | undefined;
  hasHealth: boolean;
  hasPosition: boolean;
  hasNpcMetadata: boolean;
  isPlayerOwned: boolean;
  isLockedInPlace: boolean;
  isRobot: boolean;
  isQuestGiver: boolean;
}): boolean {
  return (
    input.hasHealth &&
    input.hasPosition &&
    input.hasNpcMetadata &&
    !input.isPlayerOwned &&
    !input.isLockedInPlace &&
    !input.isRobot &&
    !input.isQuestGiver &&
    isMixedCreatureGroupRetaliationName(input.name)
  );
}

function isMuckerOrHexerNpcForNightAggro(npc: SimulatedNpc): boolean {
  const type = npc.type as unknown as {
    name?: string;
    displayName?: string;
  };
  return isMuckerOrHexerNameForNightAggro(
    [npc.label, type.displayName, type.name].filter(Boolean).join(" ")
  );
}

function harthmereNpcCombatName(npc: SimulatedNpc): string {
  const type = npc.type as unknown as {
    name?: string;
    displayName?: string;
  };
  return [npc.label, type.displayName, type.name].filter(Boolean).join(" ");
}

export function isHarthmereFightSpeedBoostNpc(npc: SimulatedNpc): boolean {
  return isHarthmereFightSpeedBoostEligible({
    name: harthmereNpcCombatName(npc),
    isPlayerOwned: npc.playerOwned,
    // This helper is only consulted on the native chaseAttack locomotion path;
    // having reached it is the combat-capable gate.
    isCombatCapable: true,
  });
}

function isHarthmereSightBoundChaserNpc(npc: SimulatedNpc): boolean {
  return isHarthmereSightBoundChaserName(harthmereNpcCombatName(npc));
}

/**
 * HARTHMERE_CREATURE_LEVELING: applies this entity's level to the shared-type
 * combat parameters.
 *
 * Everything that scales lives in `creature_level.ts`; note what does NOT appear
 * here — `attackDistance`, `attackFovDeg`, `aggroTrigger`, and
 * `disengageDistance` are all level invariant on purpose. Growing a creature's
 * reach or aggro bubble with level makes encounters feel arbitrary and silently
 * breaks every encounter-density assumption in the seed data.
 *
 * Level 1 (every migrated creature) returns `params` unchanged.
 */
export function applyCreatureLevelToChaseAttackParams(
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams
): BehaviorChaseAttackParams {
  const level = readCreatureProgression(npc.state).level;
  if (level <= 1) {
    return params;
  }
  const multipliers = creatureLevelMultipliers(level);
  return {
    ...params,
    attackDamage: Math.max(
      params.attackDamage > 0 ? 1 : 0,
      Math.round(params.attackDamage * multipliers.damage)
    ),
    attackIntervalSecs: Math.max(
      0.4,
      params.attackIntervalSecs * multipliers.attackInterval
    ),
  };
}

/** The per-entity movement multiplier from level, capped in `creature_level.ts`. */
export function creatureLevelSpeedMultiplier(npc: SimulatedNpc): number {
  return creatureLevelMultipliers(readCreatureProgression(npc.state).level)
    .speed;
}

export function boundedHarthmereNpcChaseSpeed(
  npc: SimulatedNpc,
  requestedSpeed: number
): number {
  // Level scaling is applied to the REQUEST, before every existing cap, so a
  // high-level creature can never exceed the tuned pursuit ceiling.
  requestedSpeed = requestedSpeed * creatureLevelSpeedMultiplier(npc);
  const name = harthmereNpcCombatName(npc).toLowerCase();
  // The two authored boss overrides below bypass boundedHarthmereChaseSpeedForName
  // entirely, so they apply the 30% step-down (and scale their own bespoke caps)
  // themselves. Without this the bosses would be the only monsters unaffected.
  const slower = HARTHMERE_NPC_SPEED_COMBINED_STEP_DOWN;
  if (name.includes("gilded bull")) {
    const horned =
      (npc.state.chapter1Encounter?.brokenPartIds?.length ?? 0) < 2;
    return horned
      ? Math.min(requestedSpeed * 1.55 * slower, 8.2 * slower)
      : Math.max(0, requestedSpeed * 0.58 * slower);
  }
  if (name.includes("ninth winter")) {
    const breaking = npc.health.maxHp > 0 && npc.hp / npc.health.maxHp <= 0.3;
    return Math.min(
      requestedSpeed * (breaking ? 1.35 : 1.08) * slower,
      7.8 * slower
    );
  }
  return boundedHarthmereChaseSpeedForName(name, requestedSpeed);
}

export function nightMuckerHexUnprovokedAggroParams(
  npc: SimulatedNpc,
  baseParams: BehaviorChaseAttackParams | undefined,
  fallbackParams: BehaviorChaseAttackParams
): BehaviorChaseAttackParams | undefined {
  const type = npc.type as unknown as {
    name?: string;
    displayName?: string;
  };
  return enhancedNightMuckerHexCombatParams(
    [npc.label, type.displayName, type.name].filter(Boolean).join(" "),
    isNightForNpcAggro(secondsSinceEpoch()),
    baseParams,
    fallbackParams
  );
}

export function enhancedNightMuckerHexCombatParams(
  name: string,
  isNight: boolean,
  baseParams: BehaviorChaseAttackParams | undefined,
  fallbackParams: BehaviorChaseAttackParams
): BehaviorChaseAttackParams | undefined {
  if (!isNight || !isMuckerOrHexerNameForNightAggro(name)) {
    return undefined;
  }

  const base = baseParams ?? fallbackParams;
  const authoredAggroDistance =
    base.aggroTrigger.kind === "proximity"
      ? base.aggroTrigger.distance
      : NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE;
  const aggroDistance = Math.max(
    authoredAggroDistance,
    NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE
  );
  return {
    ...base,
    aggroTrigger: { kind: "proximity", distance: aggroDistance },
    disengageDistance: Math.max(
      base.disengageDistance,
      NIGHT_MUCKER_HEX_DISENGAGE_DISTANCE
    ),
    attackDistance: base.attackDistance + 0.75,
    attackAnimationMultiplier: base.attackAnimationMultiplier * 1.35,
    // Speeding the clip already moves its authored contact frame earlier.
    // Multiplying the strike moment as well double-accelerated damage so it
    // landed before the visible limb reached the player.
    attackStrikeMomentSecs: base.attackStrikeMomentSecs,
    attackIntervalSecs: Math.max(
      0.55,
      base.attackIntervalSecs * NIGHT_MUCKER_HEX_ATTACK_INTERVAL_MULTIPLIER
    ),
    // Night aggression may make the enemy faster to engage and more damaging,
    // but it must not widen melee into a near-rear hit. The committed cast yaw
    // remains authoritative, so circling behind during windup produces a whiff.
    attackFovDeg: Math.min(
      base.attackFovDeg,
      HARTHMERE_NON_BOSS_CREATURE_MELEE_FOV_CAP_DEG
    ),
    attackDamage: Math.max(
      base.attackDamage + 1,
      Math.ceil(base.attackDamage * NIGHT_MUCKER_HEX_DAMAGE_MULTIPLIER)
    ),
  };
}

export function nightMuckerHexMovementMultiplier(
  npc: SimulatedNpc,
  seconds = secondsSinceEpoch()
): number {
  return isMuckerOrHexerNpcForNightAggro(npc) && isNightForNpcAggro(seconds)
    ? NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER
    : 1;
}

function eyePosition(
  position: ReadonlyVec3,
  height = DEFAULT_PLAYER_EYE_HEIGHT_METERS
): Vec3 {
  // A height of exactly 0 means "this point is already the sample point" and is
  // used by the multi-sample body visibility test, which computes its own head /
  // torso / feet offsets. Any other value keeps the historical 0.4 m floor so an
  // eye is never placed inside the ground.
  if (height === 0) {
    return [position[0], position[1], position[2]];
  }
  return add(position, [0, Math.max(0.4, height), 0]);
}

export function hasTerrainLineOfSight(
  env: Environment,
  from: ReadonlyVec3,
  to: ReadonlyVec3,
  fromEyeHeight = DEFAULT_PLAYER_EYE_HEIGHT_METERS,
  toEyeHeight = DEFAULT_PLAYER_EYE_HEIGHT_METERS
): boolean {
  const fromEye = eyePosition(from, fromEyeHeight);
  const toEye = eyePosition(to, toEyeHeight);
  const delta = sub(toEye, fromEye);
  const distance = length(delta);
  if (distance <= LINE_OF_SIGHT_SAMPLE_STEP_METERS * 2) {
    return true;
  }

  const direction = scale(1 / distance, delta);
  for (
    let d = LINE_OF_SIGHT_SAMPLE_STEP_METERS;
    d < distance - LINE_OF_SIGHT_SAMPLE_STEP_METERS;
    d += LINE_OF_SIGHT_SAMPLE_STEP_METERS
  ) {
    const sample = add(fromEye, scale(d, direction));
    if (
      CollisionHelper.intersectAnyAABB(
        (id) => env.resources.get("/physics/boxes", id),
        centerAndSideLengthToAABB(sample, LINE_OF_SIGHT_SAMPLE_BOX_METERS)
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * HARTHMERE_HILL_COMBAT: visibility of a target body, not of a single eye point.
 *
 * The old test traced exactly one ray, eye to eye. On rolling ground a one-block
 * crest sits squarely on that line while leaving the target's head (or feet)
 * plainly visible, so creatures repeatedly "lost" a player they could see. We now
 * trace up to three samples — head, torso, feet — and stop at the first clear
 * line, so the common fully-visible case still costs exactly one trace.
 */
export function hasTerrainLineOfSightToBody(
  env: Environment,
  from: ReadonlyVec3,
  fromEyeHeight: number,
  to: ReadonlyVec3,
  toBodyHeight: number
): boolean {
  for (const sample of lineOfSightTargetSamples(to, toBodyHeight)) {
    // `hasTerrainLineOfSight` adds its own eye offset to `to`; pass the already
    // offset sample with a zero-height offset so the sample point is exact.
    if (hasTerrainLineOfSight(env, from, sample, fromEyeHeight, 0)) {
      return true;
    }
  }
  return false;
}

function hasLineOfSightToPlayer(
  env: Environment,
  npc: SimulatedNpc,
  player: ReadonlyEntity
): boolean {
  if (!player.position) {
    return false;
  }
  const npcEyeHeight =
    Array.isArray(npc.size) && Number.isFinite(npc.size[1])
      ? lineOfSightEyeHeight(npc.size[1])
      : DEFAULT_PLAYER_EYE_HEIGHT_METERS;
  const playerSize = player.size?.v;
  const playerBodyHeight =
    playerSize && Number.isFinite(playerSize[1]) ? playerSize[1] : 1.8;
  return hasTerrainLineOfSightToBody(
    env,
    npc.position,
    npcEyeHeight,
    player.position.v,
    playerBodyHeight
  );
}

export const zChaseAttackComponent = z.object({
  chaseAttack: z
    .object({
      attackTime: z.number().optional(),
      // The entity that the NPC is chasing.
      attackTarget: zBiomesId.optional(),
      // When did the player's attack last strike? (If this is *before* the attack
      // time, then the strike hasn't occurred yet),
      strikeTime: z.number().optional(),
      // A server-owned receipt for exactly one melee swing. The public Attack
      // emote uses the same attackTime, and the eventual damage event repeats
      // that timestamp and impactPoint so presentation and authority cannot
      // drift into separate attack cycles.
      meleeAttack: z
        .object({
          targetId: zBiomesId,
          attackTime: z.number(),
          impactTime: z.number(),
          expiresAt: z.number(),
          originPoint: zVec3f,
          impactPoint: zVec3f.optional(),
          castYaw: z.number(),
          attackDistance: z.number().nonnegative(),
          attackFovDeg: z.number().nonnegative(),
          verticalReach: z.number().nonnegative(),
          attackDamage: z.number().nonnegative(),
          lineOfSightAtImpact: z.boolean().optional(),
          result: z.enum(["hit", "miss", "cancelled"]).optional(),
          resolvedAt: z.number().optional(),
        })
        .optional(),
      rangedAttack: z
        .object({
          abilityId: z.string(),
          projectileVisualId: z.string(),
          targetId: zBiomesId,
          castTime: z.number(),
          chargeTimeSecs: z.number().nonnegative().optional(),
          releaseTime: z.number().optional(),
          impactTime: z.number(),
          cooldownUntil: z.number(),
          originPoint: zVec3f.optional(),
          aimPoint: zVec3f,
          castYaw: z.number().optional(),
          hitTargetIds: z.array(zBiomesId).optional(),
          result: z.enum(["hit", "miss"]).optional(),
          resolvedAt: z.number().optional(),
        })
        .optional(),
      rangedCooldowns: z.record(z.number()).optional(),
      rangedGlobalCooldownUntil: z.number().optional(),
      rangedSelectionCursor: z.number().int().nonnegative().optional(),
      rangedMana: z.number().nonnegative().optional(),
      rangedManaUpdatedAt: z.number().optional(),
      // Pathfinding behavior for chasing around walls/obstacles.
      pathfinding: zPathfindingComponent.optional(),
      // Briefly use direct pursuit after a path makes no progress. This lets
      // collision climbing carry an NPC over small ledges instead of instantly
      // rebuilding the same blocked path.
      pathfindingRetryTime: z.number().optional(),
      // HARTHMERE_HILL_COMBAT: last confirmed sighting of the current target and
      // where it was. These back the lost-sight grace window that replaced the
      // old "one failed line-of-sight ray clears the target" rule.
      lastSeenTargetAtSeconds: z.number().optional(),
      lastKnownTargetPosition: zVec3f.optional(),
      // Whether the current sight-bound target was visible during the latest
      // target-selection tick. Retention may keep an occluded target, but a
      // retained target must not be struck through terrain.
      targetVisible: z.boolean().optional(),
      // Rate limits full A* rebuilds while chasing a moving target, and records
      // where the last search actually routed to so tail repairs cannot compound.
      lastPathSearchAtSeconds: z.number().optional(),
      lastPathSearchDestination: zVec3f.optional(),
    })
    .default({}),
});
export type ChaseAttackComponent = z.infer<typeof zChaseAttackComponent>;

export type RangedAttackTickPhase =
  | "none"
  | "cooldown"
  | "resource"
  | "fired"
  | "charging"
  | "in_flight"
  | "hit"
  | "miss";

export interface RangedAttackTickResult {
  handled: boolean;
  phase: RangedAttackTickPhase;
}

function rangedAttackAimPoint(target: ReadonlyEntity): Vec3 | undefined {
  if (!target.position) return;
  return [
    target.position.v[0],
    target.position.v[1] + (target.size?.v[1] ?? 1.8) * 0.55,
    target.position.v[2],
  ];
}

export function rangedAttackAimHitsTarget(input: {
  aimPoint: ReadonlyVec3;
  target: ReadonlyEntity | undefined;
  hitRadius: number;
}) {
  if (!input.target?.position || (input.target.health?.hp ?? 0) <= 0) {
    return false;
  }
  const targetAabb = getAabbForEntity(input.target);
  return Boolean(
    targetAabb &&
    distSqToAABB(input.aimPoint, targetAabb) <=
      input.hitRadius * input.hitRadius
  );
}

export function rangedAttackShape(
  params: BehaviorRangedAttackParams
): NonNullable<BehaviorRangedAttackParams["attackShape"]> {
  return params.attackShape ?? "projectile";
}

export function rangedAttackHealthRatioEligible(input: {
  hp: number;
  maxHp: number;
  params: BehaviorRangedAttackParams;
}) {
  const ratio =
    input.maxHp > 0 ? Math.max(0, Math.min(1, input.hp / input.maxHp)) : 1;
  return (
    ratio >= (input.params.minimumHealthRatio ?? 0) &&
    ratio <= (input.params.maximumHealthRatio ?? 1)
  );
}

function rangedAttackHitTargets(input: {
  env: Environment;
  npc: SimulatedNpc;
  primaryTarget: ReadonlyEntity | undefined;
  params: BehaviorRangedAttackParams;
  originPoint: ReadonlyVec3;
  aimPoint: ReadonlyVec3;
  castYaw: number;
}): BiomesId[] {
  const shape = rangedAttackShape(input.params);
  if (shape === "projectile" || shape === "beam") {
    return input.primaryTarget &&
      hasLineOfSightToPlayer(input.env, input.npc, input.primaryTarget) &&
      rangedAttackAimHitsTarget({
        aimPoint: input.aimPoint,
        target: input.primaryTarget,
        hitRadius: input.params.hitRadius,
      })
      ? [input.primaryTarget.id]
      : [];
  }

  const center = shape === "ground_aoe" ? input.aimPoint : input.originPoint;
  const scanRadius =
    shape === "cone" ? input.params.attackDistance : input.params.hitRadius;
  const hits: BiomesId[] = [];
  for (const playerId of input.env.ecsMetaIndex.player_selector.scanSphere({
    center,
    radius: scanRadius,
  })) {
    const player = input.env.resources.get("/ecs/entity", playerId);
    if (!Entity.has(player, "health", "position") || player.health.hp <= 0) {
      continue;
    }
    if (!hasLineOfSightToPlayer(input.env, input.npc, player)) {
      continue;
    }
    if (shape === "cone") {
      const distance = horizontalDistance(input.originPoint, player.position.v);
      const direction = yaw(sub(player.position.v, input.originPoint));
      if (
        distance < input.params.minimumDistance ||
        distance > input.params.attackDistance ||
        Math.abs(diffAngle(direction, input.castYaw)) >
          degToRad((input.params.coneAngleDeg ?? 60) / 2)
      ) {
        continue;
      }
    } else if (
      !rangedAttackAimHitsTarget({
        aimPoint: center,
        target: player,
        hitRadius: input.params.hitRadius,
      })
    ) {
      continue;
    }
    hits.push(player.id);
  }
  return hits;
}

/**
 * Advances an optional ranged cast owned by Anima. Returning `handled: true`
 * means the cast is firing or resolving and normal melee/chase logic should
 * pause for this tick. Cooldown and close-range decisions return false so the
 * existing melee attack remains available between fireballs.
 */
export function rangedAttackTargetTick(
  env: Environment,
  npc: SimulatedNpc,
  target: ReadonlyEntity | undefined,
  params: readonly BehaviorRangedAttackParams[],
  now = secondsSinceEpoch(),
  manaConfig?: Pick<BehaviorChaseAttackParams, "maxMana" | "manaRegenPerSecond">
): RangedAttackTickResult {
  const chaseState = npc.state.chaseAttack;
  if (!chaseState) return { handled: false, phase: "none" };

  const finiteMaxMana = Number.isFinite(manaConfig?.maxMana)
    ? Math.max(0, manaConfig?.maxMana ?? 0)
    : Number.POSITIVE_INFINITY;
  const manaRegenPerSecond = Math.max(0, manaConfig?.manaRegenPerSecond ?? 0);
  const lastManaUpdate = chaseState.rangedManaUpdatedAt ?? now;
  const elapsedManaSeconds = Math.max(0, now - lastManaUpdate);
  const availableMana = Number.isFinite(finiteMaxMana)
    ? Math.min(
        finiteMaxMana,
        (chaseState.rangedMana ?? finiteMaxMana) +
          elapsedManaSeconds * manaRegenPerSecond
      )
    : Number.POSITIVE_INFINITY;
  if (Number.isFinite(finiteMaxMana)) {
    const mutable = npc.mutableState().chaseAttack!;
    mutable.rangedMana = availableMana;
    mutable.rangedManaUpdatedAt = now;
  }

  const active = chaseState.rangedAttack;
  if (active && active.result === undefined) {
    const releaseTime = active.releaseTime ?? active.castTime;
    if (now < releaseTime) {
      return { handled: true, phase: "charging" };
    }
    if (now < active.impactTime) {
      return { handled: true, phase: "in_flight" };
    }
    const castTarget =
      target?.id === active.targetId
        ? target
        : env.resources.get("/ecs/entity", active.targetId);
    const activeParams = params.find(
      ({ abilityId }) => abilityId === active.abilityId
    );
    if (!activeParams) {
      const mutable = npc.mutableState().chaseAttack!.rangedAttack!;
      mutable.result = "miss";
      mutable.resolvedAt = now;
      return { handled: true, phase: "miss" };
    }
    const hitTargetIds = rangedAttackHitTargets({
      env,
      npc,
      primaryTarget: castTarget,
      params: activeParams,
      originPoint: active.originPoint ?? npc.position,
      aimPoint: active.aimPoint,
      castYaw:
        active.castYaw ??
        yaw(sub(active.aimPoint, active.originPoint ?? npc.position)),
    });
    const mutable = npc.mutableState().chaseAttack!.rangedAttack!;
    mutable.hitTargetIds = hitTargetIds;
    mutable.result = hitTargetIds.length ? "hit" : "miss";
    mutable.resolvedAt = now;
    for (const hitTargetId of hitTargetIds) {
      const hitTarget = env.resources.get("/ecs/entity", hitTargetId);
      if (!hitTarget) {
        continue;
      }
      npc.attack(hitTarget, activeParams.attackDamage, {
        attackAbilityId: active.abilityId,
        attackTime: releaseTime,
        impactPoint: active.aimPoint,
      });
    }
    return {
      handled: true,
      phase: hitTargetIds.length ? "hit" : "miss",
    };
  }

  if (
    !target?.position ||
    !target.health ||
    target.health.hp <= 0 ||
    chaseState.targetVisible === false
  ) {
    return { handled: false, phase: "none" };
  }

  const distance = horizontalDistance(npc.position, target.position.v);
  const cooldowns = chaseState.rangedCooldowns ?? {};
  if (now < (chaseState.rangedGlobalCooldownUntil ?? 0)) {
    return { handled: false, phase: "cooldown" };
  }
  const ready = params.filter(
    (candidate) =>
      distance >= candidate.minimumDistance &&
      distance <= candidate.attackDistance &&
      rangedAttackHealthRatioEligible({
        hp: npc.hp,
        maxHp: npc.health.maxHp,
        params: candidate,
      }) &&
      (candidate.manaCost ?? 0) <= availableMana &&
      now >= (cooldowns[candidate.abilityId] ?? 0)
  );
  if (ready.length === 0) {
    const hasRangedOption = params.some(
      (candidate) =>
        distance >= candidate.minimumDistance &&
        distance <= candidate.attackDistance &&
        rangedAttackHealthRatioEligible({
          hp: npc.hp,
          maxHp: npc.health.maxHp,
          params: candidate,
        })
    );
    if (hasRangedOption) {
      const hasAffordableOption = params.some(
        (candidate) =>
          distance >= candidate.minimumDistance &&
          distance <= candidate.attackDistance &&
          rangedAttackHealthRatioEligible({
            hp: npc.hp,
            maxHp: npc.health.maxHp,
            params: candidate,
          }) &&
          (candidate.manaCost ?? 0) <= availableMana
      );
      if (!hasAffordableOption) {
        return { handled: false, phase: "resource" };
      }
      return { handled: false, phase: "cooldown" };
    }
    return { handled: false, phase: "none" };
  }
  const startIndex = (chaseState.rangedSelectionCursor ?? 0) % params.length;
  let selectedIndex = startIndex;
  let selected: BehaviorRangedAttackParams | undefined;
  for (let offset = 0; offset < params.length; offset += 1) {
    const index = (startIndex + offset) % params.length;
    const candidate = params[index];
    if (ready.includes(candidate)) {
      selected = candidate;
      selectedIndex = index;
      break;
    }
  }
  selected ??= ready[0];
  selectedIndex = Math.max(0, params.indexOf(selected));
  const aimPoint = rangedAttackAimPoint(target);
  if (!aimPoint) return { handled: false, phase: "none" };

  const castTime = now;
  // Presentation only: sizes the charge graphic. It no longer delays release,
  // which previously pushed cast-to-impact to 3.1-11.35 s and made every ranged
  // boss ability slower than the fight around it. See magic_charge.ts.
  const chargeTimeSecs = harthmereMagicChargeDurationSecs({
    damageType: selected.damageType,
    projectileVisualId: selected.projectileVisualId,
    attackDamage: selected.attackDamage,
    cooldownSecs: selected.cooldownSecs,
    attackShape: selected.attackShape,
  });
  // Windup publishes intent, then the authored shape telegraph owns the
  // readable window between release and impact. `selected.castTimeSecs` is
  // already floored per shape by HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS, so the
  // player keeps at least 1.10-1.35 s of travel to react to after the tell.
  const releaseTime = castTime + HARTHMERE_MAGIC_RELEASE_WINDUP_SECS;
  const impactTime = releaseTime + selected.castTimeSecs;
  const mutableChaseState = npc.mutableState().chaseAttack!;
  const manaCost = Math.max(0, selected.manaCost ?? 0);
  if (manaCost > 0 && Number.isFinite(finiteMaxMana)) {
    mutableChaseState.rangedMana = Math.max(0, availableMana - manaCost);
    mutableChaseState.rangedManaUpdatedAt = now;
  }
  // A ranged cast is a separate attack cycle. Clear any completed/pending
  // melee timing so returning to close range cannot land a stale swing.
  mutableChaseState.attackTime = undefined;
  mutableChaseState.strikeTime = undefined;
  cancelPendingMeleeAttack(mutableChaseState, now);
  mutableChaseState.rangedSelectionCursor =
    (selectedIndex + 1) % Math.max(1, params.length);
  const originPoint = [...npc.position] as Vec3;
  const castYaw = yaw(sub(aimPoint, originPoint));
  const shapedAimPoint =
    rangedAttackShape(selected) === "self_aoe" ? originPoint : aimPoint;
  mutableChaseState.rangedAttack = {
    abilityId: selected.abilityId,
    projectileVisualId: selected.projectileVisualId,
    targetId: target.id,
    castTime,
    chargeTimeSecs,
    releaseTime,
    impactTime,
    cooldownUntil: releaseTime + selected.cooldownSecs,
    originPoint,
    aimPoint: shapedAimPoint,
    castYaw,
  };
  mutableChaseState.rangedCooldowns = {
    ...cooldowns,
    [selected.abilityId]: releaseTime + selected.cooldownSecs,
  };
  mutableChaseState.rangedGlobalCooldownUntil =
    releaseTime + selected.sharedCooldownSecs;
  npc.mutableState().rotateTarget = castYaw;
  npc.setEmote(
    Emote.create({
      emote_type: "attack1",
      emote_start_time: castTime,
      emote_expiry_time: impactTime + 0.1,
    })
  );
  return { handled: true, phase: "fired" };
}

export function chaseAttackTargetTick(
  env: Environment,
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams
): {
  forwardSpeed: number;
} {
  const out = { forwardSpeed: 0 };

  if (!npc.state.chaseAttack?.attackTarget) {
    if (hasPendingMeleeAttack(npc.state.chaseAttack)) {
      cancelPendingMeleeAttack(npc.mutableState().chaseAttack!);
    }
    return out;
  }

  const target = env.resources.get(
    "/ecs/entity",
    npc.state.chaseAttack.attackTarget
  );
  if (params.rangedAttacks?.length) {
    const ranged = rangedAttackTargetTick(
      env,
      npc,
      target,
      params.rangedAttacks,
      secondsSinceEpoch(),
      params
    );
    if (ranged.handled) {
      return out;
    }
  }
  if (!target?.health || !target.position) {
    if (hasPendingMeleeAttack(npc.state.chaseAttack)) {
      cancelPendingMeleeAttack(npc.mutableState().chaseAttack!);
    }
    if (npc.state.chaseAttack.attackTarget !== undefined) {
      npc.mutableState().chaseAttack!.attackTarget = undefined;
    }
    return out;
  }

  // Always set our rotation target toward the next path node, not blindly at
  // the target origin. This lets NPCs chase around walls/obstacles while still
  // falling back to direct pursuit if pathfinding cannot produce a route.
  //
  // HARTHMERE_HILL_COMBAT: range is now decomposed. Horizontal distance decides
  // approach; vertical body overlap decides whether a strike plane exists. The
  // previous full-3D `length(vecToPlayer)` let four metres of hill consume a
  // 2.4 m melee budget, which is why Muckers and Hexes could not connect on the
  // Watchtower slopes even while standing next to the player.
  const targetVisible = npc.state.chaseAttack.targetVisible !== false;
  const pursuitPosition = targetVisible
    ? target.position.v
    : (npc.state.chaseAttack.lastKnownTargetPosition ?? target.position.v);
  const pathNode = nextChasePathTarget(env, npc, pursuitPosition);
  const chaseTarget = pathNode ?? pursuitPosition;
  const vecToChaseTarget = sub(chaseTarget, npc.position);
  const angleToPlayer = yaw(vecToChaseTarget);

  const horizontalToPlayer = horizontalDistance(
    target.position.v,
    npc.position
  );
  const verticalGap = bodyVerticalGap({
    attackerFeetY: npc.position[1],
    attackerHeight: Number.isFinite(npc.size?.[1]) ? npc.size[1] : 1.8,
    targetFeetY: target.position.v[1],
    targetHeight: Number.isFinite(target.size?.v[1]) ? target.size!.v[1] : 1.8,
  });
  const horizontalToPursuit = horizontalDistance(pursuitPosition, npc.position);
  const pursuitVerticalGap = bodyVerticalGap({
    attackerFeetY: npc.position[1],
    attackerHeight: Number.isFinite(npc.size?.[1]) ? npc.size[1] : 1.8,
    targetFeetY: pursuitPosition[1],
    targetHeight: Number.isFinite(target.size?.v[1]) ? target.size!.v[1] : 1.8,
  });
  const approach = chaseApproachDecision({
    horizontalDistance: horizontalToPursuit,
    verticalGap: pursuitVerticalGap,
    attackRadius: params.attackDistance,
    hasPathNode: pathNode !== undefined,
  });

  // While repositioning we deliberately face across the obstacle rather than
  // into it, so a creature stuck under a ledge circles the base looking for a
  // ramp instead of grinding its face into the cliff.
  const desiredYaw =
    approach === "reposition"
      ? angleToPlayer + chaseRepositionYawOffset(npc.id)
      : angleToPlayer;
  if (desiredYaw !== npc.state.rotateTarget) {
    npc.mutableState().rotateTarget = desiredYaw;
  }

  if (approach !== "attack" || !targetVisible) {
    if (hasPendingMeleeAttack(npc.state.chaseAttack)) {
      cancelPendingMeleeAttack(npc.mutableState().chaseAttack!);
    }
    // Reaching the last known position while the player is still occluded is a
    // hold-and-search state, not permission to swing through the wall.
    if (!targetVisible && approach === "attack") {
      return out;
    }
    const diffAngleToPlayer = Math.abs(
      diffAngle(desiredYaw, npc.orientation[1])
    );
    // Keep chasing even while turning. The old cosine multiplier hit zero
    // whenever the target was behind the NPC, which made combatants pivot in
    // place and feel broken. Use a floor so they keep closing distance while
    // rotateTargetTick catches up.
    const turnSlowdown = Math.max(
      0.35,
      Math.cos(Math.min(diffAngleToPlayer, Math.PI / 2))
    );
    out.forwardSpeed = getNpcRunSpeed(npc.type) * turnSlowdown;
    return out;
  }

  // We're in range, stop chasing!
  out.forwardSpeed = 0;

  if (
    !canAttackTarget({
      horizontalDistance: horizontalToPlayer,
      verticalGap,
      targetOrientationDiff: diffAngle(
        angleToPlayer,
        npc.state.chaseAttack.meleeAttack?.result === undefined
          ? (npc.state.chaseAttack.meleeAttack?.castYaw ?? npc.orientation[1])
          : npc.orientation[1]
      ),
      attackRadius: params.attackDistance,
      attackFovDeg: params.attackFovDeg,
      attackerPosition: npc.position,
      attackerSize: npc.size,
      targetPosition: target.position.v,
    })
  ) {
    // A wind-up is permission to hit only while the target remains in the
    // authored strike volume. Re-entering range starts a new visible swing.
    if (hasPendingMeleeAttack(npc.state.chaseAttack)) {
      cancelPendingMeleeAttack(npc.mutableState().chaseAttack!);
    }
    return out;
  }

  const now = secondsSinceEpoch();
  const strikeDelaySecs = effectiveAttackStrikeDelaySecs(params);
  const timing = attackTimingDecision({
    now,
    attackTime: npc.state.chaseAttack.attackTime,
    strikeTime: npc.state.chaseAttack.strikeTime,
    strikeDelaySecs,
    attackIntervalSecs: params.attackIntervalSecs,
    maxStrikeLatenessSecs: NPC_MELEE_STRIKE_GRACE_SECONDS,
  });
  if (timing === "start") {
    // We haven't started an attack, but we can attack, so attack.
    const attackTime = now;
    const mutable = npc.mutableState().chaseAttack!;
    mutable.attackTime = attackTime;
    mutable.strikeTime = undefined;
    mutable.meleeAttack = {
      targetId: target.id,
      attackTime,
      impactTime: attackTime + strikeDelaySecs,
      expiresAt: attackTime + strikeDelaySecs + NPC_MELEE_STRIKE_GRACE_SECONDS,
      originPoint: [...npc.position] as Vec3,
      castYaw: npc.orientation[1],
      attackDistance: params.attackDistance,
      attackFovDeg: params.attackFovDeg,
      verticalReach: ATTACK_VERTICAL_REACH_METERS,
      attackDamage: params.attackDamage,
    };

    npc.setEmote(
      Emote.create({
        emote_type: "attack1",
        emote_start_time: attackTime,
        // Keep the clip alive through contact and a short authored follow-
        // through. Damage still resolves only at impactTime above.
        emote_expiry_time: attackTime + strikeDelaySecs + 0.45,
      })
    );
  } else if (timing === "strike") {
    const stillVisible = hasLineOfSightToPlayer(env, npc, target);
    const committedCastYaw =
      npc.state.chaseAttack.meleeAttack?.castYaw ?? npc.orientation[1];
    const stillInStrikeVolume = canAttackTarget({
      horizontalDistance: horizontalToPlayer,
      verticalGap,
      targetOrientationDiff: diffAngle(angleToPlayer, committedCastYaw),
      attackRadius: params.attackDistance,
      attackFovDeg: params.attackFovDeg,
      attackerPosition: npc.position,
      attackerSize: npc.size,
      targetPosition: target.position.v,
    });
    if (!stillVisible || !stillInStrikeVolume) {
      cancelPendingMeleeAttack(npc.mutableState().chaseAttack!, now);
      return out;
    }
    const targetHeight = Number.isFinite(target.size?.v[1])
      ? target.size!.v[1]
      : 1.8;
    const impactPoint: Vec3 = [
      target.position.v[0],
      target.position.v[1] + targetHeight * 0.5,
      target.position.v[2],
    ];
    const mutable = npc.mutableState().chaseAttack!;
    mutable.strikeTime = now;
    if (mutable.meleeAttack) {
      mutable.meleeAttack.originPoint = [...npc.position] as Vec3;
      mutable.meleeAttack.impactPoint = impactPoint;
      mutable.meleeAttack.lineOfSightAtImpact = true;
      mutable.meleeAttack.result = "hit";
      mutable.meleeAttack.resolvedAt = now;
    }
    npc.attack(target, params.attackDamage, {
      attackTime: mutable.meleeAttack?.attackTime ?? mutable.attackTime ?? now,
      impactPoint,
    });
  } else if (timing === "expire") {
    const mutable = npc.mutableState().chaseAttack!;
    mutable.strikeTime = now;
    if (mutable.meleeAttack) {
      mutable.meleeAttack.result = "miss";
      mutable.meleeAttack.resolvedAt = now;
    }
  }

  return out;
}

/**
 * Resolves the next waypoint toward `targetPosition`, maintaining the cached A*
 * path.
 *
 * HARTHMERE_HILL_PATHFINDING changes three things here:
 *
 *  1. Small target drift REPAIRS the path tail instead of discarding a route that
 *     is still perfectly good. The old rule threw away every node the moment the
 *     player moved 3 m.
 *  2. Full rebuilds are rate limited, so a sprinting player cannot pin every
 *     pursuing NPC inside A* on every tick.
 *  3. Both endpoints resolve through the terrain-aware nearest-standing-voxel
 *     search. Rounding a fractional hill Y into solid rock used to make the
 *     destination unexpandable, which looked exactly like "pathfinding failed".
 */
function nextChasePathTarget(
  env: Environment,
  npc: SimulatedNpc,
  targetPosition: ReadonlyVec3
): Vec3 | undefined {
  const state = npc.mutableState().chaseAttack!;
  const now = secondsSinceEpoch();

  const rebuildPath = () => {
    state.pathfinding = undefined;
    state.lastPathSearchAtSeconds = now;
    const graph = new GraphImpl(
      npcGroundTraversalProfile(npc.size).maxStepHeight
    );
    const srcNode = graph.closestNode(npc.position, env.resources);
    const destNode = graph.closestNode(targetPosition, env.resources);
    if (!srcNode || !destNode) {
      state.lastPathSearchDestination = undefined;
      return;
    }
    // Persist the destination A* actually searched, not the raw player feet.
    // On hills those can differ by a voxel, and repair drift must be measured
    // from the graph node or the anti-compounding invariant is inaccurate.
    state.lastPathSearchDestination = [...destNode.position] as Vec3;
    const path = new AStarPathfinder(
      graph,
      srcNode,
      destNode,
      env.resources
    ).findPath();
    if (path) {
      state.pathfinding = {
        path,
        searchTime: now,
        position: npc.position as Vec3,
      };
    }
  };

  if (state.pathfinding) {
    updatePathfindingPosition(state.pathfinding, npc.position);
    if (stuckWhilePathfinding(state.pathfinding, now)) {
      state.pathfinding = undefined;
      state.pathfindingRetryTime = now + CHASE_STUCK_DIRECT_PURSUIT_SECONDS;
    }
  }

  if ((state.pathfindingRetryTime ?? 0) > now) {
    return undefined;
  }
  state.pathfindingRetryTime = undefined;

  const decision = evaluatePathDestination({
    destination: state.pathfinding
      ? pathDestination(state.pathfinding.path)
      : undefined,
    // Drift is measured from where A* actually routed to, not from the last
    // repaired tail. Otherwise repairs compound and the tail follows a sprinting
    // player forever while the route behind it still leads somewhere else.
    searchDestination: state.lastPathSearchDestination,
    targetPosition,
    maxDriftMeters: CHASE_PATH_TARGET_DRIFT_METERS,
    nowSeconds: now,
    lastSearchAtSeconds: state.lastPathSearchAtSeconds,
  });

  switch (decision.kind) {
    case "keep":
      break;
    case "repair":
      if (state.pathfinding) {
        const graph = new GraphImpl(
          npcGroundTraversalProfile(npc.size).maxStepHeight
        );
        const repairedDestination = graph.closestNode(
          decision.destination,
          env.resources
        )?.position;
        const repaired = repairedDestination
          ? repairPathDestinationIfConnected(
              state.pathfinding.path,
              repairedDestination,
              graph,
              env.resources
            )
          : undefined;
        if (repaired) {
          state.pathfinding.path = repaired;
        } else if (
          now - (state.lastPathSearchAtSeconds ?? Number.NEGATIVE_INFINITY) >=
          PATHFINDING_REBUILD_COOLDOWN_SECONDS
        ) {
          // A nearby target is not necessarily a valid tail edge. If terrain
          // rejects the repair, rebuild rather than installing a non-adjacent or
          // solid final node and steering directly through the hill.
          rebuildPath();
        }
      }
      break;
    case "wait_for_cooldown":
      // Keep walking the stale route rather than standing still; the next tick
      // past the cooldown rebuilds it.
      break;
    case "rebuild": {
      rebuildPath();
      break;
    }
  }

  return state.pathfinding
    ? findNextTargetOnPath(npc.position, state.pathfinding.path)
    : undefined;
}

/**
 * Whether a swing would connect right now.
 *
 * HARTHMERE_HILL_COMBAT: the hitbox cushion still widens the HORIZONTAL budget
 * (that is what it was always for — approximating collision capsules so bodies
 * do not have to overlap at the origin), but vertical separation is validated
 * separately against a real strike plane. Raising a single 3D radius to
 * compensate for hills would also have let creatures hit through floors.
 */
export function canAttackTarget(input: {
  horizontalDistance: number;
  verticalGap: number;
  targetOrientationDiff: number;
  attackRadius: number;
  attackFovDeg: number;
  verticalReach?: number;
  attackerPosition?: ReadonlyVec3;
  attackerSize?: ReadonlyVec3;
  targetPosition?: ReadonlyVec3;
}): boolean {
  if (
    input.attackerPosition &&
    input.attackerSize &&
    input.targetPosition &&
    targetIsRidingAttackerBody({
      attackerPosition: input.attackerPosition,
      attackerSize: input.attackerSize,
      targetPosition: input.targetPosition,
    })
  ) {
    return false;
  }
  return (
    withinAttackReach({
      horizontalDistance: input.horizontalDistance,
      verticalGap: input.verticalGap,
      attackRadius: input.attackRadius,
      hitboxCushion: TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS,
      verticalReach: input.verticalReach ?? ATTACK_VERTICAL_REACH_METERS,
    }) &&
    Math.abs(input.targetOrientationDiff) <= degToRad(input.attackFovDeg / 2)
  );
}

export function getNearestPlayer(
  env: Environment,
  position: ReadonlyVec3,
  withinRadius: number,
  isValidPlayer?: (player: ReadonlyEntity) => boolean
): BiomesId | undefined {
  // Check if we should switch to offense.
  let nearest: BiomesId | undefined;
  let nearestDistSq = Number.POSITIVE_INFINITY;
  for (const playerId of env.ecsMetaIndex.player_selector.scanSphere({
    center: position,
    radius: withinRadius,
  })) {
    const player = env.resources.get("/ecs/entity", playerId);
    if (!Entity.has(player, "health", "position")) {
      continue;
    }

    if (player.health.hp <= 0) {
      // Don't attack dead players.
      continue;
    }

    if (isValidPlayer) {
      if (!isValidPlayer(player)) {
        // Does not pass the filter.
        continue;
      }
    }

    if (
      isSafeZone(
        env.voxeloo,
        player.position.v,
        env.ecsMetaIndex,
        env.resources
      )
    ) {
      // Don't attack players in safe zones.
      continue;
    }

    const playerDistSq = distSq(player.position.v, position);
    if (playerDistSq < nearestDistSq) {
      nearestDistSq = playerDistSq;
      nearest = player.id;
    }
  }

  return nearest;
}

// HARTHMERE_NPC_RETALIATION_MEMORY:
// How long an NPC remembers it was attacked and is willing to retaliate. Once
// they actually enter a chase attack they will continue it until they lose
// their target by distance/death/peace.
export const ATTACK_MEMORY_SECONDS = 30;
// A real hit opens combat to players close enough to be part of the same
// visible encounter. This is deliberately smaller than the ordinary
// disengage leash so retaliation cannot recruit spectators across a region.
export const RETALIATION_VICINITY_RADIUS_METERS = 18;
// Keep one target long enough for a readable windup/recovery exchange, then let
// solo creatures and bosses rotate through the other nearby participants.
export const RETALIATION_TARGET_ROTATION_SECONDS = 6;

export function retaliationTargetRotationIndex(input: {
  nowSeconds: number;
  encounterOpenedAtSeconds: number;
  responderRank?: number;
}): number {
  const elapsed = Math.max(
    0,
    input.nowSeconds - input.encounterOpenedAtSeconds
  );
  return (
    Math.max(0, Math.floor(input.responderRank ?? 0)) +
    Math.floor(elapsed / RETALIATION_TARGET_ROTATION_SECONDS)
  );
}

interface RetaliationEncounterSource {
  attackerId: BiomesId;
  openedAtSeconds: number;
  direct: boolean;
  responderRank?: number;
}

// Group alerts are intentionally local. The guarded herds fit inside this
// radius, while separate spawns in the same broad Muck region do not form one
// map-wide aggro chain. The vertical limit and terrain visibility check prevent
// alerts through stacked caves, giant cliffs, and sealed structures.
export const MIXED_CREATURE_GROUP_ALERT_RADIUS = 18;
export const MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE = 10;

export interface MixedCreatureGroupAlertCandidate {
  id: BiomesId;
  position: ReadonlyVec3;
  eligible: boolean;
  hasLineOfSight: boolean;
  lastDamageSource?: { kind: string; attacker: BiomesId };
  lastDamageTime?: number;
  lastDamageAmount?: number;
}

export interface MixedCreatureGroupAlertAttacker {
  position: ReadonlyVec3;
  hp: number;
  isPlayer: boolean;
  canBeTargeted: boolean;
}

export interface MixedCreatureGroupAlertInputs {
  recipientId: BiomesId;
  recipientEligible: boolean;
  recipientPosition: ReadonlyVec3;
  candidates: ReadonlyArray<MixedCreatureGroupAlertCandidate>;
  lookupAttacker: (id: BiomesId) => MixedCreatureGroupAlertAttacker | undefined;
  now: number;
  memorySeconds: number;
  deAggroDistanceSq: number;
  alertRadius?: number;
  maxVerticalDistance?: number;
}

export function shouldDropNpcTargetAtSafeZoneBoundary(input: {
  targetId: BiomesId;
  recentDirectAttackerId: BiomesId | undefined;
  targetInSafeZone: boolean;
  activeRetaliationParticipant?: boolean;
}): boolean {
  return (
    input.targetInSafeZone &&
    input.targetId !== input.recentDirectAttackerId &&
    !input.activeRetaliationParticipant
  );
}

// Selects the player responsible for the newest valid nearby hit. This reads
// only actual Health damage metadata, so an alerted NPC cannot recursively
// alert a second ring of NPCs. A dead source remains valid long enough for a
// one-shot kill to alert its surviving group members.
export function evaluateMixedCreatureGroupRetaliationTarget(
  inputs: MixedCreatureGroupAlertInputs
): BiomesId | undefined {
  if (!inputs.recipientEligible) {
    return undefined;
  }
  const alertRadius = inputs.alertRadius ?? MIXED_CREATURE_GROUP_ALERT_RADIUS;
  const maxVerticalDistance =
    inputs.maxVerticalDistance ??
    MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE;
  const alertRadiusSq = alertRadius * alertRadius;
  let best:
    | {
        attackerId: BiomesId;
        damageTime: number;
        sourceDistanceSq: number;
        sourceId: BiomesId;
      }
    | undefined;

  for (const candidate of inputs.candidates) {
    if (
      candidate.id === inputs.recipientId ||
      !candidate.eligible ||
      !candidate.hasLineOfSight ||
      candidate.lastDamageSource?.kind !== "attack" ||
      candidate.lastDamageTime === undefined ||
      // Health.lastDamageAmount is negative for real damage. Ignore healing,
      // zero-damage contacts, and malformed events that merely claim a hit.
      !(
        candidate.lastDamageAmount !== undefined &&
        candidate.lastDamageAmount < 0
      )
    ) {
      continue;
    }

    const damageAge = inputs.now - candidate.lastDamageTime;
    if (damageAge < 0 || damageAge >= inputs.memorySeconds) {
      continue;
    }

    const dx = candidate.position[0] - inputs.recipientPosition[0];
    const dy = Math.abs(candidate.position[1] - inputs.recipientPosition[1]);
    const dz = candidate.position[2] - inputs.recipientPosition[2];
    const sourceDistanceSq = dx * dx + dz * dz;
    if (sourceDistanceSq > alertRadiusSq || dy > maxVerticalDistance) {
      continue;
    }

    const attackerId = candidate.lastDamageSource.attacker;
    const attacker = inputs.lookupAttacker(attackerId);
    if (
      !attacker?.isPlayer ||
      !attacker.canBeTargeted ||
      attacker.hp <= 0 ||
      distSq(attacker.position, inputs.recipientPosition) >=
        inputs.deAggroDistanceSq
    ) {
      continue;
    }

    if (
      !best ||
      candidate.lastDamageTime > best.damageTime ||
      (candidate.lastDamageTime === best.damageTime &&
        (sourceDistanceSq < best.sourceDistanceSq ||
          (sourceDistanceSq === best.sourceDistanceSq &&
            candidate.id < best.sourceId)))
    ) {
      best = {
        attackerId,
        damageTime: candidate.lastDamageTime,
        sourceDistanceSq,
        sourceId: candidate.id,
      };
    }
  }

  return best?.attackerId;
}

// HARTHMERE_NPC_RETALIATION_SAFE_ZONE:
// Returns the entity id of the last attacker if the NPC was hit by a player
// recently enough to retaliate, AND that attacker is still close enough to
// chase. This is shared logic between the proximity and onlyIfAttacked aggro
// paths so safe-zone hostiles can still fight back when explicitly struck.
//
// Exported as `evaluateRetaliationTarget` so the combat-AI test suite can
// exercise the decision rules without booting the full server runtime.
export interface RetaliationDecisionInputs {
  lastDamageSource?: { kind: string; attacker: BiomesId } | undefined;
  lastDamageTime?: number | undefined;
  npcPosition: ReadonlyVec3;
  deAggroDistanceSq: number;
  lookupEntity: (
    id: BiomesId
  ) => { position?: { v: ReadonlyVec3 }; health?: { hp: number } } | undefined;
  now: number;
  memorySeconds: number;
}

export function evaluateRetaliationTarget(
  inputs: RetaliationDecisionInputs
): BiomesId | undefined {
  const {
    lastDamageSource,
    lastDamageTime,
    npcPosition,
    deAggroDistanceSq,
    lookupEntity,
    now,
    memorySeconds,
  } = inputs;
  if (lastDamageSource?.kind !== "attack" || lastDamageTime === undefined) {
    return undefined;
  }
  const damageAge = now - lastDamageTime;
  if (damageAge < 0 || damageAge >= memorySeconds) {
    return undefined;
  }
  const lastAttackerId = lastDamageSource.attacker;
  const lastAttacker = lookupEntity(lastAttackerId);
  if (!lastAttacker?.position) {
    return undefined;
  }
  if ((lastAttacker.health?.hp ?? 0) <= 0) {
    return undefined;
  }
  if (distSq(lastAttacker.position.v, npcPosition) >= deAggroDistanceSq) {
    return undefined;
  }
  return lastAttackerId;
}

function recentRetaliationEncounterSource(
  npc: SimulatedNpc,
  now: number
): RetaliationEncounterSource | undefined {
  const damageSource = npc.health.lastDamageSource as
    { kind: string; attacker: BiomesId } | undefined;
  const damageTime = npc.health.lastDamageTime;
  if (damageSource?.kind !== "attack" || damageTime === undefined) {
    return undefined;
  }
  const damageAge = now - damageTime;
  if (damageAge < 0 || damageAge >= ATTACK_MEMORY_SECONDS) {
    return undefined;
  }
  // Old snapshots may omit lastDamageAmount. Preserve their direct retaliation,
  // but do not let a known heal or zero-damage contact open multiplayer combat.
  if (
    npc.health.lastDamageAmount !== undefined &&
    npc.health.lastDamageAmount >= 0
  ) {
    return undefined;
  }
  return {
    attackerId: damageSource.attacker,
    openedAtSeconds: damageTime,
    direct: true,
  };
}

function lastValidAttackerId(
  env: Environment,
  npc: SimulatedNpc,
  deAggroDistanceSq: number,
  now: number
): BiomesId | undefined {
  return evaluateRetaliationTarget({
    lastDamageSource: npc.health.lastDamageSource as any,
    lastDamageTime: npc.health.lastDamageTime,
    npcPosition: npc.position,
    deAggroDistanceSq,
    lookupEntity: (id) => env.resources.get("/ecs/entity", id) as any,
    now,
    memorySeconds: ATTACK_MEMORY_SECONDS,
  });
}

function retaliationVicinityRadius(params: BehaviorChaseAttackParams): number {
  const authoredAggroDistance =
    params.aggroTrigger.kind === "proximity"
      ? params.aggroTrigger.distance
      : RETALIATION_VICINITY_RADIUS_METERS;
  return Math.min(
    params.disengageDistance,
    Math.max(RETALIATION_VICINITY_RADIUS_METERS, authoredAggroDistance)
  );
}

function hasCommittedAttackAgainstCurrentTarget(
  npc: SimulatedNpc,
  currentTargetId: BiomesId | undefined
): boolean {
  if (!currentTargetId) {
    return false;
  }
  const chaseState = npc.state.chaseAttack;
  return Boolean(
    (chaseState?.meleeAttack?.targetId === currentTargetId &&
      chaseState.meleeAttack.result === undefined) ||
    (chaseState?.rangedAttack?.targetId === currentTargetId &&
      chaseState.rangedAttack.result === undefined)
  );
}

export function isRetaliationEncounterParticipant(input: {
  participantId: BiomesId;
  encounterNpcId: BiomesId;
  openerId: BiomesId;
  isPlayer: boolean;
  isNpc: boolean;
  npcAttackTarget?: BiomesId;
}): boolean {
  if (input.isPlayer || input.participantId === input.openerId) {
    return true;
  }
  return input.isNpc && input.npcAttackTarget === input.encounterNpcId;
}

function retaliationParticipantCandidate(
  env: Environment,
  npc: SimulatedNpc,
  entity: ReadonlyEntity | undefined,
  source: RetaliationEncounterSource,
  radiusSq: number,
  requireLineOfSight: boolean
): RetaliationParticipantCandidate | undefined {
  if (!Entity.has(entity, "health", "position") || entity.id === npc.id) {
    return undefined;
  }
  if (entity.health.hp <= 0) {
    return undefined;
  }
  const isPlayer = Entity.has(entity, "player_status");
  const isNpc = Entity.has(entity, "npc_metadata");
  const openedEncounter = entity.id === source.attackerId;
  if (
    !isRetaliationEncounterParticipant({
      participantId: entity.id,
      encounterNpcId: npc.id,
      openerId: source.attackerId,
      isPlayer,
      isNpc,
      npcAttackTarget: entity.npc_combat_state?.attack_target,
    })
  ) {
    // Nearby civilians, quest givers, livestock, and unrelated monsters do not
    // become collateral encounter participants. An NPC/escort joins only by
    // actually attacking this creature (or by opening the encounter itself).
    return undefined;
  }
  const distanceSq = distSq(entity.position.v, npc.position);
  if (distanceSq > radiusSq) {
    return undefined;
  }
  if (isPlayer) {
    const buffs = getPlayerBuffs(env.voxeloo, env.resources, entity.id);
    if (getPlayerModifiersFromBuffs(buffs)?.peace.enabled) {
      return undefined;
    }
  }
  // A real hit has already opened this bounded encounter. Safe zones still
  // suppress proactive aggro, but they must not collapse a multiplayer fight
  // back onto only the opener: every alive, non-peace player in the encounter
  // vicinity remains an eligible retaliation participant. NPCs remain limited
  // to the opener or a combatant that is actively attacking this creature.
  if (
    requireLineOfSight &&
    !openedEncounter &&
    !hasLineOfSightToPlayer(env, npc, entity)
  ) {
    return undefined;
  }
  return {
    id: entity.id,
    distanceSq,
    threat: npc.state.threat?.table?.[String(entity.id)] ?? 0,
    openedEncounter,
  };
}

function chooseRetaliationVicinityTarget(
  env: Environment,
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams,
  source: RetaliationEncounterSource,
  now: number,
  options: {
    includeBystanders: boolean;
    requireLineOfSight: boolean;
  }
): BiomesId | undefined {
  const radius = retaliationVicinityRadius(params);
  const radiusSq = radius * radius;
  const candidates = new Map<BiomesId, RetaliationParticipantCandidate>();

  if (options.includeBystanders) {
    for (const playerId of env.ecsMetaIndex.player_selector.scanSphere({
      center: npc.position,
      radius,
    })) {
      const candidate = retaliationParticipantCandidate(
        env,
        npc,
        env.resources.get("/ecs/entity", playerId),
        source,
        radiusSq,
        options.requireLineOfSight
      );
      if (candidate) {
        candidates.set(candidate.id, candidate);
      }
    }
    for (const npcId of env.ecsMetaIndex.npc_selector.scanSphere({
      center: npc.position,
      radius,
    })) {
      const candidate = retaliationParticipantCandidate(
        env,
        npc,
        env.resources.get("/ecs/entity", npcId),
        source,
        radiusSq,
        options.requireLineOfSight
      );
      if (candidate) {
        candidates.set(candidate.id, candidate);
      }
    }
  }

  // Preserve the authored direct-retaliation leash even when the opener has
  // moved beyond the smaller multiplayer vicinity bubble.
  const opener = retaliationParticipantCandidate(
    env,
    npc,
    env.resources.get("/ecs/entity", source.attackerId),
    source,
    params.disengageDistance ** 2,
    false
  );
  if (opener) {
    candidates.set(opener.id, opener);
  }

  const currentTargetId = npc.state.chaseAttack?.attackTarget;
  if (
    hasCommittedAttackAgainstCurrentTarget(npc, currentTargetId) &&
    currentTargetId !== undefined &&
    candidates.has(currentTargetId)
  ) {
    return currentTargetId;
  }

  return pickRetaliationParticipantTarget(
    [...candidates.values()],
    retaliationTargetRotationIndex({
      nowSeconds: now,
      encounterOpenedAtSeconds: source.openedAtSeconds,
      responderRank: source.responderRank,
    })
  );
}

function mixedCreatureEntityIsEligible(entity: ReadonlyEntity | undefined) {
  return isMixedCreatureGroupRetaliationEligible({
    name: entity?.label?.text,
    hasHealth: Boolean(entity?.health),
    hasPosition: Boolean(entity?.position),
    hasNpcMetadata: Boolean(entity?.npc_metadata),
    isPlayerOwned: Boolean(entity?.created_by),
    isLockedInPlace: Boolean(entity?.locked_in_place),
    isRobot: Boolean(entity?.robot_component),
    isQuestGiver: Boolean(entity?.quest_giver),
  });
}

/**
 * Membership for one NPC, preferring the runtime override in its own serialized
 * state. Written at seed time by `live_entity_ecs_seed.ts` from the authored
 * registry in `@/shared/harthmere/creature_groups`.
 */
function creatureGroupMembershipForEntity(
  entity: ReadonlyEntity | undefined
): CreatureGroupMembership | undefined {
  return decodeCreatureGroupMembership(entity?.npc_state?.data);
}

function lookupGroupAlertAttacker(env: Environment, attackerId: BiomesId) {
  const attacker = env.resources.get("/ecs/entity", attackerId);
  if (!Entity.has(attacker, "health", "position", "player_status")) {
    return undefined;
  }
  const buffs = getPlayerBuffs(env.voxeloo, env.resources, attacker.id);
  const atPeace = Boolean(getPlayerModifiersFromBuffs(buffs)?.peace.enabled);
  const inSafeZone = isSafeZone(
    env.voxeloo,
    attacker.position.v,
    env.ecsMetaIndex,
    env.resources
  );
  return {
    position: attacker.position.v,
    hp: attacker.health.hp,
    isPlayer: true,
    canBeTargeted: !atPeace && !inSafeZone,
  };
}

/**
 * HARTHMERE_CREATURE_GROUPS: the group-identity replacement for
 * `nearbyMixedCreatureGroupAttackerId`.
 *
 * Differences that matter in play:
 *   * Membership is an authored `groupId`, so two unrelated packs standing in the
 *     same clearing no longer merge into one swarm.
 *   * There is no terrain line-of-sight gate. Pack-mates know they are pack-mates;
 *     a one-block crest between them is not evidence of anything. This is the
 *     direct fix for authored groups failing to assist on hills.
 *   * Livestock never joins Muck aggression as a bystander (it flees instead);
 *     it retains its own direct retaliation, which is a separate damage event.
 *   * Responder caps and role staggering mean a six-monster pack rotates into
 *     melee instead of landing six simultaneous 70-120 damage hits on a 140 HP
 *     player.
 */
function nearbyGroupAlertAttackerId(
  env: Environment,
  npc: SimulatedNpc,
  deAggroDistanceSq: number,
  now: number
): BiomesId | undefined {
  const membership =
    (npc.state.creatureGroup as CreatureGroupMembership | undefined) ??
    creatureGroupMembershipForEntity(env.resources.get("/ecs/entity", npc.id));
  if (!membership || !assistFactionJoinsCombat(membership.assistFaction)) {
    return undefined;
  }
  if (isSafeZone(env.voxeloo, npc.position, env.ecsMetaIndex, env.resources)) {
    // Direct retaliation remains allowed in a safe zone, but bystanders never
    // join it. This prevents one accidental tutorial/town hit from turning the
    // whole protected area hostile.
    return undefined;
  }

  const candidates: GroupAlertCandidate[] = [];
  const members: GroupResponderPlanMember[] = [];
  for (const candidateId of env.ecsMetaIndex.npc_selector.scanSphere({
    center: npc.position,
    radius: membership.leashRadius,
  })) {
    const candidate = env.resources.get("/ecs/entity", candidateId);
    if (!Entity.has(candidate, "health", "position", "npc_metadata")) {
      continue;
    }
    const candidateMembership =
      candidateId === npc.id
        ? membership
        : creatureGroupMembershipForEntity(candidate);
    if (candidateMembership?.groupId !== membership.groupId) {
      continue;
    }
    members.push({
      id: candidate.id,
      role: candidateMembership.role,
      memberIndex: candidateMembership.memberIndex,
      distanceToAttacker: Number.POSITIVE_INFINITY,
      alive: candidate.health.hp > 0,
    });
    if (candidateId === npc.id) {
      continue;
    }
    candidates.push({
      id: candidate.id,
      position: candidate.position.v,
      membership: candidateMembership,
      lastDamageSource: candidate.health.lastDamageSource as
        { kind: string; attacker: BiomesId } | undefined,
      lastDamageTimeSeconds: candidate.health.lastDamageTime,
      lastDamageAmount: candidate.health.lastDamageAmount,
      alive: candidate.health.hp > 0,
    });
  }

  const alert = evaluateGroupAlert({
    recipientId: npc.id,
    recipientPosition: npc.position,
    recipientMembership: membership,
    candidates,
    lookupAttacker: (attackerId) => lookupGroupAlertAttacker(env, attackerId),
    nowSeconds: now,
    memorySeconds: ATTACK_MEMORY_SECONDS,
    deAggroDistanceSq,
  });

  const state = npc.mutableState();
  const existing = state.groupAlert as GroupAlert | undefined;
  const active = alert ?? existing;
  if (!active || active.groupId !== membership.groupId) {
    if (existing) state.groupAlert = undefined;
    return undefined;
  }

  const attacker = lookupGroupAlertAttacker(env, active.attackerId);
  const clearReason = groupAlertClearReason({
    alert: active,
    nowSeconds: now,
    attackerAlive: (attacker?.hp ?? 0) > 0,
    attackerInSafeZone: Boolean(attacker && !attacker.canBeTargeted),
    attackerDistanceFromAnchor: attacker
      ? horizontalDistance(attacker.position, active.sourcePosition)
      : Number.POSITIVE_INFINITY,
    groupLeashRadius: membership.leashRadius,
  });
  if (clearReason || !attacker) {
    state.groupAlert = undefined;
    return undefined;
  }

  // Rank responders locally. The plan is a deterministic function of quantized
  // distance plus authored member index, so every member computes the same order
  // without a shared alert bus.
  for (const member of members) {
    const entity = env.resources.get("/ecs/entity", member.id);
    member.distanceToAttacker = entity?.position
      ? horizontalDistance(entity.position.v, attacker.position)
      : Number.POSITIVE_INFINITY;
  }
  const assignment = groupResponderPlan({ members }).find(
    (candidate) => candidate.id === npc.id
  );
  const alertAgeSeconds = now - active.raisedAtSeconds;
  const committed =
    assignment !== undefined &&
    assignment.mode !== "hold" &&
    Number.isFinite(assignment.engageDelaySeconds) &&
    alertAgeSeconds >= assignment.engageDelaySeconds;

  state.groupAlert = {
    ...active,
    responderRank: assignment?.rank,
  };

  return committed ? active.attackerId : undefined;
}

function decayNpcThreat(npc: SimulatedNpc) {
  const table = npc.state.threat?.table;
  if (!table || Object.keys(table).length === 0) {
    return;
  }
  const mutableThreat = npc.mutableState().threat!;
  mutableThreat.lastDecayAt = decayThreat(
    mutableThreat.table,
    secondsSinceEpoch(),
    mutableThreat.lastDecayAt
  );
}

// Scans valid players in aggro range (alive, not at peace, not in a safe zone)
// and picks the highest-threat one, falling back to the nearest. Shares the same
// per-player filters as `getNearestPlayer` so threat-aware acquisition can never
// target a player that proximity acquisition would have rejected.
function chooseProximityTarget(
  env: Environment,
  npc: SimulatedNpc,
  aggroDistance: number,
  threatTable: ThreatTable | undefined,
  options: {
    requireLineOfSight?: boolean;
    allowNearestFallback?: boolean;
    isCandidateValid?: (player: ReadonlyEntity) => boolean;
  } = {}
): BiomesId | undefined {
  const candidates: ThreatTargetCandidate[] = [];
  for (const playerId of env.ecsMetaIndex.player_selector.scanSphere({
    center: npc.position,
    radius: aggroDistance,
  })) {
    const player = env.resources.get("/ecs/entity", playerId);
    if (!Entity.has(player, "health", "position")) {
      continue;
    }
    if (player.health.hp <= 0) {
      continue;
    }
    const buffs = getPlayerBuffs(env.voxeloo, env.resources, player.id);
    if (getPlayerModifiersFromBuffs(buffs)?.peace.enabled) {
      continue;
    }
    if (
      isSafeZone(
        env.voxeloo,
        player.position.v,
        env.ecsMetaIndex,
        env.resources
      )
    ) {
      continue;
    }
    if (
      options.requireLineOfSight &&
      !hasLineOfSightToPlayer(env, npc, player)
    ) {
      continue;
    }
    if (options.isCandidateValid && !options.isCandidateValid(player)) {
      continue;
    }
    candidates.push({
      id: player.id,
      distanceSq: distSq(player.position.v, npc.position),
      threat: threatTable?.[String(player.id)] ?? 0,
    });
  }
  const eligibleCandidates =
    options.allowNearestFallback === false
      ? candidates.filter((candidate) => candidate.threat > 0)
      : candidates;
  return pickThreatPreferredTarget(eligibleCandidates);
}

export function updateAttackTarget(
  env: Environment,
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams
) {
  if (!npc.state.chaseAttack) {
    npc.mutableState().chaseAttack = {};
    ok(npc.state.chaseAttack);
  }

  // Decay accumulated threat so aggro fades over time and the table stays
  // bounded instead of growing with every distinct attacker forever.
  decayNpcThreat(npc);

  const deAggroDistanceSq = params.disengageDistance ** 2;
  const now = secondsSinceEpoch();
  const usesNightMuckerHexAggro = isMuckerOrHexerNpcForNightAggro(npc);
  const usesSoundHunting = isChapter1SoundHunterName(
    harthmereNpcCombatName(npc)
  );
  const usesSightBoundHarthmereChase =
    !usesSoundHunting && isHarthmereSightBoundChaserNpc(npc);
  const isNight = isNightForNpcAggro(now);
  const npcInSafeZone = isSafeZone(
    env.voxeloo,
    npc.position,
    env.ecsMetaIndex,
    env.resources
  );

  // HARTHMERE_NPC_RETALIATION_SAFE_ZONE:
  // Independent of the aggro trigger kind, if the NPC was just attacked by a
  // player it must be allowed to retaliate. Previously, hostile NPCs that used
  // proximity-based aggro became completely non-responsive when they happened
  // to be inside a safe zone (within wardRange of a quest giver or a ward),
  // because the safe-zone gate cleared their target before the retaliation
  // memory check ever ran. That made the "hit a Muckling but it won't hit back"
  // bug reported from the Grove combat primer where every hostile sits next to
  // Jackie/Thom/etc. and is therefore inside ward range.
  const directEncounterSource = recentRetaliationEncounterSource(npc, now);
  const recentAttackerId = lastValidAttackerId(
    env,
    npc,
    deAggroDistanceSq,
    now
  );
  // A direct hit opens this NPC's retaliation encounter. Otherwise a member of
  // this NPC's OWN authored group can share its real recent player attacker.
  // Alert state is never itself the evidence, so propagation cannot fan out
  // into a second ring.
  const groupAttackerId = recentAttackerId
    ? undefined
    : nearbyGroupAlertAttackerId(env, npc, deAggroDistanceSq, now);
  const provokedAttackerId = recentAttackerId ?? groupAttackerId;
  const activeGroupAlert = groupAttackerId
    ? (npc.state.groupAlert as GroupAlert | undefined)
    : undefined;
  const retaliationSource =
    directEncounterSource ??
    (groupAttackerId && activeGroupAlert
      ? {
          attackerId: groupAttackerId,
          openedAtSeconds: activeGroupAlert.raisedAtSeconds,
          direct: false,
          responderRank: activeGroupAlert.responderRank,
        }
      : undefined);
  const retaliationTargetId = retaliationSource
    ? chooseRetaliationVicinityTarget(
        env,
        npc,
        params,
        retaliationSource,
        now,
        {
          // The damage event opened a bounded multiplayer encounter. Safe zones
          // still prevent proactive aggro, but do not remove nearby players from
          // retaliation after one participant starts the fight.
          includeBystanders: true,
          requireLineOfSight: usesSightBoundHarthmereChase,
        }
      )
    : undefined;
  const provokedTargetId = retaliationTargetId ?? provokedAttackerId;

  if (!provokedTargetId && npcInSafeZone) {
    // No active attacker and we're inside a safe zone — never hold a proactive
    // target. Retaliation is the deliberate exception, handled above.
    if (npc.state.chaseAttack.attackTarget) {
      const chaseState = npc.mutableState().chaseAttack!;
      cancelPendingMeleeAttack(chaseState, now);
      chaseState.attackTarget = undefined;
    }
    npc.setPublicCombatTarget(undefined);
    return;
  }

  // By default, continue to attack our current target, if we have one.
  let targetId = npc.state.chaseAttack.attackTarget;

  // Check to see if we can acquire a new target.
  if (params.aggroTrigger.kind === "onlyIfAttacked") {
    targetId = provokedTargetId ?? targetId;
  } else {
    if (provokedTargetId) {
      // HARTHMERE_NPC_RETALIATION_PROXIMITY_PRIORITY:
      // A real hit opens a bounded encounter containing every eligible nearby
      // player. The opener remains first, while group ranks and the shared
      // rotation clock distribute later exchanges across that encounter.
      targetId = provokedTargetId;
    } else if (usesSoundHunting) {
      targetId = chooseProximityTarget(
        env,
        npc,
        params.aggroTrigger.kind === "proximity"
          ? params.aggroTrigger.distance
          : CH1_SOUND_HUNTER_HEARING_DISTANCE,
        npc.state.threat?.table,
        {
          allowNearestFallback: true,
          isCandidateValid: (player) =>
            chapter1SoundHunterCanHear({
              velocity: player.rigid_body?.velocity,
              threat: npc.state.threat?.table?.[String(player.id)] ?? 0,
            }),
        }
      );
    } else if (usesNightMuckerHexAggro && !isNight) {
      // Hexes/muckers are only proactively hostile at night. During the day
      // they can still fight back through recent-attacker/threat paths, but a
      // harmless player walking by is not a valid target.
      targetId = chooseProximityTarget(
        env,
        npc,
        params.disengageDistance,
        npc.state.threat?.table,
        { allowNearestFallback: false }
      );
    } else {
      // Acquire the highest-threat valid player in aggro range (whoever has
      // dealt the most damage / taunted), falling back to the nearest one.
      targetId = chooseProximityTarget(
        env,
        npc,
        usesNightMuckerHexAggro
          ? Math.max(
              params.aggroTrigger.distance,
              NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE
            )
          : params.aggroTrigger.distance,
        npc.state.threat?.table,
        {
          allowNearestFallback: true,
          requireLineOfSight: usesNightMuckerHexAggro,
        }
      );
    }
  }

  // If we have a target, check if we should disengage.
  if (targetId) {
    const attackTarget = env.resources.get("/ecs/entity", targetId);
    const buffs = getPlayerBuffs(env.voxeloo, env.resources, targetId);
    const targetIsProvoked =
      targetId === provokedTargetId ||
      (npc.state.threat?.table?.[String(targetId)] ?? 0) > 0;

    if (!attackTarget?.position || (attackTarget.health?.hp ?? 0) <= 0) {
      targetId = undefined;
    } else if (
      distSq(attackTarget.position.v, npc.position) > deAggroDistanceSq
    ) {
      targetId = undefined;
    } else if (getPlayerModifiersFromBuffs(buffs)?.peace.enabled) {
      targetId = undefined;
    } else if (
      shouldDropNpcTargetAtSafeZoneBoundary({
        targetId,
        recentDirectAttackerId: recentAttackerId,
        activeRetaliationParticipant:
          retaliationSource !== undefined && targetId === retaliationTargetId,
        targetInSafeZone: isSafeZone(
          env.voxeloo,
          attackTarget.position.v,
          env.ecsMetaIndex,
          env.resources
        ),
      })
    ) {
      // Proactive aggro and stale remembered targets stop at the protected
      // boundary. Direct attackers and other members of a currently active,
      // bounded retaliation encounter remain valid until that encounter ends.
      targetId = undefined;
    } else if (usesNightMuckerHexAggro && !targetIsProvoked && !isNight) {
      targetId = undefined;
    } else if (usesSightBoundHarthmereChase) {
      // HARTHMERE_HILL_COMBAT: Harthmere fights stay visual and fair, but the old
      // rule dropped the target the instant a SINGLE eye-to-eye ray failed. On
      // rolling ground that produced continuous aggro flicker: crest, lose,
      // reacquire, crest, lose. A creature that has actually seen the player now
      // keeps hunting through a short grace window, then keeps hunting the last
      // known position only while it remains reachable.
      const chaseState = npc.mutableState().chaseAttack!;
      const milestone = creatureMilestoneAbilities(
        readCreatureProgression(npc.state).level
      );
      const hasLineOfSight = hasLineOfSightToPlayer(env, npc, attackTarget);
      const retention = evaluateChaseTargetRetention({
        hasLineOfSight,
        nowSeconds: now,
        lastSeenAtSeconds:
          targetId === npc.state.chaseAttack.attackTarget
            ? chaseState.lastSeenTargetAtSeconds
            : undefined,
        // Navigation reachability: a cached path means we know a route exists.
        // `undefined` (no path yet) is treated as reachable so a creature is not
        // punished for having just acquired the target.
        targetReachable: chaseState.pathfinding
          ? chaseState.pathfinding.path.nodes.length > 0
          : undefined,
        graceSeconds:
          CHASE_LOST_SIGHT_GRACE_SECONDS +
          milestone.targetRetentionBonusSeconds,
      });
      chaseState.targetVisible = hasLineOfSight;
      chaseState.lastSeenTargetAtSeconds = retention.lastSeenAtSeconds;
      if (retention.reason === "visible") {
        chaseState.lastKnownTargetPosition = [
          ...attackTarget.position.v,
        ] as Vec3;
      }
      if (!retention.retain) {
        chaseState.lastKnownTargetPosition = undefined;
        chaseState.targetVisible = undefined;
        targetId = undefined;
      }
    }
  }

  // Prey never joins an aggression alert; it flees and keeps only its own direct
  // retaliation. Clearing a proactive target here makes that explicit rather than
  // relying on the assist-faction filter alone.
  const preyMembership = npc.state.creatureGroup as
    CreatureGroupMembership | undefined;
  if (
    targetId &&
    targetId !== provokedTargetId &&
    preyMembership &&
    shouldFleeGroupAlert({
      faction: preyMembership.assistFaction,
      directlyAttacked: directEncounterSource !== undefined,
    })
  ) {
    targetId = undefined;
  }

  if (targetId !== npc.state.chaseAttack.attackTarget) {
    const chaseState = npc.mutableState().chaseAttack!;
    cancelPendingMeleeAttack(chaseState, now);
    chaseState.attackTarget = targetId;
  }
  if (!targetId) {
    const chaseState = npc.mutableState().chaseAttack!;
    chaseState.lastSeenTargetAtSeconds = undefined;
    chaseState.lastKnownTargetPosition = undefined;
    chaseState.targetVisible = undefined;
  }
  npc.setPublicCombatTarget(targetId);
}
