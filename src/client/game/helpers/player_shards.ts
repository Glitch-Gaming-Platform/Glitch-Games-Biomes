import type { ClientResources } from "@/client/game/resources/types";
import { SHARD_DIM, shardCenter, shardsForAABB } from "@/shared/game/shard";
import { containsAABB, growAABB } from "@/shared/math/linear";
import type { AABB, ReadonlyAABB } from "@/shared/math/types";

export const PLAYER_SHARD_RECOVERY_DELAY_MS = 8_000;

export function shouldRequestPlayerShardRecovery(input: {
  missingSince?: number;
  now: number;
  alreadyRequested: boolean;
  delayMs?: number;
}) {
  return (
    !input.alreadyRequested &&
    input.missingSince !== undefined &&
    input.now - input.missingSince >=
      (input.delayMs ?? PLAYER_SHARD_RECOVERY_DELAY_MS)
  );
}

function nearbyAabbShards(
  resources: ClientResources,
  aabb: AABB | undefined,
  grow?: number
) {
  if (!aabb) {
    return [];
  }

  const metadata = resources.get("/ecs/metadata");
  const worldAabb: ReadonlyAABB = [metadata.aabb.v0, metadata.aabb.v1];
  if (grow) {
    aabb = growAABB(aabb, grow);
  }
  return Array.from(shardsForAABB(...aabb)).filter((shard) =>
    containsAABB(worldAabb, shardCenter(shard))
  );
}

function nearbyPlayerShards(resources: ClientResources, grow?: number) {
  const player = resources.get("/scene/local_player");
  return nearbyAabbShards(resources, player.player.aabb(), grow);
}

export function allAabbShardsLoaded(
  resources: ClientResources,
  aabb: AABB | undefined
) {
  let numShards = 0;
  for (const shard of nearbyAabbShards(resources, aabb)) {
    numShards += 1;
    if (!resources.get("/physics/boxes", shard)) {
      return false;
    }
  }
  return numShards > 0;
}

export function allPlayerShardsLoaded(resources: ClientResources) {
  const player = resources.get("/scene/local_player");
  return allAabbShardsLoaded(resources, player.player.aabb());
}

export function allPlayerShardsMeshed(resources: ClientResources) {
  let numShards = 0;
  for (const shard of nearbyPlayerShards(resources, SHARD_DIM)) {
    numShards += 1;
    if (!resources.get("/physics/boxes", shard)) {
      return false;
    }
    if (!resources.cached("/terrain/combined_mesh", shard)) {
      return false;
    }
  }
  return numShards > 0;
}

export async function triggerPlayerShardsMesh(resources: ClientResources) {
  await Promise.all(
    nearbyPlayerShards(resources, SHARD_DIM).map((shard) =>
      resources.get("/terrain/combined_mesh", shard)
    )
  );
}
