import type { BiomesId } from "@/shared/ids";
import {
  HARTHMERE_EXTENSION_SHARD_SIZE,
  HARTHMERE_EXTENSION_TERRAIN_ID_GRID,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  harthmereExtensionTerrainEntityIdForShard,
} from "@/shared/harthmere/world_extension";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const LOCAL_DEV_TERRAIN_ID_BASE = 8_810_000_000_000_000 as BiomesId;
const LOCAL_DEV_TERRAIN_SHARD_COUNT = 98;

function previousExtensionFoundationTerrainIdForShard(
  shardX: number,
  shardY: number,
  shardZ: number
): BiomesId | undefined {
  const minShardZ = Math.floor(
    HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ / HARTHMERE_EXTENSION_SHARD_SIZE
  );
  const maxShardZ =
    Math.ceil(
      HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ /
        HARTHMERE_EXTENSION_SHARD_SIZE
    ) - 1;
  if (
    shardX < HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardX ||
    shardX > HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardX ||
    shardY < -2 ||
    shardY > 1 ||
    shardZ < minShardZ ||
    shardZ > maxShardZ
  ) {
    return undefined;
  }

  // The retired additive band assigned ids in the exact order used by
  // harthmereExtensionFoundationShardSpecs(): X, then Z, then Y=-2..1.
  // Reconstructing that one nearby id is O(1); scanning the whole 10,000-row
  // retired band every loader poll would recreate the startup CPU problem.
  const zCount = maxShardZ - minShardZ + 1;
  const offset =
    ((shardX - HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardX) * zCount +
      (shardZ - minShardZ)) *
      4 +
    (shardY + 2);
  const id = HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE + offset;
  return id < HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT
    ? (id as BiomesId)
    : undefined;
}

export function localDevStarterTerrainIdsNearPositionForTest(
  position: ReadonlyVec3
): BiomesId[] {
  const shardX = Math.floor(position[0] / HARTHMERE_EXTENSION_SHARD_SIZE);
  const shardY = Math.floor(position[1] / HARTHMERE_EXTENSION_SHARD_SIZE);
  const shardZ = Math.floor(position[2] / HARTHMERE_EXTENSION_SHARD_SIZE);
  const ids = new Set<BiomesId>();

  // Check both the feet shard and the supporting shard. At the flat Harthmere
  // surface those are usually the same Y shard, while upper floors can straddle
  // the boundary at Y=64.
  for (const candidateY of [shardY, shardY - 1]) {
    const current = harthmereExtensionTerrainEntityIdForShard(
      shardX,
      candidateY,
      shardZ
    );
    if (current !== undefined) {
      ids.add(current as BiomesId);
    }
    const previous = previousExtensionFoundationTerrainIdForShard(
      shardX,
      candidateY,
      shardZ
    );
    if (previous !== undefined) {
      ids.add(previous);
    }
  }
  return [...ids];
}

/**
 * Detect the fixed synthetic starter-town shard range without importing the
 * client bootstrap. This stays pure so loader regression tests cannot inherit
 * browser globals from unrelated UI suites during Mocha collection.
 */
export function hasLocalDevStarterTerrain(context: {
  table: { has(id: BiomesId): boolean };
  playerPosition?: ReadonlyVec3;
}) {
  if (context.playerPosition) {
    for (const id of localDevStarterTerrainIdsNearPositionForTest(
      context.playerPosition
    )) {
      if (context.table.has(id)) {
        return true;
      }
    }
  }
  for (let i = 0; i < LOCAL_DEV_TERRAIN_SHARD_COUNT; i += 1) {
    if (context.table.has((LOCAL_DEV_TERRAIN_ID_BASE + i) as BiomesId)) {
      return true;
    }
  }
  return false;
}
