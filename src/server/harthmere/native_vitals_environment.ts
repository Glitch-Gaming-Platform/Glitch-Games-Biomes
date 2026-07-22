import type { AskApi } from "@/server/ask/api";
import { loadWater } from "@/shared/game/terrain";
import { blockPos, voxelShard } from "@/shared/game/shard";
import type { VoxelooModule } from "@/shared/wasm/types";

const UNDERWATER_CACHE_TTL_MS = 1_500;
const underwaterByHeadBlock = new Map<
  string,
  { expiresAtMs: number; value: Promise<boolean> }
>();

export function resetHarthmereUnderwaterCacheForTest() {
  underwaterByHeadBlock.clear();
}

/**
 * Resolve breath state from server-owned position and terrain. Browser water
 * flags are presentation hints only and can never cause or suppress damage.
 */
export async function serverDerivedHarthmereUnderwater(input: {
  askApi: Pick<AskApi, "scanForExport">;
  voxeloo: VoxelooModule;
  position: readonly [number, number, number] | undefined;
  height?: number;
  nowMs?: number;
  cacheTtlMs?: number;
}) {
  if (!input.position) return false;
  const height = Math.max(1, Number(input.height) || 1.8);
  const head = [
    Math.floor(input.position[0]),
    Math.floor(input.position[1] + height * 0.9),
    Math.floor(input.position[2]),
  ] as [number, number, number];
  const shardId = voxelShard(...head);
  const nowMs = input.nowMs ?? Date.now();
  const cacheKey = head.join(":");
  const cached = underwaterByHeadBlock.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.value;
  }
  const value = (async () => {
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
  })();
  if (underwaterByHeadBlock.size >= 4_096) {
    for (const [key, entry] of underwaterByHeadBlock) {
      if (entry.expiresAtMs <= nowMs) underwaterByHeadBlock.delete(key);
    }
  }
  underwaterByHeadBlock.set(cacheKey, {
    expiresAtMs:
      nowMs + Math.max(0, input.cacheTtlMs ?? UNDERWATER_CACHE_TTL_MS),
    value,
  });
  return value;
}
