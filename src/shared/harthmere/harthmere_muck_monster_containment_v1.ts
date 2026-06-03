import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

// HARTHMERE_MUCK_MONSTER_CONTAINMENT_V1
//
// Hexes and Muckers must ONLY appear inside authored muck areas. Two things were
// letting them drift out in production:
//   1. The hostile-idle wander fallback (`DEFAULT_MEANDER_PARAMS`) lets a
//      combatant roam up to 16 blocks from spawn. Several muck zones are only
//      8–22 blocks in radius, so a monster spawned near the edge wanders clean
//      out of the muck and into the surrounding world.
//   2. The ECS seed had no muck-area gate, so any drifted/edited seed position
//      would spawn a monster wherever it happened to sit.
//
// This module is the single source of truth for the circular containment area
// around each muck zone. It is intentionally dependency-light (math types only)
// so the generic meander behavior can import it without creating a cycle. The
// radii mirror the authored muck/danger zones in `snapshot_runtime_rules_v74.ts`
// (plus the boxed West Muck Breach approximated as a circle that fits inside its
// bounds); `harthmere_muck_monster_containment_v1.test.ts` asserts they stay in
// sync with those canonical definitions.

export interface HarthmereMuckContainmentAreaV1 {
  id: string;
  center: ReadonlyVec3;
  radius: number;
}

export const HARTHMERE_MUCK_CONTAINMENT_MARGIN_METERS_V1 = 1.5;

export const HARTHMERE_MUCK_CONTAINMENT_AREAS_V1: readonly HarthmereMuckContainmentAreaV1[] =
  [
    { id: "road_muckwad_patch", center: [512, 54, -152], radius: 10 },
    { id: "watchtower_muck_patch", center: [332, 54, -390], radius: 16 },
    { id: "old_wood_muck_patch", center: [640, 54, -455], radius: 22 },
    { id: "watchtower_muck_clearing", center: [332, 54, -390], radius: 34 },
    { id: "old_wood_mucker_copse", center: [640, 54, -455], radius: 48 },
    { id: "gravewood_pale_muck", center: [640, 54, 120], radius: 42 },
    // West Muck Breach is authored as an axis-aligned box
    // (x:[180,292], z:[-560,-460]); this circle fits comfortably inside it.
    { id: "west_muck_breach", center: [236, 54, -506], radius: 46 },
  ] as const;

function distance2dV1(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[2]) - Number(b[2]));
}

function asVec3V1(value: ReadonlyVec3 | undefined): Vec3 | undefined {
  if (!Array.isArray(value) || value.length < 3) {
    return undefined;
  }
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

// The containment area a position sits inside, if any. When a position falls in
// several overlapping areas (the Watchtower and Old Wood zones each nest a small
// patch inside a larger clearing/copse), the largest is returned so a monster is
// never over-constrained below the muck territory it legitimately belongs to.
export function muckContainmentAreaForPositionV1(
  position: ReadonlyVec3 | undefined,
  pad = 0
): HarthmereMuckContainmentAreaV1 | undefined {
  const pos = asVec3V1(position);
  if (!pos) {
    return undefined;
  }
  let best: HarthmereMuckContainmentAreaV1 | undefined;
  for (const area of HARTHMERE_MUCK_CONTAINMENT_AREAS_V1) {
    if (distance2dV1(pos, area.center) <= area.radius + pad) {
      if (!best || area.radius > best.radius) {
        best = area;
      }
    }
  }
  return best;
}

export function isInsideMuckContainmentV1(
  position: ReadonlyVec3 | undefined,
  pad = 0
): boolean {
  return Boolean(muckContainmentAreaForPositionV1(position, pad));
}

// Pull a point back to within `radius - margin` of the area center on the XZ
// plane, preserving its Y. Points already inside are returned unchanged.
export function clampPointToMuckContainmentAreaV1(
  point: ReadonlyVec3,
  area: HarthmereMuckContainmentAreaV1,
  margin = HARTHMERE_MUCK_CONTAINMENT_MARGIN_METERS_V1
): Vec3 {
  const pos = asVec3V1(point);
  if (!pos) {
    return [area.center[0], area.center[1], area.center[2]];
  }
  const maxRadius = Math.max(0, area.radius - margin);
  const dx = pos[0] - area.center[0];
  const dz = pos[2] - area.center[2];
  const distance = Math.hypot(dx, dz);
  if (distance <= maxRadius || distance === 0) {
    return pos;
  }
  const scale = maxRadius / distance;
  return [area.center[0] + dx * scale, pos[1], area.center[2] + dz * scale];
}

// Clamp a candidate meander destination so a muck monster stays inside its muck
// area. Keyed off the NPC's home/spawn point (always seeded inside a muck zone)
// rather than its live position, so the leash is stable even mid-wander. For any
// NPC whose home is NOT in a muck area (every villager / town NPC) the
// destination is returned unchanged — this is a no-op outside the muck.
export function harthmereClampMeanderDestinationToMuckAreaV1(
  homePoint: ReadonlyVec3,
  destination: ReadonlyVec3,
  margin = HARTHMERE_MUCK_CONTAINMENT_MARGIN_METERS_V1
): Vec3 {
  const area = muckContainmentAreaForPositionV1(homePoint, 0);
  if (!area) {
    return asVec3V1(destination) ?? [
      destination[0],
      destination[1],
      destination[2],
    ];
  }
  return clampPointToMuckContainmentAreaV1(destination, area, margin);
}
