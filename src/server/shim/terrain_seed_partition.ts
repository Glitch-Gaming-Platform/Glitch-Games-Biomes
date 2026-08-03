import type { BiomesId } from "@/shared/ids";
import assert from "assert";

export function partitionTerrainSeedIds(
  ids: ReadonlySet<BiomesId>,
  partitionCount: number,
  partitionIndex: number
) {
  assert(
    Number.isInteger(partitionCount) && partitionCount > 0,
    "Terrain seed partition count must be a positive integer"
  );
  assert(
    Number.isInteger(partitionIndex) &&
      partitionIndex >= 0 &&
      partitionIndex < partitionCount,
    "Terrain seed partition index must belong to the partition count"
  );
  if (partitionCount === 1) {
    return new Set(ids);
  }
  const ordered = [...ids].sort((a, b) => a - b);
  return new Set(
    ordered.filter((_, index) => index % partitionCount === partitionIndex)
  );
}
