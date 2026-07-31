import normalLoader from "@/gen/shared/cpp_ext/voxeloo-normal/wasm";
import simdLoader from "@/gen/shared/cpp_ext/voxeloo-simd/wasm";
import { using, usingAll } from "@/shared/deletable";
import { fromBlockId, fromFloraId } from "@/shared/game/ids";
import { makeWasmMemory } from "@/shared/wasm/memory";
import { Tensor, TensorUpdate } from "@/shared/wasm/tensors";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";
import { readFile } from "fs/promises";
import path from "path";

type Loader = typeof simdLoader;

async function loadVariant(loader: Loader, variant: "normal" | "simd") {
  const wasmFile = path.resolve(
    __dirname,
    `../../../gen/shared/cpp_ext/voxeloo-${variant}/wasm.wasm`
  );
  const module = (await loader({
    wasmBinary: await readFile(wasmFile),
    wasmMemory: makeWasmMemory(128),
  })) as VoxelooModule;
  module.registerErrorLogger((error: string) => {
    throw new Error(`C++ error: ${error}`);
  });
  return module;
}

function paritySnapshot(voxeloo: VoxelooModule) {
  return using(Tensor.make(voxeloo, [32, 32, 32], "U32"), (terrain) => {
    const update = new TensorUpdate(terrain);
    update.set([1, 2, 3], fromBlockId(7));
    update.set([4, 5, 6], fromFloraId(11));
    update.apply();

    return using(voxeloo.findSurfaces(terrain.cpp), (surfaces) => ({
      shard: voxeloo.shardEncode([-12, 34, -56]),
      boundary: terrain.boundaryHash(),
      surfaces: Array.from({ length: surfaces.size() }, (_, index) =>
        surfaces.get(index)
      ),
    }));
  });
}

describe("Voxeloo generated binding contracts", () => {
  let normal: VoxelooModule;
  let simd: VoxelooModule;

  before(async function () {
    [normal, simd] = await Promise.all([
      loadVariant(normalLoader, "normal"),
      loadVariant(simdLoader, "simd"),
    ]);
  });

  afterEach(() => {
    assert.equal(normal.do_leak_check(), 0);
    assert.equal(simd.do_leak_check(), 0);
  });

  it("exports the declared Anima, Gaia, mapping, memory, and shard APIs", () => {
    for (const module of [normal, simd]) {
      for (const functionName of [
        "findSurfaces",
        "updateIrradiance",
        "updateOcclusion",
        "updateWater",
        "shardEncode",
        "shardDecode",
        "get_total_memory",
        "get_used_memory",
        "do_leak_check",
      ] as const) {
        assert.equal(typeof module[functionName], "function", functionName);
      }
      for (const constructorName of [
        "GaiaTerrainMapV2",
        "GaiaTerrainMapBuilderV2",
        "MapHeightsBuilder",
        "VoxelIdSet",
      ] as const) {
        assert.equal(
          typeof module[constructorName],
          "function",
          constructorName
        );
      }
      assert.ok(module.get_total_memory() >= module.get_used_memory());
    }
  });

  it("keeps normal and SIMD observable results identical", () => {
    assert.deepEqual(paritySnapshot(normal), paritySnapshot(simd));
  });

  it("maps terrain, flora, water, and muck heights through Embind", () => {
    const voxeloo = simd;
    usingAll(
      [
        new voxeloo.VoxelIdSet(),
        new voxeloo.VoxelIdSet(),
        Tensor.make(voxeloo, [32, 32, 32], "U32"),
        Tensor.make(voxeloo, [32, 32, 32], "U8"),
        Tensor.make(voxeloo, [32, 32, 32], "U8"),
      ],
      (blockFilter, floraFilter, terrain, water, muck) => {
        blockFilter.add(fromBlockId(7));
        floraFilter.add(fromFloraId(11));

        const terrainUpdate = new TensorUpdate(terrain);
        terrainUpdate.set([1, 2, 1], fromBlockId(7));
        terrainUpdate.set([2, 3, 2], fromFloraId(11));
        terrainUpdate.set([3, 9, 3], fromBlockId(99));
        terrainUpdate.apply();

        const waterUpdate = new TensorUpdate(water);
        waterUpdate.set([1, 5, 1], 1);
        waterUpdate.apply();

        const muckUpdate = new TensorUpdate(muck);
        muckUpdate.set([3, 6, 0], 1);
        muckUpdate.apply();

        using(
          new voxeloo.MapHeightsBuilder(
            [0, 0, 0],
            [4, 4],
            blockFilter,
            floraFilter
          ),
          (builder) => {
            builder.loadTerrain([0, 0, 0], terrain.cpp);
            builder.loadWater([0, 0, 0], water.cpp);
            builder.loadMuck([0, 0, 0], muck.cpp);
            using(builder.build(), (heights) => {
              assert.equal(heights.block()[1 + 4 * 1], 3);
              assert.equal(heights.flora()[2 + 4 * 2], 4);
              assert.equal(heights.water()[1 + 4 * 1], 6);
              assert.equal(heights.muck()[3 + 4 * 0], 7);
              assert.equal(heights.block()[3 + 4 * 3], 0);
            });
          }
        );
      }
    );
  });
});
