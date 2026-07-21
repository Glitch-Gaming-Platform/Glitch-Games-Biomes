import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

// HARTHMERE_ADDITIVE_WORLD_EXTENSION
//
// The imported production map currently ends at X=1792. Harthmere is authored
// in X=192..768, so a shard-aligned +1600 transform places the first town
// terrain shard exactly at that edge instead of painting over an existing
// production shard. The extra 192 blocks before X=2560 leave room for roads,
// walls, and future bible additions without another metadata migration.
export const HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION =
  "harthmere-additive-world-extension-v1" as const;
export const HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X = 1792;
export const HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X = 2560;
export const HARTHMERE_ADDITIVE_TOWN_OFFSET_X = 1600;
export const HARTHMERE_ADDITIVE_TOWN_OFFSET_Z = 0;
export const HARTHMERE_EXTENSION_GROUND_Y = 52;
export const HARTHMERE_EXTENSION_FEET_Y = HARTHMERE_EXTENSION_GROUND_Y + 1;
export const HARTHMERE_EXTENSION_SHARD_SIZE = 32;

export const HARTHMERE_EXTENSION_WORLD_BOUNDS = {
  minX: HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  maxX: HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  minZ: -512,
  maxZ: 192,
} as const;

// The visible generated road begins exactly at the old/new map boundary and
// terminates at Harthmere's authored west gate. Both endpoints and the final
// North Gate destination are exposed as world-map landmarks.
export const HARTHMERE_EXTENSION_ROAD = {
  authoredStart: [192, -209] as const,
  worldStart: [1792, -209] as const,
  worldBoundaryHandoff: [1792, -209] as const,
  authoredWestGate: [392, -209] as const,
  worldWestGate: [1992, -209] as const,
  authoredNorthGate: [500, -284] as const,
  worldNorthGate: [2100, -284] as const,
} as const;

// The four negative-Y Bellbound quest anchors form one continuous authored
// dungeon below the chapel. The server carves a switchback stair through this
// volume and adds a landing under every target, so shifted quest coordinates
// cannot point into unseeded stone.
export const HARTHMERE_BELLBINDER_DESCENT = {
  authoredBounds: {
    minX: 476,
    maxX: 504,
    minZ: -168,
    maxZ: -136,
  },
  minRelativeY: -114,
  maxRelativeY: -1,
  surfaceOpeningCenter: [480, HARTHMERE_EXTENSION_GROUND_Y, -137] as const,
  authoredQuestFeetPositions: [
    [480, -6, -137],
    [486, -14, -151],
    [490, -26, -155],
    [500, -60, -160],
  ] as const,
} as const;

export function harthmereBellbinderStairLoop(): ReadonlyArray<
  readonly [number, number]
> {
  const points: Array<readonly [number, number]> = [];
  for (let x = 480; x <= 503; x += 1) points.push([x, -137]);
  for (let z = -138; z >= -167; z -= 1) points.push([503, z]);
  for (let x = 502; x >= 477; x -= 1) points.push([x, -167]);
  for (let z = -166; z <= -137; z += 1) points.push([477, z]);
  for (let x = 478; x <= 479; x += 1) points.push([x, -137]);
  return points;
}

/**
 * Solid authored floor blocks for the continuous chapel-to-Wyrm-Bed route.
 * Returning data rather than hiding the geometry in the shim lets contracts
 * prove every stair has two blocks of clearance before a deployment.
 */
export function harthmereBellbinderDescentFloorBlocks(): Vec3[] {
  const blocks = new Map<string, Vec3>();
  const set = (x: number, y: number, z: number) =>
    blocks.set(`${x}:${y}:${z}`, [x, y, z]);
  const stairLoop = harthmereBellbinderStairLoop();

  for (let step = 0; step <= 112; step += 1) {
    const [x, z] = stairLoop[step % stairLoop.length];
    set(x, HARTHMERE_EXTENSION_GROUND_Y - 1 - step, z);
  }

  for (const [
    targetX,
    targetFeetY,
    targetZ,
  ] of HARTHMERE_BELLBINDER_DESCENT.authoredQuestFeetPositions) {
    const floorY = targetFeetY - 1;
    for (let x = targetX - 3; x <= targetX + 3; x += 1) {
      for (let z = targetZ - 3; z <= targetZ + 3; z += 1) {
        set(x, floorY, z);
      }
    }

    const step = HARTHMERE_EXTENSION_GROUND_Y - targetFeetY;
    const [stairX, stairZ] = stairLoop[step % stairLoop.length];
    const [innerX, innerZ] =
      stairZ === -137
        ? [stairX, stairZ - 1]
        : stairX === 503
        ? [stairX - 1, stairZ]
        : stairZ === -167
        ? [stairX, stairZ + 1]
        : [stairX + 1, stairZ];
    set(innerX, floorY, innerZ);
    for (
      let x = Math.min(innerX, targetX);
      x <= Math.max(innerX, targetX);
      x += 1
    ) {
      set(x, floorY, innerZ);
    }
    for (
      let z = Math.min(innerZ, targetZ);
      z <= Math.max(innerZ, targetZ);
      z += 1
    ) {
      set(targetX, floorY, z);
    }
  }

  return [...blocks.values()];
}

export interface HarthmereWorldAabb {
  v0: ReadonlyVec3;
  v1: ReadonlyVec3;
}

/**
 * Authoritative bounds for an otherwise empty world that is bootstrapping the
 * additive Harthmere map for the first time. These match the client and map-API
 * fallbacks, while already including the east-side extension.
 */
export function initialHarthmereWorldAabb(): { v0: Vec3; v1: Vec3 } {
  return {
    v0: [-2048, -256, -2048],
    v1: [HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X, 512, 2048],
  };
}

export function shouldEnableHarthmereAdditiveWorldExtension(
  env: Record<string, string | undefined> = typeof process === "undefined"
    ? {}
    : process.env
): boolean {
  return !(
    env.NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET === "1" ||
    env.BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET === "1" ||
    env.NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN === "1" ||
    env.BIOMES_HARTHMERE_STANDALONE_TOWN === "1"
  );
}

/**
 * Grow only the positive-X world boundary. This intentionally preserves every
 * existing bound so enabling Harthmere cannot crop or relocate current land.
 */
export function expandWorldAabbForHarthmere(current: HarthmereWorldAabb): {
  v0: Vec3;
  v1: Vec3;
} {
  return {
    v0: [...current.v0],
    v1: [
      Math.max(current.v1[0], HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X),
      current.v1[1],
      current.v1[2],
    ],
  };
}

/**
 * Terrain seeding is allowed only in the new east band. The exclusive max is
 * important because a shard beginning at X=2560 belongs to future expansion.
 */
export function isHarthmereExtensionWorldShardX(shardX: number): boolean {
  const worldMinX = shardX * HARTHMERE_EXTENSION_SHARD_SIZE;
  return (
    worldMinX >= HARTHMERE_EXTENSION_WORLD_BOUNDS.minX &&
    worldMinX < HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX
  );
}

export function harthmereExtensionAuthoredShardXRange(offsetX: number): {
  min: number;
  max: number;
} {
  return {
    min: Math.ceil(
      (HARTHMERE_EXTENSION_WORLD_BOUNDS.minX - offsetX) /
        HARTHMERE_EXTENSION_SHARD_SIZE
    ),
    max:
      Math.ceil(
        (HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX - offsetX) /
          HARTHMERE_EXTENSION_SHARD_SIZE
      ) - 1,
  };
}

/**
 * Quest catalogs use Y=0 as "resolve me to the outdoor surface" and negative
 * values for authored underways/cave levels. The additive town has a known
 * flat surface, so outdoor targets can resolve deterministically without the
 * obsolete +512 production placement scan.
 */
export function normalizeHarthmereExtensionQuestWorldPosition(
  position: ReadonlyVec3
): Vec3 {
  return [
    position[0],
    position[1] === 0 ? HARTHMERE_EXTENSION_FEET_Y : position[1],
    position[2],
  ];
}
