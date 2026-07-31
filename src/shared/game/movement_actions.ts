import { MovementState } from "@/shared/ecs/gen/components";
import type { ReadonlyMovementState } from "@/shared/ecs/gen/components";
import type {
  MovementActionType,
  ReadonlyVec3f,
  Vec3f,
} from "@/shared/ecs/gen/types";

export const RESERVED_MOVEMENT_KEY_CODES = ["KeyZ", "KeyX", "KeyC"] as const;
export const MOVEMENT_ACTION_STAMINA_COST = 3;
export const PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES = [
  "dodgeLeft",
  "dodgeRight",
  "dodgeForward",
  "dodgeBack",
  "evade",
] as const;

export function movementActionPressedOnEdge(
  pressed: boolean,
  wasPressed: boolean
): boolean {
  return pressed && !wasPressed;
}

export const PLAYER_MOVEMENT_ACTION_TIMING = {
  dodge: {
    durationSeconds: 0.5,
    invulnerabilitySeconds: 0.28,
    cooldownSeconds: 0.85,
    speedMetersPerSecond: 9.5,
  },
  evade: {
    durationSeconds: 0.72,
    invulnerabilitySeconds: 0.42,
    cooldownSeconds: 1.15,
    speedMetersPerSecond: 8.25,
  },
} as const satisfies Record<
  MovementActionType,
  {
    durationSeconds: number;
    invulnerabilitySeconds: number;
    cooldownSeconds: number;
    speedMetersPerSecond: number;
  }
>;

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
  const speed = PLAYER_MOVEMENT_ACTION_TIMING[action].speedMetersPerSecond;
  const tickCoverage = activeSeconds / dtSeconds;
  return [
    normalizedDirection[0] * speed * tickCoverage,
    0,
    normalizedDirection[2] * speed * tickCoverage,
  ];
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
  return Boolean(
    movementActionIsActive(state, nowSeconds) &&
      nowSeconds < (state?.invulnerability_expiry_time ?? 0)
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
