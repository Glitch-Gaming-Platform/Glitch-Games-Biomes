import { cleanEmitterCallback, cleanListener } from "@/client/util/helpers";
import { log } from "@/shared/logging";
import { fireAndForget } from "@/shared/util/async";
import { makeCvalHook } from "@/shared/util/cvals";
import EventEmitter from "events";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type TypedEventEmitter from "typed-emitter";

export function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
}

export function supportsPointerLock() {
  return (
    typeof document !== "undefined" &&
    typeof document.exitPointerLock === "function"
  );
}

export function shouldUsePointerLock() {
  return supportsPointerLock() && !isTouchDevice();
}

export function tryExitPointerLock() {
  if (supportsPointerLock()) {
    document.exitPointerLock();
  }
}

type PointerLockResult =
  "locked" | "cooldown" | "gesture-required" | "terminal-error" | "error";

// Desktop Safari and all iOS browsers run WebKit, which only grants pointer
// lock from an active user gesture. Chrome/Edge (Blink) and Firefox (Gecko)
// allow timer-driven re-locking (e.g. to ride out Chrome's post-Esc lock
// cooldown), so we must keep retrying there.
function isWebKitEngine(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  // Apple desktop Safari: has "Safari" but none of the other-engine markers.
  const isAppleSafari =
    /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  // iOS/iPadOS — every browser there is WebKit regardless of branding.
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isAppleSafari || isIOS;
}

// Returns true when a requestPointerLock rejection means "a fresh user gesture
// is required", which a timer-driven retry can never satisfy. The "user
// gesture" message match is semantically safe on every engine and is distinct
// from Chrome's post-Esc cooldown rejection (a SecurityError whose message is
// "...exited the lock before this request was completed"), so Chrome/Firefox
// retry behavior is preserved. The broad NotAllowedError-name match is gated
// to WebKit so a transient NotAllowedError on Blink/Gecko never stops a retry
// loop that would otherwise succeed.
function isGestureRequiredError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  const message = String((error as { message?: string } | null)?.message ?? "");
  if (/user gesture/i.test(message)) {
    return true;
  }
  return name === "NotAllowedError" && isWebKitEngine();
}

export function isPointerLockCooldownErrorForTest(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "");
  // Chromium post-exit-cooldown errors require a new deliberate user action.
  // Retrying every 125 ms only extends the noisy request-rate failure seen as
  // "Too many pointer lock requests" in the captured inventory session.
  return (
    /pointer lock cannot be acquired immediately after.*exited/i.test(
      message
    ) ||
    /exited the lock before this request (?:was )?completed/i.test(message) ||
    /Too many pointer lock requests/i.test(message)
  );
}

export function isTerminalPointerLockErrorForTest(error: unknown): boolean {
  const name = String((error as { name?: string } | null)?.name ?? "");
  const message = String((error as { message?: string } | null)?.message ?? "");
  // Chromium returns this UnknownError when the current embedding/platform
  // exposes Pointer Lock but cannot complete it. Retrying the same request at
  // 100 Hz cannot recover and produced the audit's console/main-thread flood.
  // Keep SecurityError/NotAllowedError out of this classifier: those can be a
  // transient post-Esc cooldown or a user-gesture requirement handled above.
  return (
    name === "UnknownError" ||
    name === "WrongDocumentError" ||
    /if you see this error we have a bug/i.test(message) ||
    /pointer lock.*(?:not supported|unavailable|cannot be used)/i.test(
      message
    ) ||
    /root document of this element is not valid for pointer lock/i.test(message)
  );
}

async function requestPointerLockWithUnadjustedMovement(
  element: HTMLCanvasElement
): Promise<PointerLockResult> {
  // Use the unadjustedMovement flag if available.
  // This removes mouse acceleration for better cross-platform mouse movement,
  // but more importantly significantly reduces movement spikes on high
  // polling rate mice on Chrome.
  // https://web.dev/disable-mouse-acceleration/

  if (!supportsPointerLock()) {
    log.warn("Unable to request pointer lock since element doesn't support it");
    return "error";
  }

  try {
    await (
      element.requestPointerLock as (options?: {
        unadjustedMovement?: boolean;
      }) => Promise<void> | undefined
    )({
      unadjustedMovement: true,
    });
    return "locked";
  } catch (error: any) {
    if (isPointerLockCooldownErrorForTest(error)) {
      return "cooldown";
    }
    if (isGestureRequiredError(error)) {
      return "gesture-required";
    }
    if (isTerminalPointerLockErrorForTest(error)) {
      log.warn("Pointer lock is unavailable; using focused input", { error });
      return "terminal-error";
    }
    try {
      await (element.requestPointerLock() as unknown as Promise<unknown>);
      return "locked";
    } catch (error: any) {
      if (isPointerLockCooldownErrorForTest(error)) {
        return "cooldown";
      }
      if (isGestureRequiredError(error)) {
        return "gesture-required";
      }
      if (isTerminalPointerLockErrorForTest(error)) {
        log.warn("Pointer lock is unavailable; using focused input", {
          error,
        });
        return "terminal-error";
      }
      log.warn("Unable to request pointer lock", { error });
      return "error";
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
  pointerLockDisabledChange: () => unknown;
};

export class PointerLockManager {
  lockElementRef?: React.RefObject<HTMLCanvasElement | null>;
  deadZone?: number;
  emitter = new EventEmitter() as TypedEventEmitter<PointerLockManagerEvents>;

  isEntering = false;
  private lockInterval?: ReturnType<typeof setInterval>;
  private pointerLockDisabled = false;

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

  attachToElementRef(
    elementRef: React.RefObject<HTMLCanvasElement | null>,
    options: { disablePointerLock?: boolean } = {}
  ) {
    this.lockElementRef = elementRef;
    this.setPointerLockDisabled(options.disablePointerLock === true);
    this.emitter.emit("onAttach");
  }

  detach() {
    this.stopLockRetry();
    this.lockElementRef = undefined;
    this.setPointerLockDisabled(false);
    this.emitter.emit("onDetach");
  }

  private setPointerLockDisabled(disabled: boolean) {
    if (this.pointerLockDisabled === disabled) {
      return;
    }
    this.pointerLockDisabled = disabled;
    this.emitter.emit("pointerLockDisabledChange");
  }

  isPointerLockDisabled() {
    return this.pointerLockDisabled;
  }

  unlock() {
    this.stopLockRetry();
    tryExitPointerLock();
  }

  private stopLockRetry() {
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = undefined;
    }
    if (this.isEntering) {
      this.isEntering = false;
      this.emitter.emit("isEnteringChange");
    }
  }

  private tryLock(element: HTMLCanvasElement) {
    fireAndForget(
      requestPointerLockWithUnadjustedMovement(element).then((result) => {
        if (
          result === "cooldown" ||
          result === "gesture-required" ||
          result === "terminal-error"
        ) {
          // The browser (Safari/WebKit) only grants pointer lock from an
          // active user gesture. Timer-driven retries can never succeed and
          // only flood the console, so abandon the retry loop immediately.
          // Chromium's terminal UnknownError has the same retry policy and
          // falls back to focused pointerless input.
          if (result === "terminal-error") {
            this.setPointerLockDisabled(true);
          }
          element.focus();
          this.stopLockRetry();
        }
      })
    );
  }

  focusAndLock() {
    const element = this.lockElementRef?.current;
    if (!element) {
      return;
    }

    // Touch/virtual-joystick gameplay must never be gated on Pointer Lock.
    // Android browsers can expose the API even when the request is unusable,
    // which previously left the full-screen "Entering..." wash over the game
    // while the player had no working movement controls.
    if (this.pointerLockDisabled || !shouldUsePointerLock()) {
      this.stopLockRetry();
      element.focus();
      return;
    }

    if (this.lockInterval) {
      return;
    }

    if (this.isLocked()) {
      element.focus();
    } else {
      // First attempt runs synchronously within the user gesture that called
      // focusAndLock(), which is the only attempt Safari will honor.
      this.tryLock(element);
      element.focus();

      const start = performance.now();
      this.lockInterval = setInterval(() => {
        const timedOut = performance.now() - start > 5000;
        if (this.isLocked() || timedOut || !this.lockElementRef?.current) {
          if (timedOut && !this.isLocked() && this.lockElementRef?.current) {
            // Some embedded/restricted browsers expose Pointer Lock but reject
            // every request. Do not leave gameplay permanently detached after
            // the bounded retry window: fall back to focused pointerless input.
            this.setPointerLockDisabled(true);
          }
          this.stopLockRetry();
          this.lockElementRef?.current?.focus();
        } else {
          if (!this.isEntering) {
            this.isEntering = true;
            this.emitter.emit("isEnteringChange");
          }
          if (this.lockElementRef.current) {
            this.tryLock(this.lockElementRef.current);
          }
        }
      }, 125);
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
    // HARTHMERE_HUD_INPUT_LOCKED_WITHOUT_FOCUS
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

export function usePointerLockDisabledStatus() {
  const manager = usePointerLockManager();
  const [disabled, setDisabled] = useState(manager.isPointerLockDisabled());
  useEffect(
    () =>
      cleanEmitterCallback(manager.emitter, {
        pointerLockDisabledChange: () => {
          setDisabled(manager.isPointerLockDisabled());
        },
      }),
    [manager]
  );
  return disabled;
}
