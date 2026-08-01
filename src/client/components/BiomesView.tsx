import { BiomesChrome } from "@/client/components/BiomesChrome";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  supportsPointerLock,
  usePointerLockDisabledStatus,
  usePointerLockManager,
  usePointerLockStatus,
} from "@/client/components/contexts/PointerLockContext";
import {
  cleanEmitterCallback,
  cleanListener,
  composeCleanups,
} from "@/client/util/helpers";
import type { Vec2 } from "@/shared/math/types";
import { ok } from "assert";
import React, { useEffect, useRef } from "react";

function BiomesCanvas({}: {}) {
  const { input, audioManager, rendererController, clientConfig } =
    useClientContext();
  const lastTouchPosRef = useRef<Vec2 | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerLockManager = usePointerLockManager();

  useEffect(() => {
    // Initialize the canvas element.
    const canvas = canvasRef.current;
    ok(canvas, "Canvas should exist.");
    canvas.focus();
    const initialPointerlessGameplay =
      clientConfig.showVirtualJoystick || !supportsPointerLock();
    pointerLockManager.attachToElementRef(canvasRef, {
      disablePointerLock: initialPointerlessGameplay,
    });

    const pointerlessGameplay = () =>
      initialPointerlessGameplay || pointerLockManager.isPointerLockDisabled();
    const activatePointerlessGameplay = () => {
      // Pointer-lock changes never fire on touch controls or browsers/embeds
      // that cannot use Pointer Lock, so attach input immediately. HUD pulses
      // and the virtual joystick write into this same input manager.
      input.attach(canvas);
      canvas.focus();
      void audioManager.resumeAudio();
    };

    if (pointerlessGameplay()) {
      activatePointerlessGameplay();
    }

    const focusTouchGameplay = () => {
      canvas.focus();
      void audioManager.resumeAudio();
    };

    const cleanup = composeCleanups(
      cleanListener(canvas, {
        touchmove: (e) => {
          e.preventDefault();
          if (e.touches.length > 0) {
            const touch = e.touches[0];
            if (lastTouchPosRef.current) {
              const moveX = touch.clientX - lastTouchPosRef.current[0];
              const moveY = touch.clientY - lastTouchPosRef.current[1];
              input.moveTouchScreen("canvas", moveX, moveY);
            }
            lastTouchPosRef.current = [touch.clientX, touch.clientY];
          }
        },
        touchstart: (e) => {
          focusTouchGameplay();
          if (e.touches.length > 0) {
            const touch = e.touches[0];
            lastTouchPosRef.current = [touch.clientX, touch.clientY];
          }
        },
        touchend: () => {
          lastTouchPosRef.current = undefined;
        },
        touchcancel: () => {
          lastTouchPosRef.current = undefined;
        },
        click: (e) => {
          // Resume Web Audio synchronously from the user's click. Embedded
          // browsers can expose Pointer Lock while rejecting every request;
          // waiting for pointerlockchange or the timed pointerless fallback
          // moves resume() outside the browser's trusted-gesture window.
          void audioManager.resumeAudio();
          if (pointerlessGameplay()) {
            canvas.focus();
            return;
          }
          if (!pointerLockManager.isLocked()) {
            pointerLockManager.focusAndLock();
            e.stopImmediatePropagation();
          }
        },
      }),
      cleanEmitterCallback(pointerLockManager.emitter, {
        pointerLockDisabledChange: () => {
          if (pointerLockManager.isPointerLockDisabled()) {
            activatePointerlessGameplay();
          }
        },
      }),
      cleanListener(canvas.ownerDocument, {
        pointerlockchange: () => {
          if (pointerlessGameplay()) {
            return;
          }
          if (pointerLockManager.isLocked()) {
            input.attach(canvas);
            // AudioContext is only available after a user gesture.
            // So we resume it here.
            void (async () => {
              await audioManager.resumeAudio();
            })();
          } else {
            input.detach();
          }
        },
      })
    );

    // Start rendering to the canvas.
    rendererController.attach(canvas);

    return () => {
      cleanup();
      pointerLockManager.detach();
      rendererController.detach();
      input.detach();
    };
  }, []);
  return <canvas ref={canvasRef} className="biomes-canvas" tabIndex={0} />;
}
const MemoCanvas = React.memo(BiomesCanvas);

export function BiomesView({}: {}) {
  const [locked] = usePointerLockStatus();
  const pointerLockDisabled = usePointerLockDisabledStatus();
  const { resources, clientConfig } = useClientContext();
  const pointerlessGameplay =
    clientConfig.showVirtualJoystick ||
    !supportsPointerLock() ||
    pointerLockDisabled;

  useEffect(() => {
    document.querySelector("body")?.classList.add("game");
    resources.update("/focus", (focus) => {
      focus.focused = locked || pointerlessGameplay;
    });
  }, [locked, pointerlessGameplay, resources]);

  return (
    <div className={`biomes-root`}>
      <BiomesChrome />
      <MemoCanvas />
    </div>
  );
}
