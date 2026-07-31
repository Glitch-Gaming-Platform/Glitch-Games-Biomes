import { loadVoxeloo } from "@/server/shared/voxeloo";
import { getTerrainID } from "@/shared/asset_defs/terrain";
import { using } from "@/shared/deletable";
import { Tensor, TensorUpdate } from "@/shared/wasm/tensors";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("Anima Voxeloo boundary", () => {
  let voxeloo: VoxelooModule;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("reuses a single server-side Voxeloo module", async () => {
    assert.strictEqual(await loadVoxeloo(), voxeloo);
  });

  it("extracts exposed terrain surfaces and excludes covered or top-boundary voxels", () => {
    using(Tensor.make(voxeloo, [32, 32, 32], "U32"), (terrain) => {
      const update = new TensorUpdate(terrain);
      update.set([1, 1, 1], getTerrainID("dirt"));
      update.set([2, 1, 2], getTerrainID("grass"));
      update.set([2, 2, 2], getTerrainID("stone"));
      update.set([3, 31, 3], getTerrainID("dirt"));
      update.apply();

      using(voxeloo.findSurfaces(terrain.cpp), (surfacePoints) => {
        const surfaces = Array.from(
          { length: surfacePoints.size() },
          (_, index) => surfacePoints.get(index)
        );

        assert.deepEqual(surfaces, [
          { position: [1, 1, 1], terrainId: getTerrainID("dirt") },
          { position: [2, 2, 2], terrainId: getTerrainID("stone") },
        ]);
      });
    });
  });
});
