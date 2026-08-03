import { partitionTerrainSeedIds } from "@/server/shim/terrain_seed_partition";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("partitionTerrainSeedIds", () => {
  it("assigns every id to exactly one stable partition", () => {
    const ids = new Set([9, 2, 7, 4, 5, 1, 8, 3, 6] as BiomesId[]);
    const partitions = Array.from({ length: 4 }, (_, index) =>
      partitionTerrainSeedIds(ids, 4, index)
    );
    const combined = partitions.flatMap((partition) => [...partition]);
    assert.deepEqual([...new Set(combined)].sort((a, b) => a - b), [
      ...ids,
    ].sort((a, b) => a - b));
    assert.equal(combined.length, ids.size);
    assert.deepEqual([...partitions[0]], [1, 5, 9]);
  });

  it("rejects invalid partition coordinates", () => {
    assert.throws(() => partitionTerrainSeedIds(new Set(), 0, 0));
    assert.throws(() => partitionTerrainSeedIds(new Set(), 2, 2));
  });
});
