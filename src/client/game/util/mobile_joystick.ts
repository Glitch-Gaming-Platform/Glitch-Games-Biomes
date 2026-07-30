export const MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD = 0.84;
export const MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD = 0.72;
export const MOBILE_JOYSTICK_ACTIVE_THRESHOLD = 0.01;
export const MOBILE_JOYSTICK_RUN_SOURCE = "mobile-joystick";

export function mobileJoystickMagnitude(x: number, y: number) {
  return Math.min(1, Math.hypot(Number(x) || 0, Number(y) || 0));
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
