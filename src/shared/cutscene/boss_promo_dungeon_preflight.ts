import type { CutsceneVec3 } from "@/shared/cutscene/schema";
import {
  promoCameraDollySamples,
  promoCameraSightlineSamples,
  type PromoCameraClearanceSpec,
} from "@/shared/cutscene/promo_terrain_view";
import {
  ch1DungeonBlockAt,
  ch1DungeonWorldToAuthored,
} from "@/shared/harthmere/ch1_dungeon_terrain";

export interface BossPromoDungeonCameraInput extends PromoCameraClearanceSpec {
  dungeonId: string;
}

export interface BossPromoDungeonVoxelHit {
  kind: "camera" | "sightline";
  sample: number;
  voxel: readonly [number, number, number];
  material: string;
}

export interface BossPromoDungeonCameraPreflight {
  cameraHits: readonly BossPromoDungeonVoxelHit[];
  sightlineHits: readonly BossPromoDungeonVoxelHit[];
  issues: readonly string[];
}

const CAMERA_CLEARANCE_OFFSETS: readonly CutsceneVec3[] = Object.freeze([
  [0, 0, 0],
  [0.35, 0, 0],
  [-0.35, 0, 0],
  [0, 0.35, 0],
  [0, -0.35, 0],
  [0, 0, 0.35],
  [0, 0, -0.35],
]);

function add(a: CutsceneVec3, b: CutsceneVec3): CutsceneVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function lerp(from: CutsceneVec3, to: CutsceneVec3, t: number): CutsceneVec3 {
  return from.map(
    (value, axis) => value + (to[axis] - value) * t
  ) as CutsceneVec3;
}

function voxelAt(
  dungeonId: string,
  worldPosition: CutsceneVec3
): { voxel: readonly [number, number, number]; material?: string } {
  const authored = ch1DungeonWorldToAuthored(dungeonId, worldPosition);
  const voxel = [
    Math.floor(authored.x),
    Math.floor(authored.y),
    Math.floor(authored.z),
  ] as const;
  return {
    voxel,
    material: ch1DungeonBlockAt(dungeonId, ...voxel),
  };
}

function uniqueHits(
  hits: readonly BossPromoDungeonVoxelHit[]
): readonly BossPromoDungeonVoxelHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.kind}:${hit.sample}:${hit.voxel.join(",")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Reject camera brackets that enter canonical Elsewhen terrain or shoot
 * through it. This is intentionally an offline structural gate: runtime decor,
 * streamed mesh readiness, actor grounding, and final composition still need
 * the live cutscene-generator review.
 */
export function preflightBossPromoDungeonCamera(
  input: BossPromoDungeonCameraInput
): BossPromoDungeonCameraPreflight {
  const cameraHits: BossPromoDungeonVoxelHit[] = [];
  const sightlineHits: BossPromoDungeonVoxelHit[] = [];

  for (const [sample, position] of promoCameraDollySamples(input).entries()) {
    for (const offset of CAMERA_CLEARANCE_OFFSETS) {
      const hit = voxelAt(input.dungeonId, add(position, offset));
      if (hit.material) {
        cameraHits.push({
          kind: "camera",
          sample,
          voxel: hit.voxel,
          material: hit.material,
        });
      }
    }
  }

  for (const {
    sample,
    camera,
    distance,
    checkUntil,
  } of promoCameraSightlineSamples(input)) {
    for (let along = 0.5; along < checkUntil; along += 0.25) {
      const hit = voxelAt(
        input.dungeonId,
        lerp(camera, input.target, along / distance)
      );
      if (hit.material) {
        sightlineHits.push({
          kind: "sightline",
          sample,
          voxel: hit.voxel,
          material: hit.material,
        });
        break;
      }
    }
  }

  const uniqueCameraHits = uniqueHits(cameraHits);
  const uniqueSightlineHits = uniqueHits(sightlineHits);
  const issues: string[] = [];
  if (uniqueCameraHits.length > 0) {
    const first = uniqueCameraHits[0]!;
    issues.push(
      `camera dolly enters ${first.material} terrain at authored voxel ${first.voxel.join(
        ","
      )}`
    );
  }
  if (uniqueSightlineHits.length > 0) {
    const first = uniqueSightlineHits[0]!;
    issues.push(
      `camera sightline crosses ${first.material} terrain at authored voxel ${first.voxel.join(
        ","
      )}`
    );
  }

  return {
    cameraHits: uniqueCameraHits,
    sightlineHits: uniqueSightlineHits,
    issues,
  };
}
