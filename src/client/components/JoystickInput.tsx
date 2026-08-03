import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { isTouchDevice } from "@/client/components/contexts/PointerLockContext";
import { containMobileControlEvent } from "@/client/components/mobileControlEvents";
import { useAnimation } from "@/client/util/animation";
import {
  MOBILE_JOYSTICK_ACTION_PULSE_MS,
  MOBILE_JOYSTICK_ACTION_SOURCE,
  MOBILE_JOYSTICK_CROUCH_SOURCE,
  MOBILE_JOYSTICK_JUMP_SOURCE,
  MOBILE_JOYSTICK_RUN_SOURCE,
  mobileJoystickDoubleTapDirectionForTest,
  mobileJoystickHardTapForTest,
  mobileJoystickMagnitude,
  mobileJoystickMovementActionForDirectionForTest,
  mobileJoystickRunMotionValueForTest,
  type MobileJoystickHardTap,
} from "@/client/game/util/mobile_joystick";
import type { Vec2 } from "@/shared/math/types";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { JoystickShape } from "react-joystick-component";

const Joystick = dynamic(
  () => import("react-joystick-component").then((mod) => mod.Joystick),
  {
    ssr: false,
  }
);

export const MaybeJoystickInput: React.FunctionComponent<{}> = React.memo(
  ({}) => {
    const { clientConfig } = useClientContext();

    if (!clientConfig.showVirtualJoystick) {
      return <></>;
    }

    return <JoystickInput />;
  }
);

export const JoystickInput: React.FunctionComponent<{}> = ({}) => {
  const { clientConfig, input, userId } = useClientContext();
  const touchDevice = isTouchDevice();
  const [mobileCrouchHeld, setMobileCrouchHeld] = useState(false);
  const [mobileJumpHeld, setMobileJumpHeld] = useState(false);
  const [joystickSize, setJoystickSize] = useState(() =>
    responsiveJoystickSize()
  );

  const leftPosRef = useRef([0, 0] as Vec2);
  const rightPosRef = useRef([0, 0] as Vec2);
  const leftRunningRef = useRef(false);
  const leftRunMotionRef = useRef(0);
  const leftGestureRef = useRef<
    | {
        startedAtMs: number;
        peak: Vec2;
      }
    | undefined
  >(undefined);
  const lastHardTapRef = useRef<MobileJoystickHardTap>(undefined);
  const movementActionPulseNonceRef = useRef(0);
  const crouchPointerIdRef = useRef<number>(undefined);
  const jumpPointerIdRef = useRef<number>(undefined);

  const nowMs = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const resetLeftJoystick = () => {
    leftPosRef.current = [0, 0];
    leftRunningRef.current = false;
    leftRunMotionRef.current = 0;
    input.setSyntheticMotion("run", MOBILE_JOYSTICK_RUN_SOURCE, 0);
  };

  const resetJoystickTapGesture = () => {
    leftGestureRef.current = undefined;
    lastHardTapRef.current = undefined;
  };

  const releaseMobileCrouch = (updateUi = true) => {
    crouchPointerIdRef.current = undefined;
    input.setSyntheticMotion("crouch", MOBILE_JOYSTICK_CROUCH_SOURCE, 0);
    if (updateUi) {
      setMobileCrouchHeld(false);
    }
  };

  const releaseMobileJump = (updateUi = true) => {
    jumpPointerIdRef.current = undefined;
    input.setSyntheticAction("jump", MOBILE_JOYSTICK_JUMP_SOURCE, false);
    if (updateUi) {
      setMobileJumpHeld(false);
    }
  };

  const beginLeftJoystickGesture = (x: number, y: number) => {
    leftGestureRef.current = {
      startedAtMs: nowMs(),
      peak: [x, y],
    };
  };

  const updateLeftJoystickGesture = (x: number, y: number) => {
    if (!leftGestureRef.current) {
      beginLeftJoystickGesture(x, y);
      return;
    }
    if (
      mobileJoystickMagnitude(x, y) >
      mobileJoystickMagnitude(...leftGestureRef.current.peak)
    ) {
      leftGestureRef.current.peak = [x, y];
    }
  };

  const triggerDirectionalMovementAction = (
    direction: readonly [number, number]
  ) => {
    const source = `${MOBILE_JOYSTICK_ACTION_SOURCE}:${++movementActionPulseNonceRef.current}`;
    const command = mobileJoystickMovementActionForDirectionForTest(direction);
    input.setSyntheticMotion("lateral", source, command.lateral);
    input.setSyntheticMotion("forward", source, command.forward);
    void input
      .pulseAction(command.action, MOBILE_JOYSTICK_ACTION_PULSE_MS, source)
      .finally(() => {
        input.setSyntheticMotion("lateral", source, 0);
        input.setSyntheticMotion("forward", source, 0);
      });
  };

  const finishLeftJoystickGesture = () => {
    const gesture = leftGestureRef.current;
    leftGestureRef.current = undefined;
    if (!gesture) {
      lastHardTapRef.current = undefined;
      return;
    }
    const hardTap = mobileJoystickHardTapForTest({
      startedAtMs: gesture.startedAtMs,
      releasedAtMs: nowMs(),
      peakX: gesture.peak[0],
      peakY: gesture.peak[1],
    });
    if (!hardTap) {
      lastHardTapRef.current = undefined;
      return;
    }
    const movementDirection = mobileJoystickDoubleTapDirectionForTest(
      lastHardTapRef.current,
      hardTap
    );
    if (movementDirection) {
      lastHardTapRef.current = undefined;
      triggerDirectionalMovementAction(movementDirection);
    } else {
      lastHardTapRef.current = hardTap;
    }
  };

  useEffect(() => {
    const updateSize = () => setJoystickSize(responsiveJoystickSize());
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  useEffect(() => {
    const resetForInterruption = () => {
      resetLeftJoystick();
      resetJoystickTapGesture();
      releaseMobileCrouch();
      releaseMobileJump();
    };
    const resetWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        resetForInterruption();
      }
    };
    window.addEventListener("blur", resetForInterruption);
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      window.removeEventListener("blur", resetForInterruption);
      document.removeEventListener("visibilitychange", resetWhenHidden);
      resetLeftJoystick();
      resetJoystickTapGesture();
      releaseMobileCrouch(false);
      releaseMobileJump(false);
    };
  }, [input]);

  useAnimation(() => {
    input.moveVirtualJoycon("left", ...leftPosRef.current);
    input.setSyntheticMotion(
      "run",
      MOBILE_JOYSTICK_RUN_SOURCE,
      leftRunMotionRef.current
    );
    if (!touchDevice) {
      input.moveVirtualJoycon("right", ...rightPosRef.current);
    }
  });

  return (
    <div
      className={`joysticks${
        clientConfig.mobileDevice ? " joysticks--mobile" : ""
      }`}
      data-biomes-mobile-controls={
        clientConfig.mobileDevice ? "true" : undefined
      }
    >
      {userId && (
        <div className="mobile-movement-controls">
          <div
            className="joystick left"
            role="group"
            aria-label="Movement joystick"
            title="Double-tap a direction to dodge"
            data-biomes-mobile-double-tap-dodge="true"
          >
            <Joystick
              size={joystickSize}
              baseColor="rgb(0, 0, 51)"
              stickColor="rgba(61, 89, 171)"
              stickShape={JoystickShape.Square}
              baseShape={JoystickShape.Square}
              start={(evt) => {
                beginLeftJoystickGesture(evt.x ?? 0, evt.y ?? 0);
              }}
              stop={() => {
                finishLeftJoystickGesture();
                resetLeftJoystick();
              }}
              move={(evt) => {
                const x = evt.x ?? 0;
                const y = evt.y ?? 0;
                leftPosRef.current = [x, y];
                updateLeftJoystickGesture(x, y);
                leftRunMotionRef.current = mobileJoystickRunMotionValueForTest(
                  x,
                  y,
                  leftRunningRef.current
                );
                leftRunningRef.current = leftRunMotionRef.current > 0;
              }}
            />
          </div>
          {clientConfig.mobileDevice ? (
            <div className="mobile-movement-buttons">
              <button
                type="button"
                className={`mobile-movement-button mobile-crouch-button${
                  mobileCrouchHeld ? " mobile-crouch-button--held" : ""
                }`}
                aria-label="Hold C to crouch"
                aria-pressed={mobileCrouchHeld}
                data-biomes-mobile-crouch="true"
                onPointerDown={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current !== undefined) {
                    return;
                  }
                  crouchPointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  input.setSyntheticMotion(
                    "crouch",
                    MOBILE_JOYSTICK_CROUCH_SOURCE,
                    1
                  );
                  setMobileCrouchHeld(true);
                }}
                onPointerUp={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current === event.pointerId) {
                    releaseMobileCrouch();
                  }
                }}
                onPointerCancel={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current === event.pointerId) {
                    releaseMobileCrouch();
                  }
                }}
                onLostPointerCapture={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current === event.pointerId) {
                    releaseMobileCrouch();
                  }
                }}
                onClick={containMobileControlEvent}
                onContextMenu={containMobileControlEvent}
              >
                <span className="mobile-movement-button__key">C</span>
                <span className="mobile-movement-button__label">Crouch</span>
              </button>
              <button
                type="button"
                className={`mobile-movement-button mobile-jump-button${
                  mobileJumpHeld ? " mobile-jump-button--held" : ""
                }`}
                aria-label="Jump or hold to rise"
                aria-pressed={mobileJumpHeld}
                data-biomes-mobile-jump="true"
                onPointerDown={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current !== undefined) {
                    return;
                  }
                  jumpPointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  input.setSyntheticAction(
                    "jump",
                    MOBILE_JOYSTICK_JUMP_SOURCE,
                    true
                  );
                  setMobileJumpHeld(true);
                }}
                onPointerUp={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current === event.pointerId) {
                    releaseMobileJump();
                  }
                }}
                onPointerCancel={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current === event.pointerId) {
                    releaseMobileJump();
                  }
                }}
                onLostPointerCapture={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current === event.pointerId) {
                    releaseMobileJump();
                  }
                }}
                onClick={containMobileControlEvent}
                onContextMenu={containMobileControlEvent}
              >
                <span className="mobile-movement-button__key">↑</span>
                <span className="mobile-movement-button__label">Jump</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`mobile-crouch-button${
                mobileCrouchHeld ? " mobile-crouch-button--held" : ""
              }`}
              aria-label="Hold C to crouch"
              aria-pressed={mobileCrouchHeld}
              onPointerDown={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current !== undefined) {
                  return;
                }
                crouchPointerIdRef.current = event.pointerId;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                input.setSyntheticMotion(
                  "crouch",
                  MOBILE_JOYSTICK_CROUCH_SOURCE,
                  1
                );
                setMobileCrouchHeld(true);
              }}
              onPointerUp={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current === event.pointerId) {
                  releaseMobileCrouch();
                }
              }}
              onPointerCancel={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current === event.pointerId) {
                  releaseMobileCrouch();
                }
              }}
              onLostPointerCapture={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current === event.pointerId) {
                  releaseMobileCrouch();
                }
              }}
              onClick={containMobileControlEvent}
              onContextMenu={containMobileControlEvent}
            >
              <span className="mobile-crouch-button__key">C</span>
              <span className="mobile-crouch-button__label">Crouch</span>
            </button>
          )}
        </div>
      )}
      <div className="spacer" />
      {!touchDevice && (
        <div
          className="joystick right"
          role="group"
          aria-label="Camera joystick"
        >
          <Joystick
            size={joystickSize}
            baseColor="rgb(0, 0, 51)"
            stickColor="rgba(61, 89, 171)"
            stickShape={JoystickShape.Square}
            baseShape={JoystickShape.Square}
            stop={() => {
              rightPosRef.current = [0, 0];
            }}
            move={(evt) => {
              rightPosRef.current = [evt.x ?? 0, evt.y ?? 0];
            }}
          />
        </div>
      )}
    </div>
  );
};

export function responsiveJoystickSize() {
  if (typeof window === "undefined") {
    return 88;
  }
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  return Math.round(
    Math.max(72, Math.min(112, Math.min(viewportWidth, viewportHeight) * 0.22))
  );
}
