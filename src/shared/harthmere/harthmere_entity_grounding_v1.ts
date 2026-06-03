import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

// HARTHMERE_ENTITY_GROUNDING_V1
//
// One terrain-aware grounder for EVERY positioned thing — NPCs, muckers/hexers,
// quest monsters, quest items, drops, markers. The old approach stamped a flat
// authored Y (muck centers at 54, Grove at 70) and patched it with constant
// offsets (e.g. the Grove-only "-17" mucker hack). That floats or buries
// entities on hilly terrain and at the Grove/wilds height seam (≈70 vs ≈53).
//
// Instead, given a sampler of the real voxel terrain, this finds the actual
// surface column at the entity's (x,z) and rests the entity ON it. Because it
// probes the REAL terrain, the Grove-vs-wilds height difference and arbitrary
// hills resolve automatically — no per-zone constants. The core is a pure
// function so it can be unit-tested against synthetic terrain.

// True when the voxel at (x,y,z) is solid (occupied). The caller adapts the real
// terrain tensor / occupancy resource into this predicate.
export type HarthmereSolidSamplerV1 = (
  x: number,
  y: number,
  z: number
) => boolean;

// Default vertical search budget. Generous enough to bridge the Grove(≈70) /
// wilds(≈53) seam and real hills, while still bounded for performance. A scan
// that exceeds this returns undefined so the caller can keep the authored Y
// rather than teleporting an entity onto an unrelated far surface.
export const HARTHMERE_GROUND_SCAN_DOWN_DEFAULT_V1 = 72;
export const HARTHMERE_GROUND_SCAN_UP_DEFAULT_V1 = 56;

// How many clear (air) blocks must sit above a candidate surface's head for it to
// count as an OPEN-SKY surface (i.e. the real outdoor ground rather than a cave
// floor whose ceiling is just above it). Cave pockets are typically capped within
// a few blocks; the outdoor surface has open air far above. Trees with very low
// collidable canopy and ≤N-block-tall enclosed structures are the documented
// edge cases — see harthmere_entity_grounding_manifest_v1.ts.
export const HARTHMERE_SKY_CLEARANCE_DEFAULT_V1 = 5;

export interface HarthmereGroundProbeOptionsV1 {
  // Authored / stored Y used as the search anchor (the entity's current Y).
  hintY: number;
  maxScanDown?: number;
  maxScanUp?: number;
  // CAVE-SAFETY: when true, only accept a surface that has open sky above it, so
  // an entity is never grounded onto a cave floor that lies under solid terrain.
  // Use for OUTDOOR entities (muckers, wild NPCs, quest items/monsters, markers).
  // Leave false for entities whose hint is a deliberate enclosed level — e.g. a
  // business owner standing on a building floor under a roof.
  requireOpenSky?: boolean;
  skyClearance?: number;
}

// An entity's feet can rest at `feetY` when there is solid ground directly below
// and clear (non-solid) space at the feet and head blocks. This matches the
// existing `/terrain/pathfinding/human_can_occupy` rule so behavior is uniform.
export function harthmereCanStandAtV1(
  isSolid: HarthmereSolidSamplerV1,
  x: number,
  feetY: number,
  z: number
): boolean {
  return (
    isSolid(x, feetY - 1, z) &&
    !isSolid(x, feetY, z) &&
    !isSolid(x, feetY + 1, z)
  );
}

// Lower-level scan over a "can my feet rest at this Y?" predicate. The client
// passes the existing `/terrain/pathfinding/human_can_occupy` checker directly so
// there is exactly one definition of "standable" across the whole game.
export function findHarthmereGroundFeetYByCanStandV1(
  canStandAtFeetY: (feetY: number) => boolean,
  options: HarthmereGroundProbeOptionsV1
): number | undefined {
  const hintY = Math.round(options.hintY);
  if (!Number.isFinite(hintY)) {
    return undefined;
  }
  const down = Math.max(
    0,
    Math.floor(options.maxScanDown ?? HARTHMERE_GROUND_SCAN_DOWN_DEFAULT_V1)
  );
  const up = Math.max(
    0,
    Math.floor(options.maxScanUp ?? HARTHMERE_GROUND_SCAN_UP_DEFAULT_V1)
  );
  const max = Math.max(down, up);
  for (let offset = 0; offset <= max; offset += 1) {
    if (offset <= down && canStandAtFeetY(hintY - offset)) {
      return hintY - offset;
    }
    if (offset > 0 && offset <= up && canStandAtFeetY(hintY + offset)) {
      return hintY + offset;
    }
  }
  return undefined;
}

// Find the standing feet-Y nearest the hint: drop onto the ground just below the
// hint, or climb out if the hint is buried inside terrain. Ties prefer the lower
// (drop-onto-ground) surface. Returns undefined if no standable surface is found
// within the scan budget (e.g. a cliff taller than the budget, or an ungenerated
// column), so the caller can fall back to the authored Y.
export function findHarthmereGroundFeetYV1(
  isSolid: HarthmereSolidSamplerV1,
  x: number,
  z: number,
  options: HarthmereGroundProbeOptionsV1
): number | undefined {
  const requireOpenSky = options.requireOpenSky ?? false;
  const skyClearance = Math.max(
    0,
    Math.floor(options.skyClearance ?? HARTHMERE_SKY_CLEARANCE_DEFAULT_V1)
  );
  const accept = (feetY: number): boolean => {
    if (!harthmereCanStandAtV1(isSolid, x, feetY, z)) {
      return false;
    }
    if (!requireOpenSky) {
      return true;
    }
    // Reject cave floors: their ceiling (solid terrain) sits within the sky
    // clearance above the head. The outdoor surface has only air above.
    for (let k = 2; k <= 1 + skyClearance; k += 1) {
      if (isSolid(x, feetY + k, z)) {
        return false;
      }
    }
    return true;
  };
  return findHarthmereGroundFeetYByCanStandV1(accept, options);
}

// Ground a full position: keep X/Z, replace Y with the sampled feet-Y (plus an
// optional hover, e.g. for floating quest markers). Falls back to the original Y
// when no surface is found so nothing teleports.
export function groundHarthmereEntityPositionV1(
  isSolid: HarthmereSolidSamplerV1,
  position: ReadonlyVec3,
  options?: {
    maxScanDown?: number;
    maxScanUp?: number;
    hoverBlocks?: number;
    requireOpenSky?: boolean;
    skyClearance?: number;
  }
): Vec3 {
  const feetY = findHarthmereGroundFeetYV1(isSolid, position[0], position[2], {
    hintY: position[1],
    maxScanDown: options?.maxScanDown,
    maxScanUp: options?.maxScanUp,
    requireOpenSky: options?.requireOpenSky,
    skyClearance: options?.skyClearance,
  });
  if (feetY === undefined) {
    return [position[0], position[1], position[2]];
  }
  return [position[0], feetY + (options?.hoverBlocks ?? 0), position[2]];
}
