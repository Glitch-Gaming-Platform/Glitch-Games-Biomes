import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { isTouchDevice } from "@/client/components/contexts/PointerLockContext";
import { useAnimation } from "@/client/util/animation";
import {
  MOBILE_JOYSTICK_RUN_SOURCE,
  mobileJoystickRunMotionValueForTest,
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
  const { input, userId } = useClientContext();
  const touchDevice = isTouchDevice();
  const [joystickSize, setJoystickSize] = useState(() =>
    responsiveJoystickSize()
  );

  const leftPosRef = useRef([0, 0] as Vec2);
  const rightPosRef = useRef([0, 0] as Vec2);
  const leftRunningRef = useRef(false);
  const leftRunMotionRef = useRef(0);

  const resetLeftJoystick = () => {
    leftPosRef.current = [0, 0];
    leftRunningRef.current = false;
    leftRunMotionRef.current = 0;
    input.setSyntheticMotion("run", MOBILE_JOYSTICK_RUN_SOURCE, 0);
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
    const resetForInterruption = () => resetLeftJoystick();
    const resetWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        resetLeftJoystick();
      }
    };
    window.addEventListener("blur", resetForInterruption);
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      window.removeEventListener("blur", resetForInterruption);
      document.removeEventListener("visibilitychange", resetWhenHidden);
      resetLeftJoystick();
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
    <div className="joysticks" data-biomes-mobile-controls="true">
      {userId && (
        <div
          className="joystick left"
          role="group"
          aria-label="Movement joystick"
        >
          <Joystick
            size={joystickSize}
            baseColor="rgb(0, 0, 51)"
            stickColor="rgba(61, 89, 171)"
            stickShape={JoystickShape.Square}
            baseShape={JoystickShape.Square}
            stop={() => {
              resetLeftJoystick();
            }}
            move={(evt) => {
              const x = evt.x ?? 0;
              const y = evt.y ?? 0;
              leftPosRef.current = [x, y];
              leftRunMotionRef.current = mobileJoystickRunMotionValueForTest(
                x,
                y,
                leftRunningRef.current
              );
              leftRunningRef.current = leftRunMotionRef.current > 0;
            }}
          />
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
