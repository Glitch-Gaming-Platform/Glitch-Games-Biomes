// HARTHMERE_ESCORT
//
// One Native-ECS escort state, owned by Anima.
//
// What existed before
// -------------------
// Two incompatible escort implementations:
//
//   1. The committed jobs-board escort (`live_mode_escort_scheduler.ts`) rebuilt a
//      large part of the companion entity once a second from live-mode Redis
//      state and projected the result into ECS. Its reconstructed snapshot
//      hard-coded `isAttackable: false`, `combatProtection:
//      "friendly_noncombatant"`, `retaliatesWhenAttacked: false`, and
//      `aggroRange: 0`; the reducer additionally suppresses attacks whenever
//      `escortJobId` is set. It CANNOT fight. It also never terrain-grounds each
//      projected step (so hills produce floating/buried companions), and because
//      it rewrites the entity wholesale it would clobber health, velocity, target,
//      and Anima state the moment combat were enabled. Its 5,000 m leash is not a
//      catch-up policy, it is the absence of one.
//   2. The Chapter 1 escort (`ch1_escort_scheduler.ts`) writes a player anchor into
//      the NPC's Anima schedule, which is the right ownership model — normal NPC
//      physics carry the follow — but it has no combat policy, no follow distance
//      or formation, no catch-up, no arrival, and no death handling.
//
// The model here
// --------------
// A scheduler's ONLY job is to assign or clear escort state. Anima owns movement,
// terrain physics, combat targeting, health, and recovery — the same authorities
// that already work for every other NPC. Everything in this file is pure so the
// policy can be tested without a world.

import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { zVec3f } from "@/shared/math/types";
import { z } from "zod";

export const HARTHMERE_ESCORT_VERSION = "harthmere-escort-v1" as const;

/**
 * What an escort is permitted to fight.
 *
 * - `noncombatant`  — never fights. The historical jobs-board behaviour, still the
 *   correct default for a civilian being walked between two markers.
 * - `defend_self`   — fights only whatever attacks the escort.
 * - `defend_leader` — additionally fights whatever is attacking the leader.
 * - `fight_muck`    — additionally engages hostile Muck inside a small defend
 *   radius. This is the "can fight the Mucking" capability the audit found
 *   missing.
 */
export type EscortCombatPolicy =
  | "noncombatant"
  | "defend_self"
  | "defend_leader"
  | "fight_muck";

export type EscortStatus =
  | "following"
  | "fighting"
  | "catching_up"
  | "arrived"
  | "down";

/** Default trailing distance behind the leader, in metres. */
export const ESCORT_DEFAULT_FOLLOW_DISTANCE = 2.6;
/** Beyond this the escort is out of formation and starts closing at extra pace. */
export const ESCORT_FOLLOW_SLACK_METERS = 1.4;
/** Escorts visibly run even while correcting a small formation gap. */
export const ESCORT_FOLLOW_RUN_SPEED_MULTIPLIER = 1;
/** Extra pace used as soon as the escort falls out of formation. */
export const ESCORT_CLOSE_FAST_RUN_SPEED_MULTIPLIER = 1.5;
/** Near-player-sprint pace reserved for recovering a badly separated escort. */
export const ESCORT_CATCH_UP_RUN_SPEED_MULTIPLIER = 1.8;
/** Beyond this the escort has lost the leader and must catch up. */
export const ESCORT_DEFAULT_LEASH_DISTANCE = 48;
/** Radius around the leader in which `fight_muck` will pick up a hostile. */
export const ESCORT_DEFEND_RADIUS = 12;
/** Distance from the formation slot inside which the escort simply holds. */
export const ESCORT_ARRIVE_RADIUS = 1.2;
/** How close to the destination counts as delivered. */
export const ESCORT_DESTINATION_ARRIVE_RADIUS = 3;
/**
 * Seconds of continuous navigation failure before a warp is permitted. A warp is
 * a last resort, not a movement strategy: it must never be reachable by simply
 * walking the leader quickly.
 */
export const ESCORT_WARP_PATH_FAILURE_SECONDS = 6;
/** Movement required to count as real catch-up progress. */
export const ESCORT_PROGRESS_DISTANCE_METERS = 0.75;
/** Time without that movement before navigation is considered stuck. */
export const ESCORT_STUCK_GRACE_SECONDS = 2.5;

export const zEscortComponent = z.object({
  escort: z
    .object({
      leaderId: z.number(),
      combatPolicy: z.enum([
        "noncombatant",
        "defend_self",
        "defend_leader",
        "fight_muck",
      ]),
      status: z.enum([
        "following",
        "fighting",
        "catching_up",
        "arrived",
        "down",
      ]),
      followDistance: z.number().positive().max(32),
      formationSlot: z.number().int().min(0).max(7),
      leashDistance: z.number().positive().max(512),
      destination: z.tuple([z.number(), z.number(), z.number()]).optional(),
      /** Opaque handle back to whatever assigned this escort (job id, quest id). */
      assignmentId: z.string().min(1).max(128).optional(),
      lastLeaderSeenAtSeconds: z.number().optional(),
      pathFailingSinceSeconds: z.number().optional(),
      lastProgressPosition: zVec3f.optional(),
      lastProgressAtSeconds: z.number().optional(),
    })
    .optional(),
});
export type EscortComponent = z.infer<typeof zEscortComponent>;

export interface EscortState {
  leaderId: BiomesId;
  combatPolicy: EscortCombatPolicy;
  status: EscortStatus;
  followDistance: number;
  formationSlot: number;
  leashDistance: number;
  destination?: Vec3;
  assignmentId?: string;
  lastLeaderSeenAtSeconds?: number;
  pathFailingSinceSeconds?: number;
  lastProgressPosition?: Vec3;
  lastProgressAtSeconds?: number;
}

/**
 * Formation slots, expressed as (lateral, trailing) multiples of the follow
 * distance. Slot 0 is directly behind; the rest fan out so a party of escorts
 * does not stack into one voxel.
 */
const FORMATION_SLOT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [-0.75, 1],
  [0.75, 1],
  [-1.4, 1.35],
  [1.4, 1.35],
  [0, 1.9],
  [-0.75, 2.1],
  [0.75, 2.1],
];

/**
 * World position an escort should stand in, given where the leader is and which
 * way they are facing. Y is copied from the leader; Anima's normal ground physics
 * settle the escort onto the real surface, which is what the jobs-board scheduler
 * failed to do when it wrote positions directly into ECS.
 */
export function escortFormationAnchor(input: {
  leaderPosition: ReadonlyVec3;
  leaderYawRadians: number;
  followDistance: number;
  formationSlot: number;
}): Vec3 {
  const slot =
    FORMATION_SLOT_OFFSETS[
      Math.max(0, Math.trunc(input.formationSlot)) %
        FORMATION_SLOT_OFFSETS.length
    ];
  const distance = Math.max(0.5, input.followDistance);
  // Leader yaw 0 faces -Z in Biomes; "behind" is therefore +Z rotated by yaw.
  const forwardX = -Math.sin(input.leaderYawRadians);
  const forwardZ = -Math.cos(input.leaderYawRadians);
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const lateral = slot[0] * distance;
  const trailing = slot[1] * distance;
  return [
    input.leaderPosition[0] + rightX * lateral - forwardX * trailing,
    input.leaderPosition[1],
    input.leaderPosition[2] + rightZ * lateral - forwardZ * trailing,
  ];
}

export type EscortLocomotionAction =
  | "hold"
  | "follow"
  | "close_fast"
  | "catch_up"
  | "arrived";

export interface EscortLocomotionInput {
  distanceToFormationAnchor: number;
  distanceToLeader: number;
  leashDistance: number;
  destinationDistance?: number;
  followSlack?: number;
  arriveRadius?: number;
  destinationArriveRadius?: number;
}

export interface EscortLocomotionDecision {
  action: EscortLocomotionAction;
  /** Multiplier applied to the NPC's authored run speed this tick. */
  runSpeedMultiplier: number;
}

/**
 * Speed pacing for a following escort. Moving escorts always use a running pace:
 * hold inside the slot, run to close small gaps, accelerate once out of
 * formation, and use near-player-sprint pace past the leash.
 */
export function escortLocomotionDecision(
  input: EscortLocomotionInput
): EscortLocomotionDecision {
  if (
    input.destinationDistance !== undefined &&
    input.destinationDistance <=
      (input.destinationArriveRadius ?? ESCORT_DESTINATION_ARRIVE_RADIUS)
  ) {
    return { action: "arrived", runSpeedMultiplier: 0 };
  }
  if (input.distanceToLeader > input.leashDistance) {
    return {
      action: "catch_up",
      runSpeedMultiplier: ESCORT_CATCH_UP_RUN_SPEED_MULTIPLIER,
    };
  }
  const arrive = input.arriveRadius ?? ESCORT_ARRIVE_RADIUS;
  if (input.distanceToFormationAnchor <= arrive) {
    return { action: "hold", runSpeedMultiplier: 0 };
  }
  const slack = input.followSlack ?? ESCORT_FOLLOW_SLACK_METERS;
  if (input.distanceToFormationAnchor <= arrive + slack) {
    return {
      action: "follow",
      runSpeedMultiplier: ESCORT_FOLLOW_RUN_SPEED_MULTIPLIER,
    };
  }
  return {
    action: "close_fast",
    runSpeedMultiplier: ESCORT_CLOSE_FAST_RUN_SPEED_MULTIPLIER,
  };
}

export interface EscortHostileCandidate {
  id: BiomesId;
  /** True for Muck/Hex family entities; livestock and civilians are false. */
  isMuck: boolean;
  hostile: boolean;
  alive: boolean;
  /** True when this entity is currently targeting the escort's leader. */
  attackingLeader: boolean;
  /** True when this entity recently damaged the escort itself. */
  attackingEscort: boolean;
  distanceToEscort: number;
  distanceToLeader: number;
}

export interface EscortCombatTargetInput {
  policy: EscortCombatPolicy;
  candidates: ReadonlyArray<EscortHostileCandidate>;
  defendRadius?: number;
}

/**
 * The single place that decides what an escort may attack.
 *
 * Restricting targets is as important as enabling combat: an escort that picks
 * fights on its own turns a delivery quest into an unwinnable brawl, and one that
 * can hit livestock or civilians is a griefing tool. Priority is
 * self-defence, then defence of the leader, then nearby hostile Muck.
 */
export function evaluateEscortCombatTarget(
  input: EscortCombatTargetInput
): BiomesId | undefined {
  if (input.policy === "noncombatant") return undefined;
  const defendRadius = input.defendRadius ?? ESCORT_DEFEND_RADIUS;
  const live = input.candidates.filter(
    (candidate) => candidate.alive && candidate.hostile
  );

  const selfDefence = pickNearestToEscort(
    live.filter((candidate) => candidate.attackingEscort)
  );
  if (selfDefence) return selfDefence;
  if (input.policy === "defend_self") return undefined;

  const defendLeader = pickNearestToEscort(
    live.filter((candidate) => candidate.attackingLeader)
  );
  if (defendLeader) return defendLeader;
  if (input.policy === "defend_leader") return undefined;

  return pickNearestToEscort(
    live.filter(
      (candidate) => candidate.isMuck && candidate.distanceToLeader <= defendRadius
    )
  );
}

function pickNearestToEscort(
  candidates: ReadonlyArray<EscortHostileCandidate>
): BiomesId | undefined {
  let best: EscortHostileCandidate | undefined;
  for (const candidate of candidates) {
    if (
      !best ||
      candidate.distanceToEscort < best.distanceToEscort ||
      (candidate.distanceToEscort === best.distanceToEscort &&
        candidate.id < best.id)
    ) {
      best = candidate;
    }
  }
  return best?.id;
}

export interface EscortWarpInput {
  distanceToLeader: number;
  leashDistance: number;
  pathFailingSinceSeconds?: number;
  nowSeconds: number;
  warpAfterSeconds?: number;
  /** False when the escort is currently in combat; never warp out of a fight. */
  inCombat: boolean;
}

export interface EscortPathProgressInput {
  catchingUp: boolean;
  position: ReadonlyVec3;
  nowSeconds: number;
  lastProgressPosition?: ReadonlyVec3;
  lastProgressAtSeconds?: number;
  pathFailingSinceSeconds?: number;
  progressDistanceMeters?: number;
  stuckGraceSeconds?: number;
}

export interface EscortPathProgressResult {
  lastProgressPosition: Vec3;
  lastProgressAtSeconds: number;
  pathFailingSinceSeconds: number | undefined;
}

/**
 * Tracks actual locomotion progress while an escort is beyond its leash.
 * Distance from the leader alone is not navigation failure: a fast leader can
 * keep widening the gap while the escort is still moving correctly.
 */
export function escortPathProgress(
  input: EscortPathProgressInput
): EscortPathProgressResult {
  const current = [...input.position] as Vec3;
  if (!input.catchingUp) {
    return {
      lastProgressPosition: current,
      lastProgressAtSeconds: input.nowSeconds,
      pathFailingSinceSeconds: undefined,
    };
  }
  if (
    !input.lastProgressPosition ||
    input.lastProgressAtSeconds === undefined
  ) {
    return {
      lastProgressPosition: current,
      lastProgressAtSeconds: input.nowSeconds,
      pathFailingSinceSeconds: undefined,
    };
  }
  const moved = Math.hypot(
    current[0] - input.lastProgressPosition[0],
    current[2] - input.lastProgressPosition[2]
  );
  if (moved >= (input.progressDistanceMeters ?? ESCORT_PROGRESS_DISTANCE_METERS)) {
    return {
      lastProgressPosition: current,
      lastProgressAtSeconds: input.nowSeconds,
      pathFailingSinceSeconds: undefined,
    };
  }
  const grace = input.stuckGraceSeconds ?? ESCORT_STUCK_GRACE_SECONDS;
  const failingSince =
    input.nowSeconds - input.lastProgressAtSeconds >= grace
      ? input.pathFailingSinceSeconds ?? input.lastProgressAtSeconds + grace
      : undefined;
  return {
    lastProgressPosition: [...input.lastProgressPosition] as Vec3,
    lastProgressAtSeconds: input.lastProgressAtSeconds,
    pathFailingSinceSeconds: failingSince,
  };
}

/**
 * Whether the escort may teleport to the leader.
 *
 * Both conditions must hold: the escort is beyond its leash AND navigation has
 * been failing continuously for `warpAfterSeconds`. A companion that is merely
 * slow keeps running; only a companion that is genuinely stuck warps. Never
 * during combat, because a warp would abandon the fight it was assigned to.
 */
export function escortShouldWarp(input: EscortWarpInput): boolean {
  if (input.inCombat) return false;
  if (input.distanceToLeader <= input.leashDistance) return false;
  if (input.pathFailingSinceSeconds === undefined) return false;
  const failingFor = input.nowSeconds - input.pathFailingSinceSeconds;
  return (
    failingFor >= (input.warpAfterSeconds ?? ESCORT_WARP_PATH_FAILURE_SECONDS)
  );
}

/**
 * Where a warping escort lands: the formation slot behind the leader. The caller
 * must still validate the point against terrain and collision before applying it
 * — this returns the intent, not a guaranteed-safe position.
 */
export function escortWarpAnchor(input: {
  leaderPosition: ReadonlyVec3;
  leaderYawRadians: number;
  followDistance: number;
  formationSlot: number;
}): Vec3 {
  return escortFormationAnchor(input);
}

export interface EscortStatusInput {
  hasCombatTarget: boolean;
  alive: boolean;
  action: EscortLocomotionAction;
}

/** Derives the persisted status from this tick's outcome. */
export function escortStatusFor(input: EscortStatusInput): EscortStatus {
  if (!input.alive) return "down";
  if (input.hasCombatTarget) return "fighting";
  if (input.action === "arrived") return "arrived";
  if (input.action === "catch_up") return "catching_up";
  return "following";
}

/** Normalizes a partially specified assignment into complete escort state. */
export function buildEscortState(input: {
  leaderId: BiomesId;
  combatPolicy?: EscortCombatPolicy;
  followDistance?: number;
  formationSlot?: number;
  leashDistance?: number;
  destination?: Vec3;
  assignmentId?: string;
}): EscortState {
  return {
    leaderId: input.leaderId,
    combatPolicy: input.combatPolicy ?? "noncombatant",
    status: "following",
    followDistance: Math.max(
      0.5,
      input.followDistance ?? ESCORT_DEFAULT_FOLLOW_DISTANCE
    ),
    formationSlot: Math.max(0, Math.trunc(input.formationSlot ?? 0)),
    leashDistance: Math.max(
      4,
      input.leashDistance ?? ESCORT_DEFAULT_LEASH_DISTANCE
    ),
    destination: input.destination ? ([...input.destination] as Vec3) : undefined,
    assignmentId: input.assignmentId,
  };
}
