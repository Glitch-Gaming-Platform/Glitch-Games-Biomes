import { MovementState } from "@/shared/ecs/gen/components";
import type { ReadonlyMovementState } from "@/shared/ecs/gen/components";
import type {
  MovementActionType,
  ReadonlyVec3f,
  Vec3f,
} from "@/shared/ecs/gen/types";
import { normalizeAngle } from "@/shared/math/angles";

export const RESERVED_MOVEMENT_KEY_CODES = ["KeyZ", "KeyX", "KeyC"] as const;
export const MOVEMENT_ACTION_STAMINA_COST = 3;
export const DOUBLE_JUMP_STAMINA_COST = 4;
export const BASE_PLAYER_JUMP_COUNT = 2;
export const PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES = [
  "dodgeLeft",
  "dodgeRight",
  "dodgeForward",
  "dodgeBack",
  "evade",
  "doubleJump",
] as const;
export type PlayerMovementActionAnimationName =
  (typeof PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES)[number];

export interface PlayerMovementActionVisualPose {
  pitchRadians: number;
  rollRadians: number;
  liftMeters: number;
  scaleY: number;
}

export const PLAYER_ROLL_DODGE_EVENTS = {
  start: 0,
  active: 0.1,
  iframeStart: 0.15,
  iframeEnd: 0.4,
  landing: 0.55,
  recovery: 0.6,
  end: 0.75,
} as const;

export type RollDodgePhase =
  | "inactive"
  | "anticipation"
  | "launch"
  | "tuck"
  | "rotation"
  | "landing"
  | "recovery";

export const PLAYER_ROLL_DODGE_PHASES = [
  { phase: "anticipation", start: 0, end: 0.1 },
  { phase: "launch", start: 0.1, end: 0.2 },
  { phase: "tuck", start: 0.2, end: 0.34 },
  { phase: "rotation", start: 0.34, end: 0.52 },
  { phase: "landing", start: 0.52, end: 0.62 },
  { phase: "recovery", start: 0.62, end: 0.75 },
] as const satisfies ReadonlyArray<{
  phase: Exclude<RollDodgePhase, "inactive">;
  start: number;
  end: number;
}>;

export function movementActionPressedOnEdge(
  pressed: boolean,
  wasPressed: boolean
): boolean {
  return pressed && !wasPressed;
}

export const PLAYER_MOVEMENT_ACTION_TIMING = {
  dodge: {
    durationSeconds: 0.5,
    controlLockSeconds: 0.46,
    movementStartSeconds: 0.05,
    movementEndSeconds: 0.42,
    invulnerabilityStartSeconds: 0.1,
    invulnerabilityEndSeconds: 0.28,
    cooldownSeconds: 0.85,
    distanceMeters: 4.75,
    cameraFovBoostDegrees: 3,
    cameraPullbackMeters: 0.12,
  },
  evade: {
    durationSeconds: PLAYER_ROLL_DODGE_EVENTS.end,
    controlLockSeconds: PLAYER_ROLL_DODGE_PHASES[4].end,
    movementStartSeconds: PLAYER_ROLL_DODGE_EVENTS.active,
    movementEndSeconds: PLAYER_ROLL_DODGE_EVENTS.landing,
    invulnerabilityStartSeconds: PLAYER_ROLL_DODGE_EVENTS.iframeStart,
    invulnerabilityEndSeconds: PLAYER_ROLL_DODGE_EVENTS.iframeEnd,
    cooldownSeconds: 1.15,
    distanceMeters: 5.25,
    cameraFovBoostDegrees: 5,
    cameraPullbackMeters: 0.28,
  },
  doubleJump: {
    durationSeconds: 0.5,
    controlLockSeconds: 0,
    movementStartSeconds: 0,
    movementEndSeconds: 0,
    invulnerabilityStartSeconds: 0,
    invulnerabilityEndSeconds: 0,
    cooldownSeconds: 0.5,
    distanceMeters: 0,
    cameraFovBoostDegrees: 2,
    cameraPullbackMeters: 0.08,
  },
} as const satisfies Record<
  MovementActionType,
  {
    durationSeconds: number;
    controlLockSeconds: number;
    movementStartSeconds: number;
    movementEndSeconds: number;
    invulnerabilityStartSeconds: number;
    invulnerabilityEndSeconds: number;
    cooldownSeconds: number;
    distanceMeters: number;
    cameraFovBoostDegrees: number;
    cameraPullbackMeters: number;
  }
>;

export type PlayerEvadeLateralSide = -1 | 1;

/**
 * Evade is a lateral roll, not a forward dash. Prefer the current
 * left/right input, then a residual lateral lean/velocity, then the previously
 * chosen side so a neutral-key evade remains deterministic.
 */
export function playerEvadeLateralDirection({
  rightDirection,
  lateralInput,
  lateralVelocity,
  fallbackSide = 1,
}: {
  rightDirection: ReadonlyVec3f;
  lateralInput: number;
  lateralVelocity: number;
  fallbackSide?: PlayerEvadeLateralSide;
}): { direction: Vec3f; side: PlayerEvadeLateralSide } {
  const normalizedRight = normalizeMovementActionDirection(rightDirection, [
    1, 0, 0,
  ]);
  const inputSide = Math.sign(Number(lateralInput));
  const velocitySide =
    Math.abs(Number(lateralVelocity)) >= 0.05
      ? Math.sign(Number(lateralVelocity))
      : 0;
  const side = (inputSide || velocitySide || fallbackSide) < 0 ? -1 : 1;
  return {
    direction: [normalizedRight[0] * side, 0, normalizedRight[2] * side],
    side,
  };
}

export function movementActionStaminaCost(action: MovementActionType): number {
  return action === "doubleJump"
    ? DOUBLE_JUMP_STAMINA_COST
    : MOVEMENT_ACTION_STAMINA_COST;
}

export function playerJumpCount(jumpCountIncrease: number): number {
  return Math.max(BASE_PLAYER_JUMP_COUNT + jumpCountIncrease, 0);
}

export function isDoubleJumpAttempt(activeJumps: number): boolean {
  return activeJumps >= 1;
}

export const PLAYER_EVADE_ATTACK_TRANSITION = {
  queueStartSeconds: PLAYER_ROLL_DODGE_EVENTS.landing - 0.07,
  cancelStartSeconds: PLAYER_ROLL_DODGE_EVENTS.recovery,
  inputGraceSeconds: 0.15,
} as const;

export type MovementActionAttackTransition =
  | "none"
  | "blocked"
  | "queue"
  | "open";

/**
 * Preserve the readable roll through rotation, buffer attack input during the
 * landing, then allow the existing attack animation to take over in recovery.
 */
export function movementActionAttackTransition({
  action,
  startTimeSeconds,
  expiryTimeSeconds,
  nowSeconds,
}: {
  action: MovementActionType | undefined;
  startTimeSeconds: number;
  expiryTimeSeconds: number;
  nowSeconds: number;
}): MovementActionAttackTransition {
  if (
    action !== "evade" ||
    nowSeconds < startTimeSeconds ||
    nowSeconds >= expiryTimeSeconds
  ) {
    return "none";
  }
  const authoredDuration = PLAYER_MOVEMENT_ACTION_TIMING.evade.durationSeconds;
  const actualDuration = expiryTimeSeconds - startTimeSeconds;
  if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
    return "none";
  }
  const elapsed =
    ((nowSeconds - startTimeSeconds) / actualDuration) * authoredDuration;
  const epsilon = 1e-9;
  if (elapsed + epsilon < PLAYER_EVADE_ATTACK_TRANSITION.queueStartSeconds) {
    return "blocked";
  }
  if (elapsed + epsilon < PLAYER_EVADE_ATTACK_TRANSITION.cancelStartSeconds) {
    return "queue";
  }
  return "open";
}

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function playerMovementActionAnimationName({
  action,
  direction,
  facingYaw,
}: {
  action: MovementActionType;
  direction: ReadonlyVec3f | undefined;
  facingYaw: number;
}): PlayerMovementActionAnimationName {
  if (action === "doubleJump") {
    return "doubleJump";
  }
  if (action === "evade") {
    return "evade";
  }
  const normalized = normalizeMovementActionDirection(direction, [
    -Math.sin(facingYaw),
    0,
    -Math.cos(facingYaw),
  ]);
  const forwardAmount =
    normalized[0] * -Math.sin(facingYaw) + normalized[2] * -Math.cos(facingYaw);
  const sideAmount =
    normalized[0] * Math.cos(facingYaw) + normalized[2] * -Math.sin(facingYaw);
  return Math.abs(sideAmount) >= Math.abs(forwardAmount)
    ? sideAmount >= 0
      ? "dodgeRight"
      : "dodgeLeft"
    : forwardAmount >= 0
    ? "dodgeForward"
    : "dodgeBack";
}

/**
 * Root-level presentation for voxel avatar shells that do not inherit every
 * joint in the skinned Blender rig. Neutral endpoints leave the authored clip
 * authoritative while ensuring dodge/roll remains readable on every mesh.
 */
export function playerMovementActionVisualPose(
  animation: string | undefined,
  progress: number
): PlayerMovementActionVisualPose | undefined {
  if (
    !PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.includes(
      animation as PlayerMovementActionAnimationName
    )
  ) {
    return;
  }
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  const envelope = Math.sin(Math.PI * t);
  switch (animation as PlayerMovementActionAnimationName) {
    case "dodgeLeft":
      return {
        pitchRadians: -0.08 * envelope,
        rollRadians: 0.48 * envelope,
        liftMeters: 0.08 * envelope,
        scaleY: 1,
      };
    case "dodgeRight":
      return {
        pitchRadians: -0.08 * envelope,
        rollRadians: -0.48 * envelope,
        liftMeters: 0.08 * envelope,
        scaleY: 1,
      };
    case "dodgeForward":
      return {
        pitchRadians: -0.5 * envelope,
        rollRadians: 0,
        liftMeters: 0.1 * envelope,
        scaleY: 1,
      };
    case "dodgeBack":
      return {
        pitchRadians: 0.42 * envelope,
        rollRadians: 0,
        liftMeters: 0.08 * envelope,
        scaleY: 1,
      };
    case "evade":
      return {
        pitchRadians: -2 * Math.PI * smoothstep01(t),
        rollRadians: 0,
        liftMeters: 0.9 * envelope,
        scaleY: 1,
      };
    case "doubleJump": {
      const compress = t < 0.22 ? Math.sin((Math.PI * t) / 0.22) : 0;
      const burst =
        t >= 0.22 && t < 0.58 ? Math.sin((Math.PI * (t - 0.22)) / 0.36) : 0;
      return {
        // Generated voxel shells may not inherit every limb joint. A brief
        // whole-shell compression followed by restrained extension keeps the
        // authored second launch readable without replacing its rig motion.
        pitchRadians: 0.18 * compress - 0.24 * burst,
        rollRadians: 0.14 * burst * Math.sin(Math.PI * t),
        liftMeters: 0.2 * burst + 0.06 * envelope,
        scaleY: 1 - 0.14 * compress + 0.12 * burst,
      };
    }
  }
}

function movementActionProgress({
  startTimeSeconds,
  expiryTimeSeconds,
  nowSeconds,
}: {
  startTimeSeconds: number;
  expiryTimeSeconds: number;
  nowSeconds: number;
}): number | undefined {
  const duration = expiryTimeSeconds - startTimeSeconds;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    nowSeconds < startTimeSeconds ||
    nowSeconds >= expiryTimeSeconds
  ) {
    return undefined;
  }
  return Math.max(0, Math.min(1, (nowSeconds - startTimeSeconds) / duration));
}

function movementActionTimingProgress(
  action: MovementActionType,
  seconds: number
): number {
  return seconds / PLAYER_MOVEMENT_ACTION_TIMING[action].durationSeconds;
}

function movementActionDistanceAtProgress(
  action: MovementActionType,
  progress: number
): number {
  const timing = PLAYER_MOVEMENT_ACTION_TIMING[action];
  const movementStart = movementActionTimingProgress(
    action,
    timing.movementStartSeconds
  );
  const movementEnd = movementActionTimingProgress(
    action,
    timing.movementEndSeconds
  );
  if (progress <= movementStart) {
    return 0;
  }
  if (progress >= movementEnd) {
    return timing.distanceMeters;
  }

  // Integrating this eased displacement (rather than sampling a speed) keeps
  // the travelled distance stable at low frame rates. Its derivative starts
  // slowly, snaps through the middle of the roll, and eases into landing.
  const movementProgress =
    (progress - movementStart) / (movementEnd - movementStart);
  return timing.distanceMeters * smoothstep01(movementProgress);
}

export function movementActionVelocityForTick({
  action,
  direction,
  startTimeSeconds,
  expiryTimeSeconds,
  nowSeconds,
  dtSeconds,
}: {
  action: MovementActionType;
  direction: ReadonlyVec3f;
  startTimeSeconds: number;
  expiryTimeSeconds: number;
  nowSeconds: number;
  dtSeconds: number;
}): Vec3f {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return [0, 0, 0];
  }

  // Integrate only the part of this physics tick that overlaps the action.
  // This keeps the travelled distance stable at both normal refresh rates and
  // the low frame rates common in software-WebGL/browser-streamed sessions.
  const activeStart = Math.max(nowSeconds, startTimeSeconds);
  const activeEnd = Math.min(nowSeconds + dtSeconds, expiryTimeSeconds);
  const activeSeconds = Math.max(0, activeEnd - activeStart);
  if (activeSeconds <= 0) {
    return [0, 0, 0];
  }

  const normalizedDirection = normalizeMovementActionDirection(direction);
  const actionDuration = expiryTimeSeconds - startTimeSeconds;
  if (!Number.isFinite(actionDuration) || actionDuration <= 0) {
    return [0, 0, 0];
  }
  const startProgress = (activeStart - startTimeSeconds) / actionDuration;
  const endProgress = (activeEnd - startTimeSeconds) / actionDuration;
  const distance =
    movementActionDistanceAtProgress(action, endProgress) -
    movementActionDistanceAtProgress(action, startProgress);
  const speed = distance / dtSeconds;
  return [normalizedDirection[0] * speed, 0, normalizedDirection[2] * speed];
}

export function movementActionLocksControl({
  action,
  startTimeSeconds,
  expiryTimeSeconds,
  nowSeconds,
}: {
  action: MovementActionType;
  startTimeSeconds: number;
  expiryTimeSeconds: number;
  nowSeconds: number;
}): boolean {
  const progress = movementActionProgress({
    startTimeSeconds,
    expiryTimeSeconds,
    nowSeconds,
  });
  return Boolean(
    progress !== undefined &&
      progress <
        movementActionTimingProgress(
          action,
          PLAYER_MOVEMENT_ACTION_TIMING[action].controlLockSeconds
        )
  );
}

export function movementActionDrivesMotion({
  action,
  startTimeSeconds,
  expiryTimeSeconds,
  nowSeconds,
}: {
  action: MovementActionType;
  startTimeSeconds: number;
  expiryTimeSeconds: number;
  nowSeconds: number;
}): boolean {
  const progress = movementActionProgress({
    startTimeSeconds,
    expiryTimeSeconds,
    nowSeconds,
  });
  if (progress === undefined) {
    return false;
  }
  const timing = PLAYER_MOVEMENT_ACTION_TIMING[action];
  return (
    progress >=
      movementActionTimingProgress(action, timing.movementStartSeconds) &&
    progress < movementActionTimingProgress(action, timing.movementEndSeconds)
  );
}

export function movementActionCameraEffects({
  action,
  startTimeSeconds,
  expiryTimeSeconds,
  nowSeconds,
}: {
  action: MovementActionType;
  startTimeSeconds: number;
  expiryTimeSeconds: number;
  nowSeconds: number;
}): { fovBoostDegrees: number; pullbackMeters: number } {
  const progress = movementActionProgress({
    startTimeSeconds,
    expiryTimeSeconds,
    nowSeconds,
  });
  if (progress === undefined) {
    return { fovBoostDegrees: 0, pullbackMeters: 0 };
  }

  const timing = PLAYER_MOVEMENT_ACTION_TIMING[action];
  const movementStart = movementActionTimingProgress(
    action,
    timing.movementStartSeconds
  );
  const recoveryStart = movementActionTimingProgress(
    action,
    timing.movementEndSeconds
  );
  const amount =
    progress < movementStart
      ? smoothstep01(progress / movementStart)
      : progress <= recoveryStart
      ? 1
      : 1 - smoothstep01((progress - recoveryStart) / (1 - recoveryStart));
  return {
    fovBoostDegrees: timing.cameraFovBoostDegrees * amount,
    pullbackMeters: timing.cameraPullbackMeters * amount,
  };
}

export function rollDodgePhaseAt(elapsedSeconds: number): RollDodgePhase {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    return "inactive";
  }
  return (
    PLAYER_ROLL_DODGE_PHASES.find(
      ({ start, end }) => elapsedSeconds >= start && elapsedSeconds < end
    )?.phase ?? "inactive"
  );
}

export function movementActionYaw(
  direction: ReadonlyVec3f | undefined,
  fallbackYaw = 0
): number {
  const normalized = normalizeMovementActionDirection(direction, [
    -Math.sin(fallbackYaw),
    0,
    -Math.cos(fallbackYaw),
  ]);
  return normalizeAngle(
    -Math.atan2(normalized[2], normalized[0]) - Math.PI / 2
  );
}

export function movementActionEnvironmentForTick<
  T extends { friction: number; airResistance: number }
>(environment: T, movementActionActive: boolean): T {
  if (!movementActionActive) {
    return environment;
  }
  return {
    ...environment,
    friction: 0,
    airResistance: 0,
  };
}

export type NpcEvadeFamily =
  | "mucker"
  | "robot"
  | "sideLeap"
  | "heavy"
  | "rabbit"
  | "bird"
  | "swim"
  | "hexer"
  | "generic";

export interface NpcEvadeProfile {
  family: NpcEvadeFamily;
  animation:
    | "evadeMucker"
    | "evadeRobot"
    | "evadeSideLeap"
    | "evadeHeavy"
    | "evadeRabbit"
    | "evadeBird"
    | "evadeSwim"
    | "evadeHexer"
    | "evadeGeneric";
  speedMetersPerSecond: number;
  durationSeconds: number;
  invulnerabilitySeconds: number;
  cooldownSeconds: number;
  directionMode: "lateral" | "away";
}

const NPC_EVADE_PROFILES: Record<NpcEvadeFamily, NpcEvadeProfile> = {
  mucker: {
    family: "mucker",
    animation: "evadeMucker",
    speedMetersPerSecond: 7.8,
    durationSeconds: 0.56,
    invulnerabilitySeconds: 0.3,
    cooldownSeconds: 3,
    directionMode: "lateral",
  },
  robot: {
    family: "robot",
    animation: "evadeRobot",
    speedMetersPerSecond: 6.8,
    durationSeconds: 0.58,
    invulnerabilitySeconds: 0.3,
    cooldownSeconds: 3.1,
    directionMode: "lateral",
  },
  sideLeap: {
    family: "sideLeap",
    animation: "evadeSideLeap",
    speedMetersPerSecond: 9.2,
    durationSeconds: 0.52,
    invulnerabilitySeconds: 0.3,
    cooldownSeconds: 2.8,
    directionMode: "lateral",
  },
  heavy: {
    family: "heavy",
    animation: "evadeHeavy",
    speedMetersPerSecond: 5.2,
    durationSeconds: 0.68,
    invulnerabilitySeconds: 0.34,
    cooldownSeconds: 3.3,
    directionMode: "away",
  },
  rabbit: {
    family: "rabbit",
    animation: "evadeRabbit",
    speedMetersPerSecond: 10.8,
    durationSeconds: 0.46,
    invulnerabilitySeconds: 0.26,
    cooldownSeconds: 2.5,
    directionMode: "lateral",
  },
  bird: {
    family: "bird",
    animation: "evadeBird",
    speedMetersPerSecond: 9.4,
    durationSeconds: 0.52,
    invulnerabilitySeconds: 0.28,
    cooldownSeconds: 2.7,
    directionMode: "away",
  },
  swim: {
    family: "swim",
    animation: "evadeSwim",
    speedMetersPerSecond: 11,
    durationSeconds: 0.5,
    invulnerabilitySeconds: 0.3,
    cooldownSeconds: 2.7,
    directionMode: "away",
  },
  hexer: {
    family: "hexer",
    animation: "evadeHexer",
    speedMetersPerSecond: 12,
    durationSeconds: 0.44,
    invulnerabilitySeconds: 0.32,
    cooldownSeconds: 3.2,
    directionMode: "lateral",
  },
  generic: {
    family: "generic",
    animation: "evadeGeneric",
    speedMetersPerSecond: 7.2,
    durationSeconds: 0.56,
    invulnerabilitySeconds: 0.28,
    cooldownSeconds: 3,
    directionMode: "lateral",
  },
};

export function normalizeMovementActionDirection(
  direction: ReadonlyVec3f | undefined,
  fallback: ReadonlyVec3f = [0, 0, -1]
): Vec3f {
  const x = Number(direction?.[0]);
  const z = Number(direction?.[2]);
  const magnitude = Math.hypot(x, z);
  if (!Number.isFinite(magnitude) || magnitude < 1e-4) {
    const fallbackMagnitude = Math.hypot(fallback[0], fallback[2]);
    if (fallbackMagnitude < 1e-4) {
      return [0, 0, -1];
    }
    return [
      fallback[0] / fallbackMagnitude,
      0,
      fallback[2] / fallbackMagnitude,
    ];
  }
  return [x / magnitude, 0, z / magnitude];
}

export function createMovementActionState({
  previous,
  action,
  direction,
  nonce,
  nowSeconds,
  durationSeconds,
  invulnerabilitySeconds,
  cooldownSeconds,
}: {
  previous?: ReadonlyMovementState;
  action: MovementActionType;
  direction: ReadonlyVec3f;
  nonce?: number;
  nowSeconds: number;
  durationSeconds: number;
  invulnerabilitySeconds: number;
  cooldownSeconds: number;
}): MovementState {
  return MovementState.create({
    crouching: previous?.crouching ?? false,
    action,
    action_start_time: nowSeconds,
    action_expiry_time: nowSeconds + durationSeconds,
    invulnerability_expiry_time: nowSeconds + invulnerabilitySeconds,
    cooldown_expiry_time: nowSeconds + cooldownSeconds,
    direction: normalizeMovementActionDirection(direction),
    action_nonce: nonce,
  });
}

export function movementActionIsActive(
  state: ReadonlyMovementState | undefined,
  nowSeconds: number
): boolean {
  return Boolean(
    state?.action &&
      nowSeconds >= state.action_start_time &&
      nowSeconds < state.action_expiry_time
  );
}

export function movementActionIsInvulnerable(
  state: ReadonlyMovementState | undefined,
  nowSeconds: number
): boolean {
  if (!state?.action || !movementActionIsActive(state, nowSeconds)) {
    return false;
  }
  const timing = PLAYER_MOVEMENT_ACTION_TIMING[state.action];
  const actionDuration = state.action_expiry_time - state.action_start_time;
  // NPC evade families intentionally keep their existing immediate protection
  // and use shorter custom durations. The delayed i-frame belongs to the
  // choreographed player clips, whose replicated duration matches this table.
  const usesPlayerTiming =
    Math.abs(actionDuration - timing.durationSeconds) < 1e-3;
  const invulnerabilityStart =
    state.action_start_time +
    (usesPlayerTiming
      ? actionDuration *
        (timing.invulnerabilityStartSeconds / timing.durationSeconds)
      : 0);
  return (
    nowSeconds >= invulnerabilityStart &&
    nowSeconds < state.invulnerability_expiry_time
  );
}

export function movementActionIsOnCooldown(
  state: ReadonlyMovementState | undefined,
  nowSeconds: number
): boolean {
  return nowSeconds < (state?.cooldown_expiry_time ?? 0);
}

export function npcEvadeFamilyForDescriptor(
  ...descriptors: Array<string | undefined>
): NpcEvadeFamily {
  const text = descriptors.filter(Boolean).join(" ").toLowerCase();
  if (/\bhex(?:er)?\b|witch|warlock|cloak/.test(text)) return "hexer";
  if (/fish|turtle|eel|shark|ray|aquatic|swim/.test(text)) return "swim";
  if (/rabbit|hare|bunny/.test(text)) return "rabbit";
  if (/bird|crow|raven|chicken|duck|pigeon|eagle|hawk|owl/.test(text)) {
    return "bird";
  }
  if (/cow|bull|sheep|ram|bear/.test(text)) return "heavy";
  if (/wolf|dog|hound|cat|deer|stag|doe|fawn/.test(text)) return "sideLeap";
  if (/robot|bot|chrominer|sentinel/.test(text)) return "robot";
  if (/muck|muckling|mucker|muckwad/.test(text)) return "mucker";
  return "generic";
}

export function npcEvadeProfileForDescriptor(
  ...descriptors: Array<string | undefined>
): NpcEvadeProfile {
  return NPC_EVADE_PROFILES[npcEvadeFamilyForDescriptor(...descriptors)];
}

export function lateralEvadeDirection({
  awayFromAttacker,
  seed,
}: {
  awayFromAttacker: ReadonlyVec3f;
  seed: number;
}): Vec3f {
  const away = normalizeMovementActionDirection(awayFromAttacker);
  const sign = Math.abs(Math.trunc(seed)) % 2 === 0 ? 1 : -1;
  return normalizeMovementActionDirection([-away[2] * sign, 0, away[0] * sign]);
}
