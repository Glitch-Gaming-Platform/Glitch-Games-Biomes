// HARTHMERE_EXTENSION_EDGE_HORIZON
//
// The imported snapshot keeps real terrain west of X=1792 well beyond the
// additive town's north/south range. East of that seam, however, WorldMetadata
// still describes a large rectangle while Harthmere only seeds Z=-576..191.
// The result is a vertical terrain cut into completely missing shards. Players
// could cross that cut from the old map, fall into the notch, persist there,
// and then reload forever around an undefined terrain shard.
//
// Collision owns gameplay safety. This module owns only the unreachable land
// behind that collision: a short rising ridge that hides the outer end of the
// generated strip and makes the snapshot landscape appear to continue east.

import {
  harthmereLinearBoundary,
  harthmereUpwardBiasedNoise,
} from "@/shared/harthmere/harthmere_horizon_noise";
import {
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_SHARD_SIZE,
  HARTHMERE_EXTENSION_TERRAIN_ID_GRID,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} from "@/shared/harthmere/world_extension";

export const HARTHMERE_EXTENSION_EDGE_HORIZON_VERSION =
  "harthmere-extension-edge-horizon-v1" as const;

// Four shards are enough to fill a 192-block draw distance because the strip
// rises into an occluding ridge before its far edge. Keeping it bounded avoids
// generating the entire rectangular metadata notch as playable-looking land.
export const HARTHMERE_EXTENSION_EDGE_HORIZON_DEPTH = 128;
export const HARTHMERE_EXTENSION_EDGE_HORIZON_FEATHER = 72;
export const HARTHMERE_EXTENSION_EDGE_HORIZON_MAX_SURFACE_Y = 122;

export type HarthmereExtensionEdgeHorizonRegion = "south" | "north";
export type HarthmereExtensionEdgeHorizonMaterial =
  "grass" | "moss" | "dirt" | "stone" | "gravel" | "cobblestone";

export const HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS = Object.freeze({
  minX: HARTHMERE_EXTENSION_WORLD_BOUNDS.minX,
  maxX: HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX,
  southMinZ:
    HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ -
    HARTHMERE_EXTENSION_EDGE_HORIZON_DEPTH,
  southMaxZ: HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
  northMinZ: HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ,
  northMaxZ:
    HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ +
    HARTHMERE_EXTENSION_EDGE_HORIZON_DEPTH,
});

export function harthmereExtensionEdgeHorizonRegionAt(
  worldX: number,
  worldZ: number
): HarthmereExtensionEdgeHorizonRegion | undefined {
  const bounds = HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS;
  if (worldX < bounds.minX || worldX >= bounds.maxX) {
    return undefined;
  }
  if (worldZ >= bounds.southMinZ && worldZ < bounds.southMaxZ) {
    return "south";
  }
  if (worldZ >= bounds.northMinZ && worldZ < bounds.northMaxZ) {
    return "north";
  }
  return undefined;
}

export function harthmereExtensionEdgeHorizonDistance(
  region: HarthmereExtensionEdgeHorizonRegion,
  worldZ: number
) {
  return region === "south"
    ? HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ - worldZ
    : worldZ - HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ + 1;
}

export function harthmereExtensionEdgeHorizonSurfaceY(
  worldX: number,
  worldZ: number
): number | undefined {
  const region = harthmereExtensionEdgeHorizonRegionAt(worldX, worldZ);
  if (!region) {
    return undefined;
  }
  const distance = harthmereExtensionEdgeHorizonDistance(region, worldZ);
  const feather = harthmereLinearBoundary(
    distance,
    HARTHMERE_EXTENSION_EDGE_HORIZON_FEATHER
  );
  const longForm = harthmereUpwardBiasedNoise(
    `harthmere_${region}_edge_long`,
    worldX,
    worldZ,
    176,
    [12, 8, 4, 2]
  );
  const brokenGround = harthmereUpwardBiasedNoise(
    `harthmere_${region}_edge_detail`,
    worldX,
    worldZ,
    72,
    [6, 4, 2, 1]
  );
  // The first row meets Harthmere's Y=52 plane. Farther into the unreachable
  // strip, even the lowest sample rises enough to hide the strip's outer end.
  const lift = feather * (36 + longForm * 30 + brokenGround * 12);
  return Math.min(
    HARTHMERE_EXTENSION_EDGE_HORIZON_MAX_SURFACE_Y,
    Math.round(HARTHMERE_EXTENSION_GROUND_Y + lift)
  );
}

export function harthmereExtensionEdgeHorizonBlockAt(
  worldX: number,
  worldY: number,
  worldZ: number
): HarthmereExtensionEdgeHorizonMaterial | undefined {
  const region = harthmereExtensionEdgeHorizonRegionAt(worldX, worldZ);
  const surface = harthmereExtensionEdgeHorizonSurfaceY(worldX, worldZ);
  if (!region || surface === undefined || worldY > surface) {
    return undefined;
  }
  const depth = surface - worldY;
  if (depth === 0) {
    if (surface >= HARTHMERE_EXTENSION_GROUND_Y + 46) {
      return "stone";
    }
    const scree = harthmereUpwardBiasedNoise(
      `harthmere_${region}_edge_scree`,
      worldX,
      worldZ,
      44,
      [5, 3, 1]
    );
    if (scree > 0.74) {
      return "gravel";
    }
    return region === "south" ? "moss" : "grass";
  }
  if (depth <= 3) {
    return "dirt";
  }
  if (depth <= 7 && (worldX + worldZ) % 7 === 0) {
    return "cobblestone";
  }
  return "stone";
}

/**
 * Runtime shard coordinates for the two visual strips. They are deliberately
 * outside the playable Z bounds but inside the already-reserved stable terrain
 * id grid, so adding them never remaps an existing terrain entity.
 */
export function harthmereExtensionEdgeHorizonShardSpecs(): Array<{
  shardX: number;
  shardY: number;
  shardZ: number;
}> {
  const specs: Array<{ shardX: number; shardY: number; shardZ: number }> = [];
  const bounds = HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS;
  const zRanges = [
    [bounds.southMinZ, bounds.southMaxZ - 1],
    [bounds.northMinZ, bounds.northMaxZ - 1],
  ] as const;
  for (
    let shardX = HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardX;
    shardX <= HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardX;
    shardX += 1
  ) {
    for (const [minZ, maxZ] of zRanges) {
      for (
        let shardZ = Math.floor(minZ / HARTHMERE_EXTENSION_SHARD_SIZE);
        shardZ <= Math.floor(maxZ / HARTHMERE_EXTENSION_SHARD_SIZE);
        shardZ += 1
      ) {
        for (let shardY = -2; shardY <= 3; shardY += 1) {
          specs.push({ shardX, shardY, shardZ });
        }
      }
    }
  }
  return specs;
}
