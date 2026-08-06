import type { ClientResources } from "@/client/game/resources/types";
import { terrainCollides } from "@/shared/asset_defs/quirk_helpers";
import type { CutsceneVec3 } from "@/shared/cutscene/schema";
import {
  promoCameraDollySamples,
  promoCameraSightlineSamples,
  promoTerrainViewColumns,
  type PromoCameraClearanceSpec,
  type PromoTerrainViewSpec,
} from "@/shared/cutscene/promo_terrain_view";
import { blockPos, voxelShard } from "@/shared/game/shard";
import { sleep } from "@/shared/util/async";

export interface PromoTerrainProofStatus {
  shardCount: number;
  missingTerrainEntities: number;
  missingOccluders: number;
  missingMeshes: number;
}

export interface PromoTerrainViewStatus {
  columnCount: number;
  shardCount: number;
  missingTerrainColumns: number;
  missingOccluderColumns: number;
  missingMeshColumns: number;
}

export interface PromoCameraTerrainStatus {
  dollySamples: number;
  sightlineSamples: number;
  missingTerrainVoxels: number;
  cameraCollisionVoxels: number;
  sightlineCollisionVoxels: number;
  firstCameraCollision?: readonly [number, number, number];
  firstSightlineCollision?: readonly [number, number, number];
}

const PROMO_CAMERA_CLEARANCE_OFFSETS: readonly CutsceneVec3[] = Object.freeze([
  [0, 0, 0],
  [0.35, 0, 0],
  [-0.35, 0, 0],
  [0, 0.35, 0],
  [0, -0.35, 0],
  [0, 0, 0.35],
  [0, 0, -0.35],
]);

function promoCameraTerrainVoxel(
  resources: ClientResources,
  point: CutsceneVec3
): {
  loaded: boolean;
  solid: boolean;
  voxel: readonly [number, number, number];
} {
  const voxel = point.map(Math.floor) as [number, number, number];
  const tensor = resources.get("/terrain/tensor", voxelShard(...voxel));
  if (!tensor) {
    return { loaded: false, solid: false, voxel };
  }
  const terrainId = tensor.get(...blockPos(...voxel));
  return {
    loaded: true,
    solid: terrainId !== undefined && terrainCollides(terrainId),
    voxel,
  };
}

function promoCameraLerp(
  from: CutsceneVec3,
  to: CutsceneVec3,
  t: number
): CutsceneVec3 {
  return from.map(
    (value, axis) => value + (to[axis] - value) * t
  ) as CutsceneVec3;
}

export function promoCameraTerrainStatus(
  resources: ClientResources,
  spec: PromoCameraClearanceSpec
): PromoCameraTerrainStatus {
  const missing = new Set<string>();
  const cameraCollisions = new Map<string, readonly [number, number, number]>();
  const sightlineCollisions = new Map<
    string,
    readonly [number, number, number]
  >();

  const dolly = promoCameraDollySamples(spec);
  for (const position of dolly) {
    for (const offset of PROMO_CAMERA_CLEARANCE_OFFSETS) {
      const point = position.map(
        (value, axis) => value + offset[axis]
      ) as CutsceneVec3;
      const result = promoCameraTerrainVoxel(resources, point);
      const key = result.voxel.join(",");
      if (!result.loaded) {
        missing.add(key);
      } else if (result.solid) {
        cameraCollisions.set(key, result.voxel);
      }
    }
  }

  const sightlines = promoCameraSightlineSamples(spec);
  for (const { camera, distance, checkUntil } of sightlines) {
    for (let along = 0.5; along < checkUntil; along += 0.25) {
      const result = promoCameraTerrainVoxel(
        resources,
        promoCameraLerp(camera, spec.target, along / distance)
      );
      const key = result.voxel.join(",");
      if (!result.loaded) {
        missing.add(key);
      } else if (result.solid) {
        sightlineCollisions.set(key, result.voxel);
        break;
      }
    }
  }

  return {
    dollySamples: dolly.length,
    sightlineSamples: sightlines.length,
    missingTerrainVoxels: missing.size,
    cameraCollisionVoxels: cameraCollisions.size,
    sightlineCollisionVoxels: sightlineCollisions.size,
    firstCameraCollision: cameraCollisions.values().next().value,
    firstSightlineCollision: sightlineCollisions.values().next().value,
  };
}

export async function waitForPromoCameraTerrainClearance(
  resources: ClientResources,
  spec: PromoCameraClearanceSpec | undefined,
  timeoutMs = 60_000
): Promise<void> {
  if (!spec) {
    return;
  }
  const deadline = performance.now() + timeoutMs;
  let status = promoCameraTerrainStatus(resources, spec);
  while (performance.now() < deadline) {
    if (
      status.cameraCollisionVoxels > 0 ||
      status.sightlineCollisionVoxels > 0
    ) {
      throw new Error(
        `promo camera intersects terrain: ${JSON.stringify(status)}`
      );
    }
    if (status.missingTerrainVoxels === 0) {
      return;
    }
    await sleep(100);
    status = promoCameraTerrainStatus(resources, spec);
  }
  throw new Error(
    `promo camera terrain clearance timed out: ${JSON.stringify(status)}`
  );
}

export function promoTerrainProofShardIds(
  proofs: readonly CutsceneVec3[] | undefined
) {
  return [...new Set((proofs ?? []).map((point) => voxelShard(...point)))];
}

export function promoTerrainProofStatus(
  resources: ClientResources,
  proofs: readonly CutsceneVec3[] | undefined
): PromoTerrainProofStatus {
  const shards = promoTerrainProofShardIds(proofs);
  let missingTerrainEntities = 0;
  let missingOccluders = 0;
  let missingMeshes = 0;
  for (const shard of shards) {
    if (!resources.get("/ecs/terrain", shard)) {
      missingTerrainEntities += 1;
      continue;
    }
    if (!resources.cached("/terrain/occluder", shard)) {
      missingOccluders += 1;
    }
    const combined = resources.cached("/terrain/combined_mesh", shard);
    if (!combined?.some(Boolean)) {
      missingMeshes += 1;
    }
  }
  return {
    shardCount: shards.length,
    missingTerrainEntities,
    missingOccluders,
    missingMeshes,
  };
}

/**
 * Marketing stills must fail closed when the visible landscape is absent.
 * Ordinary cutscene prewarm deliberately treats missing sparse-world shards as
 * empty space, which is correct for gameplay but allowed a hero still to save
 * one isolated terrain slab over void. These explicit proof points require the
 * authored terrain entity, occlusion resource, and at least one rendered mesh.
 */
export async function waitForPromoTerrainProofs(
  resources: ClientResources,
  proofs: readonly CutsceneVec3[] | undefined,
  timeoutMs = 60_000
): Promise<void> {
  const shards = promoTerrainProofShardIds(proofs);
  if (shards.length === 0) {
    return;
  }
  const deadline = performance.now() + timeoutMs;
  let status = promoTerrainProofStatus(resources, proofs);
  while (performance.now() < deadline) {
    await Promise.allSettled(
      shards
        .filter((shard) => resources.get("/ecs/terrain", shard))
        .flatMap((shard) => [
          resources.get("/terrain/occluder", shard),
          resources.get("/terrain/combined_mesh", shard),
        ])
    );
    status = promoTerrainProofStatus(resources, proofs);
    if (
      status.missingTerrainEntities === 0 &&
      status.missingOccluders === 0 &&
      status.missingMeshes === 0
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`promo terrain proof timed out: ${JSON.stringify(status)}`);
}

function promoTerrainViewShardColumns(view: PromoTerrainViewSpec) {
  return promoTerrainViewColumns(view).map(({ point }) => [
    // The retained terrain survey around Helix measured visible surfaces from
    // Y=5 through Y=78. The camera target can sit in the middle vertical shard
    // while the landscape being photographed belongs to the band below it.
    voxelShard(point[0], point[1] - 32, point[2]),
    voxelShard(...point),
    // Hills frequently cross the next vertical shard as well. Accept the
    // column when any neighboring vertical band contains a visible mesh.
    voxelShard(point[0], point[1] + 32, point[2]),
  ]);
}

export function promoTerrainViewStatus(
  resources: ClientResources,
  view: PromoTerrainViewSpec
): PromoTerrainViewStatus {
  const columns = promoTerrainViewShardColumns(view);
  const uniqueShards = new Set(columns.flat());
  let missingTerrainColumns = 0;
  let missingOccluderColumns = 0;
  let missingMeshColumns = 0;
  for (const column of columns) {
    const present = column.filter((shard) =>
      resources.get("/ecs/terrain", shard)
    );
    if (present.length === 0) {
      missingTerrainColumns += 1;
      continue;
    }
    if (
      !present.some((shard) => resources.cached("/terrain/occluder", shard))
    ) {
      missingOccluderColumns += 1;
    }
    if (
      !present.some((shard) =>
        resources.cached("/terrain/combined_mesh", shard)?.some(Boolean)
      )
    ) {
      missingMeshColumns += 1;
    }
  }
  return {
    columnCount: columns.length,
    shardCount: uniqueShards.size,
    missingTerrainColumns,
    missingOccluderColumns,
    missingMeshColumns,
  };
}

/**
 * A marketing frame needs the terrain behind the subject, not only the shard
 * under its feet. Warm a bounded three-lane view wedge through 112m and fail
 * closed until every sampled column has a terrain entity, occluder, and at
 * least one non-empty combined mesh in the lower/local/upper vertical bands.
 */
export async function waitForPromoTerrainView(
  resources: ClientResources,
  view: PromoTerrainViewSpec | undefined,
  timeoutMs = 60_000
): Promise<void> {
  if (!view) {
    return;
  }
  const columns = promoTerrainViewShardColumns(view);
  const shards = [...new Set(columns.flat())];
  const deadline = performance.now() + timeoutMs;
  let status = promoTerrainViewStatus(resources, view);
  while (performance.now() < deadline) {
    const present = shards.filter((shard) =>
      resources.get("/ecs/terrain", shard)
    );
    // Keep this bounded and serial by batch. Large parallel mesh builds can
    // starve software WebGL and recreate the loading hang this gate prevents.
    for (let start = 0; start < present.length; start += 4) {
      await Promise.allSettled(
        present
          .slice(start, start + 4)
          .flatMap((shard) => [
            resources.get("/terrain/occluder", shard),
            resources.get("/terrain/combined_mesh", shard),
          ])
      );
    }
    status = promoTerrainViewStatus(resources, view);
    if (
      status.missingTerrainColumns === 0 &&
      status.missingOccluderColumns === 0 &&
      status.missingMeshColumns === 0
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`promo terrain view timed out: ${JSON.stringify(status)}`);
}
