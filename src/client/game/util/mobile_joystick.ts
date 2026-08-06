export const MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD = 0.84;
export const MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD = 0.72;
export const MOBILE_JOYSTICK_ACTIVE_THRESHOLD = 0.01;
export const MOBILE_JOYSTICK_RUN_SOURCE = "mobile-joystick";
export const MOBILE_JOYSTICK_CROUCH_SOURCE = "mobile-crouch-button";
export const MOBILE_JOYSTICK_JUMP_SOURCE = "mobile-jump-button";
export const MOBILE_JOYSTICK_ACTION_SOURCE = "mobile-joystick-double-tap";
export const MOBILE_JOYSTICK_HARD_TAP_THRESHOLD = 0.82;
export const MOBILE_JOYSTICK_HARD_TAP_MAX_DURATION_MS = 220;
export const MOBILE_JOYSTICK_DOUBLE_TAP_WINDOW_MS = 320;
export const MOBILE_JOYSTICK_DOUBLE_TAP_MIN_DIRECTION_DOT = 0.6;
export const MOBILE_JOYSTICK_ACTION_PULSE_MS = 120;
export const MOBILE_JOYSTICK_DIRECTION_AXIS_THRESHOLD = 0.35;
export const MOBILE_JOYSTICK_RESPONSE_DEAD_ZONE = 0.035;
export const MOBILE_JOYSTICK_RESPONSE_EXPONENT = 0.72;

export interface MobileJoystickHardTap {
  releasedAtMs: number;
  direction: readonly [number, number];
}

export function mobileJoystickMagnitude(x: number, y: number) {
  return Math.min(1, Math.hypot(Number(x) || 0, Number(y) || 0));
}

/**
 * Preserve the joystick direction and full-deflection value while making the
 * first half of thumb travel more responsive. The library reports normalized
 * axes, so a radial curve avoids making diagonals faster than cardinals. A
 * small dead zone still filters the tiny pointer jitter iOS emits when a
 * finger first settles on the control.
 */
export function mobileJoystickResponsivePositionForTest(
  x: number,
  y: number
): readonly [number, number] {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const magnitude = Math.min(1, Math.hypot(safeX, safeY));
  if (magnitude <= MOBILE_JOYSTICK_RESPONSE_DEAD_ZONE) {
    return [0, 0];
  }
  const normalizedMagnitude =
    (magnitude - MOBILE_JOYSTICK_RESPONSE_DEAD_ZONE) /
    (1 - MOBILE_JOYSTICK_RESPONSE_DEAD_ZONE);
  const responsiveMagnitude = Math.pow(
    normalizedMagnitude,
    MOBILE_JOYSTICK_RESPONSE_EXPONENT
  );
  const scale = responsiveMagnitude / Math.hypot(safeX, safeY);
  return [safeX * scale, safeY * scale];
}

function normalizedMobileJoystickDirection(
  x: number,
  y: number
): readonly [number, number] | undefined {
  const safeX = Number(x);
  const safeY = Number(y);
  const magnitude = Math.hypot(safeX, safeY);
  if (
    !Number.isFinite(safeX) ||
    !Number.isFinite(safeY) ||
    magnitude < MOBILE_JOYSTICK_HARD_TAP_THRESHOLD
  ) {
    return;
  }
  return [safeX / magnitude, safeY / magnitude];
}

/**
 * A hard tap must reach the outer ring and release promptly. This is evaluated
 * on release so one drag cannot be mistaken for multiple taps by repeated
 * joystick move callbacks.
 */
export function mobileJoystickHardTapForTest({
  startedAtMs,
  releasedAtMs,
  peakX,
  peakY,
}: {
  startedAtMs: number;
  releasedAtMs: number;
  peakX: number;
  peakY: number;
}): MobileJoystickHardTap | undefined {
  const durationMs = releasedAtMs - startedAtMs;
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(releasedAtMs) ||
    durationMs < 0 ||
    durationMs > MOBILE_JOYSTICK_HARD_TAP_MAX_DURATION_MS
  ) {
    return;
  }
  const direction = normalizedMobileJoystickDirection(peakX, peakY);
  if (!direction) {
    return;
  }
  return { releasedAtMs, direction };
}

/** Return the second tap direction when two quick taps form one gesture. */
export function mobileJoystickDoubleTapDirectionForTest(
  first: MobileJoystickHardTap | undefined,
  second: MobileJoystickHardTap
): readonly [number, number] | undefined {
  if (!first) {
    return;
  }
  const elapsedMs = second.releasedAtMs - first.releasedAtMs;
  const directionDot =
    first.direction[0] * second.direction[0] +
    first.direction[1] * second.direction[1];
  if (
    elapsedMs < 0 ||
    elapsedMs > MOBILE_JOYSTICK_DOUBLE_TAP_WINDOW_MS ||
    directionDot < MOBILE_JOYSTICK_DOUBLE_TAP_MIN_DIRECTION_DOT
  ) {
    return;
  }
  return second.direction;
}

/**
 * Convert the analog tap into the eight directions supported by player
 * physics. Cardinal taps use the directional dodge clips; diagonals use evade
 * because the dodge action intentionally resolves to one cardinal axis.
 */
export function mobileJoystickMovementActionForDirectionForTest(
  direction: readonly [number, number]
): {
  action: "dodge" | "evade";
  lateral: -1 | 0 | 1;
  forward: -1 | 0 | 1;
} {
  const axis = (value: number): -1 | 0 | 1 =>
    Math.abs(value) < MOBILE_JOYSTICK_DIRECTION_AXIS_THRESHOLD
      ? 0
      : value < 0
        ? -1
        : 1;
  const lateral = axis(direction[0]);
  const forward = axis(direction[1]);
  return {
    action: lateral !== 0 && forward !== 0 ? "evade" : "dodge",
    lateral,
    forward,
  };
}

/** Mobile crouch is hold-only and must not mutate the keyboard toggle state. */
export function mobileJoystickCrouchRequestedForTest(
  nonMobileCrouchRequested: boolean,
  mobileCrouchHeld: boolean
) {
  return nonMobileCrouchRequested || mobileCrouchHeld;
}

export function mobileJoystickShouldRunForTest(
  x: number,
  y: number,
  wasRunning = false
) {
  const magnitude = mobileJoystickMagnitude(x, y);
  return wasRunning
    ? magnitude >= MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD
    : magnitude >= MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD;
}

/**
 * The named synthetic run source encodes all three joystick states:
 *  - 0: released
 *  - -1: active walk (explicitly overrides a latched keyboard run toggle)
 *  - 1: active run
 */
export function mobileJoystickRunMotionValueForTest(
  x: number,
  y: number,
  wasRunning = false
) {
  if (mobileJoystickMagnitude(x, y) <= MOBILE_JOYSTICK_ACTIVE_THRESHOLD) {
    return 0;
  }
  return mobileJoystickShouldRunForTest(x, y, wasRunning) ? 1 : -1;
}
