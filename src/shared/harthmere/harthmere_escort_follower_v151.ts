// HARTHMERE_ESCORT_FOLLOWER_V151
//
// Pure follow state machine for escort jobs: an NPC the player must escort to a
// marked destination. Each tick it walks the follower toward the player (keeping
// a gap), grounds it to the real surface (so the escort NPC is never floating or
// buried), leash-catches-up if the player outruns it, and reports "arrived" once
// the follower reaches the destination. No client/3D imports → unit testable.
//
// The client calls this each frame with live positions + a terrain ground sampler
// and renders the follower at the returned position; `arrived` drives the escort
// job's objective-complete (then the marker flips to the board).
//
// GROUNDING CONTRACT: the escort follower is a real outdoor NPC, so it must use
// the SAME "always visible — never floating/buried" grounder as every creature
// (cows/sheep/hexes/muckers). Two ways, both the shared system:
//   1. Preferred: spawn it as a normal NPC entity — it then grounds through
//      `npcs.ts` (`sampleHarthmereNpcGroundFeetYV1` → `harthmereGroundedFeetYWithMemoryV1`)
//      automatically, identical to all creatures, and this module only supplies
//      the follow TARGET (pass groundYAt = undefined).
//   2. Standalone: pass `groundYAt = (x, z, y) => sampleHarthmereNpcGroundFeetYV1(
//      resources, frame, x, z, y, /*requireOpenSky*/ true)` so grounding still
//      routes through the one shared grounder.
// Never pass an ad-hoc sampler — that would be a parallel grounding path.

import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

export const HARTHMERE_ESCORT_FOLLOWER_VERSION_V151 =
  "harthmere-escort-follower-v151" as const;

export type HarthmereEscortPhaseV151 =
  | "following"
  | "arrived"
  | "idle"
  | "failed";

export interface HarthmereEscortFollowInputV151 {
  followerPosition: ReadonlyVec3;
  playerPosition: ReadonlyVec3;
  destination: ReadonlyVec3;
  // Desired gap the follower keeps behind the player (m).
  followDistance?: number;
  // Max horizontal distance the follower moves this tick (speed * dt).
  stepMaxMeters?: number;
  // Follower counts as arrived within this horizontal distance of destination.
  arriveRadius?: number;
  // If the player gets farther than this, the follower catches up (teleports) to
  // avoid being left behind through walls / across the map.
  leashRadius?: number;
  // Terrain ground sampler so the follower stands on the surface, not floating or
  // buried. Returns feet-Y, or undefined when terrain is not loaded (keep prev Y).
  groundYAt?: (x: number, z: number, preferredY: number) => number | undefined;
  // The escorted NPC was killed — the escort has FAILED (the quest/job fails and
  // its markers drop).
  escortedNpcDefeated?: boolean;
}

export interface HarthmereEscortFollowResultV151 {
  version: typeof HARTHMERE_ESCORT_FOLLOWER_VERSION_V151;
  phase: HarthmereEscortPhaseV151;
  position: Vec3;
  arrived: boolean;
  failed: boolean;
  teleported: boolean;
  distanceToPlayer: number;
  distanceToDestination: number;
}

const DEFAULT_FOLLOW_DISTANCE_V151 = 2.2;
const DEFAULT_STEP_MAX_METERS_V151 = 0.55;
const DEFAULT_ARRIVE_RADIUS_V151 = 2.5;
const DEFAULT_LEASH_RADIUS_V151 = 24;

function horizontalDistanceV151(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[2]) - Number(b[2]));
}

function finiteVec3V151(v: ReadonlyVec3 | undefined): Vec3 | undefined {
  if (!v) return undefined;
  const x = Number(v[0]);
  const y = Number(v[1]);
  const z = Number(v[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

// Ground a candidate (x,z) using the sampler; keep the candidate Y when terrain
// is not loaded so the follower never snaps to a wrong height mid-stream.
function groundedV151(
  input: HarthmereEscortFollowInputV151,
  x: number,
  z: number,
  preferredY: number
): Vec3 {
  const sampled = input.groundYAt?.(x, z, preferredY);
  return [x, Number.isFinite(sampled) ? (sampled as number) : preferredY, z];
}

export function resolveHarthmereEscortFollowStepV151(
  input: HarthmereEscortFollowInputV151
): HarthmereEscortFollowResultV151 {
  const follower = finiteVec3V151(input.followerPosition);
  const player = finiteVec3V151(input.playerPosition);
  const destination = finiteVec3V151(input.destination);

  // Bad inputs: hold position, report idle. Never produce NaN.
  if (!follower || !player || !destination) {
    const safe = follower ?? [0, 0, 0];
    return {
      version: HARTHMERE_ESCORT_FOLLOWER_VERSION_V151,
      phase: "idle",
      position: safe,
      arrived: false,
      failed: false,
      teleported: false,
      distanceToPlayer: 0,
      distanceToDestination: 0,
    };
  }

  // The escorted NPC was killed: the escort FAILED. Hold the follower in place
  // (grounded) and report failure so the quest/job is marked failed + markers drop.
  if (input.escortedNpcDefeated) {
    const grounded = groundedV151(input, follower[0], follower[2], follower[1]);
    return {
      version: HARTHMERE_ESCORT_FOLLOWER_VERSION_V151,
      phase: "failed",
      position: grounded,
      arrived: false,
      failed: true,
      teleported: false,
      distanceToPlayer: horizontalDistanceV151(grounded, player),
      distanceToDestination: horizontalDistanceV151(grounded, destination),
    };
  }

  const followDistance = Math.max(0.5, input.followDistance ?? DEFAULT_FOLLOW_DISTANCE_V151);
  const stepMax = Math.max(0.05, input.stepMaxMeters ?? DEFAULT_STEP_MAX_METERS_V151);
  const arriveRadius = Math.max(0.5, input.arriveRadius ?? DEFAULT_ARRIVE_RADIUS_V151);
  const leashRadius = Math.max(followDistance + 1, input.leashRadius ?? DEFAULT_LEASH_RADIUS_V151);

  const distToDestination = horizontalDistanceV151(follower, destination);

  // Arrival wins regardless of where the player is: the escorted NPC reached the
  // goal. Snap onto the destination spot (grounded) and stop.
  if (distToDestination <= arriveRadius) {
    const grounded = groundedV151(input, destination[0], destination[2], destination[1]);
    return {
      version: HARTHMERE_ESCORT_FOLLOWER_VERSION_V151,
      phase: "arrived",
      position: grounded,
      arrived: true,
      failed: false,
      teleported: false,
      distanceToPlayer: horizontalDistanceV151(grounded, player),
      distanceToDestination: horizontalDistanceV151(grounded, destination),
    };
  }

  const distToPlayer = horizontalDistanceV151(follower, player);

  // Leash: player outran the follower — catch up to just behind the player.
  if (distToPlayer > leashRadius) {
    const dirX = (follower[0] - player[0]) / (distToPlayer || 1);
    const dirZ = (follower[2] - player[2]) / (distToPlayer || 1);
    const catchX = player[0] + dirX * followDistance;
    const catchZ = player[2] + dirZ * followDistance;
    const grounded = groundedV151(input, catchX, catchZ, player[1]);
    return {
      version: HARTHMERE_ESCORT_FOLLOWER_VERSION_V151,
      phase: "following",
      position: grounded,
      arrived: false,
      failed: false,
      teleported: true,
      distanceToPlayer: horizontalDistanceV151(grounded, player),
      distanceToDestination: horizontalDistanceV151(grounded, destination),
    };
  }

  // Already close enough behind the player — hold (just re-ground in place).
  if (distToPlayer <= followDistance) {
    const grounded = groundedV151(input, follower[0], follower[2], follower[1]);
    return {
      version: HARTHMERE_ESCORT_FOLLOWER_VERSION_V151,
      phase: "following",
      position: grounded,
      arrived: false,
      failed: false,
      teleported: false,
      distanceToPlayer: horizontalDistanceV151(grounded, player),
      distanceToDestination: horizontalDistanceV151(grounded, destination),
    };
  }

  // Step toward the player, stopping at followDistance, capped by stepMax.
  const toMove = Math.min(stepMax, distToPlayer - followDistance);
  const dirX = (player[0] - follower[0]) / (distToPlayer || 1);
  const dirZ = (player[2] - follower[2]) / (distToPlayer || 1);
  const nextX = follower[0] + dirX * toMove;
  const nextZ = follower[2] + dirZ * toMove;
  const grounded = groundedV151(input, nextX, nextZ, follower[1]);
  return {
    version: HARTHMERE_ESCORT_FOLLOWER_VERSION_V151,
    phase: "following",
    position: grounded,
    arrived: false,
    failed: false,
    teleported: false,
    distanceToPlayer: horizontalDistanceV151(grounded, player),
    distanceToDestination: horizontalDistanceV151(grounded, destination),
  };
}
