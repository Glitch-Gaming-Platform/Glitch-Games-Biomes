import type { AskApi } from "@/server/ask/api";
import { loadWater } from "@/shared/game/terrain";
import { blockPos, voxelShard } from "@/shared/game/shard";
import type { VoxelooModule } from "@/shared/wasm/types";

/**
 * Resolve breath state from server-owned position and terrain. Browser water
 * flags are presentation hints only and can never cause or suppress damage.
 */
export async function serverDerivedHarthmereUnderwater(input: {
  askApi: Pick<AskApi, "scanForExport">;
  voxeloo: VoxelooModule;
  position: readonly [number, number, number] | undefined;
  height?: number;
}) {
  if (!input.position) return false;
  const height = Math.max(1, Number(input.height) || 1.8);
  const head = [
    Math.floor(input.position[0]),
    Math.floor(input.position[1] + height * 0.9),
    Math.floor(input.position[2]),
  ] as [number, number, number];
  const shardId = voxelShard(...head);
  try {
    for await (const [, lazyEntity] of input.askApi.scanForExport({
      aabb: [head, [head[0] + 1, head[1] + 1, head[2] + 1]],
    })) {
      const box = lazyEntity.box();
      if (
        !box ||
        voxelShard(...box.v0) !== shardId ||
        !lazyEntity.shardWater()
      ) {
        continue;
      }
      const water = loadWater(input.voxeloo, lazyEntity.materialize());
      try {
        return water.get(...blockPos(...head)) > 0;
      } finally {
        water.delete();
      }
    }
  } catch {
    // Fail safe: a missing terrain shard cannot let a stale client claim drown
    // a player. The scheduler retries on its next bounded tick.
  }
  return false;
}
