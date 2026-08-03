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
  const lastTouchPosRef = useRef<Vec2 | undefined>(undefined);
  const mobileLookTouchRef = useRef<
    | {
        identifier: number;
        position: Vec2;
        moves: number;
        totalX: number;
        totalY: number;
      }
    | undefined
  >(undefined);
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

    const touchWithIdentifier = (touches: TouchList, identifier: number) =>
      Array.from(touches).find((touch) => touch.identifier === identifier);

    const finishMobileLookTouch = (event: TouchEvent) => {
      const active = mobileLookTouchRef.current;
      if (
        active &&
        touchWithIdentifier(event.changedTouches, active.identifier)
      ) {
        canvas.dataset.biomesMobileLookState = "ended";
        mobileLookTouchRef.current = undefined;
      }
    };

    const mobileLookGestureCanStart = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return true;
      }
      if (
        target.closest(
          [
            "button",
            "a",
            "input",
            "textarea",
            "select",
            '[contenteditable="true"]',
            '[role="button"]',
            '[role="dialog"]',
            "[data-biomes-mobile-controls]",
            "[data-biomes-mobile-action]",
            "[data-biomes-mobile-interact]",
            ".biomes-ui-overlay",
            ".biomes-ui-panel",
            ".biomes-ui-hotbar-hud",
            ".chat-container",
          ].join(",")
        )
      ) {
        return false;
      }
      for (
        let current: Element | null = target;
        current;
        current = current.parentElement
      ) {
        const style = window.getComputedStyle(current);
        const scrollsVertically =
          /(auto|scroll)/.test(style.overflowY) &&
          current.scrollHeight > current.clientHeight;
        const scrollsHorizontally =
          /(auto|scroll)/.test(style.overflowX) &&
          current.scrollWidth > current.clientWidth;
        if (scrollsVertically || scrollsHorizontally) {
          return false;
        }
      }
      return true;
    };

    const beginMobileLookTouch = (event: TouchEvent) => {
      if (
        mobileLookTouchRef.current ||
        event.changedTouches.length === 0 ||
        !mobileLookGestureCanStart(event)
      ) {
        return;
      }
      focusTouchGameplay();
      const touch = event.changedTouches[0];
      mobileLookTouchRef.current = {
        identifier: touch.identifier,
        position: [touch.clientX, touch.clientY],
        moves: 0,
        totalX: 0,
        totalY: 0,
      };
      canvas.dataset.biomesMobileLookState = "active";
      canvas.dataset.biomesMobileLookTouchId = String(touch.identifier);
      canvas.dataset.biomesMobileLookMoves = "0";
      canvas.dataset.biomesMobileLookTotalX = "0";
      canvas.dataset.biomesMobileLookTotalY = "0";
    };

    const moveMobileLookTouch = (event: TouchEvent) => {
      const active = mobileLookTouchRef.current;
      if (!active) {
        return;
      }
      const touch = touchWithIdentifier(event.touches, active.identifier);
      if (!touch) {
        return;
      }
      event.preventDefault();
      const moveX = touch.clientX - active.position[0];
      const moveY = touch.clientY - active.position[1];
      input.moveTouchScreen("canvas", moveX, moveY);
      active.position = [touch.clientX, touch.clientY];
      active.moves += 1;
      active.totalX += moveX;
      active.totalY += moveY;
      canvas.dataset.biomesMobileLookMoves = String(active.moves);
      canvas.dataset.biomesMobileLookTotalX = String(active.totalX);
      canvas.dataset.biomesMobileLookTotalY = String(active.totalY);
    };

    const mobileLookListenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };
    if (clientConfig.mobileDevice) {
      document.addEventListener(
        "touchstart",
        beginMobileLookTouch,
        mobileLookListenerOptions
      );
      document.addEventListener(
        "touchmove",
        moveMobileLookTouch,
        mobileLookListenerOptions
      );
      document.addEventListener(
        "touchend",
        finishMobileLookTouch,
        mobileLookListenerOptions
      );
      document.addEventListener(
        "touchcancel",
        finishMobileLookTouch,
        mobileLookListenerOptions
      );
    }

    const cleanupMobileLookListeners = () => {
      if (!clientConfig.mobileDevice) {
        return;
      }
      document.removeEventListener(
        "touchstart",
        beginMobileLookTouch,
        mobileLookListenerOptions
      );
      document.removeEventListener(
        "touchmove",
        moveMobileLookTouch,
        mobileLookListenerOptions
      );
      document.removeEventListener(
        "touchend",
        finishMobileLookTouch,
        mobileLookListenerOptions
      );
      document.removeEventListener(
        "touchcancel",
        finishMobileLookTouch,
        mobileLookListenerOptions
      );
    };

    const cleanup = composeCleanups(
      cleanupMobileLookListeners,
      cleanListener(canvas, {
        touchmove: (e) => {
          if (clientConfig.mobileDevice) {
            return;
          }
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
          if (clientConfig.mobileDevice) {
            return;
          }
          if (e.touches.length > 0) {
            const touch = e.touches[0];
            lastTouchPosRef.current = [touch.clientX, touch.clientY];
          }
        },
        touchend: () => {
          if (clientConfig.mobileDevice) {
            return;
          }
          lastTouchPosRef.current = undefined;
        },
        touchcancel: () => {
          if (clientConfig.mobileDevice) {
            return;
          }
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
      mobileLookTouchRef.current = undefined;
      lastTouchPosRef.current = undefined;
      cleanup();
      pointerLockManager.detach();
      rendererController.detach();
      input.detach();
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className={`biomes-canvas${
        clientConfig.mobileDevice ? " biomes-canvas--mobile-look" : ""
      }`}
      data-biomes-mobile-look-drag={
        clientConfig.mobileDevice ? "true" : undefined
      }
      tabIndex={0}
    />
  );
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
