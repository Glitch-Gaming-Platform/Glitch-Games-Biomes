import { cleanEmitterCallback, cleanListener } from "@/client/util/helpers";
import { log } from "@/shared/logging";
import { fireAndForget } from "@/shared/util/async";
import { makeCvalHook } from "@/shared/util/cvals";
import EventEmitter from "events";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type TypedEventEmitter from "typed-emitter";

export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function supportsPointerLock() {
  return typeof document.exitPointerLock === "function";
}

export function tryExitPointerLock() {
  if (supportsPointerLock()) {
    document.exitPointerLock();
  }
}

async function requestPointerLockWithUnadjustedMovement(
  element: HTMLCanvasElement
) {
  // Use the unadjustedMovement flag if available.
  // This removes mouse acceleration for better cross-platform mouse movement,
  // but more importantly significantly reduces movement spikes on high
  // polling rate mice on Chrome.
  // https://web.dev/disable-mouse-acceleration/

  if (!supportsPointerLock()) {
    log.warn("Unable to request pointer lock since element doesn't support it");
    return;
  }

  try {
    await (
      element.requestPointerLock as (options?: {
        unadjustedMovement?: boolean;
      }) => Promise<null> | undefined
    )({
      unadjustedMovement: true,
    });
  } catch (error: any) {
    try {
      await (element.requestPointerLock() as unknown as Promise<unknown>);
    } catch (error: any) {
      log.warn("Unable to request pointer lock", { error });
    }
  }
}

export function usePointerLockEnteringStatus() {
  const manager = usePointerLockManager();
  const [isEntering, setEntering] = useState(manager.isEntering);
  useEffect(
    () =>
      cleanEmitterCallback(manager.emitter, {
        isEnteringChange: () => {
          setEntering(manager.isEntering);
        },
      }),
    [manager]
  );

  return [isEntering];
}

export function usePointerLockStatus(): [boolean, () => void] {
  const manager = usePointerLockManager();
  const [isLocked, setIsLocked] = useState(
    manager?.isLocked() ?? Boolean(document.pointerLockElement)
  );
  useEffect(
    () =>
      cleanListener(document, {
        pointerlockchange: () => {
          setIsLocked(manager.isLocked());
        },
      }),
    [manager]
  );

  return [
    isLocked,
    () => {
      manager.focusAndLock();
    },
  ];
}

export type PointerLockManagerEvents = {
  onAttach: () => unknown;
  onDetach: () => unknown;
  isEnteringChange: () => unknown;
};

export class PointerLockManager {
  lockElementRef?: React.RefObject<HTMLCanvasElement>;
  deadZone?: number;
  emitter = new EventEmitter() as TypedEventEmitter<PointerLockManagerEvents>;

  isEntering = false;
  private lockInterval?: ReturnType<typeof setInterval>;

  constructor() {
    makeCvalHook({
      path: ["game", "pointerLock", "locked"],
      help: "Current pointerLock lock state.",
      collect: () => this.isLocked(),
    });
    makeCvalHook({
      path: ["game", "pointerLock", "focused"],
      help: "Current pointerLock focus state.",
      collect: () => this.isFocused(),
    });
    makeCvalHook({
      path: ["game", "pointerLock", "allowHUDInput"],
      help: "Current pointerLock HUD input state.",
      collect: () => this.allowHUDInput(),
    });
    makeCvalHook({
      path: ["game", "pointerLock", "allowKeyInput"],
      help: "Current pointerLock key input state.",
      collect: () => this.allowKeyInput(),
    });
  }

  attachToElementRef(elementRef: React.RefObject<HTMLCanvasElement>) {
    this.lockElementRef = elementRef;
    this.emitter.emit("onAttach");
  }

  detach() {
    this.lockElementRef = undefined;
    this.emitter.emit("onDetach");
  }

  unlock() {
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = undefined;
    }
    if (this.isEntering) {
      this.isEntering = false;
      this.emitter.emit("isEnteringChange");
    }
    tryExitPointerLock();
  }

  focusAndLock() {
    if (this.lockInterval || !this.lockElementRef?.current) {
      return;
    }

    if (this.isLocked()) {
      this.lockElementRef?.current?.focus();
    } else {
      if (this.lockElementRef.current) {
        fireAndForget(
          requestPointerLockWithUnadjustedMovement(this.lockElementRef.current)
        );
      }
      this.lockElementRef?.current?.focus();

      const start = performance.now();
      this.lockInterval = setInterval(() => {
        if (
          this.isLocked() ||
          performance.now() - start > 5000 ||
          !this.lockElementRef
        ) {
          this.isEntering = false;
          this.emitter.emit("isEnteringChange");

          this.lockElementRef?.current?.focus();
          clearInterval(this.lockInterval);
          this.lockInterval = undefined;
        } else {
          if (!this.isEntering) {
            this.isEntering = true;
            this.emitter.emit("isEnteringChange");
          }
          if (this.lockElementRef.current) {
            fireAndForget(
              requestPointerLockWithUnadjustedMovement(
                this.lockElementRef.current
              )
            );
          }
        }
      }, 10);
    }
  }

  isLockedAndFocused() {
    return this.isLocked() && this.isFocused();
  }

  isLockedOrFocused() {
    return this.isLocked() || this.isFocused();
  }

  allowHUDInput() {
    if (performance.now() <= (this.deadZone || 0)) {
      return false;
    }
    // HARTHMERE_HUD_INPUT_LOCKED_WITHOUT_FOCUS_V1
    // Previously this required isLockedAndFocused() — both pointer lock AND
    // document.activeElement === the game canvas. In practice the browser often
    // pointer-locks the canvas while document.activeElement stays on <body>
    // (e.g. right after entering the world or after any DOM focus shuffle).
    // While the pointer is locked, keyboard events are still delivered to the
    // document, so HUD shortcuts like "F" to talk to an NPC should fire — but
    // the strict focus check swallowed them. The player only recovered by
    // pressing Escape (releasing the lock) and clicking back in, which finally
    // put activeElement on the canvas. Treat an active pointer lock as
    // sufficient; otherwise fall back to the focus-based path for the
    // unlocked-but-focused case. A focused text input never has the canvas
    // locked or focused, so typing is unaffected.
    if (this.isLocked()) {
      return true;
    }
    return this.isFocused();
  }

  allowKeyInput() {
    // allow key input unless we're focused on an input element
    return document.activeElement?.tagName !== "INPUT";
  }

  setDeadZone(durationMs: number) {
    this.deadZone = performance.now() + durationMs;
  }

  isFocused() {
    return (
      Boolean(document.activeElement) &&
      document.activeElement === this.lockElementRef?.current
    );
  }

  isLocked() {
    return (
      Boolean(document.pointerLockElement) &&
      document.pointerLockElement == this.lockElementRef?.current
    );
  }
}

export const PointerLockManagerContext = createContext(
  new PointerLockManager()
);

export const usePointerLockManager = () =>
  useContext(PointerLockManagerContext);
