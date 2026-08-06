import {
  promoCameraTerrainStatus,
  promoTerrainProofShardIds,
  promoTerrainProofStatus,
  promoTerrainViewStatus,
} from "@/client/game/cutscene/promo_terrain_readiness";
import { promoTerrainViewColumns } from "@/shared/cutscene/promo_terrain_view";
import type { ClientResources } from "@/client/game/resources/types";
import { voxelShard } from "@/shared/game/shard";
import assert from "assert";

describe("promo terrain readiness", () => {
  const proofs = [
    [200, 32, -538],
    [264, 32, -474],
  ] as const;

  it("deduplicates proof points by native terrain shard", () => {
    assert.equal(
      promoTerrainProofShardIds([
        [200, 32, -538],
        [201, 33, -537],
      ]).length,
      1
    );
    assert.equal(promoTerrainProofShardIds(proofs).length, 2);
  });

  it("requires an entity, occluder, and non-empty combined mesh for every proof", () => {
    const shards = promoTerrainProofShardIds(proofs);
    const terrain = new Set([shards[0]]);
    const occluders = new Set([shards[0]]);
    const meshes = new Map([
      [shards[0], [{}, undefined, undefined, undefined]],
    ]);
    const resources = {
      get(path: string, shard: string) {
        return path === "/ecs/terrain" && terrain.has(shard) ? {} : undefined;
      },
      cached(path: string, shard: string) {
        if (path === "/terrain/occluder") {
          return occluders.has(shard) ? {} : undefined;
        }
        if (path === "/terrain/combined_mesh") {
          return meshes.get(shard);
        }
        return undefined;
      },
    } as unknown as ClientResources;

    assert.deepEqual(promoTerrainProofStatus(resources, proofs), {
      shardCount: 2,
      missingTerrainEntities: 1,
      missingOccluders: 0,
      missingMeshes: 0,
    });

    terrain.add(shards[1]!);
    assert.deepEqual(promoTerrainProofStatus(resources, proofs), {
      shardCount: 2,
      missingTerrainEntities: 0,
      missingOccluders: 1,
      missingMeshes: 1,
    });
  });

  it("requires visible meshes across the camera-facing terrain wedge", () => {
    const terrain = new Set<string>();
    const occluders = new Set<string>();
    const meshes = new Map<string, unknown[]>();
    const resources = {
      get(path: string, shard: string) {
        return path === "/ecs/terrain" && terrain.has(shard) ? {} : undefined;
      },
      cached(path: string, shard: string) {
        if (path === "/terrain/occluder") {
          return occluders.has(shard) ? {} : undefined;
        }
        if (path === "/terrain/combined_mesh") {
          return meshes.get(shard);
        }
        return undefined;
      },
    } as unknown as ClientResources;
    const view = {
      camera: [0, 40, 0] as [number, number, number],
      target: [10, 32, 0] as [number, number, number],
      verticalFov: 40,
      farMeters: 64,
    };
    const initial = promoTerrainViewStatus(resources, view);
    assert.equal(initial.columnCount, 6);
    assert.equal(initial.missingTerrainColumns, 6);

    // Populate the lower vertical band for every sampled column. Duplicate
    // camera columns share shards, so use the status' unique shard count as the
    // completion contract rather than assuming one shard per sample.
    for (const { point } of promoTerrainViewColumns(view)) {
      const shard = voxelShard(...point);
      terrain.add(shard);
      occluders.add(shard);
      meshes.set(shard, [{ visible: true }]);
    }
    assert.deepEqual(promoTerrainViewStatus(resources, view), {
      columnCount: 6,
      shardCount: initial.shardCount,
      missingTerrainColumns: 0,
      missingOccluderColumns: 0,
      missingMeshColumns: 0,
    });
  });

  it("rejects a camera dolly voxel embedded in streamed terrain", () => {
    const solid = new Set(["3,10,2"]);
    const tensor = {
      get(x: number, y: number, z: number) {
        return solid.has(`${x},${y},${z}`) ? 1 : 0;
      },
    };
    const resources = {
      get(path: string) {
        return path === "/terrain/tensor" ? tensor : undefined;
      },
    } as unknown as ClientResources;
    const status = promoCameraTerrainStatus(resources, {
      cameraFar: [2, 10, 2],
      cameraNear: [4, 10, 2],
      target: [20, 10, 2],
      bossBodyRadius: 1,
    });
    assert.ok(status.cameraCollisionVoxels > 0);
    assert.deepEqual(status.firstCameraCollision, [3, 10, 2]);
  });

  it("rejects terrain between a clear dolly and the subject", () => {
    const solid = new Set(["12,10,2"]);
    const tensor = {
      get(x: number, y: number, z: number) {
        return solid.has(`${x},${y},${z}`) ? 1 : 0;
      },
    };
    const resources = {
      get(path: string) {
        return path === "/terrain/tensor" ? tensor : undefined;
      },
    } as unknown as ClientResources;
    const status = promoCameraTerrainStatus(resources, {
      cameraFar: [2, 10, 2],
      cameraNear: [4, 10, 2],
      target: [20, 10, 2],
      bossBodyRadius: 1,
    });
    assert.equal(status.cameraCollisionVoxels, 0);
    assert.ok(status.sightlineCollisionVoxels > 0);
    assert.deepEqual(status.firstSightlineCollision, [12, 10, 2]);
  });

  it("waits when the camera path terrain tensor is not loaded", () => {
    const resources = {
      get() {
        return undefined;
      },
    } as unknown as ClientResources;
    const status = promoCameraTerrainStatus(resources, {
      cameraFar: [2, 10, 2],
      cameraNear: [4, 10, 2],
      target: [20, 10, 2],
      bossBodyRadius: 1,
    });
    assert.ok(status.missingTerrainVoxels > 0);
    assert.equal(status.cameraCollisionVoxels, 0);
    assert.equal(status.sightlineCollisionVoxels, 0);
  });
});
