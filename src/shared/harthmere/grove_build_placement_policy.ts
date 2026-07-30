/**
 * Shared Grove construction keepout used by robots, player buildings, and the
 * nineteen authored Harthmere businesses.
 *
 * The restored snapshot contains two migrated Grover protection records with
 * the same 160-voxel X span and 160/224-voxel Z spans. Use the larger observed
 * footprint so a stale migration row can never make the client advertise land
 * that the authoritative protection robot rejects. Player robots additionally
 * inspect the neighboring 32-voxel protection cells, so construction uses the
 * same clearance around the protected footprint for predictable placement.
 */
export const GROVE_BUILD_PROTECTION_BOUNDS = Object.freeze({
  xMin: 420.5,
  xMax: 580.5,
  zMin: -233.5,
  zMax: -9.5,
});

export const GROVE_BUILD_MINIMUM_CLEARANCE_METERS = 32;

export const GROVE_BUILD_RESERVE_BOUNDS = Object.freeze({
  xMin:
    GROVE_BUILD_PROTECTION_BOUNDS.xMin - GROVE_BUILD_MINIMUM_CLEARANCE_METERS,
  xMax:
    GROVE_BUILD_PROTECTION_BOUNDS.xMax + GROVE_BUILD_MINIMUM_CLEARANCE_METERS,
  zMin:
    GROVE_BUILD_PROTECTION_BOUNDS.zMin - GROVE_BUILD_MINIMUM_CLEARANCE_METERS,
  zMax:
    GROVE_BUILD_PROTECTION_BOUNDS.zMax + GROVE_BUILD_MINIMUM_CLEARANCE_METERS,
});

/**
 * Verified low-risk Muck destination for the original Gimme Shelter placement
 * step. The old Road Muckwad patch at [512, 54, -152] is inside the Grove's
 * protection footprint; this Watchtower clearing is outside the full reserve.
 */
export const NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION = [
  332, 54, -390,
] as const;

export interface HarthmereXZBounds {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export function harthmereXZBoundsOverlap(
  a: HarthmereXZBounds,
  b: HarthmereXZBounds
) {
  return (
    a.xMin < b.xMax && a.xMax > b.xMin && a.zMin < b.zMax && a.zMax > b.zMin
  );
}

export function harthmereBoundsOverlapGroveBuildReserve(
  bounds: HarthmereXZBounds
) {
  return harthmereXZBoundsOverlap(bounds, GROVE_BUILD_RESERVE_BOUNDS);
}

export function harthmerePointInsideGroveBuildReserve(position: {
  x: number;
  z: number;
}) {
  return (
    position.x >= GROVE_BUILD_RESERVE_BOUNDS.xMin &&
    position.x <= GROVE_BUILD_RESERVE_BOUNDS.xMax &&
    position.z >= GROVE_BUILD_RESERVE_BOUNDS.zMin &&
    position.z <= GROVE_BUILD_RESERVE_BOUNDS.zMax
  );
}
