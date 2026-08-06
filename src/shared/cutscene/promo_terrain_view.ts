import { samplePolyline } from "@/shared/cutscene/math";
import type { CutsceneVec3 } from "@/shared/cutscene/schema";

export const PROMO_TERRAIN_VIEW_FAR_METERS = 112;
export const PROMO_TERRAIN_VIEW_DEPTHS = [32, 64, 96, 112] as const;
export const PROMO_TERRAIN_VIEW_LANES = [-0.55, 0, 0.55] as const;
export const PROMO_CAMERA_DOLLY_SAMPLES = 17;
export const PROMO_CAMERA_SIGHTLINE_SAMPLES = 3;

export interface PromoTerrainViewSpec {
  camera: CutsceneVec3;
  target: CutsceneVec3;
  verticalFov: number;
  farMeters?: number;
  aspect?: number;
}

export interface PromoTerrainViewColumn {
  depth: number;
  lane: number;
  point: CutsceneVec3;
}

export interface PromoCameraClearanceSpec {
  cameraFar: CutsceneVec3;
  cameraNear: CutsceneVec3;
  target: CutsceneVec3;
  bossBodyRadius: number;
}

export interface PromoCameraSightlineSample {
  sample: number;
  camera: CutsceneVec3;
  distance: number;
  checkUntil: number;
}

export function promoCameraDollySamples(
  spec: PromoCameraClearanceSpec
): CutsceneVec3[] {
  return Array.from(
    { length: PROMO_CAMERA_DOLLY_SAMPLES },
    (_, sample) =>
      samplePolyline(
        [spec.cameraFar, spec.cameraNear],
        sample / (PROMO_CAMERA_DOLLY_SAMPLES - 1),
        "easeInOut"
      ).position
  );
}

export function promoCameraSightlineSamples(
  spec: PromoCameraClearanceSpec
): PromoCameraSightlineSample[] {
  return Array.from({ length: PROMO_CAMERA_SIGHTLINE_SAMPLES }, (_, sample) => {
    const camera = samplePolyline(
      [spec.cameraFar, spec.cameraNear],
      sample / (PROMO_CAMERA_SIGHTLINE_SAMPLES - 1),
      "easeInOut"
    ).position;
    const distance = Math.hypot(
      spec.target[0] - camera[0],
      spec.target[1] - camera[1],
      spec.target[2] - camera[2]
    );
    return {
      sample,
      camera,
      distance,
      checkUntil: Math.max(0, distance - spec.bossBodyRadius * 0.75),
    };
  });
}

/**
 * Sample the visible terrain wedge behind a promo subject.
 *
 * `lane` is a fraction of the horizontal half-frustum. We deliberately avoid
 * the exact edge, where one barely visible shard would add substantial mesh
 * work without improving the marketing composition.
 */
export function promoTerrainViewColumns(
  spec: PromoTerrainViewSpec
): PromoTerrainViewColumn[] {
  const farMeters = Math.max(
    32,
    spec.farMeters ?? PROMO_TERRAIN_VIEW_FAR_METERS
  );
  const aspect = Math.max(0.5, spec.aspect ?? 16 / 9);
  const verticalFovRadians =
    (Math.min(120, Math.max(1, spec.verticalFov)) * Math.PI) / 180;
  const horizontalHalfTangent = Math.tan(verticalFovRadians / 2) * aspect;
  const dx = spec.target[0] - spec.camera[0];
  const dz = spec.target[2] - spec.camera[2];
  const horizontalLength = Math.hypot(dx, dz);
  const forwardX = horizontalLength > 1e-6 ? dx / horizontalLength : 0;
  const forwardZ = horizontalLength > 1e-6 ? dz / horizontalLength : -1;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const baseY = spec.target[1];
  const depths = [
    ...PROMO_TERRAIN_VIEW_DEPTHS.filter((depth) => depth < farMeters),
    farMeters,
  ];

  return depths.flatMap((depth) => {
    const halfWidth = depth * horizontalHalfTangent;
    return PROMO_TERRAIN_VIEW_LANES.map((lane) => ({
      depth,
      lane,
      point: [
        spec.camera[0] + forwardX * depth + rightX * halfWidth * lane,
        baseY,
        spec.camera[2] + forwardZ * depth + rightZ * halfWidth * lane,
      ] as CutsceneVec3,
    }));
  });
}
