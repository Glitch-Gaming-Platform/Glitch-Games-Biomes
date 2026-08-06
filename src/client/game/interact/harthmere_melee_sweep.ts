import type { AABB, ReadonlyVec3 } from "@/shared/math/types";

export type HarthmereMeleeSweepClass = "basic" | "heavy";

export interface HarthmereMeleeSweepCandidate<T> {
  value: T;
  aabb: AABB;
}

export interface HarthmereMeleeSweepInput<T> {
  playerPosition: ReadonlyVec3;
  forward: readonly [number, number];
  reach: number;
  hitRadius: number;
  timingClass: HarthmereMeleeSweepClass;
  candidates: readonly HarthmereMeleeSweepCandidate<T>[];
}

export interface HarthmereMeleeSweepHit<T> {
  value: T;
  distance: number;
  angularErrorRadians: number;
}

const BASIC_HALF_ANGLE_RADIANS = (72 * Math.PI) / 180;
const HEAVY_HALF_ANGLE_RADIANS = (84 * Math.PI) / 180;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceSquaredToAabb(point: ReadonlyVec3, aabb: AABB) {
  let distanceSquared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const value = point[axis];
    const delta =
      value < aabb[0][axis]
        ? aabb[0][axis] - value
        : value > aabb[1][axis]
          ? value - aabb[1][axis]
          : 0;
    distanceSquared += delta * delta;
  }
  return distanceSquared;
}

function horizontalBodySamples(aabb: AABB): readonly [number, number][] {
  const minX = aabb[0][0];
  const maxX = aabb[1][0];
  const minZ = aabb[0][2];
  const maxZ = aabb[1][2];
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  return [
    [centerX, centerZ],
    [minX, minZ],
    [minX, maxZ],
    [maxX, minZ],
    [maxX, maxZ],
    [centerX, minZ],
    [centerX, maxZ],
    [minX, centerZ],
    [maxX, centerZ],
  ];
}

/**
 * Rank bodies intersected by a horizontal hand/weapon sweep.
 *
 * The target is its complete AABB, not a cursor point or center point. This is
 * what lets a visible weapon pass through the side of a Mucker and still hit
 * when the crosshair is over its shoulder. The path radius supplies the
 * thickness of a fist/blade, while the authoritative `reach` remains the hard
 * distance boundary used again by the server at contact.
 */
export function rankHarthmereMeleeSweepHits<T>(
  input: HarthmereMeleeSweepInput<T>
): HarthmereMeleeSweepHit<T>[] {
  const forwardLength = Math.hypot(input.forward[0], input.forward[1]);
  if (
    !Number.isFinite(forwardLength) ||
    forwardLength < 1e-6 ||
    !Number.isFinite(input.reach) ||
    input.reach <= 0 ||
    !Number.isFinite(input.hitRadius) ||
    input.hitRadius < 0
  ) {
    return [];
  }
  const forwardX = input.forward[0] / forwardLength;
  const forwardZ = input.forward[1] / forwardLength;
  const halfAngle =
    input.timingClass === "heavy"
      ? HEAVY_HALF_ANGLE_RADIANS
      : BASIC_HALF_ANGLE_RADIANS;
  const hits: HarthmereMeleeSweepHit<T>[] = [];

  for (const candidate of input.candidates) {
    const distanceSquared = distanceSquaredToAabb(
      input.playerPosition,
      candidate.aabb
    );
    if (distanceSquared > input.reach * input.reach) {
      continue;
    }

    let bestAngularError = Number.POSITIVE_INFINITY;
    for (const [sampleX, sampleZ] of horizontalBodySamples(candidate.aabb)) {
      const dx = sampleX - input.playerPosition[0];
      const dz = sampleZ - input.playerPosition[2];
      const horizontalDistance = Math.hypot(dx, dz);
      if (horizontalDistance < 1e-6) {
        bestAngularError = 0;
        break;
      }
      const forwardDistance = dx * forwardX + dz * forwardZ;
      // A forward swing can brush a body that overlaps the shoulder plane, but
      // it must never select an enemy wholly behind the player.
      if (forwardDistance < -Math.min(0.08, input.hitRadius * 0.15)) {
        continue;
      }
      const cosine = clamp(forwardDistance / horizontalDistance, -1, 1);
      const angle = Math.acos(cosine);
      const pathAngularRadius = Math.asin(
        clamp(input.hitRadius / horizontalDistance, 0, 1)
      );
      const angularError = Math.max(0, angle - pathAngularRadius);
      if (angularError <= halfAngle) {
        bestAngularError = Math.min(bestAngularError, angularError);
      }
    }
    if (!Number.isFinite(bestAngularError)) {
      continue;
    }
    hits.push({
      value: candidate.value,
      distance: Math.sqrt(distanceSquared),
      angularErrorRadians: bestAngularError,
    });
  }

  return hits.sort(
    (a, b) =>
      a.distance - b.distance || a.angularErrorRadians - b.angularErrorRadians
  );
}
