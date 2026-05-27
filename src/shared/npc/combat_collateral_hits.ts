// HARTHMERE_COMBAT_COLLATERAL_HITS_V1:
// Geometry helpers used by combat hit detection so that swings and projectiles
// can hit *anyone* in their path, not just the cursor-targeted entity. This
// implements the rule book guidance that AOE/projectile abilities must consider
// every entity in their volume, with optional line-of-sight gating.
//
// The melee cone is already AOE through `attackableEntitiesInAttackRegion`. The
// remaining gap is projectile sweep tests, which this module provides.
//
// These helpers are intentionally pure functions over AABBs so they can be
// unit tested without booting the full server/runtime.

import type { AABB, ReadonlyVec3, Vec3 } from "@/shared/math/types";

export interface ProjectilePath {
  origin: ReadonlyVec3;
  // Direction need not be normalized; the implementation handles it.
  direction: ReadonlyVec3;
  maxDistance: number;
  // Optional capsule radius. A projectile with non-zero radius will inflate the
  // AABB intersection test, modelling thick projectiles (fireballs, hammers).
  radius?: number;
}

export interface MeleeSwingArc {
  origin: ReadonlyVec3;
  forward: ReadonlyVec3;
  reach: number;
  // Half-angle of the swing arc in radians.
  halfAngleRad: number;
  // Optional vertical reach cushion to allow swings to hit taller/shorter
  // targets without origin-to-origin overlap.
  verticalCushion?: number;
}

export interface CollidableEntity<TId = unknown> {
  id: TId;
  aabb: AABB;
}

function normalize3(v: ReadonlyVec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) {
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function sub3(a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot3(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function inflateAabb(aabb: AABB, by: number): AABB {
  if (by <= 0) {
    return aabb;
  }
  return [
    [aabb[0][0] - by, aabb[0][1] - by, aabb[0][2] - by],
    [aabb[1][0] + by, aabb[1][1] + by, aabb[1][2] + by],
  ];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// Slab-method ray-vs-AABB intersection. Returns the nearest hit `t` along the
// ray within [0, maxDistance], or undefined if no hit. The ray is parameterised
// as origin + t * direction (direction may not be unit length).
export function rayAabbIntersection(
  origin: ReadonlyVec3,
  direction: ReadonlyVec3,
  aabb: AABB,
  maxDistance: number
): number | undefined {
  let tMin = 0;
  let tMax = maxDistance;
  for (let axis = 0; axis < 3; axis++) {
    const o = origin[axis];
    const d = direction[axis];
    const minA = aabb[0][axis];
    const maxA = aabb[1][axis];
    if (Math.abs(d) < 1e-9) {
      if (o < minA || o > maxA) {
        return undefined;
      }
      continue;
    }
    const inv = 1 / d;
    let t1 = (minA - o) * inv;
    let t2 = (maxA - o) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) {
      return undefined;
    }
  }
  return tMin;
}

// Computes every entity intersected by a projectile path. Results are sorted
// by distance from the origin, near-to-far. Inflates AABBs by the projectile
// radius so wider projectiles spray collateral as expected.
//
// Per the MMO rule book, projectiles in flight collide with *anyone* in their
// path, not just the originally targeted entity. The caller decides whether to
// stop on first hit (rifle/arrow) or keep going through (piercing/AOE).
export function entitiesInProjectilePath<T extends CollidableEntity>(
  path: ProjectilePath,
  entities: readonly T[]
): { entity: T; distance: number }[] {
  const direction = normalize3(path.direction);
  const radius = path.radius ?? 0;
  const hits: { entity: T; distance: number }[] = [];
  for (const entity of entities) {
    const t = rayAabbIntersection(
      path.origin,
      direction,
      inflateAabb(entity.aabb, radius),
      path.maxDistance
    );
    if (t !== undefined) {
      hits.push({ entity, distance: t });
    }
  }
  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}

// Returns the entities currently inside the melee swing arc, regardless of
// whether they were the cursor-targeted entity. The melee cone is the
// intersection of:
//   - distance(origin, entity_center_xz) <= reach + verticalCushion,
//   - angle(forward, entity_center - origin) <= halfAngleRad.
// Vertical reach is treated leniently (small cushion) so swings still connect
// to tall/short targets, matching the existing melee_attack_region behavior.
export function entitiesInSwingArc<T extends CollidableEntity>(
  arc: MeleeSwingArc,
  entities: readonly T[]
): T[] {
  const forward = normalize3(arc.forward);
  const halfAngleCos = Math.cos(clamp(arc.halfAngleRad, 0, Math.PI));
  const reachSq = arc.reach * arc.reach;
  // Default cushion of 1.5 voxels matches how a sword reaches down to short
  // targets like Mucklings while still permitting an upward arc. The exact
  // melee-attack-region used in production is broader still, but tests pin a
  // conservative default for the pure helper.
  const verticalCushion = arc.verticalCushion ?? 1.5;
  const hits: T[] = [];
  for (const entity of entities) {
    const cx = (entity.aabb[0][0] + entity.aabb[1][0]) / 2;
    const cy = (entity.aabb[0][1] + entity.aabb[1][1]) / 2;
    const cz = (entity.aabb[0][2] + entity.aabb[1][2]) / 2;
    const toEntity: Vec3 = [
      cx - arc.origin[0],
      0,
      cz - arc.origin[2],
    ];
    const horizDistSq =
      toEntity[0] * toEntity[0] + toEntity[2] * toEntity[2];
    if (horizDistSq > reachSq) {
      continue;
    }
    // Vertical band: entity must overlap the swinger's height ±cushion.
    const heightLo = entity.aabb[0][1];
    const heightHi = entity.aabb[1][1];
    if (
      heightHi < arc.origin[1] - verticalCushion ||
      heightLo > arc.origin[1] + verticalCushion + 2.5
    ) {
      continue;
    }
    if (horizDistSq < 1e-6) {
      // Standing on top of the swinger — definitely "in the arc".
      hits.push(entity);
      continue;
    }
    const horizDist = Math.sqrt(horizDistSq);
    const dirToEntity: Vec3 = [toEntity[0] / horizDist, 0, toEntity[2] / horizDist];
    const forwardHoriz: Vec3 = [forward[0], 0, forward[2]];
    const forwardLen = Math.hypot(forwardHoriz[0], forwardHoriz[2]);
    if (forwardLen < 1e-6) {
      // Looking straight up/down — treat as omnidirectional swing.
      hits.push(entity);
      continue;
    }
    forwardHoriz[0] /= forwardLen;
    forwardHoriz[2] /= forwardLen;
    const cosAngle = dot3(dirToEntity, forwardHoriz);
    if (cosAngle >= halfAngleCos) {
      hits.push(entity);
    }
  }
  return hits;
}

// Convenience: take a list of "untargeted" entities and a primary target, and
// return the union of entities that actually get hit by a swing. Used by the
// melee handler when the caller starts from a single cursor target but still
// wants the cone to deal collateral damage to anyone nearby.
export function expandSwingHitsAroundPrimary<T extends CollidableEntity>(
  arc: MeleeSwingArc,
  primary: T | undefined,
  candidates: readonly T[]
): T[] {
  const seen = new Set<unknown>();
  const out: T[] = [];
  if (primary) {
    seen.add(primary.id);
    out.push(primary);
  }
  for (const hit of entitiesInSwingArc(arc, candidates)) {
    if (!seen.has(hit.id)) {
      seen.add(hit.id);
      out.push(hit);
    }
  }
  return out;
}

// Used by tests + future projectile handler to decide whether a projectile
// should stop on first hit or pierce through. The rule book lets a rune turn
// a single-target projectile into a piercing one, so the policy is
// configurable.
export type ProjectileHitPolicy = "stopOnFirst" | "pierce";

export function applyProjectileHitPolicy<T extends CollidableEntity>(
  hits: readonly { entity: T; distance: number }[],
  policy: ProjectileHitPolicy
): { entity: T; distance: number }[] {
  if (policy === "stopOnFirst") {
    return hits.slice(0, 1);
  }
  return [...hits];
}
