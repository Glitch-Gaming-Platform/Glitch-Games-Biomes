/// <reference types="mocha" />

import {
  MOBILE_JOYSTICK_DOUBLE_TAP_WINDOW_MS,
  MOBILE_JOYSTICK_HARD_TAP_MAX_DURATION_MS,
  MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD,
  MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD,
  mobileJoystickCrouchRequestedForTest,
  mobileJoystickDoubleTapDirectionForTest,
  mobileJoystickHardTapForTest,
  mobileJoystickMovementActionForDirectionForTest,
  mobileJoystickResponsivePositionForTest,
  mobileJoystickRunMotionValueForTest,
  mobileJoystickShouldRunForTest,
} from "@/client/game/util/mobile_joystick";
import assert from "assert";

describe("mobile joystick walk/run threshold", () => {
  it("walks for partial deflection and runs near the outer edge", () => {
    assert.equal(mobileJoystickShouldRunForTest(0, 0.45), false);
    assert.equal(
      mobileJoystickShouldRunForTest(0, MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD),
      true
    );
    assert.equal(mobileJoystickShouldRunForTest(-1, 0), true);
  });

  it("uses vector magnitude so full diagonal movement also runs", () => {
    assert.equal(mobileJoystickShouldRunForTest(0.65, 0.65), true);
  });

  it("uses hysteresis to avoid rapidly flickering between walk and run", () => {
    const betweenThresholds =
      (MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD +
        MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD) /
      2;
    assert.equal(
      mobileJoystickShouldRunForTest(0, betweenThresholds, false),
      false
    );
    assert.equal(
      mobileJoystickShouldRunForTest(0, betweenThresholds, true),
      true
    );
    assert.equal(
      mobileJoystickShouldRunForTest(
        0,
        MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD - 0.01,
        true
      ),
      false
    );
  });

  it("treats invalid coordinates as released", () => {
    assert.equal(mobileJoystickShouldRunForTest(Number.NaN, Number.NaN), false);
  });

  it("encodes active walking separately from release and running", () => {
    assert.equal(mobileJoystickRunMotionValueForTest(0, 0), 0);
    assert.equal(mobileJoystickRunMotionValueForTest(0, 0.4), -1);
    for (const [x, y] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      assert.equal(
        mobileJoystickRunMotionValueForTest(x, y),
        1,
        `full deflection ${x},${y} runs`
      );
    }
  });

  it("boosts partial thumb travel without changing direction or full deflection", () => {
    assert.deepEqual(mobileJoystickResponsivePositionForTest(0.01, 0), [0, 0]);
    const partial = mobileJoystickResponsivePositionForTest(0.25, 0);
    assert.ok(partial[0] > 0.25);
    assert.equal(partial[1], 0);
    assert.deepEqual(mobileJoystickResponsivePositionForTest(1, 0), [1, 0]);

    const diagonal = mobileJoystickResponsivePositionForTest(0.25, 0.25);
    assert.ok(Math.abs(diagonal[0] - diagonal[1]) < 1e-9);
    assert.ok(Math.hypot(...diagonal) > Math.hypot(0.25, 0.25));
  });

  it("recognizes only a quick outer-ring release as a hard tap", () => {
    assert.deepEqual(
      mobileJoystickHardTapForTest({
        startedAtMs: 100,
        releasedAtMs: 220,
        peakX: 0.9,
        peakY: 0,
      }),
      { releasedAtMs: 220, direction: [1, 0] }
    );
    assert.equal(
      mobileJoystickHardTapForTest({
        startedAtMs: 100,
        releasedAtMs: 180,
        peakX: 0.4,
        peakY: 0,
      }),
      undefined
    );
    assert.equal(
      mobileJoystickHardTapForTest({
        startedAtMs: 100,
        releasedAtMs: 100 + MOBILE_JOYSTICK_HARD_TAP_MAX_DURATION_MS + 1,
        peakX: 1,
        peakY: 0,
      }),
      undefined
    );
  });

  it("requires two quick hard taps in roughly the same direction", () => {
    const first = mobileJoystickHardTapForTest({
      startedAtMs: 0,
      releasedAtMs: 100,
      peakX: 1,
      peakY: 0,
    });
    const sameDirection = mobileJoystickHardTapForTest({
      startedAtMs: 180,
      releasedAtMs: 250,
      peakX: 0.9,
      peakY: 0.2,
    });
    const oppositeDirection = mobileJoystickHardTapForTest({
      startedAtMs: 180,
      releasedAtMs: 250,
      peakX: -1,
      peakY: 0,
    });
    assert.ok(first && sameDirection && oppositeDirection);
    assert.ok(
      mobileJoystickDoubleTapDirectionForTest(first, sameDirection),
      "same-direction double tap should evade"
    );
    assert.equal(
      mobileJoystickDoubleTapDirectionForTest(first, oppositeDirection),
      undefined
    );
    assert.equal(
      mobileJoystickDoubleTapDirectionForTest(first, {
        ...sameDirection,
        releasedAtMs:
          first.releasedAtMs + MOBILE_JOYSTICK_DOUBLE_TAP_WINDOW_MS + 1,
      }),
      undefined
    );
  });

  it("uses dodge for cardinal taps and evade for diagonal taps", () => {
    assert.deepEqual(mobileJoystickMovementActionForDirectionForTest([1, 0]), {
      action: "dodge",
      lateral: 1,
      forward: 0,
    });
    assert.deepEqual(
      mobileJoystickMovementActionForDirectionForTest([0.1, -0.99]),
      {
        action: "dodge",
        lateral: 0,
        forward: -1,
      }
    );
    assert.deepEqual(
      mobileJoystickMovementActionForDirectionForTest([0.7, 0.7]),
      {
        action: "evade",
        lateral: 1,
        forward: 1,
      }
    );
  });

  it("keeps the mobile crouch hold independent from keyboard toggle input", () => {
    assert.equal(mobileJoystickCrouchRequestedForTest(false, false), false);
    assert.equal(mobileJoystickCrouchRequestedForTest(true, false), true);
    assert.equal(mobileJoystickCrouchRequestedForTest(false, true), true);
  });
});
