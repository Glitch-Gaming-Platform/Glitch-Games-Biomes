import type { Vec3 } from "@/shared/math/types";

export type SnapshotNpcGroundingRepair = number | Readonly<Vec3>;

export function snapshotNpcGroundingRepairTarget(
  currentPosition: Readonly<Vec3>,
  repair: SnapshotNpcGroundingRepair
): Vec3 {
  return typeof repair === "number"
    ? [currentPosition[0], repair, currentPosition[2]]
    : [...repair];
}

function positionMatches(
  current: Readonly<Vec3> | undefined,
  target: Readonly<Vec3>,
  tolerance: number
) {
  return (
    current !== undefined &&
    target.every(
      (value, index) => Math.abs(current[index] - value) <= tolerance
    )
  );
}

export function snapshotNpcGroundingRepairSatisfied(input: {
  currentPosition: Readonly<Vec3>;
  spawnPosition?: Readonly<Vec3>;
  repair: SnapshotNpcGroundingRepair;
  tolerance?: number;
}) {
  const tolerance = input.tolerance ?? 0.25;
  const target = snapshotNpcGroundingRepairTarget(
    input.currentPosition,
    input.repair
  );
  return (
    positionMatches(input.currentPosition, target, tolerance) &&
    (typeof input.repair === "number" ||
      positionMatches(input.spawnPosition, target, tolerance))
  );
}
