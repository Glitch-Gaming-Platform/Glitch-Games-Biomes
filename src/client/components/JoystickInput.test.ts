/// <reference types="mocha" />

import {
  MOBILE_JOYSTICK_RUN_ENGAGE_THRESHOLD,
  MOBILE_JOYSTICK_RUN_RELEASE_THRESHOLD,
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
    assert.equal(mobileJoystickRunMotionValueForTest(0, 1), 1);
  });
});
