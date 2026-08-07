import { getTerrainID } from "@/shared/asset_defs/terrain";
import { blockIsEmptyInTensor } from "@/shared/game/terrain_helper";
import { blockPos, voxelShard } from "@/shared/game/shard";
import {
  HARTHMERE_EXOTIC_MATTER_CAVES,
  isHarthmereAdditiveTownExoticMatterCave,
  type HarthmereExoticMatterBounds,
} from "@/shared/harthmere/exotic_matter_caves";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  isHarthmereExtensionWorldPosition,
} from "@/shared/harthmere/world_extension";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

// Environmental audio deliberately uses conservative terrain tests. A single
// roof voxel must not turn every house into a cave, and a player-built snow
// block at sea level must not start summit wind.
export const CAVE_SKY_OCCLUSION_MIN = 8;
export const CAVE_CEILING_SEARCH_BLOCKS = 24;
export const CAVE_OVERBURDEN_SAMPLE_BLOCKS = 7;
export const CAVE_OVERBURDEN_MIN_SOLID_BLOCKS = 4;
// Harthmere's additive surface is fixed at feet Y=53, so Y<25 is safely deep
// there. The broader world intentionally uses the more generous Y<20 product
// rule even though the production scan includes some low open-sky terrain.
export const HARTHMERE_CAVE_MUSIC_FALLBACK_BELOW_Y = 25;
export const WORLD_CAVE_MUSIC_FALLBACK_BELOW_Y = 15;
export const MOUNTAIN_WIND_MAX_SKY_OCCLUSION = 1;
export const MOUNTAIN_WIND_SNOW_MIN_Y = 100;
export const MOUNTAIN_WIND_HIGH_ALTITUDE_MIN_Y = 118;

// The first six cave bounds were authored in town-local coordinates. The
// remaining user-confirmed caves were recorded against the retired +512 town
// layout, so their current additive-world authored X is 512 blocks lower.
const HARTHMERE_LEGACY_CAVE_SCAN_OFFSET_X = 512;
type TerrainAudioDeps = {
  get(path: any, shard: any): any;
};

function inBounds(position: ReadonlyVec3, bounds: HarthmereExoticMatterBounds) {
  return (
    position[0] >= bounds.x0 &&
    position[0] <= bounds.x1 &&
    position[1] >= bounds.y0 &&
    position[1] <= bounds.y1 &&
    position[2] >= bounds.z0 &&
    position[2] <= bounds.z1
  );
}

export function knownHarthmereCaveAt(position: ReadonlyVec3) {
  const direct = HARTHMERE_EXOTIC_MATTER_CAVES.find((cave) =>
    inBounds(position, cave.bounds)
  );
  if (direct || !isHarthmereExtensionWorldPosition(position)) {
    return direct;
  }

  const authoredX = position[0] - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  return HARTHMERE_EXOTIC_MATTER_CAVES.find((cave) => {
    const caveX = isHarthmereAdditiveTownExoticMatterCave(cave.caveId)
      ? authoredX
      : authoredX + HARTHMERE_LEGACY_CAVE_SCAN_OFFSET_X;
    return inBounds([caveX, position[1], position[2]], cave.bounds);
  });
}

export function caveMusicFallbackBelowY(position: ReadonlyVec3) {
  return isHarthmereExtensionWorldPosition(position)
    ? HARTHMERE_CAVE_MUSIC_FALLBACK_BELOW_Y
    : WORLD_CAVE_MUSIC_FALLBACK_BELOW_Y;
}

function terrainSolidAt(
  deps: TerrainAudioDeps,
  x: number,
  y: number,
  z: number
): boolean | undefined {
  try {
    const block: Vec3 = [x, y, z];
    const tensor = deps.get("/terrain/tensor", voxelShard(...block));
    if (tensor === undefined) {
      return undefined;
    }
    return !blockIsEmptyInTensor(block, tensor);
  } catch {
    return undefined;
  }
}

function terrainIdAt(
  deps: TerrainAudioDeps,
  x: number,
  y: number,
  z: number
): number | undefined {
  try {
    const block: Vec3 = [x, y, z];
    const tensor = deps.get("/terrain/tensor", voxelShard(...block));
    return tensor?.get(...blockPos(...block));
  } catch {
    return undefined;
  }
}

function skyOcclusionAt(
  deps: TerrainAudioDeps,
  x: number,
  y: number,
  z: number
): number | undefined {
  try {
    const block: Vec3 = [x, y, z];
    const tensor = deps.get("/lighting/sky_occlusion", voxelShard(...block));
    return tensor?.get(...blockPos(...block));
  } catch {
    return undefined;
  }
}

export function hasThickCaveOverburden(
  isSolid: (x: number, y: number, z: number) => boolean | undefined,
  position: ReadonlyVec3
) {
  const x = Math.floor(position[0]);
  const z = Math.floor(position[2]);
  const headY = Math.floor(position[1] + 1.5);

  for (let offset = 1; offset <= CAVE_CEILING_SEARCH_BLOCKS; offset += 1) {
    const first = isSolid(x, headY + offset, z);
    if (first === undefined) {
      return false;
    }
    if (!first) {
      continue;
    }
    let solidBlocks = 0;
    for (let sample = 0; sample < CAVE_OVERBURDEN_SAMPLE_BLOCKS; sample += 1) {
      if (isSolid(x, headY + offset + sample, z)) {
        solidBlocks += 1;
      }
    }
    return solidBlocks >= CAVE_OVERBURDEN_MIN_SOLID_BLOCKS;
  }
  return false;
}

/**
 * Exact authored cave bounds first, then the regional deep-world cutoffs,
 * then a conservative terrain fallback for higher unregistered caves.
 */
export function isCaveAudioEnvironment(
  deps: TerrainAudioDeps,
  position: ReadonlyVec3
) {
  if (knownHarthmereCaveAt(position)) {
    return true;
  }
  if (position[1] < caveMusicFallbackBelowY(position)) {
    return true;
  }
  const x = Math.floor(position[0]);
  const y = Math.floor(position[1] + 1.5);
  const z = Math.floor(position[2]);
  const skyOcclusion = skyOcclusionAt(deps, x, y, z);
  if (skyOcclusion === undefined || skyOcclusion < CAVE_SKY_OCCLUSION_MIN) {
    return false;
  }
  return hasThickCaveOverburden(
    (sx, sy, sz) => terrainSolidAt(deps, sx, sy, sz),
    position
  );
}

/**
 * Summit wind is limited to open-sky, terrain-supported high positions. Snow
 * permits the lower threshold because generated snow_peak columns occur only
 * on the inner, high part of mountain regions. Rocky summits use the stricter
 * absolute-altitude fallback.
 */
export function isMountainTopAudioEnvironment(
  deps: TerrainAudioDeps,
  position: ReadonlyVec3,
  inCave = false
) {
  if (inCave || position[1] < MOUNTAIN_WIND_SNOW_MIN_Y) {
    return false;
  }
  const x = Math.floor(position[0]);
  const z = Math.floor(position[2]);
  const headY = Math.floor(position[1] + 1.5);
  const skyOcclusion = skyOcclusionAt(deps, x, headY, z);
  if (
    skyOcclusion === undefined ||
    skyOcclusion > MOUNTAIN_WIND_MAX_SKY_OCCLUSION
  ) {
    return false;
  }

  const supportY = Math.floor(position[1] - 0.05);
  const supportId = terrainIdAt(deps, x, supportY, z);
  if (!supportId) {
    return false;
  }
  if (
    supportId === getTerrainID("snow") &&
    position[1] >= MOUNTAIN_WIND_SNOW_MIN_Y
  ) {
    return true;
  }
  return position[1] >= MOUNTAIN_WIND_HIGH_ALTITUDE_MIN_Y;
}
