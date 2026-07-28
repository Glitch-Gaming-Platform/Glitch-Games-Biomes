// HARTHMERE_HILL_COMBAT_GEOMETRY
//
// Why this module exists
// ----------------------
// The July 27 2026 fight HAR (player at ~[351.44, 35, -404.28], Watchtower Muck,
// creature feet Y ranging 31..48 within 45 m) showed Hexes and Muckers failing to
// engage reliably on rolling ground while still being able to kill the player
// (140 -> 4 -> 0 HP inside 30 seconds). Three separate geometry defects combined:
//
//   1. Melee range was measured origin-to-origin in FULL 3D. A Mucker standing
//      four metres up a ledge is horizontally adjacent but reads as 4+ m away, so
//      its 2.4 m `attackDistance` never opens. Vertical separation was silently
//      eating the whole horizontal reach budget.
//   2. Line of sight was a single eye-to-eye ray. One block of hill crest between
//      two creatures of different heights fails that ray even though the player is
//      plainly visible over/under it.
//   3. A single failed LOS sample dropped the target immediately, producing the
//      aggro -> reacquire -> aggro flicker that reads as "they can't find me".
//
// Everything here is pure and terrain-free so the rules can be unit-tested without
// booting Anima, voxeloo, or a resource graph. `chase_attack.ts` supplies the
// terrain probe; this module owns the decision.
//
// Deliberate non-goal: none of this raises damage, attack reach, or aggro radius.
// Native Harthmere attacks already sit at 70-120 damage against a 140 HP player,
// so making engagement *reliable* is a difficulty increase on its own. See
// `docs/harthmere/HARTHMERE_HILL_COMBAT_AND_GROUPS.md`.

import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

export const HARTHMERE_HILL_COMBAT_GEOMETRY_VERSION =
  "harthmere-hill-combat-geometry-v1" as const;

/**
 * How far above or below its own body an NPC may still land a melee strike.
 * One metre is a little under one voxel of separation, so a creature standing on
 * a single step or a shallow slope can hit, while a creature three blocks up a
 * cliff must path down first.
 */
export const ATTACK_VERTICAL_REACH_METERS = 1.0;

/**
 * Approximates the target's collision capsule so combatants do not need
 * origin-to-origin overlap. Retained from the previous 3D implementation, but it
 * now widens only the HORIZONTAL budget, which is what it was always meant for.
 */
export const TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS = 0.55;

/**
 * Seconds an engaged NPC keeps its target after terrain breaks line of sight.
 * Sized from the HAR: a Mucker crossing a one-block crest at ~4.5 m/s is hidden
 * for well under a second, so 1.75 s covers ordinary rolling ground without
 * letting a creature tail a player through a hillside.
 */
export const CHASE_LOST_SIGHT_GRACE_SECONDS = 1.75;

/**
 * Additional seconds an NPC may hunt the last known position after the grace
 * window, and only while navigation still reports the target reachable. This is
 * the "grace period AND a failed reachability check" half of the disengage rule:
 * an unreachable target is dropped as soon as grace expires.
 */
export const CHASE_LOST_SIGHT_HUNT_SECONDS = 2.5;

/**
 * Body-height fractions sampled when testing visibility of a target. Feet, torso,
 * and head. A crest that hides the torso line usually leaves the head or the feet
 * exposed, which is exactly the case the old single ray got wrong.
 */
export const LINE_OF_SIGHT_TARGET_HEIGHT_FRACTIONS = [0.9, 0.55, 0.15] as const;

/** Eye height fraction used for the observing NPC (unchanged behaviour). */
export const LINE_OF_SIGHT_EYE_HEIGHT_FRACTION = 0.72;

export function horizontalDistance(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function horizontalDistanceSq(
  a: ReadonlyVec3,
  b: ReadonlyVec3
): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

/**
 * Vertical separation between two feet-anchored bodies, in metres.
 *
 * Returns 0 whenever the two bodies overlap on the Y axis at all — that is the
 * "reachable strike plane" the audit asked for. Only when the spans are fully
 * disjoint does this report the gap between them, so a tall Hex standing one step
 * below a player still measures 0 rather than the difference of its feet.
 */
export function bodyVerticalGap(input: {
  attackerFeetY: number;
  attackerHeight: number;
  targetFeetY: number;
  targetHeight: number;
}): number {
  const attackerHeight = Math.max(0, input.attackerHeight);
  const targetHeight = Math.max(0, input.targetHeight);
  const lowestTop = Math.min(
    input.attackerFeetY + attackerHeight,
    input.targetFeetY + targetHeight
  );
  const highestBottom = Math.max(input.attackerFeetY, input.targetFeetY);
  return Math.max(0, highestBottom - lowestTop);
}

export interface AttackReachInput {
  horizontalDistance: number;
  verticalGap: number;
  attackRadius: number;
  /** Defaults to the shared hitbox cushion; pass 0 to test raw reach. */
  hitboxCushion?: number;
  /** Defaults to ATTACK_VERTICAL_REACH_METERS. */
  verticalReach?: number;
}

export function effectiveHorizontalAttackRadius(input: AttackReachInput) {
  return (
    Math.max(0, input.attackRadius) +
    Math.max(0, input.hitboxCushion ?? TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS)
  );
}

/** True when the target sits inside the horizontal reach budget. */
export function withinHorizontalAttackReach(input: AttackReachInput): boolean {
  return input.horizontalDistance <= effectiveHorizontalAttackRadius(input);
}

/** True when the two bodies share a strikeable vertical plane. */
export function withinVerticalAttackReach(input: AttackReachInput): boolean {
  return (
    input.verticalGap <= (input.verticalReach ?? ATTACK_VERTICAL_REACH_METERS)
  );
}

/**
 * The replacement for the old `targetDistance <= attackRadius + cushion` test.
 * Horizontal approach and vertical overlap are now validated independently, so a
 * hill can no longer consume an NPC's entire melee budget.
 */
export function withinAttackReach(input: AttackReachInput): boolean {
  return withinHorizontalAttackReach(input) && withinVerticalAttackReach(input);
}

export type ChaseApproachKind = "attack" | "close" | "reposition";

export interface ChaseApproachInput extends AttackReachInput {
  /** True when pathfinding produced a next node to walk toward. */
  hasPathNode: boolean;
}

/**
 * What the chase tick should do this frame.
 *
 * - `attack`  — horizontally and vertically in range; stop and swing.
 * - `close`   — walk toward the current chase target (path node or the target).
 * - `reposition` — horizontally on top of / underneath the target but vertically
 *   unreachable, with no route. Walking straight ahead grinds into the cliff
 *   face, so the caller strafes around the base instead of stalling. This is the
 *   case that made Muckers look like they had "given up" directly below a player
 *   standing on a ledge.
 */
export function chaseApproachDecision(
  input: ChaseApproachInput
): ChaseApproachKind {
  const horizontal = withinHorizontalAttackReach(input);
  const vertical = withinVerticalAttackReach(input);
  if (horizontal && vertical) {
    return "attack";
  }
  if (horizontal && !vertical && !input.hasPathNode) {
    return "reposition";
  }
  return "close";
}

/** Radians added to the facing yaw while repositioning around an obstacle. */
export const CHASE_REPOSITION_YAW_OFFSET_RADIANS = Math.PI / 2;

/**
 * Deterministic strafe direction so an NPC circles one way instead of jittering
 * left/right between ticks. Keyed on the entity id, which is stable.
 */
export function chaseRepositionYawOffset(entityId: number | bigint): number {
  const parity = Number(BigInt(entityId) & 1n);
  return parity === 0
    ? CHASE_REPOSITION_YAW_OFFSET_RADIANS
    : -CHASE_REPOSITION_YAW_OFFSET_RADIANS;
}

/**
 * The three sample points on a target body, tallest first. Callers raycast these
 * in order and stop at the first clear line, so the common case (target fully
 * visible) still costs exactly one terrain trace.
 */
export function lineOfSightTargetSamples(
  position: ReadonlyVec3,
  bodyHeight: number
): Vec3[] {
  const height = Number.isFinite(bodyHeight) ? Math.max(0.5, bodyHeight) : 1.8;
  return LINE_OF_SIGHT_TARGET_HEIGHT_FRACTIONS.map(
    (fraction) =>
      [position[0], position[1] + height * fraction, position[2]] as Vec3
  );
}

export function lineOfSightEyeHeight(bodyHeight: number | undefined): number {
  return Number.isFinite(bodyHeight)
    ? Math.max(0.5, (bodyHeight as number) * LINE_OF_SIGHT_EYE_HEIGHT_FRACTION)
    : 1.45;
}

export interface ChaseTargetRetentionInput {
  hasLineOfSight: boolean;
  nowSeconds: number;
  /** Seconds-since-epoch of the last confirmed sighting, if any. */
  lastSeenAtSeconds?: number;
  /**
   * Whether navigation currently believes the last known position is reachable.
   * Consulted only after the grace window; `undefined` is treated as reachable so
   * a caller that cannot answer cheaply does not accidentally harden disengage.
   */
  targetReachable?: boolean;
  graceSeconds?: number;
  huntSeconds?: number;
}

export interface ChaseTargetRetentionResult {
  retain: boolean;
  /** The value the caller should persist back into NPC state. */
  lastSeenAtSeconds: number | undefined;
  reason:
    | "visible"
    | "grace"
    | "hunting_last_known"
    | "lost_unreachable"
    | "lost_timeout"
    | "never_seen";
}

/**
 * Replaces the old "one failed LOS check clears the target" rule.
 *
 * A creature that has actually seen the player keeps hunting for
 * `graceSeconds` unconditionally, then for a further `huntSeconds` only while the
 * last known position is still reachable. A creature that has never had line of
 * sight is dropped immediately, so this cannot be used to acquire a target
 * through a hillside.
 */
export function evaluateChaseTargetRetention(
  input: ChaseTargetRetentionInput
): ChaseTargetRetentionResult {
  if (input.hasLineOfSight) {
    return {
      retain: true,
      lastSeenAtSeconds: input.nowSeconds,
      reason: "visible",
    };
  }
  const lastSeen = input.lastSeenAtSeconds;
  if (lastSeen === undefined || !Number.isFinite(lastSeen)) {
    return { retain: false, lastSeenAtSeconds: undefined, reason: "never_seen" };
  }
  const age = input.nowSeconds - lastSeen;
  if (age < 0) {
    // Clock skew between the writer and this tick. Treat as freshly seen rather
    // than dropping a live fight.
    return { retain: true, lastSeenAtSeconds: lastSeen, reason: "grace" };
  }
  const grace = input.graceSeconds ?? CHASE_LOST_SIGHT_GRACE_SECONDS;
  if (age < grace) {
    return { retain: true, lastSeenAtSeconds: lastSeen, reason: "grace" };
  }
  if (input.targetReachable === false) {
    return {
      retain: false,
      lastSeenAtSeconds: undefined,
      reason: "lost_unreachable",
    };
  }
  const hunt = input.huntSeconds ?? CHASE_LOST_SIGHT_HUNT_SECONDS;
  if (age < grace + hunt) {
    return {
      retain: true,
      lastSeenAtSeconds: lastSeen,
      reason: "hunting_last_known",
    };
  }
  return { retain: false, lastSeenAtSeconds: undefined, reason: "lost_timeout" };
}
