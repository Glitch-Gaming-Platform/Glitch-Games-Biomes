import type { ClientResources } from "@/client/game/resources/types";
import {
  SHARD_DIM,
  shardCenter,
  shardsForAABB,
  voxelShard,
} from "@/shared/game/shard";
import { ch1DetachedWorldBoundsAt } from "@/shared/harthmere/ch1_elsewhen_region";
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

/**
 * Elsewhen dungeons intentionally sit outside ordinary WorldMetadata and are
 * reachable only through signed fracture-gate warps. Once there, shard health
 * must use the occupied dungeon slot's finite detached bounds; filtering
 * against the mainland AABB makes every valid dungeon shard look missing and
 * causes an unnecessary recovery reload.
 */
export function playerShardLoadWorldAabb(
  ordinaryWorldAabb: ReadonlyAABB,
  playerAabb: ReadonlyAABB
): ReadonlyAABB {
  const centerX = (playerAabb[0][0] + playerAabb[1][0]) / 2;
  const centerZ = (playerAabb[0][2] + playerAabb[1][2]) / 2;
  const detached = ch1DetachedWorldBoundsAt([centerX, 0, centerZ]);
  return detached ? [detached.v0, detached.v1] : ordinaryWorldAabb;
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
  const ordinaryWorldAabb: ReadonlyAABB = [metadata.aabb.v0, metadata.aabb.v1];
  if (grow) {
    aabb = growAABB(aabb, grow);
  }
  const worldAabb = playerShardLoadWorldAabb(ordinaryWorldAabb, aabb);
  return Array.from(shardsForAABB(...aabb)).filter((shard) =>
    containsAABB(worldAabb, shardCenter(shard))
  );
}

function nearbyPlayerShards(resources: ClientResources, grow?: number) {
  const player = resources.get("/scene/local_player");
  const aabb = player.player.aabb();
  // Player positions describe their feet. Include the voxel immediately below
  // the body so a player standing exactly on a vertical shard boundary can use
  // the supporting terrain shard instead of appearing to be in empty space.
  return nearbyAabbShards(
    resources,
    [
      [aabb[0][0], aabb[0][1] - 1, aabb[0][2]],
      [aabb[1][0], aabb[1][1], aabb[1][2]],
    ],
    grow
  );
}

export function allAabbShardsLoaded(
  resources: ClientResources,
  aabb: AABB | undefined
) {
  let numShards = 0;
  for (const shard of nearbyAabbShards(resources, aabb)) {
    // The additive Harthmere world is intentionally sparse vertically. Missing
    // terrain entities are empty space, not terrain that is still loading.
    if (!resources.get("/ecs/terrain", shard)) {
      continue;
    }
    numShards += 1;
    if (!resources.get("/physics/boxes", shard)) {
      return false;
    }
  }
  return numShards > 0;
}

export function allPlayerShardsLoaded(resources: ClientResources) {
  let numShards = 0;
  for (const shard of nearbyPlayerShards(resources)) {
    if (!resources.get("/ecs/terrain", shard)) {
      continue;
    }
    numShards += 1;
    if (!resources.get("/physics/boxes", shard)) {
      return false;
    }
  }
  return numShards > 0;
}

export function allPlayerShardsMeshed(resources: ClientResources) {
  const player = resources.get("/scene/local_player");
  const [x, y, z] = player.player.position;
  const supportingShard = voxelShard(x, y - 1, z);
  if (!resources.get("/ecs/terrain", supportingShard)) {
    return false;
  }

  let numShards = 0;
  for (const shard of nearbyPlayerShards(resources, SHARD_DIM)) {
    // Do not block startup on absent neighboring shards. This is especially
    // important above the flat Harthmere extension, where the old all-shards
    // gate waited forever for an intentionally empty vertical shard.
    if (!resources.get("/ecs/terrain", shard)) {
      continue;
    }
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
    nearbyPlayerShards(resources, SHARD_DIM)
      .filter((shard) => resources.get("/ecs/terrain", shard) !== undefined)
      .map((shard) => resources.get("/terrain/combined_mesh", shard))
  );
}
