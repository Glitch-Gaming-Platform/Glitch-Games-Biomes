import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

// HARTHMERE_ENTITY_GROUNDING
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
export type HarthmereSolidSampler = (
  x: number,
  y: number,
  z: number
) => boolean;

// Default vertical search budget. Generous enough to bridge the Grove(≈70) /
// wilds(≈53) seam and real hills, while still bounded for performance. A scan
// that exceeds this returns undefined so the caller can keep the authored Y
// rather than teleporting an entity onto an unrelated far surface.
export const HARTHMERE_GROUND_SCAN_DOWN_DEFAULT = 72;
export const HARTHMERE_GROUND_SCAN_UP_DEFAULT = 56;

// How many clear (air) blocks must sit above a candidate surface's head for it to
// count as an OPEN-SKY surface (i.e. the real outdoor ground rather than a cave
// floor whose ceiling is just above it). Cave pockets are typically capped within
// a few blocks; the outdoor surface has open air far above. Trees with very low
// collidable canopy and ≤N-block-tall enclosed structures are the documented
// edge cases — see harthmere_entity_grounding_manifest.ts.
export const HARTHMERE_SKY_CLEARANCE_DEFAULT = 5;

export interface HarthmereGroundProbeOptions {
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
export function harthmereCanStandAt(
  isSolid: HarthmereSolidSampler,
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
export function findHarthmereGroundFeetYByCanStand(
  canStandAtFeetY: (feetY: number) => boolean,
  options: HarthmereGroundProbeOptions
): number | undefined {
  const hintY = Math.round(options.hintY);
  if (!Number.isFinite(hintY)) {
    return undefined;
  }
  const down = Math.max(
    0,
    Math.floor(options.maxScanDown ?? HARTHMERE_GROUND_SCAN_DOWN_DEFAULT)
  );
  const up = Math.max(
    0,
    Math.floor(options.maxScanUp ?? HARTHMERE_GROUND_SCAN_UP_DEFAULT)
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
export function findHarthmereGroundFeetY(
  isSolid: HarthmereSolidSampler,
  x: number,
  z: number,
  options: HarthmereGroundProbeOptions
): number | undefined {
  const requireOpenSky = options.requireOpenSky ?? false;
  const skyClearance = Math.max(
    0,
    Math.floor(options.skyClearance ?? HARTHMERE_SKY_CLEARANCE_DEFAULT)
  );
  const accept = (feetY: number): boolean => {
    if (!harthmereCanStandAt(isSolid, x, feetY, z)) {
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
  return findHarthmereGroundFeetYByCanStand(accept, options);
}

// Tri-state grounding result. The crucial distinction the flat-Y bug missed:
// "no-surface" (terrain IS loaded but there is genuinely no standable column in
// budget — keep authored Y) vs "not-loaded" (the column's terrain has not
// streamed in yet — the authored Y is unverified, so callers should DEFER/hide
// the entity and retry, NOT stamp the flat authored Y, which is what made quest
// items float above or sink below the real ground).
export type HarthmereGroundStatus = "grounded" | "no-surface" | "not-loaded";

export interface HarthmereGroundResult {
  status: HarthmereGroundStatus;
  feetY?: number;
}

// Reports whether the voxel column around the entity has been loaded yet. The
// caller adapts the real terrain resource (e.g. `/terrain/tensor` for the shard
// === undefined). Sampled across the vertical scan window the grounder probes.
export type HarthmereLoadedSampler = (
  x: number,
  y: number,
  z: number
) => boolean;

// Like findHarthmereGroundFeetY but returns a tri-state. If any voxel the scan
// would consult is not loaded AND no standable surface was found among loaded
// voxels, it returns "not-loaded" so the caller can defer rather than trust the
// authored hint. Once a real surface is found in loaded terrain it returns
// "grounded" regardless of unloaded voxels elsewhere in the window.
export function findHarthmereGroundFeetYWithStatus(
  isSolid: HarthmereSolidSampler,
  isLoaded: HarthmereLoadedSampler,
  x: number,
  z: number,
  options: HarthmereGroundProbeOptions
): HarthmereGroundResult {
  const feetY = findHarthmereGroundFeetY(isSolid, x, z, options);
  if (feetY !== undefined) {
    return { status: "grounded", feetY };
  }
  // No surface found. Decide whether that is because terrain is genuinely empty
  // here or simply not streamed in: if any voxel in the scan window is unloaded,
  // treat it as not-loaded so the marker is deferred instead of left at hintY.
  const hintY = Math.round(options.hintY);
  const down = Math.max(
    0,
    Math.floor(options.maxScanDown ?? HARTHMERE_GROUND_SCAN_DOWN_DEFAULT)
  );
  const up = Math.max(
    0,
    Math.floor(options.maxScanUp ?? HARTHMERE_GROUND_SCAN_UP_DEFAULT)
  );
  for (let y = hintY - down - 1; y <= hintY + up + 1; y += 1) {
    if (!isLoaded(x, y, z)) {
      return { status: "not-loaded" };
    }
  }
  return { status: "no-surface" };
}

// Ground a full position: keep X/Z, replace Y with the sampled feet-Y (plus an
// optional hover, e.g. for floating quest markers). Falls back to the original Y
// when no surface is found so nothing teleports.
export function groundHarthmereEntityPosition(
  isSolid: HarthmereSolidSampler,
  position: ReadonlyVec3,
  options?: {
    maxScanDown?: number;
    maxScanUp?: number;
    hoverBlocks?: number;
    requireOpenSky?: boolean;
    skyClearance?: number;
  }
): Vec3 {
  const feetY = findHarthmereGroundFeetY(isSolid, position[0], position[2], {
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
