import type { CutsceneVec3 } from "@/shared/cutscene/schema";
import { samplePolyline, v3dist } from "@/shared/cutscene/math";

export const BOSS_PROMO_MIN_FOV = 35;
export const BOSS_PROMO_MAX_FOV = 45;
export const BOSS_PROMO_BODY_CLEARANCE_MULTIPLIER = 1.35;
export const BOSS_PROMO_DOLLY_SAMPLES = 9;

export type BossPromoCameraPresetId =
  | "baseline"
  | "three-quarter-left"
  | "three-quarter-right"
  | "environment-wide"
  | "reverse-inward";

export const BOSS_PROMO_CAMERA_PRESETS: readonly BossPromoCameraPresetId[] =
  Object.freeze([
    "baseline",
    "three-quarter-left",
    "three-quarter-right",
    "environment-wide",
    "reverse-inward",
  ]);

export function isBossPromoCameraPresetId(
  value: string | null | undefined
): value is BossPromoCameraPresetId {
  return BOSS_PROMO_CAMERA_PRESETS.includes(value as BossPromoCameraPresetId);
}

export interface BossPromoCameraInput {
  stage: CutsceneVec3;
  cameraFar: CutsceneVec3;
  cameraNear: CutsceneVec3;
  fov: number;
  worldSize: CutsceneVec3;
}

export interface BossPromoCameraPlan {
  preset: BossPromoCameraPresetId;
  cameraFar: CutsceneVec3;
  cameraNear: CutsceneVec3;
  fov: number;
}

export interface BossPromoCameraPreflight {
  bodyRadius: number;
  farDistance: number;
  nearDistance: number;
  minimumDollyDistance: number;
  dollyLength: number;
  capturePosition: CutsceneVec3;
  issues: string[];
}

function finiteVec3(value: CutsceneVec3): boolean {
  return value.every(Number.isFinite);
}

function roundVec3(value: CutsceneVec3): CutsceneVec3 {
  return value.map((part) => Number(part.toFixed(3))) as CutsceneVec3;
}

function transformCameraPoint(
  point: CutsceneVec3,
  stage: CutsceneVec3,
  orbitDegrees: number,
  distanceScale: number,
  rise: number
): CutsceneVec3 {
  const angle = (orbitDegrees * Math.PI) / 180;
  const dx = point[0] - stage[0];
  const dz = point[2] - stage[2];
  return roundVec3([
    stage[0] + (dx * Math.cos(angle) - dz * Math.sin(angle)) * distanceScale,
    point[1] + rise,
    stage[2] + (dx * Math.sin(angle) + dz * Math.cos(angle)) * distanceScale,
  ]);
}

function reviewFov(fov: number, minimum = BOSS_PROMO_MIN_FOV): number {
  return Math.min(BOSS_PROMO_MAX_FOV, Math.max(minimum, fov));
}

/**
 * Produce repeatable camera brackets without changing actor placement.
 *
 * These are candidates, not terrain acceptance. The live cutscene capture must
 * still prove that every dolly sample is clear of the current environment.
 */
export function bossPromoCameraPlan(
  input: BossPromoCameraInput,
  preset: BossPromoCameraPresetId
): BossPromoCameraPlan {
  if (preset === "baseline") {
    return {
      preset,
      cameraFar: [...input.cameraFar],
      cameraNear: [...input.cameraNear],
      fov: input.fov,
    };
  }

  const modestRise = Math.max(0.75, input.worldSize[1] * 0.08);
  const parameters: Record<
    Exclude<BossPromoCameraPresetId, "baseline">,
    { orbit: number; scale: number; rise: number; fov: number }
  > = {
    "three-quarter-left": {
      orbit: -28,
      scale: 1.12,
      rise: modestRise,
      fov: reviewFov(input.fov),
    },
    "three-quarter-right": {
      orbit: 28,
      scale: 1.12,
      rise: modestRise,
      fov: reviewFov(input.fov),
    },
    "environment-wide": {
      orbit: 0,
      scale: 1.28,
      rise: modestRise * 0.6,
      fov: reviewFov(input.fov, 40),
    },
    "reverse-inward": {
      orbit: 180,
      scale: 1.05,
      rise: modestRise * 0.6,
      fov: reviewFov(input.fov, 40),
    },
  };
  const selected = parameters[preset];
  return {
    preset,
    cameraFar: transformCameraPoint(
      input.cameraFar,
      input.stage,
      selected.orbit,
      selected.scale,
      selected.rise
    ),
    cameraNear: transformCameraPoint(
      input.cameraNear,
      input.stage,
      selected.orbit,
      selected.scale,
      selected.rise
    ),
    fov: selected.fov,
  };
}

export function preflightBossPromoCamera(
  input: BossPromoCameraInput,
  plan: BossPromoCameraPlan,
  captureAt = 2.05,
  shotDuration = 4.5
): BossPromoCameraPreflight {
  const issues: string[] = [];
  const bodyRadius = Math.hypot(...input.worldSize) / 2;
  const minimumClearance =
    bodyRadius * BOSS_PROMO_BODY_CLEARANCE_MULTIPLIER;
  const farDistance = v3dist(plan.cameraFar, input.stage);
  const nearDistance = v3dist(plan.cameraNear, input.stage);
  const dollyLength = v3dist(plan.cameraFar, plan.cameraNear);
  const dollyDistances: number[] = [];

  if (
    !finiteVec3(input.stage) ||
    !finiteVec3(plan.cameraFar) ||
    !finiteVec3(plan.cameraNear)
  ) {
    issues.push("stage and camera coordinates must be finite");
  }
  if (plan.fov < BOSS_PROMO_MIN_FOV || plan.fov > BOSS_PROMO_MAX_FOV) {
    issues.push(
      `FOV ${plan.fov} is outside the ${BOSS_PROMO_MIN_FOV}-${BOSS_PROMO_MAX_FOV} marketing range`
    );
  }
  if (farDistance <= nearDistance) {
    issues.push("far camera must be farther from the actor than near camera");
  }
  if (dollyLength < 2) {
    issues.push("camera dolly is shorter than 2m and will not read as a push-in");
  }

  for (let step = 0; step < BOSS_PROMO_DOLLY_SAMPLES; step += 1) {
    const t = step / (BOSS_PROMO_DOLLY_SAMPLES - 1);
    const position = samplePolyline(
      [plan.cameraFar, plan.cameraNear],
      t,
      "easeInOut"
    ).position;
    dollyDistances.push(v3dist(position, input.stage));
  }
  const minimumDollyDistance = Math.min(...dollyDistances);
  if (minimumDollyDistance <= minimumClearance) {
    issues.push(
      `camera dolly enters the boss envelope (${minimumDollyDistance.toFixed(
        2
      )}m <= ${minimumClearance.toFixed(2)}m)`
    );
  }

  const captureT = Math.max(0, Math.min(1, captureAt / shotDuration));
  const capturePosition = samplePolyline(
    [plan.cameraFar, plan.cameraNear],
    captureT,
    "easeInOut"
  ).position;

  return {
    bodyRadius,
    farDistance,
    nearDistance,
    minimumDollyDistance,
    dollyLength,
    capturePosition,
    issues,
  };
}
