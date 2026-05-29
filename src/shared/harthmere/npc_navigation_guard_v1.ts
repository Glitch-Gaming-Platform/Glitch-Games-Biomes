import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

export const HARTHMERE_NPC_NAVIGATION_GUARD_VERSION_V1 =
  "harthmere-npc-navigation-guard-v1" as const;

export type HarthmereNpcNavigationModeV1 =
  | "town_wander"
  | "combat_chase"
  | "route_patrol";

export interface HarthmereNpcNavigationObstacleV1 {
  id?: string;
  label?: string;
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
  rot?: number;
  padding?: number;
}

export interface HarthmereNpcNavigationStateV1 {
  lastSafePosition?: Vec3;
  lastOutputPosition?: Vec3;
  stuckFrames: number;
}

export interface HarthmereNpcNavigationInputV1 {
  label?: string;
  mode: HarthmereNpcNavigationModeV1;
  currentPosition: ReadonlyVec3;
  desiredPosition: ReadonlyVec3;
  state: HarthmereNpcNavigationStateV1;
  obstacles?: readonly HarthmereNpcNavigationObstacleV1[];
  groundYAt?: (x: number, z: number, preferredY: number) => number | undefined;
  maxStepHeight?: number;
  bodyRadius?: number;
}

export interface HarthmereNpcNavigationResultV1 {
  version: typeof HARTHMERE_NPC_NAVIGATION_GUARD_VERSION_V1;
  position: Vec3;
  blocked: boolean;
  stuck: boolean;
  resolution: "direct" | "slide" | "sidestep" | "hold";
  groundCorrection?: "buried" | "floating";
  obstacleLabel?: string;
  animationMoving: boolean;
  checkedObstacles: number;
  sweepSamples: number;
}

const DEFAULT_BODY_RADIUS_V1 = 0.72;
const DEFAULT_MAX_STEP_HEIGHT_V1 = 1.35;
const MAX_OBSTACLE_CHECKS_V1 = 36;
const SWEEP_STEP_METERS_V1 = 0.42;
const MIN_PROGRESS_METERS_V1 = 0.04;
const MIN_ANIMATION_PROGRESS_METERS_V1 = 0.004;
const STUCK_FRAME_THRESHOLD_V1 = 10;
const GROUND_EPSILON_V1 = 0.18;

export function createHarthmereNpcNavigationStateV1(): HarthmereNpcNavigationStateV1 {
  return { stuckFrames: 0 };
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function obstacleContainsPointV1(
  obstacle: HarthmereNpcNavigationObstacleV1,
  x: number,
  z: number,
  bodyRadius: number
) {
  const rot = finiteOr(obstacle.rot ?? 0, 0);
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  const dx = x - obstacle.cx;
  const dz = z - obstacle.cz;
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  const padding = Math.max(0, finiteOr(obstacle.padding ?? bodyRadius, bodyRadius));
  return (
    Math.abs(localX) <= Math.max(0, obstacle.halfX) + padding &&
    Math.abs(localZ) <= Math.max(0, obstacle.halfZ) + padding
  );
}

function sweepObstacleV1(
  from: ReadonlyVec3,
  to: ReadonlyVec3,
  obstacles: readonly HarthmereNpcNavigationObstacleV1[],
  bodyRadius: number
): {
  obstacle?: HarthmereNpcNavigationObstacleV1;
  checkedObstacles: number;
  sweepSamples: number;
} {
  const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const samples = Math.max(1, Math.ceil(distance / SWEEP_STEP_METERS_V1));
  let checkedObstacles = 0;
  for (let sample = 0; sample <= samples; sample += 1) {
    const t = sample / samples;
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    for (let i = 0; i < obstacles.length && i < MAX_OBSTACLE_CHECKS_V1; i += 1) {
      checkedObstacles += 1;
      const obstacle = obstacles[i];
      if (obstacleContainsPointV1(obstacle, x, z, bodyRadius)) {
        return { obstacle, checkedObstacles, sweepSamples: sample + 1 };
      }
    }
  }
  return { checkedObstacles, sweepSamples: samples + 1 };
}

function groundedCandidateV1(
  input: HarthmereNpcNavigationInputV1,
  x: number,
  z: number,
  preferredY: number,
  currentGroundY: number | undefined
): { position: Vec3; correction?: "buried" | "floating"; validStep: boolean } {
  const sampledY = input.groundYAt?.(x, z, preferredY);
  const y = Number.isFinite(sampledY) ? sampledY! : preferredY;
  const delta = preferredY - y;
  const correction =
    delta > GROUND_EPSILON_V1
      ? "floating"
      : delta < -GROUND_EPSILON_V1
        ? "buried"
        : undefined;
  const maxStep = input.maxStepHeight ?? DEFAULT_MAX_STEP_HEIGHT_V1;
  const validStep =
    currentGroundY === undefined ||
    !Number.isFinite(currentGroundY) ||
    Math.abs(y - currentGroundY) <= maxStep ||
    Math.hypot(x - input.currentPosition[0], z - input.currentPosition[2]) <= 0.05;
  return { position: [x, y, z], correction, validStep };
}

function resultV1(
  input: HarthmereNpcNavigationInputV1,
  position: Vec3,
  resolution: HarthmereNpcNavigationResultV1["resolution"],
  blocked: boolean,
  correction: HarthmereNpcNavigationResultV1["groundCorrection"],
  obstacle: HarthmereNpcNavigationObstacleV1 | undefined,
  checkedObstacles: number,
  sweepSamples: number
): HarthmereNpcNavigationResultV1 {
  const desiredDistance = Math.hypot(
    input.desiredPosition[0] - input.currentPosition[0],
    input.desiredPosition[2] - input.currentPosition[2]
  );
  const progress = Math.hypot(
    position[0] - input.currentPosition[0],
    position[2] - input.currentPosition[2]
  );
  const notProgressing = desiredDistance > MIN_PROGRESS_METERS_V1 && progress < MIN_PROGRESS_METERS_V1;
  input.state.stuckFrames = notProgressing ? input.state.stuckFrames + 1 : 0;
  input.state.lastOutputPosition = [...position];
  if (!blocked) {
    input.state.lastSafePosition = [...position];
  } else if (resolution === "slide" || resolution === "sidestep") {
    input.state.lastSafePosition = [...position];
  }
  const stuck = input.state.stuckFrames >= STUCK_FRAME_THRESHOLD_V1;
  // Animation should follow visible per-frame motion, not the larger progress
  // threshold used for stuck detection. Town NPCs often wander ~1-2 cm per
  // frame, and treating that as idle makes them slide across the ground.
  const animationMoving =
    !stuck &&
    desiredDistance >= MIN_ANIMATION_PROGRESS_METERS_V1 &&
    progress >= MIN_ANIMATION_PROGRESS_METERS_V1;
  return {
    version: HARTHMERE_NPC_NAVIGATION_GUARD_VERSION_V1,
    position,
    blocked,
    stuck,
    resolution,
    groundCorrection: correction,
    obstacleLabel: obstacle?.label ?? obstacle?.id,
    animationMoving,
    checkedObstacles,
    sweepSamples,
  };
}

export function resolveHarthmereNpcNavigationStepV1(
  input: HarthmereNpcNavigationInputV1
): HarthmereNpcNavigationResultV1 {
  const bodyRadius = input.bodyRadius ?? DEFAULT_BODY_RADIUS_V1;
  const obstacles = input.obstacles ?? [];
  const currentGroundY = input.groundYAt?.(
    input.currentPosition[0],
    input.currentPosition[2],
    input.currentPosition[1]
  );
  const direct = groundedCandidateV1(
    input,
    input.desiredPosition[0],
    input.desiredPosition[2],
    input.desiredPosition[1],
    currentGroundY
  );
  if (direct.validStep) {
    const directSweep = sweepObstacleV1(input.currentPosition, direct.position, obstacles, bodyRadius);
    if (!directSweep.obstacle) {
      return resultV1(
        input,
        direct.position,
        "direct",
        false,
        direct.correction,
        undefined,
        directSweep.checkedObstacles,
        directSweep.sweepSamples
      );
    }

    const currentY = Number.isFinite(currentGroundY) ? currentGroundY! : input.currentPosition[1];
    const dx = input.desiredPosition[0] - input.currentPosition[0];
    const dz = input.desiredPosition[2] - input.currentPosition[2];
    const len = Math.hypot(dx, dz) || 1;
    const side = [-dz / len, dx / len] as const;
    const candidates: Array<{
      position: Vec3;
      resolution: HarthmereNpcNavigationResultV1["resolution"];
      correction?: "buried" | "floating";
    }> = [];
    for (const [x, z, resolution] of [
      [input.desiredPosition[0], input.currentPosition[2], "slide"] as const,
      [input.currentPosition[0], input.desiredPosition[2], "slide"] as const,
      [input.currentPosition[0] + side[0] * 0.75, input.currentPosition[2] + side[1] * 0.75, "sidestep"] as const,
      [input.currentPosition[0] - side[0] * 0.75, input.currentPosition[2] - side[1] * 0.75, "sidestep"] as const,
    ]) {
      const candidate = groundedCandidateV1(input, x, z, currentY, currentGroundY);
      if (candidate.validStep) {
        candidates.push({
          position: candidate.position,
          resolution,
          correction: candidate.correction,
        });
      }
    }
    for (const candidate of candidates) {
      const sweep = sweepObstacleV1(input.currentPosition, candidate.position, obstacles, bodyRadius);
      if (!sweep.obstacle) {
        return resultV1(
          input,
          candidate.position,
          candidate.resolution,
          true,
          candidate.correction ?? direct.correction,
          directSweep.obstacle,
          directSweep.checkedObstacles + sweep.checkedObstacles,
          directSweep.sweepSamples + sweep.sweepSamples
        );
      }
    }
    const fallback = input.state.lastSafePosition ?? [
      input.currentPosition[0],
      Number.isFinite(currentGroundY) ? currentGroundY! : input.currentPosition[1],
      input.currentPosition[2],
    ];
    const held = groundedCandidateV1(input, fallback[0], fallback[2], fallback[1], currentGroundY);
    return resultV1(
      input,
      held.position,
      "hold",
      true,
      held.correction ?? direct.correction,
      directSweep.obstacle,
      directSweep.checkedObstacles,
      directSweep.sweepSamples
    );
  }

  const fallback = input.state.lastSafePosition ?? [
    input.currentPosition[0],
    Number.isFinite(currentGroundY) ? currentGroundY! : input.currentPosition[1],
    input.currentPosition[2],
  ];
  const held = groundedCandidateV1(input, fallback[0], fallback[2], fallback[1], currentGroundY);
  return resultV1(
    input,
    held.position,
    "hold",
    true,
    held.correction ?? direct.correction,
    undefined,
    0,
    0
  );
}
